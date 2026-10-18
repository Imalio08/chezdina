# Rider app section 10: notifications (assign/status/edit/messages/announcement), inbox, isolation, push subscribe
import os
import random
import time
import uuid

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
mongo = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[os.environ.get("DB_NAME", "dina_store")]

STATE = {"orders": [], "customers": [], "convs": []}


def login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"Authorization": f"Bearer {d['token']}"}, d["user"]


@pytest.fixture(scope="module")
def ctx():
    a, au = login("aouattaraesca@gmail.com", "Admin123!")
    r1, r1u = login("rider1@dinastore.ci", "Rider123!")
    r2, r2u = login("rider2@dinastore.ci", "Rider123!")
    c = {"admin": a, "admin_u": au, "r1": r1, "r1u": r1u, "r2": r2, "r2u": r2u}
    yield c
    # cleanup
    ids = STATE["orders"]
    codes = [o["code"] for o in mongo.orders.find({"id": {"$in": ids}}, {"code": 1})]
    mongo.user_notifications.delete_many({"$or": [{"ref": {"$in": codes + STATE["convs"]}}, {"event_key": {"$regex": "^TESTANN"}},
                                                 {"title": {"$regex": "TEST_"}}, {"msg": {"$regex": "TEST_"}}]})
    mongo.conversations.delete_many({"$or": [{"id": {"$in": STATE["convs"]}}, {"order_id": {"$in": ids}}]})
    mongo.whatsapp_outbox.delete_many({"order_id": {"$in": ids}})
    mongo.orders.delete_many({"id": {"$in": ids}})
    mongo.customers.delete_many({"id": {"$in": STATE["customers"]}})


def notifs(h, **params):
    r = requests.get(f"{API}/me/notifications", headers=h, params=params)
    assert r.status_code == 200, r.text
    return r.json()


def by_ref(h, ref):
    return [n for n in notifs(h, limit=100)["items"] if n.get("ref") == ref]


def make_order(ctx, customer=None):
    body = {"items": [{"product_id": "TEST_prod", "name": "TEST_item", "qty": 1, "price": 5000}],
            "customer": customer or {"name": "TEST_Cust", "phone": "+225 07 00 00 99 99", "address": "Cocody"},
            "channel": "whatsapp", "payment_method": "cod", "delivery_zone": "Cocody", "delivery_fee": 1000, "mode": "delivery"}
    r = requests.post(f"{API}/orders", json=body, headers=ctx["admin"])
    assert r.status_code == 200, r.text
    o = r.json()
    STATE["orders"].append(o["id"])
    return o


def assign(ctx, o, who):
    u = ctx[f"{who}u"]
    r = requests.patch(f"{API}/deliveries/{o['id']}/assign", json={"rider_id": u["id"], "rider_name": u["name"]}, headers=ctx["admin"])
    assert r.status_code == 200, r.text


# --- assignment ---
class TestAssign:
    def test_assign_then_reassign(self, ctx):
        o = make_order(ctx)
        assign(ctx, o, "r1")
        n1 = by_ref(ctx["r1"], o["code"])
        assert len(n1) == 1 and n1[0]["title"] == "Nouvelle course attribuée"
        assert n1[0]["link"] == f"/riders?course={o['code']}" and n1[0]["type"] == "delivery" and n1[0]["read"] is False
        assign(ctx, o, "r1")  # same rider → no dup
        assert len(by_ref(ctx["r1"], o["code"])) == 1
        assign(ctx, o, "r2")
        n2 = by_ref(ctx["r2"], o["code"])
        assert len(n2) == 1 and n2[0]["title"] == "Nouvelle course attribuée"
        n1 = by_ref(ctx["r1"], o["code"])
        assert any(n["title"] == f"Course {o['code']} retirée" for n in n1)
        STATE["o_r2"] = o

    def test_reassign_back_within_same_minute(self, ctx):
        """A→B→A quickly: rider A must be notified again of the new assignment (dedup key uses minute stamp)."""
        o = STATE["o_r2"]
        assign(ctx, o, "r1")
        n1 = [n for n in by_ref(ctx["r1"], o["code"]) if n["title"] == "Nouvelle course attribuée"]
        n2 = [n for n in by_ref(ctx["r2"], o["code"]) if "retirée" in n["title"]]
        # restore to r2 for later tests
        assign(ctx, o, "r2")
        assert len(n2) == 1, f"r2 not notified of removal: {n2}"
        assert len(n1) == 2, f"r1 re-assignment within same minute was swallowed by dedup ({len(n1)} assign notifs)"


