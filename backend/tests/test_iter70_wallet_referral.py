"""Iter70: Parrainage (referral) + Porte-monnaie (wallet ledger) + Fidélité (points) backend tests."""
import os, random, uuid, pytest, requests


def _load_env():
    with open("/app/frontend/.env") as f:
        for ln in f:
            if ln.startswith("REACT_APP_BACKEND_URL="):
                return ln.split("=", 1)[1].strip()
    return os.environ.get("REACT_APP_BACKEND_URL")


BASE = _load_env().rstrip("/")
API = f"{BASE}/api"
PID = "2c2005f5-cabe-46e5-9a4b-657f093f24a6"
PIN = "482915"
CREATED = {"customers": [], "orders": []}


def _phone():
    return f"+225 07 9{random.randint(0,9)} {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)}"


def _signup(name, code=None):
    body = {"name": name, "phone": _phone(), "pin": PIN}
    if code:
        body["referral_code"] = code
    r = requests.post(f"{API}/public/customer-signup", json=body, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    CREATED["customers"].append(d["customer"]["id"])
    return d["customer"], {"Authorization": f"Bearer {d['token']}"}


def _order(h, price, wallet_use=0, key=None, fee=1500):
    body = {"items": [{"product_id": PID, "name": "TEST_item", "qty": 1, "price": price}], "channel": "boutique",
            "payment_method": "mobile_money", "delivery_fee": fee, "mode": "delivery", "wallet_use": wallet_use,
            "checkout_key": key or str(uuid.uuid4()), "customer": {"name": "TEST_x"}}
    r = requests.post(f"{API}/public/orders", json=body, headers=h, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    if d["id"] not in CREATED["orders"]:
        CREATED["orders"].append(d["id"])
    return d


def _wallet(h):
    r = requests.get(f"{API}/public/account/wallet", headers=h, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def admin():
    r = requests.post(f"{API}/auth/login", json={"email": "aouattaraesca@gmail.com", "password": "Admin123!"}, timeout=20)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def sales():
    r = requests.post(f"{API}/auth/login", json={"email": "agent1@dinastore.ci", "password": "Agent123!"}, timeout=20)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def pair():
    m, mh = _signup("TEST_Marraine70")
    f, fh = _signup("TEST_Filleule70", m["referral_code"])
    return m, mh, f, fh


def _status(admin, oid, st):
    r = requests.patch(f"{API}/orders/{oid}/status", json={"status": st}, headers=admin, timeout=20)
    assert r.status_code == 200, r.text


# --- Public referral code check / open tracking
class TestReferralPublic:
    def test_check_code(self, pair):
        m = pair[0]
        r = requests.get(f"{API}/public/referral/{m['referral_code']}")
        assert r.status_code == 200
        d = r.json()
        assert d["valid"] and d["first_name"] == "TEST_Marraine70" and d["bonus_filleul"] == 1000

    def test_check_code_lowercase(self, pair):
        r = requests.get(f"{API}/public/referral/{pair[0]['referral_code'].lower()}")
        assert r.status_code == 200

    def test_invalid_code(self):
        assert requests.get(f"{API}/public/referral/NOPE-0000").status_code == 404

    def test_signup_invalid_code_blocks(self):
        r = requests.post(f"{API}/public/customer-signup", json={"name": "TEST_Bad", "phone": _phone(), "pin": PIN, "referral_code": "NOPE-0000"})
        assert r.status_code == 400

    def test_open_is_deduplicated(self, pair):
        m, mh = pair[0], pair[1]
        vid = "TEST_vid_" + uuid.uuid4().hex[:8]
        for _ in range(2):
            assert requests.post(f"{API}/public/referral/{m['referral_code']}/open", json={"visitor_id": vid}).status_code == 200
        r = requests.get(f"{API}/public/account/referral", headers=mh).json()
        assert r["stats"]["opened"] == 1


# --- Signup bonuses + account referral page data
class TestSignupBonus:
    def test_filleule_wallet_1000(self, pair):
        w = _wallet(pair[3])
        assert w["balance"] == 1000 and w["pending"] == 0
        assert w["by_source"].get("parrainage") == 1000
        assert w["history"][0]["source"] == "parrainage"

    def test_marraine_pending_1000(self, pair):
        w = _wallet(pair[1])
        assert w["balance"] == 0 and w["pending"] == 1000

    def test_account_referral(self, pair):
        d = requests.get(f"{API}/public/account/referral", headers=pair[1]).json()
        assert d["code"] == pair[0]["referral_code"]
        assert d["rules"] == {"parrain": 1000, "filleul": 1000}
        assert d["stats"]["signed_up"] == 1 and d["stats"]["pending"] == 1000
        assert d["items"][0]["status"] == "inscrite"


# --- Checkout wallet usage, idempotency, refund, delivery
class TestCheckoutWallet:
    def test_full_cycle(self, pair, admin):
        m, mh, f, fh = pair
        key = str(uuid.uuid4())
        o = _order(fh, 5000, wallet_use=1000, key=key)
        assert o["wallet_used"] == 1000 and o["total"] == 5000 + 1500 - 1000
        assert _wallet(fh)["balance"] == 0
        o2 = _order(fh, 5000, wallet_use=1000, key=key)
        assert o2["id"] == o["id"] and o2["wallet_used"] == 1000
        w = _wallet(fh)
        assert w["balance"] == 0 and len([t for t in w["history"] if t["source"] == "commande"]) == 1
        # referral status now 1re commande en cours
        d = requests.get(f"{API}/public/account/referral", headers=mh).json()
        assert d["items"][0]["status"] == "premiere_commande"
        # deliver twice
        _status(admin, o["id"], "livree")
        _status(admin, o["id"], "en_livraison")
        _status(admin, o["id"], "livree")
        wm = _wallet(mh)
        assert wm["balance"] == 1000 and wm["pending"] == 0, wm
        d = requests.get(f"{API}/public/account/referral", headers=mh).json()
        assert d["items"][0]["status"] == "recompensee" and d["stats"]["earned"] == 1000
        wf = _wallet(fh)
        assert wf["points"] == (5000 - 1000) // 500  # 8 points, no double

    def test_over_balance_and_cancel_refund(self, pair, admin):
        m, mh = pair[0], pair[1]  # marraine has 1000
        o = _order(mh, 3000, wallet_use=99999)
        assert o["wallet_used"] == 1000
        assert _wallet(mh)["balance"] == 0
        _status(admin, o["id"], "annulee")
        _status(admin, o["id"], "nouvelle")
        _status(admin, o["id"], "annulee")
        w = _wallet(mh)
        assert w["balance"] == 1000
        assert len([t for t in w["history"] if t["source"] == "remboursement"]) == 1

    def test_wallet_capped_by_articles(self, admin):
        c, h = _signup("TEST_Cap70")
        r = requests.post(f"{API}/customers/{c['id']}/wallet/adjust", json={"amount": 5000, "reason": "TEST_promo", "source": "promotion"}, headers=admin)
        assert r.status_code == 200, r.text
        o = _order(h, 2000, wallet_use=5000, fee=2000)
        assert o["wallet_used"] == 2000 and o["total"] == 2000
        assert _wallet(h)["balance"] == 3000

    def test_guest_cannot_use_wallet(self):
        body = {"items": [{"product_id": PID, "name": "TEST_item", "qty": 1, "price": 2000}], "wallet_use": 1000,
                "customer": {"name": "TEST_guest", "phone": _phone()}, "checkout_key": str(uuid.uuid4())}
        d = requests.post(f"{API}/public/orders", json=body).json()
        CREATED["orders"].append(d["id"])
        assert d["wallet_used"] == 0


# --- Loyalty conversion
class TestLoyalty:
    def test_conversion(self, admin):
        c, h = _signup("TEST_Points70")
        o = _order(h, 60000)
        _status(admin, o["id"], "livree")
        w = _wallet(h)
        assert w["points"] == 120
        assert requests.post(f"{API}/public/account/wallet/convert", json={"points": 50, "key": "k0"}, headers=h).status_code == 400
        assert requests.post(f"{API}/public/account/wallet/convert", json={"points": 500, "key": "k1"}, headers=h).status_code == 400
        r = requests.post(f"{API}/public/account/wallet/convert", json={"points": 120, "key": "kX"}, headers=h)
        assert r.status_code == 200, r.text
        assert r.json()["balance"] == 1200 and r.json()["points"] == 0
        r2 = requests.post(f"{API}/public/account/wallet/convert", json={"points": 120, "key": "kX"}, headers=h)
        assert r2.status_code == 200 and r2.json()["balance"] == 1200


# --- Console wallet endpoints + RBAC + audit
class TestConsole:
    def test_customer_wallet_and_adjust(self, pair, admin):
        cid = pair[0]["id"]
        r = requests.get(f"{API}/customers/{cid}/wallet", headers=admin)
        assert r.status_code == 200 and "balance" in r.json()
        bal = r.json()["balance"]
        assert requests.post(f"{API}/customers/{cid}/wallet/adjust", json={"amount": 500, "reason": ""}, headers=admin).status_code == 400
        assert requests.post(f"{API}/customers/{cid}/wallet/adjust", json={"amount": 0, "reason": "abc"}, headers=admin).status_code == 400
        r = requests.post(f"{API}/customers/{cid}/wallet/adjust", json={"amount": 500, "reason": "TEST_geste", "source": "promotion"}, headers=admin)
        assert r.status_code == 200 and r.json()["tx"]["balance_after"] == bal + 500
        r = requests.post(f"{API}/customers/{cid}/wallet/adjust", json={"amount": -999999, "reason": "TEST_neg"}, headers=admin)
        assert r.status_code == 400
        r = requests.post(f"{API}/customers/{cid}/wallet/adjust", json={"amount": -500, "reason": "TEST_corr"}, headers=admin)
        assert r.status_code == 200 and r.json()["tx"]["balance_after"] == bal

    def test_transactions_rbac(self, admin, sales):
        r = requests.get(f"{API}/wallet/transactions", headers=admin)
        assert r.status_code == 200 and isinstance(r.json(), list) and "customer_name" in r.json()[0]
        assert requests.get(f"{API}/wallet/transactions", headers=sales).status_code == 403
        assert requests.post(f"{API}/customers/x/wallet/adjust", json={"amount": 5, "reason": "abc"}, headers=sales).status_code == 403

    def test_unauth(self):
        assert requests.get(f"{API}/public/account/wallet").status_code == 401
        assert requests.get(f"{API}/public/account/referral").status_code == 401
        assert requests.get(f"{API}/wallet/transactions").status_code == 401
