# Iteration 80: Commandes + Préparation merge — confirmation rules, deposit guard, role transitions, assign day
import os
import base64
from datetime import datetime, timezone
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
mdb = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[os.environ.get("DB_NAME", "dina_store")]
SELFIE = "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8" + b"x" * 1500).decode()
CREATED = []
PUNCHED = []


def login(email, pw, pin=None):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers["Authorization"] = f"Bearer {tok}"
    if pin:
        me = s.get(f"{BASE_URL}/api/attendance/me").json()
        if not me.get("checked_in"):
            ok = s.post(f"{BASE_URL}/api/attendance/check-in", json={"kind": "arrival", "selfie": SELFIE, "pin": pin})
            assert ok.status_code == 200, ok.text
            PUNCHED.append(email)
    return s


@pytest.fixture(scope="module")
def admin():
    return login("aouattaraesca@gmail.com", "Admin123!")


@pytest.fixture(scope="module")
def manager():
    return login("manager.cocody@dinastore.ci", "Manager123!", "2222")


@pytest.fixture(scope="module")
def stock():
    return login("stock@dinastore.ci", "Stock123!", "4444")


@pytest.fixture(scope="module")
def sales():
    return login("agent1@dinastore.ci", "Agent123!", "3333")


@pytest.fixture(scope="module")
def cm():
    return login("cm@dinastore.ci", "Cm123!", "6666")


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    ids = [o["id"] for o in CREATED]
    mdb.orders.delete_many({"id": {"$in": ids}})
    mdb.delivery_sessions.update_many({}, {"$pull": {"orders": {"$in": ids}}})
    mdb.delivery_sessions.delete_many({"rider_name": {"$regex": "^TEST_"}})
    mdb.whatsapp_outbox.delete_many({"order_id": {"$in": ids}})
    mdb.user_notifications.delete_many({"event_key": {"$regex": "|".join(f"{i}" for i in ids) or "^$"}})
    mdb.audit_log.delete_many({"entity_id": {"$in": ids}})
    mdb.invoices.delete_many({"order_id": {"$in": ids}})
    today = datetime.now(timezone.utc).date().isoformat()
    for email in PUNCHED:
        u = mdb.users.find_one({"email": email})
        if u:
            mdb.attendance.delete_many({"user_id": u["id"], "day": today})


def mk_order(admin, status=None, **extra):
    r = admin.post(f"{BASE_URL}/api/orders", json={
        "items": [{"product_id": "TEST_prod_x", "name": "TEST_Robe", "qty": 1, "price": 10000}],
        "customer": {"name": "TEST_Cliente Merge", "phone": "+225 07 00 99 99 01"},
        "channel": "boutique", "payment_method": "cod", "mode": "delivery", "delivery_fee": 1000,
    })
    assert r.status_code == 200, r.text
    o = r.json()
    CREATED.append(o)
    if status or extra:
        mdb.orders.update_one({"id": o["id"]}, {"$set": {**({"status": status} if status else {}), **extra}})
    return o


def st(admin, oid):
    return mdb.orders.find_one({"id": oid})["status"]


class TestCreateStatus:
    # manual delivery order arrives 'nouvelle'; store mode is livree
    def test_delivery_order_nouvelle(self, admin):
        o = mk_order(admin)
        assert o["status"] == "nouvelle"

    def test_store_order_livree(self, admin):
        r = admin.post(f"{BASE_URL}/api/orders", json={
            "items": [{"product_id": "TEST_prod_x", "name": "TEST_Robe", "qty": 1, "price": 5000}],
            "payment_method": "cash", "mode": "store"})
        assert r.status_code == 200
        CREATED.append(r.json())
        assert r.json()["status"] == "livree"


class TestDepositGuard:
    # en_attente_acompte cannot be confirmed before deposit
    @pytest.mark.parametrize("ep", ["status", "status-v3"])
    def test_confirm_blocked_without_deposit(self, admin, ep):
        o = mk_order(admin, "en_attente_acompte", deposit_required=5000, deposit_paid=0)
        r = admin.patch(f"{BASE_URL}/api/orders/{o['id']}/{ep}", json={"status": "confirmee"})
        assert r.status_code == 400, r.text
        assert "Acompte non reçu" in r.json()["detail"]
        assert st(admin, o["id"]) == "en_attente_acompte"

    def test_mark_deposit_paid_confirms(self, admin):
        o = mk_order(admin, "en_attente_acompte", deposit_required=5000, deposit_paid=0)
        r = admin.post(f"{BASE_URL}/api/orders/{o['id']}/mark-deposit-paid", json={"tx_ref": "TEST_WAVE1"})
        assert r.status_code == 200 and r.json()["status"] == "confirmee"
        assert st(admin, o["id"]) == "confirmee"

    def test_sales_cannot_mark_deposit_paid(self, admin, sales):
        o = mk_order(admin, "en_attente_acompte", deposit_required=5000, deposit_paid=0)
        r = sales.post(f"{BASE_URL}/api/orders/{o['id']}/mark-deposit-paid", json={"tx_ref": "TEST_WAVE2"})
        print("sales mark-deposit-paid:", r.status_code, r.text[:200])
        assert r.status_code == 403, f"sales bypassed confirmation via mark-deposit-paid -> {st(admin, o['id'])}"


