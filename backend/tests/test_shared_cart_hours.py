# Shared cart confirm flow + store GPS public business + attendance hours config / personal hours tests
import os
import pytest
import requests
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", dotenv_values("/app/frontend/.env").get("REACT_APP_BACKEND_URL")).rstrip("/")
ENV = dotenv_values("/app/backend/.env")
DB = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
PID = "2c2005f5-cabe-46e5-9a4b-657f093f24a6"  # Escarpins Satin Rouge
STOCK_UID = "7967ef91-92a4-4f68-ac37-fd74563a563c"  # stock@dinastore.ci
SELFIE = "data:image/jpeg;base64," + "A" * 1200


def login(email, pw):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    if r.status_code != 200:
        pytest.skip(f"login failed {email}")
    s = requests.Session()
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers["Authorization"] = f"Bearer {tok}"
    return s


def restore_order(code):
    o = DB.orders.find_one({"code": code})
    if not o:
        return
    for it in o.get("items", []):
        q = int(it.get("qty", 1))
        DB.products.update_one({"id": it["product_id"]}, {"$inc": {"stock": q}})
        if it.get("size"):
            DB.products.update_one({"id": it["product_id"]}, {"$inc": {f"stock_by_size.{it['size']}": q}})
        if it.get("color"):
            DB.products.update_one({"id": it["product_id"], "variants": {"$elemMatch": {"size": it.get("size") or "Unique", "color": it["color"]}}}, {"$inc": {"variants.$.stock": q}})
    DB.stock_movements.delete_many({"ref": code})
    DB.notifications.delete_many({"title": {"$regex": code}})
    DB.orders.delete_one({"code": code})


@pytest.fixture(scope="module")
def admin():
    return login("aouattaraesca@gmail.com", "Admin123!")


@pytest.fixture(scope="module")
def created():
    codes, carts = [], []
    yield codes, carts
    for c in codes:
        restore_order(c)
    DB.shared_carts.delete_many({"id": {"$in": carts}})


def items():
    return [
        {"product_id": PID, "name": "Escarpins Satin Rouge", "size": "38", "color": "Rouge", "qty": 1, "price": 29500},
        {"product_id": PID, "name": "Escarpins Satin Rouge", "size": "41", "color": "Nude", "qty": 1, "price": 29500},
    ]


def make_cart(admin, carts, mode="store", fee=0, customer=None):
    r = admin.post(f"{BASE_URL}/api/pos/shared-cart", json={"items": items(), "mode": mode, "delivery_fee": fee, "zone": "Cocody",
                                                          "customer": customer or {"name": "TEST_SC Cliente"}})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["link"] == f"/panier-partage/{d['id']}"
    carts.append(d["id"])
    return d["id"]


# Shared cart: public GET
def test_public_get(admin, created):
    sid = make_cart(admin, created[1])
    r = requests.get(f"{BASE_URL}/api/public/shared-cart/{sid}")
    assert r.status_code == 200
    d = r.json()
    assert len(d["items"]) == 2 and "_id" not in d and d["confirmed"] is False


# Shared cart: phone required
def test_phone_required(admin, created):
    sid = make_cart(admin, created[1])
    r = requests.post(f"{BASE_URL}/api/public/shared-cart/{sid}/confirm", json={"items": items(), "payment_method": "cod", "customer": {"name": "TEST_SC"}})
    assert r.status_code == 400 and "téléphone" in r.json()["detail"].lower()
    assert DB.shared_carts.find_one({"id": sid})["confirmed"] is False


# Shared cart: confirm wave with qty change, removal, client price ignored -> pickup order 'confirmee'
def test_confirm_wave_store(admin, created):
    sid = make_cart(admin, created[1])
    before = DB.products.find_one({"id": PID}, {"stock": 1, "stock_by_size": 1, "variants": 1})
    body_items = [{"product_id": PID, "size": "38", "color": "Rouge", "qty": 2, "price": 1}]  # remove 2nd line, qty 2, tampered price
    r = requests.post(f"{BASE_URL}/api/public/shared-cart/{sid}/confirm", json={"items": body_items, "payment_method": "wave",
                                                                              "customer": {"name": "TEST_SC Awa", "phone": "07 00 99 88 77"}})
    assert r.status_code == 200, r.text
    d = r.json()
    created[0].append(d["code"])
    o = d["order"]
    assert o["status"] == "confirmee" and o["mode"] == "pickup" and o["payment_method"] == "wave"
    assert len(o["items"]) == 1 and o["items"][0]["qty"] == 2 and o["items"][0]["price"] == 29500
    assert o["total"] == 59000 and o["delivery_fee"] == 0
    assert o["customer"]["phone"].replace(" ", "").endswith("0700998877")
    after = DB.products.find_one({"id": PID}, {"stock": 1, "stock_by_size": 1, "variants": 1})
    assert after["stock"] == before["stock"] - 2
    assert after["stock_by_size"]["38"] == before["stock_by_size"]["38"] - 2
    # order listed + notification
    lst = admin.get(f"{BASE_URL}/api/orders", params={"q": d["code"]}).json()
    assert any(x["code"] == d["code"] and x["status"] == "confirmee" for x in lst)
    assert DB.notifications.find_one({"title": {"$regex": d["code"]}}) is not None
    assert DB.stock_movements.count_documents({"ref": d["code"]}) == 1
    # double confirm -> 400; GET -> already_confirmed
    r2 = requests.post(f"{BASE_URL}/api/public/shared-cart/{sid}/confirm", json={"items": body_items, "payment_method": "cod", "customer": {"phone": "0700998877"}})
    assert r2.status_code == 400
    g = requests.get(f"{BASE_URL}/api/public/shared-cart/{sid}").json()
    assert g.get("error") == "already_confirmed" and g.get("order_code") == d["code"]


