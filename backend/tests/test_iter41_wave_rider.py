"""Iteration 41 — Wave webhook + Rider heading end-to-end tests."""
import os
import requests
import pytest

def _get_base_url():
    v = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if not v:
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.strip().startswith("REACT_APP_BACKEND_URL="):
                        v = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    return v.rstrip("/")

BASE_URL = _get_base_url()
assert BASE_URL, "REACT_APP_BACKEND_URL is required"

ADMIN_EMAIL = "aouattaraesca@gmail.com"
ADMIN_PASS = "Admin123!"
RIDER_EMAIL = "rider1@dinastore.ci"
RIDER_PASS = "Rider123!"
ORDER_CODE = "DN-260920-1032"


def _login(email, pwd):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pwd}, timeout=15)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="module")
def rider_token():
    return _login(RIDER_EMAIL, RIDER_PASS)


# ----------------------- Rider heading -----------------------
class TestRiderHeading:
    def test_rider_push_location_with_heading(self, rider_token, admin_token):
        # Ensure order is in en_livraison state (webhook test may have changed it on previous run)
        h_admin = {"Authorization": f"Bearer {admin_token}"}
        r0 = requests.get(f"{BASE_URL}/api/orders", headers=h_admin, timeout=15)
        order = next((o for o in r0.json() if o.get("code") == ORDER_CODE), None)
        assert order is not None, "live order not found"
        if order.get("status") != "en_livraison":
            # Transition via admin PATCH
            oid = order["id"]
            requests.patch(f"{BASE_URL}/api/orders/{oid}",
                           json={"status": "en_livraison"},
                           headers=h_admin, timeout=15)
        h = {"Authorization": f"Bearer {rider_token}"}
        payload = {"lat": 5.38, "lng": -3.99, "accuracy": 10, "heading": 45,
                   "speed": 4.5, "battery_level": 35, "battery_charging": False}
        r = requests.post(f"{BASE_URL}/api/riders/location", json=payload, headers=h, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True, data

    def test_public_rider_position_returns_heading(self):
        r = requests.get(f"{BASE_URL}/api/public/order/{ORDER_CODE}/rider-position", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        pos = data.get("position") or {}
        assert pos, f"empty position: {data}"
        assert pos.get("simulated") is False, pos
        assert pos.get("heading") == 45, pos
        assert pos.get("speed") == 4.5, pos


# ----------------------- Wave webhook -----------------------
class TestWaveWebhook:
    TX_ID = f"wave_tx_test_{int(__import__('time').time())}"

    def test_webhook_success(self, admin_token):
        payload = {
            "type": "checkout.session.completed",
            "data": {
                "client_reference": ORDER_CODE,
                "transaction_id": self.TX_ID,
                "amount": 50000,
                "status": "succeeded",
            },
        }
        r = requests.post(f"{BASE_URL}/api/public/wave/webhook", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True, data
        assert data.get("status") in ("confirmee", "payee"), data
        assert data.get("amount") == 50000, data

        # Verify persistence via admin GET /api/orders
        h = {"Authorization": f"Bearer {admin_token}"}
        r2 = requests.get(f"{BASE_URL}/api/orders", headers=h, timeout=15)
        assert r2.status_code == 200
        orders = r2.json()
        found = next((o for o in orders if o.get("code") == ORDER_CODE), None)
        assert found is not None, f"order {ORDER_CODE} not found in admin list"
        assert found.get("deposit_tx_ref") == self.TX_ID, found
        assert found.get("status") in ("confirmee", "payee"), found

    def test_webhook_idempotency(self):
        payload = {
            "type": "checkout.session.completed",
            "data": {
                "client_reference": ORDER_CODE,
                "transaction_id": self.TX_ID,
                "amount": 50000,
                "status": "succeeded",
            },
        }
        r = requests.post(f"{BASE_URL}/api/public/wave/webhook", json=payload, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True and data.get("already_processed") is True, data

    def test_webhook_missing_ref(self):
        payload = {"type": "checkout.session.completed",
                   "data": {"transaction_id": "x", "amount": 10, "status": "succeeded"}}
        r = requests.post(f"{BASE_URL}/api/public/wave/webhook", json=payload, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is False
        assert "client_reference" in (data.get("error") or "")

    def test_webhook_unknown_order(self):
        payload = {"type": "checkout.session.completed",
                   "data": {"client_reference": "DN-DOESNOTEXIST", "transaction_id": "x",
                            "amount": 10, "status": "succeeded"}}
        r = requests.post(f"{BASE_URL}/api/public/wave/webhook", json=payload, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is False
        assert "not found" in (data.get("error") or "")


# ----------------------- Rider heading (duplicate removed) -----------------------
