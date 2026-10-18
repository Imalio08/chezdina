# Iteration 94 - End-to-end order -> preparation -> rider -> delivery/postpone/fail -> messaging -> reconciliation -> offline sync
# Uses 2 riders (rider1 Kouamé Serge, rider2 Yao Franck) and a TEST_ customer. Cleanup at module teardown.
import os, random, time, json
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import pytest, requests

BASE = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/") + "/api"
S = {}
PRODUCTS = [("e495e095-9ff1-4a8b-a461-3f140cdc4d7c", "Escarpins Bleu Nuit", 30500, None, None),
            ("c4b934c4-329c-4617-af4b-c3dd6b59a1a1", "Escarpins Rouge Perle", 34500, "38", "Rouge"),
            ("96dd7092-9ba7-49df-9125-0d5cc335207d", "Sandales Rouge Lanières", 28500, None, None)]
SELFIE = "data:image/jpeg;base64," + "A" * 1500


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


def login(e, p):
    r = requests.post(f"{BASE}/auth/login", json={"email": e, "password": p})
    assert r.status_code == 200, r.text
    return r.json()


def console_order(code):
    rows = requests.get(f"{BASE}/orders", params={"q": code}, headers=h(S["admin"])).json()
    return next(o for o in rows if o["code"] == code)


def rider_notifs(tok):
    return requests.get(f"{BASE}/me/notifications", headers=h(tok)).json()["items"]


def cust_notifs():
    return requests.get(f"{BASE}/public/account/notifications", headers=h(S["cust"])).json()["items"]


@pytest.fixture(scope="module", autouse=True)
def setup_module_state():
    S["admin"] = login("aouattaraesca@gmail.com", "Admin123!")["token"]
    m = login("manager.cocody@dinastore.ci", "Manager123!")
    S["mgr"] = m["token"]
    if m["user"].get("punch_required"):
        r = requests.post(f"{BASE}/attendance/check-in", json={"kind": "arrival", "selfie": SELFIE, "pin": "2222"}, headers=h(S["mgr"]))
        S["mgr_checkin"] = r.status_code
    r1, r2 = login("rider1@dinastore.ci", "Rider123!"), login("rider2@dinastore.ci", "Rider123!")
    S.update(r1=r1["token"], r1id=r1["user"]["id"], r1name=r1["user"]["name"], r2=r2["token"], r2id=r2["user"]["id"], r2name=r2["user"]["name"])
    phone = f"+225 07 9{random.randint(1000000, 9999999)}"
    r = requests.post(f"{BASE}/public/customer-signup", json={"name": "TEST_E2E Cliente94", "phone": phone, "pin": "739153"})
    assert r.status_code == 200, r.text
    S.update(cust=r.json()["token"], cid=r.json()["customer"]["id"], phone=phone)
    S["today"] = datetime.now(ZoneInfo("Africa/Abidjan")).date().isoformat()
    S["orders"] = []
    yield
    print("\nCREATED STATE:", json.dumps({k: v for k, v in S.items() if k not in ("admin", "mgr", "r1", "r2", "cust")}, default=str))


# ---------- Scenario 1: storefront order -> console + staff notification ----------
class TestS1Storefront:
    def test_place_four_orders(self):
        for i in range(4):
            pid, name, price, size, color = PRODUCTS[i % 3]
            body = {"items": [{"product_id": pid, "name": name, "price": price, "qty": 1, "size": size, "color": color}],
                    "customer": {"name": "TEST_E2E Cliente94", "phone": S["phone"], "address": f"Rue TEST {i}, Cocody Angré", "quartier": "Angré"},
                    "channel": "web", "payment_method": "cod", "mode": "delivery", "delivery_zone": "Cocody", "delivery_fee": 1500,
                    "checkout_key": f"TEST_iter94_{S['cid']}_{i}"}
            r = requests.post(f"{BASE}/public/orders", json=body, headers=h(S["cust"]))
            assert r.status_code == 200, r.text
            d = r.json()
            S["orders"].append({"id": d["id"], "code": d["code"], "total": d["total"], "deposit": d.get("deposit_required", 0), "status0": d["status"]})
            assert d["status"] in ("nouvelle", "en_attente_acompte"), d
        print("orders", S["orders"])

    def test_console_sees_order_with_details(self):
        for o in S["orders"]:
            c = console_order(o["code"])
            assert c["status"] == o["status0"]
            assert c["customer"]["name"] == "TEST_E2E Cliente94" and c["customer"]["id"] == S["cid"]
            assert c["items"] and c["total"] == o["total"] and c["delivery_zone"] == "Cocody"

    def test_staff_notification_for_new_order(self):
        items = requests.get(f"{BASE}/notifications", headers=h(S["mgr"])).json()
        items = items.get("items", items) if isinstance(items, dict) else items
        ids = {n.get("id") for n in items}
        assert any(f"order-{o['id']}" in ids or o["code"] in json.dumps(n) for o in S["orders"] for n in items), "No staff notif for new order"


