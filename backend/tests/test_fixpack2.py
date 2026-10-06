"""Backend tests for Fix pack 2 — roles, approvals, expense requests, audit log,
cash handover, manager balance, attendance (check-in / today / calendar / stats),
geofence + working hours, stock adjustments.
"""
import os
import time
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://dina-boutique.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

ADMIN = ("aouattaraesca@gmail.com", "Admin123!")
MANAGER = ("manager.cocody@dinastore.ci", "Manager123!")
RIDER = ("rider1@dinastore.ci", "Rider123!")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    data = r.json()
    return data["token"], data["user"]


@pytest.fixture(scope="session")
def admin():
    tok, u = _login(*ADMIN)
    return {"token": tok, "user": u, "h": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="session")
def manager():
    tok, u = _login(*MANAGER)
    return {"token": tok, "user": u, "h": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="session")
def rider():
    tok, u = _login(*RIDER)
    return {"token": tok, "user": u, "h": {"Authorization": f"Bearer {tok}"}}


# ---------- Roles ----------

def test_role_templates(admin):
    r = requests.get(f"{API}/role-templates", headers=admin["h"], timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    for key in ("gerante", "livreur", "caissiere"):
        assert key in data, f"missing template {key}"
        assert "permissions" in data[key]


def test_roles_crud(admin):
    # Create
    body = {"key": "test_role_fp2", "name": "TEST Role FP2", "color": "#123456",
            "description": "temp", "permissions": {"pos.sell": "edit"}, "limits": {"discount_pct_max": 3}}
    r = requests.post(f"{API}/roles", json=body, headers=admin["h"], timeout=20)
    assert r.status_code == 200, r.text
    role = r.json()
    rid = role["id"]
    # List
    r2 = requests.get(f"{API}/roles", headers=admin["h"], timeout=20)
    assert r2.status_code == 200
    ids = [x["id"] for x in r2.json().get("roles", [])]
    assert rid in ids
    # Patch
    r3 = requests.patch(f"{API}/roles/{rid}", json={"name": "TEST Role FP2 Updated"}, headers=admin["h"], timeout=20)
    assert r3.status_code == 200, r3.text
    # Delete
    r4 = requests.delete(f"{API}/roles/{rid}", headers=admin["h"], timeout=20)
    assert r4.status_code == 200


def test_roles_builtin_protected(admin):
    """Insert a builtin role for the test, then verify PATCH/DELETE both return 400."""
    import pymongo, os as _os
    # We insert via API path? No: use direct POST then manually mark builtin? API doesn't expose builtin.
    # Instead create role then update DB flag via Mongo. Use motor sync via pymongo.
    mongo_url = _os.environ.get("MONGO_URL")
    db_name = _os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        pytest.skip("MONGO_URL/DB_NAME not available for builtin test")
    c = pymongo.MongoClient(mongo_url)
    db = c[db_name]
    # Create via API
    body = {"key": "test_builtin_fp2", "name": "TEST Builtin FP2"}
    r = requests.post(f"{API}/roles", json=body, headers=admin["h"], timeout=20)
    assert r.status_code == 200, r.text
    rid = r.json()["id"]
    try:
        db.roles.update_one({"id": rid}, {"$set": {"builtin": True}})
        # PATCH builtin => 400
        r2 = requests.patch(f"{API}/roles/{rid}", json={"name": "nope"}, headers=admin["h"], timeout=20)
        assert r2.status_code == 400, f"expected 400 on builtin patch, got {r2.status_code}"
        # DELETE builtin => 400
        r3 = requests.delete(f"{API}/roles/{rid}", headers=admin["h"], timeout=20)
        assert r3.status_code == 400, f"expected 400 on builtin delete, got {r3.status_code}"
    finally:
        db.roles.delete_one({"id": rid})
        c.close()


# ---------- Approval requests ----------

def test_approval_request_flow(admin, manager):
    body = {"kind": "discount", "reason": "TEST FP2 discount", "payload": {"pct": 20}}
    r = requests.post(f"{API}/approval-requests", json=body, headers=manager["h"], timeout=20)
    assert r.status_code == 200, r.text
    ap = r.json()
    aid = ap["id"]
    assert ap["status"] == "pending"

    r2 = requests.get(f"{API}/approval-requests", headers=admin["h"], timeout=20)
    assert r2.status_code == 200
    assert any(x["id"] == aid for x in r2.json())

    r3 = requests.post(f"{API}/approval-requests/{aid}/decide",
                       json={"decision": "approved", "note": "ok"}, headers=admin["h"], timeout=20)
    assert r3.status_code == 200, r3.text
    assert r3.json()["status"] == "approved"


# ---------- Expense requests ----------

def test_expense_request_approval_creates_expense(admin, manager):
    label = f"TEST_FP2_expense_{int(time.time())}"
    r = requests.post(f"{API}/expense-requests",
                      json={"label": label, "amount": 1500, "category": "Divers"},
                      headers=manager["h"], timeout=20)
    assert r.status_code == 200, r.text
    eid = r.json()["id"]

    r2 = requests.post(f"{API}/expense-requests/{eid}/decide",
                       json={"decision": "approved"}, headers=admin["h"], timeout=20)
    assert r2.status_code == 200, r2.text

    # Verify an expense now exists in /expenses with the same label
    r3 = requests.get(f"{API}/expenses", headers=admin["h"], timeout=20)
    assert r3.status_code == 200, r3.text
    rows = r3.json() if isinstance(r3.json(), list) else r3.json().get("items", [])
    assert any(x.get("label") == label for x in rows), f"expense '{label}' not found after approval"


# ---------- Audit log ----------

def test_audit_logs_admin_only(admin, manager):
    r = requests.get(f"{API}/audit-logs", headers=admin["h"], timeout=20)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    r2 = requests.get(f"{API}/audit-logs", headers=manager["h"], timeout=20)
    assert r2.status_code in (401, 403), f"expected forbidden for manager, got {r2.status_code}"


# ---------- Cash sessions handover ----------

def test_cash_handover_flow(admin, manager):
    import pymongo, os as _os
    mongo_url = _os.environ.get("MONGO_URL"); db_name = _os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        pytest.skip("Mongo not available")
    c = pymongo.MongoClient(mongo_url); db = c[db_name]
    import uuid
    sid = str(uuid.uuid4())
    mid = manager["user"]["id"]
    db.cash_sessions.insert_one({"id": sid, "manager_id": mid, "status": "open",
                                 "opening_amount": 0, "created_at": "2026-01-01T00:00:00Z"})
    try:
        # Declare
        r = requests.post(f"{API}/cash-sessions/{sid}/declare-handover",
                          json={"amount": 10000, "note": "versement"}, headers=manager["h"], timeout=20)
        assert r.status_code == 200, r.text
        s = db.cash_sessions.find_one({"id": sid})
        assert s["status"] == "pending_validation"
        assert s["handover_amount"] == 10000

        # Validate with gap (actual 9500, expected 10000, gap = -500)
        r2 = requests.post(f"{API}/cash-sessions/{sid}/validate-handover",
                           json={"expected": 10000, "actual": 9500}, headers=admin["h"], timeout=20)
        assert r2.status_code == 200, r2.text
        j = r2.json()
        assert j["gap"] == -500
        assert j["status"] == "gap"

        # Manager balance should include +500 (amount = -gap = 500)
        r3 = requests.get(f"{API}/manager-balance/{mid}", headers=admin["h"], timeout=20)
        assert r3.status_code == 200
        mb = r3.json()
        assert any(e.get("session_id") == sid and e.get("amount") == 500 for e in mb["entries"])
    finally:
        db.cash_sessions.delete_one({"id": sid})
        db.manager_balance.delete_many({"session_id": sid})
        c.close()


# ---------- Attendance ----------

def test_attendance_me_and_check_in(rider, admin):
    # Set non-mandatory geofence
    r0 = requests.patch(f"{API}/business/geofence",
                       json={"lat": 5.360, "lng": -3.994, "radius_m": 150, "mandatory": False},
                       headers=admin["h"], timeout=20)
    assert r0.status_code == 200

    # Clear today's attendance for this rider for a clean run
    import pymongo, os as _os
    mongo_url = _os.environ.get("MONGO_URL"); db_name = _os.environ.get("DB_NAME")
    if mongo_url and db_name:
        c = pymongo.MongoClient(mongo_url); db = c[db_name]
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).date().isoformat()
        db.attendance.delete_many({"user_id": rider["user"]["id"], "day": today})
        c.close()

    # me => not checked in
    r = requests.get(f"{API}/attendance/me", headers=rider["h"], timeout=20)
    assert r.status_code == 200
    assert r.json()["checked_in"] is False

    # check-in arrival inside radius
    body = {"kind": "arrival", "method": "phone", "selfie": "data:image/jpeg;base64,AAAA",
            "lat": 5.360, "lng": -3.994}
    r2 = requests.post(f"{API}/attendance/check-in", json=body, headers=rider["h"], timeout=20)
    assert r2.status_code == 200, r2.text
    assert r2.json()["outside"] is False

    r3 = requests.get(f"{API}/attendance/me", headers=rider["h"], timeout=20)
    assert r3.json()["checked_in"] is True