# --- status ---
class TestStatus:
    def test_admin_cancel_notifies_once(self, ctx):
        o = make_order(ctx)
        assign(ctx, o, "r1")
        r = requests.patch(f"{API}/orders/{o['id']}/status", json={"status": "annulee", "reason": "TEST"}, headers=ctx["admin"])
        assert r.status_code == 200
        st = [n for n in by_ref(ctx["r1"], o["code"]) if "Nouveau statut" in n["msg"]]
        assert len(st) == 1 and "annulée par la boutique" in st[0]["msg"]

    def test_admin_prep_and_rider_own_status(self, ctx):
        o = make_order(ctx)
        assign(ctx, o, "r1")
        requests.patch(f"{API}/orders/{o['id']}/status", json={"status": "en_preparation"}, headers=ctx["admin"])
        st = [n for n in by_ref(ctx["r1"], o["code"]) if "Nouveau statut" in n["msg"]]
        assert len(st) == 1 and "en préparation" in st[0]["msg"]
        r = requests.patch(f"{API}/orders/{o['id']}/status", json={"status": "en_livraison"}, headers=ctx["r1"])
        assert r.status_code == 200
        st2 = [n for n in by_ref(ctx["r1"], o["code"]) if "Nouveau statut" in n["msg"]]
        assert len(st2) == 1, "rider notified of his own status change"

    def test_admin_reportee_clears_rider_and_notifies(self, ctx):
        o = make_order(ctx)
        assign(ctx, o, "r1")
        nd = time.strftime("%Y-%m-%d", time.gmtime(time.time() + 86400 * 2))
        r = requests.patch(f"{API}/orders/{o['id']}/status", json={"status": "reportee", "next_date": nd, "reason": "TEST"}, headers=ctx["admin"])
        assert r.status_code == 200, r.text
        fresh = mongo.orders.find_one({"id": o["id"]})
        assert not fresh.get("rider_id")
        n = [x for x in by_ref(ctx["r1"], o["code"]) if "retirée" in x["title"]]
        assert len(n) == 1, by_ref(ctx["r1"], o["code"])
        STATE["reportee_msg"] = n[0]["msg"]
        assert "report" in n[0]["msg"], f"message says '{n[0]['msg']}' instead of reportée"


# --- order edit ---
class TestEdit:
    def test_edit_notifies_changed_fields(self, ctx):
        o = make_order(ctx)
        assign(ctx, o, "r1")
        cust = {**o["customer"], "address": "TEST_new address", "phone": "+225 07 11 11 11 11"}
        r = requests.patch(f"{API}/orders/{o['id']}", json={"customer": cust, "note": "TEST_note sonner"}, headers=ctx["admin"])
        assert r.status_code == 200
        n = [x for x in by_ref(ctx["r1"], o["code"]) if "modifiée" in x["title"]]
        assert len(n) == 1 and "adresse" in n[0]["msg"] and "instructions" in n[0]["msg"]
        time.sleep(1.1)
        requests.patch(f"{API}/orders/{o['id']}", json={"note": "TEST_note sonner"}, headers=ctx["admin"])
        n = [x for x in by_ref(ctx["r1"], o["code"]) if "modifiée" in x["title"]]
        assert len(n) == 1, "no-change patch produced a notification"
        time.sleep(1.1)
        items = [{"product_id": "TEST_prod", "name": "TEST_item", "qty": 2, "price": 5000}]
        requests.patch(f"{API}/orders/{o['id']}", json={"items": items}, headers=ctx["admin"])
        n = [x for x in by_ref(ctx["r1"], o["code"]) if "modifiée" in x["title"]]
        assert len(n) == 2 and "articles" in n[0]["msg"] and "montant" in n[0]["msg"]


