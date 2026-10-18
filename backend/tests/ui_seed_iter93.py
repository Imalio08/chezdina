"""Seed a TEST_ customer + conversation for iteration 93 UI checks. `python ui_seed_iter93.py cleanup <cid>` deletes it."""
import json, random, sys, requests
U = [l.split("=", 1)[1].strip() for l in open("/app/frontend/.env") if l.startswith("REACT_APP_BACKEND_URL=")][0]
API = f"{U}/api"
h = {"Authorization": "Bearer " + requests.post(f"{API}/auth/login", json={"email": "aouattaraesca@gmail.com", "password": "Admin123!"}).json()["token"]}
if len(sys.argv) > 2 and sys.argv[1] == "cleanup":
    print(requests.delete(f"{API}/customers/{sys.argv[2]}", headers=h).status_code); sys.exit()
phone = f"+225 07 {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)}"
d = requests.post(f"{API}/public/customer-signup", json={"name": "TEST_Iter93UI", "phone": phone, "pin": "482915"}).json()
cid = d["customer"]["id"]
link = requests.post(f"{API}/pos/shared-cart", headers=h, json={"items": [], "customer": {"id": cid, "name": "TEST_Iter93UI"}}).json()["link"]
m = requests.post(f"{API}/messages/send", headers=h, json={"customer_id": cid, "text": "**TEST_ gras** et *ital*\n- un\n- deux"}).json()
ch = {"Authorization": f"Bearer {d['token']}"}
requests.post(f"{API}/public/account/messages/send", headers=ch, json={"conversation_id": m["conversation_id"], "text": 'TEST_ xss https://x.test/"data-xss="1 et [lien](https://y.test/"data-xss2="1)'})
print(json.dumps({"cid": cid, "phone": phone, "cl": link.split("?cl=")[1], "conv": m["conversation_id"]}))
