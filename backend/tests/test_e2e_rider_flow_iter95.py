# Iteration 95 - Retest of iter94 fixes: amount_due (total - deposit), deliver notif/delivered_at/payment_status,
# orders-split buckets, reconcile -> cash_movements, postpone keeps 'reportee' + re-assign, staff/customer notifs,
# /deliveries/{oid}/assign attaches to delivery day. Run serially: pytest -n0 -p no:randomly. Cleanup: cleanup_iter95.py
import os, random, json
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import pytest, requests

BASE = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/") + "/api"
S = {}
PRODUCTS = [("e495e095-9ff1-4a8b-a461-3f140cdc4d7c", "Escarpins Bleu Nuit", 30500, None, None),
            ("c4b934c4-329c-4617-af4b-c3dd6b59a1a1", "Escarpins Rouge Perle", 34500, "38", "Rouge"),
            ("96dd7092-9ba7-49df-9125-0d5cc335207d", "Sandales Rouge Lanières", 28500, None, None)]
SELFIE = "data:image/jpeg;base64," + "A" * 1500
CNAME = "TEST_E2E Cliente95"


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


def cust_msgs(code):
    items = requests.get(f"{BASE}/public/account/notifications", headers=h(S["cust"])).json()["items"]
    return [n["msg"] for n in items if n.get("ref") == code]


def split():
    return requests.get(f"{BASE}/public/account/orders-split", headers=h(S["cust"])).json()


def session(rid, date):
    rows = requests.get(f"{BASE}/delivery-sessions", params={"rider_id": rid, "date": date}, headers=h(S["admin"])).json()
    return rows[0] if rows else None


def due(o):
    return max(0, o["total"] - (o.get("deposit_paid") or 0))


@pytest.fixture(scope="module", autouse=True)
def setup_module_state():
    S["admin"] = login("aouattaraesca@gmail.com", "Admin123!")["token"]
    m = login("manager.cocody@dinastore.ci", "Manager123!")
    S["mgr"], S["mgr_id"] = m["token"], m["user"]["id"]
    if m["user"].get("punch_required"):
        requests.post(f"{BASE}/attendance/check-in", json={"kind": "arrival", "selfie": SELFIE, "pin": "2222"}, headers=h(S["mgr"]))
    r1, r2 = login("rider1@dinastore.ci", "Rider123!"), login("rider2@dinastore.ci", "Rider123!")
    S.update(r1=r1["token"], r1id=r1["user"]["id"], r1name=r1["user"]["name"], r2=r2["token"], r2id=r2["user"]["id"], r2name=r2["user"]["name"])
    phone = f"+225 07 9{random.randint(1000000, 9999999)}"
    r = requests.post(f"{BASE}/public/customer-signup", json={"name": CNAME, "phone": phone, "pin": "739153"})
    assert r.status_code == 200, r.text
    S.update(cust=r.json()["token"], cid=r.json()["customer"]["id"], phone=phone)
    S["today"] = datetime.now(ZoneInfo("Africa/Abidjan")).date().isoformat()
    S["tomorrow"] = (datetime.now(ZoneInfo("Africa/Abidjan")) + timedelta(days=1)).date().isoformat()
    S["orders"] = []
    yield
    print("\nCREATED STATE:", json.dumps({k: v for k, v in S.items() if k not in ("admin", "mgr", "r1", "r2", "cust")}, default=str))


