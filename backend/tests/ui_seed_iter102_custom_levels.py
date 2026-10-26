# Iter102: set custom role test_ui_caisse levels (produits read, everything else none incl. dashboard)
import os, requests, time
from dotenv import load_dotenv
load_dotenv("/app/frontend/.env")
API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
H = lambda t: {"Authorization": f"Bearer {t}"}
a = requests.post(f"{API}/auth/login", json={"email": "aouattaraesca@gmail.com", "password": "Admin123!"}).json()["token"]
mods = requests.get(f"{API}/roles-permissions", headers=H(a)).json()["modules"]
lv = {m: "none" for m in mods}; lv["/console/produits"] = "read"
print(requests.patch(f"{API}/roles-permissions", headers=H(a), json={"matrix": {"test_ui_caisse": lv}, "labels": {"test_ui_caisse": "TEST UI Caisse"}}).status_code)
