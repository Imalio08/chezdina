"""Iter54 backend tests: rider PWA manifest/icons + women-fashion reseed (shoes+bags only)."""
import os
import io
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

ADMIN_EMAIL = "aouattaraesca@gmail.com"
ADMIN_PASSWORD = "Admin123!"

ALLOWED_CATEGORIES = {
    "Talons", "Sandales", "Mules", "Ballerines", "Baskets", "Bottes",
    "Mocassins", "Espadrilles",
    "Sacs à main", "Pochettes", "Mini sacs", "Cabas", "Sacs à dos",
}
CLOTHING_CATEGORIES = {
    "Robes", "Hauts", "Pantalons", "Jupes", "Pagne", "Vestes", "Combinaisons",
}
ALLOWED_BRANDS = {"Dina Soles", "Dina Carry"}


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
               timeout=20)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ---------------- Rider PWA manifest ----------------
class TestRiderManifest:
    def test_manifest_rider_public_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/public/manifest-rider.webmanifest", timeout=15)
        assert r.status_code == 200, r.text[:200]
        j = r.json()
        assert j.get("start_url") == "/rider"
        assert j.get("scope") == "/rider"
        assert "theme_color" in j and j["theme_color"].startswith("#")
        icons = j.get("icons", [])
        assert len(icons) == 3
        srcs = [i["src"] for i in icons]
        assert any("/api/public/pwa-icon-rider/192" in s for s in srcs)
        assert any("/api/public/pwa-icon-rider/512" in s for s in srcs)
        assert any("/api/public/pwa-icon-rider/512-maskable" in s for s in srcs)

    @pytest.mark.parametrize("size", ["192", "512", "512-maskable"])
    def test_pwa_icon_rider_png(self, size):
        r = requests.get(f"{BASE_URL}/api/public/pwa-icon-rider/{size}", timeout=15)
        assert r.status_code == 200, f"size={size} status={r.status_code}"
        ctype = r.headers.get("content-type", "")
        assert "image/png" in ctype, f"content-type: {ctype}"
        # PNG magic
        assert r.content[:8] == b"\x89PNG\r\n\x1a\n"

    def test_pwa_icon_rider_invalid_404(self):
        r = requests.get(f"{BASE_URL}/api/public/pwa-icon-rider/foo", timeout=15)
        assert r.status_code == 404

    def test_rider_cms_patch_updates_theme_color(self, admin_session):
        new_color = "#1f8a4c"
        # minimal 1x1 red PNG data-URL
        logo = ("data:image/png;base64,"
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
        r = admin_session.patch(f"{BASE_URL}/api/rider-cms",
                                json={"logo_url": logo, "primary_color": new_color},
                                timeout=20)
        assert r.status_code == 200, r.text[:300]
        # verify manifest reflects theme_color
        m = requests.get(f"{BASE_URL}/api/public/manifest-rider.webmanifest", timeout=15).json()
        assert m.get("theme_color", "").lower() == new_color.lower(), m.get("theme_color")
        # icon still valid PNG
        r2 = requests.get(f"{BASE_URL}/api/public/pwa-icon-rider/192", timeout=15)
        assert r2.status_code == 200
        assert r2.content[:8] == b"\x89PNG\r\n\x1a\n"


# ---------------- Reseed women fashion (shoes+bags only) ----------------
class TestReseedWomenFashion:
    def test_reseed_returns_100(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/admin/reseed-women-fashion", timeout=120)
        assert r.status_code == 200, r.text[:300]
        j = r.json()
        assert j.get("inserted") == 100, j
        # universes should be only Chaussures + Sacs
        unis = j.get("universes")
        if unis is not None:
            assert set(unis) == {"Chaussures", "Sacs"}, unis

    def test_public_products_100_unique_images_only_shoes_bags(self):
        # Fetch all; endpoint may paginate
        r = requests.get(f"{BASE_URL}/api/public/products?limit=200", timeout=30)
        assert r.status_code == 200
        data = r.json()
        products = data if isinstance(data, list) else data.get("items") or data.get("products") or []
        assert len(products) == 100, f"got {len(products)} products"
        # Unique images
        imgs = []
        for p in products:
            img = p.get("image") or (p.get("images") or [None])[0]
            assert img, f"product missing image: {p.get('name')}"
            imgs.append(img)
        assert len(set(imgs)) == 100, f"only {len(set(imgs))} unique images out of 100"
        # Categories whitelist
        cats = {p.get("category") for p in products}
        assert cats.issubset(ALLOWED_CATEGORIES), f"unexpected categories: {cats - ALLOWED_CATEGORIES}"
        assert not (cats & CLOTHING_CATEGORIES), f"clothing leaked: {cats & CLOTHING_CATEGORIES}"
        # Brands whitelist
        brands = {p.get("brand") for p in products if p.get("brand")}
        assert brands.issubset(ALLOWED_BRANDS), f"unexpected brands: {brands - ALLOWED_BRANDS}"