# ---------- S1: storefront order -> console + staff notification + customer split ----------
class TestS1Storefront:
    def test_place_four_orders(self):
        for i in range(4):
            pid, name, price, size, color = PRODUCTS[i % 3]
            body = {"items": [{"product_id": pid, "name": name, "price": price, "qty": 1, "size": size, "color": color}],
                    "customer": {"name": CNAME, "phone": S["phone"], "address": f"Rue TEST {i}, Cocody Angré", "quartier": "Angré"},
                    "channel": "web", "payment_method": "cod", "mode": "delivery", "delivery_zone": "Cocody", "delivery_fee": 1500,
                    "checkout_key": f"TEST_iter95_{S['cid']}_{i}"}
            r = requests.post(f"{BASE}/public/orders", json=body, headers=h(S["cust"]))
            assert r.status_code == 200, r.text
            d = r.json()
            S["orders"].append({"id": d["id"], "code": d["code"], "total": d["total"], "deposit": d.get("deposit_required", 0), "status0": d["status"]})
        print("orders", S["orders"])
        assert all(o["status0"] == "en_attente_acompte" for o in S["orders"])

    def test_staff_notification_acompte_attendu(self):
        items = requests.get(f"{BASE}/notifications", headers=h(S["mgr"])).json()
        items = items.get("items", items) if isinstance(items, dict) else items
        mine = [n for n in items if n.get("id") in {f"order-{o['id']}" for o in S["orders"]}]
        assert mine, "no staff notif for en_attente_acompte orders"
        assert all(n["title"] == "Nouvelle commande · acompte attendu" for n in mine)
        assert mine[0]["link"].startswith("/console/commandes/")

    def test_split_has_en_attente_acompte(self):
        codes = [x["code"] for x in split()["in_progress"]]
        assert all(o["code"] in codes for o in S["orders"])


