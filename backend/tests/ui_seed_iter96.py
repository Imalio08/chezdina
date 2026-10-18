# Seed for iteration 96 UI: TEST_ product + 3 pending stock adjustment requests (manager). Run with "clean" to delete.
import os, sys, json, requests
from pymongo import MongoClient
for ln in open("/app/frontend/.env"):
    if ln.startswith("REACT_APP_BACKEND_URL="): B = ln.split("=", 1)[1].strip() + "/api"
for ln in open("/app/backend/.env"):
    k, _, v = ln.strip().partition("="); os.environ.setdefault(k, v.strip('"'))
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
if len(sys.argv) > 1 and sys.argv[1] == "clean":
    ids = [p["id"] for p in mdb.products.find({"name": {"$regex": "^TEST_"}}, {"id": 1})]
    print("products", mdb.products.delete_many({"id": {"$in": ids}}).deleted_count,
          "reqs", mdb.stock_adjustment_requests.delete_many({"$or": [{"product_id": {"$in": ids}}, {"product_name": {"$regex": "^TEST_"}}]}).deleted_count,
          "movs", mdb.stock_movements.delete_many({"product_id": {"$in": ids}}).deleted_count,
          "notifs", mdb.user_notifications.delete_many({"title": {"$regex": "TEST_"}}).deleted_count)
    sys.exit()
adm = {"Authorization": "Bearer " + requests.post(f"{B}/auth/login", json={"email": "aouattaraesca@gmail.com", "password": "Admin123!"}).json()["token"]}
mgr = {"Authorization": "Bearer " + requests.post(f"{B}/auth/login", json={"email": "manager.cocody@dinastore.ci", "password": "Manager123!"}).json()["token"]}
p = requests.post(f"{B}/products", json={"name": "TEST_Approval Shoe", "price": 10000, "cost": 4000, "stock": 10, "category": "Talons", "image": "/catalog/354ede923bdbabb4.jpg", "images": ["/catalog/354ede923bdbabb4.jpg"]}, headers=adm).json()
out = {"pid": p["id"], "reqs": []}
for d, r in [(-2, "TEST_casse vitrine"), (3, "TEST_retour fournisseur"), (-1, "TEST_perdu")]:
    out["reqs"].append(requests.post(f"{B}/stock/adjustment-requests", json={"product_id": p["id"], "product_name": "TEST_Approval Shoe", "qty_delta": d, "reason": r}, headers=mgr).json()["id"])
print(json.dumps(out))
