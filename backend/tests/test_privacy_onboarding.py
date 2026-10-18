# Customer-data protection (rider masking/call, masked phones, access log/alerts, owner-only, devices/hours, deactivation) + HR onboarding
import base64
import io
import random
import time
import uuid
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient
from dotenv import dotenv_values
from PIL import Image

BASE_URL = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/")
_benv = dotenv_values("/app/backend/.env")
MDB = MongoClient(_benv["MONGO_URL"])[_benv["DB_NAME"]]
TODAY = datetime.now(timezone.utc).date().isoformat()
START = datetime.now(timezone.utc).isoformat()
SELFIE = "data:image/jpeg;base64," + "A" * 1500
ADMIN = ("aouattaraesca@gmail.com", "Admin123!")
MANAGER = ("manager.cocody@dinastore.ci", "Manager123!")
DEFAULT_PRIV = {"enforce_devices": False, "enforce_hours": False, "alert_threshold": 20, "alert_window_min": 10,
                "restricted_roles": ["manager"], "hours": {"days": [0, 1, 2, 3, 4, 5], "start": "08:00", "end": "20:00"}}
EN_LIV = "cabc0bb8-0fd2-4e43-a5c1-9f54b103f5aa"   # rider1, en_livraison
ASSIGNEE = "e477584c-61d7-4939-ad13-5fdb7f88acd3"  # rider1, assignee
ST = {"created_users": [], "att": [], "tpl": [], "devs": []}


def png_dataurl():
    img = Image.new("RGB", (300, 100), "white")
    px = img.load()
    for _ in range(4000):
        px[random.randrange(300), random.randrange(100)] = (random.randrange(255), 0, 0)
    b = io.BytesIO()
    img.save(b, "PNG")
    return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()


SIG = png_dataurl()


def login(email, pw, headers=None):
    return requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw}, headers=headers or {})


def sess_for(tok):
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {tok}"
    return s


_tok = {}


def admin():
    if "admin" not in _tok:
        r = login(*ADMIN); assert r.status_code == 200, r.text
        _tok["admin"] = r.json()["token"]
    return sess_for(_tok["admin"])


def manager():
    if "manager" not in _tok:
        r = login(*MANAGER); assert r.status_code == 200, r.text
        tok, uid = r.json()["token"], r.json()["user"]["id"]
        if r.json()["user"].get("punch_required"):
            had = MDB.attendance.find_one({"user_id": uid, "day": TODAY})
            c = requests.post(f"{BASE_URL}/api/attendance/check-in", json={"kind": "arrival", "selfie": SELFIE}, headers={"Authorization": f"Bearer {tok}"})
            assert c.status_code == 200, c.text
            if not had:
                ST["att"].append(uid)
        _tok["manager"], _tok["manager_id"] = tok, uid
    return sess_for(_tok["manager"])


def rider1():
    if "rider" not in _tok:
        r = requests.post(f"{BASE_URL}/api/auth/rider-login-pin", json={"pin": "5555"})
        assert r.status_code == 200, r.text
        _tok["rider"], _tok["rider_id"] = r.json()["token"], r.json()["user"]["id"]
    return sess_for(_tok["rider"])


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    snap = {o: MDB.orders.find_one({"id": o}, {"contact_log": 1, "arrived_at": 1, "status": 1}) for o in (EN_LIV, ASSIGNEE)}
    yield
    admin().put(f"{BASE_URL}/api/privacy/settings", json=DEFAULT_PRIV)
    MDB.business.update_one({"id": "main"}, {"$set": {f"privacy.{k}": v for k, v in DEFAULT_PRIV.items()}})
    for oid, o in snap.items():
        if o:
            MDB.orders.update_one({"id": oid}, {"$set": {"contact_log": o.get("contact_log") or [], "status": o["status"]}})
            if "arrived_at" in o:
                MDB.orders.update_one({"id": oid}, {"$set": {"arrived_at": o["arrived_at"]}})
            else:
                MDB.orders.update_one({"id": oid}, {"$unset": {"arrived_at": ""}})
    MDB.staff_devices.delete_many({"device_id": {"$regex": "^TEST_"}})
    MDB.customer_access_log.delete_many({"at": {"$gte": START}})
    MDB.privacy_alerts.delete_many({"at": {"$gte": START}})
    for uid in ST["created_users"]:
        MDB.users.delete_one({"id": uid})
        MDB.employee_docs.delete_many({"user_id": uid})
        MDB.onboarding_files.delete_many({"user_id": uid})
        MDB.notifications.delete_many({"user_id": uid})
    for tid in ST["tpl"]:
        MDB.doc_templates.delete_one({"id": tid})
    for uid in ST["att"]:
        MDB.attendance.delete_many({"user_id": uid, "day": TODAY})


