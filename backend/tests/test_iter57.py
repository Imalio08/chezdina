"""Iter57 P1+P2 tests — attendance check-in + simplified RBAC."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to local frontend .env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass


def _login(email, pwd):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pwd}, timeout=15)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def admin():
    return _login("aouattaraesca@gmail.com", "Admin123!")


@pytest.fixture(scope="module")
def manager():
    return _login("manager.cocody@dinastore.ci", "Manager123!")


# ---- Attendance check-in ----
def test_attendance_check_in_admin(admin):
    tiny = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A/9k="
    r = admin.post(f"{BASE_URL}/api/attendance/check-in",
                   json={"selfie": tiny, "kind": "arrival", "method": "phone"}, timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("ok") is True
    assert "late" in j
    assert "at" in j


def test_attendance_check_in_requires_selfie(admin):
    r = admin.post(f"{BASE_URL}/api/attendance/check-in",
                   json={"kind": "arrival", "method": "phone"}, timeout=15)
    assert r.status_code == 400


# ---- RBAC manager allowed/denied ----
@pytest.mark.parametrize("path", [
    "/api/cash-sessions",
    "/api/products",
])
def test_manager_allowed(manager, path):
    r = manager.get(f"{BASE_URL}{path}", timeout=15)
    assert r.status_code == 200, f"{path} -> {r.status_code}"


@pytest.mark.parametrize("path", [
    "/api/team",            # equipe
    "/api/users",           # equipe
])
def test_manager_denied_equipe(manager, path):
    r = manager.get(f"{BASE_URL}{path}", timeout=15)
    # should be 401/403
    assert r.status_code in (401, 403), f"{path} -> {r.status_code} (expected 403)"