# ---------- S2: confirm (deposit), prepare, assign ----------
class TestS2PrepareAssign:
    def test_mark_deposit_paid_notifies_customer(self):
        for o in S["orders"]:
            assert requests.patch(f"{BASE}/orders/{o['id']}/status", json={"status": "confirmee"}, headers=h(S["mgr"])).status_code == 400
            r = requests.post(f"{BASE}/orders/{o['id']}/mark-deposit-paid", json={"tx_ref": "TEST_WAVE_95"}, headers=h(S["mgr"]))
            assert r.status_code == 200, r.text
            o["deposit_paid"] = r.json()["amount"]
        assert any("confirmée" in m for m in cust_msgs(S["orders"][0]["code"]))

    def test_prep_en_preparation_and_prete_notify(self):
        for o in S["orders"]:
            r = requests.patch(f"{BASE}/orders/{o['id']}/status-v3", json={"status": "en_preparation"}, headers=h(S["mgr"]))
            assert r.status_code == 200, r.text
            for ln in requests.get(f"{BASE}/orders/{o['id']}/prep", headers=h(S["mgr"])).json()["lines"]:
                for _ in range(ln["qty"]):
                    rr = requests.post(f"{BASE}/orders/{o['id']}/prep/verify", json={"code": ln["expected_code"], "method": "scan", "line_index": ln["line_index"]}, headers=h(S["mgr"]))
                    assert rr.status_code == 200, rr.text
            r = requests.patch(f"{BASE}/orders/{o['id']}/status-v3", json={"status": "prete"}, headers=h(S["mgr"]))
            assert r.status_code == 200, r.text
        msgs = cust_msgs(S["orders"][0]["code"])
        print("cust msgs O1:", msgs)
        assert any("en préparation" in m for m in msgs) and any("prête" in m for m in msgs)
        sp = split()
        row = next(x for x in sp["in_progress"] if x["code"] == S["orders"][0]["code"])
        assert row["status"] == "prete"

    def test_assign_session_and_deliveries_assign(self):
        O = S["orders"]
        s1 = requests.post(f"{BASE}/delivery-sessions", json={"rider_id": S["r1id"], "rider_name": S["r1name"], "date": S["today"]}, headers=h(S["mgr"])).json()
        s2 = requests.post(f"{BASE}/delivery-sessions", json={"rider_id": S["r2id"], "rider_name": S["r2name"], "date": S["today"]}, headers=h(S["mgr"])).json()
        S.update(s1=s1["id"], s2=s2["id"])
        for sid, o in ((s1["id"], O[0]), (s1["id"], O[1]), (s2["id"], O[3])):
            r = requests.patch(f"{BASE}/delivery-sessions/{sid}/add-order", json={"order_id": o["id"]}, headers=h(S["mgr"]))
            assert r.status_code == 200, r.text
        # O3: /deliveries/assign to rider1 first, then reassign to rider2 -> must move between days
        r = requests.patch(f"{BASE}/deliveries/{O[2]['id']}/assign", json={"rider_id": S["r1id"], "rider_name": S["r1name"]}, headers=h(S["mgr"]))
        assert r.status_code == 200, r.text
        c = console_order(O[2]["code"])
        print("O3 after assign r1: session", c.get("session_id"), "delivery_date", c.get("delivery_date"))
        assert c["session_id"] == s1["id"], "assign did not attach to rider1 day"
        assert O[2]["id"] in session(S["r1id"], S["today"])["orders"]
        r = requests.patch(f"{BASE}/deliveries/{O[2]['id']}/assign", json={"rider_id": S["r2id"], "rider_name": S["r2name"]}, headers=h(S["mgr"]))
        assert r.status_code == 200, r.text
        assert O[2]["id"] in session(S["r2id"], S["today"])["orders"]
        assert O[2]["id"] not in session(S["r1id"], S["today"])["orders"], "still in previous rider's day"
        assert console_order(O[2]["code"])["session_id"] == s2["id"]

    def test_customer_assigned_notifs(self):
        for o in S["orders"]:
            assert any("confiée à un livreur" in m for m in cust_msgs(o["code"])), f"no assignee notif for {o['code']}"

    def test_rider_today_amount_due(self):
        O = S["orders"]
        t1 = requests.get(f"{BASE}/riders/me/today", headers=h(S["r1"])).json()
        c1 = {o["code"]: o for o in t1["orders"]}
        x = c1[O[0]["code"]]
        print("O1 total", x["total"], "deposit_paid", x.get("deposit_paid"), "amount_due", x.get("amount_due"), "to_collect", t1["to_collect"], "n", len(t1["orders"]))
        assert x["amount_due"] == due(O[0]) and x["deposit_paid"] == O[0]["deposit_paid"]
        assert O[2]["code"] not in c1 or c1[O[2]["code"]].get("readonly")
        exp = sum(o["amount_due"] for o in t1["orders"] if not o.get("readonly") and o["status"] not in ("livree", "annulee", "echouee", "retournee", "refusee", "reportee"))
        assert t1["to_collect"] == exp
        t2 = {o["code"]: o for o in requests.get(f"{BASE}/riders/me/today", headers=h(S["r2"])).json()["orders"]}
        assert O[2]["code"] in t2 and O[3]["code"] in t2 and O[0]["code"] not in t2

    def test_session_total_to_collect(self):
        s1 = session(S["r1id"], S["today"])
        d = {o["id"]: o for o in s1["orders_detail"]}
        assert d[S["orders"][0]["id"]]["amount_due"] == due(S["orders"][0])
        postponed = s1.get("postponed", {})
        exp = sum(o["amount_due"] for o in s1["orders_detail"] if o["id"] not in postponed)
        assert s1["total_to_collect"] == exp

    def test_rider_security_and_link(self):
        O = S["orders"]
        hit = [n for n in rider_notifs(S["r1"]) if n.get("ref") == O[0]["code"] and n["title"] == "Nouvelle course attribuée"]
        assert hit and hit[0]["link"] == f"/riders?course={O[0]['code']}"
        assert requests.get(f"{BASE}/riders/me/orders/{O[0]['code']}", headers=h(S["r2"])).status_code == 404
        assert requests.patch(f"{BASE}/orders/{O[0]['id']}/status", json={"status": "en_livraison"}, headers=h(S["r2"])).status_code == 403
        assert requests.post(f"{BASE}/orders/{O[0]['id']}/deliver", json={"method": "code", "code": "0000"}, headers=h(S["r2"])).status_code == 403


# ---------- S3: start + deliver ----------
class TestS3Deliver:
    def test_start_whatsapp_prepare_amount_due(self):
        o = S["orders"][0]
        assert requests.patch(f"{BASE}/orders/{o['id']}/status", json={"status": "en_livraison"}, headers=h(S["r1"])).status_code == 200
        ob = [m for m in requests.get(f"{BASE}/whatsapp-outbox", headers=h(S["admin"])).json() if m.get("order_id") == o["id"]]
        S["code1"] = console_order(o["code"])["delivery_code"]
        assert any(m.get("kind") == "delivery_code" and S["code1"] in m["message"] for m in ob)
        prep = [m["message"] for m in ob if "Préparez" in (m.get("message") or "")]
        print("WA prepare msgs:", prep)
        assert prep and f"Préparez {int(due(o))} FCFA" in prep[0]

    def test_deliver_sets_fields_and_notifies(self):
        o = S["orders"][0]
        assert requests.post(f"{BASE}/orders/{o['id']}/deliver", json={"method": "code", "code": "9999" if S["code1"] != "9999" else "8888"}, headers=h(S["r1"])).status_code == 401
        r = requests.post(f"{BASE}/orders/{o['id']}/deliver", json={"method": "code", "code": S["code1"], "amount_collected": due(o)}, headers=h(S["r1"]))
        assert r.status_code == 200, r.text
        c = console_order(o["code"])
        assert c["status"] == "livree" and c.get("delivered_at") and c.get("payment_status") == "paye"
        assert any("livrée" in m for m in cust_msgs(o["code"]))
        assert o["code"] in [x["code"] for x in split()["delivered"]]


