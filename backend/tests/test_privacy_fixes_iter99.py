# Iteration 99 retest: manager phone masking on all customer-facing lists, masked-phone PATCH guards,
# rider notifications deny, staff login lockout, onboarding 12-month expiry, regen-access-code logging.
import re
import sys
import uuid
from datetime import datetime, timezone

import pytest
import requests

sys.path.insert(0, "/app/backend/tests")
from test_privacy_onboarding import (BASE_URL, MDB, ST, START, SIG, TODAY, DEFAULT_PRIV, admin, manager, rider1,  # noqa: E402
                                     login, sess_for, _mk_user, _tok)

PHONE_KEYS = {"phone", "customer_phone", "to", "to_phone", "whatsapp"}
FULL = re.compile(r"^\+?[\d\s().-]{8,}$")
MY = {"customers": [], "orders": [], "tpl": [], "lock_ids": []}


def walk(o, hits):
    if isinstance(o, dict):
        for k, v in o.items():
            if k in PHONE_KEYS and isinstance(v, str) and FULL.match(v) and "•" not in v:
                hits.append((k, v))
            else:
                walk(v, hits)
    elif isinstance(o, list):
        for v in o:
            walk(v, hits)
    return hits


@pytest.fixture(scope="module", autouse=True)
def _cleanup():
    yield
    admin().put(f"{BASE_URL}/api/privacy/settings", json=DEFAULT_PRIV)
    MDB.business.update_one({"id": "main"}, {"$set": {f"privacy.{k}": v for k, v in DEFAULT_PRIV.items()}})
    for cid in MY["customers"]:
        MDB.customers.delete_one({"id": cid})
    for oid in MY["orders"]:
        MDB.orders.delete_one({"id": oid})
        MDB.whatsapp_outbox.delete_many({"order_id": oid})
        MDB.notifications.delete_many({"order_id": oid})
    for tid in MY["tpl"]:
        MDB.doc_templates.delete_one({"id": tid})
    MDB.login_attempts.delete_many({"identifier": {"$regex": "^(staff:test_|staff-pin:)", "$options": "i"}})
    MDB.customer_access_log.delete_many({"at": {"$gte": START}})
    MDB.privacy_alerts.delete_many({"at": {"$gte": START}})
    for uid in ST["created_users"]:
        MDB.users.delete_one({"id": uid})
        MDB.employee_docs.delete_many({"user_id": uid})
        MDB.onboarding_files.delete_many({"user_id": uid})
        MDB.notifications.delete_many({"user_id": uid})
    for uid in ST["att"]:
        MDB.attendance.delete_many({"user_id": uid, "day": TODAY})


MASKED = ["/api/deliveries", "/api/delivery-sessions", "/api/whatsapp-outbox", "/api/invoices", "/api/reviews",
          "/api/abandoned-carts", "/api/waitlist", "/api/messages/conversations", "/api/orders", "/api/customers", "/api/notifications", "/api/out-of-catalog"]


@pytest.mark.parametrize("path", MASKED)
def test_manager_lists_masked(path):
    r = manager().get(BASE_URL + path)
    assert r.status_code == 200, r.text[:200]
    hits = walk(r.json(), [])
    assert not hits, f"{path} leaks full phones: {hits[:3]}"


@pytest.mark.parametrize("path", ["/api/orders", "/api/customers", "/api/deliveries", "/api/whatsapp-outbox"])
def test_admin_sees_full(path):
    r = admin().get(BASE_URL + path)
    assert r.status_code == 200
    assert walk(r.json(), []), f"admin should see full phones on {path}"


@pytest.mark.parametrize("path", ["/api/users", "/api/team", "/api/users?role=rider"])
def test_staff_phones_full_for_manager(path):
    r = manager().get(BASE_URL + path)
    assert r.status_code == 200, r.text[:200]
    assert walk(r.json(), []), f"staff phones should stay full on {path}"


def _test_customer():
    phone = f"+225 07 {uuid.uuid4().int % 100:02d} 99 88 77"
    r = admin().post(f"{BASE_URL}/api/customers", json={"name": "TEST_Privacy Cliente", "phone": phone})
    assert r.status_code == 200, r.text
    MY["customers"].append(r.json()["id"])
    return r.json()["id"], phone


def test_customer_record_full_and_logged_for_manager():
    cid, phone = _test_customer()
    r = manager().get(f"{BASE_URL}/api/customers/{cid}")
    assert r.status_code == 200
    body = r.json(); c = body.get("customer", body)
    assert c["phone"] == phone
    assert MDB.customer_access_log.find_one({"customer_id": cid, "user_id": _tok["manager_id"]})


def test_patch_customer_masked_phone_ignored():
    cid, phone = _test_customer()
    m = manager()
    r = m.patch(f"{BASE_URL}/api/customers/{cid}", json={"phone": "07 •• •• •• 77", "quartier": "TEST_Q"})
    assert r.status_code == 200, r.text
    db = MDB.customers.find_one({"id": cid})
    assert db["phone"] == phone and db["quartier"] == "TEST_Q"


