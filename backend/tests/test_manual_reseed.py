"""Tests for POST /api/manual/reseed and GET /api/manual/modules/{n} (iteration 31)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://dina-boutique.preview.emergentagent.com").rstrip("/")

ADMIN = {"email": "aouattaraesca@gmail.com", "password": "Admin123!"}
SALES = {"email": "agent1@dinastore.ci", "password": "Agent123!"}
RIDER = {"email": "rider1@dinastore.ci", "password": "Rider123!"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    tok = r.json().get("access_token") or r.json().get("token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def admin_client():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def sales_client():
    return _login(SALES)


@pytest.fixture(scope="module")
def rider_client():
    return _login(RIDER)


def test_reseed_as_admin(admin_client):
    r = admin_client.post(f"{BASE_URL}/api/manual/reseed", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("ok") is True
    assert data.get("updated") == 4


def test_reseed_idempotent(admin_client):
    r = admin_client.post(f"{BASE_URL}/api/manual/reseed", timeout=30)
    assert r.status_code == 200
    assert r.json().get("updated") == 4


def test_reseed_forbidden_for_sales(sales_client):
    r = sales_client.post(f"{BASE_URL}/api/manual/reseed", timeout=30)
    assert r.status_code == 403


def test_module_2_structure(admin_client):
    r = admin_client.get(f"{BASE_URL}/api/manual/modules/2", timeout=30)
    assert r.status_code == 200
    m = r.json()
    assert "caisse" in m.get("title", "").lower() or "vente" in m.get("title","").lower()
    sections = m.get("sections", [])
    assert len(sections) >= 3
    headings = [s.get("heading", "").lower() for s in sections]
    assert any("ouvrir" in h and "session" in h for h in headings), headings
    assert any("encaisser" in h for h in headings), headings
    assert any("clôtur" in h or "cloture" in h or "cl" in h for h in headings), headings

    # Collect block types + annotated screens
    all_blocks = [b for s in sections for b in s.get("blocks", [])]
    types = {b.get("type") for b in all_blocks}
    assert "annotated" in types, types
    assert "steps" in types, types
    assert "faq" in types or "memo" in types, types

    annotated = [b for b in all_blocks if b.get("type") == "annotated"]
    screens = {b.get("screen") for b in annotated}
    assert screens & {"cash_session", "pos_cart"}, screens
    # callouts validation
    for b in annotated:
        assert isinstance(b.get("callouts"), list) and len(b["callouts"]) > 0


def test_module_4_glossary_and_faq(admin_client):
    r = admin_client.get(f"{BASE_URL}/api/manual/modules/4", timeout=30)
    assert r.status_code == 200
    m = r.json()
    all_blocks = [b for s in m.get("sections", []) for b in s.get("blocks", [])]
    types = {b.get("type") for b in all_blocks}
    assert "glossary" in types, types
    assert "faq" in types, types
    glossary = [b for b in all_blocks if b.get("type") == "glossary"][0]
    assert len(glossary.get("items", [])) >= 6
    faq = [b for b in all_blocks if b.get("type") == "faq"][0]
    assert len(faq.get("items", [])) >= 6


def test_module_4_visible_to_rider(rider_client):
    r = rider_client.get(f"{BASE_URL}/api/manual/modules/4", timeout=30)
    assert r.status_code == 200
    m = r.json()
    # Rider should see module (roles filter allows rider or module is open)
    assert m.get("number") == 4
