# Probe: concurrent /count from 2 users on different lines -> lost update? (read-modify-write of whole lines array)
import os, uuid, requests, concurrent.futures as cf
from dotenv import load_dotenv
from pymongo import MongoClient
load_dotenv("/app/frontend/.env"); load_dotenv("/app/backend/.env")
API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
TAG = uuid.uuid4().hex[:6]; PID = f"TEST_race_{TAG}"
H = lambda t: {"Authorization": f"Bearer {t}"}
adm = requests.post(f"{API}/auth/login", json={"email": "aouattaraesca@gmail.com", "password": "Admin123!"}).json()["token"]
man = requests.post(f"{API}/auth/login", json={"email": "manager.cocody@dinastore.ci", "password": "Manager123!"}).json()["token"]
sizes = {str(i): 1 for i in range(10)}
db.products.insert_one({"id": PID, "name": f"TEST_race {TAG}", "sku": PID, "cost": 1, "price": 2, "stock_by_size": sizes, "stock": 10})
try:
    lost = 0
    for trial in range(5):
        iid = requests.post(f"{API}/stock/inventories", headers=H(adm), json={"name": f"TEST_race_{TAG}", "product_ids": [PID]}).json()["id"]
        jobs = [(adm if i % 2 == 0 else man, i) for i in range(10)]
        with cf.ThreadPoolExecutor(10) as ex:
            rs = list(ex.map(lambda j: requests.post(f"{API}/stock/inventories/{iid}/count", headers=H(j[0]), json={"counts": [{"line_index": j[1], "qty_counted": 1}]}).status_code, jobs))
        inv = db.inventories.find_one({"id": iid})
        n = sum(1 for l in inv["lines"] if l.get("qty_counted") is not None)
        print(f"trial {trial}: statuses={set(rs)} counted_lines={n}/10")
        lost += 10 - n
    print("TOTAL LOST UPDATES:", lost)
finally:
    db.products.delete_one({"id": PID}); db.inventories.delete_many({"lines.product_id": PID})
