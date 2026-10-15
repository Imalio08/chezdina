# Iteration 76 — session separation (rider/staff/customer), mandatory arrival punch (HTTP 428), manifests, notif links
import os, base64
import pytest
import requests
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
FULL_CFG = {"enabled": True, "enabled_roles": ["manager", "sales", "stock_keeper", "community_manager", "rider"]}
SELFIE = "data:image/jpeg;base64," + base64.b64encode(os.urandom(1500)).decode()

mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
TODAY = datetime.now(timezone.utc).date().isoformat()


def _login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


def _uid(email):
    return mdb.users.find_one({"email": email})["id"]


@pytest.fixture(scope="module")
def admin():
    return _login("aouattaraesca@gmail.com", "Admin123!")["token"]


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin):
    ids = [_uid(e) for e in ("stock@dinastore.ci", "manager.cocody@dinastore.ci")]
    mdb.attendance.delete_many({"user_id": {"$in": ids}, "day": TODAY})
    requests.patch(f"{API}/business/attendance-config", json=FULL_CFG, headers=H(admin), timeout=20)
    yield
    mdb.attendance.delete_many({"user_id": {"$in": ids}, "day": TODAY})
    requests.patch(f"{API}/business/attendance-config", json=FULL_CFG, headers=H(admin), timeout=20)


# Admin: no punch
class TestAdmin:
    def test_admin_login_no_punch(self):
        d = _login("aouattaraesca@gmail.com", "Admin123!")
        assert d["user"]["punch_required"] is False
        r = requests.get(f"{API}/orders", headers=H(d["token"]), timeout=20)
        assert r.status_code == 200


# Session separation
class TestSeparation:
    def test_rider_orders_403_today_200(self):
        t = _login("rider1@dinastore.ci", "Rider123!")["token"]
        assert requests.get(f"{API}/orders", headers=H(t), timeout=20).status_code == 403
        assert requests.get(f"{API}/products", headers=H(t), timeout=20).status_code == 403
        assert requests.get(f"{API}/riders/me/today", headers=H(t), timeout=20).status_code == 200
        me = requests.get(f"{API}/auth/me", headers=H(t), timeout=20).json()
        assert me["role"] == "rider" and me["punch_required"] is False

    def test_customer_token_cannot_access_orders(self):
        r = requests.post(f"{API}/public/customer-login-code", json={"phone": "+225 07 48 11 22 01", "code": "202601"}, timeout=20)
        if r.status_code != 200:
            pytest.skip(f"customer login failed {r.status_code}")
        tok = r.json()["token"]
        assert requests.get(f"{API}/orders", headers=H(tok), timeout=20).status_code == 401
        assert requests.get(f"{API}/public/account/me", headers=H(tok), timeout=20).status_code == 200


# Punch gate for stock keeper
class TestPunch:
    def test_flow(self, admin):
        d = _login("stock@dinastore.ci", "Stock123!")
        tok = d["token"]
        assert d["user"]["punch_required"] is True
        for p in ("/orders", "/products", "/dashboard/kpis", "/me/notifications"):
            r = requests.get(f"{API}{p}", headers=H(tok), timeout=20)
            assert r.status_code == 428, (p, r.status_code)
        assert "Pointage" in requests.get(f"{API}/orders", headers=H(tok), timeout=20).json()["detail"]
        # punch-free endpoints
        assert requests.get(f"{API}/auth/me", headers=H(tok), timeout=20).json()["punch_required"] is True
        assert requests.get(f"{API}/attendance/me", headers=H(tok), timeout=20).status_code == 200
        # invalid selfie
        for bad in (None, "abc", "data:image/jpeg;base64,xx", "x" * 2000):
            r = requests.post(f"{API}/attendance/check-in", json={"kind": "arrival", "selfie": bad}, headers=H(tok), timeout=20)
            assert r.status_code == 400, (bad and bad[:10], r.status_code)
        assert requests.get(f"{API}/orders", headers=H(tok), timeout=20).status_code == 428
        # valid arrival
        r = requests.post(f"{API}/attendance/check-in", json={"kind": "arrival", "selfie": SELFIE}, headers=H(tok), timeout=20)
        assert r.status_code == 200 and r.json()["ok"] is True
        assert requests.get(f"{API}/orders", headers=H(tok), timeout=20).status_code == 200
        # same-day re-login -> direct access
        d2 = _login("stock@dinastore.ci", "Stock123!")
        assert d2["user"]["punch_required"] is False
        # PIN login also
        rp = requests.post(f"{API}/auth/login-pin", json={"pin": "4444"}, timeout=20)
        assert rp.status_code == 200 and rp.json()["user"]["punch_required"] is False
        # departure -> blocked
        r = requests.post(f"{API}/attendance/check-in", json={"kind": "departure", "selfie": SELFIE}, headers=H(tok), timeout=20)
        assert r.status_code == 200
        assert requests.get(f"{API}/orders", headers=H(tok), timeout=20).status_code == 428
        assert _login("stock@dinastore.ci", "Stock123!")["user"]["punch_required"] is True
        # new arrival restores
        requests.post(f"{API}/attendance/check-in", json={"kind": "arrival", "selfie": SELFIE}, headers=H(tok), timeout=20)
        assert requests.get(f"{API}/orders", headers=H(tok), timeout=20).status_code == 200

    def test_pin_login_manager_requires_punch(self):
        rp = requests.post(f"{API}/auth/login-pin", json={"pin": "2222"}, timeout=20)
        assert rp.status_code == 200
        assert rp.json()["user"]["punch_required"] is True
        assert requests.get(f"{API}/orders", headers=H(rp.json()["token"]), timeout=20).status_code == 428

    def test_config_disable_resets_cache(self, admin):
        mdb.attendance.delete_many({"user_id": _uid("stock@dinastore.ci"), "day": TODAY})
        tok = _login("stock@dinastore.ci", "Stock123!")["token"]
        assert requests.get(f"{API}/orders", headers=H(tok), timeout=20).status_code == 428
        r = requests.patch(f"{API}/business/attendance-config", json={"enabled": False}, headers=H(admin), timeout=20)
        assert r.status_code == 200
        assert requests.get(f"{API}/orders", headers=H(tok), timeout=20).status_code == 200
        requests.patch(f"{API}/business/attendance-config", json=FULL_CFG, headers=H(admin), timeout=20)
        assert requests.get(f"{API}/orders", headers=H(tok), timeout=20).status_code == 428

    def test_non_admin_cannot_change_config(self):
        rp = requests.post(f"{API}/auth/login-pin", json={"pin": "2222"}, timeout=20)
        tok = rp.json()["token"]
        r = requests.patch(f"{API}/business/attendance-config", json={"enabled": False}, headers=H(tok), timeout=20)
        assert r.status_code in (403, 428)


# Manifests
class TestManifests:
    def test_store_manifest(self):
        r = requests.get(f"{API}/public/manifest.webmanifest", timeout=20)
        assert r.status_code == 200 and r.json()["start_url"] == "/"

    def test_rider_manifest(self):
        r = requests.get(f"{API}/public/manifest-rider.webmanifest", timeout=20)
        assert r.status_code == 200 and r.json()["start_url"] == "/riders"
