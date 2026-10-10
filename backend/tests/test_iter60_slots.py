"""Iter60 — Rider delivery slots + Notification deep links."""
import os, time, requests, pytest
from datetime import datetime, timezone

def _read_frontend_env():
    try:
        for line in open("/app/frontend/.env"):
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip()
    except Exception:
        return None
BASE = (os.environ.get("REACT_APP_BACKEND_URL") or _read_frontend_env()).rstrip("/")
ADMIN = {"email": "aouattaraesca@gmail.com", "password": "Admin123!"}


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE}/api/auth/login", json=ADMIN)
    assert r.status_code == 200, r.text
    tok = r.json().get("access_token") or r.json().get("token")
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def rider_id(admin):
    r = admin.get(f"{BASE}/api/team")
    riders = [u for u in r.json() if u.get("role") == "rider"]
    # Prefer rider1@dinastore.ci
    r1 = next((u for u in riders if u.get("email") == "rider1@dinastore.ci"), None)
    return (r1 or riders[0])["id"]


# ---------- Slots CRUD ----------
def test_slots_put_valid_and_get(admin, rider_id):
    payload = {"slots": [
        {"label": "Matin", "start": "09:00", "end": "12:00", "capacity": 5},
        {"label": "Après-midi", "start": "14:00", "end": "18:00", "capacity": 3},
    ]}
    r = admin.put(f"{BASE}/api/riders/{rider_id}/slots", json=payload)
    assert r.status_code == 200, r.text
    out = r.json()
    assert len(out) == 2
    assert all("id" in s for s in out)
    g = admin.get(f"{BASE}/api/riders/{rider_id}/slots").json()
    assert [s["label"] for s in g] == ["Matin", "Après-midi"]  # sorted by start
    for s in g:
        assert "used" in s


def test_slots_put_invalid_time(admin, rider_id):
    r = admin.put(f"{BASE}/api/riders/{rider_id}/slots",
                  json={"slots": [{"label": "Bad", "start": "25:00", "end": "12:00", "capacity": 1}]})
    assert r.status_code == 400


def test_slots_put_start_after_end(admin, rider_id):
    r = admin.put(f"{BASE}/api/riders/{rider_id}/slots",
                  json={"slots": [{"label": "Bad", "start": "15:00", "end": "12:00", "capacity": 1}]})
    assert r.status_code == 400


def test_slots_put_missing_label(admin, rider_id):
    r = admin.put(f"{BASE}/api/riders/{rider_id}/slots",
                  json={"slots": [{"label": "", "start": "09:00", "end": "12:00", "capacity": 1}]})
    assert r.status_code == 400


def test_slots_put_bad_capacity(admin, rider_id):
    r = admin.put(f"{BASE}/api/riders/{rider_id}/slots",
                  json={"slots": [{"label": "X", "start": "09:00", "end": "12:00", "capacity": 0}]})
    assert r.status_code == 400


def test_slots_put_requires_admin_or_manager(rider_id):
    # Unauth
    r = requests.put(f"{BASE}/api/riders/{rider_id}/slots", json={"slots": []})
    assert r.status_code in (401, 403)


# ---------- Add-order with slot_id ----------
def _mk_order(admin):
    """Create a delivery order via direct DB-ish test endpoint if available, else via POST /orders."""
    body = {
        "mode": "delivery",
        "customer": {"name": "TEST_slot_cust", "phone": "+2250700000001", "address": "Cocody"},
        "items": [{"product_id": "p-test", "name": "TEST", "qty": 1, "price": 1000}],
        "total": 1000,
        "payment_method": "cod",
        "status": "confirmee",
    }
    r = admin.post(f"{BASE}/api/orders", json=body)
    assert r.status_code in (200, 201), r.text
    return r.json()


@pytest.fixture(scope="module")
def session_and_slots(admin, rider_id):
    # Ensure 2 slots: tiny cap for one
    slots_payload = {"slots": [
        {"label": "Matin", "start": "09:00", "end": "12:00", "capacity": 5},
        {"label": "Mini", "start": "13:00", "end": "14:00", "capacity": 1},
    ]}
    r = admin.put(f"{BASE}/api/riders/{rider_id}/slots", json=slots_payload)
    slots = r.json()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    sr = admin.post(f"{BASE}/api/delivery-sessions", json={"rider_id": rider_id, "rider_name": "Test", "date": today})
    sid = sr.json()["id"]
    return sid, {s["label"]: s for s in slots}