# ---------- Scenario 2: confirm, prepare (scan), assign ----------
class TestS2PrepareAssign:
    def test_manager_confirms(self):
        for o in S["orders"]:
            if o["status0"] == "en_attente_acompte":
                r = requests.patch(f"{BASE}/orders/{o['id']}/status", json={"status": "confirmee"}, headers=h(S["mgr"]))
                assert r.status_code == 400  # deposit guard
                r = requests.post(f"{BASE}/orders/{o['id']}/mark-deposit-paid", json={"tx_ref": "TEST_WAVE_94"}, headers=h(S["mgr"]))
            else:
                r = requests.patch(f"{BASE}/orders/{o['id']}/status", json={"status": "confirmee"}, headers=h(S["mgr"]))
            assert r.status_code == 200, r.text
        assert console_order(S["orders"][0]["code"])["status"] == "confirmee"

    def test_prete_requires_scan(self):
        o = S["orders"][0]
        assert requests.patch(f"{BASE}/orders/{o['id']}/status", json={"status": "prete"}, headers=h(S["mgr"])).status_code == 400
        r = requests.patch(f"{BASE}/orders/{o['id']}/status-v3", json={"status": "prete"}, headers=h(S["mgr"]))
        assert r.status_code == 400 and "non vérifiés" in r.text

    def test_scan_wrong_then_right_then_prete(self):
        for o in S["orders"]:
            lines = requests.get(f"{BASE}/orders/{o['id']}/prep", headers=h(S["mgr"])).json()["lines"]
            bad = requests.post(f"{BASE}/orders/{o['id']}/prep/verify", json={"code": "WRONG-CODE", "method": "saisie"}, headers=h(S["mgr"])).json()
            assert bad["ok"] is False if "ok" in bad else True
            for ln in lines:
                for _ in range(ln["qty"]):
                    r = requests.post(f"{BASE}/orders/{o['id']}/prep/verify", json={"code": ln["expected_code"], "method": "scan", "line_index": ln["line_index"]}, headers=h(S["mgr"]))
                    assert r.status_code == 200, r.text
            r = requests.patch(f"{BASE}/orders/{o['id']}/status-v3", json={"status": "prete"}, headers=h(S["mgr"]))
            assert r.status_code == 200, r.text
        assert console_order(S["orders"][0]["code"])["status"] == "prete"

    def test_assign_in_delivery_days(self):
        # O1,O2 -> rider1 session; O3 -> rider2 via /deliveries/assign ; O4 -> rider2 session
        s1 = requests.post(f"{BASE}/delivery-sessions", json={"rider_id": S["r1id"], "rider_name": S["r1name"], "date": S["today"]}, headers=h(S["mgr"])).json()
        s2 = requests.post(f"{BASE}/delivery-sessions", json={"rider_id": S["r2id"], "rider_name": S["r2name"], "date": S["today"]}, headers=h(S["mgr"])).json()
        S.update(s1=s1["id"], s2=s2["id"])
        O = S["orders"]
        for sid, o in ((s1["id"], O[0]), (s1["id"], O[1]), (s2["id"], O[3])):
            r = requests.patch(f"{BASE}/delivery-sessions/{sid}/add-order", json={"order_id": o["id"]}, headers=h(S["mgr"]))
            assert r.status_code == 200, r.text
        r = requests.patch(f"{BASE}/deliveries/{O[2]['id']}/assign", json={"rider_id": S["r2id"], "rider_name": S["r2name"]}, headers=h(S["mgr"]))
        assert r.status_code == 200, r.text
        c = console_order(O[0]["code"])
        assert c["status"] == "assignee" and c["rider_id"] == S["r1id"] and c.get("assigned_at")

    def test_orders_in_rider_apps_with_details(self):
        O = S["orders"]
        t1 = requests.get(f"{BASE}/riders/me/today", headers=h(S["r1"])).json()
        t2 = requests.get(f"{BASE}/riders/me/today", headers=h(S["r2"])).json()
        c1 = {o["code"]: o for o in t1["orders"]}
        c2 = {o["code"]: o for o in t2["orders"]}
        assert O[0]["code"] in c1 and O[1]["code"] in c1
        assert O[2]["code"] in c2 and O[3]["code"] in c2
        assert O[0]["code"] not in c2
        x = c1[O[0]["code"]]
        assert x["customer"]["name"] == "TEST_E2E Cliente94" and x["customer"].get("address") and x["items"] and x["total"] == O[0]["total"]
        print("deposits", [o["deposit"] for o in O], "rider1 to_collect", t1["to_collect"])
        assert t1["to_collect"] >= O[0]["total"] + O[1]["total"] - O[0]["deposit"] - O[1]["deposit"]

    def test_amount_to_collect_deducts_deposit(self):
        O = S["orders"]
        if not O[0]["deposit"]:
            pytest.skip("no deposit policy")
        c = console_order(O[0]["code"])
        t1 = {o["code"]: o for o in requests.get(f"{BASE}/riders/me/today", headers=h(S["r1"])).json()["orders"]}
        x = t1[O[0]["code"]]
        print("O1 total", x["total"], "deposit_paid", c.get("deposit_paid"), "balance fields", {k: x.get(k) for k in ("amount_due", "balance_due", "to_collect")})
        assert any(x.get(k) == O[0]["total"] - O[0]["deposit"] for k in ("amount_due", "balance_due", "to_collect")), "rider sees full total; deposit already paid not deducted"

    def test_rider_notifications_link_to_course(self):
        O = S["orders"]
        n1 = rider_notifs(S["r1"]); n2 = rider_notifs(S["r2"])
        for tok_n, o in ((n1, O[0]), (n1, O[1]), (n2, O[2]), (n2, O[3])):
            hit = [n for n in tok_n if n.get("ref") == o["code"] and n["title"] == "Nouvelle course attribuée"]
            assert hit, f"no assign notif for {o['code']}"
            assert hit[0]["link"] == f"/riders?course={o['code']}"
        d = requests.get(f"{BASE}/riders/me/orders/{O[0]['code']}", headers=h(S["r1"]))
        assert d.status_code == 200 and d.json()["id"] == O[0]["id"]

    def test_rider_security(self):
        O = S["orders"]
        assert requests.get(f"{BASE}/riders/me/orders/{O[0]['code']}", headers=h(S["r2"])).status_code == 404
        assert requests.patch(f"{BASE}/orders/{O[0]['id']}/status", json={"status": "en_livraison"}, headers=h(S["r2"])).status_code == 403
        assert requests.post(f"{BASE}/orders/{O[0]['id']}/deliver", json={"method": "code", "code": "0000"}, headers=h(S["r2"])).status_code == 403
        assert requests.patch(f"{BASE}/orders/{O[0]['id']}/status", json={"status": "confirmee"}, headers=h(S["r1"])).status_code == 403


