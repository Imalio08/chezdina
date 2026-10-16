# Final audit §15: catalogue images/variants, order flow, versement reject (rider), cash handover reject (gérante), AI parse/desc
# Run with: pytest tests/test_final_audit_15.py -n 0  (module cleanup is not xdist-safe)
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
R1 = mdb.users.find_one({"email": "rider1@dinastore.ci"})
MGR = mdb.users.find_one({"email": "manager.cocody@dinastore.ci"})
PFX = "TEST-AUD15"
CREATED_ORDER_IDS = []


def _now():
    return datetime.now(timezone.utc).isoformat()


def _login(email, pw):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    if r.status_code != 200:
        pytest.skip(f"login {email} failed {r.status_code} {r.text[:200]}")
    tok = r.json().get("token")
    if tok:
        s.headers["Authorization"] = f"Bearer {tok}"
    return s


@pytest.fixture(scope="module")
def admin():
    return _login("aouattaraesca@gmail.com", "Admin123!")


@pytest.fixture(scope="module")
def manager():
    mdb.attendance.insert_one({"id": "test-aud15-att", "user_id": MGR["id"], "user_name": MGR["name"], "role": "manager",
                               "day": datetime.now(timezone.utc).date().isoformat(), "kind": "arrival", "at": _now()})
    return _login("manager.cocody@dinastore.ci", "Manager123!")


@pytest.fixture(scope="module")
def sales():
    return _login("agent1@dinastore.ci", "Agent123!")


@pytest.fixture(scope="module")
def rider():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/rider-login-pin", json={"pin": "5555"})
    if r.status_code != 200:
        pytest.skip("rider login failed")
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return s


def _seed_order(status="livree", total=15000):
    oid = f"test-aud15-{uuid.uuid4().hex[:8]}"
    mdb.orders.insert_one({
        "id": oid, "code": f"{PFX}-{oid[-4:]}", "status": status, "rider_id": R1["id"], "rider_name": R1["name"],
        "created_at": _now(), "payment_method": "cod", "payment_status": "paye", "total": total, "subtotal": total,
        "delivery_fee": 0, "mode": "delivery", "customer": {"name": "TEST_Aud Cliente", "phone": "+225 07 00 15 15 15"},
        "items": [{"name": "TEST item", "qty": 1, "price": total, "product_id": "x"}], "timeline": [],
    })
    CREATED_ORDER_IDS.append(oid)
    return oid


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    codes = [o["code"] for o in mdb.orders.find({"id": {"$in": CREATED_ORDER_IDS}}, {"code": 1})]
    mdb.attendance.delete_many({"id": "test-aud15-att"})
    mdb.delivery_sessions.delete_many({"id": {"$regex": "^test-aud15"}})
    mdb.cash_sessions.delete_many({"id": {"$regex": "^test-aud15"}})
    mdb.notifications.delete_many({"$or": [{"title": {"$regex": PFX}}, {"link": {"$regex": "test-aud15"}}, {"msg": {"$regex": "TEST_AUD"}}]})
    mdb.user_notifications.delete_many({"$or": [{"ref": {"$in": codes}}, {"ref": {"$regex": "test-aud15"}}, {"title": {"$regex": PFX}}]})
    mdb.audit_log.delete_many({"entity_id": {"$regex": "test-aud15"}})
    mdb.audit_log.delete_many({"entity_id": {"$in": CREATED_ORDER_IDS}})
    mdb.invoices.delete_many({"order_id": {"$in": CREATED_ORDER_IDS}})
    mdb.whatsapp_outbox.delete_many({"order_id": {"$in": CREATED_ORDER_IDS}})
    mdb.orders.delete_many({"id": {"$in": CREATED_ORDER_IDS}})


