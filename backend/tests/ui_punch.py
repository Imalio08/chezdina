# Helper: punch arrival for a staff user (UI test prep). Usage: python ui_punch.py email password pin
import os, sys, base64, requests
BASE = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
s = requests.Session()
t = s.post(f"{BASE}/api/auth/login", json={"email": sys.argv[1], "password": sys.argv[2]}).json()
s.headers["Authorization"] = f"Bearer {t.get('token') or t.get('access_token')}"
selfie = "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8" + b"x" * 1500).decode()
r = s.post(f"{BASE}/api/attendance/check-in", json={"kind": "arrival", "selfie": selfie, "pin": sys.argv[3]})
print(r.status_code, r.text[:200])
