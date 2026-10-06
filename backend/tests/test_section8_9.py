"""
Tests for Sections 8 & 9 + WA auto-enqueue (Chez Dina).
Covers:
  - WA auto-enqueue on order status transitions (and no-op when unchanged)
  - /whatsapp-outbox CRUD + broadcast
  - /customer-segments
  - /loyalty/settings GET + PATCH
  - /referrals apply (success + 400/404 edges) + leaderboard + list
  - /roles-permissions GET + PATCH
  - /attendance/punch-kiosk (valid + invalid PIN) + /attendance/today
"""
import os, time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://dina-boutique.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "aouattaraesca@gmail.com", "password": "Admin123!"}
MANAGER = {"email": "manager.cocody@dinastore.ci", "password": "Manager123!"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text[:200]}"
    return s


@pytest.fixture(scope="module")
def admin():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def manager():
    return _login(MANAGER)


# ---------------- WhatsApp outbox + auto-enqueue ----------------

class TestWhatsAppOutbox:
    def test_outbox_list(self, admin):
        r = admin.get(f"{API}/whatsapp-outbox")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_outbox_pending_filter(self, admin):
        r = admin.get(f"{API}/whatsapp-outbox?status=pending")
        assert r.status_code == 200
        for m in r.json():
            assert m["sent"] is False

    def test_outbox_sent_filter(self, admin):
        r = admin.get(f"{API}/whatsapp-outbox?status=sent")
        assert r.status_code == 200
        for m in r.json():
            assert m["sent"] is True

    def test_outbox_kind_broadcast_filter(self, admin):
        r = admin.get(f"{API}/whatsapp-outbox?kind=broadcast")
        assert r.status_code == 200
        for m in r.json():
            assert m.get("kind") == "broadcast"

    def test_auto_enqueue_on_status_change(self, admin):
        # Pick any order
        orders = admin.get(f"{API}/orders").json()
        assert orders, "no orders in DB"
        # Find one with phone number
        order = next((o for o in orders if (o.get("customer") or {}).get("phone")), orders[0])
        oid = order["id"]
        orig_status = order.get("status")

        before = admin.get(f"{API}/whatsapp-outbox?status=pending").json()
        before_ids = {m["id"] for m in before if m.get("order_id") == oid}

        # Transition to a different valid status
        target = "confirmee" if orig_status != "confirmee" else "prete"
        r = admin.patch(f"{API}/orders/{oid}/status", json={"status": target})
        assert r.status_code == 200
        time.sleep(0.5)

        after = admin.get(f"{API}/whatsapp-outbox?status=pending").json()
        new_msgs = [m for m in after if m.get("order_id") == oid and m["id"] not in before_ids]
        has_phone = bool((order.get("customer") or {}).get("phone"))
        if has_phone:
            assert new_msgs, f"expected new WA message for order {oid} status {target}"
            m = new_msgs[0]
            assert m["kind"] == "status"
            assert m["sent"] is False
            assert m.get("message")
            assert m.get("link", "").startswith("https://wa.me/")
            assert m.get("order_code") == order.get("code")

        # Second patch with SAME status → should NOT enqueue new message
        before2 = admin.get(f"{API}/whatsapp-outbox?status=pending").json()
        r2 = admin.patch(f"{API}/orders/{oid}/status", json={"status": target})
        assert r2.status_code == 200
        time.sleep(0.3)
        after2 = admin.get(f"{API}/whatsapp-outbox?status=pending").json()
        new2 = [m for m in after2 if m.get("order_id") == oid and m["id"] not in {x["id"] for x in before2}]
        assert not new2, "duplicate enqueue when status unchanged"

    def test_mark_sent_and_delete(self, admin):
        pending = admin.get(f"{API}/whatsapp-outbox?status=pending").json()
        if not pending:
            pytest.skip("no pending msg")
        mid = pending[0]["id"]
        r = admin.post(f"{API}/whatsapp-outbox/{mid}/mark-sent")
        assert r.status_code == 200
        # Verify
        all_msgs = admin.get(f"{API}/whatsapp-outbox").json()
        marked = next((m for m in all_msgs if m["id"] == mid), None)
        assert marked and marked["sent"] is True and marked.get("sent_at")

        # delete it
        r = admin.delete(f"{API}/whatsapp-outbox/{mid}")
        assert r.status_code == 200
        all_msgs2 = admin.get(f"{API}/whatsapp-outbox").json()
        assert not any(m["id"] == mid for m in all_msgs2)

    def test_broadcast_vip(self, admin):
        r = admin.post(f"{API}/whatsapp-outbox/broadcast",
                       json={"segment": "vip", "message": "Bonjour {prenom} 👋 code: {code}"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert isinstance(data["enqueued"], int)


# ---------------- Customer segments ----------------

class TestCustomerSegments:
    def test_segments_counts(self, admin):
        r = admin.get(f"{API}/customer-segments")
        assert r.status_code == 200
        d = r.json()
        for k in ["all", "active", "inactive", "vip", "blacklist", "nouvelles"]:
            assert k in d
            assert isinstance(d[k], int)
        assert d["all"] >= d["vip"]


# ---------------- Loyalty settings ----------------

class TestLoyalty:
    def test_get_defaults(self, admin):
        r = admin.get(f"{API}/loyalty/settings")
        assert r.status_code == 200
        s = r.json()
        assert "points_per_fcfa" in s
        assert "tiers" in s and isinstance(s["tiers"], list) and len(s["tiers"]) >= 3
        assert "referral_bonus_parrain" in s
        assert "referral_bonus_filleul" in s

    def test_patch_and_persist(self, admin):
        orig = admin.get(f"{API}/loyalty/settings").json()
        new_rate = 777
        payload = {
            "points_per_fcfa": new_rate,
            "enabled": True,
            "referral_bonus_parrain": orig.get("referral_bonus_parrain", 1000),
            "referral_bonus_filleul": orig.get("referral_bonus_filleul", 500),
            "tiers": orig.get("tiers", []),
        }
        r = admin.patch(f"{API}/loyalty/settings", json=payload)
        assert r.status_code == 200
        again = admin.get(f"{API}/loyalty/settings").json()
        assert again["points_per_fcfa"] == new_rate
        # restore
        payload["points_per_fcfa"] = orig.get("points_per_fcfa", 500)
        admin.patch(f"{API}/loyalty/settings", json=payload)


# ---------------- Referrals ----------------

class TestReferrals:
    def test_referrals_list(self, admin):
        r = admin.get(f"{API}/referrals")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_leaderboard(self, admin):
        r = admin.get(f"{API}/referrals/leaderboard")
        assert r.status_code == 200
        for c in r.json():
            assert c.get("referral_count", 0) > 0

    def test_apply_404_bad_code(self, admin):
        customers = admin.get(f"{API}/customers").json()
        if not customers: pytest.skip("no customers")
        r = admin.post(f"{API}/referrals/apply", json={"code": "ZZZINVALID", "customer_id": customers[0]["id"]})
        assert r.status_code == 404

    def test_apply_success_then_already_referred(self, admin):
        customers = admin.get(f"{API}/customers").json()
        # Find a parrain with code and a filleul with no referred_by, different ids
        parrain = next((c for c in customers if c.get("referral_code")), None)
        if not parrain: pytest.skip("no customer with referral_code")
        filleul = next((c for c in customers if not c.get("referred_by") and c.get("id") != parrain["id"]), None)
        if not filleul: pytest.skip("no un-referred filleul")

        r = admin.post(f"{API}/referrals/apply", json={"code": parrain["referral_code"], "customer_id": filleul["id"]})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["referral"]["parrain_id"] == parrain["id"]
        assert data["referral"]["filleul_id"] == filleul["id"]

        # Verify parrain wallet / counts incremented
        updated_parrain = admin.get(f"{API}/customers").json()
        up = next(c for c in updated_parrain if c["id"] == parrain["id"])
        assert up.get("referral_count", 0) >= 1

        # Try again on same filleul → 400 already referred
        r2 = admin.post(f"{API}/referrals/apply", json={"code": parrain["referral_code"], "customer_id": filleul["id"]})
        assert r2.status_code == 400

    def test_apply_self_refer_400(self, admin):
        customers = admin.get(f"{API}/customers").json()
        p = next((c for c in customers if c.get("referral_code")), None)
        if not p: pytest.skip("no customer with code")
        r = admin.post(f"{API}/referrals/apply", json={"code": p["referral_code"], "customer_id": p["id"]})
        # either 400 self-refer or 400 already-referred
        assert r.status_code == 400


# ---------------- Roles & permissions ----------------

class TestRoles:
    def test_get_defaults(self, admin):
        r = admin.get(f"{API}/roles-permissions")
        assert r.status_code == 200
        d = r.json()
        assert "matrix" in d
        m = d["matrix"]
        for role in ["admin", "manager", "sales", "stock_keeper", "rider"]:
            assert role in m

    def test_patch_admin_only(self, admin, manager):
        orig = admin.get(f"{API}/roles-permissions").json()["matrix"]
        new_matrix = {**orig}
        new_matrix["sales"] = {**new_matrix.get("sales", {}), "expenses": True}
        r = admin.patch(f"{API}/roles-permissions", json={"matrix": new_matrix})
        assert r.status_code == 200
        after = admin.get(f"{API}/roles-permissions").json()["matrix"]
        assert after["sales"]["expenses"] is True
        # Manager should be forbidden
        r2 = manager.patch(f"{API}/roles-permissions", json={"matrix": new_matrix})
        assert r2.status_code in (401, 403)
        # restore
        admin.patch(f"{API}/roles-permissions", json={"matrix": orig})


# ---------------- Attendance kiosk ----------------

class TestKiosk:
    def test_punch_valid_pin_1234(self):
        r = requests.post(f"{API}/attendance/punch-kiosk", json={"code": "1234", "kind": "in"}, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["name"]
        assert d["role"] == "admin"
        assert d["kind"] == "in"

    def test_punch_invalid_pin_9999(self):
        r = requests.post(f"{API}/attendance/punch-kiosk", json={"code": "9999", "kind": "in"}, timeout=10)
        assert r.status_code == 403

    def test_punch_is_public_no_auth(self):
        # Fresh session, no cookies
        r = requests.post(f"{API}/attendance/punch-kiosk", json={"code": "5555", "kind": "out"}, timeout=10)
        assert r.status_code == 200

    def test_attendance_today_requires_auth(self, admin):
        r = requests.get(f"{API}/attendance/today", timeout=10)
        assert r.status_code in (401, 403)
        r2 = admin.get(f"{API}/attendance/today")
        assert r2.status_code == 200
        assert isinstance(r2.json(), list)
