# UI seed/cleanup for iteration 101 (tour, permissions UI, inventories UI). Usage: python ui_seed_iter101.py seed|cleanup
import json, os, sys, requests
from dotenv import load_dotenv
from pymongo import MongoClient
load_dotenv("/app/frontend/.env"); load_dotenv("/app/backend/.env")
API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
SELFIE = "data:image/jpeg;base64," + "A" * 1500
H = lambda t: {"Authorization": f"Bearer {t}"}
a = requests.post(f"{API}/auth/login", json={"email": "aouattaraesca@gmail.com", "password": "Admin123!"}).json()["token"]
F = "/tmp/seed101.json"

if sys.argv[1] == "seed":
    out = {}
    for key, role, pin in (("mgr", "manager", "8101"), ("mgr2", "manager", "8102"), ("rider", "rider", "7391")):
        em = f"test_ui101_{key}@test.ci"
        u = requests.post(f"{API}/users", headers=H(a), json={"name": f"TEST_UI {key}", "email": em, "password": "Test123!", "role": role, "pin": pin})
        assert u.status_code == 200, u.text
        out[key] = {"id": u.json()["id"], "email": em}
        if role != "rider":
            t = requests.post(f"{API}/auth/login", json={"email": em, "password": "Test123!"}).json()["token"]
            print(key, requests.post(f"{API}/attendance/check-in", headers=H(t), json={"kind": "arrival", "selfie": SELFIE}).status_code)
    db.products.insert_one({"id": "TEST_prod_ui101", "name": "TEST_Prod UI101", "sku": "TEST-UI101", "category": "TEST_CAT_UI101", "brand": "TEST_Brand",
                            "location": "TEST_LOC", "cost": 1000, "price": 5000, "stock_by_size": {"S": 2, "M": 1}, "stock": 3, "active": True})
    # mgr2: clients none (with shared-read pages none too) + promotions read
    r = requests.patch(f"{API}/roles-permissions", headers=H(a), json={"matrix": {"manager": {"/console/clients": "none", "/console/promotions": "read"}}})
    print("matrix", r.status_code)
    json.dump(out, open(F, "w")); print(out)
else:
    out = json.load(open(F))
    requests.patch(f"{API}/roles-permissions", headers=H(a), json={"matrix": {}})
    db.roles_permissions.update_one({"id": "main"}, {"$unset": {"v2": ""}})
    for v in out.values():
        requests.delete(f"{API}/users/{v['id']}", headers=H(a))
        db.attendance.delete_many({"user_id": v["id"]}); db.notifications.delete_many({"user_id": v["id"]})
    db.products.delete_one({"id": "TEST_prod_ui101"})
    db.inventories.delete_many({"lines.product_id": "TEST_prod_ui101"})
    db.inventories.delete_many({"name": {"$regex": "^TEST_"}})
    db.inventory_plans.delete_many({"name": {"$regex": "^TEST_"}})
    db.stock_adjustments.delete_many({"product_id": "TEST_prod_ui101"})
    print("cleaned")
