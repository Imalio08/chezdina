"""
Iter48 P5 refactor tranche 3 — catalog extracted into routers/catalog.py.
Covers: products, brands, categories, collections (CRUD + KPIs + public).
Plus RBAC and regression on server.py endpoints that still reference catalog models.
"""
import os
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")

CREDS = {
    "admin":   ("aouattaraesca@gmail.com", "Admin123!"),
    "manager": ("manager.cocody@dinastore.ci", "Manager123!"),
    "sales":   ("agent1@dinastore.ci", "Agent123!"),
    "stock":   ("stock@dinastore.ci", "Stock123!"),
}


def _login(role):
    email, pwd = CREDS[role]
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": pwd}, timeout=15)
    assert r.status_code == 200, f"Login {role} failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def tokens():
    return {k: _login(k) for k in CREDS}


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- Products ----------
class TestProducts:
    def test_list_products_auth(self, tokens):
        r = requests.get(f"{BASE}/api/products", headers=H(tokens["admin"]))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # No raw _id leak
        assert all("_id" not in p for p in data)

    def test_list_products_unauth(self):
        r = requests.get(f"{BASE}/api/products")
        assert r.status_code in (401, 403)

    def test_public_products_no_auth(self):
        r = requests.get(f"{BASE}/api/public/products")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_public_products_query_filter(self):
        r = requests.get(f"{BASE}/api/public/products", params={"q": "zzz_nonexistent_xyz"})
        assert r.status_code == 200
        assert r.json() == []

    def test_create_product_as_stock_keeper(self, tokens):
        payload = {
            "name": "TEST_iter48_prod_sk",
            "price": 1000, "cost": 500, "stock": 5,
            "category": "Accessoires", "brand": "TEST_iter48_brand",
        }
        r = requests.post(f"{BASE}/api/products", headers=H(tokens["stock"]), json=payload)
        assert r.status_code == 200, r.text
        pid = r.json().get("id")
        assert pid
        # cleanup via admin (stock can't delete)
        d = requests.delete(f"{BASE}/api/products/{pid}", headers=H(tokens["admin"]))
        assert d.status_code == 200

    def test_create_product_as_sales_forbidden(self, tokens):
        r = requests.post(f"{BASE}/api/products", headers=H(tokens["sales"]), json={
            "name": "TEST_iter48_prod_forbidden", "category": "Accessoires", "price": 100, "cost": 50
        })
        assert r.status_code == 403

    def test_delete_product_as_stock_keeper_forbidden(self, tokens):
        # Create via admin first
        r = requests.post(f"{BASE}/api/products", headers=H(tokens["admin"]), json={
            "name": "TEST_iter48_prod_delguard", "category": "Accessoires", "price": 100, "cost": 50
        })
        assert r.status_code == 200
        pid = r.json()["id"]
        # stock_keeper may NOT delete
        d = requests.delete(f"{BASE}/api/products/{pid}", headers=H(tokens["stock"]))
        assert d.status_code == 403
        # admin cleanup
        requests.delete(f"{BASE}/api/products/{pid}", headers=H(tokens["admin"]))

    def test_patch_product(self, tokens):
        r = requests.post(f"{BASE}/api/products", headers=H(tokens["admin"]), json={
            "name": "TEST_iter48_patch", "category": "Accessoires", "price": 1000, "cost": 500, "stock": 2
        })
        pid = r.json()["id"]
        p = requests.patch(f"{BASE}/api/products/{pid}", headers=H(tokens["admin"]),
                           json={"price": 1500})
        assert p.status_code == 200
        # verify
        lst = requests.get(f"{BASE}/api/products", headers=H(tokens["admin"]), params={"q": "TEST_iter48_patch"}).json()
        matched = [x for x in lst if x["id"] == pid]
        assert matched and matched[0]["price"] == 1500
        requests.delete(f"{BASE}/api/products/{pid}", headers=H(tokens["admin"]))


