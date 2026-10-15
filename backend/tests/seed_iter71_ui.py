"""Seed iter71 UI data: TEST_UIMarraine71 + TEST_UIFilleule71 (filleule has a wallet debit row)."""
import random, uuid, requests, json
BASE = [l.split("=", 1)[1].strip() for l in open("/app/frontend/.env") if l.startswith("REACT_APP_BACKEND_URL=")][0]
API = f"{BASE}/api"
PID = "2c2005f5-cabe-46e5-9a4b-657f093f24a6"


def ph():
    return f"+225 07 6{random.randint(0,9)} {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)}"


def su(name, code=None):
    p = ph()
    b = {"name": name, "phone": p, "pin": "482915"}
    if code: b["referral_code"] = code
    d = requests.post(f"{API}/public/customer-signup", json=b).json()
    return d, p

m, mp = su("TEST_UIMarraine71")
f, fp = su("TEST_UIFilleule71", m["customer"]["referral_code"])
h = {"Authorization": f"Bearer {f['token']}"}
o = requests.post(f"{API}/public/orders", headers=h, json={"items": [{"product_id": PID, "name": "TEST_item", "qty": 1, "price": 5000}], "channel": "boutique",
    "payment_method": "mobile_money", "delivery_fee": 1500, "mode": "delivery", "wallet_use": 300, "checkout_key": str(uuid.uuid4()), "customer": {"name": "TEST_x"}}).json()
print(json.dumps({"m_phone": mp, "f_phone": fp, "m_id": m["customer"]["id"], "f_id": f["customer"]["id"], "order": o, "f_session": f}))