# ---------- S4: postpone + re-assign + fail ----------
class TestS4PostponeFail:
    def test_rider1_postpones_keeps_reportee(self):
        o = S["orders"][1]
        r = requests.patch(f"{BASE}/orders/{o['id']}/status", json={"status": "reportee", "reason": "TEST_ cliente absente", "next_date": S["tomorrow"]}, headers=h(S["r1"]))
        assert r.status_code == 200, r.text
        c = console_order(o["code"])
        assert c["status"] == "reportee" and not c.get("rider_id")
        assert c["delivery_date"] == S["tomorrow"] and c["rescheduled_for"] == S["tomorrow"]
        t1 = {x["code"]: x for x in requests.get(f"{BASE}/riders/me/today", headers=h(S["r1"])).json()["orders"]}
        assert t1[o["code"]]["status"] == "reportee" and t1[o["code"]].get("readonly")
        so = next(x for x in session(S["r1id"], S["today"])["orders_detail"] if x["id"] == o["id"])
        assert so.get("postponed_to") == S["tomorrow"]
        row = next(x for x in split()["in_progress"] if x["code"] == o["code"])
        assert row["status"] == "reportee"
        assert any("reportée" in m for m in cust_msgs(o["code"]))

    def test_reassign_postponed_via_delivery_day(self):
        o = S["orders"][1]
        s = requests.post(f"{BASE}/delivery-sessions", json={"rider_id": S["r2id"], "rider_name": S["r2name"], "date": S["tomorrow"]}, headers=h(S["mgr"])).json()
        S["s2_tomorrow"] = s["id"]
        r = requests.patch(f"{BASE}/delivery-sessions/{s['id']}/add-order", json={"order_id": o["id"]}, headers=h(S["mgr"]))
        assert r.status_code == 200, r.text
        c = console_order(o["code"])
        assert c["status"] == "assignee" and c["rider_id"] == S["r2id"] and c["delivery_date"] == S["tomorrow"]
        st = session(S["r2id"], S["tomorrow"])
        assert o["id"] in st["orders"] and st["total_to_collect"] >= due(o)

    def test_rider2_fails_in_cancelled_bucket(self):
        o = S["orders"][2]
        assert requests.patch(f"{BASE}/orders/{o['id']}/status", json={"status": "en_livraison"}, headers=h(S["r2"])).status_code == 200
        r = requests.patch(f"{BASE}/orders/{o['id']}/status", json={"status": "echouee", "reason": "TEST_ injoignable"}, headers=h(S["r2"]))
        assert r.status_code == 200, r.text
        assert any("non livrée" in m for m in cust_msgs(o["code"]))
        assert o["code"] in [x["code"] for x in split()["cancelled"]]


# ---------- S7: offline delivery ----------
class TestS7Offline:
    def test_offline_deliver_sync(self):
        o = S["orders"][3]
        assert requests.patch(f"{BASE}/orders/{o['id']}/status", json={"status": "en_livraison"}, headers=h(S["r2"])).status_code == 200
        code = console_order(o["code"])["delivery_code"]
        at = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        op = {"id": f"TEST_op95_{o['id'][:8]}", "seq": 1, "kind": "deliver", "order_id": o["id"], "at": at,
              "payload": {"method": "code", "code": code, "amount_collected": due(o)}}
        r = requests.post(f"{BASE}/rider/sync", json={"ops": [op]}, headers=h(S["r2"]))
        assert r.status_code == 200, r.text
        res = r.json()["results"][0]
        assert res["ok"] and not res.get("conflict"), res
        c = console_order(o["code"])
        assert c["status"] == "livree" and c["proof"].get("offline") and c.get("delivered_at") == at and c.get("payment_status") == "paye"
        assert requests.post(f"{BASE}/rider/sync", json={"ops": [op]}, headers=h(S["r2"])).json()["results"][0] == res
        assert any("livrée" in m for m in cust_msgs(o["code"]))


