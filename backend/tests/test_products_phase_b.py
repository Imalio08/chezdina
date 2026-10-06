"""Phase B — Products console v3 + Marques CRUD backend tests."""
import os, pytest, requests, time

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    # Fallback for local test (frontend .env)
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE = line.split("=", 1)[1].strip().rstrip("/")

ADMIN = {"email": "aouattaraesca@gmail.com", "password": "Admin123!"}


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    r = s.post(f"{BASE}/api/auth/login", json=ADMIN, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def product_ids(client):
    r = client.get(f"{BASE}/api/products", timeout=20)
    assert r.status_code == 200
    prods = r.json()
    assert len(prods) > 0, "no products in DB - reseed may be required"
    return [p["id"] for p in prods]


# ---------- KPIs ----------
class TestKpis:
    def test_kpis_keys(self, client):
        r = client.get(f"{BASE}/api/products/kpis", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["actifs","inactifs","brouillon","liste_attente","rupture","stock_bas","valeur_cout","valeur_vente","marge_moyenne","total"]:
            assert k in d, f"missing key {k}"
        assert isinstance(d["total"], int) and d["total"] > 0
        assert isinstance(d["marge_moyenne"], (int,float))


# ---------- sales-30d ----------
class TestSales30d:
    def test_sales_30d_dict(self, client):
        r = client.get(f"{BASE}/api/products/sales-30d", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d, dict)
        # values must be integers
        for pid, qty in d.items():
            assert isinstance(qty, int)


# ---------- bulk-status ----------
class TestBulkStatus:
    def test_bulk_status_updates(self, client, product_ids):
        ids = product_ids[:3]
        r = client.post(f"{BASE}/api/products/bulk-status", json={"ids": ids, "status": "brouillon"}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert d.get("count") == len(ids)
        # verify persistence
        for pid in ids:
            got = client.get(f"{BASE}/api/products", timeout=20).json()
            p = next((x for x in got if x["id"] == pid), None)
            assert p and p.get("status") == "brouillon"
        # restore to actif
        client.post(f"{BASE}/api/products/bulk-status", json={"ids": ids, "status": "actif"}, timeout=20)

    def test_bulk_status_requires_fields(self, client):
        r = client.post(f"{BASE}/api/products/bulk-status", json={"ids": [], "status": "brouillon"}, timeout=20)
        assert r.status_code == 400


# ---------- bulk-promo ----------
class TestBulkPromo:
    def test_bulk_promo_reduces_price(self, client, product_ids):
        ids = product_ids[3:6] if len(product_ids) >= 6 else product_ids[:2]
        # capture pre-prices
        all_prods = client.get(f"{BASE}/api/products", timeout=20).json()
        pre = {p["id"]: p.get("price",0) for p in all_prods if p["id"] in ids}
        r = client.post(f"{BASE}/api/products/bulk-promo", json={"ids": ids, "discount_pct": 20}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True and d.get("count") == len(ids)
        post_prods = client.get(f"{BASE}/api/products", timeout=20).json()
        for pid in ids:
            p = next((x for x in post_prods if x["id"] == pid), None)
            assert p is not None
            assert p.get("price_old") == pre[pid], f"price_old mismatch {p.get('price_old')} vs {pre[pid]}"
            assert p.get("price") < pre[pid], f"price not reduced: {p.get('price')} >= {pre[pid]}"
            assert p.get("promo_pct") == 20
        # restore prices
        for pid in ids:
            client.patch(f"{BASE}/api/products/{pid}", json={"price": pre[pid], "price_old": None, "promo_pct": None}, timeout=20)

    def test_bulk_promo_bad_pct(self, client, product_ids):
        r = client.post(f"{BASE}/api/products/bulk-promo", json={"ids": product_ids[:1], "discount_pct": 0}, timeout=20)
        assert r.status_code == 400


# ---------- product history ----------
class TestProductHistory:
    def test_history_shape(self, client, product_ids):
        pid = product_ids[0]
        r = client.get(f"{BASE}/api/products/{pid}/history", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["sales","sales_total","sales_revenue","waitlist"]:
            assert k in d, f"missing {k}"
        assert isinstance(d["sales"], list)
        assert isinstance(d["waitlist"], list)
        assert isinstance(d["sales_total"], int)
        assert isinstance(d["sales_revenue"], int)


# ---------- Brand update ----------
class TestBrandPatch:
    def test_brand_patch_renames_products(self, client):
        # pick a brand present in products
        prods = client.get(f"{BASE}/api/products", timeout=20).json()
        # find existing brands list
        rb = client.get(f"{BASE}/api/brands", timeout=20)
        assert rb.status_code == 200, rb.text
        brands = rb.json()
        if not brands:
            pytest.skip("no brands seeded")
        # create a test brand to be safe
        cr = client.post(f"{BASE}/api/brands", json={"name":"TEST_BrandA","note":"orig"}, timeout=20)
        assert cr.status_code in (200,201), cr.text
        new_brand = cr.json()
        bid = new_brand.get("id")
        assert bid, f"no id in {new_brand}"
        # attach brand to one product
        pid = prods[0]["id"]
        client.patch(f"{BASE}/api/products/{pid}", json={"brand": "TEST_BrandA"}, timeout=20)
        # rename brand
        rp = client.patch(f"{BASE}/api/brands/{bid}", json={"name":"TEST_BrandB","note":"renamed"}, timeout=20)
        assert rp.status_code == 200, rp.text
        assert rp.json().get("ok") is True
        # verify product brand renamed
        pr = client.get(f"{BASE}/api/products", timeout=20).json()
        p = next((x for x in pr if x["id"] == pid), None)
        assert p and p.get("brand") == "TEST_BrandB", f"brand not renamed: {p.get('brand')}"
        # cleanup
        try:
            client.delete(f"{BASE}/api/brands/{bid}", timeout=20)
        except Exception: pass


# ---------- CRUD regression with new fields ----------
class TestProductsCrudNewFields:
    def test_create_with_new_fields_returned(self, client):
        payload = {
            "name": "TEST_PhaseB_Product", "category": "robes", "brand": "Dina",
            "price": 25000, "cost": 10000, "description": "test",
            "price_old": 30000, "status": "actif",
            "collections": ["ete"], "tags": ["new"], "material": "coton",
            "occasion": "soiree", "heel_type": "plat", "care": "lavage main",
            "supplier": "sup1", "alert_threshold": 3, "featured": True, "is_new": True,
            "seo_title": "seo", "seo_description": "seo desc",
            "sizes": ["S","M"], "colors": ["rouge"], "stock_by_size": {"S":2,"M":3}, "stock": 5,
        }
        r = client.post(f"{BASE}/api/products", json=payload, timeout=20)
        assert r.status_code in (200,201), r.text
        created = r.json()
        pid = created["id"]
        # GET and verify new fields persisted via PATCH if not accepted by model
        got = client.get(f"{BASE}/api/products", timeout=20).json()
        p = next((x for x in got if x["id"] == pid), None)
        assert p is not None
        missing = []
        for f in ["price_old","status","collections","tags","material","occasion","heel_type","care","supplier","alert_threshold","featured","is_new","seo_title","seo_description"]:
            if f not in p or p.get(f) in (None, "", [], {}):
                missing.append(f)
        # cleanup
        client.delete(f"{BASE}/api/products/{pid}", timeout=20)
        assert not missing, f"POST /products did not persist new fields: {missing}. ProductIn schema likely needs update."


# ---------- Phase A regression ----------
class TestPhaseARegression:
    def test_search_suggestions(self, client):
        r = client.get(f"{BASE}/api/public/search-suggestions?q=r", timeout=20)
        assert r.status_code == 200

    def test_best_sellers(self, client):
        r = client.get(f"{BASE}/api/public/best-sellers", timeout=20)
        assert r.status_code == 200

    def test_pos_shortcuts(self, client):
        r = client.get(f"{BASE}/api/pos/shortcuts", timeout=20)
        assert r.status_code == 200

    def test_waitlist_list(self, client):
        r = client.get(f"{BASE}/api/waitlist", timeout=20)
        assert r.status_code == 200