# ---------- Catalogue: images + variants ----------
class TestCatalogue:
    def test_all_products_have_3_images_and_load(self):
        r = requests.get(f"{BASE_URL}/api/public/products")
        assert r.status_code == 200
        prods = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        assert len(prods) > 0
        assert all(len(p.get("images") or []) >= 3 for p in prods)
        # check that images of first 3 products load
        for p in prods[:3]:
            for img in p["images"][:3]:
                url = img if img.startswith("http") else f"{BASE_URL}{img}"
                rr = requests.get(url, timeout=20)
                assert rr.status_code == 200 and rr.headers.get("content-type", "").startswith("image"), url

    def test_variant_products_count(self):
        prods = list(mdb.products.find({"variants.0": {"$exists": True}}, {"_id": 0, "variants": 1, "colors": 1}))
        assert len(prods) >= 15
        assert all(len(p["colors"]) >= 1 for p in prods)

    def test_order_variant_decrements_and_cancel_restores(self, admin):
        p = mdb.products.find_one({"variants": {"$elemMatch": {"stock": {"$gte": 2}, "size": {"$ne": "Unique"}}}})
        v = next(x for x in p["variants"] if x["stock"] >= 2 and x["size"] != "Unique")
        before_v, before_s = v["stock"], p["stock"]
        r = requests.post(f"{BASE_URL}/api/public/orders", json={
            "items": [{"product_id": p["id"], "name": p["name"], "size": v["size"], "color": v["color"], "qty": 1, "price": p["price"]}],
            "customer": {"name": "TEST_AUD Var", "phone": "+225 07 00 15 15 16", "address": "Cocody"},
            "payment_method": "cod", "mode": "delivery", "delivery_fee": 0, "delivery_zone": "Cocody",
            "checkout_key": f"test-aud15-{uuid.uuid4().hex}"})
        assert r.status_code == 200, r.text
        oid = r.json()["id"]
        CREATED_ORDER_IDS.append(oid)
        p2 = mdb.products.find_one({"id": p["id"]})
        v2 = next(x for x in p2["variants"] if x["size"] == v["size"] and x["color"] == v["color"])
        assert v2["stock"] == before_v - 1, "variant stock not decremented"
        assert p2["stock"] == before_s - 1, "global stock not decremented"
        rc = admin.patch(f"{BASE_URL}/api/orders/{oid}/status", json={"status": "annulee", "reason": "TEST_AUD annulation"})
        assert rc.status_code == 200, rc.text
        p3 = mdb.products.find_one({"id": p["id"]})
        v3 = next(x for x in p3["variants"] if x["size"] == v["size"] and x["color"] == v["color"])
        # restore no matter what
        mdb.products.update_one({"id": p["id"], "variants": {"$elemMatch": {"size": v["size"], "color": v["color"]}}},
                                {"$set": {"variants.$.stock": before_v, "stock": before_s}})
        assert v3["stock"] == before_v and p3["stock"] == before_s, f"cancel did not restore: v={v3['stock']} s={p3['stock']}"
        mdb.customers.delete_many({"phone": {"$regex": "07 00 15 15 16|0700151516"}})


# ---------- §15.5 Rider versements reject / resubmit ----------
@pytest.fixture(scope="module")
def vsession():
    oid = _seed_order("livree", 15000)
    sid = f"test-aud15-ds-{uuid.uuid4().hex[:6]}"
    mdb.delivery_sessions.insert_one({"id": sid, "rider_id": R1["id"], "rider_name": R1["name"], "date": "2026-01-15",
                                      "orders": [oid], "reconciliations": {}, "closed": False, "created_at": _now()})
    return sid, oid


