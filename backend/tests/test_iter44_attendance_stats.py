"""Iteration 44: /api/attendance/all-stats + /api/business/attendance-config RBAC."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://dina-boutique.preview.emergentagent.com").rstrip("/")

CREDS = {
    "admin": ("aouattaraesca@gmail.com", "Admin123!"),
    "manager": ("manager.cocody@dinastore.ci", "Manager123!"),
    "sales": ("agent1@dinastore.ci", "Agent123!"),
    "cm": ("cm@dinastore.ci", "Cm123!"),
    "rider": ("rider1@dinastore.ci", "Rider123!"),
}


def _login(role):
    email, pwd = CREDS[role]
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pwd}, timeout=15)
    assert r.status_code == 200, f"login {role}: {r.status_code} {r.text}"
    token = r.json().get("access_token") or r.json().get("token")
    assert token
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def tokens():
    return {r: _login(r) for r in CREDS}


# --- /api/attendance/all-stats RBAC ---
@pytest.mark.parametrize("days", [7, 30, 90])
def test_all_stats_admin_ok(tokens, days):
    r = requests.get(f"{BASE_URL}/api/attendance/all-stats", params={"days": days}, headers=tokens["admin"], timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("period_days") == days
    assert "rows" in data and isinstance(data["rows"], list)
    if data["rows"]:
        row = data["rows"][0]
        for key in ["user_id", "name", "role", "worked_days", "absences", "late_count", "late_min_total", "avg_arrival", "punctuality_pct"]:
            assert key in row, f"missing {key} in row"


def test_all_stats_manager_ok(tokens):
    r = requests.get(f"{BASE_URL}/api/attendance/all-stats?days=30", headers=tokens["manager"], timeout=20)
    assert r.status_code == 200, r.text


@pytest.mark.parametrize("role", ["sales", "cm"])
def test_all_stats_forbidden(tokens, role):
    r = requests.get(f"{BASE_URL}/api/attendance/all-stats?days=30", headers=tokens[role], timeout=15)
    assert r.status_code == 403, f"{role} got {r.status_code}: {r.text[:200]}"


# --- /api/business/attendance-config RBAC ---
def test_attendance_config_admin_patch_and_persist(tokens):
    # get current config to restore later
    r0 = requests.get(f"{BASE_URL}/api/business", headers=tokens["admin"], timeout=15)
    assert r0.status_code == 200
    original_cfg = r0.json().get("attendance_config")

    payload = {"enabled": False, "enabled_roles": ["manager"]}
    r = requests.patch(f"{BASE_URL}/api/business/attendance-config", json=payload, headers=tokens["admin"], timeout=15)
    assert r.status_code == 200, r.text

    # Verify persistence via GET /api/business
    r2 = requests.get(f"{BASE_URL}/api/business", headers=tokens["admin"], timeout=15)
    assert r2.status_code == 200
    cfg = r2.json().get("attendance_config") or {}
    assert cfg.get("enabled") is False
    assert cfg.get("enabled_roles") == ["manager"]

    # Restore to enabled=True all roles for subsequent tests
    restore = original_cfg or {"enabled": True, "enabled_roles": ["manager", "sales", "stock_keeper", "community_manager", "rider"]}
    rr = requests.patch(f"{BASE_URL}/api/business/attendance-config", json=restore, headers=tokens["admin"], timeout=15)
    assert rr.status_code == 200


@pytest.mark.parametrize("role", ["manager", "sales"])
def test_attendance_config_forbidden(tokens, role):
    r = requests.patch(
        f"{BASE_URL}/api/business/attendance-config",
        json={"enabled": True, "enabled_roles": ["manager"]},
        headers=tokens[role],
        timeout=15,
    )
    assert r.status_code == 403, f"{role} got {r.status_code}"


# --- Regression: check-in without GPS ---
@pytest.mark.parametrize("role", ["admin", "manager", "sales", "rider"])
def test_checkin_no_gps(tokens, role):
    payload = {"kind": "arrival", "method": "phone", "selfie": "data:image/jpeg;base64,AAAA"}
    r = requests.post(f"{BASE_URL}/api/attendance/check-in", json=payload, headers=tokens[role], timeout=15)
    # 200 or 409 if already checked in today — both are acceptable (not GPS-blocked)
    assert r.status_code in (200, 409, 400), f"{role} got {r.status_code}: {r.text[:200]}"
    # Importantly, not 422 for missing GPS
    if r.status_code == 400:
        assert "gps" not in r.text.lower(), f"GPS required unexpectedly: {r.text}"
