"""Regression smoke test after code-cleanup edits in server.py."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://dina-boutique.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "aouattaraesca@gmail.com"
ADMIN_PASS = "Admin123!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"No token in {data}"
    return tok


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.parametrize("endpoint", [
    "/api/orders",
    "/api/products",
    "/api/customers",
    "/api/dashboard/action-items",
    "/api/attendance/today-kiosk",
    "/api/purchase-orders",
    "/api/stats/sales?period=30d",
    "/api/stats/orders-delivery?period=30d",
    "/api/analytics/funnel?days=7",
])
def test_endpoint_200(headers, endpoint):
    r = requests.get(f"{BASE_URL}{endpoint}", headers=headers, timeout=30)
    assert r.status_code == 200, f"{endpoint} -> {r.status_code}: {r.text[:300]}"
    # JSON validity
    r.json()


def test_rider_score(headers):
    r = requests.get(f"{BASE_URL}/api/users?role=rider", headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    riders = r.json()
    assert isinstance(riders, list) and len(riders) > 0, "No riders found"
    rid = riders[0].get("id") or riders[0].get("_id")
    assert rid, f"Rider has no id: {riders[0]}"
    r2 = requests.get(f"{BASE_URL}/api/riders/{rid}/score", headers=headers, timeout=30)
    assert r2.status_code == 200, f"rider score -> {r2.status_code}: {r2.text[:300]}"
    data = r2.json()
    assert "score" in data, f"No score field: {data}"
    assert isinstance(data["score"], (int, float)), f"score not numeric: {data['score']}"


def test_public_rider_position_live_order():
    r = requests.get(f"{BASE_URL}/api/public/order/DN-260920-1032/rider-position", timeout=30)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
    data = r.json()
    assert data.get("active") is True, f"Expected active=True, got {data}"
    assert "position" in data, f"No position in response: {data}"
    pos = data["position"]
    assert pos is not None, f"position is None: {data}"
