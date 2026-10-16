# Seed / cleanup helper for iteration_85 UI tests (prep scan, Commandes tabs, paste WA duplicate). usage: python seed_aud85_ui.py seed|clean
import os
import sys
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
now = datetime.now(timezone.utc).isoformat()
P = db.products.find_one({"sku": "DEMO-100"})
Q = db.products.find_one({"variants.0": {"$exists": True}, "sku": {"$nin": ["DEMO-100", None]}})

if sys.argv[1] == "seed":
    db.orders.insert_one({"id": "test-aud85-ui-prep", "code": "TEST-AUD85-PREP", "status": "confirmee", "created_at": now, "payment_method": "cod",
                          "total": 3000, "subtotal": 3000, "mode": "delivery", "delivery_zone": "Cocody",
                          "customer": {"name": "TEST_AUD85 Prep", "phone": "+225 07 00 85 00 01"}, "timeline": [],
                          "items": [{"product_id": P["id"], "sku": "DEMO-100", "name": P["name"], "size": "39", "color": "Noir", "qty": 2, "price": 1000},
                                    {"product_id": Q["id"], "name": Q["name"], "size": Q["variants"][0]["size"], "color": Q["variants"][0]["color"], "qty": 1, "price": 1000}]})
    db.orders.insert_one({"id": "test-aud85-ui-dup", "code": "TEST-AUD85-DUP", "status": "nouvelle", "created_at": now, "payment_method": "cod",
                          "total": 1000, "subtotal": 1000, "mode": "delivery", "customer": {"name": "TEST_AUD85 Dup", "phone": "+225 07 07 85 11 22"},
                          "timeline": [], "items": [{"product_id": P["id"], "name": P["name"], "qty": 1, "price": 1000}]})
    print("P", P["id"], P["name"], "Q", Q["id"], Q["name"], Q["sku"])
else:
    ids = ["test-aud85-ui-prep", "test-aud85-ui-dup"]
    db.orders.delete_many({"id": {"$in": ids}})
    db.audit_log.delete_many({"entity_id": {"$in": ids}})
    db.invoices.delete_many({"order_id": {"$in": ids}})
    db.whatsapp_outbox.delete_many({"order_id": {"$in": ids}})
    db.user_notifications.delete_many({"ref": {"$regex": "TEST-AUD85"}})
    db.notifications.delete_many({"$or": [{"msg": {"$regex": "TEST-AUD85"}}, {"title": {"$regex": "TEST-AUD85"}}]})
    print("cleaned")
