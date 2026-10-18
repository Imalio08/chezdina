# UI seed: TEST_ sales + TEST_ rider with a pending onboarding doc (run with "cleanup" arg to delete)
import sys, requests
sys.path.insert(0, "/app/backend/tests")
from test_privacy_onboarding import admin, BASE_URL, MDB
if len(sys.argv) > 1 and sys.argv[1] == "cleanup":
    for u in MDB.users.find({"email": {"$regex": "^test_ui_"}}):
        MDB.employee_docs.delete_many({"user_id": u["id"]}); MDB.onboarding_files.delete_many({"user_id": u["id"]})
        MDB.notifications.delete_many({"user_id": u["id"]}); MDB.attendance.delete_many({"user_id": u["id"]})
        MDB.users.delete_one({"id": u["id"]})
    print("cleaned"); sys.exit()
a = admin()
tpl = next(t for t in a.get(f"{BASE_URL}/api/onboarding/templates").json() if t["kind"] == "charte")
for role, email, pin in (("sales", "test_ui_sales@dinastore.ci", "8383"), ("rider", "test_ui_rider@dinastore.ci", "8181")):
    r = a.post(f"{BASE_URL}/api/users", json={"name": f"TEST_UI {role}", "email": email, "password": "Test123!", "role": role, "pin": pin})
    print(role, r.status_code, r.text[:80])
    uid = r.json()["id"]
    print(a.post(f"{BASE_URL}/api/onboarding/employees/{uid}/assign", json={"template_ids": [tpl["id"]]}).json())
