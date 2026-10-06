"""Rider Space v2 — section 6.8 tests."""
import os, pytest, requests, uuid

def _load_frontend_url():
    env = "/app/frontend/.env"
    if os.path.exists(env):
        for line in open(env):
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=",1)[1].strip()
    return os.environ.get("REACT_APP_BACKEND_URL","")

BASE = _load_frontend_url().rstrip("/") + "/api"

RIDER = {"email": "rider1@dinastore.ci", "password": "Rider123!"}
ADMIN = {"email": "aouattaraesca@gmail.com", "password": "Admin123!"}
MANAGER = {"email": "manager.cocody@dinastore.ci", "password": "Manager123!"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{BASE}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    me = s.get(f"{BASE}/auth/me", timeout=10).json()
    return s, me


@pytest.fixture(scope="session")
def rider():
    s, u = _login(RIDER)
    return s, u


@pytest.fixture(scope="session")
def admin():
    s, u = _login(ADMIN)
    return s, u


@pytest.fixture(scope="session")
def manager():
    s, u = _login(MANAGER)
    return s, u


def _create_cod_order(admin_sess, total=20000, rider_id=None, rider_name=None):
    """Create an order via admin, assigned to rider."""
    code = f"TEST-{uuid.uuid4().hex[:6].upper()}"
    body = {
        "code": code,
        "mode": "delivery",
        "status": "prete",
        "payment_method": "cod",
        "items": [{"product_id": "p1", "name": "Lingerie", "qty": 1, "price": total}],
        "subtotal": total, "total": total, "delivery_fee": 0, "discount": 0,
        "customer": {"name": "Test Client", "phone": "+2250700000011", "quartier": "Cocody"},
        "rider_id": rider_id, "rider_name": rider_name,
    }
    r = admin_sess.post(f"{BASE}/orders", json=body, timeout=15)
    assert r.status_code in (200, 201), r.text
    return r.json()


def _get_order(admin_sess, oid):
    rows = admin_sess.get(f"{BASE}/orders", timeout=15).json()
    for o in rows:
        if o.get("id") == oid:
            return o
    raise AssertionError(f"order {oid} not found")


# ---------- Auth / me ----------
def test_rider_login_role(rider):
    s, u = rider
    r = s.get(f"{BASE}/auth/me", timeout=10)
    assert r.status_code == 200
    me = r.json()
    assert me.get("role") == "rider"
    assert me.get("email") == RIDER["email"]


# ---------- Delivery templates ----------
def test_delivery_templates_defaults(rider):
    s, _ = rider
    r = s.get(f"{BASE}/delivery-templates", timeout=10)
    assert r.status_code == 200
    data = r.json()
    keys = {t["key"] for t in data["wa_templates"]}
    assert {"en_route", "arrived", "location", "unreachable"}.issubset(keys)
    assert data["proof_method"] == "code"
    assert data["proof_threshold"] == 50000
    assert "delivery_rate" in data["score_weights"]


def test_delivery_templates_patch_rbac(rider, manager):
    rs, _ = rider
    ms, _ = manager
    r = rs.patch(f"{BASE}/delivery-templates", json={"proof_threshold": 60000}, timeout=10)
    assert r.status_code == 403
    r2 = ms.patch(f"{BASE}/delivery-templates", json={"proof_threshold": 50000, "proof_method":"code"}, timeout=10)
    assert r2.status_code == 200


# ---------- riders/me/today & history ----------
def test_riders_me_today(rider):
    s, _ = rider
    r = s.get(f"{BASE}/riders/me/today", timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert "orders" in d and "counts" in d
    for k in ("a_livrer","en_route","livrees","annulees","reportees","echecs"):
        assert k in d["counts"]
    assert "to_collect" in d and "collected" in d and "balance_to_hand_over" in d


def test_riders_me_history_phone_masked(rider):
    s, _ = rider
    r = s.get(f"{BASE}/riders/me/history?days=90", timeout=10)
    assert r.status_code == 200
    sessions = r.json()
    for sess in sessions:
        for o in sess.get("orders_detail") or []:
            cust = o.get("customer") or {}
            if cust:
                # phone must be masked, raw phone cleared
                assert cust.get("phone") in (None, "", "null")
                if cust.get("phone_masked"):
                    assert "••" in cust["phone_masked"]


# ---------- Status -> en_livraison generates code ----------
def test_status_en_livraison_generates_code(admin, rider):
    adm, _ = admin
    _, rider_user = rider
    o = _create_cod_order(adm, total=15000, rider_id=rider_user["id"], rider_name=rider_user["name"])
    r = adm.patch(f"{BASE}/orders/{o['id']}/status", json={"status":"en_livraison"}, timeout=10)
    assert r.status_code == 200
    o2 = _get_order(adm, o['id'])
    assert o2.get("delivery_code") and len(o2["delivery_code"]) == 4 and o2["delivery_code"].isdigit()
    assert o2.get("delivery_code_attempts") == 0
    # Idempotent
    r2 = adm.patch(f"{BASE}/orders/{o['id']}/status", json={"status":"en_livraison"}, timeout=10)
    assert r2.status_code == 200
    o3 = _get_order(adm, o['id'])
    assert o3["delivery_code"] == o2["delivery_code"]
    return o3


# ---------- Deliver w/ code: 3 wrong attempts -> locked ----------
def test_deliver_code_wrong_locks(admin, rider):
    adm, _ = admin
    rs, rider_user = rider
    o = _create_cod_order(adm, total=10000, rider_id=rider_user["id"], rider_name=rider_user["name"])
    adm.patch(f"{BASE}/orders/{o['id']}/status", json={"status":"en_livraison"}, timeout=10)
    for i in range(1, 4):
        r = rs.post(f"{BASE}/orders/{o['id']}/deliver", json={"method":"code","code":"0000"}, timeout=10)
        assert r.status_code == 401, r.text
        assert f"{i}/3" in r.text
    # 4th attempt: locked -> 423
    r4 = rs.post(f"{BASE}/orders/{o['id']}/deliver", json={"method":"code","code":"0000"}, timeout=10)
    assert r4.status_code == 423
    assert "verrouill" in r4.text.lower()


def test_deliver_code_correct_marks_livree(admin, rider):
    adm, _ = admin
    rs, rider_user = rider
    o = _create_cod_order(adm, total=10000, rider_id=rider_user["id"], rider_name=rider_user["name"])
    adm.patch(f"{BASE}/orders/{o['id']}/status", json={"status":"en_livraison"}, timeout=10)
    o2 = _get_order(adm, o['id'])
    code = o2["delivery_code"]
    r = rs.post(f"{BASE}/orders/{o['id']}/deliver", json={"method":"code","code":code,"amount_collected":10000}, timeout=10)
    assert r.status_code == 200, r.text
    o3 = _get_order(adm, o['id'])
    assert o3["status"] == "livree"
    assert o3["proof"]["method"] == "code"
    assert o3["proof"]["code_verified"] is True


# ---------- Photo delivery high-value needs manager PIN ----------
def test_deliver_photo_high_value_needs_pin(admin, rider):
    adm, _ = admin
    rs, rider_user = rider
    o = _create_cod_order(adm, total=60000, rider_id=rider_user["id"], rider_name=rider_user["name"])
    adm.patch(f"{BASE}/orders/{o['id']}/status", json={"status":"en_livraison"}, timeout=10)
    photo = "data:image/png;base64,iVBORw0KGgo="
    sig = "data:image/png;base64,iVBORw0KGgo="
    # No PIN -> 403
    r = rs.post(f"{BASE}/orders/{o['id']}/deliver", json={"method":"photo","photo":photo,"signature":sig}, timeout=10)
    assert r.status_code == 403
    assert "PIN" in r.text
    # Wrong PIN
    r2 = rs.post(f"{BASE}/orders/{o['id']}/deliver", json={"method":"photo","photo":photo,"signature":sig,"manager_pin":"9999"}, timeout=10)
    assert r2.status_code == 403
    assert "invalide" in r2.text.lower()
    # Correct PIN 1234 (admin)
    r3 = rs.post(f"{BASE}/orders/{o['id']}/deliver", json={"method":"photo","photo":photo,"signature":sig,"manager_pin":"1234"}, timeout=10)
    assert r3.status_code == 200, r3.text
    o3 = _get_order(adm, o['id'])
    assert o3["status"] == "livree"
    assert o3["proof"]["needs_review"] is True


def test_deliver_photo_low_value_no_pin(admin, rider):
    adm, _ = admin
    rs, rider_user = rider
    o = _create_cod_order(adm, total=10000, rider_id=rider_user["id"], rider_name=rider_user["name"])
    adm.patch(f"{BASE}/orders/{o['id']}/status", json={"status":"en_livraison"}, timeout=10)
    photo = "data:image/png;base64,iVBORw0KGgo="
    sig = "data:image/png;base64,iVBORw0KGgo="
    r = rs.post(f"{BASE}/orders/{o['id']}/deliver", json={"method":"photo","photo":photo,"signature":sig}, timeout=10)
    assert r.status_code == 200, r.text


def test_deliver_thirdparty(admin, rider):
    adm, _ = admin
    rs, rider_user = rider
    o = _create_cod_order(adm, total=12000, rider_id=rider_user["id"], rider_name=rider_user["name"])
    adm.patch(f"{BASE}/orders/{o['id']}/status", json={"status":"en_livraison"}, timeout=10)
    photo = "data:image/png;base64,iVBORw0KGgo="
    sig = "data:image/png;base64,iVBORw0KGgo="
    # Missing thirdparty_name -> 400
    r = rs.post(f"{BASE}/orders/{o['id']}/deliver", json={"method":"thirdparty","photo":photo,"signature":sig}, timeout=10)
    assert r.status_code == 400
    r2 = rs.post(f"{BASE}/orders/{o['id']}/deliver", json={"method":"thirdparty","photo":photo,"signature":sig,"thirdparty_name":"Awa","thirdparty_relation":"soeur"}, timeout=10)
    assert r2.status_code == 200, r2.text
    o2 = _get_order(adm, o['id'])
    assert o2["proof"]["thirdparty_name"] == "Awa"


# ---------- contact-log ----------
def test_contact_log_append(admin, rider):
    adm, _ = admin
    rs, rider_user = rider
    o = _create_cod_order(adm, total=5000, rider_id=rider_user["id"], rider_name=rider_user["name"])
    r = rs.post(f"{BASE}/orders/{o['id']}/contact-log", json={"kind":"whatsapp","template_key":"en_route"}, timeout=10)
    assert r.status_code == 200
    o2 = _get_order(adm, o['id'])
    log = o2.get("contact_log") or []
    assert any(x.get("kind") == "whatsapp" and x.get("template_key") == "en_route" for x in log)


# ---------- rider score ----------
def test_rider_score(rider):
    s, u = rider
    r = s.get(f"{BASE}/riders/{u['id']}/score", timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert 0 <= d["score"] <= 100
    assert d["level"] in ("Bronze","Argent","Or","Excellence")
    for k in ("delivery_rate","punctuality","rating","cash","proof"):
        assert k in d["components"]
    assert "weights" in d and "stats" in d


# ---------- rider reviews visibility ----------
def test_rider_reviews_hides_hidden_for_self(rider, admin):
    rs, u = rider
    adm, _ = admin
    # as rider self: no hidden
    r = rs.get(f"{BASE}/riders/{u['id']}/reviews", timeout=10)
    assert r.status_code == 200
    for rv in r.json():
        assert rv.get("hidden") in (None, False)
        cust = rv.get("customer") or {}
        assert "phone" not in cust
    # as admin: can include hidden
    r2 = adm.get(f"{BASE}/riders/{u['id']}/reviews", timeout=10)
    assert r2.status_code == 200


# ---------- users/me/photo & prefs ----------
def test_users_me_photo(rider):
    s, _ = rider
    img = "data:image/png;base64,AAA"
    r = s.patch(f"{BASE}/users/me/photo", json={"photo": img}, timeout=10)
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert r.json()["photo"] == img


def test_users_me_prefs_rejects_tampering(rider):
    s, _ = rider
    r = s.patch(f"{BASE}/users/me/prefs", json={"theme":"dark","wa":"wa-business","sound":True,"role":"admin","password_hash":"x"}, timeout=10)
    assert r.status_code == 200
    me = s.get(f"{BASE}/auth/me", timeout=10).json()
    assert me["role"] == "rider"
    assert me.get("prefs", {}).get("theme") == "dark"
    assert "role" not in me.get("prefs", {})
    assert "password_hash" not in me.get("prefs", {})


# ---------- review moderation ----------
def test_moderate_review_rbac(rider, admin):
    rs, _ = rider
    adm, _ = admin
    # need a review to moderate; find any
    reviews = adm.get(f"{BASE}/reviews", timeout=10)
    if reviews.status_code != 200 or not reviews.json():
        pytest.skip("no reviews seeded")
    rid = reviews.json()[0]["id"]
    r = rs.patch(f"{BASE}/reviews/{rid}/moderate", json={"hidden": True, "reason":"test"}, timeout=10)
    assert r.status_code == 403
    r2 = adm.patch(f"{BASE}/reviews/{rid}/moderate", json={"hidden": True, "reason":"test"}, timeout=10)
    assert r2.status_code == 200
    # revert
    adm.patch(f"{BASE}/reviews/{rid}/moderate", json={"hidden": False, "reason":""}, timeout=10)
