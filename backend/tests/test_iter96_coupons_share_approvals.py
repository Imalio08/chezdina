# Iteration 96: share invitation OG, coupons (public/POS), order coupon/wallet, approvals decide with mandatory reject reason, AI analyze
import io
import os
import pytest
import requests
from pymongo import MongoClient


def _load_env():
    for f in ("/app/frontend/.env", "/app/backend/.env"):
        for ln in open(f):
            if "=" in ln and not ln.startswith("#"):
                k, v = ln.strip().split("=", 1)
                os.environ.setdefault(k, v.strip('"'))


_load_env()
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
FB_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
WA_UA = "WhatsApp/2.23.20.0"
BR_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36"


def _login(email, pw):
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": pw}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"login failed {email}")
    return {"Authorization": f"Bearer {r.json().get('token') or r.json().get('access_token')}"}


@pytest.fixture(scope="module")
def admin():
    return _login("aouattaraesca@gmail.com", "Admin123!")


@pytest.fixture(scope="module")
def manager():
    return _login("manager.cocody@dinastore.ci", "Manager123!")


@pytest.fixture(scope="module", autouse=True)
def restore_promos():
    snap = {p["id"]: p.get("uses", 0) for p in mdb.promotions.find({}, {"id": 1, "uses": 1})}
    yield
    for pid, u in snap.items():
        mdb.promotions.update_one({"id": pid}, {"$set": {"uses": u}})
    mdb.orders.delete_many({"customer.name": {"$regex": "^TEST_"}})


# ---- Share invitation OG ----
class TestShare:
    @pytest.mark.parametrize("ua", [FB_UA, WA_UA])
    def test_bot_og(self, ua):
        r = requests.get(f"{BASE}/api/public/share/invitation/DINA-1000", headers={"User-Agent": ua}, timeout=30, allow_redirects=False)
        assert r.status_code == 200
        h = r.text
        assert f'og:url" content="{BASE}/api/public/share/invitation/DINA-1000"' in h
        assert f'og:image" content="{BASE}/api/public/share/invitation/DINA-1000/image.jpg"' in h
        assert 'og:image:width" content="1200"' in h and 'og:image:height" content="630"' in h
        assert "http-equiv=\"refresh\"" not in h and "location.replace" not in h

    def test_browser_redirects(self):
        r = requests.get(f"{BASE}/api/public/share/invitation/DINA-1000", headers={"User-Agent": BR_UA}, timeout=30)
        assert r.status_code == 200
        assert f'url={BASE}/invitation/DINA-1000' in r.text
        assert "location.replace" in r.text

    def test_image_jpeg(self):
        from PIL import Image
        r = requests.get(f"{BASE}/api/public/share/invitation/DINA-1000/image.jpg", timeout=60)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("image/jpeg")
        im = Image.open(io.BytesIO(r.content))
        assert im.format == "JPEG" and im.size == (1200, 630)