# Shared cart: delivery mode cod -> mode delivery with fee
def test_confirm_cod_delivery(admin, created):
    sid = make_cart(admin, created[1], mode="delivery", fee=1500, customer={"name": "TEST_SC Liv", "phone": "0700998866"})
    r = requests.post(f"{BASE_URL}/api/public/shared-cart/{sid}/confirm", json={"payment_method": "cod"})
    assert r.status_code == 200, r.text
    d = r.json()
    created[0].append(d["code"])
    o = d["order"]
    assert o["mode"] == "delivery" and o["delivery_fee"] == 1500 and o["total"] == 59000 + 1500 and o["status"] == "confirmee"


# Shared cart: all items removed -> 400
def test_empty_items(admin, created):
    sid = make_cart(admin, created[1])
    r = requests.post(f"{BASE_URL}/api/public/shared-cart/{sid}/confirm", json={"items": [], "payment_method": "cod", "customer": {"phone": "0700998877"}})
    assert r.status_code == 400


def test_unknown_cart():
    assert requests.get(f"{BASE_URL}/api/public/shared-cart/nope-xyz").status_code == 404
    assert requests.post(f"{BASE_URL}/api/public/shared-cart/nope-xyz/confirm", json={}).status_code == 404


# Public business exposes lat/lng
def test_public_business_latlng():
    d = requests.get(f"{BASE_URL}/api/public/business").json()
    assert "lat" in d and "lng" in d


# Attendance: hours-config roles incl custom role
def test_hours_config(admin):
    r = admin.get(f"{BASE_URL}/api/attendance/hours-config")
    assert r.status_code == 200
    d = r.json()
    keys = [x["key"] for x in d["roles"]]
    assert "vendeuse" in keys and "manager" in keys and "rider" in keys and "admin" not in keys
    assert any(e["id"] == STOCK_UID for e in d["employees"])


def test_hours_config_forbidden_non_admin():
    s = login("stock@dinastore.ci", "Stock123!")
    assert s.get(f"{BASE_URL}/api/attendance/hours-config").status_code in (401, 403, 428)
    assert s.patch(f"{BASE_URL}/api/users/{STOCK_UID}/working-hours", json={"working_hours": None}).status_code in (401, 403, 428)


# Attendance: personal hours set/reset + 404
def test_user_working_hours(admin):
    r = admin.patch(f"{BASE_URL}/api/users/{STOCK_UID}/working-hours", json={"working_hours": {"open": "07:30", "close": "16:00", "tolerance_min": 999, "days": ["mon", "xxx"]}})
    assert r.status_code == 200
    wh = r.json()["working_hours"]
    assert wh == {"open": "07:30", "close": "16:00", "tolerance_min": 240, "days": ["mon"]}
    assert DB.users.find_one({"id": STOCK_UID})["working_hours"]["open"] == "07:30"
    e = [x for x in admin.get(f"{BASE_URL}/api/attendance/hours-config").json()["employees"] if x["id"] == STOCK_UID][0]
    assert e["working_hours"]["open"] == "07:30"
    r = admin.patch(f"{BASE_URL}/api/users/{STOCK_UID}/working-hours", json={"working_hours": None})
    assert r.status_code == 200 and "working_hours" not in DB.users.find_one({"id": STOCK_UID})
    assert admin.patch(f"{BASE_URL}/api/users/nope/working-hours", json={"working_hours": None}).status_code == 404


# Attendance: check-in lateness uses personal hours over role hours
def test_checkin_personal_over_role(admin):
    biz = DB.business.find_one({"id": "main"})
    orig_wh = biz.get("working_hours") or {}
    s = login("stock@dinastore.ci", "Stock123!")
    today = datetime.now(timezone.utc).date().isoformat()
    if DB.attendance.find_one({"user_id": STOCK_UID, "day": today}):
        pytest.skip("stock user already has attendance today")
    ids = []
    try:
        # role hours: open 00:00 tol 0 -> late; personal hours: open 23:59 -> not late
        DB.business.update_one({"id": "main"}, {"$set": {"working_hours": {**orig_wh, "stock_keeper": {"open": "00:00", "tolerance_min": 0}}}})
        admin.patch(f"{BASE_URL}/api/users/{STOCK_UID}/working-hours", json={"working_hours": {"open": "23:59", "close": "23:59", "tolerance_min": 0, "days": []}})
        r = s.post(f"{BASE_URL}/api/attendance/check-in", json={"kind": "arrival", "selfie": SELFIE})
        assert r.status_code == 200, r.text
        assert r.json()["late"] is False
        DB.attendance.delete_many({"user_id": STOCK_UID, "day": today})
        # reset personal -> role hours apply -> late
        admin.patch(f"{BASE_URL}/api/users/{STOCK_UID}/working-hours", json={"working_hours": None})
        r = s.post(f"{BASE_URL}/api/attendance/check-in", json={"kind": "arrival", "selfie": SELFIE})
        assert r.status_code == 200, r.text
        now = datetime.now(timezone.utc)
        if now.hour * 60 + now.minute > 1:
            assert r.json()["late"] is True
    finally:
        DB.attendance.delete_many({"user_id": STOCK_UID, "day": today})
        DB.users.update_one({"id": STOCK_UID}, {"$unset": {"working_hours": ""}})
        DB.business.update_one({"id": "main"}, {"$set": {"working_hours": orig_wh}})
