# Limited staff roles (sales / stock_keeper / community_manager): server-side allow-list, field stripping, role dashboard
import os
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient
from dotenv import dotenv_values

BASE_URL = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/")
_benv = dotenv_values("/app/backend/.env")
MDB = MongoClient(_benv["MONGO_URL"])[_benv["DB_NAME"]]

CREDS = {
    "admin": ("aouattaraesca@gmail.com", "Admin123!"),
    "manager": ("manager.cocody@dinastore.ci", "Manager123!"),
    "sales": ("agent1@dinastore.ci", "Agent123!"),
    "stock_keeper": ("stock@dinastore.ci", "Stock123!"),
    "community_manager": ("cm@dinastore.ci", "Cm123!"),
}
SELFIE = "data:image/jpeg;base64," + "A" * 1500
TODAY = datetime.now(timezone.utc).date().isoformat()
FORBIDDEN_COST = {"cost", "cost_price", "purchase_price", "margin", "profit", "revenue"}
_tokens = {}
_created_att = []


def _walk_keys(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield k
            yield from _walk_keys(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _walk_keys(v)


def sess(role):
    if role not in _tokens:
        email, pw = CREDS[role]
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
        assert r.status_code == 200, r.text
        tok = r.json()["token"]
        uid = r.json()["user"]["id"]
        if r.json()["user"].get("punch_required"):
            had = MDB.attendance.find_one({"user_id": uid, "day": TODAY, "kind": "arrival"})
            c = requests.post(f"{BASE_URL}/api/attendance/check-in", json={"kind": "arrival", "selfie": SELFIE},
                              headers={"Authorization": f"Bearer {tok}"})
            assert c.status_code == 200, c.text
            if not had:
                _created_att.append(uid)
        _tokens[role] = (tok, uid)
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {_tokens[role][0]}"
    return s


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    for uid in _created_att:
        MDB.attendance.delete_many({"user_id": uid, "day": TODAY})
    MDB.orders.delete_many({"note": "TEST_role_access"})


# --- Punch gate before access
def test_punch_required_for_limited_role():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=dict(zip(("email", "password"), CREDS["sales"])))
    assert r.status_code == 200
    assert "punch_required" in r.json()["user"]


# --- Deny-by-default per role
@pytest.mark.parametrize("role,method,path,expected", [
    ("sales", "GET", "/api/dashboard/kpis", 403),
    ("sales", "GET", "/api/stats/sales", 403),
    ("sales", "GET", "/api/cash-sessions", 403),
    ("sales", "GET", "/api/expenses", 403),
    ("sales", "POST", "/api/products", 403),
    ("sales", "GET", "/api/products", 200),
    ("sales", "GET", "/api/orders", 200),
    ("sales", "GET", "/api/customers", 200),
    ("sales", "GET", "/api/users", 403),
    ("stock_keeper", "GET", "/api/customers", 403),
    ("stock_keeper", "GET", "/api/dashboard/kpis", 403),
    ("stock_keeper", "GET", "/api/purchase-orders", 200),
    ("stock_keeper", "GET", "/api/suppliers", 200),
    ("community_manager", "GET", "/api/customers", 200),
    ("community_manager", "POST", "/api/pos/holds", 403),
    ("community_manager", "GET", "/api/dashboard/kpis", 403),
    ("community_manager", "GET", "/api/stats/full", 403),
    ("community_manager", "GET", "/api/reviews", 200),
    ("community_manager", "GET", "/api/promotions", 200),
    ("manager", "GET", "/api/dashboard/kpis", 200),
])
def test_api_allow_list(role, method, path, expected):
    s = sess(role)
    r = s.request(method, f"{BASE_URL}{path}", json={} if method != "GET" else None)
    if expected == 403:
        assert r.status_code == 403, f"{role} {method} {path} -> {r.status_code}"
    else:
        assert r.status_code == 200, f"{role} {method} {path} -> {r.status_code} {r.text[:200]}"


# --- Field-level stripping
@pytest.mark.parametrize("role", ["sales", "stock_keeper", "community_manager"])
def test_products_no_cost_keys(role):
    s = sess(role)
    r = s.get(f"{BASE_URL}/api/products")
    assert r.status_code == 200
    data = r.json()
    assert len(data) if isinstance(data, list) else data
    assert not (set(_walk_keys(data)) & FORBIDDEN_COST)
    items = data if isinstance(data, list) else data.get("items", [])
    assert "price" in items[0]


LEAK_KEYS = FORBIDDEN_COST | {"valeur_cout", "marge_moyenne", "avg_margin", "ca_30d", "avg_expected_margin", "landed_unit_cost"}


@pytest.mark.parametrize("role", ["sales", "stock_keeper", "community_manager"])
@pytest.mark.parametrize("path", ["/api/products/kpis", "/api/brands/full", "/api/brands/kpis"])
def test_aggregate_endpoints_no_margin(role, path):
    r = sess(role).get(f"{BASE_URL}{path}")
    assert r.status_code in (200, 403)
    if r.status_code == 200:
        leaked = set(_walk_keys(r.json())) & LEAK_KEYS
        assert not leaked, f"{role} {path} leaks {leaked}"


def test_stock_keeper_po_kpis_no_amounts():
    r = sess("stock_keeper").get(f"{BASE_URL}/api/purchase-orders/kpis")
    assert r.status_code in (200, 403)
    if r.status_code == 200:
        leaked = set(r.json()) & {"total_month", "due", "avg_expected_margin"}
        assert not leaked, f"PO kpis leak {leaked}"


def test_public_products_no_cost():
    r = requests.get(f"{BASE_URL}/api/public/products")
    assert r.status_code == 200
    leaked = set(_walk_keys(r.json())) & FORBIDDEN_COST
    assert not leaked, f"unauthenticated /api/public/products leaks {leaked}"


@pytest.mark.parametrize("role", ["sales", "stock_keeper"])
def test_stock_endpoints_no_cost(role):
    s = sess(role)
    for p in ("/api/stock-movements", "/api/stock/alerts", "/api/stock-alerts"):
        r = s.get(f"{BASE_URL}{p}")
        if r.status_code == 200:
            assert not (set(_walk_keys(r.json())) & FORBIDDEN_COST), p


def test_stock_keeper_purchase_orders_no_money():
    r = sess("stock_keeper").get(f"{BASE_URL}/api/purchase-orders")
    assert r.status_code == 200
    keys = set(_walk_keys(r.json()))
    assert not (keys & {"total", "amount", "unit_price", "price", "cost"}), keys & {"total", "amount", "unit_price", "price", "cost"}


def test_cm_customers_orders_no_money():
    s = sess("community_manager")
    for p in ("/api/customers", "/api/orders"):
        r = s.get(f"{BASE_URL}{p}")
        assert r.status_code == 200
        keys = set(_walk_keys(r.json()))
        bad = {"total", "subtotal", "total_spent", "wallet_balance", "wallet"}
        assert not (keys & bad), (p, keys & bad)


@pytest.mark.parametrize("role", ["manager", "admin"])
def test_manager_admin_keep_cost(role):
    r = sess(role).get(f"{BASE_URL}/api/products")
    assert r.status_code == 200
    assert "cost" in set(_walk_keys(r.json()))


def test_stock_keeper_patch_cost_ignored():
    adm = sess("admin")
    prods = adm.get(f"{BASE_URL}/api/products").json()
    prods = prods if isinstance(prods, list) else prods["items"]
    p = next(x for x in prods if x.get("cost"))
    orig_cost, orig_name = p["cost"], p["name"]
    r = sess("stock_keeper").patch(f"{BASE_URL}/api/products/{p['id']}", json={"cost": 1, "name": orig_name})
    assert r.status_code == 200, r.text
    after = MDB.products.find_one({"id": p["id"]})
    if after.get("cost") != orig_cost:
        MDB.products.update_one({"id": p["id"]}, {"$set": {"cost": orig_cost}})
    assert after.get("cost") == orig_cost


# --- Role dashboard
def test_dashboard_role_sales_my_sales():
    s = sess("sales")
    before = s.get(f"{BASE_URL}/api/dashboard/role").json()
    for k in ("to_process", "to_prepare", "my_sales_count", "my_sales_total"):
        assert k in before
    assert not ({"revenue", "margin", "ca"} & set(before))
    o = s.post(f"{BASE_URL}/api/orders", json={"items": [{"product_id": "TEST_none", "name": "TEST item", "qty": 1, "price": 1234}],
                                                 "note": "TEST_role_access", "mode": "store"})
    assert o.status_code == 200, o.text
    # an order created by someone else must not count
    m = sess("manager").post(f"{BASE_URL}/api/orders", json={"items": [{"product_id": "TEST_none", "name": "TEST item", "qty": 1, "price": 999}],
                                                               "note": "TEST_role_access", "mode": "store"})
    assert m.status_code == 200
    after = s.get(f"{BASE_URL}/api/dashboard/role").json()
    assert after["my_sales_count"] == before["my_sales_count"] + 1
    assert abs(after["my_sales_total"] - before["my_sales_total"] - 1234) < 0.01


def test_dashboard_role_stock_keeper():
    d = sess("stock_keeper").get(f"{BASE_URL}/api/dashboard/role").json()
    for k in ("low_stock", "out_of_stock", "purchases_pending"):
        assert isinstance(d.get(k), int)


def test_dashboard_role_cm():
    d = sess("community_manager").get(f"{BASE_URL}/api/dashboard/role").json()
    for k in ("reviews_pending", "unread_messages", "active_promotions", "campaigns"):
        assert isinstance(d.get(k), int)


# --- CM writes on its own modules (plan: CM manages site appearance/pages, promos, campaigns, reviews)
def test_cm_can_patch_site_content():
    s = sess("community_manager")
    r = s.patch(f"{BASE_URL}/api/site", json={})
    assert r.status_code == 200, f"CM PATCH /api/site -> {r.status_code} {r.text[:150]}"


def test_cm_can_create_promotion():
    r = sess("community_manager").post(f"{BASE_URL}/api/promotions", json={})
    assert r.status_code != 403, f"CM POST /api/promotions -> 403 (require_role admin/manager)"
