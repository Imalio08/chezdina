# Rider offline mode: POST /api/rider/sync (ordering, idempotency, device timestamps, conflicts, messages)
import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

R1 = mdb.users.find_one({"email": "rider1@dinastore.ci"})
R2 = mdb.users.find_one({"email": "rider2@dinastore.ci"})
PFX = "TEST-OFF-PY"


def _now(off_min=0):
    return (datetime.now(timezone.utc) + timedelta(minutes=off_min)).isoformat()


def _seed(n, status="en_livraison"):
    oid = f"test-off-py-{n}-{uuid.uuid4().hex[:6]}"
    mdb.orders.insert_one({
        "id": oid, "code": f"{PFX}-{n}-{oid[-4:]}", "status": status, "rider_id": R1["id"], "rider_name": R1["name"],
        "assigned_at": _now(), "created_at": _now(), "delivery_code": "1234", "payment_method": "cod",
        "payment_status": "en_attente", "total": 12000, "subtotal": 10000, "delivery_fee": 2000, "mode": "delivery",
        "store_id": "store-marcory", "delivery_zone": "Cocody",
        "customer": {"id": "test-cust-off", "name": "TEST_Offline Cliente", "phone": "+225 07 00 99 88 77", "lat": 5.35, "lng": -3.99},
        "items": [{"name": "TEST item", "qty": 1, "price": 10000}],
        "timeline": [{"status": status, "at": _now(-60), "by": "seed"}],
    })
    return oid


def _op(kind, order_id=None, seq=1, at=None, **kw):
    return {"id": f"op-{uuid.uuid4()}", "seq": seq, "kind": kind, "order_id": order_id, "at": at or _now(-30),
            "lat": 5.34, "lng": -4.01, **kw}


@pytest.fixture(scope="module")
def rider():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/rider-login-pin", json={"pin": "5555"})
    if r.status_code != 200:
        pytest.skip(f"rider login failed {r.status_code} {r.text}")
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return s


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "aouattaraesca@gmail.com", "password": "Admin123!"})
    if r.status_code != 200:
        pytest.skip(f"admin login failed {r.status_code}")
    tok = r.json().get("token")
    if tok:
        s.headers["Authorization"] = f"Bearer {tok}"
    return s


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    ids = [o["id"] for o in mdb.orders.find({"code": {"$regex": f"^{PFX}"}}, {"id": 1})]
    codes = [o["code"] for o in mdb.orders.find({"code": {"$regex": f"^{PFX}"}}, {"code": 1})]
    mdb.rider_sync_ops.delete_many({"result.code": {"$in": codes}})
    mdb.rider_sync_ops.delete_many({"op_id": {"$regex": "^op-"}, "rider_id": R1["id"]})
    mdb.conversations.delete_many({"order_id": {"$in": ids}})
    mdb.user_notifications.delete_many({"ref": {"$in": codes}})
    mdb.whatsapp_outbox.delete_many({"order_id": {"$in": ids}})
    mdb.whatsapp_outbox.delete_many({"order_code": {"$in": codes}})
    mdb.invoices.delete_many({"order_id": {"$in": ids}})
    mdb.orders.delete_many({"id": {"$in": ids}})


def _sync(s, ops):
    return s.post(f"{BASE_URL}/api/rider/sync", json={"ops": ops})


class TestSyncAuth:
    def test_non_rider_forbidden(self, admin):
        r = _sync(admin, [])
        assert r.status_code == 403

    def test_unauthenticated(self):
        r = requests.post(f"{BASE_URL}/api/rider/sync", json={"ops": []})
        assert r.status_code in (401, 403)


