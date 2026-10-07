"""Iteration 51 — Rider CMS + 100-product catalog + logo propagation tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://dina-boutique.preview.emergentagent.com").rstrip("/")

ADMIN = {"email": "aouattaraesca@gmail.com", "password": "Admin123!"}
RIDER = {"email": "rider1@dinastore.ci", "password": "Rider123!"}

WOMENS_CATEGORIES = {
    "Talons", "Sandales", "Mules", "Ballerines", "Baskets", "Bottes",
    "Mocassins", "Espadrilles",
    "Sacs à main", "Pochettes", "Mini sacs", "Cabas", "Sacs à dos",
    "Robes", "Hauts", "Pantalons", "Jupes", "Pagne", "Vestes", "Combinaisons",
}
ALLOWED_BRANDS = {"Dina Soles", "Dina Carry", "Dina Dress"}


def _login(session: requests.Session, creds):
    r = session.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text[:200]}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    if tok:
        session.headers.update({"Authorization": f"Bearer {tok}"})
    return data


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    _login(s, ADMIN)
    return s


@pytest.fixture(scope="module")
def rider():
    s = requests.Session()
    _login(s, RIDER)
    return s


# ---------- Rider CMS ----------

class TestRiderCMS:
    def test_public_rider_cms_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/public/rider-cms", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for key in ("primary_color", "accent_color", "greeting", "subtitle",
                    "announcement", "help", "tabs"):
            assert key in d, f"missing {key}"
        assert isinstance(d["tabs"], list)
        # at least 5 default tabs
        assert len(d["tabs"]) >= 5

    def test_auth_rider_cms_get(self, admin):
        r = admin.get(f"{BASE_URL}/api/rider-cms", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "primary_color" in d and "tabs" in d

    def test_patch_rider_cms_as_admin(self, admin):
        payload = {
            "primary_color": "#1f8a4c",
            "announcement": {"enabled": True, "text": "Pluie ce matin", "variant": "warning"},
            "tabs": [
                {"key": "courses", "to": "/rider", "icon": "Package", "label": "Courses", "visible": True, "builtin": True},
                {"key": "carte", "to": "/rider/carte", "icon": "Map", "label": "Carte", "visible": True, "builtin": True},
                {"key": "historique", "to": "/rider/historique", "icon": "History", "label": "Historique", "visible": True, "builtin": True},
                {"key": "performance", "to": "/rider/performance", "icon": "Trophy", "label": "Performance", "visible": True, "builtin": True},
                {"key": "profil", "to": "/rider/profil", "icon": "User", "label": "Profil", "visible": True, "builtin": True},
                {"key": "whatsapp", "to": "https://wa.me/22577779200", "icon": "MessageCircle", "label": "WhatsApp", "visible": True, "builtin": False},
            ],
        }
        r = admin.patch(f"{BASE_URL}/api/rider-cms", json=payload, timeout=15)
        assert r.status_code == 200, r.text[:200]
        # verify via public
        pr = requests.get(f"{BASE_URL}/api/public/rider-cms", timeout=15).json()
        assert pr["primary_color"] == "#1f8a4c"
        assert pr["announcement"]["enabled"] is True
        assert pr["announcement"]["text"] == "Pluie ce matin"
        labels = [t["label"] for t in pr["tabs"]]
        assert "WhatsApp" in labels
        assert len(pr["tabs"]) == 6

    def test_patch_forbidden_for_rider(self, rider):
        r = rider.patch(f"{BASE_URL}/api/rider-cms", json={"primary_color": "#000000"}, timeout=15)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_reset_rider_cms_as_admin(self, admin):
        r = admin.post(f"{BASE_URL}/api/rider-cms/reset", timeout=15)
        assert r.status_code == 200
        pr = requests.get(f"{BASE_URL}/api/public/rider-cms", timeout=15).json()
        assert pr["primary_color"] == "#b02a2a"
        assert pr["announcement"]["enabled"] is False
        assert len(pr["tabs"]) == 5


# ---------- Catalog reseed ----------

class TestWomenFashionReseed:
    def test_reseed_returns_100(self, admin):
        r = admin.post(f"{BASE_URL}/api/admin/reseed-women-fashion", timeout=120)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d.get("inserted") == 100, f"expected inserted=100 got {d}"

    def test_products_count_and_uniqueness(self):
        # Use large per_page to fetch all
        r = requests.get(f"{BASE_URL}/api/public/products", params={"per_page": 200, "page": 1}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        items = data.get("items") if isinstance(data, dict) else data
        assert isinstance(items, list), f"unexpected shape: {type(data)}"
        assert len(items) == 100, f"expected 100 products got {len(items)}"
        images = []
        for p in items:
            img = p.get("image") or (p.get("images") or [None])[0]
            images.append(img)
        assert all(images), "some products missing image"
        assert len(set(images)) == 100, f"images not unique: {len(set(images))}/100"

    def test_products_categories_and_brands(self):
        r = requests.get(f"{BASE_URL}/api/public/products", params={"per_page": 200}, timeout=30)
        items = r.json().get("items") if isinstance(r.json(), dict) else r.json()
        cats = set()
        brands = set()
        for p in items:
            c = p.get("category")
            if c:
                cats.add(c)
            b = p.get("brand")
            if b:
                brands.add(b)
        unexpected_cats = cats - WOMENS_CATEGORIES
        assert not unexpected_cats, f"unexpected categories: {unexpected_cats}"
        unexpected_brands = brands - ALLOWED_BRANDS
        assert not unexpected_brands, f"unexpected brands: {unexpected_brands}"