# --- messages ---
class TestMessages:
    def test_customer_to_rider(self, ctx):
        phone = f"+225 07 {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)}"
        r = requests.post(f"{API}/public/customer-signup", json={"name": "TEST_Rider Notif", "phone": phone, "pin": "482913"})
        assert r.status_code == 200, r.text
        d = r.json()
        STATE["customers"].append(d["customer"]["id"])
        ch = {"Authorization": f"Bearer {d['token']}"}
        o = make_order(ctx, {"id": d["customer"]["id"], "name": d["customer"]["name"], "phone": phone})
        assign(ctx, o, "r1")
        r = requests.post(f"{API}/public/account/thread/rider/{o['code']}", headers=ch)
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        STATE["convs"].append(cid)
        r = requests.post(f"{API}/public/account/messages/send", json={"conversation_id": cid, "text": "TEST_bonjour 😀"}, headers=ch)
        assert r.status_code == 200, r.text
        n = by_ref(ctx["r1"], cid)
        assert len(n) == 1 and n[0]["link"] == f"/riders/messages/{cid}" and n[0]["type"] == "message" and not n[0]["read"]
        # rider2 can't open
        assert requests.get(f"{API}/rider/conversations/{cid}", headers=ctx["r2"]).status_code in (403, 404)
        r = requests.get(f"{API}/rider/conversations/{cid}", headers=ctx["r1"])
        assert r.status_code == 200 and r.json()["order_code"] == o["code"]
        assert all(x["read"] for x in by_ref(ctx["r1"], cid))
        # rider reply reaches customer
        r = requests.post(f"{API}/rider/conversations/{cid}/send", json={"text": "TEST_j'arrive"}, headers=ctx["r1"])
        assert r.status_code == 200
        msgs = requests.get(f"{API}/public/account/messages", headers=ch).json()
        conv = next(c for c in msgs if c["id"] == cid)
        assert conv["messages"][-1]["text"] == "TEST_j'arrive"

    def test_staff_to_rider_and_store_thread(self, ctx):
        r = requests.post(f"{API}/messages/send", json={"rider_id": ctx["r1u"]["id"], "text": "TEST_consigne staff"}, headers=ctx["admin"])
        assert r.status_code == 200, r.text
        cid0 = r.json()["conversation_id"]
        n = by_ref(ctx["r1"], cid0)
        assert any(x["title"] == f"Message de {ctx['admin_u']['name']}" for x in n)
        mongo.conversations.update_one({"id": cid0}, {"$pull": {"messages": {"text": "TEST_consigne staff"}}})
        # rider-initiated store conv
        a = requests.post(f"{API}/rider/conversations/store", headers=ctx["r1"]).json()["id"]
        b = requests.post(f"{API}/rider/conversations/store", headers=ctx["r1"]).json()["id"]
        assert a == b
        existed = mongo.conversations.find_one({"id": a}).get("messages")
        if not existed:
            STATE["convs"].append(a)
        assert requests.post(f"{API}/rider/conversations/store", headers=ctx["admin"]).status_code == 403
        r = requests.post(f"{API}/rider/conversations/{a}/send", json={"text": "TEST_question livreur"}, headers=ctx["r1"])
        assert r.status_code == 200
        lst = requests.get(f"{API}/messages/conversations", headers=ctx["admin"]).json()
        assert any(c["id"] == a for c in lst)
        n_before = mongo.conversations.count_documents({})
        r = requests.post(f"{API}/messages/send", json={"conversation_id": a, "text": "TEST_réponse console"}, headers=ctx["admin"])
        assert r.status_code == 200 and r.json()["conversation_id"] == a
        assert mongo.conversations.count_documents({}) == n_before
        conv = requests.get(f"{API}/rider/conversations/{a}", headers=ctx["r1"]).json()
        assert conv["messages"][-1]["text"] == "TEST_réponse console"
        assert requests.get(f"{API}/rider/conversations/{a}", headers=ctx["r2"]).status_code == 404
        mongo.conversations.update_one({"id": a}, {"$pull": {"messages": {"text": {"$regex": "^TEST_"}}}})
        mongo.user_notifications.delete_many({"ref": {"$in": [a, cid0]}, "msg": {"$regex": "TEST_"}})


