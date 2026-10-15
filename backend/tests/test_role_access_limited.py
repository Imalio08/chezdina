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
    ("sales", "GET", "/api/cash-sessions", 200),
    ("sales", "GET", "/api/waitlist/grouped", 200),
    ("sales", "GET", "/api/out-of-catalog", 200),
    ("stock_keeper", "POST", "/api/orders", 403),
    ("sales", "GET", "/api/attendance/today-kiosk", 200),
    ("stock_keeper", "GET", "/api/attendance/today-kiosk", 200),
    ("community_manager", "GET", "/api/attendance/today-kiosk", 200),
    ("community_manager", "GET", "/api/wallet/transactions", 200),
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
    bad = {"total", "amount", "unit_price", "price", "cost", "extra_costs", "landed_unit_cost"}
    assert not (keys & bad), keys & bad


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
    site = MDB.site_settings.find_one({"id": "main"}, {"_id": 0})
    r = s.patch(f"{BASE_URL}/api/site", json={"seo": site.get("seo") or {}})
    MDB.site_settings.replace_one({"id": "main"}, site)
    assert r.status_code == 200, f"CM PATCH /api/site -> {r.status_code} {r.text[:150]}"


def test_cm_can_create_promotion():
    r = sess("community_manager").post(f"{BASE_URL}/api/promotions", json={})
    assert r.status_code != 403, f"CM POST /api/promotions -> 403 (require_role admin/manager)"


# --- Iteration 78 retests
def test_public_endpoints_no_cost_keys():
    for p in ("/api/public/products", "/api/public/best-sellers", "/api/public/site", "/api/public/products?limit=200"):
        r = requests.get(f"{BASE_URL}{p}")
        if r.status_code == 200:
            leaked = {k for k in _walk_keys(r.json()) if k in FORBIDDEN_COST or "margin" in k or "cost" in k}
            assert not leaked, (p, leaked)


def test_sales_cash_session_open_and_pos_sale():
    s = sess("sales")
    mgr_id = sess("manager") and _tokens["manager"][1]
    opened = list(MDB.cash_sessions.find({"closed": False}, {"id": 1}))
    MDB.cash_sessions.update_many({"id": {"$in": [o["id"] for o in opened]}}, {"$set": {"closed": True}})
    new_sid = None
    try:
        r = s.post(f"{BASE_URL}/api/cash-sessions/open", json={"opening_cash": 0, "manager_id": mgr_id,
                                                               "session_date": TODAY, "pin": "2222", "note": "TEST_role_access"})
        assert r.status_code == 200, r.text
        new_sid = r.json()["id"]
        g = s.get(f"{BASE_URL}/api/cash-sessions")
        assert g.status_code == 200 and any(x["id"] == new_sid and not x["closed"] for x in g.json())
        before = s.get(f"{BASE_URL}/api/dashboard/role").json()
        o = s.post(f"{BASE_URL}/api/orders", json={"items": [{"product_id": "TEST_none", "name": "TEST item", "qty": 1, "price": 500}],
                                                     "note": "TEST_role_access", "mode": "store", "channel": "pos", "payment_method": "cash"})
        assert o.status_code == 200, o.text
        after = s.get(f"{BASE_URL}/api/dashboard/role").json()
        assert after["my_sales_count"] == before["my_sales_count"] + 1
    finally:
        if new_sid:
            MDB.cash_sessions.delete_one({"id": new_sid})
        MDB.cash_sessions.update_many({"id": {"$in": [o["id"] for o in opened]}}, {"$set": {"closed": False}})


def test_sales_waitlist_notify():
    w = MDB.waitlist.find_one({}, {"_id": 0})
    r = sess("sales").post(f"{BASE_URL}/api/waitlist/{w['id']}/notify", json={"channel": "whatsapp", "message": "TEST"})
    MDB.waitlist.update_one({"id": w["id"]}, {"$set": {k: w.get(k) for k in w if k != "id"}})
    MDB.waitlist.update_one({"id": w["id"]}, {"$unset": {k: "" for k in ("notified_at", "notified_by") if k not in w}}) if any(k not in w for k in ("notified_at", "notified_by")) else None
    MDB.waitlist_notifications.delete_many({"waitlist_id": w["id"], "message": "TEST"})
    assert r.status_code == 200, r.text


def test_cm_writes_promotion_segment_campaign():
    s = sess("community_manager")
    p = s.post(f"{BASE_URL}/api/promotions", json={"code": "TEST_CMPROMO", "value": 5})
    assert p.status_code == 200, p.text
    assert s.patch(f"{BASE_URL}/api/promotions/{p.json()['id']}", json={"value": 7}).status_code == 200
    assert s.delete(f"{BASE_URL}/api/promotions/{p.json()['id']}").status_code == 200
    sg = s.post(f"{BASE_URL}/api/segments", json={"name": "TEST_seg", "customer_ids": []})
    assert sg.status_code == 200, sg.text
    sid = sg.json()["id"]
    c = s.post(f"{BASE_URL}/api/campaigns", json={"name": "TEST_camp", "text": "TEST", "target_type": "ids", "customer_ids": []})
    assert c.status_code == 200, c.text
    assert s.delete(f"{BASE_URL}/api/campaigns/{c.json()['id']}").status_code == 200
    assert s.delete(f"{BASE_URL}/api/segments/{sid}").status_code == 200
    MDB.promotions.delete_many({"code": "TEST_CMPROMO"})
    MDB.customer_segments_v2.delete_many({"name": "TEST_seg"})
    MDB.campaigns.delete_many({"name": "TEST_camp"})


