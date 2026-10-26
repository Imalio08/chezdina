# Iteration 102: retest of permission-matrix fixes (team read, segment-exact match, customers search, permissions/me, custom roles)
# Run serially: pytest -n 0 (tests mutate the global matrix)
import os
import time
import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/frontend/.env"); load_dotenv("/app/backend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = BASE_URL + "/api"
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
SELFIE = "data:image/jpeg;base64," + "A" * 1500
CUSTOM = "test_role_iter102"
H = lambda t: {"Authorization": f"Bearer {t}"}


def login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def ctx():
    admin = login("aouattaraesca@gmail.com", "Admin123!")
    orig = db.roles_permissions.find_one({"id": "main"}, {"_id": 0, "v2": 1}) or {}
    users, toks = {}, {}
    for i, role in enumerate(("manager", "sales", "stock_keeper", "community_manager", CUSTOM)):
        em = f"test_iter102_{role}@test.ci"
        db.users.delete_many({"email": em})
        r = requests.post(f"{API}/users", headers=H(admin), json={"name": f"TEST_102 {role}", "email": em, "password": "Test123!", "role": role, "pin": f"91{i}2"})
        assert r.status_code == 200, r.text
        users[role] = r.json()["id"]
        # skip onboarding docs gate for test users
        db.users.update_one({"id": users[role]}, {"$set": {"onboarding_done": True, "tour_done": True}})
        t = login(em, "Test123!")
        requests.post(f"{API}/attendance/check-in", headers=H(t), json={"kind": "arrival", "selfie": SELFIE})
        toks[role] = t
    yield {"admin": admin, "tok": toks, "users": users}
    # restore matrix + cleanup
    if "v2" in orig:
        db.roles_permissions.update_one({"id": "main"}, {"$set": {"v2": orig["v2"]}})
    else:
        db.roles_permissions.update_one({"id": "main"}, {"$unset": {"v2": ""}})
    for uid in users.values():
        requests.delete(f"{API}/users/{uid}", headers=H(admin))
        db.users.delete_one({"id": uid}); db.attendance.delete_many({"user_id": uid}); db.notifications.delete_many({"user_id": uid})
    db.role_meta.delete_many({"key": CUSTOM})
    requests.patch(f"{API}/roles-permissions", headers=H(admin), json={"matrix": {}})
    db.roles_permissions.update_one({"id": "main"}, {"$unset": {"v2": ""}} if "v2" not in orig else {"$set": {"v2": orig["v2"]}})


def set_matrix(ctx, matrix, labels=None):
    r = requests.patch(f"{API}/roles-permissions", headers=H(ctx["admin"]), json={"matrix": matrix, "labels": labels or {}})
    assert r.status_code == 200, r.text
    time.sleep(0.5)


def reset(ctx):
    set_matrix(ctx, {})
    db.roles_permissions.update_one({"id": "main"}, {"$unset": {"v2": ""}})


def g(ctx, role, path):
    return requests.get(f"{API}{path}", headers=H(ctx["tok"][role]))


# --- Default matrix: manager can read team / deliveries / riders pages
def test_manager_default_team_and_delivery_pages(ctx):
    reset(ctx)
    for p in ("/team", "/deliveries", "/delivery-sessions", "/rider-reports", "/riders/locations"):
        r = g(ctx, "manager", p)
        assert r.status_code == 200, f"{p}: {r.status_code} {r.text[:200]}"
    assert isinstance(g(ctx, "manager", "/team").json(), (list, dict))


# --- permissions/me for limited roles
@pytest.mark.parametrize("role", ["sales", "stock_keeper", "community_manager", "manager"])
def test_permissions_me(ctx, role):
    r = g(ctx, role, "/permissions/me")
    assert r.status_code == 200, r.text
    lv = r.json()["levels"]
    assert lv["/console"] in ("write", "full")
    assert lv["/console/equipe"] == "none"


# --- Regression: default pages per role
DEFAULT_PAGES = {
    "manager": ["/dashboard/kpis", "/pos/shortcuts", "/orders", "/products", "/stock-movements", "/customers", "/promotions"],
    "sales": ["/dashboard/kpis", "/orders", "/products", "/stock-movements", "/customers"],
    "stock_keeper": ["/dashboard/kpis", "/orders", "/products", "/stock-movements", "/stock-alerts", "/stock/inventories"],
    "community_manager": ["/dashboard/kpis", "/products", "/customers", "/promotions"],
}


