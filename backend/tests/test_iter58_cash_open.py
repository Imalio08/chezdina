"""Iter58 — Section Journée de caisse : form 'Ouvrir une session' (PIN + date + fond)."""
import os
import datetime as dt
import pytest
import requests

def _read_env():
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip()
    return ""

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _read_env()).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "aouattaraesca@gmail.com", "password": "Admin123!", "pin": "1234"}
MANAGER = {"email": "manager.cocody@dinastore.ci", "password": "Manager123!", "pin": "2222"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": creds["email"], "password": creds["password"]})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def admin():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def manager():
    return _login(MANAGER)


def _close_open_session(admin):
    """Ensure no open cash session (close with admin PIN if one is open)."""
    r = admin.get(f"{API}/cash-sessions")
    for s in r.json() or []:
        if not s.get("closed"):
            admin.post(f"{API}/cash-sessions/{s['id']}/close",
                       json={"closing_cash": s.get("opening_cash", 0), "pin": ADMIN["pin"], "note": "test teardown"})


# ---------- GET /api/cash-sessions/managers ----------
def test_managers_list_returns_admin_and_manager(admin):
    r = admin.get(f"{API}/cash-sessions/managers")
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list) and len(rows) >= 2
    for row in rows:
        assert set(row.keys()) >= {"id", "name", "role"}
        assert row["role"] in ("admin", "manager")
        assert "_id" not in row
    roles = {r["role"] for r in rows}
    assert "admin" in roles and "manager" in roles


# ---------- POST /api/cash-sessions/open ----------
def test_open_success_and_persisted(admin):
    _close_open_session(admin)
    mgrs = admin.get(f"{API}/cash-sessions/managers").json()
    mgr = next(m for m in mgrs if m["role"] == "manager")
    today = dt.date.today().isoformat()
    r = admin.post(f"{API}/cash-sessions/open",
                   json={"manager_id": mgr["id"], "session_date": today,
                         "opening_cash": 50000, "pin": MANAGER["pin"], "note": "TEST_open"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["opened_by"] == mgr["name"]
    assert data["manager_id"] == mgr["id"]
    assert data["session_date"] == today
    assert data["opening_cash"] == 50000
    assert data["closed"] is False
    # Verify persistence via GET
    rows = admin.get(f"{API}/cash-sessions").json()
    cur = next((s for s in rows if not s["closed"]), None)
    assert cur and cur["id"] == data["id"]
    assert cur["session_date"] == today
    assert cur["manager_id"] == mgr["id"]


def test_open_already_open_rejected(admin):
    # A session is already open from previous test
    mgrs = admin.get(f"{API}/cash-sessions/managers").json()
    mgr = next(m for m in mgrs if m["role"] == "manager")
    r = admin.post(f"{API}/cash-sessions/open",
                   json={"manager_id": mgr["id"], "session_date": dt.date.today().isoformat(),
                         "opening_cash": 1000, "pin": MANAGER["pin"]})
    assert r.status_code == 400
    assert "ouverte" in r.text.lower() or "open" in r.text.lower()


def test_open_future_date_rejected(admin):
    _close_open_session(admin)
    mgrs = admin.get(f"{API}/cash-sessions/managers").json()
    mgr = next(m for m in mgrs if m["role"] == "manager")
    future = (dt.date.today() + dt.timedelta(days=1)).isoformat()
    r = admin.post(f"{API}/cash-sessions/open",
                   json={"manager_id": mgr["id"], "session_date": future,
                         "opening_cash": 1000, "pin": MANAGER["pin"]})
    assert r.status_code == 400


def test_open_wrong_pin_rejected(admin):
    _close_open_session(admin)
    mgrs = admin.get(f"{API}/cash-sessions/managers").json()
    mgr = next(m for m in mgrs if m["role"] == "manager")
    r = admin.post(f"{API}/cash-sessions/open",
                   json={"manager_id": mgr["id"], "session_date": dt.date.today().isoformat(),
                         "opening_cash": 1000, "pin": "0000"})
    assert r.status_code == 403


def test_open_unknown_manager_rejected(admin):
    _close_open_session(admin)
    r = admin.post(f"{API}/cash-sessions/open",
                   json={"manager_id": "does-not-exist", "session_date": dt.date.today().isoformat(),
                         "opening_cash": 1000, "pin": MANAGER["pin"]})
    assert r.status_code == 404


def test_open_negative_amount_rejected(admin):
    _close_open_session(admin)
    mgrs = admin.get(f"{API}/cash-sessions/managers").json()
    mgr = next(m for m in mgrs if m["role"] == "manager")
    r = admin.post(f"{API}/cash-sessions/open",
                   json={"manager_id": mgr["id"], "session_date": dt.date.today().isoformat(),
                         "opening_cash": -500, "pin": MANAGER["pin"]})
    assert r.status_code == 400


def test_open_past_date_allowed(admin):
    _close_open_session(admin)
    mgrs = admin.get(f"{API}/cash-sessions/managers").json()
    mgr = next(m for m in mgrs if m["role"] == "manager")
    past = (dt.date.today() - dt.timedelta(days=2)).isoformat()
    r = admin.post(f"{API}/cash-sessions/open",
                   json={"manager_id": mgr["id"], "session_date": past,
                         "opening_cash": 25000, "pin": MANAGER["pin"]})
    assert r.status_code == 200
    assert r.json()["session_date"] == past


def test_close_still_works(admin):
    # Should have open session from previous test
    rows = admin.get(f"{API}/cash-sessions").json()
    cur = next((s for s in rows if not s["closed"]), None)
    assert cur, "no session to close"
    r = admin.post(f"{API}/cash-sessions/{cur['id']}/close",
                   json={"closing_cash": cur.get("opening_cash", 0), "pin": ADMIN["pin"], "note": "TEST_close"})
    assert r.status_code == 200
    assert r.json().get("ok") is True


def test_leave_session_open_for_pos(admin):
    """Agent-to-agent contract: leave an open session at the end."""
    _close_open_session(admin)
    mgrs = admin.get(f"{API}/cash-sessions/managers").json()
    mgr = next((m for m in mgrs if m["role"] == "manager"), mgrs[0])
    pin = MANAGER["pin"] if mgr["role"] == "manager" else ADMIN["pin"]
    r = admin.post(f"{API}/cash-sessions/open",
                   json={"manager_id": mgr["id"], "session_date": dt.date.today().isoformat(),
                         "opening_cash": 50000, "pin": pin, "note": "TEST_leave_open_for_pos"})
    assert r.status_code == 200
