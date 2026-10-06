"""Iteration 25 — Preparation + Kiosk selfie backend tests."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for ln in f:
            if ln.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = ln.split("=", 1)[1].strip().rstrip("/")

ADMIN_EMAIL = "aouattaraesca@gmail.com"
ADMIN_PASSWORD = "Admin123!"
ADMIN_PIN = "1234"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def session(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"})
    return s


# ---------- Kiosk / selfie ----------
def test_punch_kiosk_with_selfie():
    tiny_jpeg_b64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD//gA7Q1JFQVRPUjogZ2QtanBlZw=="
    r = requests.post(
        f"{BASE_URL}/api/attendance/punch-kiosk",
        json={"code": ADMIN_PIN, "kind": "in", "selfie": tiny_jpeg_b64},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("ok") is True
    assert data.get("has_selfie") is True
    assert data.get("name")


def test_punch_kiosk_without_selfie():
    r = requests.post(
        f"{BASE_URL}/api/attendance/punch-kiosk",
        json={"code": ADMIN_PIN, "kind": "out"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("ok") is True
    assert data.get("has_selfie") is False


def test_punch_kiosk_invalid_pin():
    r = requests.post(
        f"{BASE_URL}/api/attendance/punch-kiosk",
        json={"code": "0000", "kind": "in"},
        timeout=15,
    )
    assert r.status_code == 403


def test_attendance_persistence_includes_selfie(session):
    # verify most recent kiosk punch for admin recorded selfie
    r = session.get(f"{BASE_URL}/api/attendance/today-kiosk", timeout=15)
    assert r.status_code == 200, r.text
    rows = r.json()
    assert isinstance(rows, list)
    # Find any row with a selfie set
    assert any(row.get("selfie") for row in rows), "No attendance row with selfie field present"


# ---------- Preparation / status-v3 scan check ----------
def test_status_v3_scan_incomplete(session):
    # Find an order with items in nouvelle/confirmee/en_preparation
    r = session.get(f"{BASE_URL}/api/orders", timeout=20)
    assert r.status_code == 200
    orders = r.json()
    cand = next((o for o in orders if o.get("status") in ("nouvelle", "confirmee", "en_preparation") and len(o.get("items", [])) >= 2), None)
    if not cand:
        pytest.skip("No order with >=2 items in prep statuses")
    oid = cand["id"]
    # Send scanned_items shorter than items -> expect 400
    payload = {"status": "prete", "scanned_items": [{"line_index": 0, "scanned": True}]}
    r = session.patch(f"{BASE_URL}/api/orders/{oid}/status-v3", json=payload, timeout=15)
    assert r.status_code == 400, r.text
    assert "Scan" in r.text or "scan" in r.text


def test_status_v3_scan_complete_marks_prete(session):
    r = session.get(f"{BASE_URL}/api/orders", timeout=20)
    orders = r.json()
    cand = next((o for o in orders if o.get("status") in ("nouvelle", "confirmee", "en_preparation") and len(o.get("items", [])) >= 1), None)
    if not cand:
        pytest.skip("No prep order with items")
    oid = cand["id"]
    items = cand["items"]
    scanned_items = [
        {
            "line_index": i,
            "product_id": it.get("product_id"),
            "sku": it.get("sku"),
            "size": it.get("size"),
            "color": it.get("color"),
            "qty": it.get("qty"),
            "scanned": True,
            "manual": False,
            "manual_reason": None,
        }
        for i, it in enumerate(items)
    ]
    payload = {"status": "prete", "scanned_items": scanned_items}
    r = session.patch(f"{BASE_URL}/api/orders/{oid}/status-v3", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True
    # Verify persisted
    r2 = session.get(f"{BASE_URL}/api/orders", timeout=20)
    o2 = next((o for o in r2.json() if o["id"] == oid), None)
    assert o2 and o2["status"] == "prete"
