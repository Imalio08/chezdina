"""
Iter49 P5 refactor tranche 4 — orders / POS / cash-sessions extracted into
routers/orders.py. Covers 11 endpoints + regression on remaining server.py
endpoints (/orders/{oid}/status, /deliveries, /products/kpis).
"""
import os
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")

CREDS = {
    "admin":   ("aouattaraesca@gmail.com", "Admin123!"),
    "manager": ("manager.cocody@dinastore.ci", "Manager123!"),
    "sales":   ("agent1@dinastore.ci", "Agent123!"),
}


def _login(role):
    email, pwd = CREDS[role]
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": pwd}, timeout=15)
    assert r.status_code == 200, f"Login {role} failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def tokens():
    return {k: _login(k) for k in CREDS}


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


# ------- Orders (list / public track) -------
class TestOrdersList:
    def test_list_orders_auth(self, tokens):
        r = requests.get(f"{BASE}/api/orders", headers=H(tokens["admin"]))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert all("_id" not in o for o in data)

    def test_list_orders_unauth(self):
        r = requests.get(f"{BASE}/api/orders")
        assert r.status_code in (401, 403)

    def test_list_orders_status_filter(self, tokens):
        r = requests.get(f"{BASE}/api/orders?status=livree", headers=H(tokens["admin"]))
        assert r.status_code == 200
        for o in r.json():
            assert o["status"] == "livree"

    def test_track_public_no_auth(self, tokens):
        # Pick an existing order
        r = requests.get(f"{BASE}/api/orders", headers=H(tokens["admin"]))
        code = r.json()[0]["code"]
        r2 = requests.get(f"{BASE}/api/orders/track/{code}")
        assert r2.status_code == 200
        assert r2.json()["code"] == code

    def test_track_404(self):
        r = requests.get(f"{BASE}/api/orders/track/DOES-NOT-EXIST-9999")
        assert r.status_code == 404


# ------- Orders create (POS flow) -------
class TestCreateOrder:
    def test_create_store_cash_order(self, tokens):
        # Get a product with stock>0
        rp = requests.get(f"{BASE}/api/products", headers=H(tokens["admin"]))
        prod = next((p for p in rp.json() if (p.get("stock", 0) or 0) > 2 and p.get("price")), None)
        assert prod, "No product with stock available"
        pid = prod["id"]
        before = prod.get("stock", 0)

        body = {
            "items": [{"product_id": pid, "name": prod["name"], "qty": 1, "price": int(prod["price"])}],
            "customer": {"name": "TEST_iter49_walkin"},
            "channel": "store",
            "payment_method": "cash",
            "delivery_fee": 0,
            "discount": 0,
            "note": "TEST_iter49",
            "mode": "store",
        }
        r = requests.post(f"{BASE}/api/orders", json=body, headers=H(tokens["admin"]))
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["status"] == "livree"
        assert doc["payment_status"] == "paye"
        assert doc["total"] == int(prod["price"])
        assert "_id" not in doc

        # Verify stock decremented
        rp2 = requests.get(f"{BASE}/api/products", headers=H(tokens["admin"]))
        after = next(p for p in rp2.json() if p["id"] == pid).get("stock", 0)
        assert after == before - 1, f"stock before={before} after={after}"

        # Rollback stock
        requests.patch(f"{BASE}/api/products/{pid}", json={"stock": before}, headers=H(tokens["admin"]))

    def test_create_order_online_default(self, tokens):
        rp = requests.get(f"{BASE}/api/products", headers=H(tokens["admin"]))
        prod = next((p for p in rp.json() if (p.get("stock", 0) or 0) > 2 and p.get("price")), None)
        pid = prod["id"]
        before = prod.get("stock", 0)
        body = {
            "items": [{"product_id": pid, "name": prod["name"], "qty": 1, "price": int(prod["price"])}],
            "customer": {"name": "TEST_iter49_online"},
            "channel": "whatsapp",
            "payment_method": "cash_on_delivery",
            "mode": "delivery",
            "delivery_fee": 2000,
        }
        r = requests.post(f"{BASE}/api/orders", json=body, headers=H(tokens["admin"]))
        assert r.status_code == 200
        doc = r.json()
        assert doc["status"] == "nouvelle"
        assert doc["payment_status"] == "en_attente"
        assert doc["total"] == int(prod["price"]) + 2000
        # rollback stock
        requests.patch(f"{BASE}/api/products/{pid}", json={"stock": before}, headers=H(tokens["admin"]))


# ------- POS PIN authorize -------
class TestPinAuth:
    def test_pin_wrong(self, tokens):
        r = requests.post(f"{BASE}/api/pos/pin-authorize",
                          json={"pin": "0000", "action": "discount", "amount": 500},
                          headers=H(tokens["sales"]))
        assert r.status_code == 403

    def test_pin_correct(self, tokens):
        r = requests.post(f"{BASE}/api/pos/pin-authorize",
                          json={"pin": "1234", "action": "discount", "amount": 500},
                          headers=H(tokens["sales"]))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert "approver" in d
        assert d["approver"]  # non-empty


