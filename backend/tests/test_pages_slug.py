"""Verify POST /api/pages enforces slug uniqueness (409) and accepts unique slugs."""
import os, uuid, requests, pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://dina-boutique.preview.emergentagent.com').rstrip('/')

ADMIN = {"email": "aouattaraesca@gmail.com", "password": "Admin123!"}


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, r.text
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def test_list_pages(headers):
    r = requests.get(f"{BASE_URL}/api/pages", headers=headers, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_create_page_unique_then_duplicate_409(headers):
    slug = f"test-{uuid.uuid4().hex[:8]}"
    body = {"slug": slug, "title": "Test Page", "content": "hello", "enabled": True}
    r1 = requests.post(f"{BASE_URL}/api/pages", headers=headers, json=body, timeout=15)
    assert r1.status_code == 200, r1.text
    assert r1.json().get("slug") == slug

    # Duplicate
    r2 = requests.post(f"{BASE_URL}/api/pages", headers=headers, json=body, timeout=15)
    assert r2.status_code == 409, r2.text
    assert "Slug" in (r2.json().get("detail") or "") or "slug" in (r2.json().get("detail") or "").lower()


def test_create_page_duplicate_about_409(headers):
    # 'about' should exist as a seeded page
    body = {"slug": "about", "title": "About dup", "content": "x", "enabled": True}
    r = requests.post(f"{BASE_URL}/api/pages", headers=headers, json=body, timeout=15)
    assert r.status_code == 409, r.text
