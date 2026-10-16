# Seed / cleanup TEST_UI orders for Commandes merge UI test. Usage: python ui_seed_commandes.py seed|clean
import os, sys, json, requests
from datetime import datetime, timezone
from pymongo import MongoClient

BASE = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
db = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[os.environ.get("DB_NAME", "dina_store")]

def seed():
    s = requests.Session()
    t = s.post(f"{BASE}/api/auth/login", json={"email": "aouattaraesca@gmail.com", "password": "Admin123!"}).json()
    s.headers["Authorization"] = f"Bearer {t.get('token') or t.get('access_token')}"
    plan = ["nouvelle", "nouvelle", "nouvelle", "en_attente_acompte", "confirmee", "confirmee", "prete", "prete"]
    out = {}
    for i, stt in enumerate(plan):
        o = s.post(f"{BASE}/api/orders", json={
            "items": [{"product_id": "TEST_prod_ui", "name": f"TEST_Robe UI {i}", "qty": 1, "price": 10000, "size": "M"},
                      {"product_id": "TEST_prod_ui2", "name": f"TEST_Sac UI {i}", "qty": 1, "price": 5000}],
            "customer": {"name": f"TEST_UI Cliente {i}", "phone": "+225 07 00 99 98 0" + str(i)},
            "channel": "boutique", "payment_method": "cod", "mode": "delivery", "delivery_fee": 1000, "delivery_zone": "Cocody"}).json()
        extra = {"status": stt}
        if stt == "en_attente_acompte":
            extra.update(deposit_required=5000, deposit_paid=0)
        db.orders.update_one({"id": o["id"]}, {"$set": extra})
        out.setdefault(stt, []).append(o["code"])
    print(json.dumps(out))

def clean():
    ids = [o["id"] for o in db.orders.find({"customer.name": {"$regex": "^TEST_UI"}}, {"id": 1})]
    db.delivery_sessions.update_many({}, {"$pull": {"orders": {"$in": ids}}})
    db.delivery_sessions.delete_many({"orders": {"$size": 0}, "created_at": {"$gte": datetime.now(timezone.utc).date().isoformat()}})
    for col in ("whatsapp_outbox", "invoices"):
        db[col].delete_many({"order_id": {"$in": ids}})
    db.audit_log.delete_many({"entity_id": {"$in": ids}})
    for i in ids:
        db.user_notifications.delete_many({"event_key": {"$regex": i}})
    db.orders.delete_many({"id": {"$in": ids}})
    print("cleaned", len(ids))

seed() if sys.argv[1] == "seed" else clean()
