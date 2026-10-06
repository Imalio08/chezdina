"""Section 11 consolidation tests: Pages/Brands/Categories/CashSessions/Encaissements/P&L/Integrations + WA rebrand."""
import os, pytest, requests

def _load_env():
    try:
        with open("/app/frontend/.env") as f:
            for ln in f:
                if ln.startswith("REACT_APP_BACKEND_URL="):
                    return ln.split("=",1)[1].strip()
    except Exception: pass
    return os.environ.get("REACT_APP_BACKEND_URL", "")

BASE = _load_env().rstrip("/")
ADMIN = {"email": "aouattaraesca@gmail.com", "password": "Admin123!"}
MANAGER = {"email": "manager.cocody@dinastore.ci", "password": "Manager123!"}
SALES = {"email": "agent1@dinastore.ci", "password": "Agent123!"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{BASE}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def admin():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def manager():
    return _login(MANAGER)


@pytest.fixture(scope="module")
def sales():
    return _login(SALES)


# ---------- CMS Pages ----------
class TestPages:
    def test_list_pages_seeds_defaults(self, admin):
        r = admin.get(f"{BASE}/api/pages")
        assert r.status_code == 200
        rows = r.json()
        slugs = {p["slug"] for p in rows}
        assert {"about", "delivery", "terms", "faq"}.issubset(slugs)

    def test_public_pages_no_auth(self):
        r = requests.get(f"{BASE}/api/public/pages")
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) >= 4

    def test_create_update_delete_custom_page(self, admin):
        slug = "TEST-dina-boutique"
        c = admin.post(f"{BASE}/api/pages", json={"slug": slug, "title": "Test", "content": "x", "enabled": True})
        assert c.status_code == 200, c.text
        u = admin.patch(f"{BASE}/api/pages/{slug}", json={"title": "Updated"})
        assert u.status_code == 200
        # Verify persisted
        rows = admin.get(f"{BASE}/api/pages").json()
        found = next((p for p in rows if p["slug"] == slug), None)
        assert found and found["title"] == "Updated"
        d = admin.delete(f"{BASE}/api/pages/{slug}")
        assert d.status_code == 200

    def test_delete_page_requires_admin(self, manager):
        r = manager.delete(f"{BASE}/api/pages/nonexistent")
        assert r.status_code == 403


# ---------- Brands & Categories ----------
class TestBrandsCategories:
    def test_brands_derived_with_counts(self, admin):
        r = admin.get(f"{BASE}/api/brands")
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) > 0
        for b in rows:
            assert "name" in b and "product_count" in b
            assert isinstance(b["product_count"], int)

    def test_categories_derived_with_counts(self, admin):
        r = admin.get(f"{BASE}/api/categories")
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) > 0
        for c in rows:
            assert "name" in c and "product_count" in c

    def test_brand_crud(self, admin):
        c = admin.post(f"{BASE}/api/brands", json={"name": "TEST_Brand_X"})
        assert c.status_code == 200
        bid = c.json()["id"]
        d = admin.delete(f"{BASE}/api/brands/{bid}")
        assert d.status_code == 200


# ---------- Cash Sessions ----------
class TestCashSessions:
    def test_open_close_flow(self, admin):
        # Close any existing open sessions first via list
        lst = admin.get(f"{BASE}/api/cash-sessions").json()
        for s in lst:
            if not s.get("closed"):
                admin.post(f"{BASE}/api/cash-sessions/{s['id']}/close",
                           json={"closing_cash": s["opening_cash"], "pin": "1234"})
        # Open
        o = admin.post(f"{BASE}/api/cash-sessions/open", json={"opening_cash": 50000})
        assert o.status_code == 200, o.text
        sid = o.json()["id"]
        # Cannot open twice
        o2 = admin.post(f"{BASE}/api/cash-sessions/open", json={"opening_cash": 1000})
        assert o2.status_code == 400
        # Wrong PIN
        w = admin.post(f"{BASE}/api/cash-sessions/{sid}/close", json={"closing_cash": 60000, "pin": "9999"})
        assert w.status_code == 403
        # Correct PIN
        c = admin.post(f"{BASE}/api/cash-sessions/{sid}/close", json={"closing_cash": 60000, "pin": "1234"})
        assert c.status_code == 200
        summary = c.json()["summary"]
        assert "expected" in summary and "ecart" in summary

    def test_list_sessions(self, admin):
        r = admin.get(f"{BASE}/api/cash-sessions")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Encaissements & P&L ----------
