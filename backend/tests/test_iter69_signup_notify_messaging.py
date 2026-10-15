"""Iter-69 backend tests: customer signup/login/lockout, referral, account addresses,
push subscribe (staff + customer), rider conversations, notifications feed."""
import os
import random
import time
import pytest
import requests

def _load_backend_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v.rstrip("/")
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not set")

BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "aouattaraesca@gmail.com"
ADMIN_PASSWORD = "Admin123!"
RIDER1_EMAIL = "rider1@dinastore.ci"
RIDER1_PASSWORD = "Rider123!"
RIDER2_EMAIL = "rider2@dinastore.ci"
RIDER2_PASSWORD = "Rider123!"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def rider1_token():
    r = requests.post(f"{API}/auth/login", json={"email": RIDER1_EMAIL, "password": RIDER1_PASSWORD}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def rider2_token():
    r = requests.post(f"{API}/auth/login", json={"email": RIDER2_EMAIL, "password": RIDER2_PASSWORD}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _unique_phone():
    # +225 07 1X XX XX XX, randomised
    return "+225 07 1" + "".join(str(random.randint(0, 9)) for _ in range(7))


# ---------- Customer signup ----------
class TestCustomerSignup:
    created_ids = []

    def test_weak_pin_rejected(self):
        r = requests.post(f"{API}/public/customer-signup", json={
            "name": "TEST_Weak", "phone": _unique_phone(), "pin": "123456",
        }, timeout=20)
        assert r.status_code == 400
        assert "PIN" in r.text or "simple" in r.text.lower()

    def test_short_pin_rejected(self):
        r = requests.post(f"{API}/public/customer-signup", json={
            "name": "TEST_Short", "phone": _unique_phone(), "pin": "12345",
        }, timeout=20)
        assert r.status_code == 400

    def test_invalid_referral_rejected(self):
        r = requests.post(f"{API}/public/customer-signup", json={
            "name": "TEST_BadRef", "phone": _unique_phone(), "pin": "482716",
            "referral_code": "DINA-ZZZZ-NOPE",
        }, timeout=20)
        assert r.status_code == 400
        assert "parrainage" in r.text.lower() or "introuvable" in r.text.lower()

    def test_valid_signup_logs_in(self):
        phone = _unique_phone()
        r = requests.post(f"{API}/public/customer-signup", json={
            "name": "TEST_Signup Auto", "phone": phone, "pin": "482716",
            "email": "test_signup_auto@example.test",
        }, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and "customer" in data
        assert data["customer"]["name"] == "TEST_Signup Auto"
        assert data["customer"]["phone"] == phone
        assert data["customer"]["access_code"] == "482716"
        assert data["customer"]["wallet"] == 0
        assert data["customer"].get("referral_code", "").startswith("DINA-")
        TestCustomerSignup.created_ids.append((data["customer"]["id"], data["token"], phone))

    def test_duplicate_phone_rejected(self):
        _, _, phone = TestCustomerSignup.created_ids[-1]
        r = requests.post(f"{API}/public/customer-signup", json={
            "name": "TEST_Dup", "phone": phone, "pin": "381726",
        }, timeout=20)
        assert r.status_code == 409

    def test_mismatched_pin_is_frontend_only(self):
        # Backend accepts only `pin`; signup validation of pin2==pin is frontend. Confirm backend works with correct pin.
        r = requests.post(f"{API}/public/customer-signup", json={
            "name": "TEST_PinOk", "phone": _unique_phone(), "pin": "381726",
        }, timeout=20)
        assert r.status_code == 200
        TestCustomerSignup.created_ids.append((r.json()["customer"]["id"], r.json()["token"], None))


# ---------- Login by code + lockout ----------
class TestCustomerLoginCode:
    def test_login_wrong_code_then_lockout(self, admin_headers):
        phone = _unique_phone()
        signup = requests.post(f"{API}/public/customer-signup", json={
            "name": "TEST_Lockout", "phone": phone, "pin": "739184",
        }, timeout=20).json()
        TestCustomerSignup.created_ids.append((signup["customer"]["id"], signup["token"], None))

        # 5 wrong attempts
        last = None
        for i in range(5):
            last = requests.post(f"{API}/public/customer-login-code", json={"phone": phone, "code": "000001"}, timeout=20)
            assert last.status_code == 401, f"attempt {i}: {last.status_code} {last.text}"
        # 6th gets 429
        r6 = requests.post(f"{API}/public/customer-login-code", json={"phone": phone, "code": "000001"}, timeout=20)
        assert r6.status_code == 429, r6.text

    def test_login_success_with_correct_code(self):
        phone = _unique_phone()
        signup = requests.post(f"{API}/public/customer-signup", json={
            "name": "TEST_LoginOk", "phone": phone, "pin": "739185",
        }, timeout=20).json()
        TestCustomerSignup.created_ids.append((signup["customer"]["id"], signup["token"], None))

        r = requests.post(f"{API}/public/customer-login-code", json={"phone": phone, "code": "739185"}, timeout=20)
        assert r.status_code == 200, r.text
        assert "token" in r.json()


# ---------- Referral at signup ----------
class TestReferralSignup:
    def test_referral_increments_wallets(self, admin_headers):
        # Create a marraine
        marraine_phone = _unique_phone()
        s = requests.post(f"{API}/public/customer-signup", json={
            "name": "TEST_Marraine", "phone": marraine_phone, "pin": "516273",
        }, timeout=20).json()
        marraine_id = s["customer"]["id"]
        marraine_code = s["customer"]["referral_code"]
        TestCustomerSignup.created_ids.append((marraine_id, s["token"], None))

        # Signup with referral
        filleul_phone = _unique_phone()
        f = requests.post(f"{API}/public/customer-signup", json={
            "name": "TEST_Filleul", "phone": filleul_phone, "pin": "516274",
            "referral_code": marraine_code,
        }, timeout=20)
        assert f.status_code == 200, f.text
        filleul_data = f.json()["customer"]
        TestCustomerSignup.created_ids.append((filleul_data["id"], f.json()["token"], None))

        assert filleul_data["wallet"] >= 1, f"Filleul wallet should be >=1, got {filleul_data['wallet']}"

        # Check marraine wallet via admin API
        r = requests.get(f"{API}/customers/{marraine_id}", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        payload = r.json()
        marraine = payload.get("customer") if isinstance(payload, dict) and "customer" in payload else payload
        assert marraine.get("wallet", 0) >= 1, f"marraine wallet should be >=1, got {marraine.get('wallet')}"
        assert marraine.get("referral_count", 0) >= 1


# ---------- Account addresses ----------
class TestAccountAddresses:
    @pytest.fixture
    def cust_token(self):
        phone = _unique_phone()
        s = requests.post(f"{API}/public/customer-signup", json={
            "name": "TEST_AddrOwner", "phone": phone, "pin": "604827",
        }, timeout=20).json()
        TestCustomerSignup.created_ids.append((s["customer"]["id"], s["token"], None))
        return s["token"]

    def test_crud_addresses(self, cust_token):
        h = {"Authorization": f"Bearer {cust_token}", "Content-Type": "application/json"}

        # list initial
        r = requests.get(f"{API}/public/account/addresses", headers=h, timeout=20)
        assert r.status_code == 200
        assert r.json() == []

        # add first (becomes default)
        r = requests.post(f"{API}/public/account/addresses", headers=h, json={
            "label": "Maison", "zone": "Cocody", "quartier": "Angré", "rue": "Rue des Jardins", "reperes": "près du maquis"
        }, timeout=20)
        assert r.status_code == 200, r.text
        addrs = r.json()["addresses"]
        assert len(addrs) == 1 and addrs[0]["default"] is True
        aid1 = addrs[0]["id"]

        # add second (not default)
        r = requests.post(f"{API}/public/account/addresses", headers=h, json={
            "label": "Bureau", "zone": "Plateau", "quartier": "Centre", "rue": "Bd de la Paix"
        }, timeout=20)
        addrs = r.json()["addresses"]
        assert len(addrs) == 2
        aid2 = next(a["id"] for a in addrs if a["id"] != aid1)
        assert sum(1 for a in addrs if a.get("default")) == 1

        # update: make 2nd default
        r = requests.patch(f"{API}/public/account/addresses/{aid2}", headers=h, json={"default": True}, timeout=20)
        assert r.status_code == 200
        addrs = r.json()["addresses"]
        a2 = next(a for a in addrs if a["id"] == aid2)
        a1 = next(a for a in addrs if a["id"] == aid1)
        assert a2["default"] is True and a1["default"] is False

        # delete 1st
        r = requests.delete(f"{API}/public/account/addresses/{aid1}", headers=h, timeout=20)
        assert r.status_code == 200
        assert len(r.json()["addresses"]) == 1


# ---------- Push subscribe (customer + staff) ----------
SAMPLE_SUB = {
    "endpoint": "https://fcm.googleapis.com/fcm/send/fake-endpoint-iter69",
    "keys": {"p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
             "auth": "tBHItJI5svbpez7KI4CCXg"}
}


class TestPushSubscribe:
    def test_customer_push_subscribe(self):
        phone = _unique_phone()
        s = requests.post(f"{API}/public/customer-signup", json={
            "name": "TEST_PushCust", "phone": phone, "pin": "708192",
        }, timeout=20).json()
        TestCustomerSignup.created_ids.append((s["customer"]["id"], s["token"], None))
        h = {"Authorization": f"Bearer {s['token']}", "Content-Type": "application/json"}

        r = requests.post(f"{API}/public/account/push/subscribe", headers=h,
                          json={"subscription": SAMPLE_SUB}, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    def test_customer_push_invalid_subscription(self):
        phone = _unique_phone()
        s = requests.post(f"{API}/public/customer-signup", json={
            "name": "TEST_PushBad", "phone": phone, "pin": "708193",
        }, timeout=20).json()
        TestCustomerSignup.created_ids.append((s["customer"]["id"], s["token"], None))
        h = {"Authorization": f"Bearer {s['token']}", "Content-Type": "application/json"}

        r = requests.post(f"{API}/public/account/push/subscribe", headers=h,
                          json={"subscription": {"endpoint": "", "keys": {}}}, timeout=20)
        assert r.status_code == 400

    def test_staff_push_subscribe(self, rider1_token):
        h = {"Authorization": f"Bearer {rider1_token}", "Content-Type": "application/json"}
        sub = dict(SAMPLE_SUB)
        sub["endpoint"] = sub["endpoint"] + "-rider"
        r = requests.post(f"{API}/push/subscribe", headers=h, json={"subscription": sub}, timeout=20)
        assert r.status_code == 200
        assert r.json().get("ok") is True


# ---------- Notifications feed ----------
class TestNotifications:
    def test_rider_feed(self, rider1_token):
        h = {"Authorization": f"Bearer {rider1_token}"}
        r = requests.get(f"{API}/me/notifications", headers=h, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and "unread" in data
        assert isinstance(data["items"], list)

    def test_rider_mark_read(self, rider1_token):
        h = {"Authorization": f"Bearer {rider1_token}"}
        r = requests.post(f"{API}/me/notifications/read", headers=h, timeout=20)
        assert r.status_code == 200
        # verify unread == 0
        r2 = requests.get(f"{API}/me/notifications", headers=h, timeout=20)
        assert r2.json().get("unread", 0) == 0


# ---------- Rider conversations access control ----------
class TestRiderConversations:
    def test_rider_lists_conversations(self, rider1_token):
        h = {"Authorization": f"Bearer {rider1_token}"}
        r = requests.get(f"{API}/rider/conversations", headers=h, timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_rider2_cannot_access_rider1_conv(self, rider1_token, rider2_token):
        h1 = {"Authorization": f"Bearer {rider1_token}"}
        convs = requests.get(f"{API}/rider/conversations", headers=h1, timeout=20).json()
        if not convs:
            pytest.skip("rider1 has no conversations to test cross-access")
        cid = convs[0]["id"]
        h2 = {"Authorization": f"Bearer {rider2_token}"}
        r = requests.get(f"{API}/rider/conversations/{cid}", headers=h2, timeout=20)
        assert r.status_code == 404

    def test_rider2_cannot_send_to_rider1_conv(self, rider1_token, rider2_token):
        h1 = {"Authorization": f"Bearer {rider1_token}"}
        convs = requests.get(f"{API}/rider/conversations", headers=h1, timeout=20).json()
        if not convs:
            pytest.skip("no rider1 conv")
        cid = convs[0]["id"]
        h2 = {"Authorization": f"Bearer {rider2_token}", "Content-Type": "application/json"}
        r = requests.post(f"{API}/rider/conversations/{cid}/send", headers=h2, json={"text": "hack"}, timeout=20)
        assert r.status_code == 404


# ---------- Cleanup ----------
def test_zz_cleanup(admin_headers):
    """Delete all TEST_ customers we created."""
    for cid, _tok, _phone in TestCustomerSignup.created_ids:
        try:
            requests.delete(f"{API}/customers/{cid}", headers=admin_headers, timeout=20)
        except Exception:
            pass
    # also delete sample push subs
    # (no explicit DELETE endpoint — subs are reclaimed on 404/410 push)
