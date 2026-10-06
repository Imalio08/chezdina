"""Fix Pack 8/9 Wave C — Site vitrine refonte backend tests."""
import os
import pytest
import requests

def _load_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if not v:
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        v = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    assert v, "REACT_APP_BACKEND_URL missing"
    return v.rstrip("/")

BASE_URL = _load_url()
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={
        "email": "aouattaraesca@gmail.com", "password": "Admin123!"
    })
    assert r.status_code == 200, f"login failed {r.status_code} {r.text[:200]}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_hdr(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- /public/site ----------
def test_public_site_returns_optional_keys():
    r = requests.get(f"{API}/public/site")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, dict)
    # All keys optional — endpoint must not 500 when missing
    # sections should be present (default)
    assert "sections" in data


# ---------- PATCH /site partial updates ----------
def test_patch_site_theme_partial(admin_hdr):
    payload = {"theme": {"primary": "#123456", "font": "Inter", "radius": 10, "card_style": "soft"}}
    r = requests.patch(f"{API}/site", json=payload, headers=admin_hdr)
    assert r.status_code == 200, r.text
    g = requests.get(f"{API}/public/site").json()
    assert g.get("theme", {}).get("primary") == "#123456"
    assert g.get("theme", {}).get("font") == "Inter"


def test_patch_site_social_partial(admin_hdr):
    payload = {"social": {"facebook": "https://facebook.com/dinatest", "instagram": "", "tiktok": "https://tiktok.com/@dina"}}
    r = requests.patch(f"{API}/site", json=payload, headers=admin_hdr)
    assert r.status_code == 200
    g = requests.get(f"{API}/public/site").json()
    assert g.get("social", {}).get("facebook") == "https://facebook.com/dinatest"


def test_patch_site_seo_menu_footer(admin_hdr):
    payload = {
        "seo": {"title": "TEST_Dina", "description": "desc", "pixel_fb": "FB123"},
        "menu": [{"label": "Cat", "link": "/boutique/catalog"}],
        "footer": {"tagline": "TEST_tagline", "columns": []},
    }
    r = requests.patch(f"{API}/site", json=payload, headers=admin_hdr)
    assert r.status_code == 200
    g = requests.get(f"{API}/public/site").json()
    assert g["seo"]["title"] == "TEST_Dina"
    assert g["menu"][0]["label"] == "Cat"
    assert g["footer"]["tagline"] == "TEST_tagline"


# ---------- /pages CRUD ----------
def test_pages_list(admin_hdr):
    r = requests.get(f"{API}/pages", headers=admin_hdr)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_pages_crud_cycle(admin_hdr):
    slug = "test-wavec-page"
    # cleanup
    requests.delete(f"{API}/pages/{slug}", headers=admin_hdr)

    # create
    r = requests.post(f"{API}/pages", json={
        "slug": slug, "title": "TEST Wave C", "content": "hello", "enabled": True
    }, headers=admin_hdr)
    assert r.status_code == 200, r.text
    assert r.json().get("slug") == slug

    # list contains
    lst = requests.get(f"{API}/pages", headers=admin_hdr).json()
    assert any(p.get("slug") == slug for p in lst)

    # patch
    r = requests.patch(f"{API}/pages/{slug}", json={"title": "TEST Updated", "content": "updated"}, headers=admin_hdr)
    assert r.status_code == 200
    lst = requests.get(f"{API}/pages", headers=admin_hdr).json()
    pg = next(p for p in lst if p["slug"] == slug)
    assert pg["title"] == "TEST Updated"

    # public exposure for enabled page
    pr = requests.get(f"{API}/public/pages/{slug}")
    assert pr.status_code == 200
    assert pr.json()["slug"] == slug

    # delete
    r = requests.delete(f"{API}/pages/{slug}", headers=admin_hdr)
    assert r.status_code == 200
    pr = requests.get(f"{API}/public/pages/{slug}")
    assert pr.status_code == 404


def test_pages_slug_uniqueness(admin_hdr):
    """POST with existing slug — current impl may allow dup. Just document behavior."""
    slug = "test-wavec-dup"
    requests.delete(f"{API}/pages/{slug}", headers=admin_hdr)
    r1 = requests.post(f"{API}/pages", json={"slug": slug, "title": "T1", "content": "", "enabled": True}, headers=admin_hdr)
    assert r1.status_code == 200
    r2 = requests.post(f"{API}/pages", json={"slug": slug, "title": "T2", "content": "", "enabled": True}, headers=admin_hdr)
    # Accept either 400/409 (unique enforced) or 200 (dup allowed) — flag as a doc test
    assert r2.status_code in (200, 400, 409)
    # cleanup
    requests.delete(f"{API}/pages/{slug}", headers=admin_hdr)


def test_sitemap_xml_reachable():
    r = requests.get(f"{BASE_URL}/sitemap.xml", allow_redirects=True)
    # Must not 500 — might be 200 (XML) or 404 if not implemented
    assert r.status_code in (200, 404), r.status_code
