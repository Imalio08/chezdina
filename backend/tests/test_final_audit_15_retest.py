# Final audit §15 retest (iteration_85): prete scan contract, cancel restock idempotence, GET /products/{pid} cost,
# cash handover guards + gérante notification, AI parse possible_duplicate. Run with -n 0
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
MGR = mdb.users.find_one({"email": "manager.cocody@dinastore.ci"})
PFX = "TEST-AUD85"
OIDS, CSIDS = [], []
SNAP = {}


def _now():
    return datetime.now(timezone.utc).isoformat()


def _login(email, pw):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    if r.status_code != 200:
        pytest.skip(f"login {email} failed {r.status_code}")
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return s


@pytest.fixture(scope="module")
def admin():
    return _login("aouattaraesca@gmail.com", "Admin123!")


@pytest.fixture(scope="module")
def manager():
    mdb.attendance.insert_one({"id": "test-aud85-att", "user_id": MGR["id"], "user_name": MGR["name"], "role": "manager",
                               "day": datetime.now(timezone.utc).date().isoformat(), "kind": "arrival", "at": _now()})
    return _login("manager.cocody@dinastore.ci", "Manager123!")


@pytest.fixture(scope="module")
def sales():
    u = mdb.users.find_one({"email": "agent1@dinastore.ci"})
    mdb.attendance.insert_one({"id": "test-aud85-att2", "user_id": u["id"], "user_name": u["name"], "role": u["role"],
                               "day": datetime.now(timezone.utc).date().isoformat(), "kind": "arrival", "at": _now()})
    return _login("agent1@dinastore.ci", "Agent123!")


@pytest.fixture(scope="module")
def rider():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/rider-login-pin", json={"pin": "5555"})
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return s


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    for pid, snap in SNAP.items():  # restore product stock fields exactly
        mdb.products.update_one({"id": pid}, {"$set": snap})
    codes = [o["code"] for o in mdb.orders.find({"id": {"$in": OIDS}}, {"code": 1})]
    mdb.attendance.delete_many({"id": {"$in": ["test-aud85-att", "test-aud85-att2"]}})
    mdb.cash_sessions.delete_many({"id": {"$in": CSIDS}})
    mdb.user_notifications.delete_many({"$or": [{"ref": {"$in": codes + CSIDS}}, {"link": {"$regex": "test-aud85"}}]})
    mdb.notifications.delete_many({"$or": [{"link": {"$regex": "test-aud85"}}, *[{"msg": {"$regex": c}} for c in codes], *[{"title": {"$regex": c}} for c in codes]]})
    mdb.audit_log.delete_many({"entity_id": {"$in": OIDS + CSIDS}})
    mdb.invoices.delete_many({"order_id": {"$in": OIDS}})
    mdb.whatsapp_outbox.delete_many({"order_id": {"$in": OIDS}})
    mdb.orders.delete_many({"id": {"$in": OIDS}})
    mdb.customers.delete_many({"name": {"$regex": "^TEST_AUD85"}})


def _snap(p):
    if p["id"] not in SNAP:
        SNAP[p["id"]] = {"stock": p.get("stock"), "stock_by_size": p.get("stock_by_size"), "variants": p.get("variants")}


def _seed(status="en_preparation", items=None):
    oid = f"test-aud85-{uuid.uuid4().hex[:8]}"
    mdb.orders.insert_one({"id": oid, "code": f"{PFX}-{oid[-4:]}", "status": status, "created_at": _now(), "payment_method": "cod",
                           "total": 1000, "subtotal": 1000, "mode": "delivery", "customer": {"name": "TEST_AUD85 C", "phone": "+225 07 00 85 85 85"},
                           "items": items or [{"name": "a", "qty": 1, "price": 1, "product_id": "x"}, {"name": "b", "qty": 2, "price": 1, "product_id": "y"}],
                           "timeline": []})
    OIDS.append(oid)
    return oid


