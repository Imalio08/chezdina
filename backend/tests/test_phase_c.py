"""Phase C backend tests: favorites (toggle/list/merge), auto-waitlist on stock=0,
regression on GET /customers/{cid} (route shadowing fix), and Phase A/B smoke."""
import os
import pytest
import requests

def _load_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v: return v
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not set")

BASE = _load_url().rstrip("/") + "/api"

ADMIN_EMAIL = "aouattaraesca@gmail.com"
ADMIN_PW = "Admin123!"
CUST_PHONE = "+225 07 60 17 28 21"
CUST_CODE = "142085"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def cust_token():
    r = requests.post(f"{BASE}/public/customer-login-code", json={"phone": CUST_PHONE, "code": CUST_CODE})
    assert r.status_code == 200, r.text
    data = r.json()
    return data["token"], data["customer"]["id"]


@pytest.fixture(scope="session")
def cust_h(cust_token):
    return {"Authorization": f"Bearer {cust_token[0]}"}


@pytest.fixture(scope="session")
def sample_product_ids(admin_h):
    r = requests.get(f"{BASE}/products", headers=admin_h)
    assert r.status_code == 200
    prods = r.json()
    assert len(prods) >= 2
    return [p["id"] for p in prods[:3]]


# ---------- Favorites ----------
class TestFavorites:
    def test_favorites_initial_list(self, cust_h):
        r = requests.get(f"{BASE}/public/account/favorites", headers=cust_h)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_favorites_toggle_add_remove(self, cust_h, sample_product_ids):
        pid = sample_product_ids[0]
        # ensure removed first
        requests.post(f"{BASE}/public/account/favorites/toggle", headers=cust_h, json={"product_id": pid})
        r1 = requests.post(f"{BASE}/public/account/favorites/toggle", headers=cust_h, json={"product_id": pid})
        assert r1.status_code == 200
        d1 = r1.json()
        assert d1["ok"] is True
        assert d1["state"] in ("added", "removed")
        first_state = d1["state"]
        r2 = requests.post(f"{BASE}/public/account/favorites/toggle", headers=cust_h, json={"product_id": pid})
        d2 = r2.json()
        assert d2["state"] != first_state
        assert isinstance(d2["favorites"], list)

    def test_favorites_toggle_requires_pid(self, cust_h):
        r = requests.post(f"{BASE}/public/account/favorites/toggle", headers=cust_h, json={})
        assert r.status_code == 400

    def test_favorites_list_enriched(self, cust_h, sample_product_ids):
        pid = sample_product_ids[0]
        # Make sure it's added
        r = requests.post(f"{BASE}/public/account/favorites/toggle", headers=cust_h, json={"product_id": pid})
        if r.json()["state"] == "removed":
            requests.post(f"{BASE}/public/account/favorites/toggle", headers=cust_h, json={"product_id": pid})
        r = requests.get(f"{BASE}/public/account/favorites", headers=cust_h)
        assert r.status_code == 200
        items = r.json()
        assert any(x.get("id") == pid for x in items)
        # Enriched: should have a name/price
        matched = next(x for x in items if x["id"] == pid)
        assert "name" in matched and "price" in matched

    def test_favorites_merge(self, cust_h, sample_product_ids):
        pids = sample_product_ids
        r = requests.post(f"{BASE}/public/account/favorites/merge", headers=cust_h, json={"product_ids": pids})
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True
        assert d["count"] >= len(set(pids))
        assert set(pids).issubset(set(d["favorites"]))

    def test_favorites_requires_auth(self):
        r = requests.get(f"{BASE}/public/account/favorites")
        assert r.status_code in (401, 403)


# ---------- Auto-waitlist ----------
class TestAutoWaitlist:
    def test_auto_waitlist_on_stock_zero(self, admin_h):
        # Create a temp product with stock=1 and no stock_by_size
        pbody = {
            "name": "TEST_AutoWaitlist_PhaseC",
            "price": 10000,
            "category": "robes",
            "brand": "Test",
            "stock": 1,
            "status": "actif",
        }
        rc = requests.post(f"{BASE}/products", headers=admin_h, json=pbody)
        assert rc.status_code in (200, 201), rc.text
        pid = rc.json()["id"]
        try:
            order = {
                "items": [{"product_id": pid, "name": "TEST_AutoWaitlist_PhaseC", "qty": 1, "price": 10000}],
                "customer": {"id": "test-c", "name": "Test", "phone": "+22500000000"},
                "channel": "boutique", "payment_method": "cash", "delivery_zone": "", "delivery_fee": 0,
                "discount": 0, "note": "", "mode": "store"
            }
            ro = requests.post(f"{BASE}/orders", headers=admin_h, json=order)
            assert ro.status_code in (200, 201), ro.text
            # verify status flipped
            rp = requests.get(f"{BASE}/products", headers=admin_h)
            p = next((x for x in rp.json() if x["id"] == pid), None)
            assert p is not None
            assert p.get("status") == "liste_attente", f"expected liste_attente got {p.get('status')} stock={p.get('stock')}"
            assert p.get("auto_waitlist_at")
        finally:
            requests.delete(f"{BASE}/products/{pid}", headers=admin_h)


# ---------- Regression: GET /customers/{cid} ----------
class TestCustomerDetailRegression:
    def test_get_customer_detail(self, admin_h, cust_token):
        _, cid = cust_token
        r = requests.get(f"{BASE}/customers/{cid}", headers=admin_h)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "customer" in d and "orders" in d and "metrics" in d
        assert d["customer"]["id"] == cid
        assert isinstance(d["orders"], list)
        assert "total_orders" in d["metrics"]


# ---------- Phase A/B smoke ----------
class TestPhaseABSmoke:
    def test_search_suggestions(self):
        r = requests.get(f"{BASE}/public/search-suggestions", params={"q": "r"})
        assert r.status_code == 200

    def test_best_sellers(self):
        r = requests.get(f"{BASE}/public/best-sellers")
        assert r.status_code == 200

    def test_pos_shortcuts(self, admin_h):
        r = requests.get(f"{BASE}/pos/shortcuts", headers=admin_h)
        assert r.status_code == 200

    def test_pos_shared_cart(self, admin_h):
        r = requests.post(f"{BASE}/pos/shared-cart", headers=admin_h, json={"items": [], "customer": {"name": "T", "phone": "+22500000000"}})
        assert r.status_code in (200, 201, 400)

    def test_waitlist_list(self, admin_h):
        r = requests.get(f"{BASE}/waitlist", headers=admin_h)
        assert r.status_code == 200

    def test_ai_parse_order(self, admin_h):
        r = requests.post(f"{BASE}/ai/parse-order", headers=admin_h, json={"text": "2 robes rouges taille M"})
        assert r.status_code in (200, 400, 500)  # route exists

    def test_products_kpis(self, admin_h):
        r = requests.get(f"{BASE}/products/kpis", headers=admin_h)
        assert r.status_code == 200
        assert "actifs" in r.json()

    def test_products_sales_30d(self, admin_h):
        r = requests.get(f"{BASE}/products/sales-30d", headers=admin_h)
        assert r.status_code == 200

    def test_product_history_route_regression(self, admin_h, sample_product_ids):
        """CRITICAL regression — this route was orphaned by an incomplete decorator insert."""
        pid = sample_product_ids[0]
        r = requests.get(f"{BASE}/products/{pid}/history", headers=admin_h)
        assert r.status_code == 200, f"status={r.status_code} body={r.text}"
        d = r.json()
        assert "sales" in d and "waitlist" in d
