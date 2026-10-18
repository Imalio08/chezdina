# Iteration 97 — §8 unsellable stock, §9 cash analysis, §10 roles meta + permission matrix fix
import os, uuid, copy
import pytest, requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env"); load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _login(email, pw):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    s = requests.Session(); s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return s


@pytest.fixture(scope="module")
def admin():
    return _login("aouattaraesca@gmail.com", "Admin123!")


@pytest.fixture(scope="module")
def manager():
    return _login("manager.cocody@dinastore.ci", "Manager123!")


# ---------- §10 permission matrix bug fix ----------
class TestRolesPermissions:
    def test_patch_level_strings_and_restore(self, admin):
        before = admin.get(f"{BASE_URL}/api/roles-permissions").json()["matrix"]
        orig = copy.deepcopy(before)
        m = copy.deepcopy(before)
        role = next(iter(m))
        m[role]["TEST_perm_key"] = "read"
        m[role]["TEST_perm_full"] = "full"
        m[role]["TEST_perm_none"] = "none"
        m[role]["TEST_perm_bool"] = True
        r = admin.patch(f"{BASE_URL}/api/roles-permissions", json={"matrix": m})
        try:
            assert r.status_code == 200, r.text
            got = admin.get(f"{BASE_URL}/api/roles-permissions").json()["matrix"]
            assert got[role]["TEST_perm_key"] == "read" and got[role]["TEST_perm_full"] == "full"
        finally:
            rr = admin.patch(f"{BASE_URL}/api/roles-permissions", json={"matrix": orig})
            assert rr.status_code == 200
            assert admin.get(f"{BASE_URL}/api/roles-permissions").json()["matrix"] == orig

    def test_patch_forbidden_for_manager(self, manager):
        r = manager.patch(f"{BASE_URL}/api/roles-permissions", json={"matrix": {}})
        assert r.status_code == 403


# ---------- §10 roles meta ----------
class TestRolesMeta:
    def test_roles_all_lists_builtin(self, admin):
        r = admin.get(f"{BASE_URL}/api/roles/all")
        assert r.status_code == 200
        keys = {x["key"]: x for x in r.json()}
        for k in ("admin", "manager", "sales", "stock_keeper", "community_manager", "rider"):
            assert k in keys and keys[k]["builtin"] is True and "label" in keys[k] and "active" in keys[k]

    def test_admin_cannot_be_deactivated(self, admin):
        r = admin.patch(f"{BASE_URL}/api/roles/meta/admin", json={"active": False})
        assert r.status_code == 400

    def test_empty_label_rejected(self, admin):
        assert admin.patch(f"{BASE_URL}/api/roles/meta/TEST_x", json={"label": "  "}).status_code == 400
        mdb.role_meta.delete_one({"key": "TEST_x"})

    def test_manager_cannot_patch_meta(self, manager):
        assert manager.patch(f"{BASE_URL}/api/roles/meta/sales", json={"label": "X"}).status_code == 403

    def test_test_role_lifecycle_and_deactivated_user_403(self, admin):
        key = f"test_role_{uuid.uuid4().hex[:6]}"
        role = admin.post(f"{BASE_URL}/api/roles", json={"key": key, "name": "TEST_Role"}).json()
        email = f"test_{uuid.uuid4().hex[:6]}@example.com"
        u = admin.post(f"{BASE_URL}/api/users", json={"name": "TEST_User", "email": email, "password": "Test123!", "role": key, "pin": "9871"})
        assert u.status_code == 200, u.text
        uid = u.json()["id"]
        try:
            lst = {x["key"]: x for x in admin.get(f"{BASE_URL}/api/roles/all").json()}
            assert key in lst and lst[key]["label"] == "TEST_Role" and lst[key]["active"] is True and lst[key]["builtin"] is False
            # rename
            assert admin.patch(f"{BASE_URL}/api/roles/meta/{key}", json={"label": "TEST_Renamed"}).status_code == 200
            lst = {x["key"]: x for x in admin.get(f"{BASE_URL}/api/roles/all").json()}
            assert lst[key]["label"] == "TEST_Renamed"
            tu = _login(email, "Test123!")
            ok = tu.get(f"{BASE_URL}/api/roles/all")
            assert ok.status_code == 200, ok.text
            # deactivate
            assert admin.patch(f"{BASE_URL}/api/roles/meta/{key}", json={"active": False}).status_code == 200
            lst = {x["key"]: x for x in admin.get(f"{BASE_URL}/api/roles/all").json()}
            assert lst[key]["active"] is False
            r = tu.get(f"{BASE_URL}/api/roles/all")
            assert r.status_code == 403 and "désactivé" in r.text, r.text
            # auth/me still allowed
            me = tu.get(f"{BASE_URL}/api/auth/me")
            print("auth/me on deactivated:", me.status_code)
            # reactivate
            assert admin.patch(f"{BASE_URL}/api/roles/meta/{key}", json={"active": True}).status_code == 200
            assert tu.get(f"{BASE_URL}/api/roles/all").status_code == 200
        finally:
            admin.delete(f"{BASE_URL}/api/users/{uid}")
            admin.delete(f"{BASE_URL}/api/roles/{role['id']}")
            mdb.role_meta.delete_one({"key": key})


