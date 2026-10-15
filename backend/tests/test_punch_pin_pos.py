# Iteration 79: Attendance check-in PIN validation (bug 13) for all roles
import os
import base64
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")

USERS = [
    ("aouattaraesca@gmail.com", "Admin123!", "1234"),
    ("manager.cocody@dinastore.ci", "Manager123!", "2222"),
    ("agent1@dinastore.ci", "Agent123!", "3333"),
    ("stock@dinastore.ci", "Stock123!", "4444"),
]
SELFIE = "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8" + b"x" * 1500).decode()


def login(email, pw):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers["Authorization"] = f"Bearer {tok}"
    return s


@pytest.mark.parametrize("email,pw,pin", USERS)
class TestPunchPin:
    # wrong PIN rejected, nothing recorded; correct PIN arrival + departure accepted
    def test_wrong_then_right_pin(self, email, pw, pin):
        s = login(email, pw)
        before = s.get(f"{BASE_URL}/api/attendance/me").json()
        assert not before["checked_in"], f"pre-existing arrival for {email}"
        bad = s.post(f"{BASE_URL}/api/attendance/check-in", json={"kind": "arrival", "selfie": SELFIE, "pin": "9999"})
        assert bad.status_code == 401
        assert "PIN incorrect" in bad.json()["detail"]
        assert s.get(f"{BASE_URL}/api/attendance/me").json()["checked_in"] is False
        ok = s.post(f"{BASE_URL}/api/attendance/check-in", json={"kind": "arrival", "selfie": SELFIE, "pin": pin})
        assert ok.status_code == 200, ok.text
        assert ok.json()["ok"] is True
        me = s.get(f"{BASE_URL}/api/attendance/me").json()
        assert me["checked_in"] is True and me["departure"] is None
        bad2 = s.post(f"{BASE_URL}/api/attendance/check-in", json={"kind": "departure", "selfie": SELFIE, "pin": "0000"})
        assert bad2.status_code == 401
        assert s.get(f"{BASE_URL}/api/attendance/me").json()["departure"] is None
        dep = s.post(f"{BASE_URL}/api/attendance/check-in", json={"kind": "departure", "selfie": SELFIE, "pin": pin})
        assert dep.status_code == 200, dep.text
        assert s.get(f"{BASE_URL}/api/attendance/me").json()["departure"] is not None


def test_selfie_required():
    s = login("agent1@dinastore.ci", "Agent123!")
    r = s.post(f"{BASE_URL}/api/attendance/check-in", json={"kind": "arrival", "selfie": "", "pin": "3333"})
    assert r.status_code == 400
