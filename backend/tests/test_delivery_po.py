"""Tests for Section 6 (Delivery) + Section 7 (Purchases/Reliquats).
Covers: rider location push/list, delivery-sessions reconcile PIN, PO CRUD, PO receive w/ labels.
"""
import os, pytest, requests, uuid, time

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "aouattaraesca@gmail.com", "password": "Admin123!"}
MANAGER = {"email": "manager.cocody@dinastore.ci", "password": "Manager123!"}
RIDER = {"email": "rider1@dinastore.ci", "password": "Rider123!"}

PIN_ADMIN = "1234"
PIN_MANAGER = "2222"


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def admin():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def rider():
    return _login(RIDER)


# ---------- Rider live GPS ----------
class TestRiderLocation:
    def test_push_location_upsert(self, rider):
        r = rider.post(f"{API}/riders/location", json={"lat": 5.345, "lng": -4.015, "accuracy": 12}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
        # Second push should upsert (not create duplicate)
        r2 = rider.post(f"{API}/riders/location", json={"lat": 5.350, "lng": -4.020, "accuracy": 10}, timeout=15)
        assert r2.status_code == 200

    def test_list_locations(self, admin, rider):
        rider.post(f"{API}/riders/location", json={"lat": 5.360, "lng": -4.010}, timeout=15)
        r = admin.get(f"{API}/riders/locations", timeout=15)
        assert r.status_code == 200
        locs = r.json()
        assert isinstance(locs, list)
        mine = [l for l in locs if l.get("lat") and l.get("lng")]
        assert len(mine) >= 1
        first = mine[0]
        for k in ("lat", "lng", "rider_name", "updated_at"):
            assert k in first, f"missing field {k}"


# ---------- Reconciliation PIN flow ----------
class TestReconcile:
    @pytest.fixture(scope="class")
    def session_and_order(self, request):
        admin_s = _login(ADMIN)
        # Find a COD order to put in a session
        orders = admin_s.get(f"{API}/orders", timeout=20).json()
        cod_orders = [o for o in orders if o.get("payment_method") == "cod"]
        if not cod_orders:
            pytest.skip("No COD orders available")
        order = cod_orders[0]
        # Find a rider
        users = admin_s.get(f"{API}/users", timeout=15).json()
        rider_user = next((u for u in users if u.get("role") == "rider"), None)
        if not rider_user:
            pytest.skip("No rider user")
        # Create a session
        r = admin_s.post(f"{API}/delivery-sessions", json={
            "rider_id": rider_user["id"], "rider_name": rider_user.get("name", "Rider"),
        }, timeout=15)
        assert r.status_code == 200, r.text
        sid = r.json().get("id")
        # Add order to session
        r = admin_s.patch(f"{API}/delivery-sessions/{sid}/add-order", json={"order_id": order["id"]}, timeout=15)
        assert r.status_code == 200
        return admin_s, sid, order

    def test_reconcile_missing_pin_when_collected(self, session_and_order):
        admin_s, sid, order = session_and_order
        r = admin_s.patch(f"{API}/delivery-sessions/{sid}/reconcile", json={
            "order_id": order["id"], "collected": True, "amount": order["total"],
        }, timeout=15)
        assert r.status_code == 400

    def test_reconcile_bad_pin(self, session_and_order):
        admin_s, sid, order = session_and_order
        r = admin_s.patch(f"{API}/delivery-sessions/{sid}/reconcile", json={
            "order_id": order["id"], "collected": True, "amount": order["total"], "pin": "9999",
        }, timeout=15)
        assert r.status_code == 403

    def test_reconcile_valid_admin_pin(self, session_and_order):
        admin_s, sid, order = session_and_order
        amt = float(order["total"]) + 500  # induce ecart
        r = admin_s.patch(f"{API}/delivery-sessions/{sid}/reconcile", json={
            "order_id": order["id"], "collected": True, "amount": amt, "pin": PIN_ADMIN,
        }, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        rec = body.get("reconciliation", {})
        assert rec.get("collected") is True
        assert rec.get("amount") == amt
        assert rec.get("ecart") == amt - order["total"]
        assert rec.get("approved_by")

    def test_reconcile_valid_manager_pin(self, session_and_order):
        admin_s, sid, order = session_and_order
        r = admin_s.patch(f"{API}/delivery-sessions/{sid}/reconcile", json={
            "order_id": order["id"], "collected": True, "amount": order["total"], "pin": PIN_MANAGER,
        }, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("reconciliation", {}).get("approved_by")


# ---------- Purchase Orders CRUD + Receive ----------
class TestPurchaseOrders:
    @pytest.fixture(scope="class")
    def po_setup(self):
        admin_s = _login(ADMIN)
        # Pick a supplier
        sups = admin_s.get(f"{API}/suppliers", timeout=15).json()
        if not sups:
            r = admin_s.post(f"{API}/suppliers", json={"name": "TEST_Supplier", "country": "CI"}, timeout=15)
            sup = r.json()
        else:
            sup = sups[0]
        # Pick a product with stock_by_size
        prods = admin_s.get(f"{API}/products", timeout=20).json()
        sized = [p for p in prods if isinstance(p.get("stock_by_size"), dict) and p["stock_by_size"]]
        if not sized:
            pytest.skip("No sized products")
        prod = sized[0]
        size = list(prod["stock_by_size"].keys())[0]
        color = (prod.get("colors") or ["Noir"])[0]
        return admin_s, sup, prod, size, color

    def test_create_po_with_items_and_extras(self, po_setup):
        admin_s, sup, prod, size, color = po_setup
        payload = {
            "supplier_id": sup["id"], "supplier_name": sup["name"],
            "items": [{"product_id": prod["id"], "product_name": prod["name"],
                       "sku": prod.get("sku") or "TEST_SKU", "size": size, "color": color,
                       "qty": 3, "unit_cost": 3000}],
            "extra_costs": [{"label": "Fret", "amount": 1500}],
            "total": 9000 + 1500,
        }
        r = admin_s.post(f"{API}/purchase-orders", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        po = r.json()
        assert po.get("id")
        assert po.get("number", "").startswith("BC-")
        assert len(po.get("items", [])) == 1
        assert len(po.get("extra_costs", [])) == 1
        # Persist on the test instance
        TestPurchaseOrders.created_po_id = po["id"]

    def test_patch_po(self, po_setup):
        admin_s, *_ = po_setup
        pid = TestPurchaseOrders.created_po_id
        r = admin_s.patch(f"{API}/purchase-orders/{pid}", json={"note": "TEST_updated"}, timeout=15)
        assert r.status_code == 200
        # Verify
        pos = admin_s.get(f"{API}/purchase-orders", timeout=15).json()
        po = next(p for p in pos if p["id"] == pid)
        assert po.get("note") == "TEST_updated"

    def test_receive_po_generates_labels_and_increments_stock(self, po_setup):
        admin_s, sup, prod, size, color = po_setup
        pid = TestPurchaseOrders.created_po_id
        # Capture stock before
        before = admin_s.get(f"{API}/products", timeout=20).json()
        prod_before = next(p for p in before if p["id"] == prod["id"])
        stock_before = (prod_before.get("stock_by_size") or {}).get(size, 0)
        total_stock_before = prod_before.get("stock", 0)

        payload = {
            "items": [{"product_id": prod["id"], "product_name": prod["name"],
                       "sku": prod.get("sku") or "TEST_SKU", "size": size, "color": color,
                       "qty": 3, "unit_cost": 3000}],
            "extra_costs": [{"label": "Fret", "amount": 1500}],
        }
        r = admin_s.post(f"{API}/purchase-orders/{pid}/receive", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["extras_total"] == 1500
        assert data["base_total"] == 9000
        labels = data.get("labels", [])
        assert len(labels) == 3, f"expected 3 labels, got {len(labels)}"
        for lb in labels:
            assert lb["sku"] and lb["size"] == size and lb["color"] == color
            assert lb["qr"] == f"{lb['sku']}|{size}|{color}"
            assert lb["po_number"]
            # landed = 3000 + 1500/3 = 3500
            assert lb["unit_cost"] == 3500

        # Verify PO status
        pos = admin_s.get(f"{API}/purchase-orders", timeout=15).json()
        po = next(p for p in pos if p["id"] == pid)
        assert po.get("status") == "receptionne"

        # Verify stock increment
        after = admin_s.get(f"{API}/products", timeout=20).json()
        prod_after = next(p for p in after if p["id"] == prod["id"])
        stock_after = (prod_after.get("stock_by_size") or {}).get(size, 0)
        assert stock_after == stock_before + 3
        assert prod_after.get("stock", 0) == total_stock_before + 3

    def test_delete_po(self, po_setup):
        admin_s, *_ = po_setup
        # Create a disposable PO
        r = admin_s.post(f"{API}/purchase-orders", json={
            "supplier_id": po_setup[1]["id"], "supplier_name": po_setup[1]["name"],
            "items": [], "extra_costs": [], "total": 0,
        }, timeout=15)
        pid = r.json()["id"]
        r = admin_s.delete(f"{API}/purchase-orders/{pid}", timeout=15)
        assert r.status_code == 200
        pos = admin_s.get(f"{API}/purchase-orders", timeout=15).json()
        assert not any(p["id"] == pid for p in pos)
