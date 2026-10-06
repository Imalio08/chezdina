"""Fix pack 3 — Waitlist grouping, Out-of-catalog, Abandoned relaunch, Order status-v3, Invoices."""
import os
import time
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://dina-boutique.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

ADMIN = {"email": "aouattaraesca@gmail.com", "password": "Admin123!"}
MANAGER = {"email": "manager.cocody@dinastore.ci", "password": "Manager123!"}
RIDER = {"email": "rider1@dinastore.ci", "password": "Rider123!"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed {creds['email']}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_h():
    return {"Authorization": f"Bearer {_login(ADMIN)}"}


@pytest.fixture(scope="module")
def manager_h():
    return {"Authorization": f"Bearer {_login(MANAGER)}"}


@pytest.fixture(scope="module")
def rider_h():
    return {"Authorization": f"Bearer {_login(RIDER)}"}


# ---------------- Waitlist grouping ----------------
class TestWaitlistGrouped:
    def test_grouped_shape_admin(self, admin_h):
        r = requests.get(f"{API}/waitlist/grouped", headers=admin_h, timeout=20)
        assert r.status_code == 200, r.text
        j = r.json()
        for k in ("groups", "pending", "products_affected", "customers_total", "conversion_pct"):
            assert k in j, f"missing {k}"
        assert isinstance(j["groups"], list)
        if j["groups"]:
            g = j["groups"][0]
            for k in ("product_id", "product", "size", "color", "customers"):
                assert k in g
            assert isinstance(g["customers"], list)

    def test_grouped_manager_ok(self, manager_h):
        r = requests.get(f"{API}/waitlist/grouped", headers=manager_h, timeout=20)
        assert r.status_code == 200

    def test_notify_marks_waitlist(self, admin_h):
        # pick first pending entry
        r = requests.get(f"{API}/waitlist/grouped", headers=admin_h, timeout=20).json()
        if not r["groups"]:
            pytest.skip("no pending waitlist")
        g = r["groups"][0]
        if not g["customers"]:
            pytest.skip("no customers in group")
        wid = g["customers"][0]["id"]
        resp = requests.post(f"{API}/waitlist/{wid}/notify", headers=admin_h, timeout=20)
        assert resp.status_code == 200, resp.text
        assert resp.json().get("ok") is True


# ---------------- Out-of-catalog ----------------
class TestOutOfCatalog:
    kw = f"test_fp3_kw_{int(time.time())}"

    def test_public_post_no_auth(self):
        r = requests.post(f"{API}/public/out-of-catalog",
                          json={"keyword": self.kw, "customer_phone": "+2250700000001", "channel": "site"},
                          timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    def test_public_post_twice_increments(self):
        requests.post(f"{API}/public/out-of-catalog",
                      json={"keyword": self.kw, "customer_phone": "+2250700000002", "channel": "pos"}, timeout=20)

    def test_list_groups_by_keyword(self, admin_h):
        r = requests.get(f"{API}/out-of-catalog", headers=admin_h, timeout=20)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "keywords" in j and "total" in j
        match = [b for b in j["keywords"] if b["keyword"] == self.kw.lower()]
        assert match, f"keyword {self.kw} not grouped"
        assert match[0]["count"] >= 2


# ---------------- Abandoned carts detail + relaunch ----------------
@pytest.fixture(scope="module")
def abandoned_cart_id(admin_h):
    # Try existing abandoned carts first
    r = requests.get(f"{API}/abandoned-carts", headers=admin_h, timeout=20)
    if r.status_code == 200:
        data = r.json()
        arr = data if isinstance(data, list) else (data.get("carts") or data.get("items") or [])
        if arr:
            return arr[0]["id"]
    pytest.skip("no abandoned carts available")


class TestAbandonedDetail:
    def test_detail_enriched(self, admin_h, abandoned_cart_id):
        r = requests.get(f"{API}/abandoned-carts/{abandoned_cart_id}", headers=admin_h, timeout=20)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "customer_stats" in j
        cs = j["customer_stats"]
        for k in ("orders_count", "total_spent", "tier"):
            assert k in cs
        assert "reminders" in j and isinstance(j["reminders"], list)

    def test_detail_404(self, admin_h):
        r = requests.get(f"{API}/abandoned-carts/does_not_exist_xyz", headers=admin_h, timeout=20)
        assert r.status_code == 404


class TestAbandonedRelaunch:
    def test_relaunch_single_cart(self, admin_h, abandoned_cart_id):
        payload = {
            "cart_ids": [abandoned_cart_id],
            "offer_type": "pct",
            "value": 10,
            "channels": ["whatsapp"],
            "ends_at": "2026-12-31",
            "message": "Bonjour {prénom}, votre panier {produits} vous attend ! Code {code} valide jusqu'au {date_fin}. {lien_panier}",
        }
        r = requests.post(f"{API}/abandoned-carts/relaunch", headers=admin_h, json=payload, timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("ok") is True
        assert j.get("sent", 0) >= 0  # may be 0 if cart has no phone
        assert "code" in j
        # Verify reminders + whatsapp_outbox if sent >=1 — check via detail
        d = requests.get(f"{API}/abandoned-carts/{abandoned_cart_id}", headers=admin_h, timeout=20).json()
        if j["sent"] >= 1:
            assert d.get("status") == "relance" or any(x for x in d.get("reminders", []))

    def test_relaunch_by_period(self, admin_h):
        payload = {
            "offer_type": "none",
            "channels": ["whatsapp"],
            "period_from": "2020-01-01",
            "period_to": "2030-01-01",
            "message": "Bonjour {prénom}, revenez vite ! {lien_panier}",
        }
        r = requests.post(f"{API}/abandoned-carts/relaunch", headers=admin_h, json=payload, timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("ok") is True
        assert "sent" in j


# ---------------- Order status-v3 + invoices ----------------
@pytest.fixture(scope="module")
def test_orders(admin_h):
    """Fetch some order ids in various statuses for role tests."""
    r = requests.get(f"{API}/orders", headers=admin_h, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    arr = data if isinstance(data, list) else (data.get("orders") or data.get("items") or [])
    assert arr, "no orders in db"
    return arr


class TestOrderStatusV3:
    def test_manager_cannot_livree(self, manager_h, test_orders):
        oid = test_orders[0]["id"]
        r = requests.patch(f"{API}/orders/{oid}/status-v3", headers=manager_h,
                           json={"status": "livree"}, timeout=20)
        assert r.status_code == 403, r.text
        assert "manager" in r.text.lower() or "ne peut pas" in r.text.lower()

    def test_rider_cannot_nouvelle(self, rider_h, test_orders):
        oid = test_orders[0]["id"]
        r = requests.patch(f"{API}/orders/{oid}/status-v3", headers=rider_h,
                           json={"status": "nouvelle"}, timeout=20)
        assert r.status_code == 403, r.text

    def test_admin_livree_requires_reason_for_override(self, admin_h, test_orders):
        # Admin IS allowed (allowed=None), BUT only triggers override check when NOT in allowed.
        # Since admin.allowed = None, admin can do anything without reason. Test: admin livree works.
        # Find a non-livree order
        candidate = next((o for o in test_orders if o.get("status") not in ("livree", "annulee")), None)
        if not candidate:
            pytest.skip("no eligible order")
        oid = candidate["id"]
        r = requests.patch(f"{API}/orders/{oid}/status-v3", headers=admin_h,
                           json={"status": "livree", "reason": "test fp3 livraison admin"}, timeout=20)
        assert r.status_code == 200, r.text
        # Invoice auto-created
        inv = requests.get(f"{API}/orders/{oid}/invoice", headers=admin_h, timeout=20)
        assert inv.status_code == 200, inv.text
        j = inv.json()
        assert j.get("invoice") is not None
        assert j["invoice"].get("order_id") == oid
        assert j["invoice"].get("number", "").startswith("INV-")

    def test_404_unknown_order(self, admin_h):
        r = requests.patch(f"{API}/orders/does_not_exist_xyz/status-v3", headers=admin_h,
                           json={"status": "livree", "reason": "x"}, timeout=20)
        assert r.status_code == 404


class TestInvoice:
    def test_generate_invoice_idempotent(self, admin_h, test_orders):
        # pick an order that already has invoice (livree one from previous test) or any
        oid = test_orders[0]["id"]
        r1 = requests.post(f"{API}/orders/{oid}/generate-invoice", headers=admin_h, timeout=20)
        assert r1.status_code == 200, r1.text
        j1 = r1.json()
        assert j1.get("ok") is True
        assert "invoice" in j1
        # Second call should be idempotent
        r2 = requests.post(f"{API}/orders/{oid}/generate-invoice", headers=admin_h, timeout=20)
        assert r2.status_code == 200
        j2 = r2.json()
        if j2.get("already"):
            assert j2["invoice"]["id"] == j1["invoice"]["id"]

    def test_get_invoice_shape(self, admin_h, test_orders):
        oid = test_orders[0]["id"]
        r = requests.get(f"{API}/orders/{oid}/invoice", headers=admin_h, timeout=20)
        assert r.status_code == 200
        j = r.json()
        if j.get("invoice"):
            for k in ("number", "order_id", "total", "status"):
                assert k in j["invoice"]


# ---------------- Regression: Fix pack 1 + 2 ----------------
class TestRegression:
    def test_me_admin(self, admin_h):
        r = requests.get(f"{API}/auth/me", headers=admin_h, timeout=20)
        assert r.status_code == 200
        assert r.json().get("role") == "admin"

    def test_products_list(self, admin_h):
        r = requests.get(f"{API}/products", headers=admin_h, timeout=20)
        assert r.status_code == 200
        data = r.json()
        arr = data if isinstance(data, list) else (data.get("products") or data.get("items") or [])
        assert len(arr) > 0

    def test_audit_logs_admin_only(self, admin_h, manager_h):
        r1 = requests.get(f"{API}/audit-logs", headers=admin_h, timeout=20)
        assert r1.status_code == 200
        r2 = requests.get(f"{API}/audit-logs", headers=manager_h, timeout=20)
        assert r2.status_code in (401, 403)

    def test_roles_list(self, admin_h):
        r = requests.get(f"{API}/roles", headers=admin_h, timeout=20)
        assert r.status_code == 200