# ---------- Brands ----------
class TestBrands:
    def test_list_brands(self, tokens):
        r = requests.get(f"{BASE}/api/brands", headers=H(tokens["admin"]))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert all("name" in b and "product_count" in b for b in data)

    def test_brands_full(self, tokens):
        r = requests.get(f"{BASE}/api/brands/full", headers=H(tokens["admin"]))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert all(all(k in b for k in ("name", "product_count", "ca_30d", "avg_margin")) for b in data)

    def test_brand_crud_full(self, tokens):
        # create
        r = requests.post(f"{BASE}/api/brands", headers=H(tokens["admin"]),
                          json={"name": "TEST_iter48_brand_crud", "note": "x"})
        assert r.status_code == 200
        bid = r.json()["id"]
        # detail
        d = requests.get(f"{BASE}/api/brands/{bid}", headers=H(tokens["admin"]))
        assert d.status_code == 200
        assert "stats" in d.json()
        # patch
        p = requests.patch(f"{BASE}/api/brands/{bid}", headers=H(tokens["admin"]),
                           json={"note": "updated"})
        assert p.status_code == 200
        # delete
        de = requests.delete(f"{BASE}/api/brands/{bid}", headers=H(tokens["admin"]))
        assert de.status_code == 200

    def test_brand_create_as_sales_forbidden(self, tokens):
        r = requests.post(f"{BASE}/api/brands", headers=H(tokens["sales"]),
                          json={"name": "TEST_iter48_brand_forbid"})
        assert r.status_code == 403


# ---------- Categories ----------
class TestCategories:
    def test_list_categories(self, tokens):
        r = requests.get(f"{BASE}/api/categories", headers=H(tokens["admin"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_categories_tree(self, tokens):
        r = requests.get(f"{BASE}/api/categories/tree", headers=H(tokens["admin"]))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert all("children" in n for n in data)

    def test_categories_kpis(self, tokens):
        r = requests.get(f"{BASE}/api/categories/kpis", headers=H(tokens["admin"]))
        assert r.status_code == 200
        j = r.json()
        for k in ("total", "sub", "top", "top_ca"):
            assert k in j

    def test_category_crud(self, tokens):
        r = requests.post(f"{BASE}/api/categories", headers=H(tokens["admin"]),
                          json={"name": "TEST_iter48_cat"})
        assert r.status_code == 200
        cid = r.json()["id"]
        p = requests.patch(f"{BASE}/api/categories/{cid}", headers=H(tokens["admin"]),
                           json={"note": "x"})
        assert p.status_code == 200
        d = requests.delete(f"{BASE}/api/categories/{cid}", headers=H(tokens["admin"]))
        assert d.status_code == 200


# ---------- Collections ----------
class TestCollections:
    def test_list_collections(self, tokens):
        r = requests.get(f"{BASE}/api/collections", headers=H(tokens["admin"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_collections_kpis(self, tokens):
        r = requests.get(f"{BASE}/api/collections/kpis", headers=H(tokens["admin"]))
        assert r.status_code == 200
        j = r.json()
        for k in ("total", "actives", "products"):
            assert k in j

    def test_collection_crud(self, tokens):
        r = requests.post(f"{BASE}/api/collections", headers=H(tokens["admin"]),
                          json={"name": "TEST_iter48_col", "kind": "manual", "product_ids": []})
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        p = requests.patch(f"{BASE}/api/collections/{cid}", headers=H(tokens["admin"]),
                           json={"name": "TEST_iter48_col_renamed"})
        assert p.status_code == 200
        d = requests.delete(f"{BASE}/api/collections/{cid}", headers=H(tokens["admin"]))
        assert d.status_code == 200


# ---------- Regression (server.py endpoints that still ref catalog models) ----------
class TestServerRegression:
    def test_products_kpis(self, tokens):
        r = requests.get(f"{BASE}/api/products/kpis", headers=H(tokens["admin"]))
        assert r.status_code == 200

    def test_products_sales_30d(self, tokens):
        r = requests.get(f"{BASE}/api/products/sales-30d", headers=H(tokens["admin"]))
        assert r.status_code == 200

    def test_attendance_me(self, tokens):
        r = requests.get(f"{BASE}/api/attendance/me", headers=H(tokens["admin"]))
        assert r.status_code == 200

    def test_auth_me(self, tokens):
        r = requests.get(f"{BASE}/api/auth/me", headers=H(tokens["admin"]))
        assert r.status_code == 200
        assert r.json().get("role") == "admin"

    def test_customer_register_existing(self):
        payload = {
            "name": "Dupe iter48",
            "phone": "+225 07 85 55 58 88",
            "email": "dupe-iter48@test.ci",
            "password": "Secret123!",
        }
        r = requests.post(f"{BASE}/api/public/customer-register", json=payload)
        # Either 200 (not seeded in this env) or 400 'Compte existant'
        assert r.status_code in (200, 400), r.text