def test_cm_moderate_review_and_loyalty_and_sections():
    s = sess("community_manager")
    rv = MDB.reviews.find_one({}, {"_id": 0})
    r = s.patch(f"{BASE_URL}/api/reviews/{rv['id']}/moderate", json={"hidden": bool(rv.get("hidden", False))})
    MDB.reviews.replace_one({"id": rv["id"]}, rv)
    assert r.status_code == 200, r.text
    ls = MDB.loyalty_settings.find_one({"id": "main"}, {"_id": 0})
    g = s.get(f"{BASE_URL}/api/loyalty/settings").json()
    r2 = s.patch(f"{BASE_URL}/api/loyalty/settings", json={k: v for k, v in g.items() if k not in ("id", "updated_at")})
    if ls:
        MDB.loyalty_settings.replace_one({"id": "main"}, ls)
    assert r2.status_code == 200, r2.text
    site = MDB.site_settings.find_one({"id": "main"}, {"_id": 0})
    r3 = s.patch(f"{BASE_URL}/api/storefront/sections", json={"sections": site.get("sections") or []})
    MDB.site_settings.replace_one({"id": "main"}, site)
    assert r3.status_code == 200, r3.text


def test_cm_site_whitelist():
    s = sess("community_manager")
    site = MDB.site_settings.find_one({"id": "main"}, {"_id": 0})
    try:
        r = s.patch(f"{BASE_URL}/api/site", json={"theme": {**(site.get("theme") or {}), "TEST_flag": 1}})
        assert r.status_code == 200, r.text
        assert MDB.site_settings.find_one({"id": "main"})["theme"].get("TEST_flag") == 1
        for bad in ({"payments": {"TEST": 1}}, {"security": {"TEST": 1}}):
            r = s.patch(f"{BASE_URL}/api/site", json=bad)
            assert r.status_code == 403, (bad, r.status_code)
        mixed = s.patch(f"{BASE_URL}/api/site", json={"seo": site.get("seo") or {}, "payments": {"TEST": 1}})
        now = MDB.site_settings.find_one({"id": "main"})
        assert (now.get("payments") or {}).get("TEST") is None
        assert now.get("security") == site.get("security")
    finally:
        MDB.site_settings.replace_one({"id": "main"}, site)


def test_admin_can_patch_site_payments():
    s = sess("admin")
    site = MDB.site_settings.find_one({"id": "main"}, {"_id": 0})
    try:
        r = s.patch(f"{BASE_URL}/api/site", json={"payments": {**(site.get("payments") or {}), "TEST_flag": 1}})
        assert r.status_code == 200
        assert MDB.site_settings.find_one({"id": "main"})["payments"].get("TEST_flag") == 1
    finally:
        MDB.site_settings.replace_one({"id": "main"}, site)


def test_stock_keeper_orders_status_only():
    m = sess("manager").post(f"{BASE_URL}/api/orders", json={"items": [{"product_id": "TEST_none", "name": "TEST item", "qty": 1, "price": 100}],
                                                               "note": "TEST_role_access", "mode": "store"})
    assert m.status_code == 200
    oid = m.json()["id"]
    sk = sess("stock_keeper")
    r = sk.patch(f"{BASE_URL}/api/orders/{oid}/status", json={"status": "en_preparation"})
    assert r.status_code == 200, r.text
    r2 = sk.patch(f"{BASE_URL}/api/orders/{oid}", json={"total": 1})
    assert r2.status_code == 403, r2.status_code


def test_stock_keeper_po_list_no_money_keys():
    r = sess("stock_keeper").get(f"{BASE_URL}/api/purchase-orders/kpis")
    assert r.status_code == 200
    assert not (set(r.json()) & {"total_month", "due", "avg_expected_margin"})


def test_cm_customers_no_wallet():
    r = sess("community_manager").get(f"{BASE_URL}/api/customers")
    keys = set(_walk_keys(r.json()))
    assert not (keys & {"wallet", "total_spent", "wallet_balance"})


def test_sales_privilege_escalation_wallet_adjust_blocked():
    # sales inherits manager inside /api/customers -> wallet/adjust (money) should not be allowed for a vendeuse
    c = MDB.customers.find_one({"name": {"$regex": "^Test Pack6"}}, {"_id": 0, "id": 1})
    if not c:
        pytest.skip("no customer")
    r = sess("sales").post(f"{BASE_URL}/api/customers/{c['id']}/wallet/adjust", json={})
    assert r.status_code == 403, f"sales wallet/adjust -> {r.status_code}"
