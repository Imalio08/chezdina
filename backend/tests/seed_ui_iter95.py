# Seed for iter95 UI checks: one more TEST_ order for the same TEST_E2E Cliente95 -> deposit -> prete -> rider1 -> postponed to tomorrow (reportee)
import os, sys, requests
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
phone = sys.argv[1]
h = lambda t: {"Authorization": f"Bearer {t}"}
lg = lambda e, p: requests.post(f"{BASE}/auth/login", json={"email": e, "password": p}).json()
mgr = lg("manager.cocody@dinastore.ci", "Manager123!")["token"]
r1 = lg("rider1@dinastore.ci", "Rider123!")
cust = requests.post(f"{BASE}/public/customer-login-code", json={"phone": phone, "code": "739153"}).json()["token"]
body = {"items": [{"product_id": "96dd7092-9ba7-49df-9125-0d5cc335207d", "name": "Sandales Rouge Lanières", "price": 28500, "qty": 1}],
        "customer": {"name": "TEST_E2E Cliente95", "phone": phone, "address": "Rue TEST UI, Cocody", "quartier": "Angré"},
        "channel": "web", "payment_method": "cod", "mode": "delivery", "delivery_zone": "Cocody", "delivery_fee": 1500, "checkout_key": "TEST_iter95_ui_" + phone[-6:]}
o = requests.post(f"{BASE}/public/orders", json=body, headers=h(cust)).json()
requests.post(f"{BASE}/orders/{o['id']}/mark-deposit-paid", json={"tx_ref": "TEST_WAVE_95UI"}, headers=h(mgr))
for ln in requests.get(f"{BASE}/orders/{o['id']}/prep", headers=h(mgr)).json()["lines"]:
    for _ in range(ln["qty"]):
        requests.post(f"{BASE}/orders/{o['id']}/prep/verify", json={"code": ln["expected_code"], "method": "scan", "line_index": ln["line_index"]}, headers=h(mgr))
print("prete", requests.patch(f"{BASE}/orders/{o['id']}/status-v3", json={"status": "prete"}, headers=h(mgr)).status_code)
print("assign", requests.patch(f"{BASE}/deliveries/{o['id']}/assign", json={"rider_id": r1["user"]["id"], "rider_name": r1["user"]["name"]}, headers=h(mgr)).status_code)
tomorrow = (datetime.now(ZoneInfo("Africa/Abidjan")) + timedelta(days=1)).date().isoformat()
print("postpone", requests.patch(f"{BASE}/orders/{o['id']}/status", json={"status": "reportee", "reason": "TEST_ UI absente", "next_date": tomorrow}, headers=h(r1["token"])).status_code)
print("CODE", o["code"], o["id"], o["total"], "tomorrow", tomorrow)
