"""Pack 9 — Manuel d'utilisation backend tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback: read from frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

ADMIN = {"email": "aouattaraesca@gmail.com", "password": "Admin123!"}
RIDER = {"email": "rider1@dinastore.ci", "password": "Rider123!"}


def login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {login(**ADMIN)}"}


@pytest.fixture(scope="module")
def rider_headers():
    return {"Authorization": f"Bearer {login(**RIDER)}"}


# ---------- Modules list ----------
def test_list_all_modules(admin_headers):
    r = requests.get(f"{BASE_URL}/api/manual/modules", headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) == 16, f"Expected 16 modules, got {len(data)}"
    numbers = sorted(m["number"] for m in data)
    assert numbers == list(range(1, 17))
    for m in data:
        assert "progress" in m
        assert "done" in m["progress"] and "total" in m["progress"]


def test_list_modules_by_role_rider(admin_headers):
    r = requests.get(f"{BASE_URL}/api/manual/modules?role=rider", headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    nums = sorted(m["number"] for m in data)
    assert nums == [1, 2, 5, 16], f"Expected rider modules [1,2,5,16] got {nums}"


# ---------- Module detail ----------
def test_module_detail_has_read_flag(admin_headers):
    r = requests.get(f"{BASE_URL}/api/manual/modules/3", headers=admin_headers)
    assert r.status_code == 200
    m = r.json()
    assert m["number"] == 3
    assert m["title"].startswith("Caisse")
    for s in m["sections"]:
        assert "read" in s


def test_module_detail_404():
    r = requests.get(f"{BASE_URL}/api/manual/modules/999",
                     headers={"Authorization": f"Bearer {login(**ADMIN)}"})
    assert r.status_code == 404


# ---------- Progress ----------
def test_mark_read_and_get_progress(admin_headers):
    body = {"module_number": 1, "section_id": "s1"}
    r = requests.post(f"{BASE_URL}/api/manual/progress", json=body, headers=admin_headers)
    assert r.status_code == 200
    assert r.json().get("ok") is True

    g = requests.get(f"{BASE_URL}/api/manual/progress", headers=admin_headers)
    assert g.status_code == 200
    reads = g.json().get("read_sections", [])
    assert "1:s1" in reads

    # read flag should be reflected in module detail
    d = requests.get(f"{BASE_URL}/api/manual/modules/1", headers=admin_headers)
    sections = {s["id"]: s for s in d.json()["sections"]}
    assert sections["s1"]["read"] is True


def test_progress_missing_fields(admin_headers):
    r = requests.post(f"{BASE_URL}/api/manual/progress", json={"module_number": 1}, headers=admin_headers)
    assert r.status_code == 400


# ---------- Search ----------
def test_search_livraison(admin_headers):
    r = requests.get(f"{BASE_URL}/api/manual/search?q=livraison", headers=admin_headers)
    assert r.status_code == 200
    hits = r.json()
    assert isinstance(hits, list)
    assert len(hits) >= 2
    assert all("module_number" in h and "title" in h for h in hits)


def test_search_too_short(admin_headers):
    r = requests.get(f"{BASE_URL}/api/manual/search?q=a", headers=admin_headers)
    assert r.status_code == 200
    assert r.json() == []


# ---------- module-for-path ----------
def test_module_for_path_pos(admin_headers):
    r = requests.get(f"{BASE_URL}/api/manual/module-for-path?path=/console/pos", headers=admin_headers)
    assert r.status_code == 200
    m = r.json()
    assert m.get("number") == 3


def test_module_for_path_none(admin_headers):
    r = requests.get(f"{BASE_URL}/api/manual/module-for-path?path=/unknown/zzz", headers=admin_headers)
    assert r.status_code == 200
    assert r.json() == {}


# ---------- PATCH module (role-protected) ----------
def test_patch_module_admin(admin_headers):
    body = {"description": "TEST_desc_pack9"}
    r = requests.patch(f"{BASE_URL}/api/manual/modules/16", json=body, headers=admin_headers)
    assert r.status_code == 200
    assert r.json().get("ok") is True
    # verify
    d = requests.get(f"{BASE_URL}/api/manual/modules/16", headers=admin_headers)
    assert d.json()["description"] == "TEST_desc_pack9"
    # restore original
    requests.patch(f"{BASE_URL}/api/manual/modules/16",
                   json={"description": "App livreur : journée, remise, preuve, score"},
                   headers=admin_headers)


def test_patch_module_rider_forbidden(rider_headers):
    r = requests.patch(f"{BASE_URL}/api/manual/modules/16",
                       json={"description": "nope"}, headers=rider_headers)
    assert r.status_code in (401, 403)
