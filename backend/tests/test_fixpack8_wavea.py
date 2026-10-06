"""Fix Pack 8 Wave A — storefront search + mosaic section + branding."""
import os
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://dina-boutique.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "aouattaraesca@gmail.com"
ADMIN_PASSWORD = "Admin123!"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"no token in {r.json()}"
    return tok


@pytest.fixture
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- Public storefront sections ----------

def test_public_sections_includes_mosaic():
    r = requests.get(f"{BASE_URL}/api/public/storefront/sections", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    mosaics = [s for s in data if s.get("type") == "mosaic"]
    assert len(mosaics) >= 1, "expected at least one mosaic section"
    props = mosaics[0].get("props") or {}
    images = props.get("images") or []
    assert isinstance(images, list)
    assert len(images) >= 1
    assert "src" in images[0]


# ---------- Search suggestions ----------

def test_search_suggestions_two_chars():
    r = requests.get(f"{BASE_URL}/api/public/search-suggestions",
                     params={"q": "robe"}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert "products" in d
    assert isinstance(d["products"], list)
    # Likely non-empty on seeded data
    if d["products"]:
        p = d["products"][0]
        assert "id" in p and "name" in p


# ---------- PATCH sections persistence ----------

def test_patch_sections_persists_mosaic(auth_headers):
    # Read current list, inject a mosaic test marker then restore.
    r0 = requests.get(f"{BASE_URL}/api/public/storefront/sections", timeout=15)
    assert r0.status_code == 200
    original = r0.json()

    test_section = {
        "id": "TEST_FP8_mosaic",
        "type": "mosaic",
        "props": {
            "title": "TEST_FP8",
            "images": [
                {"src": "https://example.com/a.jpg", "size": "md", "link": "/boutique"}
            ],
        },
    }
    new_sections = original + [test_section]
    r = requests.patch(f"{BASE_URL}/api/storefront/sections",
                       json={"sections": new_sections},
                       headers=auth_headers, timeout=15)
    assert r.status_code in (200, 204), f"PATCH failed: {r.status_code} {r.text}"

    # Verify persisted
    r2 = requests.get(f"{BASE_URL}/api/public/storefront/sections", timeout=15)
    assert r2.status_code == 200
    found = [s for s in r2.json() if s.get("id") == "TEST_FP8_mosaic"]
    assert len(found) == 1
    assert found[0]["props"]["images"][0]["src"] == "https://example.com/a.jpg"

    # Restore
    requests.patch(f"{BASE_URL}/api/storefront/sections",
                   json={"sections": original},
                   headers=auth_headers, timeout=15)


def test_patch_sections_requires_auth():
    r = requests.patch(f"{BASE_URL}/api/storefront/sections",
                       json={"sections": []}, timeout=15)
    assert r.status_code in (401, 403)
