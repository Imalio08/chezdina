# UI seed/cleanup for iteration 102 (perm fixes UI). Usage: python ui_seed_iter102.py seed|readonly|cleanup
import json, os, sys, requests
from dotenv import load_dotenv
from pymongo import MongoClient
load_dotenv("/app/frontend/.env"); load_dotenv("/app/backend/.env")
API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
SELFIE = "data:image/jpeg;base64," + "A" * 1500
H = lambda t: {"Authorization": f"Bearer {t}"}
a = requests.post(f"{API}/auth/login", json={"email": "aouattaraesca@gmail.com", "password": "Admin123!"}).json()["token"]
F = "/tmp/seed102.json"
cmd = sys.argv[1]
if cmd == "seed":
    out = {}
    for key, role, pin in (("mgr", "manager", "8201"), ("sales", "sales", "8202"), ("stock", "stock_keeper", "8203"), ("cm", "community_manager", "8204")):
        em = f"test_ui102_{key}@test.ci"
        db.users.delete_many({"email": em})
        u = requests.post(f"{API}/users", headers=H(a), json={"name": f"TEST_UI102 {key}", "email": em, "password": "Test123!", "role": role, "pin": pin})
        assert u.status_code == 200, u.text
        out[key] = {"id": u.json()["id"], "email": em}
        db.users.update_one({"id": out[key]["id"]}, {"$set": {"tour_done": True}})
        t = requests.post(f"{API}/auth/login", json={"email": em, "password": "Test123!"}).json()["token"]
        print(key, requests.post(f"{API}/attendance/check-in", headers=H(t), json={"kind": "arrival", "selfie": SELFIE}).status_code)
    json.dump(out, open(F, "w")); print(out)
elif cmd == "readonly":
    print(requests.patch(f"{API}/roles-permissions", headers=H(a), json={"matrix": {"manager": {"/console/produits": "read", "/console/promotions": "read"}}}).status_code)
elif cmd == "reset":
    requests.patch(f"{API}/roles-permissions", headers=H(a), json={"matrix": {}})
    db.roles_permissions.update_one({"id": "main"}, {"$unset": {"v2": ""}})
    print("reset")
else:
    out = json.load(open(F))
    requests.patch(f"{API}/roles-permissions", headers=H(a), json={"matrix": {}})
    db.roles_permissions.update_one({"id": "main"}, {"$unset": {"v2": ""}})
    for v in out.values():
        requests.delete(f"{API}/users/{v['id']}", headers=H(a))
        db.users.delete_one({"id": v["id"]}); db.attendance.delete_many({"user_id": v["id"]}); db.notifications.delete_many({"user_id": v["id"]})
    db.role_meta.delete_many({"key": {"$regex": "^test"}})
    db.users.delete_many({"email": {"$regex": "^test_ui102"}})
    print("cleaned")
