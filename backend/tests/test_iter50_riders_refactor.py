"""Iter 50 — P5 tranche 5: Riders/Deliveries/Sessions/GPS router extraction.

Covers all 15 endpoints in routers/riders.py + RBAC + regression smoke.
"""
import os
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")

ADMIN = {"email": "aouattaraesca@gmail.com", "password": "Admin123!", "pin": "1234"}
MANAGER = {"email": "manager.cocody@dinastore.ci", "password": "Manager123!", "pin": "2222"}
SALES = {"email": "agent1@dinastore.ci", "password": "Agent123!"}
RIDER1 = {"email": "rider1@dinastore.ci", "password": "Rider123!"}
RIDER2 = {"email": "rider2@dinastore.ci", "password": "Rider123!"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{BASE}/api/auth/login", json={"email": creds["email"], "password": creds["password"]}, timeout=20)
    assert r.status_code == 200, f"login {creds['email']}: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers["Authorization"] = f"Bearer {tok}"
    return s, r.json()


@pytest.fixture(scope="module")
def admin():
    s, me = _login(ADMIN)
    me2 = s.get(f"{BASE}/api/auth/me").json()
    return s, me2


@pytest.fixture(scope="module")
def manager():
    s, _ = _login(MANAGER)
    return s


@pytest.fixture(scope="module")
def sales():
    s, _ = _login(SALES)
    return s


@pytest.fixture(scope="module")
def rider1():
    s, _ = _login(RIDER1)
    me = s.get(f"{BASE}/api/auth/me").json()
    return s, me


@pytest.fixture(scope="module")
def rider2():
    s, _ = _login(RIDER2)
    me = s.get(f"{BASE}/api/auth/me").json()
    return s, me


# ---------------- GPS ----------------
class TestGPS:
    def test_rider_position_rider_only(self, rider1, sales):
        s_r, _ = rider1
        r = s_r.post(f"{BASE}/api/rider/position", json={"lat": 5.35, "lng": -4.01, "heading": 90, "speed": 20})
        assert r.status_code == 200
        assert r.json().get("ok") is True
        # Sales (non-rider) blocked
        r2 = sales.post(f"{BASE}/api/rider/position", json={"lat": 5.35, "lng": -4.01})
        assert r2.status_code == 403

    def test_rider_position_bad_body(self, rider1):
        s_r, _ = rider1
        r = s_r.post(f"{BASE}/api/rider/position", json={})
        assert r.status_code == 400

    def test_riders_location_push(self, rider1):
        s_r, _ = rider1
        r = s_r.post(f"{BASE}/api/riders/location", json={"lat": 5.36, "lng": -4.02, "accuracy": 10, "battery_level": 85, "battery_charging": False})
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    def test_riders_locations_list_filtered(self, admin, rider1):
        s_r, me_r = rider1
        # Fresh push first
        s_r.post(f"{BASE}/api/riders/location", json={"lat": 5.36, "lng": -4.02})
        s_adm, _ = admin
        r = s_adm.get(f"{BASE}/api/riders/locations")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        # rider1 should be present (fresh)
        rids = [row.get("rider_id") for row in rows]
        assert me_r["id"] in rids


# ---------------- Scoring ----------------
class TestScoringKPIs:
    def test_rider_score(self, admin, rider1):
        s_adm, _ = admin
        _, me_r = rider1
        r = s_adm.get(f"{BASE}/api/riders/{me_r['id']}/score")
        assert r.status_code == 200
        data = r.json()
        for k in ("score", "level", "weights", "components", "stats"):
            assert k in data, f"missing {k}"
        assert data["level"] in ("Excellence", "Or", "Argent", "Bronze")
        assert set(data["components"].keys()) >= {"delivery_rate", "punctuality", "rating", "cash", "proof"}

    def test_rider_reviews(self, admin, rider1):
        s_adm, _ = admin
        _, me_r = rider1
        r = s_adm.get(f"{BASE}/api/riders/{me_r['id']}/reviews")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_rider_kpis(self, admin, rider1):
        s_adm, _ = admin
        _, me_r = rider1
        r = s_adm.get(f"{BASE}/api/riders/{me_r['id']}/kpis")
        assert r.status_code == 200
        d = r.json()
        for k in ("total", "delivered", "failed", "delivery_rate", "cancel_rate", "satisfaction"):
            assert k in d


# ---------------- Rider self-service ----------------
class TestRiderSelf:
    def test_me_today(self, rider1):
        s_r, _ = rider1
        r = s_r.get(f"{BASE}/api/riders/me/today")
        assert r.status_code == 200
        d = r.json()
        for k in ("orders", "counts", "to_collect", "collected", "balance_to_hand_over"):
            assert k in d
        assert set(d["counts"].keys()) >= {"a_livrer", "en_route", "livrees", "annulees", "reportees", "echecs"}

    def test_me_history(self, rider1):
        s_r, _ = rider1
        r = s_r.get(f"{BASE}/api/riders/me/history?days=30")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------------- Deliveries ----------------
class TestDeliveries:
    def test_deliveries_admin_full(self, admin):
        s_adm, _ = admin
        r = s_adm.get(f"{BASE}/api/deliveries")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list) and len(rows) > 0

    def test_deliveries_rider_scoped(self, rider1):
        s_r, me_r = rider1
        r = s_r.get(f"{BASE}/api/deliveries")
        assert r.status_code == 200
        rows = r.json()
        # All rows should have rider_id == me (if any)
        for row in rows:
            assert row.get("rider_id") == me_r["id"]

    def test_assign_rbac_sales_blocked(self, sales, admin):
        s_adm, _ = admin
        # pick any delivery order
        rows = s_adm.get(f"{BASE}/api/deliveries").json()
        if not rows:
            pytest.skip("No deliveries available")
        oid = rows[0]["id"]
        r = sales.patch(f"{BASE}/api/deliveries/{oid}/assign", json={"rider_id": "x", "rider_name": "x"})
        assert r.status_code == 403

    def test_assign_admin_ok(self, admin, rider2):
        s_adm, _ = admin
        _, me_r2 = rider2
        rows = s_adm.get(f"{BASE}/api/deliveries").json()
        if not rows:
            pytest.skip("No deliveries available")
        # pick an unassigned-ish or any order (we'll just re-assign)
        oid = rows[0]["id"]
        prev_rid = rows[0].get("rider_id")
        prev_rname = rows[0].get("rider_name") or "x"
        r = s_adm.patch(f"{BASE}/api/deliveries/{oid}/assign", json={"rider_id": me_r2["id"], "rider_name": me_r2.get("name") or "Rider 2"})
        assert r.status_code == 200
        # restore if there was a previous rider
        if prev_rid:
            s_adm.patch(f"{BASE}/api/deliveries/{oid}/assign", json={"rider_id": prev_rid, "rider_name": prev_rname})

    def test_suggest_split_rbac(self, sales, admin, manager):
        r = sales.post(f"{BASE}/api/deliveries/suggest-split", json={})
        assert r.status_code == 403
        s_adm, _ = admin
        r2 = s_adm.post(f"{BASE}/api/deliveries/suggest-split", json={})
        assert r2.status_code == 200
        d = r2.json()
        assert "suggestions" in d
        r3 = manager.post(f"{BASE}/api/deliveries/suggest-split", json={})
        assert r3.status_code == 200


