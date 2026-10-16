# Iteration 81: Rider PIN login + Wave payment proof flow (submit / verify / reject) + payment-config
import os
import base64
from datetime import datetime, timezone
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
mdb = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[os.environ.get("DB_NAME", "dina_store")]
SELFIE = "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8" + b"x" * 1500).decode()
PROOF = "data:image/png;base64," + base64.b64encode(b"\x89PNG" + b"y" * 500).decode()
PHONE = "+225 07 00 98 76 54"
CREATED = []
PUNCHED = []


def login(email, pw, pin=None):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers["Authorization"] = f"Bearer {tok}"
    if pin:
        me = s.get(f"{BASE_URL}/api/attendance/me").json()
        if not me.get("checked_in"):
            ok = s.post(f"{BASE_URL}/api/attendance/check-in", json={"kind": "arrival", "selfie": SELFIE, "pin": pin})
            assert ok.status_code == 200, ok.text
            PUNCHED.append(email)
    return s


@pytest.fixture(scope="module")
def admin():
    return login("aouattaraesca@gmail.com", "Admin123!")


@pytest.fixture(scope="module")
def manager():
    return login("manager.cocody@dinastore.ci", "Manager123!", "2222")


@pytest.fixture(scope="module")
def sales():
    return login("agent1@dinastore.ci", "Agent123!", "3333")


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    ids = [o["id"] for o in CREATED]
    codes = [o["code"] for o in CREATED]
    mdb.orders.delete_many({"id": {"$in": ids}})
    mdb.stock_movements.delete_many({"ref": {"$in": codes}})
    mdb.audit_log.delete_many({"entity_id": {"$in": ids}})
    mdb.invoices.delete_many({"order_id": {"$in": ids}})
    mdb.whatsapp_outbox.delete_many({"order_id": {"$in": ids}})
    mdb.login_attempts.delete_many({"identifier": {"$regex": "^rider-pin:"}})
    today = datetime.now(timezone.utc).date().isoformat()
    for email in PUNCHED:
        u = mdb.users.find_one({"email": email})
        if u:
            mdb.attendance.delete_many({"user_id": u["id"], "day": today})


def pub_order(method="wave", price=10000, phone=PHONE):
    r = requests.post(f"{BASE_URL}/api/public/orders", json={
        "items": [{"product_id": "TEST_prod_wave", "name": "TEST_Robe Wave", "qty": 1, "price": price}],
        "customer": {"name": "TEST_Cliente Wave", "phone": phone},
        "channel": "boutique", "payment_method": method, "mode": "delivery", "delivery_fee": 0})
    assert r.status_code == 200, r.text
    o = r.json()
    CREATED.append(o)
    return o


def get(oid):
    return mdb.orders.find_one({"id": oid}, {"_id": 0})


