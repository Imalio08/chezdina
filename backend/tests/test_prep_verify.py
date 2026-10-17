# Order preparation code-verification tests (prep_verify router + status-v3 'prete' guard)
import os
import pytest
import requests
from pymongo import MongoClient
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", dotenv_values("/app/frontend/.env").get("REACT_APP_BACKEND_URL")).rstrip("/")
ENV = dotenv_values("/app/backend/.env")
DB = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
OID = "TEST_prep_order"


def reset():
    DB.orders.update_one({"id": OID}, {"$set": {"status": "confirmee"}, "$unset": {"prep_checks": "", "prep_scan": ""}})


@pytest.fixture(scope="module")
def s():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "aouattaraesca@gmail.com", "password": "Admin123!"})
    if r.status_code != 200:
        pytest.skip("login failed")
    ses = requests.Session()
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        ses.headers["Authorization"] = f"Bearer {tok}"
    ses.cookies.update(r.cookies)
    reset()
    yield ses
    reset()


def v(s, code, method="saisie", oid=OID):
    return s.post(f"{BASE_URL}/api/orders/{oid}/prep/verify", json={"code": code, "method": method})


# GET prep lines
def test_get_prep(s):
    r = s.get(f"{BASE_URL}/api/orders/{OID}/prep")
    assert r.status_code == 200
    d = r.json()
    ln = d["lines"][0]
    assert ln["expected_code"] == "DEMO-100-37-NOIR"
    assert ln["label"] == "Mules Raphia Naturel · Noir · T37"
    assert ln["qty"] == 2 and ln["done"] == 0
    assert "accepted" not in ln
    assert d["log"] == []


def test_prete_blocked_before(s):
    r = s.patch(f"{BASE_URL}/api/orders/{OID}/status-v3", json={"status": "prete", "scanned_items": [{"line_index": 0, "qty": 2}], "manual": True})
    assert r.status_code == 400
    assert "Articles non vérifiés par code" in r.json()["detail"]


def test_v1_status_blocks_prete(s):
    r = s.patch(f"{BASE_URL}/api/orders/{OID}/status", json={"status": "prete"})
    assert r.status_code in (400, 422)


def test_wrong_code(s):
    r = v(s, "DEMO-100-38-NOIR")
    d = r.json()
    assert r.status_code == 200 and d["ok"] is False
    assert d["message"] == "Mauvais article : attendu Mules Raphia Naturel · Noir · T37"
    assert DB.orders.find_one({"id": OID})["status"] == "confirmee"


def test_empty_code(s):
    assert v(s, "  ").status_code == 400


def test_correct_scan_pipe_lowercase(s):
    r = v(s, "demo-100|37|noir", "scan")
    d = r.json()
    assert d["ok"] is True and d["lines"][0]["done"] == 1
    assert d["entry"]["method"] == "scan" and d["entry"]["by"] and d["entry"]["at"]
    assert DB.orders.find_one({"id": OID})["status"] == "en_preparation"


def test_prete_blocked_partial(s):
    r = s.patch(f"{BASE_URL}/api/orders/{OID}/status-v3", json={"status": "prete"})
    assert r.status_code == 400 and "1/2" in r.json()["detail"]


def test_correct_typed_dash_spaces(s):
    d = v(s, " demo-100-37-noir ").json()
    assert d["ok"] is True and d["lines"][0]["done"] == 2
    assert d["entry"]["method"] == "saisie"


def test_extra_refused(s):
    d = v(s, "DEMO-100-37-NOIR").json()
    assert d["ok"] is False and d["message"].startswith("Déjà vérifié")
    assert d["lines"][0]["done"] == 2


def test_log_and_audit(s):
    o = DB.orders.find_one({"id": OID})
    checks = o["prep_checks"]
    assert len(checks) == 4
    assert [c["ok"] for c in checks] == [False, True, True, False]
    assert all(c["method"] in ("scan", "saisie") and c["by"] and c["at"] for c in checks)
    assert DB.audit_log.count_documents({"entity_id": OID, "action": {"$regex": "^order.prep"}}) >= 4
    r = s.get(f"{BASE_URL}/api/orders/{OID}/prep")
    assert len(r.json()["log"]) == 4


def test_prete_ok_after(s):
    r = s.patch(f"{BASE_URL}/api/orders/{OID}/status-v3", json={"status": "prete"})
    assert r.status_code == 200, r.text
    o = DB.orders.find_one({"id": OID})
    assert o["status"] == "prete" and len(o["prep_scan"]["items"]) == 2


def test_verify_after_prete_rejected(s):
    assert v(s, "DEMO-100-37-NOIR").status_code == 400


def test_unknown_order(s):
    assert s.get(f"{BASE_URL}/api/orders/NOPE_xyz/prep").status_code == 404


def test_unknown_product_order(s):
    r = s.get(f"{BASE_URL}/api/orders/TEST_prep_order2/prep")
    assert r.status_code == 200
    print("TEST-PREP-2 lines:", r.json()["lines"])


def test_no_auth():
    assert requests.post(f"{BASE_URL}/api/orders/{OID}/prep/verify", json={"code": "x"}).status_code in (401, 403)
