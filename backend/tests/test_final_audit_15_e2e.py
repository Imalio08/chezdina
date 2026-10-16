# Final audit §15.7 cross-platform: storefront COD order -> console flow -> rider -> delivered -> tracking. Run with -n 0
import os
import uuid
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
R1 = mdb.users.find_one({"email": "rider1@dinastore.ci"})
PHONE = "+225 07 00 15 15 20"
ST = {}


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "aouattaraesca@gmail.com", "password": "Admin123!"})
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return s


@pytest.fixture(scope="module")
def rider():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/rider-login-pin", json={"pin": "5555"})
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return s


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    oid = ST.get("oid")
    if not oid:
        return
    o = mdb.orders.find_one({"id": oid}) or {}
    for it in o.get("items", []):  # restore stock
        mdb.products.update_one({"id": it["product_id"]}, {"$inc": {"stock": it["qty"], f"stock_by_size.{it.get('size')}": it["qty"]}})
        mdb.products.update_one({"id": it["product_id"], "variants": {"$elemMatch": {"size": it.get("size"), "color": it.get("color")}}}, {"$inc": {"variants.$.stock": it["qty"]}})
    if ST.get("sid"):
        mdb.delivery_sessions.delete_one({"id": ST["sid"]})
    convs = [c["id"] for c in mdb.conversations.find({"$or": [{"order_id": oid}, {"key": {"$regex": oid}}]}, {"id": 1})]
    mdb.messages.delete_many({"conversation_id": {"$in": convs}})
    mdb.conversations.delete_many({"id": {"$in": convs}})
    for col in ("invoices", "whatsapp_outbox", "audit_log"):
        mdb[col].delete_many({"$or": [{"order_id": oid}, {"entity_id": oid}]})
    mdb.user_notifications.delete_many({"ref": o.get("code")})
    mdb.notifications.delete_many({"$or": [{"msg": {"$regex": o.get("code", "zz")}}, {"title": {"$regex": o.get("code", "zz")}}, {"link": {"$regex": o.get("code", "zz")}}]})
    mdb.wallet_tx.delete_many({"order_id": oid}) if "wallet_tx" in mdb.list_collection_names() else None
    mdb.customers.delete_many({"name": "TEST_AUD E2E"})
    mdb.orders.delete_one({"id": oid})


def test_1_storefront_order(admin):
    p = mdb.products.find_one({"variants": {"$elemMatch": {"stock": {"$gte": 3}}}, "price": {"$lt": 40000}})
    v = next(x for x in p["variants"] if x["stock"] >= 3)
    r = requests.post(f"{BASE_URL}/api/public/orders", json={
        "items": [{"product_id": p["id"], "name": p["name"], "size": v["size"], "color": v["color"], "qty": 1, "price": p["price"]}],
        "customer": {"name": "TEST_AUD E2E", "phone": PHONE, "address": "Cocody Riviera 3, face pharmacie"},
        "payment_method": "cod", "mode": "delivery", "delivery_fee": 1500, "delivery_zone": "Cocody", "checkout_key": f"test-aud15-{uuid.uuid4().hex}"})
    assert r.status_code == 200, r.text
    ST.update(oid=r.json()["id"], code=r.json()["code"])
    o = mdb.orders.find_one({"id": ST["oid"]})
    assert o["status"] in ("nouvelle", "en_attente_acompte"), o["status"]
    ST["status0"] = o["status"]
    lst = admin.get(f"{BASE_URL}/api/orders").json()
    assert any(x["id"] == ST["oid"] for x in lst), "new order not in console list"


def test_2_console_flow(admin):
    oid = ST["oid"]
    if ST["status0"] == "en_attente_acompte":
        mdb.orders.update_one({"id": oid}, {"$set": {"status": "nouvelle"}})
    for st in ("confirmee", "en_preparation"):
        assert admin.patch(f"{BASE_URL}/api/orders/{oid}/status-v3", json={"status": st}).status_code == 200
    o = mdb.orders.find_one({"id": oid})
    # stricter contract (iteration_85): scanned_qty must reach qty for each scanned line
    scanned = [{"line_index": i, "product_id": it["product_id"], "scanned": True, "scanned_qty": it["qty"]} for i, it in enumerate(o["items"])]
    assert admin.patch(f"{BASE_URL}/api/orders/{oid}/status-v3", json={"status": "prete", "scanned_items": scanned}).status_code == 200
    r = admin.post(f"{BASE_URL}/api/delivery-sessions", json={"rider_id": R1["id"], "rider_name": R1["name"], "date": "2026-01-16"})
    assert r.status_code == 200, r.text
    ST["sid"] = r.json()["id"]
    r = admin.patch(f"{BASE_URL}/api/delivery-sessions/{ST['sid']}/add-order", json={"order_id": oid})
    assert r.status_code == 200, r.text
    assert mdb.orders.find_one({"id": oid})["status"] == "assignee"


def test_3_rider_sees_order(rider):
    r = rider.get(f"{BASE_URL}/api/deliveries")
    assert r.status_code == 200, r.text
    rows = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
    o = next((x for x in rows if x.get("id") == ST["oid"]), None)
    assert o, "assigned order not visible to rider"
    assert o.get("total") and (o.get("customer") or {}).get("phone") and ((o.get("customer") or {}).get("address") or o.get("address"))


def test_4_rider_message_reaches_console(rider, admin):
    r = rider.post(f"{BASE_URL}/api/orders/{ST['oid']}/thread/rider/send", json={"text": "TEST_AUD j'arrive dans 10 min"})
    assert r.status_code == 200, r.text
    t = admin.get(f"{BASE_URL}/api/orders/{ST['oid']}/thread/rider")
    assert t.status_code == 200 and "TEST_AUD j'arrive" in t.text


def test_5_rider_delivers_and_tracking(rider, admin):
    oid = ST["oid"]
    assert rider.patch(f"{BASE_URL}/api/orders/{oid}/status", json={"status": "en_livraison"}).status_code == 200
    code = mdb.orders.find_one({"id": oid}).get("delivery_code")
    r = rider.post(f"{BASE_URL}/api/orders/{oid}/deliver", json={"method": "code", "code": code, "amount_collected": 1})
    assert r.status_code == 200, r.text
    assert mdb.orders.find_one({"id": oid})["status"] == "livree"
    lst = admin.get(f"{BASE_URL}/api/orders", params={"status": "livree"}).json()
    assert any(x["id"] == oid for x in lst)
    tr = requests.get(f"{BASE_URL}/api/public/orders/track", params={"code": ST["code"], "phone": PHONE})
    assert tr.status_code == 200 and "livree" in tr.text