# --- feed endpoints ---
class TestFeed:
    def test_paging_and_read(self, ctx):
        f = notifs(ctx["r1"], limit=2)
        assert len(f["items"]) <= 2 and isinstance(f["unread"], int)
        if len(f["items"]) == 2:
            nxt = notifs(ctx["r1"], limit=2, before=f["items"][-1]["at"])
            assert all(x["at"] <= f["items"][-1]["at"] for x in nxt["items"])  # paging now uses $lte (client dedups)
        un = notifs(ctx["r1"], unread_only="true", limit=100)
        assert all(not x["read"] for x in un["items"])
        o = make_order(ctx)
        assign(ctx, o, "r1")
        nid = by_ref(ctx["r1"], o["code"])[0]["id"]
        # rider2 cannot mark rider1's notif
        r = requests.post(f"{API}/me/notifications/read", json={"ids": [nid]}, headers=ctx["r2"])
        assert r.json()["updated"] == 0
        assert not by_ref(ctx["r1"], o["code"])[0]["read"]
        assert all(x["target_id"] == ctx["r2u"]["id"] for x in notifs(ctx["r2"], limit=100)["items"])
        r = requests.post(f"{API}/me/notifications/read", json={"ids": [nid]}, headers=ctx["r1"])
        assert r.json()["updated"] == 1 and by_ref(ctx["r1"], o["code"])[0]["read"]
        requests.patch(f"{API}/orders/{o['id']}", json={"note": "TEST_x"}, headers=ctx["admin"])
        r = requests.post(f"{API}/me/notifications/read", json={"ref": o["code"]}, headers=ctx["r1"])
        assert r.json()["updated"] == 1


# --- announcement ---
class TestAnnouncement:
    def test_announcement_notifies_riders_once(self, ctx):
        cur = requests.get(f"{API}/rider-cms", headers=ctx["admin"]).json()
        old = cur.get("announcement") or {}
        txt = f"TEST_annonce {uuid.uuid4().hex[:6]}"
        try:
            r = requests.patch(f"{API}/rider-cms", json={"announcement": {**old, "enabled": True, "text": txt}}, headers=ctx["admin"])
            assert r.status_code == 200
            requests.patch(f"{API}/rider-cms", json={"announcement": {**old, "enabled": True, "text": txt}}, headers=ctx["admin"])
            for h in ("r1", "r2"):
                n = [x for x in notifs(ctx[h], limit=100)["items"] if x["msg"] == txt]
                assert len(n) == 1 and n[0]["type"] == "announcement"
        finally:
            requests.patch(f"{API}/rider-cms", json={"announcement": old}, headers=ctx["admin"])
            mongo.user_notifications.delete_many({"msg": txt})


# --- push subscribe ---
class TestPush:
    def test_subscribe(self, ctx):
        ep = f"https://fcm.googleapis.com/fcm/send/TEST_{uuid.uuid4().hex}"
        sub = {"endpoint": ep, "keys": {"p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", "auth": "tBHItJI5svbpez7KI4CCXg"}}
        assert requests.post(f"{API}/push/subscribe", json={"subscription": {"endpoint": ep}}, headers=ctx["r1"]).status_code == 400
        r = requests.post(f"{API}/push/subscribe", json={"subscription": sub}, headers=ctx["r1"])
        assert r.status_code == 200
        d = mongo.push_subscriptions.find_one({"endpoint": ep})
        assert d["kind"] == "rider" and d["owner_id"] == ctx["r1u"]["id"]
        mongo.push_subscriptions.delete_one({"endpoint": ep})