class TestRiderPin:
    # rider PIN 5555 -> rider1
    def test_rider_pin_ok(self):
        mdb.login_attempts.delete_many({"identifier": {"$regex": "^rider-pin:"}})
        r = requests.post(f"{BASE_URL}/api/auth/rider-login-pin", json={"pin": "5555"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["role"] == "rider" and d["user"]["email"] == "rider1@dinastore.ci"
        assert isinstance(d["token"], str) and len(d["token"]) > 20
        assert "pin_hash" not in d["user"] and "password_hash" not in d["user"]
        assert "access_token" in r.headers.get("set-cookie", "")
        me = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {d['token']}"})
        assert me.status_code == 200 and me.json()["role"] == "rider"

    # staff PIN rejected
    @pytest.mark.parametrize("pin", ["1234", "2222", "0000"])
    def test_staff_pin_rejected(self, pin):
        r = requests.post(f"{BASE_URL}/api/auth/rider-login-pin", json={"pin": pin})
        assert r.status_code == 401, r.text
        assert r.json()["detail"] == "Code PIN incorrect"

    # 8 failures -> 429
    def test_rate_limit(self):
        mdb.login_attempts.delete_many({"identifier": {"$regex": "^rider-pin:"}})
        codes = [requests.post(f"{BASE_URL}/api/auth/rider-login-pin", json={"pin": "9898"}).status_code for _ in range(9)]
        print("codes", codes)
        assert codes[:8] == [401] * 8 and codes[8] == 429
        # even correct pin blocked
        r = requests.post(f"{BASE_URL}/api/auth/rider-login-pin", json={"pin": "5555"})
        assert r.status_code == 429
        mdb.login_attempts.delete_many({"identifier": {"$regex": "^rider-pin:"}})

    # PIN uniqueness among riders (does not change PIN because 400 is raised before update)
    def test_rider_pin_unique(self, admin):
        r2 = mdb.users.find_one({"email": "rider2@dinastore.ci"})
        before = r2["pin_hash"]
        r = admin.patch(f"{BASE_URL}/api/users/{r2['id']}", json={"pin": "5555"})
        assert r.status_code == 400, r.text
        assert "déjà utilisé" in r.json()["detail"]
        assert mdb.users.find_one({"email": "rider2@dinastore.ci"})["pin_hash"] == before


class TestWaveProof:
    # wave order created pending, not paid
    def test_wave_order_pending(self):
        o = pub_order()
        d = get(o["id"])
        assert d["payment_status"] == "en_attente" and d["status"] == "nouvelle"

    def test_proof_validations(self):
        o = pub_order()
        url = f"{BASE_URL}/api/public/orders/{o['code']}/wave-proof"
        r = requests.post(url, json={"image": PROOF, "phone": "+225 07 11 11 11 11"})
        assert r.status_code == 403, r.text
        r = requests.post(url, json={"image": "notanimage", "phone": PHONE})
        assert r.status_code == 400
        r = requests.post(url, json={"image": "data:application/pdf;base64,xx", "phone": PHONE})
        assert r.status_code == 400
        r = requests.post(f"{BASE_URL}/api/public/orders/TEST_NOPE/wave-proof", json={"image": PROOF, "phone": PHONE})
        assert r.status_code == 404
        assert get(o["id"])["payment_status"] == "en_attente"

    def test_proof_non_wave_order_rejected(self):
        o = pub_order(method="cod", price=5000)
        r = requests.post(f"{BASE_URL}/api/public/orders/{o['code']}/wave-proof", json={"image": PROOF, "phone": PHONE})
        assert r.status_code == 400

    def test_proof_then_accept(self, manager, sales):
        o = pub_order()
        r = requests.post(f"{BASE_URL}/api/public/orders/{o['code']}/wave-proof",
                          json={"image": PROOF, "phone": "0700987654", "tx_ref": "TEST_TX1"})
        assert r.status_code == 200, r.text
        d = get(o["id"])
        assert d["payment_status"] == "preuve_envoyee"
        assert d["wave_proof"]["status"] == "en_attente" and d["wave_proof"]["kind"] == "total"
        assert d["wave_proof"]["amount"] == 10000 and d["wave_proof"]["tx_ref"] == "TEST_TX1"
        # sales forbidden
        r = sales.post(f"{BASE_URL}/api/orders/{o['id']}/wave-verify", json={"decision": "accept"})
        assert r.status_code == 403
        assert get(o["id"])["payment_status"] == "preuve_envoyee"
        # invalid decision
        r = manager.post(f"{BASE_URL}/api/orders/{o['id']}/wave-verify", json={"decision": "foo"})
        assert r.status_code == 400
        r = manager.post(f"{BASE_URL}/api/orders/{o['id']}/wave-verify", json={"decision": "accept"})
        assert r.status_code == 200, r.text
        d = get(o["id"])
        assert d["payment_status"] == "paye" and d["wave_proof"]["status"] == "acceptee"
        assert d.get("payment_tx_ref") == "TEST_TX1"
        # double accept blocked
        r = manager.post(f"{BASE_URL}/api/orders/{o['id']}/wave-verify", json={"decision": "accept"})
        assert r.status_code == 400
        # proof no longer accepted
        r = requests.post(f"{BASE_URL}/api/public/orders/{o['code']}/wave-proof", json={"image": PROOF, "phone": PHONE})
        assert r.status_code == 400

    def test_reject_then_resubmit(self, admin):
        o = pub_order()
        requests.post(f"{BASE_URL}/api/public/orders/{o['code']}/wave-proof", json={"image": PROOF, "phone": PHONE})
        r = admin.post(f"{BASE_URL}/api/orders/{o['id']}/wave-verify", json={"decision": "reject"})
        assert r.status_code == 400  # reason required
        r = admin.post(f"{BASE_URL}/api/orders/{o['id']}/wave-verify", json={"decision": "reject", "reason": "TEST_introuvable"})
        assert r.status_code == 200
        d = get(o["id"])
        assert d["payment_status"] == "preuve_refusee" and d["wave_proof"]["reject_reason"] == "TEST_introuvable"
        r = requests.post(f"{BASE_URL}/api/public/orders/{o['code']}/wave-proof", json={"image": PROOF, "phone": PHONE})
        assert r.status_code == 200
        assert get(o["id"])["payment_status"] == "preuve_envoyee"

    def test_deposit_proof_accept(self, manager):
        o = pub_order(method="cod", price=20000)
        assert o["status"] == "en_attente_acompte" and o["deposit_required"] == 6000
        r = requests.post(f"{BASE_URL}/api/public/orders/{o['code']}/wave-proof", json={"image": PROOF, "phone": PHONE})
        assert r.status_code == 200, r.text
        d = get(o["id"])
        assert d["wave_proof"]["kind"] == "acompte" and d["wave_proof"]["amount"] == 6000
        r = manager.post(f"{BASE_URL}/api/orders/{o['id']}/wave-verify", json={"decision": "accept", "tx_ref": "TEST_DEP"})
        assert r.status_code == 200
        d = get(o["id"])
        assert d["status"] == "confirmee" and d["payment_status"] == "acompte_recu"
        assert d["deposit_paid"] == 6000 and d["deposit_tx_ref"] == "TEST_DEP"

    def test_public_tracking_exposes_proof_status(self):
        o = pub_order()
        requests.post(f"{BASE_URL}/api/public/orders/{o['code']}/wave-proof", json={"image": PROOF, "phone": PHONE})
        r = requests.get(f"{BASE_URL}/api/orders/track/{o['code']}")
        print("tracking keys", r.status_code, list(r.json().keys()) if r.ok else r.text[:200])
        assert r.status_code == 200
        j = r.json()
        assert j.get("payment_status") == "preuve_envoyee"
        # the proof image must not leak publicly
        assert "image" not in (j.get("wave_proof") or {}), "public tracking leaks proof image"

    def test_delivered_wave_not_auto_paid(self, admin):
        o = pub_order()
        mdb.orders.update_one({"id": o["id"]}, {"$set": {"status": "en_livraison"}})
        r = admin.patch(f"{BASE_URL}/api/orders/{o['id']}/status-v3", json={"status": "livree", "reason": "TEST"})
        assert r.status_code == 200, r.text
        assert get(o["id"])["payment_status"] == "en_attente"
        inv = mdb.invoices.find_one({"order_id": o["id"]})
        print("invoice status for unverified wave delivered:", inv and inv.get("status"))
        assert not inv or inv.get("status") != "payee", "auto invoice marked payee for unverified Wave order"


class TestPaymentConfig:
    def test_wave_number_roundtrip(self, admin):
        before = mdb.site_settings.find_one({"id": "main"}, {"wave_number": 1, "wave_name": 1}) or {}
        try:
            r = admin.patch(f"{BASE_URL}/api/site", json={"wave_number": "+225 07 TEST 00", "wave_name": "TEST_Dina"})
            assert r.status_code == 200, r.text
            c = requests.get(f"{BASE_URL}/api/public/payment-config").json()
            assert c["wave_number"] == "+225 07 TEST 00" and c["wave_name"] == "TEST_Dina"
            assert c["wave_link"].startswith("https://pay.wave.com")
        finally:
            admin.patch(f"{BASE_URL}/api/site", json={"wave_number": before.get("wave_number", ""), "wave_name": before.get("wave_name", "")})
        c = requests.get(f"{BASE_URL}/api/public/payment-config").json()
        assert c["wave_number"] == (before.get("wave_number") or "")