# ---------- Rider masking / call ----------
def test_rider_today_no_phone():
    r = rider1().get(f"{BASE_URL}/api/riders/me/today")
    assert r.status_code == 200, r.text
    d = r.json()
    assert "day_closed" in d
    o = next((x for x in d["orders"] if x["id"] == EN_LIV), None)
    assert o, "en_livraison order not in rider today"
    c = o["customer"]
    assert c["name"] == "Awa" and "phone" not in c and c.get("can_call") is True
    assert set(c) <= {"name", "quartier", "zone", "landmark", "address", "lat", "lng", "can_call"}
    assert "+225" not in r.text and "85 55 58 88" not in r.text
    assert "contact_log" not in o and "customer_phone" not in o


def test_rider_call_rules():
    s = rider1()
    before = len((MDB.orders.find_one({"id": EN_LIV}) or {}).get("contact_log") or [])
    r = s.post(f"{BASE_URL}/api/riders/me/orders/{EN_LIV}/call")
    assert r.status_code == 200, r.text
    assert r.json()["tel"].endswith("0785555888")
    after = MDB.orders.find_one({"id": EN_LIV})["contact_log"]
    assert len(after) == before + 1 and after[-1]["kind"] == "call" and after[-1]["by_id"] == _tok["rider_id"]
    assert s.post(f"{BASE_URL}/api/riders/me/orders/{ASSIGNEE}/call").status_code == 400
    other = MDB.orders.find_one({"rider_id": {"$nin": [_tok["rider_id"], None]}}, {"id": 1})
    if other:
        assert s.post(f"{BASE_URL}/api/riders/me/orders/{other['id']}/call").status_code == 404


def test_rider_arrived():
    s = rider1()
    assert s.post(f"{BASE_URL}/api/riders/me/orders/{EN_LIV}/arrived").status_code == 200
    assert MDB.orders.find_one({"id": EN_LIV}).get("arrived_at")
    assert s.post(f"{BASE_URL}/api/riders/me/orders/{ASSIGNEE}/arrived").status_code == 400


@pytest.mark.parametrize("path", [f"/api/orders/{EN_LIV}/invoice", "/api/orders", "/api/deliveries", "/api/customers", "/api/customers/top"])
def test_rider_denied(path):
    assert rider1().get(f"{BASE_URL}{path}").status_code == 403


def test_rider_history_masked():
    r = rider1().get(f"{BASE_URL}/api/riders/me/history?days=365")
    assert r.status_code == 200
    names = [o["customer"].get("name") for d in r.json() for o in d["orders_detail"]]
    assert names, "no history"
    for o in [o for d in r.json() for o in d["orders_detail"]]:
        assert "phone" not in o["customer"]
        n = o["customer"].get("name")
        assert n is None or (n.endswith("•••") and len(n) == 4)
    assert "+225" not in r.text


# ---------- Masked phones / access log / alert ----------
def test_customers_masked_for_manager_full_for_admin():
    m = manager().get(f"{BASE_URL}/api/customers")
    assert m.status_code == 200
    rows = [x for x in m.json() if x.get("phone")]
    assert rows and all("••" in x["phone"] for x in rows)
    assert all("access_code" not in x for x in m.json())
    a = admin().get(f"{BASE_URL}/api/customers").json()
    assert any("••" not in (x.get("phone") or "••") for x in a)
    mo = manager().get(f"{BASE_URL}/api/orders").json()
    mo = mo if isinstance(mo, list) else mo.get("orders", mo.get("items", []))
    ph = [o["customer"]["phone"] for o in mo if (o.get("customer") or {}).get("phone")]
    assert ph and all("••" in p for p in ph)