# ---- Coupons ----
class TestCoupons:
    def _check(self, code, sub, fee=0):
        return requests.post(f"{BASE}/api/public/coupons/check", json={"code": code, "subtotal": sub, "delivery_fee": fee}, timeout=30)

    def test_bienvenue10(self):
        r = self._check("bienvenue10", 20000, 2000)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["code"] == "BIENVENUE10" and d["discount"] == 2000 and d["source"] == "promo"

    def test_flash20_min_order(self):
        r = self._check("FLASH20", 10000)
        # Spec: min 15000 -> 400 under it
        assert r.status_code == 400, f"FLASH20 accepted at 10000 (promo doc has min_order? {mdb.promotions.find_one({'code':'FLASH20'},{'_id':0,'min_order':1})})"
        r2 = self._check("FLASH20", 20000)
        assert r2.status_code == 200 and r2.json()["discount"] == 4000

    def test_livraison_free_delivery(self):
        r = self._check("LIVRAISON", 30000, 2500)
        assert r.status_code == 200 and r.json()["discount"] == 2500
        r2 = self._check("LIVRAISON", 10000, 2500)
        assert r2.status_code == 400, f"LIVRAISON accepted under 25000: {r2.text}"

    def test_unknown_code(self):
        r = self._check("NOPE_TEST_XYZ", 20000)
        assert r.status_code == 400
        assert r.json()["detail"] == "Code inconnu ou inactif"

    def test_empty_code(self):
        r = self._check("", 20000)
        assert r.status_code == 400 and r.json()["detail"] == "Saisissez un code"

    def test_regex_injection(self):
        r = self._check(".*", 20000)
        assert r.status_code == 400, f"Regex code '.*' resolved to a promo: {r.text}"

    def test_available_public(self):
        r = requests.post(f"{BASE}/api/public/coupons/available", json={"subtotal": 30000, "delivery_fee": 2000}, timeout=30)
        assert r.status_code == 200
        codes = {x["code"]: x for x in r.json()}
        assert "BIENVENUE10" in codes and codes["BIENVENUE10"]["usable"] is True

    def test_pos_requires_auth(self):
        r = requests.post(f"{BASE}/api/pos/coupons/check", json={"code": "BIENVENUE10", "subtotal": 10000}, timeout=30)
        assert r.status_code in (401, 403)

    def test_pos_check_available(self, admin):
        r = requests.post(f"{BASE}/api/pos/coupons/check", json={"code": "BIENVENUE10", "subtotal": 10000}, headers=admin, timeout=30)
        assert r.status_code == 200 and r.json()["discount"] == 1000
        r2 = requests.post(f"{BASE}/api/pos/coupons/available", json={"subtotal": 10000}, headers=admin, timeout=30)
        assert r2.status_code == 200 and isinstance(r2.json(), list) and len(r2.json()) > 0


# ---- Orders with coupons ----
ITEM = {"product_id": "TEST_noprod", "name": "TEST_item", "qty": 1, "price": 20000}


