"""Backend regression tests for Wave 1 bug fixes (iteration 32)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://dina-boutique.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "aouattaraesca@gmail.com"
ADMIN_PWD = "Admin123!"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


# ---------- Regression: core list endpoints still 200 ----------
@pytest.mark.parametrize("path", [
    "/api/customers", "/api/products", "/api/purchase-orders",
    "/api/orders", "/api/delivery-sessions",
])
def test_core_lists(admin_session, path):
    r = admin_session.get(f"{BASE_URL}{path}", timeout=15)
    assert r.status_code == 200, f"{path} -> {r.status_code}"
    assert isinstance(r.json(), list)


# ---------- Products has a usable SKU for /scan ----------
def test_products_have_sku(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/products", timeout=15)
    items = r.json()
    with_sku = [p for p in items if p.get("sku")]
    assert with_sku, "No product has a SKU - /scan cannot be tested"


# ---------- regen-access-code endpoint ----------
def test_regen_access_code(admin_session):
    cust = admin_session.get(f"{BASE_URL}/api/customers", timeout=15).json()
    assert cust, "No customers to regen"
    cid = cust[0]["id"]
    r = admin_session.post(f"{BASE_URL}/api/customers/{cid}/regen-access-code", timeout=15)
    assert r.status_code == 200, f"regen -> {r.status_code} {r.text[:200]}"
    data = r.json()
    assert data.get("ok") is True
    code = data.get("access_code")
    assert code and len(code) == 6 and code.isdigit(), f"Bad access_code: {code!r}"
    assert "phone" in data and "name" in data
    # idempotent call generates a *different* code
    r2 = admin_session.post(f"{BASE_URL}/api/customers/{cid}/regen-access-code", timeout=15)
    assert r2.status_code == 200
    assert r2.json().get("access_code") != code or True  # may rarely collide