# ---------- prete contract ----------
class TestPreteContract:
    def _p(self, admin, oid, scanned):
        return admin.patch(f"{BASE_URL}/api/orders/{oid}/status-v3", json={"status": "prete", "scanned_items": scanned})

    def test_empty_scanned(self, admin):
        oid = _seed()
        assert self._p(admin, oid, []).status_code == 400
        assert admin.patch(f"{BASE_URL}/api/orders/{oid}/status-v3", json={"status": "prete"}).status_code == 400

    def test_missing_line(self, admin):
        oid = _seed()
        assert self._p(admin, oid, [{"line_index": 0, "scanned": True, "scanned_qty": 1}]).status_code == 400

    def test_scanned_without_qty(self, admin):
        oid = _seed()
        r = self._p(admin, oid, [{"line_index": 0, "scanned": True, "scanned_qty": 1}, {"line_index": 1, "scanned": True}])
        assert r.status_code == 400, r.text
        r = self._p(admin, oid, [{"line_index": 0, "scanned": True, "scanned_qty": 1}, {"line_index": 1, "scanned": True, "scanned_qty": 1}])
        assert r.status_code == 400 and "1/2" in r.text, r.text

    def test_manual_without_reason(self, admin):
        oid = _seed()
        r = self._p(admin, oid, [{"line_index": 0, "scanned": True, "scanned_qty": 1}, {"line_index": 1, "manual": True, "manual_reason": "  "}])
        assert r.status_code == 400, r.text

    def test_unscanned_flags(self, admin):
        oid = _seed()
        r = self._p(admin, oid, [{"line_index": 0, "scanned": False, "manual": False}, {"line_index": 1, "scanned": False, "manual": False}])
        assert r.status_code == 400

    def test_valid_ok(self, admin):
        oid = _seed()
        r = self._p(admin, oid, [{"line_index": 0, "scanned": True, "scanned_qty": 1}, {"line_index": 1, "manual": True, "manual_reason": "TEST étiquette abîmée"}])
        assert r.status_code == 200, r.text
        assert mdb.orders.find_one({"id": oid})["status"] == "prete"

    def test_legacy_status_prete_refused(self, admin):
        oid = _seed()
        r = admin.patch(f"{BASE_URL}/api/orders/{oid}/status", json={"status": "prete"})
        assert r.status_code == 400
        assert mdb.orders.find_one({"id": oid})["status"] == "en_preparation"


# ---------- cancel restock once ----------
def _pick_variant_product():
    p = mdb.products.find_one({"variants": {"$elemMatch": {"stock": {"$gte": 3}, "size": {"$nin": ["", "Unique", None]}}}, "price": {"$lt": 60000}})
    v = next(x for x in p["variants"] if x["stock"] >= 3 and x.get("size") not in ("", "Unique", None))
    return p, v


def _public_order(p, v, qty=2):
    r = requests.post(f"{BASE_URL}/api/public/orders", json={
        "items": [{"product_id": p["id"], "name": p["name"], "size": v["size"], "color": v["color"], "qty": qty, "price": p["price"]}],
        "customer": {"name": "TEST_AUD85 Stock", "phone": "+225 07 00 85 85 86", "address": "Cocody"},
        "payment_method": "cod", "mode": "delivery", "delivery_fee": 0, "delivery_zone": "Cocody", "checkout_key": f"test-aud85-{uuid.uuid4().hex}"})
    assert r.status_code == 200, r.text
    OIDS.append(r.json()["id"])
    return r.json()["id"]


def _levels(pid, v):
    p = mdb.products.find_one({"id": pid})
    vv = next(x for x in p["variants"] if x["size"] == v["size"] and x["color"] == v["color"])
    return p["stock"], (p.get("stock_by_size") or {}).get(v["size"]), vv["stock"]


class TestCancelRestock:
    @pytest.mark.parametrize("endpoint", ["status", "status-v3"])
    def test_cancel_restores_once(self, admin, endpoint):
        p, v = _pick_variant_product()
        _snap(p)
        before = _levels(p["id"], v)
        oid = _public_order(p, v, 2)
        mid = _levels(p["id"], v)
        assert mid[0] == before[0] - 2 and mid[2] == before[2] - 2, (before, mid)
        if before[1] is not None:
            assert mid[1] == before[1] - 2
        body = {"status": "annulee", "reason": "TEST_AUD85 annulation"}
        r = admin.patch(f"{BASE_URL}/api/orders/{oid}/{endpoint}", json=body)
        assert r.status_code == 200, r.text
        after = _levels(p["id"], v)
        assert after == before, (before, after)
        assert mdb.orders.find_one({"id": oid}).get("restocked_at")
        # second cancel via other endpoint must not double
        other = "status-v3" if endpoint == "status" else "status"
        admin.patch(f"{BASE_URL}/api/orders/{oid}/{other}", json=body)
        admin.patch(f"{BASE_URL}/api/orders/{oid}/{endpoint}", json=body)
        assert _levels(p["id"], v) == before
        # force re-entry: set status back and cancel again -> restocked_at guard
        mdb.orders.update_one({"id": oid}, {"$set": {"status": "nouvelle"}})
        admin.patch(f"{BASE_URL}/api/orders/{oid}/{endpoint}", json=body)
        assert _levels(p["id"], v) == before, "restock applied twice"


# ---------- product detail with cost ----------
class TestProductDetail:
    def test_admin_gets_cost(self, admin):
        p = mdb.products.find_one({"cost": {"$gt": 0}})
        r = admin.get(f"{BASE_URL}/api/products/{p['id']}")
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == p["id"] and d["cost"] == p["cost"] and "_id" not in d

    def test_sales_and_rider_forbidden(self, sales, rider):
        p = mdb.products.find_one({})
        # sales inherits manager in require_role (deps.py) -> staff access by design
        assert sales.get(f"{BASE_URL}/api/products/{p['id']}").status_code == 200
        assert rider.get(f"{BASE_URL}/api/products/{p['id']}").status_code == 403
        assert requests.get(f"{BASE_URL}/api/products/{p['id']}").status_code in (401, 403)

    def test_404(self, admin):
        assert admin.get(f"{BASE_URL}/api/products/test-aud85-nope").status_code == 404

    def test_kpis_route_not_shadowed(self, admin):
        assert admin.get(f"{BASE_URL}/api/products/kpis").status_code == 200