def test_patch_order_masked_phone_keeps_original():
    oid = str(uuid.uuid4())
    phone = "+225 07 11 22 33 44"
    MDB.orders.insert_one({"id": oid, "code": f"TEST-{oid[:6]}", "status": "nouvelle", "channel": "pos", "items": [], "subtotal": 0, "total": 0,
                           "delivery_fee": 0, "discount": 0, "customer": {"name": "TEST_Order Cliente", "phone": phone},
                           "created_at": datetime.now(timezone.utc).isoformat(), "timeline": []})
    MY["orders"].append(oid)
    m = manager()
    lst = m.get(f"{BASE_URL}/api/orders").json()
    lst = lst if isinstance(lst, list) else lst.get("orders", lst.get("items", []))
    row = next((x for x in lst if x["id"] == oid), None)
    cust = dict((row or {}).get("customer") or {"name": "TEST_Order Cliente"})
    print("order list phone for manager:", cust.get("phone"))
    inv = m.get(f"{BASE_URL}/api/orders/{oid}/invoice")
    print("invoice", inv.status_code, walk(inv.json(), []) if inv.status_code == 200 else inv.text[:100])
    if inv.status_code == 200:
        assert not walk(inv.json(), []), "invoice leaks full phone to manager"
    cust["phone"] = "07 •• •• •• 44"; cust["name"] = "TEST_Order Cliente2"
    r = m.patch(f"{BASE_URL}/api/orders/{oid}", json={"customer": cust, "note": "TEST_note"})
    assert r.status_code == 200, r.text
    o = MDB.orders.find_one({"id": oid})
    assert o["customer"]["phone"] == phone and o["customer"]["name"] == "TEST_Order Cliente2"


def test_regen_access_code_logged():
    cid, _ = _test_customer()
    before = MDB.customer_access_log.count_documents({"customer_id": cid})
    r = manager().post(f"{BASE_URL}/api/customers/{cid}/regen-access-code")
    assert r.status_code == 200, r.text
    assert len(r.json()["access_code"]) == 6
    assert MDB.customer_access_log.count_documents({"customer_id": cid, "user_id": _tok["manager_id"]}) == before + 1


def test_rider_notifications():
    s = rider1()
    assert s.get(f"{BASE_URL}/api/notifications").status_code == 403
    assert s.get(f"{BASE_URL}/api/me/notifications").status_code == 200


def test_staff_login_lockout():
    email = f"TEST_lock_{uuid.uuid4().hex[:6]}@dinastore.ci"
    codes = [login(email, "wrong!").status_code for _ in range(8)]
    assert codes == [401] * 8, codes
    r = login(email, "wrong!")
    assert r.status_code == 429, r.text
    # other emails unaffected
    assert login(f"TEST_other_{uuid.uuid4().hex[:6]}@dinastore.ci", "x").status_code == 401


def test_pin_lockout_xff_spoof():
    ip = f"10.250.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250}"
    h = {"X-Forwarded-For": ip}
    codes = [requests.post(f"{BASE_URL}/api/auth/login-pin", json={"pin": "97531"}, headers=h).status_code for _ in range(8)]
    r = requests.post(f"{BASE_URL}/api/auth/login-pin", json={"pin": "97531"}, headers=h)
    print("pin codes", codes, r.status_code)
    assert r.status_code == 429
    r2 = requests.post(f"{BASE_URL}/api/auth/login-pin", json={"pin": "97531"}, headers={"X-Forwarded-For": "10.251.1.1"})
    print("spoofed XFF after lock ->", r2.status_code)
    assert r2.status_code == 429, "PIN lockout bypassable by spoofing X-Forwarded-For"


def test_onboarding_12_months_expiry():
    a = admin()
    t = a.post(f"{BASE_URL}/api/onboarding/templates", json={"title": "TEST_Doc12", "body": "Texte 12", "kind": "autre", "validity_months": 12}).json()
    MY["tpl"].append(t["id"])
    uid, email = _mk_user("rider", "8191")
    assert a.post(f"{BASE_URL}/api/onboarding/employees/{uid}/assign", json={"template_ids": [t["id"]]}).json()["assigned"] == 1
    s = sess_for(requests.post(f"{BASE_URL}/api/auth/rider-login-pin", json={"pin": "8191"}).json()["token"])
    d = s.get(f"{BASE_URL}/api/onboarding/me").json()["to_sign"][0]
    r = s.post(f"{BASE_URL}/api/onboarding/me/sign/{d['id']}", json={"accepted": True, "signature": SIG, "pin": "8191"})
    assert r.status_code == 200, r.text
    doc = MDB.employee_docs.find_one({"id": d["id"]})
    exp = datetime.fromisoformat(doc["expires_at"])
    now = datetime.now(timezone.utc)
    assert exp.year == now.year + 1 and exp.month == now.month and abs(exp.day - now.day) <= 3, doc["expires_at"]


def test_outbox_no_full_digits_or_wa_links_for_manager():
    t = manager().get(f"{BASE_URL}/api/whatsapp-outbox").text
    assert not re.search(r'"phone_digits":\s*"\d{8,}"', t), "phone_digits leaks full number"
    assert not re.search(r"wa\.me/\d{8,}", t), "wa.me links leak full number"


def test_notifications_free_text_no_full_phone():
    t = manager().get(f"{BASE_URL}/api/notifications").text
    assert not re.search(r"\+?225[ ]?0[157][ ]?\d{2}[ ]?\d{2}[ ]?\d{2}[ ]?\d{2}", t), "notification msg text contains full phone"