class TestOrderCoupons:
    def test_public_order_ignores_client_discount(self):
        uses0 = mdb.promotions.find_one({"code": "BIENVENUE10"})["uses"]
        r = requests.post(f"{BASE}/api/public/orders", json={"items": [ITEM], "customer": {"name": "TEST_Coupon", "phone": "+225 00 00 00 99 01"},
                          "delivery_fee": 2000, "discount": 15000, "coupon_code": "BIENVENUE10", "mode": "delivery", "payment_method": "wave", "channel": "boutique"}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["total"] == 20000 + 2000 - 2000
        o = mdb.orders.find_one({"code": r.json()["code"]})
        assert o["discount"] == 2000 and o["coupon"]["code"] == "BIENVENUE10"
        assert mdb.promotions.find_one({"code": "BIENVENUE10"})["uses"] == uses0 + 1

    def test_public_order_no_coupon_zero_discount(self):
        r = requests.post(f"{BASE}/api/public/orders", json={"items": [ITEM], "customer": {"name": "TEST_NoCoupon", "phone": "+225 00 00 00 99 02"},
                          "delivery_fee": 0, "discount": 5000, "mode": "delivery", "payment_method": "wave"}, timeout=30)
        assert r.status_code == 200 and r.json()["total"] == 20000

    def test_public_order_bad_coupon(self):
        r = requests.post(f"{BASE}/api/public/orders", json={"items": [ITEM], "customer": {"name": "TEST_Bad"}, "coupon_code": "ZZZ_TEST", "mode": "delivery"}, timeout=30)
        assert r.status_code == 400

    def test_pos_order_coupon(self, admin):
        r = requests.post(f"{BASE}/api/orders", json={"items": [ITEM], "customer": {"name": "TEST_POS"}, "coupon_code": "BIENVENUE10", "mode": "store", "payment_method": "cash"}, headers=admin, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["discount"] == 2000 and d["total"] == 18000 and d["coupon"]["code"] == "BIENVENUE10"


# ---- Approvals: mandatory reject reason + notification ----
class TestApprovals:
    def test_stock_reject_requires_reason_and_notifies(self, admin, manager):
        r = requests.post(f"{BASE}/api/stock/adjustment-requests", json={"product_id": "TEST_noprod", "product_name": "TEST_prod", "qty_delta": -2, "reason": "TEST_casse"}, headers=manager, timeout=30)
        assert r.status_code == 200 and r.json()["status"] == "pending"
        aid = r.json()["id"]
        try:
            lst = requests.get(f"{BASE}/api/stock/adjustment-requests", headers=admin, timeout=30).json()
            row = next(x for x in lst if x["id"] == aid)
            assert "stock_before" in row and "stock_after" in row and row["stock_after"] == row["stock_before"] - 2
            e = requests.post(f"{BASE}/api/stock/adjustment-requests/{aid}/decide", json={"decision": "reject", "note": "  "}, headers=admin, timeout=30)
            assert e.status_code == 400 and e.json()["detail"] == "Indiquez le motif du refus"
            ok = requests.post(f"{BASE}/api/stock/adjustment-requests/{aid}/decide", json={"decision": "reject", "note": "TEST_motif"}, headers=admin, timeout=30)
            assert ok.status_code == 200
            doc = mdb.stock_adjustment_requests.find_one({"id": aid})
            assert doc["status"] == "rejected" and doc["decision_note"] == "TEST_motif"
            n = mdb.user_notifications.find_one({"kind": "staff", "target_id": r.json()["requested_by_id"], "msg": {"$regex": "TEST_motif"}})
            assert n is not None
        finally:
            mdb.stock_adjustment_requests.delete_one({"id": aid})
            mdb.user_notifications.delete_many({"msg": {"$regex": "TEST_motif"}})

    def test_approval_request_reject_reason(self, admin, manager):
        r = requests.post(f"{BASE}/api/approval-requests", json={"kind": "discount", "reason": "TEST_appr", "payload": {"amount": 1000}}, headers=manager, timeout=30)
        aid = r.json()["id"]
        try:
            e = requests.post(f"{BASE}/api/approval-requests/{aid}/decide", json={"decision": "rejected"}, headers=admin, timeout=30)
            assert e.status_code == 400 and e.json()["detail"] == "Indiquez le motif du refus"
            ok = requests.post(f"{BASE}/api/approval-requests/{aid}/decide", json={"decision": "rejected", "note": "TEST_no"}, headers=admin, timeout=30)
            assert ok.status_code == 200 and ok.json()["status"] == "rejected"
        finally:
            mdb.approval_requests.delete_one({"id": aid})
            mdb.notifications.delete_many({"msg": {"$regex": "TEST_appr"}})
            mdb.user_notifications.delete_many({"msg": {"$regex": "TEST_no"}})

    def test_expense_request_reject_reason(self, admin, manager):
        r = requests.post(f"{BASE}/api/expense-requests", json={"label": "TEST_dep", "amount": 500}, headers=manager, timeout=30)
        eid = r.json()["id"]
        try:
            e = requests.post(f"{BASE}/api/expense-requests/{eid}/decide", json={"decision": "rejected", "note": ""}, headers=admin, timeout=30)
            assert e.status_code == 400 and e.json()["detail"] == "Indiquez le motif du refus"
            ok = requests.post(f"{BASE}/api/expense-requests/{eid}/decide", json={"decision": "rejected", "note": "TEST_trop"}, headers=admin, timeout=30)
            assert ok.status_code == 200
            assert mdb.expense_requests.find_one({"id": eid})["status"] == "rejected"
        finally:
            mdb.expense_requests.delete_one({"id": eid})
            mdb.notifications.delete_many({"msg": {"$regex": "TEST_dep"}})
            mdb.user_notifications.delete_many({"msg": {"$regex": "TEST_trop"}})


# ---- AI analyze (text-only Gemini call, cheap) ----
def test_ai_analyze(admin):
    p = mdb.products.find_one({"image": {"$regex": "^(http|/)"}}, {"image": 1})
    if not p:
        pytest.skip("no product with http image")
    r = requests.post(f"{BASE}/api/products/ai/analyze", json={"image": p["image"]}, headers=admin, timeout=90)
    assert r.status_code == 200, r.text
    ideas = r.json()["ideas"]
    assert len(ideas) >= 4 and all(i["title"] and i["prompt"] for i in ideas)


def test_ai_analyze_forbidden_for_sales():
    h = _login("agent1@dinastore.ci", "Agent123!")
    r = requests.post(f"{BASE}/api/products/ai/analyze", json={"image": "x"}, headers=h, timeout=30)
    assert r.status_code == 403