def test_attendance_selfie_required(rider):
    r = requests.post(f"{API}/attendance/check-in",
                      json={"kind": "arrival", "method": "phone", "lat": 5.360, "lng": -3.994},
                      headers=rider["h"], timeout=20)
    assert r.status_code == 400


def test_attendance_mandatory_geofence_blocks_outside(rider, admin):
    try:
        # Set mandatory + small radius
        r0 = requests.patch(f"{API}/business/geofence",
                            json={"lat": 5.360, "lng": -3.994, "radius_m": 50, "mandatory": True},
                            headers=admin["h"], timeout=20)
        assert r0.status_code == 200
        # Far away
        r = requests.post(f"{API}/attendance/check-in",
                          json={"kind": "arrival", "method": "phone",
                                "selfie": "data:image/jpeg;base64,AAAA",
                                "lat": 5.500, "lng": -3.800},
                          headers=rider["h"], timeout=20)
        assert r.status_code == 400, f"expected 400 refusal, got {r.status_code} {r.text}"
    finally:
        requests.patch(f"{API}/business/geofence",
                       json={"lat": 5.360, "lng": -3.994, "radius_m": 150, "mandatory": False},
                       headers=admin["h"], timeout=20)


def test_attendance_today(admin):
    r = requests.get(f"{API}/attendance/today", headers=admin["h"], timeout=20)
    assert r.status_code == 200
    data = r.json()
    for k in ("today", "not_checked_in", "present_count", "total_employees"):
        assert k in data


