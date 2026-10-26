# Iteration 103: inventory 'Compté par' — count_log / counted_by / counted_at traceability + regressions
import os
import uuid

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
PID = f"TEST_prod_cb_{TAG}"


def login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return r.json()


def H(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def ctx():
    admin_d = login("aouattaraesca@gmail.com", "Admin123!")
    admin = admin_d["token"]
    email = f"test_sk_cb_{TAG}@test.ci"
    r = requests.post(f"{API}/users", headers=H(admin), json={"name": f"TEST_SK {TAG}", "email": email, "password": "Test123!", "role": "stock_keeper", "pin": "8371"})
    assert r.status_code == 200, r.text
    sk_id = r.json()["id"]
    db.users.update_one({"id": sk_id}, {"$set": {"tour_done": True}})
    sk = login(email, "Test123!")["token"]
    print("checkin", requests.post(f"{API}/attendance/check-in", headers=H(sk), json={"kind": "arrival", "selfie": SELFIE}).text[:150])
    man = login("manager.cocody@dinastore.ci", "Manager123!")["token"]
    print("checkin", requests.post(f"{API}/attendance/check-in", headers=H(man), json={"kind": "arrival", "selfie": SELFIE}).text[:150])
    db.products.insert_one({"id": PID, "name": f"TEST_Prod CB {TAG}", "sku": f"TEST-CB-{TAG}", "category": "TEST_CAT", "brand": "TEST_Brand",
                            "location": "TEST_LOC", "cost": 1000, "price": 5000, "stock_by_size": {"S": 2, "M": 1}, "stock": 3})
    c = {"admin": admin, "admin_name": admin_d["user"]["name"], "sk": sk, "sk_id": sk_id, "sk_name": f"TEST_SK {TAG}", "man": man}
    yield c
    requests.delete(f"{API}/users/{sk_id}", headers=H(admin))
    db.attendance.delete_many({"user_id": sk_id})
    db.notifications.delete_many({"user_id": sk_id})
    db.products.delete_one({"id": PID})
    db.inventories.delete_many({"lines.product_id": PID})
    db.stock_adjustments.delete_many({"product_id": PID})


def new_inv(ctx, name="TEST_inv_cb"):
    r = requests.post(f"{API}/stock/inventories", headers=H(ctx["admin"]), json={"name": f"{name}_{TAG}", "product_ids": [PID]})
    assert r.status_code == 200, r.text
    d = r.json()
    assert len(d["lines"]) == 2
    return d["id"]


def get_inv(tok, iid):
    r = requests.get(f"{API}/stock/inventories", headers=H(tok))
    assert r.status_code == 200
    return next(x for x in r.json() if x["id"] == iid)


def count(tok, iid, counts):
    return requests.post(f"{API}/stock/inventories/{iid}/count", headers=H(tok), json={"counts": counts})


# --- count_log append semantics
def test_count_log_append_and_dedupe(ctx):
    iid = new_inv(ctx)
    r = count(ctx["admin"], iid, [{"line_index": 0, "qty_counted": 2}])
    assert r.status_code == 200, r.text
    l0 = get_inv(ctx["admin"], iid)["lines"][0]
    assert l0["qty_counted"] == 2 and len(l0["count_log"]) == 1
    e = l0["count_log"][0]
    assert e["qty"] == 2 and e["by"] == ctx["admin_name"] and e["role"] == "admin" and e["by_id"] and e["at"]
    assert l0["counted_by"] == ctx["admin_name"] and l0["counted_at"]
    first_at = l0["counted_at"]
    # same qty -> no append (also as string)
    count(ctx["admin"], iid, [{"line_index": 0, "qty_counted": 2}])
    count(ctx["admin"], iid, [{"line_index": 0, "qty_counted": "2"}])
    l0 = get_inv(ctx["admin"], iid)["lines"][0]
    assert len(l0["count_log"]) == 1 and l0["counted_at"] == first_at
    # comment-only and photo-only -> no append
    count(ctx["admin"], iid, [{"line_index": 0, "comment": "TEST note"}])
    count(ctx["admin"], iid, [{"line_index": 0, "photo": "data:image/jpeg;base64,AAAA"}])
    l0 = get_inv(ctx["admin"], iid)["lines"][0]
    assert len(l0["count_log"]) == 1 and l0["comment"] == "TEST note" and l0["photo"].startswith("data:")
    # comment + same qty (what the UI sends) -> no append
    count(ctx["admin"], iid, [{"line_index": 0, "qty_counted": 2, "comment": "TEST note2"}])
    assert len(get_inv(ctx["admin"], iid)["lines"][0]["count_log"]) == 1
    # change -> append
    count(ctx["admin"], iid, [{"line_index": 0, "qty_counted": 3}])
    l0 = get_inv(ctx["admin"], iid)["lines"][0]
    assert [x["qty"] for x in l0["count_log"]] == [2, 3]
    # line 1 untouched
    l1 = get_inv(ctx["admin"], iid)["lines"][1]
    assert l1.get("counted_by") is None and not l1.get("count_log")


# --- joint count by two users: admin + stock_keeper + manager
def test_joint_count_multiple_users(ctx):
    iid = new_inv(ctx, "TEST_inv_joint")
    assert count(ctx["admin"], iid, [{"line_index": 0, "qty_counted": 2}]).status_code == 200
    r = count(ctx["sk"], iid, [{"line_index": 1, "qty_counted": 1}])
    assert r.status_code == 200, r.text
    r = count(ctx["sk"], iid, [{"line_index": 0, "qty_counted": 1}])
    assert r.status_code == 200
    rm = count(ctx["man"], iid, [{"line_index": 0, "qty_counted": 2}])
    assert rm.status_code == 200, rm.text
    inv = get_inv(ctx["sk"], iid)  # non-owner view still exposes count_log
    l0, l1 = inv["lines"]
    assert [x["by"] for x in l0["count_log"]][:2] == [ctx["admin_name"], ctx["sk_name"]]
    assert len(l0["count_log"]) == 3 and l0["count_log"][2]["role"] == "manager"
    assert l0["counted_by"] == l0["count_log"][-1]["by"]
    assert l1["counted_by"] == ctx["sk_name"] and l1["count_log"][0]["role"] == "stock_keeper"
    assert "qty_expected" not in l0  # blind count preserved


# --- regressions: submit / reject / close; owner-only creation
def test_submit_reject_close_flow(ctx):
    iid = new_inv(ctx, "TEST_inv_flow")
    # submit with missing line -> 400
    count(ctx["sk"], iid, [{"line_index": 0, "qty_counted": 2}])
    r = requests.post(f"{API}/stock/inventories/{iid}/submit", headers=H(ctx["sk"]), json={})
    assert r.status_code == 400
    count(ctx["sk"], iid, [{"line_index": 1, "qty_counted": 1}])  # no gaps
    r = requests.post(f"{API}/stock/inventories/{iid}/submit", headers=H(ctx["sk"]), json={"note": "TEST"})
    assert r.status_code == 200, r.text
    assert count(ctx["sk"], iid, [{"line_index": 0, "qty_counted": 5}]).status_code == 400
    assert requests.post(f"{API}/stock/inventories/{iid}/reject", headers=H(ctx["sk"]), json={"reason": "x"}).status_code == 403
    r = requests.post(f"{API}/stock/inventories/{iid}/reject", headers=H(ctx["admin"]), json={"reason": "TEST recount"})
    assert r.status_code == 200
    inv = get_inv(ctx["admin"], iid)
    assert inv["status"] == "open" and len(inv["lines"][0]["count_log"]) == 1  # log preserved
    requests.post(f"{API}/stock/inventories/{iid}/submit", headers=H(ctx["sk"]), json={})
    r = requests.post(f"{API}/stock/inventories/{iid}/close", headers=H(ctx["admin"]), json={"note": "TEST ok"})
    assert r.status_code == 200 and r.json()["gaps"] == []
    inv = get_inv(ctx["admin"], iid)
    assert inv["status"] == "closed" and inv["lines"][0]["counted_by"] == ctx["sk_name"]
    p = db.products.find_one({"id": PID})
    assert p["stock"] == 3


def test_non_owner_cannot_create(ctx):
    for tok in (ctx["man"], ctx["sk"]):
        r = requests.post(f"{API}/stock/inventories", headers=H(tok), json={"name": f"TEST_x_{TAG}", "product_ids": [PID]})
        assert r.status_code == 403, r.text
    r = requests.post(f"{API}/stock/inventories", headers=H(ctx["man"]), json={"name": f"TEST_x_{TAG}", "kind": "surprise", "product_ids": [PID]})
    assert r.status_code == 403