# ---------- S6: reconciliation -> cash movements / cash session ----------
class TestS6Reconciliation:
    def test_open_cash_session_if_none(self):
        open_ = [s for s in requests.get(f"{BASE}/cash-sessions", headers=h(S["admin"])).json() if not s.get("closed")]
        S["cash_preexisting_open"] = bool(open_)
        if open_:
            pytest.skip("a real cash session is already open; will not close it")
        r = requests.post(f"{BASE}/cash-sessions/open", json={"opening_cash": 0, "manager_id": S["mgr_id"], "session_date": datetime.now(timezone.utc).date().isoformat(), "pin": "2222", "note": "TEST_iter95"}, headers=h(S["mgr"]))
        assert r.status_code == 200, r.text
        S["cash_sid"] = r.json()["id"]

    def test_reconcile_creates_cash_movement(self):
        O = S["orders"]
        for sid, o in ((S["s1"], O[0]), (S["s2"], O[3])):
            assert requests.patch(f"{BASE}/delivery-sessions/{sid}/reconcile", json={"order_id": o["id"], "collected": True}, headers=h(S["mgr"])).status_code == 400
            r = requests.patch(f"{BASE}/delivery-sessions/{sid}/reconcile", json={"order_id": o["id"], "collected": True, "pin": "2222"}, headers=h(S["mgr"]))
            assert r.status_code == 200, r.text
            rec = r.json()["reconciliation"]
            assert rec["due"] == due(o) and rec["amount"] == due(o) and rec["ecart"] == 0
        mv = requests.get(f"{BASE}/cash-movements", headers=h(S["mgr"])).json()["movements"]
        refs = {m.get("ref"): m for m in mv}
        for sid, o in ((S["s1"], O[0]), (S["s2"], O[3])):
            m = refs.get(f"rider:{sid}:{o['id']}")
            assert m and m["type"] == "in" and m["kind"] == "rider_cod" and m["amount"] == due(o)
        s1 = session(S["r1id"], S["today"])
        assert s1["collected_total"] >= due(O[0])

    def test_unvalidate_removes_movement_then_revalidate(self):
        o, sid = S["orders"][0], S["s1"]
        r = requests.patch(f"{BASE}/delivery-sessions/{sid}/reconcile", json={"order_id": o["id"], "collected": False}, headers=h(S["mgr"]))
        assert r.status_code == 200
        refs = [m.get("ref") for m in requests.get(f"{BASE}/cash-movements", headers=h(S["mgr"])).json()["movements"]]
        assert f"rider:{sid}:{o['id']}" not in refs
        r = requests.patch(f"{BASE}/delivery-sessions/{sid}/reconcile", json={"order_id": o["id"], "collected": True, "pin": "2222"}, headers=h(S["mgr"]))
        assert r.status_code == 200
        refs = [m.get("ref") for m in requests.get(f"{BASE}/cash-movements", headers=h(S["mgr"])).json()["movements"]]
        assert refs.count(f"rider:{sid}:{o['id']}") == 1

    def test_cash_session_close_includes_rider_cod(self):
        if not S.get("cash_sid"):
            pytest.skip("no test cash session")
        r = requests.post(f"{BASE}/cash-sessions/{S['cash_sid']}/close", json={"closing_cash": 0, "pin": "2222", "note": "TEST_iter95"}, headers=h(S["mgr"]))
        assert r.status_code == 200, r.text
        sm = r.json()["summary"]
        print("cash close summary", sm)
        assert sm["ins"] >= due(S["orders"][0]) + due(S["orders"][3])
        assert sm["expected"] >= due(S["orders"][0]) + due(S["orders"][3])

    def test_rider_today_collected(self):
        t1 = requests.get(f"{BASE}/riders/me/today", headers=h(S["r1"])).json()
        assert t1["collected"] >= due(S["orders"][0])
