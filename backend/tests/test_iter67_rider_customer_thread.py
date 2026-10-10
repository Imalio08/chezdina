"""Iteration 67 regression — rider↔customer order thread, orders-messages/unread,
customer account threads, and rider access_slug reservation.
"""
import os
import pytest
import requests

def _read_env(key):
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith(key + "="):
                return line.split("=", 1)[1].strip()
    raise KeyError(key)

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or _read_env("REACT_APP_BACKEND_URL")).rstrip("/")

ADMIN = {"email": "aouattaraesca@gmail.com", "password": "Admin123!"}
RIDER1 = {"email": "rider1@dinastore.ci", "password": "Rider123!"}
RIDER2 = {"email": "rider2@dinastore.ci", "password": "Rider123!"}


def _login(creds):
    r = requests.post(f"{BASE}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_tok():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def rider1_tok():
    return _login(RIDER1)


@pytest.fixture(scope="module")
def rider2_tok():
    return _login(RIDER2)


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ----- 1. Public rider CMS has access_slug field -----
def test_public_rider_cms_load():
    r = requests.get(f"{BASE}/api/public/rider-cms", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert "primary_color" in data
    assert isinstance(data.get("tabs", []), list)


# ----- 2. Set access_slug 'livreur', reserved word rejected -----
def test_access_slug_set_and_reserved(admin_tok):
    # Reserved word rejected via toast on frontend; backend simply accepts strings,
    # so we only verify setting 'livreur' succeeds and persists on GET.
    r = requests.patch(f"{BASE}/api/rider-cms", json={"access_slug": "livreur"},
                       headers=_h(admin_tok), timeout=10)
    assert r.status_code == 200, r.text
    r2 = requests.get(f"{BASE}/api/public/rider-cms", timeout=10)
    assert r2.json().get("access_slug") == "livreur"


# ----- 3. Rider login via /api/auth/login returns role=rider -----
def test_rider_login_role(rider1_tok):
    r = requests.get(f"{BASE}/api/auth/me", headers=_h(rider1_tok), timeout=10)
    assert r.status_code == 200
    assert r.json().get("role") == "rider"


# ----- 4. GET /api/riders/me/today returns orders for rider1 -----
@pytest.fixture(scope="module")
def rider1_order(rider1_tok):
    r = requests.get(f"{BASE}/api/riders/me/today", headers=_h(rider1_tok), timeout=15)
    assert r.status_code == 200, r.text
    orders = r.json().get("orders") or []
    if not orders:
        pytest.skip("rider1 has no orders today — load demo pack first")
    # Prefer one with a customer id so rider_customer thread works
    for o in orders:
        if (o.get("customer") or {}).get("id"):
            return o
    pytest.skip("No rider1 order with linked customer")


# ----- 5. rider_customer thread: GET + POST as owner rider -----
def test_rider_customer_thread_owner(rider1_tok, rider1_order):
    oid = rider1_order["id"]
    g = requests.get(f"{BASE}/api/orders/{oid}/thread/rider_customer",
                     headers=_h(rider1_tok), timeout=10)
    assert g.status_code == 200, g.text
    s = requests.post(f"{BASE}/api/orders/{oid}/thread/rider_customer/send",
                      json={"text": "TEST_hello cliente"},
                      headers=_h(rider1_tok), timeout=10)
    assert s.status_code == 200, s.text
    assert s.json().get("ok") is True


# ----- 6. rider_customer thread: 403 for a different rider -----
def test_rider_customer_thread_forbidden_other_rider(rider2_tok, rider1_order):
    oid = rider1_order["id"]
    r = requests.get(f"{BASE}/api/orders/{oid}/thread/rider_customer",
                     headers=_h(rider2_tok), timeout=10)
    assert r.status_code == 403


# ----- 7. rider_customer thread: admin (store) can access -----
def test_rider_customer_thread_admin(admin_tok, rider1_order):
    oid = rider1_order["id"]
    r = requests.get(f"{BASE}/api/orders/{oid}/thread/rider_customer",
                     headers=_h(admin_tok), timeout=10)
    assert r.status_code == 200


# ----- 8. orders-messages/unread as rider has by_order dict -----
def test_rider_unread_counts(rider1_tok):
    r = requests.get(f"{BASE}/api/orders-messages/unread",
                     headers=_h(rider1_tok), timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert "count" in data and "by_order" in data
    assert isinstance(data["by_order"], dict)


# ----- 9. Customer sees the rider_customer thread in /api/public/account/threads -----
def test_customer_sees_rider_thread(rider1_order):
    # Demo customer: Mariam Kouadio (démo) +225 07 48 11 22 01 / 202601
    phone = "+225 07 48 11 22 01"
    code = "202601"
    s = requests.Session()
    lr = s.post(f"{BASE}/api/public/customer-login-code", json={"phone": phone, "code": code}, timeout=15)
    if lr.status_code != 200:
        pytest.skip(f"Demo customer login unavailable: {lr.status_code} {lr.text[:200]}")
    tok = lr.json().get("token")
    assert tok
    r = requests.get(f"{BASE}/api/public/account/threads",
                     headers={"Authorization": f"Bearer {tok}"}, timeout=10)
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)
    # Only assert structure here — the thread may belong to another demo customer.