@pytest.mark.parametrize("role", list(DEFAULT_PAGES))
def test_default_pages_per_role(ctx, role):
    reset(ctx)
    bad = {}
    for p in DEFAULT_PAGES[role]:
        r = g(ctx, role, p)
        if r.status_code != 200:
            bad[p] = (r.status_code, r.text[:120])
    assert not bad, bad


# --- Segment-exact: stock none blocks stock-movements / inventories / alerts, products still readable
@pytest.mark.parametrize("role", ["sales", "manager"])
def test_stock_none_segment_exact(ctx, role):
    set_matrix(ctx, {role: {"/console/stock": "none"}})
    try:
        for p in ("/stock-movements", "/stock/inventories", "/stock-alerts"):
            r = g(ctx, role, p)
            assert r.status_code == 403, f"{p}: {r.status_code}"
        r = g(ctx, role, "/products")
        assert r.status_code == 200, r.text[:200]
    finally:
        reset(ctx)


# --- Clients none: list 403, search allowed via POS read
def test_clients_none_customers(ctx):
    set_matrix(ctx, {"manager": {"/console/clients": "none"}})
    try:
        assert g(ctx, "manager", "/customers").status_code == 403
        assert g(ctx, "manager", "/customers?q=xx").status_code == 200
    finally:
        reset(ctx)


def test_clients_and_search_pages_none_blocks_search(ctx):
    set_matrix(ctx, {"manager": {"/console/clients": "none", "/console/pos": "none", "/console/commandes": "none", "/console/messagerie": "none"}})
    try:
        assert g(ctx, "manager", "/customers?q=xx").status_code == 403
    finally:
        reset(ctx)


def test_clients_none_any_query_bypass(ctx):
    """Any query string (not just a search) unlocks the full customer list via POS read."""
    set_matrix(ctx, {"manager": {"/console/clients": "none"}})
    try:
        r = g(ctx, "manager", "/customers?status=all")
        assert r.status_code == 403, f"full customer list readable with ?status=all ({len(r.json()) if r.ok else ''} rows)"
    finally:
        reset(ctx)


# --- Custom role persists (role_meta) and its levels apply on the server
def test_custom_role_persist_and_enforce(ctx):
    levels = {m: "none" for m in requests.get(f"{API}/roles-permissions", headers=H(ctx["admin"])).json()["modules"]}
    levels.update({"/console": "read", "/console/produits": "write", "/console/clients": "none"})
    set_matrix(ctx, {CUSTOM: levels}, labels={CUSTOM: "TEST Rôle 102"})
    meta = db.role_meta.find_one({"key": CUSTOM})
    assert meta and meta["label"] == "TEST Rôle 102"
    roles = requests.get(f"{API}/roles/all", headers=H(ctx["admin"])).json()
    assert any(r["key"] == CUSTOM and r["label"] == "TEST Rôle 102" for r in roles)
    rp = requests.get(f"{API}/roles-permissions", headers=H(ctx["admin"])).json()
    assert rp["matrix"][CUSTOM]["/console/produits"] == "write"
    assert "rider" not in rp["matrix"]
    me = g(ctx, CUSTOM, "/permissions/me")
    assert me.status_code == 200 and me.json()["levels"]["/console/clients"] == "none"
    assert g(ctx, CUSTOM, "/products").status_code == 200
    assert g(ctx, CUSTOM, "/dashboard/kpis").status_code == 200
    assert g(ctx, CUSTOM, "/customers").status_code == 403
    assert g(ctx, CUSTOM, "/stock-movements").status_code == 403
    assert g(ctx, CUSTOM, "/orders").status_code == 403
    # read-only dashboard module, write on products: POST /products not 403
    r = requests.post(f"{API}/products", headers=H(ctx["tok"][CUSTOM]), json={})
    assert r.status_code != 403, r.text[:200]


# --- Sales cannot read the full matrix (code review item)
def test_roles_permissions_get_restricted(ctx):
    r = g(ctx, "sales", "/roles-permissions")
    assert r.status_code == 403, f"sales can GET /roles-permissions: {r.status_code}"