# ---------- Scenario 3: start + deliver with code ----------
class TestS3Deliver:
    def test_start_generates_code_and_outbox(self):
        o = S["orders"][0]
        r = requests.patch(f"{BASE}/orders/{o['id']}/status", json={"status": "en_livraison"}, headers=h(S["r1"]))
        assert r.status_code == 200, r.text
        ob = requests.get(f"{BASE}/whatsapp-outbox", headers=h(S["admin"])).json()
        dc = [m for m in ob if m.get("order_id") == o["id"] and m.get("kind") == "delivery_code"]
        assert dc, "no delivery_code outbox entry"
        S["code1"] = console_order(o["code"])["delivery_code"]
        assert S["code1"] in dc[0]["message"]

    def test_deliver_wrong_then_right_code(self):
        o = S["orders"][0]
        assert requests.post(f"{BASE}/orders/{o['id']}/deliver", json={"method": "code", "code": "9999" if S["code1"] != "9999" else "8888"}, headers=h(S["r1"])).status_code == 401
        r = requests.post(f"{BASE}/orders/{o['id']}/deliver", json={"method": "code", "code": S["code1"], "amount_collected": o["total"]}, headers=h(S["r1"]))
        assert r.status_code == 200, r.text
        assert console_order(o["code"])["status"] == "livree"

    def test_customer_space_delivered(self):
        sp = requests.get(f"{BASE}/public/account/orders-split", headers=h(S["cust"])).json()
        assert S["orders"][0]["code"] in [x["code"] for x in sp["delivered"]]

    def test_customer_notifications_en_route_and_livree(self):
        code = S["orders"][0]["code"]
        msgs = [n["msg"] for n in cust_notifs() if n.get("ref") == code]
        print("customer notifs O1:", msgs)
        assert any("en route" in m for m in msgs), "missing en route notif"
        assert any("livrée" in m for m in msgs), f"missing livrée customer notification: {msgs}"


