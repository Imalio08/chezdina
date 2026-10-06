"""Wave 3 backend tests: promotions (scope/bogo fields) and stock aged."""
import os
import pytest
import requests

def _load_frontend_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        return None
    return None

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _load_frontend_env()).rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "aouattaraesca@gmail.com"
ADMIN_PWD = "Admin123!"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    tok = r.json().get("token")
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


# ---------- Promotions: PromoIn extended ----------
class TestPromotionsScope:
    def test_create_bogo_with_scope_products(self, admin_session):
        payload = {
            "code": "TESTBOGO_W3",
            "type": "bogo",
            "scope": "products",
            "products": ["pid1", "pid2"],
            "buy_qty": 2,
            "get_qty": 1,
            "get_discount_pct": 100,
            "active": True,
        }
        r = admin_session.post(f"{API}/promotions", json=payload, timeout=20)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        doc = r.json()
        assert doc["code"] == "TESTBOGO_W3"
        assert doc["type"] == "bogo"
        assert doc["scope"] == "products"
        assert doc["products"] == ["pid1", "pid2"]
        assert doc["buy_qty"] == 2
        assert doc["get_qty"] == 1
        assert doc["get_discount_pct"] == 100
        assert "id" in doc

    def test_get_promotions_retains_fields(self, admin_session):
        r = admin_session.get(f"{API}/promotions", timeout=20)
        assert r.status_code == 200
        rows = r.json()
        found = [p for p in rows if p.get("code") == "TESTBOGO_W3"]
        assert len(found) >= 1
        p = found[0]
        for k in ("scope", "products", "buy_qty", "get_qty", "get_discount_pct"):
            assert k in p, f"missing field {k} in promo"
        assert p["scope"] == "products"
        assert p["buy_qty"] == 2
        assert p["get_qty"] == 1
        assert p["get_discount_pct"] == 100
        assert "pid1" in p["products"]

    def test_cleanup_promo(self, admin_session):
        r = admin_session.get(f"{API}/promotions", timeout=20)
        for p in r.json():
            if p.get("code") == "TESTBOGO_W3":
                admin_session.delete(f"{API}/promotions/{p['id']}", timeout=20)


# ---------- Stock: aged KPI + /stock/aged endpoint ----------
class TestStockAged:
    def test_stock_kpis_has_aged(self, admin_session):
        r = admin_session.get(f"{API}/stock/kpis", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "aged" in data, f"missing 'aged' in {list(data.keys())}"
        assert isinstance(data["aged"], int)

    def test_stock_aged_endpoint_default(self, admin_session):
        r = admin_session.get(f"{API}/stock/aged", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data["days_threshold"] == 60
        assert "count" in data
        assert "items" in data
        assert isinstance(data["items"], list)

    def test_stock_aged_custom_days_and_sort(self, admin_session):
        r = admin_session.get(f"{API}/stock/aged?days=30", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data["days_threshold"] == 30
        items = data["items"]
        # Items sorted by age_days descending
        for i in range(1, len(items)):
            assert items[i - 1]["age_days"] >= items[i]["age_days"], "items not sorted desc by age_days"
        # Each item has required fields
        if items:
            it = items[0]
            for k in ("id", "name", "age_days", "stock", "value"):
                assert k in it, f"missing {k}"
