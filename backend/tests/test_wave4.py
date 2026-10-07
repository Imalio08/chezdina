"""Wave 4 — Clients top, public anon top, segments IA."""
import os
import pytest
import requests

def _load_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if "=" in line and not line.strip().startswith("#"):
                    k, v = line.strip().split("=", 1)
                    os.environ.setdefault(k, v)
    except FileNotFoundError:
        pass
_load_env()
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN = {"email": "aouattaraesca@gmail.com", "password": "Admin123!"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE}/api/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, r.text
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---- customers/top ----
def test_customers_top_admin(auth_headers):
    r = requests.get(f"{BASE}/api/customers/top?limit=5", headers=auth_headers, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    assert len(data) <= 5
    if data:
        row = data[0]
        for k in ["rank", "name", "phone", "tier", "loyalty_points", "total_spent", "orders_count"]:
            assert k in row, f"missing {k} in {row}"
        assert row["rank"] == 1
        # Sorted descending by rank_score
        scores = [(d.get("total_spent", 0) or 0) + (d.get("loyalty_points", 0) or 0) * 10 for d in data]
        assert scores == sorted(scores, reverse=True)


def test_public_top_customers_anonymized():
    r = requests.get(f"{BASE}/api/public/account/top-customers?limit=5", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    for row in data:
        assert "phone" not in row, f"phone leaked in public endpoint: {row}"
        for k in ["rank", "name", "tier", "loyalty_points"]:
            assert k in row
        # "Prénom I." format when 2+ name parts
        parts = row["name"].split(" ")
        if len(parts) > 1:
            # second part should be a single letter + "."
            assert len(parts[-1]) == 2 and parts[-1].endswith("."), f"Bad anonymization: {row['name']}"


# ---- segments/ai ----
def test_segments_ai_create(auth_headers):
    body = {"prompt": "Toutes les clientes avec au moins 2 commandes à Cocody"}
    r = requests.post(f"{BASE}/api/segments/ai", json=body, headers=auth_headers, timeout=90)
    assert r.status_code == 200, r.text
    seg = r.json()
    assert seg.get("kind") == "auto"
    assert seg.get("source") == "ai"
    rules = seg.get("rules") or {}
    # Should have parsed at least orders_min or zone
    assert ("orders_min" in rules) or ("zone" in rules), f"rules not parsed: {rules}"
    # cleanup
    sid = seg.get("id")
    if sid:
        requests.delete(f"{BASE}/api/segments/{sid}", headers=auth_headers, timeout=10)


def test_segments_ai_empty_prompt(auth_headers):
    r = requests.post(f"{BASE}/api/segments/ai", json={"prompt": ""}, headers=auth_headers, timeout=90)
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"


def test_segments_ai_requires_auth():
    r = requests.post(f"{BASE}/api/segments/ai", json={"prompt": "test"}, timeout=30)
    assert r.status_code in (401, 403)
