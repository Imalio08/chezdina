# Iter102: create user for the UI-created custom role test_ui_caisse, check server levels; also promotions read -> DELETE 403
import os, requests
from dotenv import load_dotenv
from pymongo import MongoClient
load_dotenv("/app/frontend/.env"); load_dotenv("/app/backend/.env")
API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
H = lambda t: {"Authorization": f"Bearer {t}"}
a = requests.post(f"{API}/auth/login", json={"email": "aouattaraesca@gmail.com", "password": "Admin123!"}).json()["token"]
print("role_meta:", db.role_meta.find_one({"key": "test_ui_caisse"}, {"_id": 0}))
em = "test_ui102_custom@test.ci"; db.users.delete_many({"email": em})
u = requests.post(f"{API}/users", headers=H(a), json={"name": "TEST_UI102 custom", "email": em, "password": "Test123!", "role": "test_ui_caisse", "pin": "8299"}).json()
db.users.update_one({"id": u["id"]}, {"$set": {"tour_done": True}})
t = requests.post(f"{API}/auth/login", json={"email": em, "password": "Test123!"}).json()["token"]
print("checkin", requests.post(f"{API}/attendance/check-in", headers=H(t), json={"kind": "arrival", "selfie": "data:image/jpeg;base64," + "A" * 1500}).status_code)
for p in ("/permissions/me", "/products", "/customers", "/orders", "/dashboard/kpis", "/stock-movements"):
    r = requests.get(f"{API}{p}", headers=H(t)); print(p, r.status_code, (r.json().get("levels", {}).get("/console/produits") if p == "/permissions/me" and r.ok else ""))
print("POST products (read only)", requests.post(f"{API}/products", headers=H(t), json={"name": "TEST_x"}).status_code)
# promotions read for test manager
requests.patch(f"{API}/roles-permissions", headers=H(a), json={"matrix": {"manager": {"/console/promotions": "read"}}})
import time; time.sleep(1)
mt = requests.post(f"{API}/auth/login", json={"email": "test_ui102_mgr@test.ci", "password": "Test123!"}).json()["token"]
print("mgr promotions GET", requests.get(f"{API}/promotions", headers=H(mt)).status_code, "DELETE", requests.delete(f"{API}/promotions/nonexistent", headers=H(mt)).status_code,
      "POST", requests.post(f"{API}/promotions", headers=H(mt), json={}).status_code)
requests.patch(f"{API}/roles-permissions", headers=H(a), json={"matrix": {}})
print("custom user id", u["id"])