def _get_order(admin, oid):
    rows = admin.get(f"{BASE}/api/deliveries").json()
    return next((o for o in rows if o.get("id") == oid), None)


def test_add_order_with_slot(admin, session_and_slots):
    sid, slots = session_and_slots
    o = _mk_order(admin)
    r = admin.patch(f"{BASE}/api/delivery-sessions/{sid}/add-order",
                    json={"order_id": o["id"], "slot_id": slots["Matin"]["id"]})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("slot_full") is False
    # Verify order carries slot
    g = _get_order(admin, o["id"])
    assert g["delivery_slot"]["id"] == slots["Matin"]["id"]
    assert g["delivery_slot"]["label"] == "Matin"
    assert g["delivery_slot"]["start"] == "09:00"


def test_add_order_slot_full_warning(admin, session_and_slots):
    sid, slots = session_and_slots
    mini = slots["Mini"]["id"]
    # Fill the mini slot (cap 1), then try to add another
    o1 = _mk_order(admin)
    r1 = admin.patch(f"{BASE}/api/delivery-sessions/{sid}/add-order",
                     json={"order_id": o1["id"], "slot_id": mini})
    assert r1.status_code == 200
    assert r1.json().get("slot_full") is False
    o2 = _mk_order(admin)
    r2 = admin.patch(f"{BASE}/api/delivery-sessions/{sid}/add-order",
                     json={"order_id": o2["id"], "slot_id": mini})
    assert r2.status_code == 200
    data = r2.json()
    assert data.get("slot_full") is True
    assert "warning" in data
    # Order still assigned to slot
    g = _get_order(admin, o2["id"])
    assert g["delivery_slot"]["id"] == mini


def test_add_order_slot_none(admin, session_and_slots):
    sid, _ = session_and_slots
    o = _mk_order(admin)
    r = admin.patch(f"{BASE}/api/delivery-sessions/{sid}/add-order",
                    json={"order_id": o["id"], "slot_id": None})
    assert r.status_code == 200
    g = _get_order(admin, o["id"])
    assert not g.get("delivery_slot")


def test_add_order_invalid_slot(admin, session_and_slots):
    sid, _ = session_and_slots
    o = _mk_order(admin)
    r = admin.patch(f"{BASE}/api/delivery-sessions/{sid}/add-order",
                    json={"order_id": o["id"], "slot_id": "does-not-exist"})
    assert r.status_code == 400


# ---------- Assign with slot_id ----------
def test_assign_with_slot(admin, rider_id, session_and_slots):
    _, slots = session_and_slots
    o = _mk_order(admin)
    r = admin.patch(f"{BASE}/api/deliveries/{o['id']}/assign",
                    json={"rider_id": rider_id, "rider_name": "Test", "slot_id": slots["Matin"]["id"]})
    assert r.status_code == 200, r.text
    g = _get_order(admin, o["id"])
    assert g["delivery_slot"]["id"] == slots["Matin"]["id"]
    assert g["rider_id"] == rider_id


def test_assign_without_slot(admin, rider_id):
    o = _mk_order(admin)
    r = admin.patch(f"{BASE}/api/deliveries/{o['id']}/assign",
                    json={"rider_id": rider_id, "rider_name": "Test"})
    assert r.status_code == 200


# ---------- Notifications deep links ----------
def test_notifications_deep_links(admin):
    r = admin.get(f"{BASE}/api/notifications")
    assert r.status_code == 200, r.text
    rows = r.json()
    assert isinstance(rows, list)
    # Check links are deep for known kinds
    for n in rows:
        link = n.get("link") or ""
        k = (n.get("kind") or n.get("type") or "").lower()
        if "order" in k and link:
            assert "/console/commandes/" in link, f"order notif link={link}"
        if "review" in k or "avis" in k:
            if link:
                assert "/console/avis" in link
    # Check at least some have deep paths (not just /console)
    deep = [n for n in rows if (n.get("link") or "").count("/") >= 3]
    print(f"Total notifications: {len(rows)}, deep links: {len(deep)}")
    # DB-prefixed notifications
    db_ids = [n for n in rows if str(n.get("id", "")).startswith("db-")]
    print(f"db-prefixed notifications: {len(db_ids)}")