# ---------- §8 unsellable stock ----------
@pytest.fixture(scope="class")
def test_product(admin):
    r = admin.post(f"{BASE_URL}/api/products", json={"name": "TEST_Unsellable Prod", "price": 10000, "cost": 4000, "stock_by_size": {"38": 5, "39": 3}, "category": "TEST"})
    assert r.status_code == 200, r.text
    p = r.json()
    yield p
    admin.delete(f"{BASE_URL}/api/products/{p['id']}")
    mdb.products.delete_one({"id": p["id"]})
    mdb.unsellable_items.delete_many({"product_id": p["id"]})
    mdb.stock_movements.delete_many({"product_id": p["id"]})
    mdb.settings_kv.update_one({"key": "unsellable_statuses"}, {"$pull": {"value": "TEST_Motif"}})
    mdb.user_notifications.delete_many({"$or": [{"title": {"$regex": "TEST_"}}, {"msg": {"$regex": "TEST_"}}]})


def _stock(pid, size):
    p = mdb.products.find_one({"id": pid})
    return p.get("stock"), (p.get("stock_by_size") or {}).get(size)


class TestUnsellable:
    def test_statuses_and_add(self, manager, test_product):
        st = manager.get(f"{BASE_URL}/api/stock/unsellable/statuses").json()
        for s in ("Défectueux", "Invendable", "Retour fournisseur", "En réparation", "Perdu"):
            assert s in st
        assert manager.post(f"{BASE_URL}/api/stock/unsellable/statuses", json={"label": "TEST_Motif"}).status_code == 200
        assert "TEST_Motif" in manager.get(f"{BASE_URL}/api/stock/unsellable/statuses").json()
        assert manager.post(f"{BASE_URL}/api/stock/unsellable/statuses", json={"label": ""}).status_code == 400

    def test_declare_validation(self, manager, test_product):
        pid = test_product["id"]
        assert manager.post(f"{BASE_URL}/api/stock/unsellable", json={"product_id": pid, "size": "38", "qty": 1, "status": "Défectueux", "reason": ""}).status_code == 400
        assert manager.post(f"{BASE_URL}/api/stock/unsellable", json={"product_id": pid, "size": "38", "qty": 99, "status": "Défectueux", "reason": "x"}).status_code == 400
        assert manager.post(f"{BASE_URL}/api/stock/unsellable", json={"product_id": "nope", "qty": 1, "status": "Perdu", "reason": "x"}).status_code == 404
        assert manager.post(f"{BASE_URL}/api/stock/unsellable", json={"product_id": pid, "size": "38", "qty": 0, "status": "Perdu", "reason": "x"}).status_code == 400

    def test_declare_approve_repair_back(self, admin, manager, test_product):
        pid = test_product["id"]
        s0 = _stock(pid, "38")
        r = manager.post(f"{BASE_URL}/api/stock/unsellable", json={"product_id": pid, "size": "38", "qty": 2, "status": "Défectueux", "reason": "TEST couture", "comment": "c", "photo": "data:image/png;base64,iVBOR"})
        assert r.status_code == 200, r.text
        d = r.json(); assert d["approval"] == "pending"
        assert _stock(pid, "38") == s0  # unchanged while pending
        # manager cannot decide
        assert manager.post(f"{BASE_URL}/api/stock/unsellable/{d['id']}/decide", json={"decision": "approve"}).status_code == 403
        assert admin.post(f"{BASE_URL}/api/stock/unsellable/{d['id']}/decide", json={"decision": "approve"}).status_code == 200
        assert _stock(pid, "38") == (s0[0] - 2, s0[1] - 2)
        mv = mdb.stock_movements.find_one({"ref": d["id"], "type": "unsellable"})
        assert mv and mv["qty"] == -2
        # double decide
        assert admin.post(f"{BASE_URL}/api/stock/unsellable/{d['id']}/decide", json={"decision": "approve"}).status_code == 400
        # en_reparation then remis_en_stock
        assert manager.post(f"{BASE_URL}/api/stock/unsellable/{d['id']}/change", json={"outcome": "en_reparation"}).status_code == 200
        it = next(x for x in admin.get(f"{BASE_URL}/api/stock/unsellable").json() if x["id"] == d["id"])
        assert it["status"] == "En réparation"
        assert manager.post(f"{BASE_URL}/api/stock/unsellable/{d['id']}/change", json={"outcome": "remis_en_stock"}).status_code == 200
        assert _stock(pid, "38") == s0
        it = next(x for x in admin.get(f"{BASE_URL}/api/stock/unsellable").json() if x["id"] == d["id"])
        assert it["outcome"] == "remis_en_stock"
        assert [h["action"] for h in it["history"]] == ["declare", "approve", "en_reparation", "remis_en_stock"]
        # closed file
        assert manager.post(f"{BASE_URL}/api/stock/unsellable/{d['id']}/change", json={"outcome": "detruit"}).status_code == 400

    def test_reject_requires_reason(self, admin, manager, test_product):
        pid = test_product["id"]
        s0 = _stock(pid, "39")
        d = manager.post(f"{BASE_URL}/api/stock/unsellable", json={"product_id": pid, "size": "39", "qty": 1, "status": "Perdu", "reason": "TEST"}).json()
        assert admin.post(f"{BASE_URL}/api/stock/unsellable/{d['id']}/decide", json={"decision": "reject"}).status_code == 400
        assert admin.post(f"{BASE_URL}/api/stock/unsellable/{d['id']}/decide", json={"decision": "reject", "note": "TEST non"}).status_code == 200
        assert _stock(pid, "39") == s0
        it = next(x for x in admin.get(f"{BASE_URL}/api/stock/unsellable").json() if x["id"] == d["id"])
        assert it["approval"] == "rejected" and it["decision_note"] == "TEST non"
        assert manager.post(f"{BASE_URL}/api/stock/unsellable/{d['id']}/change", json={"outcome": "detruit"}).status_code == 400

    @pytest.mark.parametrize("outcome", ["retour_fournisseur", "vendu_remise", "detruit"])
    def test_final_outcomes_keep_stock_out(self, admin, manager, test_product, outcome):
        pid = test_product["id"]
        s0 = _stock(pid, "39")
        d = manager.post(f"{BASE_URL}/api/stock/unsellable", json={"product_id": pid, "size": "39", "qty": 1, "status": "Retour fournisseur", "reason": "TEST"}).json()
        admin.post(f"{BASE_URL}/api/stock/unsellable/{d['id']}/decide", json={"decision": "approve"})
        assert manager.post(f"{BASE_URL}/api/stock/unsellable/{d['id']}/change", json={"outcome": outcome}).status_code == 200
        assert _stock(pid, "39") == (s0[0] - 1, s0[1] - 1)
        assert manager.post(f"{BASE_URL}/api/stock/unsellable/{d['id']}/change", json={"outcome": "remis_en_stock"}).status_code == 400
        mdb.products.update_one({"id": pid}, {"$inc": {"stock": 1, "stock_by_size.39": 1}})


