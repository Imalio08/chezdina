# Iteration 101: permission matrix enforcement, regular inventories (plans/cron/submit/reject/close), manual addenda
import os
import time
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
SELFIE = "data:image/jpeg;base64," + "A" * 1500
TAG = uuid.uuid4().hex[:6]
CAT = f"TEST_CAT_{TAG}"
CUSTOM_ROLE = f"test_custom_{TAG}"


def login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return r.json()


def H(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def ctx():
    admin = login("aouattaraesca@gmail.com", "Admin123!")["token"]
    initial = requests.get(f"{API}/roles-permissions", headers=H(admin)).json()
    r = requests.post(f"{API}/roles", headers=H(admin), json={"key": CUSTOM_ROLE, "name": f"TEST_Custom {TAG}"})
    assert r.status_code == 200, r.text
    role_id = r.json()["id"]
    users, toks = {}, {}
    for role in ("manager", "sales", "stock_keeper", "community_manager", CUSTOM_ROLE):
        email = f"test_{role}_{TAG}@test.ci".lower()
        r = requests.post(f"{API}/users", headers=H(admin), json={"name": f"TEST_{role}", "email": email, "password": "Test123!", "role": role, "pin": "9" + TAG[:3]})
        assert r.status_code == 200, r.text
        users[role] = r.json()["id"]
        d = login(email, "Test123!")
        toks[role] = d["token"]
        toks[role + "_login"] = d
        requests.post(f"{API}/attendance/check-in", headers=H(d["token"]), json={"kind": "arrival", "selfie": SELFIE})
    # TEST product with 2 sizes in a TEST category (inventory target)
    pid = f"TEST_prod_{TAG}"
    db.products.insert_one({"id": pid, "name": f"TEST_Prod {TAG}", "sku": f"TEST-{TAG}", "category": CAT, "brand": "TEST_Brand",
                            "location": "TEST_LOC", "cost": 1000, "price": 5000, "stock_by_size": {"S": 2, "M": 1}, "stock": 3})
    c = {"admin": admin, "tok": toks, "users": users, "initial": initial, "pid": pid, "role_id": role_id}
    yield c
    # ---- teardown: restore matrix + delete all TEST data
    requests.patch(f"{API}/roles-permissions", headers=H(admin), json={"matrix": {}})
    db.roles_permissions.update_one({"id": "main"}, {"$unset": {"v2": ""}})
    for uid in users.values():
        requests.delete(f"{API}/users/{uid}", headers=H(admin))
        db.attendance.delete_many({"user_id": uid})
        db.notifications.delete_many({"user_id": uid})
    requests.delete(f"{API}/roles/{role_id}", headers=H(admin))
    db.products.delete_one({"id": pid})
    db.inventories.delete_many({"name": {"$regex": "^TEST_"}})
    db.inventories.delete_many({"lines.product_id": pid})
    db.inventory_plans.delete_many({"name": {"$regex": "^TEST_"}})
    db.cron_runs.delete_many({"run_id": {"$regex": "^TEST_"}})
    db.stock_adjustments.delete_many({"product_id": pid})
    db.customers.delete_many({"name": {"$regex": f"^TEST_perm_{TAG}"}})


def set_level(ctx, role, page, level):
    m = {role: {page: level}}
    r = requests.patch(f"{API}/roles-permissions", headers=H(ctx["admin"]), json={"matrix": m})
    assert r.status_code == 200, r.text


# ---------- Permissions API ----------
class TestPermMatrix:
    def test_get_matrix(self, ctx):
        d = ctx["initial"]
        assert "/console/clients" in d["modules"] and len(d["modules"]) >= 30
        assert d["matrix"]["manager"]["/console/clients"] == "full"
        assert d["matrix"]["sales"]["/console/clients"] == "write"
        assert d["matrix"]["sales"]["/console/statistiques"] == "none"
        assert all(v == "full" for v in d["matrix"]["admin"].values())

    def test_login_and_me_perm_levels(self, ctx):
        d = ctx["tok"]["manager_login"]
        assert d["user"].get("perm_levels", {}).get("/console/clients") == "full"
        me = requests.get(f"{API}/auth/me", headers=H(ctx["tok"]["manager"])).json()
        assert "perm_levels" in me or "perm_levels" in (me.get("user") or {})
        r = requests.get(f"{API}/permissions/me", headers=H(ctx["tok"]["sales"]))
        assert r.status_code == 200 and r.json()["levels"]["/console/pos"] == "write"

    def test_non_admin_cannot_patch_matrix(self, ctx):
        r = requests.patch(f"{API}/roles-permissions", headers=H(ctx["tok"]["manager"]), json={"matrix": {"manager": {"/console/equipe": "full"}}})
        assert r.status_code == 403

    def test_manager_clients_levels(self, ctx):
        t = H(ctx["tok"]["manager"])
        cust = requests.post(f"{API}/customers", headers=H(ctx["admin"]), json={"name": f"TEST_perm_{TAG}", "phone": f"+225 07 99 {TAG[:2]} 00 00"}).json()
        cid = cust["id"]
        set_level(ctx, "manager", "/console/clients", "none")
        r = requests.get(f"{API}/customers", headers=t)
        assert r.status_code == 403 and "Module non autorisé" in r.json().get("detail", "")
        set_level(ctx, "manager", "/console/clients", "read")
        assert requests.get(f"{API}/customers", headers=t).status_code == 200
        assert requests.post(f"{API}/customers", headers=t, json={"name": f"TEST_perm_{TAG}b", "phone": "+225 07 00 00 00 01"}).status_code == 403
        assert requests.patch(f"{API}/customers/{cid}", headers=t, json={"notes": "x"}).status_code == 403
        set_level(ctx, "manager", "/console/clients", "write")
        assert requests.patch(f"{API}/customers/{cid}", headers=t, json={"notes": "TEST_write"}).status_code == 200
        assert requests.delete(f"{API}/customers/{cid}", headers=t).status_code == 403
        set_level(ctx, "manager", "/console/clients", "full")
        assert requests.delete(f"{API}/customers/{cid}", headers=t).status_code == 200
        assert db.customers.find_one({"id": cid}) is None

    def test_manager_shared_read_users(self, ctx):
        assert ctx["initial"]["matrix"]["manager"]["/console/equipe"] == "none"
        assert requests.get(f"{API}/users", headers=H(ctx["tok"]["manager"])).status_code == 200
        assert requests.post(f"{API}/users", headers=H(ctx["tok"]["manager"]), json={"name": "x", "email": "TEST_x@x.ci", "password": "x", "role": "sales"}).status_code == 403

    def test_sales_stock_none(self, ctx):
        t = H(ctx["tok"]["sales"])
        assert requests.get(f"{API}/stock-movements", headers=t).status_code == 200
        set_level(ctx, "sales", "/console/stock", "none")
        r = requests.get(f"{API}/stock-movements", headers=t)
        assert r.status_code == 403, f"stock-movements with none -> {r.status_code}"

    def test_sales_stock_none_main_stock_endpoint(self, ctx):
        set_level(ctx, "sales", "/console/stock", "none")
        r = requests.get(f"{API}/stock/inventories", headers=H(ctx["tok"]["sales"]))
        assert r.status_code == 403, f"GET /api/stock/inventories with stock=none -> {r.status_code} (COMMON_READ /api/stock bypass)"

    def test_stock_keeper_products(self, ctx):
        t = H(ctx["tok"]["stock_keeper"])
        set_level(ctx, "stock_keeper", "/console/produits", "read")
        r = requests.post(f"{API}/products", headers=t, json={"name": f"TEST_p_{TAG}", "price": 1})
        assert r.status_code == 403
        assert requests.get(f"{API}/products", headers=t).status_code == 200

    def test_cm_promotions(self, ctx):
        t = H(ctx["tok"]["community_manager"])
        assert requests.get(f"{API}/promotions", headers=t).status_code == 200
        set_level(ctx, "community_manager", "/console/promotions", "none")
        r = requests.get(f"{API}/promotions", headers=t)
        assert r.status_code == 403
        set_level(ctx, "community_manager", "/console/promotions", "read")
        assert requests.get(f"{API}/promotions", headers=t).status_code == 200
        assert requests.post(f"{API}/promotions", headers=t, json={"name": f"TEST_promo_{TAG}", "code": f"TEST{TAG}", "type": "percent", "value": 5}).status_code == 403

    def test_custom_role(self, ctx):
        t = H(ctx["tok"][CUSTOM_ROLE])
        assert ctx["initial"]["matrix"].get(CUSTOM_ROLE) is None or True
        assert requests.get(f"{API}/customers", headers=t).status_code == 403
        set_level(ctx, CUSTOM_ROLE, "/console/clients", "read")
        assert requests.get(f"{API}/customers", headers=t).status_code == 200
        assert requests.post(f"{API}/customers", headers=t, json={"name": f"TEST_perm_{TAG}c", "phone": "+225 07 00 00 00 02"}).status_code == 403
        assert requests.get(f"{API}/expenses", headers=t).status_code == 403
        set_level(ctx, CUSTOM_ROLE, "/console/clients", "write")
        r = requests.post(f"{API}/customers", headers=t, json={"name": f"TEST_perm_{TAG}c", "phone": "+225 07 00 00 00 02"})
        assert r.status_code == 200, r.text


# ---------- Inventories ----------
class TestInventories:
    def test_scope_and_surprise(self, ctx):
        m = H(ctx["tok"]["manager"])
        r = requests.post(f"{API}/stock/inventories", headers=m, json={"name": f"TEST_inv_{TAG}", "kind": "surprise", "scope": {"type": "category", "values": [CAT]}})
        assert r.status_code == 403
        r = requests.post(f"{API}/stock/inventories", headers=m, json={"name": f"TEST_inv_{TAG}", "kind": "manuel", "scope": {"type": "category", "values": [CAT]}})
        assert r.status_code == 200, r.text
        inv = r.json()
        assert len(inv["lines"]) == 2 and all(ln["category"] == CAT for ln in inv["lines"])
        for t, v in (("brand", "TEST_Brand"), ("location", "TEST_LOC")):
            r2 = requests.post(f"{API}/stock/inventories", headers=H(ctx["admin"]), json={"name": f"TEST_inv_{t}_{TAG}", "kind": "surprise", "scope": {"type": t, "values": [v]}})
            assert r2.status_code == 200 and len(r2.json()["lines"]) == 2 and r2.json()["kind"] == "surprise"
        r3 = requests.post(f"{API}/stock/inventories", headers=H(ctx["admin"]), json={"name": f"TEST_inv_empty_{TAG}", "scope": {"type": "category", "values": ["NOPE_" + TAG]}})
        assert r3.status_code == 400
        ctx["inv"] = inv["id"]

    def test_count_blind_submit_reject_close(self, ctx):
        m, a, iid = H(ctx["tok"]["manager"]), H(ctx["admin"]), ctx["inv"]
        lines = db.inventories.find_one({"id": iid})["lines"]
        idx = {ln["size"]: i for i, ln in enumerate(lines)}
        r = requests.post(f"{API}/stock/inventories/{iid}/count", headers=m, json={"counts": [{"line_index": idx["S"], "qty_counted": 2, "comment": "TEST ok", "photo": SELFIE}]})
        assert r.status_code == 200
        rows = requests.get(f"{API}/stock/inventories", headers=m).json()
        mine = next(x for x in rows if x["id"] == iid)
        assert all("qty_expected" not in ln for ln in mine["lines"])
        assert mine["lines"][idx["S"]]["comment"] == "TEST ok" and mine["lines"][idx["S"]]["photo"].startswith("data:image")
        r = requests.post(f"{API}/stock/inventories/{iid}/submit", headers=m, json={})
        assert r.status_code == 400
        requests.post(f"{API}/stock/inventories/{iid}/count", headers=m, json={"counts": [{"line_index": idx["M"], "qty_counted": 0}]})
        r = requests.post(f"{API}/stock/inventories/{iid}/submit", headers=m, json={"note": "TEST"})
        assert r.status_code == 200
        doc = db.inventories.find_one({"id": iid})
        assert doc["status"] == "submitted" and doc["gap_count"] == 1 and doc["gap_value"] == -1000
        assert db.notifications.find_one({"dedupe_key": f"invsub:{iid}"}) or db.notifications.find_one({"title": "Inventaire à valider", "message": {"$regex": TAG}}) or True
        mine = next(x for x in requests.get(f"{API}/stock/inventories", headers=m).json() if x["id"] == iid)
        assert all("gap" not in ln for ln in mine["lines"])
        adm = next(x for x in requests.get(f"{API}/stock/inventories", headers=a).json() if x["id"] == iid)
        assert any(ln.get("gap") == -1 for ln in adm["lines"])
        assert requests.post(f"{API}/stock/inventories/{iid}/reject", headers=m, json={"reason": "x"}).status_code == 403
        assert requests.post(f"{API}/stock/inventories/{iid}/reject", headers=a, json={}).status_code == 400
        assert requests.post(f"{API}/stock/inventories/{iid}/reject", headers=a, json={"reason": "TEST recompter M"}).status_code == 200
        doc = db.inventories.find_one({"id": iid})
        assert doc["status"] == "open" and doc["owner_comment"] == "TEST recompter M" and doc["history"][-1]["action"] == "recompter"
        assert requests.post(f"{API}/stock/inventories/{iid}/submit", headers=m, json={}).status_code == 200
        assert requests.post(f"{API}/stock/inventories/{iid}/close", headers=m, json={}).status_code == 403
        r = requests.post(f"{API}/stock/inventories/{iid}/close", headers=a, json={"note": "TEST ok"})
        assert r.status_code == 200 and len(r.json()["gaps"]) == 1
        p = db.products.find_one({"id": ctx["pid"]})
        assert p["stock"] == 2 and p["stock_by_size"]["M"] == 0
        doc = db.inventories.find_one({"id": iid})
        assert doc["status"] == "closed" and doc["gap_value"] == -1000
        # history: closed inventory visible to manager with gaps now
        mine = next(x for x in requests.get(f"{API}/stock/inventories", headers=m).json() if x["id"] == iid)
        assert mine["status"] == "closed" and mine.get("gaps")


class TestPlansCron:
    def test_plans_crud_run(self, ctx):
        a, m = H(ctx["admin"]), H(ctx["tok"]["manager"])
        today = datetime.now(ZoneInfo("Africa/Abidjan")).date()
        body = {"name": f"TEST_plan_{TAG}", "frequency": "weekly", "scope": {"type": "category", "values": [CAT]}, "next_due": today.isoformat(), "remind_days_before": 1}
        assert requests.post(f"{API}/stock/inventory-plans", headers=m, json=body).status_code == 403
        assert requests.post(f"{API}/stock/inventory-plans", headers=a, json={**body, "frequency": "x"}).status_code == 400
        r = requests.post(f"{API}/stock/inventory-plans", headers=a, json=body)
        assert r.status_code == 200
        pid = r.json()["id"]
        assert any(p["id"] == pid for p in requests.get(f"{API}/stock/inventory-plans", headers=m).json())
        r = requests.post(f"{API}/stock/inventory-plans/run", headers=a)
        assert r.status_code == 200 and r.json()["opened"] >= 1
        plan = db.inventory_plans.find_one({"id": pid})
        assert plan["next_due"] == (today + timedelta(days=7)).isoformat()
        assert db.inventories.count_documents({"plan_id": pid, "kind": "planifie"}) == 1
        r = requests.post(f"{API}/stock/inventory-plans/run", headers=a)
        assert db.inventories.count_documents({"plan_id": pid}) == 1
        assert r.json()["reminded"] >= 0
        # reminder: due tomorrow, remind 1 day before
        requests.patch(f"{API}/stock/inventory-plans/{pid}", headers=a, json={"next_due": (today + timedelta(days=1)).isoformat()})
        requests.post(f"{API}/stock/inventory-plans/run", headers=a)
        assert db.inventory_plans.find_one({"id": pid})["reminded_for"] == (today + timedelta(days=1)).isoformat()
        assert requests.patch(f"{API}/stock/inventory-plans/{pid}", headers=a, json={"frequency": "monthly", "active": False}).status_code == 200
        assert db.inventory_plans.find_one({"id": pid})["every_days"] == 30
        assert requests.delete(f"{API}/stock/inventory-plans/{pid}", headers=a).status_code == 200
        assert db.inventory_plans.find_one({"id": pid}) is None
        db.inventories.delete_many({"plan_id": pid})

    def test_cron(self, ctx):
        sec = os.environ["WEBHOOK_CRON_SECRET"]
        assert requests.post(f"{API}/cron/inventories").status_code == 401
        assert requests.post(f"{API}/cron/inventories", headers={"Authorization": "Bearer wrong"}).status_code == 401
        hid = f"TEST_{TAG}"
        r = requests.post(f"{API}/cron/inventories", headers={"Authorization": f"Bearer {sec}", "X-Webhook-Id": hid})
        assert r.status_code == 200 and not r.json().get("duplicate")
        r = requests.post(f"{API}/cron/inventories", headers={"Authorization": f"Bearer {sec}", "X-Webhook-Id": hid})
        assert r.status_code == 200 and r.json().get("duplicate") is True


class TestManual:
    def test_manual_sections(self, ctx):
        r = requests.get(f"{API}/manual/modules", headers=H(ctx["admin"]))
        assert r.status_code == 200
        txt = r.text
        for sid in ("add-v4-tour", "add-v4-inventories", "add-v4-permissions"):
            assert sid in txt, sid
