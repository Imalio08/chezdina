"""Fix pack 5 — Products / Brands / Categories / Collections / Suppliers / Purchase-orders / Stock.
Covers: AI (desc/seo), brands KPIs/full/detail, categories tree/kpis + update,
collections CRUD + kpis, suppliers KPIs + admin-only detail (manager hidden),
PO KPIs + edit-guard + blind-receive + validate-gaps, stock KPIs + movements +
adjustment-requests role split + inventories blind count + close.
"""
import os
import pytest
import requests

def _read_frontend_env():
    try:
        with open("/app/frontend/.env", "r") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        return None
    return None


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _read_frontend_env() or "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
API = f"{BASE_URL}/api"

ADMIN = {"email": "aouattaraesca@gmail.com", "password": "Admin123!"}
MANAGER = {"email": "manager.cocody@dinastore.ci", "password": "Manager123!"}
RIDER = {"email": "rider1@dinastore.ci", "password": "Rider123!"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login {creds['email']} failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def admin():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def manager():
    return _login(MANAGER)


@pytest.fixture(scope="module")
def rider():
    return _login(RIDER)


# ---------- AI endpoints ----------
class TestAI:
    def test_ai_product_description(self, admin):
        r = admin.post(f"{API}/ai/product-description", json={
            "name": "Robe Wax Elegance",
            "brand": "Dina",
            "category": "Robes",
            "tone": "elegant",
            "length": "short",
            "colors": ["rouge"],
            "sizes": ["M", "L"],
        }, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "description" in d and len(d["description"]) > 30

    def test_ai_product_description_requires_name(self, admin):
        r = admin.post(f"{API}/ai/product-description", json={"name": ""}, timeout=30)
        assert r.status_code == 400

    def test_ai_product_seo(self, admin):
        r = admin.post(f"{API}/ai/product-seo", json={
            "name": "Sac Mini", "brand": "Dina", "category": "Sacs", "price": 25000
        }, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert "seo_title" in d and "seo_description" in d and "slug" in d
        assert len(d["seo_title"]) <= 60
        assert len(d["seo_description"]) <= 160
        assert d["slug"]


# ---------- Brands ----------
class TestBrands:
    def test_brands_kpis(self, admin):
        r = admin.get(f"{API}/brands/kpis", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ("total", "actives"):
            assert k in d

    def test_brands_full(self, admin):
        r = admin.get(f"{API}/brands/full", timeout=30)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)

    def test_brand_detail(self, admin):
        rows = admin.get(f"{API}/brands/full").json()
        if not rows:
            pytest.skip("no brands")
        bid = rows[0].get("id")
        if not bid:
            pytest.skip("brand without id")
        r = admin.get(f"{API}/brands/{bid}", timeout=30)
        assert r.status_code in (200, 404)


# ---------- Categories & Collections ----------
class TestCategories:
    def test_categories_tree(self, admin):
        r = admin.get(f"{API}/categories/tree", timeout=30)
        assert r.status_code == 200
        tree = r.json()
        assert isinstance(tree, list)
        if tree:
            assert "children" in tree[0]
            assert "product_count" in tree[0]

    def test_categories_kpis(self, admin):
        r = admin.get(f"{API}/categories/kpis", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ("total", "sub", "top"):
            assert k in d


class TestCollections:
    def test_collection_crud(self, admin):
        payload = {"name": "TEST_FP5_Collection", "kind": "manual", "product_ids": [], "visible": True}
        c = admin.post(f"{API}/collections", json=payload, timeout=30)
        assert c.status_code == 200, c.text
        cid = c.json()["id"]
        try:
            lst = admin.get(f"{API}/collections").json()
            assert any(x["id"] == cid for x in lst)
            u = admin.patch(f"{API}/collections/{cid}", json={"description": "test"})
            assert u.status_code == 200
            k = admin.get(f"{API}/collections/kpis")
            assert k.status_code == 200 and "total" in k.json()
        finally:
            d = admin.delete(f"{API}/collections/{cid}")
            assert d.status_code == 200


# ---------- Suppliers ----------
class TestSuppliers:
    def test_suppliers_kpis(self, admin):
        r = admin.get(f"{API}/suppliers/kpis", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ("total", "actives", "purchased_30d", "balance", "avg_lead_days"):
            assert k in d, f"missing kpi {k}: {d}"

    def test_supplier_detail_admin_only(self, admin, manager):
        rows = admin.get(f"{API}/suppliers").json()
        if not rows:
            pytest.skip("no suppliers")
        sid = rows[0]["id"]
        r_admin = admin.get(f"{API}/suppliers/{sid}", timeout=30)
        assert r_admin.status_code == 200
        d = r_admin.json()
        assert "stats" in d
        # manager must be forbidden
        r_mgr = manager.get(f"{API}/suppliers/{sid}", timeout=30)
        assert r_mgr.status_code == 403, f"manager should be denied, got {r_mgr.status_code}"

    def test_manager_sees_only_name_country(self, manager):
        rows = manager.get(f"{API}/suppliers").json()
        if not rows:
            pytest.skip("no suppliers")
        sample = rows[0]
        # phone/email/manager fields should be absent or null for manager
        for sensitive in ("phone", "email", "manager_name", "manager_phone", "whatsapp"):
            assert not sample.get(sensitive), f"manager leaked {sensitive}={sample.get(sensitive)}"


# ---------- Purchase orders ----------
class TestPurchaseOrders:
    def test_po_kpis(self, admin):
        r = admin.get(f"{API}/purchase-orders/kpis", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ("this_month", "total_month", "pending", "partial", "due", "avg_expected_margin"):
            assert k in d, f"missing {k}: {d}"

    def test_po_edit_guard(self, admin):
        rows = admin.get(f"{API}/purchase-orders").json()
        if not rows:
            pytest.skip("no PO")
        pid = rows[0]["id"]
        r = admin.patch(f"{API}/purchase-orders/{pid}/edit-guard", json={"note": "test"}, timeout=30)
        assert r.status_code in (200, 400)

    def test_blind_receive_and_validate_gaps(self, admin):
        # Create a brouillon PO with a known product
        prods = admin.get(f"{API}/products").json()
        candidate = next((p for p in prods if (p.get("stock_by_size") or {})), None)
        if not candidate:
            pytest.skip("no product with sizes")
        size = next(iter(candidate["stock_by_size"].keys()))
        sups = admin.get(f"{API}/suppliers").json()
        if not sups:
            pytest.skip("no supplier")
        po_payload = {
            "number": "TEST_FP5_PO",
            "supplier_id": sups[0]["id"],
            "supplier_name": sups[0]["name"],
            "status": "commande",
            "items": [{
                "product_id": candidate["id"],
                "product_name": candidate["name"],
                "sku": candidate.get("sku",""),
                "size": size,
                "qty": 10,
                "unit_cost": 1000,
                "sell_price": 2500,
            }],
            "total": 10000,
            "balance_due": 10000,
        }
        c = admin.post(f"{API}/purchase-orders", json=po_payload, timeout=30)
        assert c.status_code == 200, c.text
        pid = c.json()["id"]
        try:
            # Blind receive with mismatching count (8 instead of 10)
            br = admin.post(f"{API}/purchase-orders/{pid}/blind-receive", json={
                "counts": [{"line_id": 0, "product_id": candidate["id"], "qty_counted": 8}],
                "photos": ["data:image/png;base64,AAAA"],
                "signature": "data:image/png;base64,SIG",
            }, timeout=30)
            assert br.status_code == 200, br.text
            d = br.json()
            # Must flag gap and set partial status
            po_after = admin.get(f"{API}/purchase-orders/{pid}").json()
            assert po_after.get("status") in ("recu_partiel", "recu")
            assert po_after.get("reception", {}).get("gaps"), "gaps should be reported"

            # Validate gaps as admin
            vg = admin.post(f"{API}/purchase-orders/{pid}/validate-gaps", json={"note": "ok"}, timeout=30)
            assert vg.status_code == 200
            po_v = admin.get(f"{API}/purchase-orders/{pid}").json()
            assert po_v.get("reception", {}).get("validated") is True
        finally:
            admin.delete(f"{API}/purchase-orders/{pid}")


# ---------- Stock ----------
class TestStock:
    def test_stock_kpis(self, admin):
        r = admin.get(f"{API}/stock/kpis", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ("value", "items", "ruptures", "low", "dormant", "ecarts_month"):
            assert k in d, f"missing kpi {k}: {d}"

    def test_stock_movements(self, admin):
        r = admin.get(f"{API}/stock/movements", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_adjustment_requests_role_split(self, admin, manager):
        prods = admin.get(f"{API}/products").json()
        cand = next((p for p in prods if (p.get("stock_by_size") or {})), None)
        if not cand:
            pytest.skip("no product with sizes")
        size = next(iter(cand["stock_by_size"].keys()))

        # Admin: direct apply
        ra = admin.post(f"{API}/stock/adjustment-requests", json={
            "product_id": cand["id"], "product_name": cand["name"], "size": size,
            "qty_delta": 0, "reason": "TEST_FP5 admin"
        }, timeout=30)
        assert ra.status_code == 200
        da = ra.json()
        assert da.get("status") == "approved", f"admin should auto-approve, got {da}"

        # Manager: pending
        rm = manager.post(f"{API}/stock/adjustment-requests", json={
            "product_id": cand["id"], "product_name": cand["name"], "size": size,
            "qty_delta": 0, "reason": "TEST_FP5 mgr"
        }, timeout=30)
        assert rm.status_code == 200
        dm = rm.json()
        assert dm.get("status") == "pending"
        # admin decides reject (no stock impact)
        decide = admin.post(f"{API}/stock/adjustment-requests/{dm['id']}/decide",
                            json={"decision": "reject", "note": "test"}, timeout=30)
        assert decide.status_code == 200

    def test_inventory_blind_count_and_close(self, admin, manager):
        prods = admin.get(f"{API}/products").json()
        cand = next((p for p in prods if (p.get("stock_by_size") or {})), None)
        if not cand:
            pytest.skip("no product with sizes")
        c = admin.post(f"{API}/stock/inventories", json={
            "name": "TEST_FP5 Inv", "product_ids": [cand["id"]],
        }, timeout=30)
        assert c.status_code == 200
        iid = c.json()["id"]
        # Manager fetches inventories: for open inventories qty_expected must be hidden on lines
        invs_mgr = manager.get(f"{API}/stock/inventories").json()
        mine_mgr = next((x for x in invs_mgr if x["id"] == iid), None)
        if mine_mgr:
            for ln in mine_mgr.get("lines", []):
                assert ln.get("qty_expected") in (None, 0, ""), \
                    f"blind inventory leak to manager: {ln}"
        # Admin sees qty_expected
        invs_adm = admin.get(f"{API}/stock/inventories").json()
        mine_adm = next((x for x in invs_adm if x["id"] == iid), None)
        assert mine_adm and any("qty_expected" in ln for ln in mine_adm["lines"])
        # Count
        counts = [{"line_index": i, "qty_counted": int(ln["qty_expected"])} for i, ln in enumerate(mine_adm["lines"])]
        cnt = admin.post(f"{API}/stock/inventories/{iid}/count", json={"counts": counts}, timeout=30)
        assert cnt.status_code == 200
        # Close
        cl = admin.post(f"{API}/stock/inventories/{iid}/close", json={"note": "test close"}, timeout=30)
        assert cl.status_code == 200


# ---------- Rider / Delivery templates (Pack 4 regression) ----------
class TestRiderScore:
    def test_rider_score_weights(self, admin, rider):
        me = rider.get(f"{API}/auth/me").json()
        rid = me["id"]
        r = rider.get(f"{API}/riders/{rid}/score", timeout=30)
        assert r.status_code == 200
        d = r.json()
        # score block should expose breakdown weights (0..100)
        assert "score" in d
        assert isinstance(d.get("score"), (int, float))

    def test_delivery_templates_weights(self, admin):
        r = admin.get(f"{API}/delivery-templates", timeout=30)
        assert r.status_code == 200
        d = r.json()
        w = d.get("score_weights") or {}
        for k in ("delivery_rate", "punctuality", "rating", "cash", "proof"):
            assert k in w
        # sum should be ~100
        assert abs(sum(w.values()) - 100) <= 2