class TestVersementReject:
    def test_reject_requires_category_and_reason(self, admin, vsession):
        sid, oid = vsession
        r = admin.post(f"{BASE_URL}/api/delivery-sessions/{sid}/reject-versement", json={"order_id": oid, "reason": "abc"})
        assert r.status_code == 400
        r = admin.post(f"{BASE_URL}/api/delivery-sessions/{sid}/reject-versement", json={"order_id": oid, "category": "montant", "reason": ""})
        assert r.status_code == 400

    def test_sales_forbidden(self, sales, vsession):
        sid, oid = vsession
        r = sales.post(f"{BASE_URL}/api/delivery-sessions/{sid}/reject-versement", json={"order_id": oid, "category": "montant", "reason": "TEST_AUD x"})
        assert r.status_code == 403

    def test_reject_ok_and_close_blocked(self, admin, vsession):
        sid, oid = vsession
        r = admin.post(f"{BASE_URL}/api/delivery-sessions/{sid}/reject-versement",
                       json={"order_id": oid, "category": "montant", "reason": "TEST_AUD montant faux", "declared": 12000})
        assert r.status_code == 200, r.text
        rec = r.json()["reconciliation"]
        assert rec["rejected"] is True and rec["collected"] is False
        assert rec["category_label"] == "Montant incorrect" and rec["ecart"] == -3000
        assert rec["rejected_by"] and rec["rejected_at"]
        rc = admin.patch(f"{BASE_URL}/api/delivery-sessions/{sid}/close")
        assert rc.status_code == 400

    def test_rider_sees_and_resubmits(self, rider, vsession):
        sid, oid = vsession
        r = rider.get(f"{BASE_URL}/api/riders/me/versements-rejetes")
        assert r.status_code == 200
        row = next((x for x in r.json() if x["order_id"] == oid), None)
        assert row and row["reason"] == "TEST_AUD montant faux"
        rr = rider.post(f"{BASE_URL}/api/riders/me/versements/{sid}/{oid}/resubmit", json={"amount": 15000, "note": "TEST_AUD corrigé"})
        assert rr.status_code == 200
        assert mdb.notifications.find_one({"title": {"$regex": "Versement corrigé"}, "msg": {"$regex": "15000"}}) is not None
        mdb.notifications.delete_many({"title": {"$regex": f"Versement corrigé · {PFX}"}})

    def test_validate_after_reject(self, admin, vsession):
        sid, oid = vsession
        r = admin.patch(f"{BASE_URL}/api/delivery-sessions/{sid}/reconcile", json={"order_id": oid, "collected": True, "amount": 15000, "pin": "1234"})
        assert r.status_code == 200, r.text
        rec = r.json()["reconciliation"]
        assert rec["collected"] is True and not rec.get("rejected")
        decisions = [h["decision"] for h in rec["history"]]
        assert decisions == ["rejete", "resoumis", "valide"], decisions


# ---------- §15.6 Gérante cash handover ----------
@pytest.fixture(scope="module")
def csession():
    sid = f"test-aud15-cs-{uuid.uuid4().hex[:6]}"
    # closed=True so it never blocks a real "open session" check
    mdb.cash_sessions.insert_one({"id": sid, "opened_at": _now(), "opened_by": MGR["name"], "manager_id": MGR["id"],
                                  "session_date": "2026-01-15", "opening_cash": 10000, "closed": True, "expected": 50000, "status": "open"})
    return sid


class TestCashHandover:
    def test_validate_reject_non_pending_400(self, admin, csession):
        assert admin.post(f"{BASE_URL}/api/cash-sessions/{csession}/validate-handover", json={}).status_code == 400
        assert admin.post(f"{BASE_URL}/api/cash-sessions/{csession}/reject-handover", json={"reason": "x", "category": "montant"}).status_code == 400

    def test_manager_declares_and_cannot_decide(self, manager, csession):
        r = manager.post(f"{BASE_URL}/api/cash-sessions/{csession}/declare-handover", json={"amount": 45000, "note": "TEST_AUD"})
        assert r.status_code == 200, r.text
        assert manager.post(f"{BASE_URL}/api/cash-sessions/{csession}/validate-handover", json={}).status_code == 403
        assert manager.post(f"{BASE_URL}/api/cash-sessions/{csession}/reject-handover", json={"reason": "x"}).status_code == 403

    def test_reject_requires_reason(self, admin, csession):
        r = admin.post(f"{BASE_URL}/api/cash-sessions/{csession}/reject-handover", json={"category": "montant", "expected": 50000})
        assert r.status_code == 400

    def test_reject_requires_category(self, admin, csession):
        r = admin.post(f"{BASE_URL}/api/cash-sessions/{csession}/reject-handover", json={"reason": "TEST_AUD sans categorie", "expected": 50000})
        assert r.status_code == 400, "category should be mandatory (backend defaults to 'autre')"

    def test_reject_records_gap(self, admin, csession):
        # session may already be rejected by previous test if category was not enforced -> re-declare
        s = mdb.cash_sessions.find_one({"id": csession})
        if s.get("status") != "pending_validation":
            mdb.cash_sessions.update_one({"id": csession}, {"$set": {"status": "pending_validation", "handover_amount": 45000, "handover_by": MGR["name"], "handover_at": _now()}})
        r = admin.post(f"{BASE_URL}/api/cash-sessions/{csession}/reject-handover", json={"reason": "TEST_AUD écart", "category": "ecart", "expected": 50000})
        assert r.status_code == 200
        s = mdb.cash_sessions.find_one({"id": csession})
        assert s["status"] == "rejected" and s["rejection_gap"] == -5000 and s["rejection_declared"] == 45000
        assert s["rejection_expected"] == 50000 and s["rejection_category"] == "Écart de caisse" and s["rejected_by"]

    def test_manager_notified(self, csession):
        n = mdb.user_notifications.find_one({"ref": csession}) or mdb.notifications.find_one({"type": "handover_rejected", "link": {"$regex": csession}, "target_user_id": MGR["id"]})
        assert n is not None, "Gérante not targeted: reject_handover uses s['opened_by_id'] but sessions only store manager_id"

    def test_manager_redeclares_then_owner_validates(self, manager, admin, csession):
        assert manager.post(f"{BASE_URL}/api/cash-sessions/{csession}/declare-handover", json={"amount": 50000, "note": "TEST_AUD v2"}).status_code == 200
        r = admin.post(f"{BASE_URL}/api/cash-sessions/{csession}/validate-handover", json={"expected": 50000, "actual": 50000})
        assert r.status_code == 200 and r.json()["status"] == "validated"
        hist = [h["decision"] for h in mdb.cash_sessions.find_one({"id": csession})["handover_history"]]
        assert hist[-1] == "valide" and "rejete" in hist

    def test_cannot_redeclare_after_validated(self, manager, csession):
        r = manager.post(f"{BASE_URL}/api/cash-sessions/{csession}/declare-handover", json={"amount": 1, "note": "TEST_AUD v3"})
        assert r.status_code == 400, "declare-handover has no status guard: validated session can be reset to pending"