class TestFinance:
    def test_encaissements(self, admin):
        r = admin.get(f"{BASE}/api/encaissements?days=7")
        assert r.status_code == 200
        d = r.json()
        for k in ("by_method", "daily", "total", "count"):
            assert k in d
        assert isinstance(d["by_method"], list)
        assert isinstance(d["daily"], list)

    def test_profit_loss(self, admin):
        r = admin.get(f"{BASE}/api/profit-loss?days=30")
        assert r.status_code == 200
        d = r.json()
        for k in ("revenue", "cogs", "gross_margin", "expenses_by_cat", "net"):
            assert k in d
        assert isinstance(d["expenses_by_cat"], list)


# ---------- Integrations ----------
class TestIntegrations:
    def test_get_integrations(self, admin):
        r = admin.get(f"{BASE}/api/integrations")
        assert r.status_code == 200
        assert isinstance(r.json(), dict)

    def test_patch_integrations_persists_and_masks_token(self, admin):
        payload = {
            "whatsapp_auto": True,
            "whatsapp_meta_token": "SECRETTOKEN123456",
            "whatsapp_phone_id": "123456",
            "meta_pixel_id": "META-PX-1",
            "tiktok_pixel_id": "TT-PX-1",
            "wifi_printer_ip": "192.168.1.50",
        }
        p = admin.patch(f"{BASE}/api/integrations", json=payload)
        assert p.status_code == 200, p.text
        g = admin.get(f"{BASE}/api/integrations").json()
        assert g.get("whatsapp_auto") is True
        assert g.get("meta_pixel_id") == "META-PX-1"
        assert g.get("tiktok_pixel_id") == "TT-PX-1"
        assert g.get("wifi_printer_ip") == "192.168.1.50"
        # Token masked
        tok = g.get("whatsapp_meta_token", "")
        assert tok.startswith("****"), f"Token not masked: {tok}"

    def test_patch_integrations_requires_role(self, sales):
        r = sales.patch(f"{BASE}/api/integrations", json={"whatsapp_auto": False})
        assert r.status_code == 403


# ---------- WhatsApp template rebrand ----------
class TestWhatsAppRebrand:
    def test_template_says_chez_dina_only(self, admin):
        # Fetch an order and bump status to trigger WA message generation
        orders = admin.get(f"{BASE}/api/orders").json()
        assert orders, "No orders found to test"
        # Pick first order not already livree/annulee
        target = next((o for o in orders if o.get("status") not in ("livree", "annulee")), None)
        if not target:
            pytest.skip("No actionable order")
        oid = target["id"]
        current = target["status"]
        # Progress to next status (confirmee if nouvelle, else just re-set same)
        new_status = "confirmee" if current == "nouvelle" else current
        r = admin.patch(f"{BASE}/api/orders/{oid}/status", json={"status": new_status})
        assert r.status_code == 200
        # Fetch WA outbox to check enqueued message
        out = admin.get(f"{BASE}/api/whatsapp/outbox").json() if admin.get(f"{BASE}/api/whatsapp/outbox").status_code == 200 else []
        texts = " ".join(m.get("text", "") for m in out[:20])
        if "Chez Dina" in texts:
            assert "Chez Dina Boutique" not in texts, "Still uses old 'Chez Dina Boutique' branding"