class TestSyncApply:
    def test_status_fail_with_device_time(self, rider):
        oid = _seed(1)
        at = _now(-42)
        op = _op("status", oid, at=at, payload={"status": "echouee", "reason": "Cliente absente"})
        r = _sync(rider, [op])
        assert r.status_code == 200, r.text
        assert r.json()["results"][0] == {"id": op["id"], "ok": True}
        o = mdb.orders.find_one({"id": oid})
        assert o["status"] == "echouee"
        last = o["timeline"][-1]
        assert last["at"] == at and last["offline"] is True and last["lat"] == 5.34
        assert last["reason"] == "Cliente absente"

    def test_deliver_code_and_idempotent_replay(self, rider):
        oid = _seed(2)
        at = _now(-25)
        op = _op("deliver", oid, at=at, payload={"method": "code", "code": "1234", "amount_collected": 12000, "payment_method": "cod"})
        r = _sync(rider, [op])
        assert r.status_code == 200, r.text
        assert r.json()["results"][0]["ok"] is True and not r.json()["results"][0].get("conflict")
        o = mdb.orders.find_one({"id": oid})
        assert o["status"] == "livree"
        assert o["delivered_at"] == at
        assert o["proof"]["at"] == at and o["proof"]["offline"] is True
        tl_len = len(o["timeline"])
        # replay
        r2 = _sync(rider, [op])
        assert r2.status_code == 200
        assert r2.json()["results"][0] == r.json()["results"][0]
        o2 = mdb.orders.find_one({"id": oid})
        assert len(o2["timeline"]) == tl_len
        assert mdb.rider_sync_ops.count_documents({"op_id": op["id"]}) == 1

    def test_ops_sorted_by_seq(self, rider):
        oid = _seed(3, status="assignee")
        start = _op("status", oid, seq=10, at=_now(-20), payload={"status": "en_livraison"})
        deliver = _op("deliver", oid, seq=20, at=_now(-10), payload={"method": "code", "code": "1234", "amount_collected": 12000, "payment_method": "cod"})
        r = _sync(rider, [deliver, start])  # sent out of order
        assert r.status_code == 200, r.text
        res = r.json()["results"]
        assert [x["id"] for x in res] == [start["id"], deliver["id"]]
        assert all(x["ok"] and not x.get("conflict") for x in res), res
        o = mdb.orders.find_one({"id": oid})
        assert o["status"] == "livree"
        sts = [e["status"] for e in o["timeline"] if e.get("offline")]
        assert sts[:1] == ["en_livraison"] and "livree" in sts

    def test_wrong_code_reviewed(self, rider):
        oid = _seed(4)
        op = _op("deliver", oid, payload={"method": "code", "code": "9999", "amount_collected": 12000, "payment_method": "cod"})
        r = _sync(rider, [op])
        assert r.status_code == 200, r.text
        res = r.json()["results"][0]
        assert res["conflict"] is True
        o = mdb.orders.find_one({"id": oid})
        assert o["status"] == "en_livraison"
        assert o["timeline"][-1].get("offline_rejected") is True


class TestSyncConflicts:
    def test_reassigned_console_wins(self, rider, admin):
        oid = _seed(5)
        r = admin.patch(f"{BASE_URL}/api/deliveries/{oid}/assign", json={"rider_id": R2["id"], "rider_name": R2["name"]})
        assert r.status_code == 200, r.text
        op = _op("deliver", oid, payload={"method": "code", "code": "1234", "amount_collected": 12000, "payment_method": "cod"})
        r = _sync(rider, [op])
        assert r.status_code == 200, r.text
        res = r.json()["results"][0]
        assert res["conflict"] is True and "réaffectée" in res["message"]
        o = mdb.orders.find_one({"id": oid})
        assert o["rider_id"] == R2["id"] and o["status"] == "assignee"
        last = o["timeline"][-1]
        assert last["offline_rejected"] is True and "Action hors ligne non appliquée" in last["note"]
        assert last["offline_action"]["at"] == op["at"]
        n = mdb.user_notifications.find_one({"kind": "rider", "target_id": R1["id"], "event_key": f"offline:{op['id']}"})
        assert n and "non appliquée" in n["title"]

    def test_cancelled_console_wins(self, rider, admin):
        oid = _seed(6)
        mdb.orders.update_one({"id": oid}, {"$set": {"status": "annulee"}})
        op = _op("status", oid, payload={"status": "echouee", "reason": "Cliente absente"})
        r = _sync(rider, [op])
        res = r.json()["results"][0]
        assert res["conflict"] is True and "annulée" in res["message"]
        assert mdb.orders.find_one({"id": oid})["status"] == "annulee"


class TestSyncMessages:
    def test_thread_op(self, rider):
        oid = _seed(7)
        op = _op("thread", oid, party="rider", payload={"text": "TEST_offline thread msg", "attachments": []})
        r = _sync(rider, [op])
        assert r.status_code == 200 and r.json()["results"][0]["ok"] is True
        t = rider.get(f"{BASE_URL}/api/orders/{oid}/thread/rider")
        assert t.status_code == 200
        assert any(m.get("text") == "TEST_offline thread msg" for m in t.json()["messages"])

    def test_conv_op_store(self, rider):
        c = rider.post(f"{BASE_URL}/api/rider/conversations/store")
        assert c.status_code == 200, c.text
        cid = c.json()["id"]
        txt = f"TEST_offline conv {uuid.uuid4().hex[:5]}"
        op = _op("conv", None, conv_id=cid, payload={"text": txt, "attachments": []})
        r = _sync(rider, [op])
        assert r.status_code == 200 and r.json()["results"][0]["ok"] is True
        g = rider.get(f"{BASE_URL}/api/rider/conversations/{cid}")
        assert any(m.get("text") == txt for m in g.json()["messages"])
        # cleanup this message
        mdb.conversations.update_one({"id": cid}, {"$pull": {"messages": {"text": txt}}})

    def test_bad_conv_does_not_block_queue(self, rider):
        """A failing conv op must not 4xx/5xx the whole batch (otherwise the queue is stuck forever)."""
        oid = _seed(8)
        bad = _op("conv", None, seq=1, conv_id="does-not-exist", payload={"text": "x", "attachments": []})
        good = _op("status", oid, seq=2, payload={"status": "echouee", "reason": "Cliente absente"})
        r = _sync(rider, [bad, good])
        assert r.status_code == 200, f"batch failed: {r.status_code} {r.text}"
        assert len(r.json()["results"]) == 2