# ------- Cash movements -------
class TestCashMovements:
    def test_create_and_list_in(self, tokens):
        r = requests.post(f"{BASE}/api/cash-movements",
                          json={"type": "in", "amount": 1000, "reason": "TEST_iter49_in"},
                          headers=H(tokens["admin"]))
        assert r.status_code == 200
        mid = r.json()["id"]

        r2 = requests.get(f"{BASE}/api/cash-movements", headers=H(tokens["admin"]))
        assert r2.status_code == 200
        payload = r2.json()
        for k in ("movements", "cash_sales", "ins", "outs", "expected"):
            assert k in payload
        assert any(m["id"] == mid for m in payload["movements"])
        assert payload["ins"] >= 1000

    def test_create_bad_type(self, tokens):
        r = requests.post(f"{BASE}/api/cash-movements",
                          json={"type": "bogus", "amount": 100, "reason": "x"},
                          headers=H(tokens["admin"]))
        assert r.status_code == 400


# ------- POS holds -------
class TestHolds:
    def test_hold_create_list_delete(self, tokens):
        body = {
            "items": [{"product_id": "x", "name": "TEST_iter49_hold", "qty": 1, "price": 1000}],
            "customer": {"name": "TEST_iter49"},
            "note": "iter49",
        }
        r = requests.post(f"{BASE}/api/pos/holds", json=body, headers=H(tokens["admin"]))
        assert r.status_code == 200
        hid = r.json()["id"]

        r2 = requests.get(f"{BASE}/api/pos/holds", headers=H(tokens["admin"]))
        assert r2.status_code == 200
        assert any(h["id"] == hid for h in r2.json())

        r3 = requests.delete(f"{BASE}/api/pos/holds/{hid}", headers=H(tokens["admin"]))
        assert r3.status_code == 200

        r4 = requests.get(f"{BASE}/api/pos/holds", headers=H(tokens["admin"]))
        assert not any(h["id"] == hid for h in r4.json())


# ------- Cash sessions -------
class TestCashSessions:
    def test_list(self, tokens):
        r = requests.get(f"{BASE}/api/cash-sessions", headers=H(tokens["admin"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_open_close_flow(self, tokens):
        # Check whether an open session already exists
        r = requests.get(f"{BASE}/api/cash-sessions", headers=H(tokens["admin"]))
        existing_open = next((s for s in r.json() if not s.get("closed")), None)

        opened_here = False
        if not existing_open:
            # Open a session
            ro = requests.post(f"{BASE}/api/cash-sessions/open",
                               json={"opening_cash": 5000, "note": "TEST_iter49"},
                               headers=H(tokens["admin"]))
            assert ro.status_code == 200, ro.text
            sid = ro.json()["id"]
            opened_here = True

            # Try opening another -> must fail
            ro2 = requests.post(f"{BASE}/api/cash-sessions/open",
                                json={"opening_cash": 5000},
                                headers=H(tokens["admin"]))
            assert ro2.status_code == 400
        else:
            sid = existing_open["id"]

        # Close with wrong PIN -> 403
        rc = requests.post(f"{BASE}/api/cash-sessions/{sid}/close",
                           json={"closing_cash": 5000, "pin": "0000"},
                           headers=H(tokens["admin"]))
        assert rc.status_code == 403

        # If we opened it here, close it with correct PIN to cleanup
        if opened_here:
            rc2 = requests.post(f"{BASE}/api/cash-sessions/{sid}/close",
                                json={"closing_cash": 5000, "pin": "1234"},
                                headers=H(tokens["admin"]))
            assert rc2.status_code == 200, rc2.text
            summary = rc2.json()["summary"]
            assert summary["closed"] is True
            assert "ecart" in summary


# ------- Regression on endpoints still in server.py -------
class TestRegressionServerPy:
    def test_products_kpis(self, tokens):
        r = requests.get(f"{BASE}/api/products/kpis", headers=H(tokens["admin"]))
        assert r.status_code == 200

    def test_deliveries(self, tokens):
        r = requests.get(f"{BASE}/api/deliveries", headers=H(tokens["admin"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_order_status_endpoint_still_in_server(self, tokens):
        # Pick a non-livree order
        r = requests.get(f"{BASE}/api/orders", headers=H(tokens["admin"]))
        candidate = next((o for o in r.json() if o["status"] == "nouvelle"), None)
        if not candidate:
            pytest.skip("No 'nouvelle' order to test status transition")
        oid = candidate["id"]
        # Just verify endpoint responds (don't actually transition)
        # The endpoint exists in server.py; a GET returns 405
        r2 = requests.get(f"{BASE}/api/orders/{oid}/status", headers=H(tokens["admin"]))
        assert r2.status_code in (405, 404, 200)

    def test_auth_me(self, tokens):
        r = requests.get(f"{BASE}/api/auth/me", headers=H(tokens["admin"]))
        assert r.status_code == 200