class TestConfirmRoles:
    @pytest.mark.parametrize("who", ["sales", "stock", "cm"])
    @pytest.mark.parametrize("ep", ["status", "status-v3"])
    def test_limited_roles_cannot_confirm(self, request, admin, who, ep):
        s = request.getfixturevalue(who)
        o = mk_order(admin)
        r = s.patch(f"{BASE_URL}/api/orders/{o['id']}/{ep}", json={"status": "confirmee"})
        assert r.status_code == 403, r.text
        assert st(admin, o["id"]) == "nouvelle"

    @pytest.mark.parametrize("who", ["admin", "manager"])
    @pytest.mark.parametrize("ep", ["status", "status-v3"])
    def test_manager_admin_confirm(self, request, admin, who, ep):
        s = request.getfixturevalue(who)
        o = mk_order(admin)
        r = s.patch(f"{BASE_URL}/api/orders/{o['id']}/{ep}", json={"status": "confirmee"})
        assert r.status_code == 200, r.text
        assert st(admin, o["id"]) == "confirmee"

    def test_sales_generic_patch_cannot_confirm(self, admin, sales):
        o = mk_order(admin)
        r = sales.patch(f"{BASE_URL}/api/orders/{o['id']}", json={"status": "confirmee"})
        print("sales PATCH /orders/{id} status:", r.status_code, st(admin, o["id"]))
        assert st(admin, o["id"]) == "nouvelle", "PATCH /api/orders/{id} lets sales bypass confirmation guard"


class TestPrepareRoles:
    @pytest.mark.parametrize("who", ["stock", "sales"])
    @pytest.mark.parametrize("ep", ["status", "status-v3"])
    def test_limited_prepare_and_ready(self, request, admin, who, ep):
        s = request.getfixturevalue(who)
        o = mk_order(admin, "confirmee")
        r = s.patch(f"{BASE_URL}/api/orders/{o['id']}/{ep}", json={"status": "en_preparation"})
        assert r.status_code == 200, r.text
        assert st(admin, o["id"]) == "en_preparation"
        r = s.patch(f"{BASE_URL}/api/orders/{o['id']}/{ep}", json={"status": "prete"})
        assert r.status_code == 200, r.text
        assert st(admin, o["id"]) == "prete"

    @pytest.mark.parametrize("who", ["stock", "sales"])
    def test_limited_cannot_cancel(self, request, admin, who):
        s = request.getfixturevalue(who)
        o = mk_order(admin, "confirmee")
        r = s.patch(f"{BASE_URL}/api/orders/{o['id']}/status", json={"status": "annulee", "reason": "x"})
        assert r.status_code == 403

    def test_cm_cannot_prepare(self, admin, cm):
        o = mk_order(admin, "confirmee")
        r = cm.patch(f"{BASE_URL}/api/orders/{o['id']}/status-v3", json={"status": "en_preparation"})
        assert r.status_code == 403


class TestAssignDay:
    def test_assign_prete_to_rider_session(self, admin):
        rider = mdb.users.find_one({"email": "rider1@dinastore.ci"})
        o = mk_order(admin, "prete")
        r = admin.post(f"{BASE_URL}/api/delivery-sessions", json={"rider_id": rider["id"], "rider_name": rider["name"], "date": "2030-01-15"})
        assert r.status_code == 200, r.text
        sid = r.json()["id"]
        r2 = admin.post(f"{BASE_URL}/api/delivery-sessions", json={"rider_id": rider["id"], "rider_name": rider["name"], "date": "2030-01-15"})
        assert r2.json()["id"] == sid  # reused
        a = admin.patch(f"{BASE_URL}/api/delivery-sessions/{sid}/add-order", json={"order_id": o["id"]})
        assert a.status_code == 200, a.text
        d = mdb.orders.find_one({"id": o["id"]})
        assert d["status"] == "assignee" and d["rider_id"] == rider["id"] and d["session_id"] == sid
        n = mdb.user_notifications.count_documents({"target_id": rider["id"], "event_key": {"$regex": f"^assign:{o['id']}"}})
        assert n == 1
        sess = mdb.delivery_sessions.find_one({"id": sid})
        if sess and not [x for x in sess.get("orders", []) if x not in [c["id"] for c in CREATED]]:
            mdb.delivery_sessions.delete_one({"id": sid})


class TestDashboard:
    def test_action_items_links(self, admin):
        r = admin.get(f"{BASE_URL}/api/dashboard/action-items")
        assert r.status_code == 200
        d = r.json()
        assert d["nouvelles"]["link"] == "/console/commandes?tab=nouvelle"
        assert d["preparation"]["link"] == "/console/commandes?tab=confirmee"
        assert d["pretes_non_affectees"]["link"] == "/console/commandes?tab=prete"