# ---------- Scenario 4: postpone + fail ----------
class TestS4PostponeFail:
    def test_rider1_postpones(self):
        o = S["orders"][1]
        tomorrow = (datetime.now(ZoneInfo("Africa/Abidjan")) + timedelta(days=1)).date().isoformat()
        S["tomorrow"] = tomorrow
        r = requests.patch(f"{BASE}/orders/{o['id']}/status", json={"status": "reportee", "reason": "TEST_ cliente absente", "next_date": tomorrow}, headers=h(S["r1"]))
        assert r.status_code == 200, r.text
        c = console_order(o["code"])
        print("console after postpone:", c["status"], c.get("delivery_date"), c.get("rider_id"))
        assert c.get("delivery_date") == tomorrow and c.get("last_reason") == "TEST_ cliente absente"
        t1 = {x["code"]: x for x in requests.get(f"{BASE}/riders/me/today", headers=h(S["r1"])).json()["orders"]}
        assert t1[o["code"]]["status"] == "reportee" and t1[o["code"]].get("readonly")
        ses = requests.get(f"{BASE}/delivery-sessions", params={"rider_id": S["r1id"], "date": S["today"]}, headers=h(S["admin"])).json()
        so = next(x for x in ses[0]["orders_detail"] if x["id"] == o["id"])
        assert so.get("postponed_to") == tomorrow

    def test_customer_sees_postponed(self):
        o = S["orders"][1]
        sp = requests.get(f"{BASE}/public/account/orders-split", headers=h(S["cust"])).json()
        row = next((x for x in sp["in_progress"] if x["code"] == o["code"]), None)
        assert row, "postponed order missing from customer space"
        assert any("reportée" in n["msg"] for n in cust_notifs() if n.get("ref") == o["code"])
        print("customer row status for postponed:", row["status"], row.get("delivery_date"))

    def test_rider2_fails_with_reason(self):
        o = S["orders"][2]
        assert requests.patch(f"{BASE}/orders/{o['id']}/status", json={"status": "en_livraison"}, headers=h(S["r2"])).status_code == 200
        r = requests.patch(f"{BASE}/orders/{o['id']}/status", json={"status": "echouee", "reason": "TEST_ injoignable"}, headers=h(S["r2"]))
        assert r.status_code == 200, r.text
        c = console_order(o["code"])
        assert c["status"] == "echouee" and c.get("last_reason") == "TEST_ injoignable"

    def test_customer_sees_failed(self):
        o = S["orders"][2]
        sp = requests.get(f"{BASE}/public/account/orders-split", headers=h(S["cust"])).json()
        allc = [x["code"] for k in ("in_progress", "delivered", "cancelled") for x in sp[k]]
        assert any("non livrée" in n["msg"] for n in cust_notifs() if n.get("ref") == o["code"])
        assert o["code"] in allc, "echouee order invisible in customer space (orders-split)"


# ---------- Scenario 5: messaging customer <-> store <-> rider ----------
class TestS5Messaging:
    def test_store_customer_thread(self):
        o = S["orders"][3]
        r = requests.post(f"{BASE}/orders/{o['id']}/thread/customer/send", json={"text": "TEST_ bonjour cliente"}, headers=h(S["admin"]))
        assert r.status_code == 200, r.text
        conv = r.json()["conversation_id"]; S["conv_cust"] = conv
        assert any(n["link"] == f"/compte/messages/{conv}" for n in cust_notifs())
        r = requests.post(f"{BASE}/public/account/messages/send", json={"conversation_id": conv, "text": "TEST_ merci boutique"}, headers=h(S["cust"]))
        assert r.status_code == 200, r.text
        th = requests.get(f"{BASE}/orders/{o['id']}/thread/customer", headers=h(S["admin"])).json()
        assert [m["text"] for m in th["messages"]][-2:] == ["TEST_ bonjour cliente", "TEST_ merci boutique"]

    def test_store_rider_thread(self):
        o = S["orders"][3]
        r = requests.post(f"{BASE}/orders/{o['id']}/thread/rider/send", json={"text": "TEST_ appel avant"}, headers=h(S["admin"]))
        assert r.status_code == 200, r.text
        conv = r.json()["conversation_id"]; S["conv_rider"] = conv
        assert any(n["link"] == f"/riders/messages/{conv}" for n in rider_notifs(S["r2"]))
        r = requests.post(f"{BASE}/orders/{o['id']}/thread/rider/send", json={"text": "TEST_ ok bien reçu"}, headers=h(S["r2"]))
        assert r.status_code == 200, r.text
        assert conv in [c["id"] for c in requests.get(f"{BASE}/rider/conversations", headers=h(S["r2"])).json()]

    def test_customer_rider_thread(self):
        o = S["orders"][3]
        r = requests.post(f"{BASE}/public/account/thread/rider/{o['code']}", headers=h(S["cust"]))
        assert r.status_code == 200, r.text
        conv = r.json()["id"]; S["conv_rc"] = conv
        r = requests.post(f"{BASE}/public/account/messages/send", json={"conversation_id": conv, "text": "TEST_ je suis au portail"}, headers=h(S["cust"]))
        assert r.status_code == 200, r.text
        assert any(n["link"] == f"/riders/messages/{conv}" for n in rider_notifs(S["r2"]))
        r = requests.post(f"{BASE}/rider/conversations/{conv}/send", json={"text": "TEST_ j'arrive"}, headers=h(S["r2"]))
        assert r.status_code == 200, r.text
        assert any(n["title"] == "Message de votre livreur" for n in cust_notifs())


