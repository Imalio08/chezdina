"""Iter71: retest of iter70 fixes — CORS, Bearer-over-cookie, checkout idempotency/concurrency, unique ref code, wallet RBAC, audit, full cycle."""
import os, random, uuid, concurrent.futures as cf, pytest, requests
from pymongo import MongoClient


def _env(path, key):
    with open(path) as f:
        for ln in f:
            if ln.startswith(key + "="):
                return ln.split("=", 1)[1].strip().strip('"')
    return os.environ.get(key)


BASE = _env("/app/frontend/.env", "REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE}/api"
PID = "2c2005f5-cabe-46e5-9a4b-657f093f24a6"
PIN = "482915"
MDB = MongoClient(_env("/app/backend/.env", "MONGO_URL"))[_env("/app/backend/.env", "DB_NAME")]


def _phone():
    return f"+225 07 8{random.randint(0,9)} {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)}"


def _signup(name, code=None, sess=None):
    body = {"name": name, "phone": _phone(), "pin": PIN}
    if code:
        body["referral_code"] = code
    r = (sess or requests).post(f"{API}/public/customer-signup", json=body, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    return d["customer"], {"Authorization": f"Bearer {d['token']}"}


def _body(price, wallet_use=0, key=None):
    return {"items": [{"product_id": PID, "name": "TEST_item", "qty": 1, "price": price}], "channel": "boutique",
            "payment_method": "mobile_money", "delivery_fee": 1500, "mode": "delivery", "wallet_use": wallet_use,
            "checkout_key": key or str(uuid.uuid4()), "customer": {"name": "TEST_x"}}


def _wallet(h):
    r = requests.get(f"{API}/public/account/wallet", headers=h, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


def _login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=20)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def admin():
    return _login("aouattaraesca@gmail.com", "Admin123!")


@pytest.fixture(scope="module")
def rider():
    return _login("rider1@dinastore.ci", "Rider123!")


@pytest.fixture(scope="module")
def sales():
    return _login("agent1@dinastore.ci", "Agent123!")


def _status(admin, oid, st):
    r = requests.patch(f"{API}/orders/{oid}/status", json={"status": st}, headers=admin, timeout=20)
    assert r.status_code == 200, r.text


# --- CORS
class TestCors:
    def test_evil_origin_no_credentials(self):
        r = requests.get(f"{API}/public/settings", headers={"Origin": "https://evil.com"}, timeout=20)
        acac = r.headers.get("access-control-allow-credentials")
        print("ACAO", r.headers.get("access-control-allow-origin"), "ACAC", acac)
        assert acac is None or acac.lower() != "true"

    def test_preflight_evil_no_credentials(self):
        r = requests.options(f"{API}/public/orders", headers={"Origin": "https://evil.com", "Access-Control-Request-Method": "POST",
                                                              "Access-Control-Request-Headers": "content-type,authorization"}, timeout=20)
        acac = r.headers.get("access-control-allow-credentials")
        assert acac is None or acac.lower() != "true"


# --- get_customer prefers Bearer over cookie
class TestBearerPrecedence:
    def test_bearer_beats_stale_cookie(self):
        sa = requests.Session()
        a, _ = _signup("TEST_CookieA71", sess=sa)  # sa now holds A's cookie
        b, hb = _signup("TEST_CookieB71")
        r = sa.get(f"{API}/public/account/wallet", headers=hb, timeout=20)
        assert r.status_code == 200
        me = sa.get(f"{API}/public/account/me", headers=hb, timeout=20)
        if me.status_code == 200:
            assert me.json().get("id", me.json().get("customer", {}).get("id")) == b["id"]
        # cookie-only still works for A
        r2 = sa.get(f"{API}/public/account/wallet", timeout=20)
        assert r2.status_code == 200

    def test_invalid_bearer_falls_back_to_cookie(self):
        sa = requests.Session()
        _signup("TEST_CookieC71", sess=sa)
        r = sa.get(f"{API}/public/account/wallet", headers={"Authorization": "Bearer garbage"}, timeout=20)
        assert r.status_code == 200


# --- Unique referral code
class TestRefCode:
    def test_codes_unique_and_index(self):
        codes = [_signup(f"TEST_Uniq71_{i}")[0]["referral_code"] for i in range(5)]
        assert len(set(codes)) == 5
        dup = list(MDB.customers.aggregate([{"$match": {"referral_code": {"$type": "string"}}}, {"$group": {"_id": "$referral_code", "n": {"$sum": 1}}}, {"$match": {"n": {"$gt": 1}}}]))
        print("existing duplicate referral codes in DB:", dup[:5])


# --- Checkout idempotency / concurrency
class TestCheckout:
    def test_index_exists(self):
        idx = {i["name"]: i for i in MDB.orders.list_indexes()}
        ck = [i for i in idx.values() if "checkout_key" in i["key"]]
        assert ck and ck[0].get("unique") is True

    def test_duplicate_key_no_second_debit(self, admin):
        c, h = _signup("TEST_Race71")
        requests.post(f"{API}/customers/{c['id']}/wallet/adjust", json={"amount": 3000, "reason": "TEST_promo", "source": "promotion"}, headers=admin)
        key = str(uuid.uuid4())
        d1 = requests.post(f"{API}/public/orders", json=_body(20000, 1000, key), headers=h).json()
        d2 = requests.post(f"{API}/public/orders", json=_body(20000, 1000, key), headers=h).json()
        assert d1["id"] == d2["id"] and d1["wallet_used"] == 1000
        assert _wallet(h)["balance"] == 2000

    def test_concurrent_same_key(self, admin):
        c, h = _signup("TEST_Race71b")
        requests.post(f"{API}/customers/{c['id']}/wallet/adjust", json={"amount": 3000, "reason": "TEST_promo", "source": "promotion"}, headers=admin)
        key = str(uuid.uuid4())
        with cf.ThreadPoolExecutor(8) as ex:
            res = list(ex.map(lambda _: requests.post(f"{API}/public/orders", json=_body(20000, 1000, key), headers=h, timeout=30), range(8)))
        codes = [r.status_code for r in res]
        print("concurrent statuses", codes)
        assert all(s == 200 for s in codes), [r.text for r in res if r.status_code != 200]
        ids = {r.json()["id"] for r in res}
        assert len(ids) == 1
        assert MDB.orders.count_documents({"checkout_key": key}) == 1
        assert _wallet(h)["balance"] == 2000
        tx = list(MDB.wallet_tx.find({"customer_id": c["id"]}, {"_id": 0, "amount": 1, "source": 1, "kind": 1, "label": 1}))
        print("ledger after race:", tx)


# --- RBAC + audit
class TestConsoleWallet:
    def test_rider_forbidden(self, rider, admin):
        c, _ = _signup("TEST_Rbac71")
        assert requests.get(f"{API}/customers/{c['id']}/wallet", headers=rider).status_code == 403
        assert requests.get(f"{API}/customers/{c['id']}/wallet", headers=admin).status_code == 200

    def test_sales_allowed_read(self, sales):
        c, _ = _signup("TEST_Rbac71b")
        assert requests.get(f"{API}/customers/{c['id']}/wallet", headers=sales).status_code == 200

    def test_audit_entry(self, admin):
        c, _ = _signup("TEST_Audit71")
        r = requests.post(f"{API}/customers/{c['id']}/wallet/adjust", json={"amount": 250, "reason": "TEST_geste", "source": "promotion"}, headers=admin)
        assert r.status_code == 200
        a = MDB.audit_log.find_one({"entity_id": c["id"], "action": "wallet.adjust"})
        assert a and a["user_name"] and a["after"]["amount"] == 250


# --- Full referral + wallet cycle regression
class TestCycle:
    def test_full_cycle(self, admin):
        m, mh = _signup("TEST_Marraine71")
        f, fh = _signup("TEST_Filleule71", m["referral_code"])
        assert _wallet(fh)["balance"] == 1000
        wm = _wallet(mh)
        assert wm["pending"] == 1000 and wm["balance"] == 0
        o = requests.post(f"{API}/public/orders", json=_body(20000, 400), headers=fh).json()
        assert o["wallet_used"] == 400 and o["total"] == 20000 + 1500 - 400
        assert _wallet(fh)["balance"] == 600
        for st in ("confirmee", "en_preparation", "prete", "en_livraison", "livree"):
            requests.patch(f"{API}/orders/{o['id']}/status", json={"status": st}, headers=admin)
        wm = _wallet(mh)
        assert wm["balance"] == 1000 and wm["pending"] == 0
        # cancel refund on 2nd order
        o2 = requests.post(f"{API}/public/orders", json=_body(15000, 600), headers=fh).json()
        assert o2["wallet_used"] == 600 and _wallet(fh)["balance"] == 0
        _status(admin, o2["id"], "annulee")
        assert _wallet(fh)["balance"] == 600
        # conversion: points from delivered order (20000 subtotal)
        wf = _wallet(fh)
        print("filleule points", wf.get("points"))
        if wf.get("points", 0) >= 100:
            r = requests.post(f"{API}/public/account/wallet/convert", json={"points": 100, "key": str(uuid.uuid4())}, headers=fh)
            assert r.status_code == 200
            assert _wallet(fh)["balance"] == 600 + 1000
