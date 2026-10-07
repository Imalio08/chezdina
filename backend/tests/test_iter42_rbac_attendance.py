"""
Iteration 42: Selfie-only attendance + community_manager role + RBAC
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://dina-boutique.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CREDS = {
    "admin":  ("aouattaraesca@gmail.com", "Admin123!"),
    "manager": ("manager.cocody@dinastore.ci", "Manager123!"),
    "sales": ("agent1@dinastore.ci", "Agent123!"),
    "stock_keeper": ("stock@dinastore.ci", "Stock123!"),
    "community_manager": ("cm@dinastore.ci", "Cm123!"),
    "rider": ("rider1@dinastore.ci", "Rider123!"),
}

SELFIE_B64 = "data:image/jpeg;base64,AAAA"


def _login(role_key):
    email, pwd = CREDS[role_key]
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd}, timeout=30)
    assert r.status_code == 200, f"Login {role_key} failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"No token in response for {role_key}: {data}"
    return tok, data


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


# --- Logins per role ---
@pytest.mark.parametrize("role", ["admin", "manager", "sales", "stock_keeper", "community_manager", "rider"])
def test_login_role(role):
    tok, data = _login(role)
    user = data.get("user") or {}
    assert tok
    if role == "community_manager":
        assert user.get("role") == "community_manager", f"role mismatch: {user}"


# --- Attendance: selfie-only check-in ---
def test_checkin_selfie_only_no_gps():
    tok, _ = _login("sales")
    r = requests.post(f"{API}/attendance/check-in",
                      headers=_hdr(tok),
                      json={"kind": "arrival", "method": "phone", "selfie": SELFIE_B64},
                      timeout=30)
    assert r.status_code == 200, f"check-in arrival failed: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("ok") is True
    assert "late" in body and "flags" in body and "at" in body


def test_checkin_missing_selfie_400():
    tok, _ = _login("sales")
    r = requests.post(f"{API}/attendance/check-in",
                      headers=_hdr(tok),
                      json={"kind": "arrival", "method": "phone"},
                      timeout=30)
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"


def test_attendance_me_after_arrival_then_departure():
    tok, _ = _login("manager")
    # arrival
    r1 = requests.post(f"{API}/attendance/check-in",
                       headers=_hdr(tok),
                       json={"kind": "arrival", "method": "phone", "selfie": SELFIE_B64},
                       timeout=30)
    assert r1.status_code == 200
    me1 = requests.get(f"{API}/attendance/me", headers=_hdr(tok), timeout=30)
    assert me1.status_code == 200
    j1 = me1.json()
    assert j1.get("checked_in") is True
    assert j1.get("arrival") is not None
    # departure
    r2 = requests.post(f"{API}/attendance/check-in",
                       headers=_hdr(tok),
                       json={"kind": "departure", "method": "phone", "selfie": SELFIE_B64},
                       timeout=30)
    assert r2.status_code == 200, r2.text
    me2 = requests.get(f"{API}/attendance/me", headers=_hdr(tok), timeout=30)
    assert me2.status_code == 200
    j2 = me2.json()
    assert j2.get("departure") is not None, f"departure missing: {j2}"


# --- RBAC: /api/attendance/today ---
@pytest.mark.parametrize("role,expected", [
    ("admin", 200),
    ("manager", 200),
    ("sales", 403),
    ("stock_keeper", 403),
    ("community_manager", 403),
])
def test_attendance_today_rbac(role, expected):
    tok, _ = _login(role)
    r = requests.get(f"{API}/attendance/today", headers=_hdr(tok), timeout=30)
    assert r.status_code == expected, f"{role}: expected {expected}, got {r.status_code} {r.text[:200]}"