# ---------- §9 cash analysis ----------
class TestCashAnalysis:
    def test_declare_analysis_validate(self, admin, manager):
        sid = "TEST_cs_" + uuid.uuid4().hex[:6]
        from datetime import datetime, timezone, timedelta
        opened = (datetime.now(timezone.utc) - timedelta(seconds=5)).isoformat()
        mgr = mdb.users.find_one({"email": "manager.cocody@dinastore.ci"})
        mdb.cash_sessions.insert_one({"id": sid, "opened_at": opened, "opening_cash": 50000.0, "closed": True, "status": "open", "manager_id": mgr["id"], "opened_by": "TEST"})
        mid = "TEST_mv_" + uuid.uuid4().hex[:6]
        now = datetime.now(timezone.utc).isoformat()
        mdb.cash_movements.insert_many([
            {"id": mid + "a", "type": "in", "kind": "rider_cod", "amount": 7000, "created_at": now},
            {"id": mid + "b", "type": "out", "kind": "expense", "amount": 2000, "created_at": now}])
        n0 = mdb.notifications_staff.count_documents({}) if "notifications_staff" in mdb.list_collection_names() else None
        try:
            # sales cannot declare
            r = manager.post(f"{BASE_URL}/api/cash-sessions/{sid}/declare-handover", json={"amount": 55000, "note": "TEST"})
            assert r.status_code == 200, r.text
            assert manager.post(f"{BASE_URL}/api/cash-sessions/{sid}/declare-handover", json={"amount": 1}).status_code == 400
            s = mdb.cash_sessions.find_one({"id": sid})
            assert s["status"] == "pending_validation" and "analysis" in s
            assert manager.get(f"{BASE_URL}/api/cash-sessions/{sid}/analysis").status_code == 403
            a = admin.get(f"{BASE_URL}/api/cash-sessions/{sid}/analysis").json()
            print("analysis", {k: v for k, v in a.items() if k != "movements"})
            for k in ("expected", "counted", "gap", "verdict", "attention", "by_method", "movements"):
                assert k in a
            assert a["rider_cash"] >= 7000 and a["outs"] >= 2000
            assert a["expected"] == int(50000 + a["cash_sales"] + a["rider_cash"] + a["other_in"] - a["outs"])
            assert a["counted"] == 55000 and a["gap"] == 55000 - a["expected"]
            assert (a["verdict"] == "Conforme") == (a["gap"] == 0)
            # reject still requires reason
            assert admin.post(f"{BASE_URL}/api/cash-sessions/{sid}/reject-handover", json={"category": "montant"}).status_code == 400
            v = admin.post(f"{BASE_URL}/api/cash-sessions/{sid}/validate-handover", json={"note": "TEST"})
            assert v.status_code == 200, v.text
            assert v.json()["gap"] == 55000 - a["expected"]
        finally:
            mdb.cash_sessions.delete_one({"id": sid})
            mdb.cash_movements.delete_many({"id": {"$regex": "^TEST_mv_"}})
            mdb.manager_balance.delete_many({"session_id": sid})
            mdb.audit_log.delete_many({"entity_id": sid})
            mdb.notifications.delete_many({"link": {"$regex": sid}})
            mdb.user_notifications.delete_many({"link": {"$regex": sid}})

    def test_reject_flow(self, admin, manager):
        sid = "TEST_cs_" + uuid.uuid4().hex[:6]
        from datetime import datetime, timezone
        mdb.cash_sessions.insert_one({"id": sid, "opened_at": datetime.now(timezone.utc).isoformat(), "opening_cash": 0.0, "closed": True, "status": "open"})
        try:
            manager.post(f"{BASE_URL}/api/cash-sessions/{sid}/declare-handover", json={"amount": 100})
            r = admin.post(f"{BASE_URL}/api/cash-sessions/{sid}/reject-handover", json={"category": "montant", "reason": "TEST faux"})
            assert r.status_code == 200, r.text
            s = mdb.cash_sessions.find_one({"id": sid})
            assert s["status"] == "rejected" and s["handover_amount"] is None
            # can re-declare
            assert manager.post(f"{BASE_URL}/api/cash-sessions/{sid}/declare-handover", json={"amount": 0}).status_code == 200
        finally:
            mdb.cash_sessions.delete_one({"id": sid})
            mdb.audit_log.delete_many({"entity_id": sid})
            mdb.notifications.delete_many({"link": {"$regex": sid}})
            mdb.user_notifications.delete_many({"link": {"$regex": sid}})
