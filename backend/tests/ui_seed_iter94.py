# Seed for iteration 94 UI test: one fresh order assigned to rider1 (session today). Usage: python ui_seed_iter94.py <customer_phone>
import os, sys, requests
from datetime import datetime
from zoneinfo import ZoneInfo
B = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
H = lambda t: {"Authorization": f"Bearer {t}"}
adm = requests.post(f"{B}/auth/login", json={"email": "aouattaraesca@gmail.com", "password": "Admin123!"}).json()["token"]
r1 = requests.post(f"{B}/auth/login", json={"email": "rider1@dinastore.ci", "password": "Rider123!"}).json()["user"]
ct = requests.post(f"{B}/public/customer-login-code", json={"phone": sys.argv[1], "code": "739153"}).json()["token"]
body = {"items": [{"product_id": "96dd7092-9ba7-49df-9125-0d5cc335207d", "name": "Sandales Rouge Lanières", "price": 28500, "qty": 1}],
        "customer": {"name": "TEST_E2E Cliente94", "phone": sys.argv[1], "address": "Rue TEST UI, Cocody"}, "channel": "web",
        "payment_method": "cod", "mode": "delivery", "delivery_zone": "Cocody", "delivery_fee": 1500}
o = requests.post(f"{B}/public/orders", json=body, headers=H(ct)).json()
if o["status"] == "en_attente_acompte":
    requests.post(f"{B}/orders/{o['id']}/mark-deposit-paid", json={"tx_ref": "TEST_WAVE_94"}, headers=H(adm))
else:
    requests.patch(f"{B}/orders/{o['id']}/status", json={"status": "confirmee"}, headers=H(adm))
for ln in requests.get(f"{B}/orders/{o['id']}/prep", headers=H(adm)).json()["lines"]:
    requests.post(f"{B}/orders/{o['id']}/prep/verify", json={"code": ln["expected_code"], "line_index": ln["line_index"]}, headers=H(adm))
print("prete", requests.patch(f"{B}/orders/{o['id']}/status-v3", json={"status": "prete"}, headers=H(adm)).status_code)
today = datetime.now(ZoneInfo("Africa/Abidjan")).date().isoformat()
s = requests.post(f"{B}/delivery-sessions", json={"rider_id": r1["id"], "rider_name": r1["name"], "date": today}, headers=H(adm)).json()
print("add", requests.patch(f"{B}/delivery-sessions/{s['id']}/add-order", json={"order_id": o["id"]}, headers=H(adm)).status_code)
print("ORDER", o["id"], o["code"], o["total"], o.get("deposit_required"))