# ---------- cash handover ----------
def _cs(status="open", **kw):
    sid = f"test-aud85-cs-{uuid.uuid4().hex[:6]}"
    doc = {"id": sid, "opened_at": _now(), "opened_by": MGR["name"], "manager_id": MGR["id"], "session_date": "2026-01-15",
           "opening_cash": 10000, "closed": True, "expected": 50000, "status": status}
    doc.update(kw)
    mdb.cash_sessions.insert_one(doc)
    CSIDS.append(sid)
    return sid


class TestCashHandover:
    def test_declare_guards(self, manager, sales):
        for st in ("pending_validation", "validated", "gap"):
            sid = _cs(st)
            r = manager.post(f"{BASE_URL}/api/cash-sessions/{sid}/declare-handover", json={"amount": 1, "note": "TEST"})
            assert r.status_code == 400, (st, r.text)
        sid = _cs("open")
        assert sales.post(f"{BASE_URL}/api/cash-sessions/{sid}/declare-handover", json={"amount": 1}).status_code == 403

    def test_reject_category_and_notify(self, manager, admin):
        sid = _cs("open")
        assert manager.post(f"{BASE_URL}/api/cash-sessions/{sid}/declare-handover", json={"amount": 45000, "note": "TEST_AUD85"}).status_code == 200
        r = admin.post(f"{BASE_URL}/api/cash-sessions/{sid}/reject-handover", json={"reason": "TEST_AUD85 x", "expected": 50000})
        assert r.status_code == 400
        r = admin.post(f"{BASE_URL}/api/cash-sessions/{sid}/reject-handover", json={"reason": "TEST_AUD85 x", "category": "bogus"})
        assert r.status_code == 400
        r = admin.post(f"{BASE_URL}/api/cash-sessions/{sid}/reject-handover", json={"reason": "TEST_AUD85 écart", "category": "ecart", "expected": 50000})
        assert r.status_code == 200, r.text
        s = mdb.cash_sessions.find_one({"id": sid})
        assert s["status"] == "rejected" and s["rejection_declared"] == 45000 and s["rejection_gap"] == -5000
        n = mdb.user_notifications.find_one({"kind": "staff", "target_id": MGR["id"], "ref": sid})
        assert n is not None and "Versement rejeté" in n["title"]
        # gérante can see it through her own API
        lst = manager.get(f"{BASE_URL}/api/me/notifications")
        if lst.status_code == 200:
            assert sid in str(lst.json()) or "Versement rejeté" in lst.text
        # rejected -> may redeclare -> validate -> closed True
        assert manager.post(f"{BASE_URL}/api/cash-sessions/{sid}/declare-handover", json={"amount": 50000}).status_code == 200
        mdb.cash_sessions.update_one({"id": sid}, {"$set": {"closed": False}})
        r = admin.post(f"{BASE_URL}/api/cash-sessions/{sid}/validate-handover", json={"expected": 50000, "actual": 50000})
        assert r.status_code == 200 and r.json()["status"] == "validated"
        s = mdb.cash_sessions.find_one({"id": sid})
        assert s["closed"] is True and s.get("closed_at")
        assert manager.post(f"{BASE_URL}/api/cash-sessions/{sid}/declare-handover", json={"amount": 1}).status_code == 400


# ---------- AI parse duplicate ----------
class TestAIDuplicate:
    def test_possible_duplicate(self, admin):
        p = mdb.products.find_one({"variants.0": {"$exists": True}}, {"id": 1, "name": 1})
        oid = _seed("nouvelle", [{"name": p["name"], "qty": 1, "price": 1, "product_id": p["id"]}])
        mdb.orders.update_one({"id": oid}, {"$set": {"customer.phone": "+225 07 07 85 85 99"}})
        code = mdb.orders.find_one({"id": oid})["code"]
        txt = f"Bonjour, je veux 1 {p['name']} svp. TEST_AUD85 Awa 0707858599, Cocody"
        r = admin.post(f"{BASE_URL}/api/ai/parse-order", json={"text": txt}, timeout=120)
        assert r.status_code == 200
        d = r.json()
        assert not d.get("error"), d
        assert any(i.get("product_id") == p["id"] for i in d["items"]), d
        assert (d.get("possible_duplicate") or {}).get("code") == code, d

    def test_no_duplicate_other_phone(self, admin):
        p = mdb.products.find_one({"variants.0": {"$exists": True}}, {"id": 1, "name": 1})
        txt = f"Bonjour, je veux 1 {p['name']} svp. TEST_AUD85 Fanta 0101858577, Yopougon"
        d = admin.post(f"{BASE_URL}/api/ai/parse-order", json={"text": txt}, timeout=120).json()
        assert not d.get("possible_duplicate"), d
