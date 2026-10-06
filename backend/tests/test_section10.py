"""Section 10 tests — CMS Vitrine (storefront sections) + Compte Cliente (customer login by access code)."""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    # fallback to frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE}/api"

ADMIN = {"email": "aouattaraesca@gmail.com", "password": "Admin123!"}
MANAGER = {"email": "manager.cocody@dinastore.ci", "password": "Manager123!"}
SALES = {"email": "agent1@dinastore.ci", "password": "Agent123!"}

CUSTOMER_PHONE = "+225 07 60 17 28 21"
CUSTOMER_CODE = "142085"


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed {creds['email']}: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def admin():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def manager():
    return _login(MANAGER)


@pytest.fixture(scope="module")
def sales():
    return _login(SALES)


# ---------- Storefront sections ----------
class TestStorefrontSections:
    def test_public_sections_no_auth(self):
        r = requests.get(f"{API}/public/storefront/sections", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 1
        # All must be enabled (filter applied)
        for s in data:
            assert s.get("enabled", True) is not False

    def test_auth_list_sections(self, admin):
        r = admin.get(f"{API}/storefront/sections", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_patch_sections_admin(self, admin):
        new_sections = [
            {"id": "s1", "type": "hero", "enabled": True, "props": {"title": "Chez Dina"}},
            {"id": "s2", "type": "product_grid", "enabled": True, "props": {"limit": 8}},
            {"id": "s3", "type": "trust_strip", "enabled": False, "props": {}},
        ]
        r = admin.patch(f"{API}/storefront/sections", json={"sections": new_sections}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert len(data["sections"]) == 3

        # verify persistence (auth GET returns all 3)
        r2 = admin.get(f"{API}/storefront/sections", timeout=15)
        got = r2.json()
        assert len(got) == 3
        assert any(s["type"] == "trust_strip" and s["enabled"] is False for s in got)

        # public GET filters disabled → should drop trust_strip
        r3 = requests.get(f"{API}/public/storefront/sections", timeout=15)
        pub = r3.json()
        assert len(pub) == 2
        assert all(s["type"] != "trust_strip" for s in pub)

    def test_patch_sections_manager(self, manager):
        payload = {"sections": [
            {"id": "s1", "type": "hero", "enabled": True, "props": {"title": "Dina"}},
            {"id": "s2", "type": "product_grid", "enabled": True, "props": {}},
            {"id": "s3", "type": "trust_strip", "enabled": True, "props": {}},
        ]}
        r = manager.patch(f"{API}/storefront/sections", json=payload, timeout=15)
        assert r.status_code == 200, r.text

    def test_patch_sections_sales_forbidden(self, sales):
        r = sales.patch(f"{API}/storefront/sections", json={"sections": []}, timeout=15)
        assert r.status_code == 403


# ---------- Customer login by access code ----------
class TestCustomerAuth:
    def test_login_code_success(self):
        s = requests.Session()
        r = s.post(f"{API}/public/customer-login-code",
                   json={"phone": CUSTOMER_PHONE, "code": CUSTOMER_CODE}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and data["token"]
        assert data["customer"]["name"].startswith("Aminata")
        # cookie should be set
        assert "customer_token" in s.cookies

    def test_login_code_wrong_code(self):
        r = requests.post(f"{API}/public/customer-login-code",
                          json={"phone": CUSTOMER_PHONE, "code": "000000"}, timeout=15)
        assert r.status_code == 401
        assert "Code secret invalide" in r.text

    def test_login_code_no_match(self):
        r = requests.post(f"{API}/public/customer-login-code",
                          json={"phone": "+225 99 99 99 99 99", "code": "123456"}, timeout=15)
        assert r.status_code == 404

    def test_login_code_bad_phone(self):
        r = requests.post(f"{API}/public/customer-login-code",
                          json={"phone": "", "code": "142085"}, timeout=15)
        assert r.status_code == 400

    def test_account_me_requires_auth(self):
        r = requests.get(f"{API}/public/account/me", timeout=15)
        assert r.status_code == 401

    def test_account_me_rejects_staff_token(self, admin):
        # staff token (kind=user) must be rejected on customer endpoint
        r = admin.get(f"{API}/public/account/me", timeout=15)
        assert r.status_code == 401

    def test_account_me_with_bearer(self):
        r = requests.post(f"{API}/public/customer-login-code",
                          json={"phone": CUSTOMER_PHONE, "code": CUSTOMER_CODE}, timeout=15)
        assert r.status_code == 200
        token = r.json()["token"]
        r2 = requests.get(f"{API}/public/account/me",
                          headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r2.status_code == 200
        data = r2.json()
        assert data["customer"]["name"].startswith("Aminata")
        assert "orders" in data
        assert "metrics" in data
        m = data["metrics"]
        assert set(m.keys()) >= {"total_orders", "total_spent", "referrals"}
        assert isinstance(m["total_orders"], int)

    def test_account_me_with_cookie(self):
        s = requests.Session()
        r = s.post(f"{API}/public/customer-login-code",
                   json={"phone": CUSTOMER_PHONE, "code": CUSTOMER_CODE}, timeout=15)
        assert r.status_code == 200
        r2 = s.get(f"{API}/public/account/me", timeout=15)
        assert r2.status_code == 200

    def test_customer_logout_clears_cookie(self):
        s = requests.Session()
        s.post(f"{API}/public/customer-login-code",
               json={"phone": CUSTOMER_PHONE, "code": CUSTOMER_CODE}, timeout=15)
        r = s.post(f"{API}/public/customer-logout", timeout=15)
        assert r.status_code == 200
        # After logout, calling /account/me without cookie should fail
        s.cookies.clear()
        r2 = s.get(f"{API}/public/account/me", timeout=15)
        assert r2.status_code == 401


# ---------- access_code assignment ----------
class TestAccessCodeAssignment:
    def test_create_customer_assigns_access_code(self, admin):
        payload = {"name": "TEST_AccessCode", "phone": "+225 05 00 00 00 01",
                   "email": "test_ac@example.com", "city": "Abidjan"}
        r = admin.post(f"{API}/customers", json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        c = r.json()
        assert "access_code" in c
        assert len(c["access_code"]) == 6 and c["access_code"].isdigit()
        # cleanup
        admin.delete(f"{API}/customers/{c['id']}", timeout=15)

    def test_bulk_customers_assign_access_code(self, admin):
        payload = [
            {"name": "TEST_Bulk1", "phone": "+225 05 00 00 00 11", "city": "Abidjan"},
            {"name": "TEST_Bulk2", "phone": "+225 05 00 00 00 12", "city": "Abidjan"},
        ]
        r = admin.post(f"{API}/customers/bulk", json=payload, timeout=20)
        assert r.status_code in (200, 201), r.text
        # Fetch all to verify
        got = admin.get(f"{API}/customers", timeout=20).json()
        test_rows = [c for c in got if c.get("name", "").startswith("TEST_Bulk")]
        assert len(test_rows) >= 2
        for c in test_rows:
            assert c.get("access_code") and len(c["access_code"]) == 6
            admin.delete(f"{API}/customers/{c['id']}", timeout=15)

    def test_register_assigns_access_code(self):
        import time
        unique = str(int(time.time()))[-6:]
        payload = {"name": "TEST_Register", "phone": f"+225 05 10 00 {unique[:2]} {unique[2:4]}",
                   "email": f"test_reg_{unique}@example.com", "city": "Abidjan",
                   "password": "Pwd12345!"}
        r = requests.post(f"{API}/public/customer-register", json=payload, timeout=15)
        if r.status_code == 400 and "existant" in r.text:
            pytest.skip("account already exists")
        assert r.status_code == 200, r.text
        c = r.json()
        assert "access_code" in c and len(c["access_code"]) == 6

    def test_blacklisted_customer_cannot_login(self, admin):
        # Create a customer, blacklist, try login-code; then cleanup
        payload = {"name": "TEST_Blacklist", "phone": "+225 05 55 55 55 99", "city": "Abidjan"}
        r = admin.post(f"{API}/customers", json=payload, timeout=15)
        c = r.json()
        code = c["access_code"]
        try:
            # Blacklist via PATCH
            upd = admin.patch(f"{API}/customers/{c['id']}", json={"status": "blacklist"}, timeout=15)
            if upd.status_code not in (200, 204):
                pytest.skip(f"customer patch not supported: {upd.status_code}")
            r2 = requests.post(f"{API}/public/customer-login-code",
                               json={"phone": c["phone"], "code": code}, timeout=15)
            # Should NOT return 200 (either 404 because excluded by status filter, or 401)
            assert r2.status_code in (401, 404), f"blacklisted customer was able to login: {r2.status_code}"
        finally:
            admin.delete(f"{API}/customers/{c['id']}", timeout=15)
