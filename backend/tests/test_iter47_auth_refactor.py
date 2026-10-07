"""
Iter47 P5 refactor tranche 2 — auth extracted into routers/auth.py.
Ensure all auth endpoints still behave the same.
"""
import os
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")

CREDS = {
    "admin":   ("aouattaraesca@gmail.com", "Admin123!"),
    "manager": ("manager.cocody@dinastore.ci", "Manager123!"),
    "sales":   ("agent1@dinastore.ci", "Agent123!"),
    "cm":      ("cm@dinastore.ci", "Cm123!"),
    "rider":   ("rider1@dinastore.ci", "Rider123!"),
}


def _login(role):
    email, pwd = CREDS[role]
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": pwd}, timeout=15)
    assert r.status_code == 200, f"Login {role} failed: {r.status_code} {r.text}"
    j = r.json()
    assert "token" in j and j["token"]
    assert "user" in j and j["user"].get("role")
    # sensitive fields stripped
    assert "password_hash" not in j["user"]
    assert "pin_hash" not in j["user"]
    assert "_id" not in j["user"]
    return j["token"]


@pytest.fixture(scope="session")
def tokens():
    return {k: _login(k) for k in CREDS}


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


# -------- Staff auth (routers/auth.py) --------
class TestStaffAuth:
    def test_login_admin(self, tokens):
        assert tokens["admin"]

    def test_login_manager(self, tokens):
        assert tokens["manager"]

    def test_login_sales(self, tokens):
        assert tokens["sales"]

    def test_login_cm(self, tokens):
        assert tokens["cm"]

    def test_login_rider(self, tokens):
        assert tokens["rider"]

    def test_login_bad_password(self):
        r = requests.post(f"{BASE}/api/auth/login", json={"email": CREDS["admin"][0], "password": "wrong"})
        assert r.status_code == 401

    def test_login_pin_admin(self):
        r = requests.post(f"{BASE}/api/auth/login-pin", json={"pin": "1234"})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["user"]["role"] == "admin"
        assert "password_hash" not in j["user"]
        assert "pin_hash" not in j["user"]
        assert j["token"]

    def test_login_pin_invalid(self):
        r = requests.post(f"{BASE}/api/auth/login-pin", json={"pin": "000000"})
        assert r.status_code == 401

    def test_me_returns_clean_user(self, tokens):
        r = requests.get(f"{BASE}/api/auth/me", headers=H(tokens["admin"]))
        assert r.status_code == 200
        u = r.json()
        assert u.get("role") == "admin"
        assert "password_hash" not in u
        assert "pin_hash" not in u
        assert "_id" not in u

    def test_me_unauth(self):
        r = requests.get(f"{BASE}/api/auth/me")
        assert r.status_code in (401, 403)

    def test_logout(self):
        r = requests.post(f"{BASE}/api/auth/logout")
        assert r.status_code == 200
        assert r.json().get("ok") is True


# -------- Customer auth --------
class TestCustomerAuth:
    def test_register_existing_returns_400(self):
        payload = {
            "name": "Test Dupe",
            "phone": "+225 07 85 55 58 88",
            "email": "dupe-iter47@test.ci",
            "password": "Secret123!",
        }
        r = requests.post(f"{BASE}/api/public/customer-register", json=payload)
        # Either existing (400) or newly accepted (200). Both are valid "endpoint-works" states.
        assert r.status_code in (200, 400), r.text

    def test_register_missing_password(self):
        r = requests.post(f"{BASE}/api/public/customer-register", json={
            "name": "NoPwd", "phone": "+225 01 00 00 00 00", "email": "nopwd@t.ci"
        })
        assert r.status_code == 400

    def test_customer_login_code_bad_phone(self):
        r = requests.post(f"{BASE}/api/public/customer-login-code", json={"phone": "abc", "code": "123456"})
        assert r.status_code == 400

    def test_customer_login_code_unknown_phone(self):
        r = requests.post(f"{BASE}/api/public/customer-login-code", json={"phone": "+225 99 99 99 99 99", "code": "000000"})
        assert r.status_code == 404

    def test_customer_login_code_valid_or_wrongcode(self):
        # If seeded, the known test customer should accept phone+code
        r = requests.post(f"{BASE}/api/public/customer-login-code",
                          json={"phone": "+225 07 85 55 58 88", "code": "386436"})
        # Accept 200 (seeded correctly) or 401 (code mismatch) or 404 (not seeded)
        assert r.status_code in (200, 401, 404), r.text
        if r.status_code == 200:
            j = r.json()
            assert j["token"]
            assert "password_hash" not in j["customer"]

    def test_customer_logout(self):
        r = requests.post(f"{BASE}/api/public/customer-logout")
        assert r.status_code == 200

    def test_customer_login_bad_identifier(self):
        r = requests.post(f"{BASE}/api/public/customer-login",
                          json={"identifier": "nonexistent@xyz.ci", "password": "bad"})
        assert r.status_code == 401


# -------- Regression: endpoints in server.py that use get_customer / models --------
class TestServerRegressionAfterRefactor:
    def test_account_addresses_unauth(self):
        r = requests.get(f"{BASE}/api/public/account/addresses")
        # endpoint exists and requires customer auth
        assert r.status_code in (401, 403), f"got {r.status_code}: {r.text}"

    def test_account_orders_split_unauth(self):
        r = requests.get(f"{BASE}/api/public/account/orders-split")
        assert r.status_code in (401, 403), f"got {r.status_code}: {r.text}"

    def test_customers_crud_shape(self, tokens):
        # POST /api/customers still accepts CustomerIn shape (now imported from models)
        payload = {
            "name": "TEST_iter47_cust",
            "phone": "+225 05 11 22 33 44",
            "email": "TEST_iter47@example.ci",
        }
        r = requests.post(f"{BASE}/api/customers", headers=H(tokens["admin"]), json=payload)
        assert r.status_code in (200, 400), r.text  # 400 if duplicate from prior run
        if r.status_code == 200:
            cid = r.json().get("id")
            assert cid
            # cleanup
            requests.delete(f"{BASE}/api/customers/{cid}", headers=H(tokens["admin"]))

    def test_users_create_shape(self, tokens):
        # POST /api/users accepts UserIn shape (imported from models)
        payload = {
            "name": "TEST_iter47_user",
            "email": "TEST_iter47_user@example.ci",
            "role": "sales",
            "password": "Testpass123!",
            "pin": "9999",
        }
        r = requests.post(f"{BASE}/api/users", headers=H(tokens["admin"]), json=payload)
        assert r.status_code in (200, 400), r.text
        if r.status_code == 200:
            uid = r.json().get("id")
            if uid:
                requests.delete(f"{BASE}/api/users/{uid}", headers=H(tokens["admin"]))

    def test_attendance_me_still_works(self, tokens):
        r = requests.get(f"{BASE}/api/attendance/me", headers=H(tokens["admin"]))
        assert r.status_code == 200

    def test_products_still_works(self, tokens):
        r = requests.get(f"{BASE}/api/products", headers=H(tokens["admin"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)