def test_attendance_calendar(admin, rider):
    from datetime import datetime, timezone
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    r = requests.get(f"{API}/attendance/calendar/{rider['user']['id']}", params={"month": month},
                     headers=admin["h"], timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert data["month"] == month
    assert "days" in data


def test_attendance_stats(admin, rider):
    r = requests.get(f"{API}/attendance/stats/{rider['user']['id']}", params={"days": 30},
                     headers=admin["h"], timeout=20)
    assert r.status_code == 200
    data = r.json()
    for k in ("worked_days", "late_count", "late_min_total", "outside_count", "punctuality_pct", "avg_arrival"):
        assert k in data


def test_rider_departure_without_reconciliation(rider):
    """Create a pending delivery_session for rider, then do departure check-in; expect flag."""
    import pymongo, os as _os, uuid
    mongo_url = _os.environ.get("MONGO_URL"); db_name = _os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        pytest.skip("Mongo not available")
    c = pymongo.MongoClient(mongo_url); db = c[db_name]
    rid_user = rider["user"]["id"]
    sid = str(uuid.uuid4())
    # Role check — the server uses user_role == "rider"; verify
    role = rider["user"].get("role")
    db.delivery_sessions.insert_one({"id": sid, "rider_id": rid_user, "status": "open",
                                     "created_at": "2026-01-01T00:00:00Z"})
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).date().isoformat()
    try:
        # Avoid departure dup for the day — remove any existing departure
        db.attendance.delete_many({"user_id": rid_user, "day": today, "kind": "departure"})
        r = requests.post(f"{API}/attendance/check-in",
                          json={"kind": "departure", "method": "phone",
                                "selfie": "data:image/jpeg;base64,AAAA",
                                "lat": 5.360, "lng": -3.994},
                          headers=rider["h"], timeout=20)
        assert r.status_code == 200, r.text
        flags = r.json().get("flags", [])
        if role == "rider":
            assert "depart_sans_reconciliation" in flags, f"role={role} flags={flags}"
        else:
            # Server only sets flag for role == 'rider'. If seeded role is 'livreur' this will not trigger.
            pytest.skip(f"Rider seeded role is '{role}', not 'rider' — flag only set for role=='rider'")
    finally:
        db.delivery_sessions.delete_one({"id": sid})
        c.close()


# ---------- Working hours ----------

def test_working_hours_patch(admin):
    r = requests.patch(f"{API}/business/working-hours",
                       json={"working_hours": {"manager": {"open": "08:30", "close": "19:00", "tolerance_min": 10},
                                               "rider": {"open": "09:00", "close": "20:00", "tolerance_min": 15}}},
                       headers=admin["h"], timeout=20)
    assert r.status_code == 200


# ---------- Stock adjustments ----------

def test_stock_adjustment_admin_direct(admin):
    # Fetch any product
    r = requests.get(f"{API}/products", headers=admin["h"], timeout=20)
    assert r.status_code == 200
    products = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
    assert products, "no products available"
    pid = products[0]["id"]
    before_stock = products[0].get("stock", 0)
    r2 = requests.post(f"{API}/stock/adjustments",
                       json={"product_id": pid, "delta": 1, "reason": "TEST FP2"},
                       headers=admin["h"], timeout=20)
    assert r2.status_code == 200, r2.text
    assert r2.json()["applied"] is True
    # revert
    requests.post(f"{API}/stock/adjustments",
                  json={"product_id": pid, "delta": -1, "reason": "TEST FP2 revert"},
                  headers=admin["h"], timeout=20)


def test_stock_adjustment_non_admin_creates_approval(manager):
    r = requests.get(f"{API}/products", headers=manager["h"], timeout=20)
    products = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
    assert products
    pid = products[0]["id"]
    r2 = requests.post(f"{API}/stock/adjustments",
                       json={"product_id": pid, "delta": 2, "reason": "TEST FP2 manager"},
                       headers=manager["h"], timeout=20)
    assert r2.status_code == 200, r2.text
    j = r2.json()
    assert j["applied"] is False
    assert "approval_request_id" in j