# ---------------- Delivery sessions ----------------
class TestSessions:
    _sid = None

    def test_create_session_admin(self, admin, rider1):
        s_adm, _ = admin
        _, me_r = rider1
        r = s_adm.post(f"{BASE}/api/delivery-sessions", json={"rider_id": me_r["id"], "rider_name": me_r.get("name") or "Rider 1"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("rider_id") == me_r["id"]
        assert "id" in d
        TestSessions._sid = d["id"]

    def test_create_session_sales_blocked(self, sales, rider1):
        _, me_r = rider1
        r = sales.post(f"{BASE}/api/delivery-sessions", json={"rider_id": me_r["id"], "rider_name": "x"})
        assert r.status_code == 403

    def test_list_sessions(self, admin, rider1):
        s_adm, _ = admin
        _, me_r = rider1
        r = s_adm.get(f"{BASE}/api/delivery-sessions", params={"rider_id": me_r["id"]})
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        if rows:
            s = rows[0]
            for k in ("orders_detail", "total_to_collect", "prepaid_count", "delivered_count", "cancelled_count", "collected_total"):
                assert k in s

    def test_add_order_to_session(self, admin, rider1):
        s_adm, _ = admin
        _, me_r = rider1
        assert TestSessions._sid, "no session id"
        # pick a delivery order
        orders = s_adm.get(f"{BASE}/api/deliveries").json()
        if not orders:
            pytest.skip("No orders")
        oid = orders[0]["id"]
        r = s_adm.patch(f"{BASE}/api/delivery-sessions/{TestSessions._sid}/add-order", json={"order_id": oid})
        assert r.status_code == 200
        TestSessions._added_oid = oid

    def test_reconcile_requires_pin_for_collected(self, admin):
        s_adm, _ = admin
        sid = TestSessions._sid
        oid = getattr(TestSessions, "_added_oid", None)
        if not sid or not oid:
            pytest.skip("prereq missing")
        # No PIN → 400
        r = s_adm.patch(f"{BASE}/api/delivery-sessions/{sid}/reconcile", json={"order_id": oid, "collected": True})
        assert r.status_code == 400
        # Bad PIN → 403
        r2 = s_adm.patch(f"{BASE}/api/delivery-sessions/{sid}/reconcile", json={"order_id": oid, "collected": True, "pin": "0000"})
        assert r2.status_code == 403
        # Valid PIN → 200
        r3 = s_adm.patch(f"{BASE}/api/delivery-sessions/{sid}/reconcile", json={"order_id": oid, "collected": True, "pin": ADMIN["pin"], "amount": 1000})
        assert r3.status_code == 200, r3.text
        rec = r3.json().get("reconciliation") or {}
        assert rec.get("collected") is True
        assert rec.get("approved_by")

    def test_reconcile_not_collected_no_pin(self, admin):
        s_adm, _ = admin
        sid = TestSessions._sid
        oid = getattr(TestSessions, "_added_oid", None)
        if not sid or not oid:
            pytest.skip("prereq missing")
        r = s_adm.patch(f"{BASE}/api/delivery-sessions/{sid}/reconcile", json={"order_id": oid, "collected": False})
        assert r.status_code == 200

    def test_close_session(self, admin):
        s_adm, _ = admin
        sid = TestSessions._sid
        if not sid:
            pytest.skip("no sid")
        r = s_adm.patch(f"{BASE}/api/delivery-sessions/{sid}/close")
        assert r.status_code == 200


# ---------------- Regression smoke ----------------
class TestRegression:
    def test_auth_me(self, admin):
        s_adm, _ = admin
        r = s_adm.get(f"{BASE}/api/auth/me")
        assert r.status_code == 200

    def test_attendance_me(self, admin):
        s_adm, _ = admin
        r = s_adm.get(f"{BASE}/api/attendance/me")
        assert r.status_code == 200

    def test_products(self, admin):
        s_adm, _ = admin
        r = s_adm.get(f"{BASE}/api/products")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_orders(self, admin):
        s_adm, _ = admin
        r = s_adm.get(f"{BASE}/api/orders")
        assert r.status_code == 200

    def test_cash_sessions(self, admin):
        s_adm, _ = admin
        r = s_adm.get(f"{BASE}/api/cash-sessions")
        assert r.status_code in (200, 404)  # some impls 404 if no session

    def test_pos_holds(self, admin):
        s_adm, _ = admin
        r = s_adm.get(f"{BASE}/api/pos/holds")
        assert r.status_code == 200

    def test_pos_pin_authorize(self, admin):
        s_adm, _ = admin
        r = s_adm.post(f"{BASE}/api/pos/pin-authorize", json={"pin": ADMIN["pin"], "action": "test"})
        assert r.status_code in (200, 400, 403)
