# UI seed for iteration 97: TEST product + TEST open cash session. `python ui_seed_iter97.py clean` to remove.
import os, sys, uuid
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

if len(sys.argv) > 1 and sys.argv[1] == "clean":
    pids = [p["id"] for p in db.products.find({"name": {"$regex": "^TEST_"}}, {"id": 1})]
    print("products", db.products.delete_many({"id": {"$in": pids}}).deleted_count)
    print("unsellable", db.unsellable_items.delete_many({"product_id": {"$in": pids}}).deleted_count)
    print("movs", db.stock_movements.delete_many({"product_id": {"$in": pids}}).deleted_count)
    sids = [s["id"] for s in db.cash_sessions.find({"id": {"$regex": "^TEST_"}}, {"id": 1})]
    print("cash", db.cash_sessions.delete_many({"id": {"$in": sids}}).deleted_count)
    for sid in sids:
        db.manager_balance.delete_many({"session_id": sid}); db.audit_log.delete_many({"entity_id": sid})
        db.notifications.delete_many({"link": {"$regex": sid}}); db.user_notifications.delete_many({"link": {"$regex": sid}})
    db.user_notifications.delete_many({"msg": {"$regex": "TEST_"}}); db.user_notifications.delete_many({"title": {"$regex": "TEST_"}})
    db.settings_kv.update_one({"key": "unsellable_statuses"}, {"$pull": {"value": {"$regex": "^TEST"}}})
    sys.exit()

pid = str(uuid.uuid4())
db.products.insert_one({"id": pid, "name": "TEST_UI Unsellable", "sku": "TEST-97", "price": 10000, "cost": 4000, "stock": 4, "stock_by_size": {"38": 4}, "active": True, "status": "active", "category": "TEST", "created_at": datetime.now(timezone.utc).isoformat()})
mgr = db.users.find_one({"email": "manager.cocody@dinastore.ci"})
sid = "TEST_ui_" + uuid.uuid4().hex[:6]
now = datetime.now(timezone.utc)
db.cash_sessions.insert_one({"id": sid, "opened_at": now.isoformat(), "opening_cash": 20000.0, "closed": False, "manager_id": mgr["id"], "opened_by": "TEST Gérante", "session_date": now.date().isoformat(), "created_by": "TEST"})
print("PID", pid, "SID", sid)