# ---------- §15.2 status flow ----------
class TestOrderFlow:
    def test_flow_and_scan_guard(self, admin):
        oid = _seed_order("nouvelle", 9000)
        for st in ("confirmee", "en_preparation"):
            r = admin.patch(f"{BASE_URL}/api/orders/{oid}/status-v3", json={"status": st})
            assert r.status_code == 200, (st, r.text)
            assert mdb.orders.find_one({"id": oid})["status"] == st
        mdb.orders.update_one({"id": oid}, {"$set": {"items": [{"name": "a", "qty": 1, "price": 1, "product_id": "x"}, {"name": "b", "qty": 2, "price": 1, "product_id": "y"}]}})
        r = admin.patch(f"{BASE_URL}/api/orders/{oid}/status-v3", json={"status": "prete", "scanned_items": [{"line_index": 0, "scanned": True}]})
        assert r.status_code == 400
        r = admin.patch(f"{BASE_URL}/api/orders/{oid}/status-v3", json={"status": "prete", "scanned_items": [{"line_index": 0, "scanned": False, "manual": False}, {"line_index": 1, "scanned": False, "manual": False}]})
        assert r.status_code == 400, "backend accepts 'prete' with unscanned lines (only checks count)"


# ---------- §15.4 AI ----------
class TestAI:
    def test_parse_order(self, admin):
        p = list(mdb.products.find({}, {"name": 1, "id": 1}).limit(2))
        txt = f"Bonjour Dina ! Je veux 2 {p[0]['name']} et 1 {p[1]['name']} svp. C'est TEST_Awa Koné 0707151517, Cocody Riviera 2"
        r = admin.post(f"{BASE_URL}/api/ai/parse-order", json={"text": txt}, timeout=90)
        assert r.status_code == 200
        d = r.json()
        assert not d.get("error"), d
        ids = {i.get("product_id") for i in d["items"]}
        assert p[0]["id"] in ids and p[1]["id"] in ids, d
        q = {i["product_id"]: i["qty"] for i in d["items"] if i.get("product_id")}
        assert q[p[0]["id"]] == 2
        assert "0707151517" in (d.get("customer_hint", {}).get("phone") or "").replace(" ", "")

    def test_product_description(self, admin):
        r = admin.post(f"{BASE_URL}/api/ai/product-description", json={"name": "Robe pagne wax", "category": "Robes", "colors": ["Rouge"], "sizes": ["M"]}, timeout=90)
        assert r.status_code == 200
        d = r.json()
        assert not d.get("fallback") and len(d["description"]) > 80
        low = d["description"].lower()
        assert "best-seller" not in low and "fcfa" not in low