# --- iteration 75 retests ---
class TestIter75:
    def test_double_unassign_same_minute(self, ctx):
        """A loses the course twice within a minute => 2 'retirée' notifs for A."""
        o = make_order(ctx)
        assign(ctx, o, "r1"); assign(ctx, o, "r2"); assign(ctx, o, "r1"); assign(ctx, o, "r2")
        n1 = by_ref(ctx["r1"], o["code"])
        assert len([n for n in n1 if n["title"] == "Nouvelle course attribuée"]) == 2
        assert len([n for n in n1 if "retirée" in n["title"]]) == 2
        n2 = by_ref(ctx["r2"], o["code"])
        assert len([n for n in n2 if n["title"] == "Nouvelle course attribuée"]) == 2
        assert len([n for n in n2 if "retirée" in n["title"]]) == 1

    def test_reportee_customer_label(self, ctx):
        phone = f"+225 07 {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)}"
        r = requests.post(f"{API}/public/customer-signup", json={"name": "TEST_Report Cust", "phone": phone, "pin": "482913"})
        assert r.status_code == 200, r.text
        d = r.json(); STATE["customers"].append(d["customer"]["id"])
        ch = {"Authorization": f"Bearer {d['token']}"}
        o = make_order(ctx, {"id": d["customer"]["id"], "name": d["customer"]["name"], "phone": phone})
        assign(ctx, o, "r1")
        nd = time.strftime("%Y-%m-%d", time.gmtime(time.time() + 86400 * 2))
        r = requests.patch(f"{API}/orders/{o['id']}/status", json={"status": "reportee", "next_date": nd, "reason": "TEST"}, headers=ctx["admin"])
        assert r.status_code == 200
        rn = [x for x in by_ref(ctx["r1"], o["code"]) if "retirée" in x["title"]]
        assert len(rn) == 1 and rn[0]["msg"] == "Nouveau statut : reportée par la boutique", rn
        cn = requests.get(f"{API}/public/account/notifications", headers=ch).json()["items"]
        cn = [x for x in cn if x.get("ref") == o["code"]]
        assert any(x["msg"] == "Votre commande est reportée." for x in cn), cn
        assert not any("confirmée" in x["msg"] for x in cn), cn

    def test_rider_patch_forbidden_admin_allowed(self, ctx):
        o = make_order(ctx)
        assign(ctx, o, "r1")
        r = requests.patch(f"{API}/orders/{o['id']}", json={"note": "TEST_rider edit"}, headers=ctx["r1"])
        assert r.status_code == 403
        assert mongo.orders.find_one({"id": o["id"]}).get("note") != "TEST_rider edit"
        r = requests.patch(f"{API}/orders/{o['id']}", json={"note": "TEST_admin edit"}, headers=ctx["admin"])
        assert r.status_code == 200
        n = [x for x in by_ref(ctx["r1"], o["code"]) if "modifiée" in x["title"]]
        assert len(n) == 1 and "instructions" in n[0]["msg"]

    def test_send_to_rider_default_kind(self, ctx):
        # use rider3 (fresh conv) if exists
        r3 = mongo.users.find_one({"email": "rider3@dinastore.ci"}, {"id": 1, "_id": 0})
        assert r3
        before = {c["id"] for c in mongo.conversations.find({"participants.id": r3["id"]}, {"id": 1})}
        r = requests.post(f"{API}/messages/send", json={"rider_id": r3["id"], "text": "TEST_kind check"}, headers=ctx["admin"])
        assert r.status_code == 200, r.text
        cid = r.json()["conversation_id"]
        conv = mongo.conversations.find_one({"id": cid})
        if cid not in before:
            STATE["convs"].append(cid)
            assert conv["kind"] == "boutique_livreur", conv["kind"]
        else:
            mongo.conversations.update_one({"id": cid}, {"$pull": {"messages": {"text": "TEST_kind check"}}})
            print("existing conv kind:", conv["kind"])
        mongo.user_notifications.delete_many({"ref": cid, "msg": {"$regex": "TEST_"}})

    def test_console_open_clears_unread(self, ctx):
        a = requests.post(f"{API}/rider/conversations/store", headers=ctx["r1"]).json()["id"]
        if not mongo.conversations.find_one({"id": a}).get("messages"):
            STATE["convs"].append(a)
        requests.post(f"{API}/rider/conversations/{a}/send", json={"text": "TEST_unread q"}, headers=ctx["r1"])
        lst = requests.get(f"{API}/messages/conversations", headers=ctx["admin"]).json()
        c = next(x for x in lst if x["id"] == a)
        assert c["unread"] >= 1
        assert requests.get(f"{API}/messages/conversations/{a}", headers=ctx["admin"]).status_code == 200
        lst = requests.get(f"{API}/messages/conversations", headers=ctx["admin"]).json()
        assert next(x for x in lst if x["id"] == a)["unread"] == 0
        mongo.conversations.update_one({"id": a}, {"$pull": {"messages": {"text": {"$regex": "^TEST_"}}}})

    def test_paging_lte_same_timestamp(self, ctx):
        uid = ctx["r1u"]["id"]
        ts = "2001-01-01T00:00:00.000000+00:00"
        docs = [{"id": f"TESTP{i}", "kind": "rider", "target_id": uid, "type": "info", "title": "TEST_page", "msg": f"TEST_p{i}",
                 "link": "/rider", "ref": None, "event_key": None, "at": ts if i < 4 else f"2000-01-01T00:00:0{i}+00:00", "read": True} for i in range(8)]
        mongo.user_notifications.insert_many(docs)
        try:
            # page whose boundary is the shared ts
            p = notifs(ctx["r1"], limit=100, before="2001-01-01T00:00:00.000000+00:00")
            ids = [x["id"] for x in p["items"] if x["id"].startswith("TESTP")]
            assert set(ids) == {f"TESTP{i}" for i in range(8)}  # lte includes boundary
        finally:
            mongo.user_notifications.delete_many({"id": {"$regex": "^TESTP"}})
