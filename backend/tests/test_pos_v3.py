"""POS v3 backend tests - shortcuts, shared-cart, waitlist, AI parse-order, PDF receipt + fuzzy search regression."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://dina-boutique.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "aouattaraesca@gmail.com"
ADMIN_PASSWORD = "Admin123!"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("token")
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def any_product(session):
    r = session.get(f"{API}/products", timeout=15)
    assert r.status_code == 200
    prods = r.json()
    assert len(prods) > 0, "no products in db"
    return prods[0]


# ---------- Public fuzzy search ----------
class TestFuzzySearch:
    @pytest.mark.parametrize("q", ["chausures", "rbe", "escarpain", "robbe"])
    def test_search_suggestions_fuzzy(self, q):
        r = requests.get(f"{API}/public/search-suggestions", params={"q": q}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "products" in data
        print(f"q={q} -> {len(data['products'])} products")
        # Must return at least 1 for typos (previously returned 0)
        assert len(data["products"]) >= 1, f"fuzzy search failed for q={q}"

    def test_best_sellers_returns_products(self):
        r = requests.get(f"{API}/public/best-sellers", params={"limit": 5}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        print(f"best-sellers count={len(data)}")
        assert len(data) >= 1, "best-sellers must return >=1 (fix for active:True filter)"
        assert "sold_count" in data[0]


# ---------- POS shortcuts ----------
class TestPosShortcuts:
    def test_pos_shortcuts(self, session):
        r = session.get(f"{API}/pos/shortcuts", params={"limit": 8}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        print(f"pos shortcuts len={len(data)}")
        if data:
            assert "sold_count" in data[0]
            assert "id" in data[0]

    def test_pos_shortcuts_requires_auth(self):
        r = requests.get(f"{API}/pos/shortcuts", timeout=15)
        assert r.status_code in (401, 403)


# ---------- Shared cart flow ----------
class TestSharedCart:
    def test_shared_cart_full_flow(self, session, any_product):
        p = any_product
        item = {"product_id": p["id"], "name": p.get("name"), "qty": 1,
                "price": int(p.get("price", 1000)), "size": (p.get("sizes") or [None])[0]}
        body = {"items": [item], "customer": {"name": "TEST_Shared", "phone": "0700000001"},
                "mode": "delivery", "zone": "Cocody", "delivery_fee": 1500, "discount": 0}
        r = session.post(f"{API}/pos/shared-cart", json=body, timeout=15)
        assert r.status_code == 200, r.text
        sc = r.json()
        assert "id" in sc and "link" in sc and "expires_at" in sc
        sid = sc["id"]

        # Public GET
        r2 = requests.get(f"{API}/public/shared-cart/{sid}", timeout=15)
        assert r2.status_code == 200, r2.text
        cart = r2.json()
        assert cart.get("items") and cart["items"][0]["product_id"] == p["id"]

        # Confirm
        confirm_body = {"items": [item], "payment_method": "cod"}
        r3 = requests.post(f"{API}/public/shared-cart/{sid}/confirm", json=confirm_body, timeout=15)
        assert r3.status_code == 200, r3.text
        conf = r3.json()
        assert conf.get("ok") is True
        assert conf.get("code")
        order_id = conf["order_id"]

        # Verify order persisted with channel=shared_cart (no /orders/{id} endpoint - use list)
        r4 = session.get(f"{API}/orders", timeout=15)
        assert r4.status_code == 200
        orders = r4.json()
        order = next((o for o in orders if o.get("id") == order_id), None)
        assert order is not None, "created order not found in list"
        assert order.get("channel") == "shared_cart"
        assert order.get("status") == "confirmee"

        # Already confirmed -> error
        r5 = requests.get(f"{API}/public/shared-cart/{sid}", timeout=15)
        assert r5.status_code == 200
        assert r5.json().get("error") == "already_confirmed"


# ---------- Waitlist ----------
class TestWaitlist:
    def test_waitlist_crud(self, session, any_product):
        p = any_product
        body = {"product_id": p["id"], "size": "M", "phone": "0788888888", "name": "TEST_Waitlist"}
        r = session.post(f"{API}/waitlist", json=body, timeout=15)
        assert r.status_code == 200, r.text
        wid = r.json()["id"]

        r2 = session.get(f"{API}/waitlist", timeout=15)
        assert r2.status_code == 200
        rows = r2.json()
        found = next((x for x in rows if x.get("id") == wid), None)
        assert found is not None
        assert "product_name" in found  # enriched

        r3 = session.delete(f"{API}/waitlist/{wid}", timeout=15)
        assert r3.status_code == 200
        assert r3.json().get("ok") is True

        # After delete (notified), should not appear in default list
        r4 = session.get(f"{API}/waitlist", timeout=15)
        rows2 = r4.json()
        assert not any(x.get("id") == wid for x in rows2)


# ---------- AI parse-order ----------
class TestAIParseOrder:
    def test_parse_order_claude(self, session):
        text = "Je veux une robe baobab en M et un sac camel livree a Angre"
        r = session.post(f"{API}/ai/parse-order", json={"text": text}, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        print("AI parse-order:", data)
        assert "items" in data
        if data.get("error") == "AI indisponible":
            pytest.fail(f"AI returned 'AI indisponible' - EMERGENT_LLM_KEY issue: {data}")
        assert len(data.get("items", [])) >= 1, "AI must detect at least 1 item"


# ---------- PDF receipt ----------
class TestPdfReceipt:
    def test_pdf_receipt(self, session):
        r = session.get(f"{API}/orders", timeout=15)
        orders = r.json()
        if not orders:
            pytest.skip("no orders")
        oid = orders[0]["id"]
        r2 = session.get(f"{API}/pos/pdf-receipt/{oid}", timeout=15)
        assert r2.status_code == 200, r2.text
        data = r2.json()
        assert "order" in data and "business" in data
        assert data["order"]["id"] == oid


# ---------- Regression ----------
class TestRegression:
    def test_products_list(self, session):
        r = session.get(f"{API}/products", timeout=15)
        assert r.status_code == 200 and isinstance(r.json(), list)

    def test_customers_list(self, session):
        r = session.get(f"{API}/customers", timeout=15)
        assert r.status_code == 200

    def test_orders_list(self, session):
        r = session.get(f"{API}/orders", timeout=15)
        assert r.status_code == 200

    def test_pos_holds(self, session):
        r = session.get(f"{API}/pos/holds", timeout=15)
        assert r.status_code == 200

    def test_cash_movements(self, session):
        r = session.get(f"{API}/cash-movements", timeout=15)
        assert r.status_code == 200

    def test_pin_authorize(self, session):
        r = session.post(f"{API}/pos/pin-authorize", json={"pin": "1234", "action": "discount"}, timeout=15)
        assert r.status_code in (200, 401, 403), r.text
        print("pin-authorize:", r.status_code, r.text[:200])
