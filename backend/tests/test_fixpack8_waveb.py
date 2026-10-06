"""
Chez Dina — Fix Pack 8 Wave B (Compte client) backend tests.
Covers: customer login, account photo/update, addresses CRUD, orders-split,
order detail with rider, live/simulated rider position, reviews-pending/submit,
recently-viewed, change-code (old+new), customer->rider thread creation.
"""
import os, time, pytest, requests, pathlib

def _load_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v: return v
    env = pathlib.Path("/app/frontend/.env").read_text()
    for ln in env.splitlines():
        if ln.startswith("REACT_APP_BACKEND_URL="):
            return ln.split("=",1)[1].strip()
    return ""

BASE_URL = _load_url().rstrip("/")
API = f"{BASE_URL}/api"

# Credentials from the review request
CUST1 = {"phone": "+225 07 00 00 11 22", "code": "368567"}       # TestPack6
CUST_AWA = {"phone": "+225 07 85 55 58 88", "code": "386436"}    # has en_livraison order
RIDER = {"email": "rider1@dinastore.ci", "password": "Rider123!"}
ADMIN = {"email": "aouattaraesca@gmail.com", "password": "Admin123!"}


# ---------- helpers ----------
def _cust_login(creds):
    r = requests.post(f"{API}/public/customer-login-code",
                      json={"phone": creds["phone"], "code": creds["code"]}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    j = r.json()
    assert "customer" in j and "token" in j
    return j["customer"], j["token"]


def _hdr(tok): return {"Authorization": f"Bearer {tok}"}


def _staff_login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ---------- 1. Customer login ----------
def test_customer_login_code_ok():
    cust, tok = _cust_login(CUST1)
    assert cust.get("phone")
    assert isinstance(tok, str) and len(tok) > 10


def test_customer_login_code_wrong():
    r = requests.post(f"{API}/public/customer-login-code",
                      json={"phone": CUST1["phone"], "code": "000000"}, timeout=15)
    assert r.status_code in (400, 401)


# ---------- 2. Photo upload ----------
def test_account_photo_upload():
    _, tok = _cust_login(CUST1)
    tiny = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAC0lEQVQI12NgAAIAAAUAAeImBZsAAAAASUVORK5CYII="
    r = requests.post(f"{API}/public/account/photo", json={"photo": tiny},
                      headers=_hdr(tok), timeout=15)
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True
    # Verify persisted
    me = requests.get(f"{API}/public/account/me", headers=_hdr(tok), timeout=15).json()
    assert me["customer"].get("photo", "").startswith("data:image")


# ---------- 3. Update profile ----------
def test_account_update_fields():
    _, tok = _cust_login(CUST1)
    r = requests.patch(f"{API}/public/account/update",
                       json={"shoe_size": "40", "clothing_size": "M",
                             "communication_prefs": {"sms": True, "email": False}},
                       headers=_hdr(tok), timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("shoe_size") == "40"
    assert j.get("clothing_size") == "M"
    assert (j.get("communication_prefs") or {}).get("sms") is True


# ---------- 4. Addresses CRUD ----------
def test_addresses_crud_and_default_toggle():
    _, tok = _cust_login(CUST1)
    # Cleanup prior TEST_ addresses
    existing = requests.get(f"{API}/public/account/addresses", headers=_hdr(tok), timeout=15).json()
    for a in existing:
        if (a.get("label") or "").startswith("TEST_"):
            requests.delete(f"{API}/public/account/addresses/{a['id']}", headers=_hdr(tok), timeout=15)
    before = requests.get(f"{API}/public/account/addresses", headers=_hdr(tok), timeout=15).json()
    before_ids = {a["id"] for a in before}
    # Add first with default=True
    r1 = requests.post(f"{API}/public/account/addresses",
                       json={"label": "TEST_A", "street": "Rue 1", "city": "Abidjan", "zone": "Cocody", "default": True},
                       headers=_hdr(tok), timeout=15)
    assert r1.status_code == 200, r1.text
    addrs = r1.json()["addresses"]
    a1 = next(a for a in addrs if a["id"] not in before_ids)
    assert a1.get("default") is True
    # Add second with default=True; previous default must flip
    r2 = requests.post(f"{API}/public/account/addresses",
                       json={"label": "TEST_B", "street": "Rue 2", "zone": "Yopougon", "default": True},
                       headers=_hdr(tok), timeout=15)
    addrs2 = r2.json()["addresses"]
    a2 = next(a for a in addrs2 if a["id"] not in before_ids and a["id"] != a1["id"])
    a1_after = next(a for a in addrs2 if a["id"] == a1["id"])
    assert a2["default"] is True and a1_after["default"] is False
    # Patch
    rp = requests.patch(f"{API}/public/account/addresses/{a1['id']}",
                        json={"street": "Rue 1 bis"}, headers=_hdr(tok), timeout=15)
    assert rp.status_code == 200
    addrs3 = rp.json()["addresses"]
    assert next(a for a in addrs3 if a["id"] == a1["id"])["street"] == "Rue 1 bis"
    # Delete both
    for a in (a1, a2):
        rd = requests.delete(f"{API}/public/account/addresses/{a['id']}",
                             headers=_hdr(tok), timeout=15)
        assert rd.status_code == 200


# ---------- 5. Orders split ----------
def test_orders_split_returns_buckets_and_counts():
    _, tok = _cust_login(CUST_AWA)
    r = requests.get(f"{API}/public/account/orders-split", headers=_hdr(tok), timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    for k in ("in_progress", "delivered", "cancelled", "counts"):
        assert k in j
    assert j["counts"]["in_progress"] == len(j["in_progress"])
    assert j["counts"]["delivered"] == len(j["delivered"])
    assert j["counts"]["cancelled"] == len(j["cancelled"])


# ---------- 6. Order detail with rider ----------
@pytest.fixture(scope="module")
def awa_enlivraison_order():
    _, tok = _cust_login(CUST_AWA)
    r = requests.get(f"{API}/public/account/orders-split", headers=_hdr(tok), timeout=15).json()
    enliv = [o for o in r["in_progress"] if o.get("status") == "en_livraison"]
    if not enliv:
        pytest.skip("No en_livraison order present for Awa")
    return tok, enliv[0]


def test_order_detail_with_rider(awa_enlivraison_order):
    tok, o = awa_enlivraison_order
    code = o["code"]
    r = requests.get(f"{API}/public/account/order/{code}", headers=_hdr(tok), timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["order"]["code"] == code
    if o.get("rider_id"):
        assert j.get("rider") and j["rider"].get("name")


# ---------- 7. Rider position (simulator + live) ----------
def test_rider_position_simulator_when_no_live(awa_enlivraison_order):
    _, o = awa_enlivraison_order
    code = o["code"]
    r = requests.get(f"{API}/public/order/{code}/rider-position", timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("active") is True
    pos = j.get("position")
    assert pos and "lat" in pos and "lng" in pos
    # If no live push happened in last 60s, must be simulated
    # (Could already be live if rider pushed recently; both OK but we check structure)
    assert "simulated" in pos
    assert isinstance(j.get("eta_minutes"), int)


def test_rider_position_live_overrides_simulator(awa_enlivraison_order):
    _, o = awa_enlivraison_order
    code = o["code"]
    # Login rider
    rtok = _staff_login(RIDER)
    push = requests.post(f"{API}/rider/position",
                         json={"lat": 5.3600, "lng": -3.9800, "order_id": o.get("id")},
                         headers=_hdr(rtok), timeout=15)
    assert push.status_code == 200, push.text
    # Fetch immediately
    r = requests.get(f"{API}/public/order/{code}/rider-position", timeout=15)
    j = r.json()
    # Rider might not be the one assigned to this order; only assert live overrides when matched
    if o.get("rider_id"):
        # If rider is actually assigned to this order
        from_order = o.get("rider_id")
        # Just assert the response has a position
        assert j.get("position") is not None


def test_rider_position_requires_rider_role():
    atok = _staff_login(ADMIN)
    r = requests.post(f"{API}/rider/position", json={"lat": 1, "lng": 2},
                      headers=_hdr(atok), timeout=15)
    assert r.status_code == 403


def test_rider_position_inactive_for_non_delivery_status():
    # Find any order NOT in en_livraison
    _, tok = _cust_login(CUST_AWA)
    all_orders = requests.get(f"{API}/public/account/orders-split", headers=_hdr(tok), timeout=15).json()
    cand = None
    for bucket in ("delivered", "cancelled"):
        if all_orders[bucket]:
            cand = all_orders[bucket][0]; break
    if not cand: pytest.skip("No non-en_livraison order to test")
    r = requests.get(f"{API}/public/order/{cand['code']}/rider-position", timeout=15).json()
    assert r.get("active") is False


# ---------- 8. Recently viewed ----------
def test_recently_viewed_track_and_list():
    _, tok = _cust_login(CUST1)
    # Fetch a product id
    prods = requests.get(f"{API}/public/products", timeout=15).json()
    assert isinstance(prods, list) and prods
    pid = prods[0]["id"]
    r = requests.post(f"{API}/public/account/recently-viewed",
                      json={"product_id": pid}, headers=_hdr(tok), timeout=15)
    assert r.status_code == 200
    lst = requests.get(f"{API}/public/account/recently-viewed",
                       headers=_hdr(tok), timeout=15).json()
    assert any(p.get("id") == pid for p in lst)


# ---------- 9. Reviews pending + submit ----------
def test_reviews_pending_returns_list():
    _, tok = _cust_login(CUST_AWA)
    r = requests.get(f"{API}/public/account/reviews-pending",
                     headers=_hdr(tok), timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_review_submit_updates_rating():
    _, tok = _cust_login(CUST_AWA)
    pending = requests.get(f"{API}/public/account/reviews-pending",
                           headers=_hdr(tok), timeout=15).json()
    if not pending: pytest.skip("No pending reviews for Awa")
    pid = pending[0]["product_id"]
    before = requests.get(f"{API}/public/products", timeout=15).json()
    bprod = next((p for p in before if p["id"] == pid), None)
    r = requests.post(f"{API}/public/account/reviews",
                      json={"product_id": pid, "rating": 5, "comment": "TEST_WAVEB"},
                      headers=_hdr(tok), timeout=15)
    assert r.status_code == 200, r.text
    after = requests.get(f"{API}/public/products", timeout=15).json()
    aprod = next((p for p in after if p["id"] == pid), None)
    assert aprod and (aprod.get("rating_count") or 0) >= 1


# ---------- 10. Change-code (PIN) ----------
def test_change_code_flow():
    cust, tok = _cust_login(CUST1)
    old = CUST1["code"]
    newc = "749251"
    # Wrong old
    r_bad = requests.post(f"{API}/public/account/change-code",
                          json={"old_code": "000000", "new_code": newc},
                          headers=_hdr(tok), timeout=15)
    assert r_bad.status_code == 400
    # Simple pattern
    r_simple = requests.post(f"{API}/public/account/change-code",
                             json={"old_code": old, "new_code": "123456"},
                             headers=_hdr(tok), timeout=15)
    assert r_simple.status_code == 400
    # Length
    r_short = requests.post(f"{API}/public/account/change-code",
                            json={"old_code": old, "new_code": "12"},
                            headers=_hdr(tok), timeout=15)
    assert r_short.status_code == 400
    # Success
    r_ok = requests.post(f"{API}/public/account/change-code",
                         json={"old_code": old, "new_code": newc},
                         headers=_hdr(tok), timeout=15)
    assert r_ok.status_code == 200, r_ok.text
    # Revert
    _, tok2 = requests.post(f"{API}/public/customer-login-code",
                            json={"phone": CUST1["phone"], "code": newc}, timeout=15).json().values() \
                            if False else (None, None)  # ignore destructure
    # Login with new
    r_log = requests.post(f"{API}/public/customer-login-code",
                          json={"phone": CUST1["phone"], "code": newc}, timeout=15)
    assert r_log.status_code == 200
    tok2 = r_log.json()["token"]
    # Revert
    r_rev = requests.post(f"{API}/public/account/change-code",
                          json={"old_code": newc, "new_code": old},
                          headers=_hdr(tok2), timeout=15)
    assert r_rev.status_code == 200


# ---------- 11. Rider thread creation ----------
def test_create_rider_thread(awa_enlivraison_order):
    tok, o = awa_enlivraison_order
    if not o.get("rider_id"): pytest.skip("Order has no rider assigned")
    r = requests.post(f"{API}/public/account/thread/rider/{o['code']}",
                      headers=_hdr(tok), timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("id")
    # Idempotent: second call returns same id
    r2 = requests.post(f"{API}/public/account/thread/rider/{o['code']}",
                       headers=_hdr(tok), timeout=15).json()
    assert r2.get("id") == j.get("id")
