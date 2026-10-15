# Seed / cleanup for rider notifications UI test. usage: python ui_seed_rider_notifs.py seed|cleanup
import json, os, random, sys
import requests
from pymongo import MongoClient

API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
db = MongoClient("mongodb://localhost:27017")["dina_store"]
F = "/tmp/ui_seed.json"


def login(e, p):
    d = requests.post(f"{API}/auth/login", json={"email": e, "password": p}).json()
    return {"Authorization": f"Bearer {d['token']}"}, d["user"]


if sys.argv[1] == "seed":
    a, _ = login("aouattaraesca@gmail.com", "Admin123!")
    r1, r1u = login("rider1@dinastore.ci", "Rider123!")
    phone = f"+225 07 {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)}"
    d = requests.post(f"{API}/public/customer-signup", json={"name": "TEST_Cliente UI", "phone": phone, "pin": "482913"}).json()
    ch = {"Authorization": f"Bearer {d['token']}"}
    body = {"items": [{"product_id": "TEST_prod", "name": "TEST_item", "qty": 1, "price": 5000}],
            "customer": {"id": d["customer"]["id"], "name": "TEST_Cliente UI", "phone": phone, "address": "Cocody Riviera"},
            "channel": "whatsapp", "payment_method": "cod", "delivery_zone": "Cocody", "delivery_fee": 1000, "mode": "delivery"}
    o = requests.post(f"{API}/orders", json=body, headers=a).json()
    requests.patch(f"{API}/deliveries/{o['id']}/assign", json={"rider_id": r1u["id"], "rider_name": r1u["name"]}, headers=a)
    cid = requests.post(f"{API}/public/account/thread/rider/{o['code']}", headers=ch).json()["id"]
    requests.post(f"{API}/public/account/messages/send", json={"conversation_id": cid, "text": "TEST_Bonjour, je suis au portail 😀"}, headers=ch)
    json.dump({"order": o["id"], "code": o["code"], "cust": d["customer"]["id"], "conv": cid, "token": d["token"]}, open(F, "w"))
    print(o["code"], cid)
elif sys.argv[1] == "assign2":
    s = json.load(open(F))
    a, _ = login("aouattaraesca@gmail.com", "Admin123!")
    ch = {"Authorization": f"Bearer {s['token']}"}
    r = requests.post(f"{API}/public/account/messages/send", json={"conversation_id": s["conv"], "text": "TEST_Deuxième message live"}, headers=ch)
    print(r.status_code)
else:
    s = json.load(open(F))
    store = db.conversations.find_one({"key": {"$regex": "store:main"}, "participants.id": "9cd8883c-6b67-434a-8111-1fb63eb34481"})
    if store:
        db.conversations.update_one({"id": store["id"]}, {"$pull": {"messages": {"text": {"$regex": "TEST_"}}}})
    db.user_notifications.delete_many({"$or": [{"ref": {"$in": [s["code"], s["conv"]]}}, {"msg": {"$regex": "TEST_"}}]})
    db.conversations.delete_many({"order_id": s["order"]})
    db.whatsapp_outbox.delete_many({"order_id": s["order"]})
    db.orders.delete_one({"id": s["order"]})
    db.customers.delete_one({"id": s["cust"]})
    db.notifications.delete_many({"msg": {"$regex": "TEST_"}})
    print("cleaned")
