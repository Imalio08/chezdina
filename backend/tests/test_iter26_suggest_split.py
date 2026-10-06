"""Iter26: /api/deliveries/suggest-split + delivery-sessions basics."""
import os, requests, pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://dina-boutique.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

ADMIN = {"email": "aouattaraesca@gmail.com", "password": "Admin123!"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=20)
    assert r.status_code == 200, r.text
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def test_health(h):
    r = requests.get(f"{API}/orders", headers=h, timeout=20)
    assert r.status_code == 200


def test_suggest_split_defaults(h):
    """No body -> engine groups ready+confirmee unassigned orders by zone across active riders."""
    r = requests.post(f"{API}/deliveries/suggest-split", json={"order_ids": [], "rider_ids": []}, headers=h, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "suggestions" in data
    # If no active riders, must return explicit message
    if not data["suggestions"]:
        # Could legitimately be empty if no ready orders exist
        assert "unassigned" in data
    else:
        for s in data["suggestions"]:
            assert "rider_id" in s and "rider_name" in s
            assert "orders" in s and isinstance(s["orders"], list)
            assert "zones" in s and isinstance(s["zones"], list)
            assert "total_load" in s
    print(f"suggest-split returned {len(data['suggestions'])} proposals")


def test_suggest_split_no_active_riders(h):
    """Explicit rider_ids=[fake] -> no riders found -> message."""
    r = requests.post(f"{API}/deliveries/suggest-split",
                      json={"order_ids": [], "rider_ids": ["nope-no-rider-xyz"]},
                      headers=h, timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert data.get("suggestions") == []
    assert data.get("message") == "Aucun livreur actif"


def test_suggest_split_rbac():
    """Unauth -> 401/403."""
    r = requests.post(f"{API}/deliveries/suggest-split", json={}, timeout=15)
    assert r.status_code in (401, 403)


def test_delivery_sessions_list(h):
    r = requests.get(f"{API}/delivery-sessions", headers=h, timeout=20)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_create_delivery_session_and_cleanup(h):
    # Pick an active rider
    rs = requests.get(f"{API}/users", headers=h, timeout=15)
    assert rs.status_code == 200
    riders = [u for u in rs.json() if u.get("role") == "rider" and u.get("active", True)]
    if not riders:
        pytest.skip("no rider in system")
    rid = riders[0]["id"]
    # Create session
    from datetime import date
    body = {"date": date.today().isoformat(), "rider_id": rid, "rider_name": riders[0].get("name", "x")}
    r = requests.post(f"{API}/delivery-sessions", json=body, headers=h, timeout=20)
    assert r.status_code in (200, 201), r.text
    sid = r.json().get("id")
    assert sid
    # Verify shows up in list
    lst = requests.get(f"{API}/delivery-sessions", headers=h, timeout=15).json()
    assert any(s.get("id") == sid for s in lst)
    # Close it (cleanup / non-destructive)
    rc = requests.patch(f"{API}/delivery-sessions/{sid}/close", headers=h, timeout=15)
    assert rc.status_code == 200


def test_riders_locations(h):
    r = requests.get(f"{API}/riders/locations", headers=h, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