def test_customer_open_logged_and_alert():
    a = admin()
    assert a.put(f"{BASE_URL}/api/privacy/settings", json={"alert_threshold": 2}).json()["alert_threshold"] == 2
    m = manager()
    custs = [c for c in a.get(f"{BASE_URL}/api/customers").json() if c.get("phone")][:3]
    for c in custs:
        r = m.get(f"{BASE_URL}/api/customers/{c['id']}")
        assert r.status_code == 200
        body = r.json()
        cust = body.get("customer", body)
        assert cust.get("phone") == c["phone"], "manager should see full phone in record"
    mid = _tok["manager_id"]
    assert MDB.customer_access_log.count_documents({"user_id": mid, "at": {"$gte": START}}) >= 3
    assert MDB.privacy_alerts.find_one({"user_id": mid, "at": {"$gte": START}})
    log = a.get(f"{BASE_URL}/api/privacy/access-log").json()
    assert log["rows"] and log["alerts"]
    assert m.get(f"{BASE_URL}/api/privacy/access-log").status_code == 403
    a.put(f"{BASE_URL}/api/privacy/settings", json={"alert_threshold": 20})


@pytest.mark.parametrize("method,path", [("GET", "/api/campaigns"), ("POST", "/api/messages/broadcast"), ("POST", "/api/whatsapp-outbox/broadcast")])
def test_manager_owner_only(method, path):
    r = manager().request(method, f"{BASE_URL}{path}", json={"message": "x", "body": "x"})
    assert r.status_code == 403, r.text


# ---------- Devices / hours ----------
def test_enforce_devices_and_hours():
    a, m = admin(), manager()
    did = f"TEST_dev_{uuid.uuid4().hex[:8]}"
    try:
        a.put(f"{BASE_URL}/api/privacy/settings", json={"enforce_devices": True})
        r = m.get(f"{BASE_URL}/api/customers", headers={"X-Device-Id": did})
        assert r.status_code == 403 and "Appareil non autorisé" in r.text
        dev = next(d for d in a.get(f"{BASE_URL}/api/privacy/devices").json()["devices"] if d["device_id"] == did)
        assert dev["status"] == "pending"
        assert a.patch(f"{BASE_URL}/api/privacy/devices/{dev['id']}", json={"status": "approved"}).status_code == 200
        assert m.get(f"{BASE_URL}/api/customers", headers={"X-Device-Id": did}).status_code == 200
        a.put(f"{BASE_URL}/api/privacy/settings", json={"enforce_devices": False, "enforce_hours": True, "hours": {"days": [], "start": "08:00", "end": "20:00"}})
        r = m.get(f"{BASE_URL}/api/customers", headers={"X-Device-Id": did})
        assert r.status_code == 403 and "horaires" in r.text
        assert a.get(f"{BASE_URL}/api/customers").status_code == 200
    finally:
        a.put(f"{BASE_URL}/api/privacy/settings", json=DEFAULT_PRIV)
    assert m.get(f"{BASE_URL}/api/customers").status_code == 200


# ---------- Deactivation ----------
def _mk_user(role, pin):
    email = f"test_{uuid.uuid4().hex[:6]}@dinastore.ci"
    r = admin().post(f"{BASE_URL}/api/users", json={"name": f"TEST_{role} Kone", "email": email, "password": "Test123!", "role": role, "pin": pin})
    assert r.status_code == 200, r.text
    ST["created_users"].append(r.json()["id"])
    return r.json()["id"], email


def test_deactivate_reactivate():
    uid, email = _mk_user("sales", "8282")
    tok = login(email, "Test123!").json()["token"]
    assert sess_for(tok).get(f"{BASE_URL}/api/auth/me").status_code == 200
    assert admin().post(f"{BASE_URL}/api/privacy/users/{uid}/deactivate").status_code == 200
    r = sess_for(tok).get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 401 and "désactivé" in r.text
    assert login(email, "Test123!").status_code == 401
    assert admin().post(f"{BASE_URL}/api/privacy/users/{uid}/reactivate").status_code == 200
    r2 = login(email, "Test123!")
    assert r2.status_code == 200
    assert sess_for(r2.json()["token"]).get(f"{BASE_URL}/api/auth/me").status_code == 200
    assert sess_for(tok).get(f"{BASE_URL}/api/auth/me").status_code == 401
    admin_id = MDB.users.find_one({"email": ADMIN[0]})["id"]
    assert admin().post(f"{BASE_URL}/api/privacy/users/{admin_id}/deactivate").status_code == 400


