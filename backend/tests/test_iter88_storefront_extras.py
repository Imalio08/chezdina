# Iteration 88: storefront extras — promo fields, customer invoice HTML, share invitation OG, favorites toggle, vouchers
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
AWA = {"phone": "+225 07 85 55 58 88", "code": "386436"}
PACK6 = {"phone": "+225 07 00 00 11 22", "code": "373492"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/public/customer-login-code", json=creds, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    return r.json()


@pytest.fixture(scope="module")
def awa():
    d = _login(AWA)
    return {"token": d["token"], "customer": d["customer"], "h": {"Authorization": f"Bearer {d['token']}"}}


@pytest.fixture(scope="module")
def pack6():
    d = _login(PACK6)
    return {"token": d["token"], "h": {"Authorization": f"Bearer {d['token']}"}}


@pytest.fixture(scope="module")
def products():
    r = requests.get(f"{BASE_URL}/api/public/products", timeout=30)
    assert r.status_code == 200
    d = r.json()
    return d if isinstance(d, list) else d.get("items") or d.get("products")


# Promo fields
class TestPromo:
    def test_products_have_promo_fields(self, products):
        promos = [p for p in products if (p.get("promo_pct") or 0) > 0]
        print("promo count", len(promos), "total", len(products))
        assert len(promos) >= 20
        for p in promos:
            assert p["compare_at"] > p["price"]
            assert p["promo_pct"] == round((1 - p["price"] / p["compare_at"]) * 100)
        non = [p for p in products if not p.get("promo_pct")]
        for p in non:
            assert p.get("compare_at") in (None, 0) or p["compare_at"] <= p["price"]

    def test_promo_count_is_26(self, products):
        promos = [p for p in products if (p.get("promo_pct") or 0) > 0]
        assert len(promos) == 26

    def test_public_product_promo(self, products):
        p = next(p for p in products if (p.get("promo_pct") or 0) > 0)
        r = requests.get(f"{BASE_URL}/api/public/product/{p['id']}", timeout=20)
        assert r.status_code == 200
        d = r.json()
        d = d.get("product", d)
        assert d["promo_pct"] == p["promo_pct"]
        assert d["compare_at"] == p["compare_at"]


# Customer invoice HTML
class TestInvoice:
    def _code(self, awa):
        r = requests.get(f"{BASE_URL}/api/public/account/orders-split", headers=awa["h"], timeout=20)
        d = r.json()
        allo = d["in_progress"] + d["delivered"] + d["cancelled"]
        return allo[0]["code"]

    def test_invoice_html(self, awa):
        code = self._code(awa)
        r = requests.get(f"{BASE_URL}/api/public/account/order/{code}/invoice", headers=awa["h"], timeout=20)
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "")
        assert "FACTURE" in r.text and code in r.text
        assert '"invoice": null' not in r.text and '"invoice":null' not in r.text
        # idempotent: same invoice number on second call
        n1 = re.search(r"FACTURE ([^<]+)<", r.text).group(1)
        r2 = requests.get(f"{BASE_URL}/api/public/account/order/{code}/invoice", headers=awa["h"], timeout=20)
        n2 = re.search(r"FACTURE ([^<]+)<", r2.text).group(1)
        assert n1 == n2

    def test_invoice_all_orders(self, awa):
        d = requests.get(f"{BASE_URL}/api/public/account/orders-split", headers=awa["h"], timeout=20).json()
        for o in d["in_progress"] + d["delivered"]:
            r = requests.get(f"{BASE_URL}/api/public/account/order/{o['code']}/invoice", headers=awa["h"], timeout=20)
            assert r.status_code == 200, o["code"]

    def test_invoice_other_customer_404(self, awa, pack6):
        code = self._code(awa)
        r = requests.get(f"{BASE_URL}/api/public/account/order/{code}/invoice", headers=pack6["h"], timeout=20)
        assert r.status_code == 404

    def test_invoice_no_auth_401(self, awa):
        code = self._code(awa)
        r = requests.get(f"{BASE_URL}/api/public/account/order/{code}/invoice", timeout=20)
        assert r.status_code == 401

    def test_invoice_unknown_404(self, awa):
        r = requests.get(f"{BASE_URL}/api/public/account/order/DN-NOPE-0000/invoice", headers=awa["h"], timeout=20)
        assert r.status_code == 404


# Share invitation OG page
class TestShare:
    def test_share_og(self, awa):
        code = awa["customer"]["referral_code"]
        r = requests.get(f"{BASE_URL}/api/public/share/invitation/{code}", timeout=20, allow_redirects=False)
        assert r.status_code == 200
        t = r.text
        title = re.search(r'og:title" content="([^"]+)"', t).group(1)
        desc = re.search(r'og:description" content="([^"]+)"', t).group(1)
        img = re.search(r'og:image" content="([^"]+)"', t).group(1)
        print(title, "|", desc, "|", img)
        assert title.startswith("Awa")
        assert "FCFA" in desc and code.upper() in desc
        assert img.startswith("https://")
        assert f"/invitation/{code}" in t
        ir = requests.get(img, timeout=20)
        assert ir.status_code == 200

    def test_share_unknown_code(self):
        r = requests.get(f"{BASE_URL}/api/public/share/invitation/XXNOPE", timeout=20)
        assert r.status_code == 200
        assert "og:title" in r.text


# Favorites toggle with explicit state + vouchers
class TestFavVouchers:
    def test_fav_add_remove(self, pack6, products):
        pid = products[-1]["id"]
        before = requests.get(f"{BASE_URL}/api/public/account/favorites", headers=pack6["h"], timeout=20).json()
        was = any(p["id"] == pid for p in before)
        r = requests.post(f"{BASE_URL}/api/public/account/favorites/toggle", headers=pack6["h"], json={"product_id": pid, "state": "add"}, timeout=20)
        assert r.status_code == 200 and r.json()["state"] == "added"
        r = requests.post(f"{BASE_URL}/api/public/account/favorites/toggle", headers=pack6["h"], json={"product_id": pid, "state": "add"}, timeout=20)
        assert r.json()["state"] == "added"  # idempotent
        favs = requests.get(f"{BASE_URL}/api/public/account/favorites", headers=pack6["h"], timeout=20).json()
        assert any(p["id"] == pid for p in favs)
        r = requests.post(f"{BASE_URL}/api/public/account/favorites/toggle", headers=pack6["h"], json={"product_id": pid, "state": "remove"}, timeout=20)
        assert r.json()["state"] == "removed"
        favs = requests.get(f"{BASE_URL}/api/public/account/favorites", headers=pack6["h"], timeout=20).json()
        assert not any(p["id"] == pid for p in favs)
        if was:
            requests.post(f"{BASE_URL}/api/public/account/favorites/toggle", headers=pack6["h"], json={"product_id": pid, "state": "add"}, timeout=20)

    def test_fav_missing_pid(self, pack6):
        r = requests.post(f"{BASE_URL}/api/public/account/favorites/toggle", headers=pack6["h"], json={}, timeout=20)
        assert r.status_code == 400

    def test_vouchers_promo(self, awa):
        r = requests.get(f"{BASE_URL}/api/public/account/vouchers", headers=awa["h"], timeout=20)
        assert r.status_code == 200
        d = r.json()
        promos = [v for v in d if v.get("kind") == "promo"]
        print("promos", [(v["code"], v.get("type"), v.get("value")) for v in promos])
        assert len(promos) >= 1
        for v in promos:
            assert v["code"]
            assert "_id" not in v
