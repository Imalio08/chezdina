# Rider nav refactor (iteration 82): score trend, today summary, store conversation, manual addendum
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


def _login(email, pw):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    if r.status_code != 200:
        pytest.skip(f"login failed {email}: {r.status_code} {r.text[:200]}")
    d = r.json()
    tok = d.get("token") or d.get("access_token")
    if tok:
        s.headers["Authorization"] = f"Bearer {tok}"
    return s, d.get("user") or d


@pytest.fixture(scope="module")
def rider():
    return _login("rider1@dinastore.ci", "Rider123!")


@pytest.fixture(scope="module")
def admin():
    return _login("aouattaraesca@gmail.com", "Admin123!")


# Score includes integer trend
def test_score_trend(rider):
    s, u = rider
    r = s.get(f"{BASE_URL}/api/riders/{u['id']}/score")
    assert r.status_code == 200, r.text
    d = r.json()
    assert isinstance(d.get("trend"), int), d
    assert isinstance(d.get("score"), int)
    assert 0 <= d["score"] <= 100
    assert "level" in d and "stats" in d


# Today summary used by Profil card / Solde
def test_today(rider):
    s, _ = rider
    r = s.get(f"{BASE_URL}/api/riders/me/today")
    assert r.status_code == 200
    d = r.json()
    assert "counts" in d and "collected" in d
    assert "balance_to_hand_over" in d


def test_history_30(rider):
    s, _ = rider
    r = s.get(f"{BASE_URL}/api/riders/me/history?days=30")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_reviews(rider):
    s, u = rider
    r = s.get(f"{BASE_URL}/api/riders/{u['id']}/reviews")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# Store conversation (idempotent) + conversation list
def test_store_conversation(rider):
    s, _ = rider
    r1 = s.post(f"{BASE_URL}/api/rider/conversations/store")
    assert r1.status_code == 200, r1.text
    r2 = s.post(f"{BASE_URL}/api/rider/conversations/store")
    assert r1.json()["id"] == r2.json()["id"]
    lst = s.get(f"{BASE_URL}/api/rider/conversations")
    assert lst.status_code == 200
    assert any(c.get("id") == r1.json()["id"] for c in lst.json())


def test_attendance_me(rider):
    s, _ = rider
    r = s.get(f"{BASE_URL}/api/attendance/me")
    assert r.status_code == 200


# Manual addendum
def test_manual_rider_nav(admin):
    s, _ = admin
    r = s.get(f"{BASE_URL}/api/manual/modules")
    assert r.status_code == 200
    import json
    blob = json.dumps(r.json(), ensure_ascii=False)
    found = "add-rider-nav" in blob or "Navigation : 4 onglets et le Profil" in blob
    if not found:
        # look in individual modules
        for m in r.json():
            n = m.get("number")
            mm = s.get(f"{BASE_URL}/api/manual/modules/{n}")
            if "Navigation : 4 onglets et le Profil" in mm.text:
                found = True
                break
    assert found
