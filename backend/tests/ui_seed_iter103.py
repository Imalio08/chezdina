# UI seed iter103: TEST product + TEST inventory with line0 counted twice (admin then manager). Prints inventory id. Usage: python ui_seed_iter103.py [cleanup]
import os, sys, requests
from dotenv import load_dotenv
from pymongo import MongoClient
load_dotenv("/app/frontend/.env"); load_dotenv("/app/backend/.env")
API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
PID = "TEST_ui_cb_prod"
if len(sys.argv) > 1:
    db.products.delete_one({"id": PID}); db.inventories.delete_many({"lines.product_id": PID}); print("cleaned"); sys.exit()
H = lambda t: {"Authorization": f"Bearer {t}"}
adm = requests.post(f"{API}/auth/login", json={"email": "aouattaraesca@gmail.com", "password": "Admin123!"}).json()["token"]
man = requests.post(f"{API}/auth/login", json={"email": "manager.cocody@dinastore.ci", "password": "Manager123!"}).json()["token"]
db.products.delete_one({"id": PID}); db.inventories.delete_many({"lines.product_id": PID})
db.products.insert_one({"id": PID, "name": "TEST_UI CountedBy", "sku": "TEST-UI-CB", "cost": 1000, "price": 5000, "stock_by_size": {"S": 2, "M": 1, "L": 4}, "stock": 7})
iid = requests.post(f"{API}/stock/inventories", headers=H(adm), json={"name": "TEST_UI Compté par", "product_ids": [PID]}).json()["id"]
requests.post(f"{API}/stock/inventories/{iid}/count", headers=H(adm), json={"counts": [{"line_index": 0, "qty_counted": 1}]})
print(requests.post(f"{API}/stock/inventories/{iid}/count", headers=H(man), json={"counts": [{"line_index": 0, "qty_counted": 2}]}).status_code)
print(iid)