# ---------- Onboarding ----------
def test_onboarding_full_flow():
    a = admin()
    tpls = a.get(f"{BASE_URL}/api/onboarding/templates").json()
    assert len(tpls) >= 5 and {"contrat", "confidentialite", "charte", "fiche_poste", "remise_materiel"} <= {t["kind"] for t in tpls}
    t = a.post(f"{BASE_URL}/api/onboarding/templates", json={"title": "TEST_Doc", "body": "Texte v1", "kind": "autre"}).json()
    ST["tpl"].append(t["id"])
    t2 = a.post(f"{BASE_URL}/api/onboarding/templates", json={"title": "TEST_Doc2", "body": "Texte B", "kind": "autre"}).json()
    ST["tpl"].append(t2["id"])
    uid, email = _mk_user("rider", "8181")
    assert a.post(f"{BASE_URL}/api/onboarding/employees/{uid}/assign", json={"template_ids": [t["id"], t2["id"]]}).json()["assigned"] == 2
    lr = requests.post(f"{BASE_URL}/api/auth/rider-login-pin", json={"pin": "8181"})
    assert lr.status_code == 200, lr.text
    s = sess_for(lr.json()["token"])
    assert s.get(f"{BASE_URL}/api/riders/me/today").status_code == 423
    assert s.get(f"{BASE_URL}/api/auth/me").json().get("onboarding_required") is True
    me = s.get(f"{BASE_URL}/api/onboarding/me").json()
    assert len(me["to_sign"]) == 2
    d1 = next(d for d in me["to_sign"] if d["template_id"] == t["id"])
    u = f"{BASE_URL}/api/onboarding/me/sign/{d1['id']}"
    assert s.post(u, json={"accepted": False, "signature": SIG, "pin": "8181"}).status_code == 400
    assert s.post(u, json={"accepted": True, "signature": "data:image/png;base64,AAAA", "pin": "8181"}).status_code == 400
    assert s.post(u, json={"accepted": True, "signature": SIG, "pin": "0000"}).status_code == 400
    r = s.post(u, json={"accepted": True, "signature": SIG, "pin": "8181"})
    assert r.status_code == 200, r.text
    assert r.json()["remaining"] is True
    fid = r.json()["pdf_file_id"]
    f = s.get(f"{BASE_URL}/api/onboarding/files/{fid}")
    assert f.status_code == 200 and f.content[:4] == b"%PDF"
    assert a.get(f"{BASE_URL}/api/onboarding/files/{fid}").status_code == 200
    assert manager().get(f"{BASE_URL}/api/onboarding/files/{fid}").status_code == 403
    assert manager().get(f"{BASE_URL}/api/onboarding/employees/{uid}").status_code == 403
    # scan upload signs 2nd doc -> unblocked
    d2 = next(d for d in me["to_sign"] if d["template_id"] == t2["id"])
    sc = a.post(f"{BASE_URL}/api/onboarding/employees/{uid}/scan", json={"file": SIG, "doc_id": d2["id"], "name": "scan.png"})
    assert sc.status_code == 200
    time.sleep(1)
    assert s.get(f"{BASE_URL}/api/riders/me/today").status_code == 200
    # new version + request resign
    assert a.patch(f"{BASE_URL}/api/onboarding/templates/{t['id']}", json={"body": "Texte v2"}).status_code == 200
    tt = next(x for x in a.get(f"{BASE_URL}/api/onboarding/templates").json() if x["id"] == t["id"])
    assert tt["current"] == 2 and tt["outdated_count"] == 1
    assert a.post(f"{BASE_URL}/api/onboarding/templates/{t['id']}/request-resign").json()["requested"] == 1
    assert s.get(f"{BASE_URL}/api/riders/me/today").status_code == 423
    fl = a.get(f"{BASE_URL}/api/onboarding/employees/{uid}").json()
    assert {d["status"] for d in fl["docs"]} >= {"pending", "signed"}
    assert any(x["kind"] == "scan" for x in fl["files"]) and any(x["kind"] == "signed" for x in fl["files"])
    ov = a.get(f"{BASE_URL}/api/onboarding/overview").json()
    assert ov[uid]["pending"] == 1
    # departure
    dp = f"{BASE_URL}/api/onboarding/employees/{uid}/departure"
    assert a.post(dp, json={"equipment_returned": True, "owner_signature": SIG}).status_code == 400
    assert a.post(dp, json={"equipment_returned": True, "access_deactivated": True, "data_deleted": True}).status_code == 400
    r = a.post(dp, json={"equipment_returned": True, "access_deactivated": True, "data_deleted": True, "owner_signature": SIG, "notes": "TEST"})
    assert r.status_code == 200, r.text
    pdf = r.json()["departure"]["pdf_file_id"]
    assert a.get(f"{BASE_URL}/api/onboarding/files/{pdf}").content[:4] == b"%PDF"
    assert MDB.users.find_one({"id": uid})["active"] is False
    assert s.get(f"{BASE_URL}/api/auth/me").status_code == 401