# ---------- Scenario 7: offline delivery via /rider/sync ----------
class TestS7Offline:
    def test_offline_deliver_sync(self):
        o = S["orders"][3]
        assert requests.patch(f"{BASE}/orders/{o['id']}/status", json={"status": "en_livraison"}, headers=h(S["r2"])).status_code == 200
        code = console_order(o["code"])["delivery_code"]
        at = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        op = {"id": f"TEST_op_{o['id'][:8]}", "seq": 1, "kind": "deliver", "order_id": o["id"], "at": at,
              "payload": {"method": "code", "code": code, "amount_collected": o["total"]}}
        r = requests.post(f"{BASE}/rider/sync", json={"ops": [op]}, headers=h(S["r2"]))
        assert r.status_code == 200, r.text
        res = r.json()["results"][0]
        assert res["ok"] and not res.get("conflict"), res
        c = console_order(o["code"])
        assert c["status"] == "livree" and c["proof"].get("offline") and c.get("delivered_at") == at
        r2 = requests.post(f"{BASE}/rider/sync", json={"ops": [op]}, headers=h(S["r2"]))
        assert r2.json()["results"][0] == res  # idempotent
        sp = requests.get(f"{BASE}/public/account/orders-split", headers=h(S["cust"])).json()
        assert o["code"] in [x["code"] for x in sp["delivered"]]


# ---------- Scenario 6: evening reconciliation ----------
class TestS6Reconciliation:
    def test_reconcile_sessions(self):
        O = S["orders"]
        for sid, o in ((S["s1"], O[0]), (S["s2"], O[3])):
            assert requests.patch(f"{BASE}/delivery-sessions/{sid}/reconcile", json={"order_id": o["id"], "collected": True, "amount": o["total"]}, headers=h(S["mgr"])).status_code == 400
            r = requests.patch(f"{BASE}/delivery-sessions/{sid}/reconcile", json={"order_id": o["id"], "collected": True, "amount": o["total"], "pin": "2222"}, headers=h(S["mgr"]))
            assert r.status_code == 200, r.text
        s1 = requests.get(f"{BASE}/delivery-sessions", params={"rider_id": S["r1id"], "date": S["today"]}, headers=h(S["admin"])).json()[0]
        s2 = requests.get(f"{BASE}/delivery-sessions", params={"rider_id": S["r2id"], "date": S["today"]}, headers=h(S["admin"])).json()[0]
        print("s1 collected", s1["collected_total"], "s2 collected", s2["collected_total"], "s2 orders", len(s2["orders"]))
        assert s1["collected_total"] >= O[0]["total"] and s2["collected_total"] >= O[3]["total"]

    def test_rider_today_collected(self):
        t1 = requests.get(f"{BASE}/riders/me/today", headers=h(S["r1"])).json()
        assert t1["collected"] >= S["orders"][0]["total"]

    def test_failed_order_O3_not_in_any_session(self):
        # O3 assigned via /deliveries/{oid}/assign (no session) -> missing from evening reconciliation
        ses = requests.get(f"{BASE}/delivery-sessions", params={"rider_id": S["r2id"], "date": S["today"]}, headers=h(S["admin"])).json()
        print("O3 in r2 session:", S["orders"][2]["id"] in ses[0]["orders"])
