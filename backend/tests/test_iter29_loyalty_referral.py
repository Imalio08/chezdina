"""Iter 29 — P4 Finitions bis + P5 scaffold (meta.py).

Covers:
  1. GET /api/health → {ok, service:'chez-dina', v:'2.0'} (routers/meta.py)
  2. GET /api/loyalty/settings → defaults include referral_code_prefix/length/validity_days
  3. PATCH /api/loyalty/settings persists the 3 new fields
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://dina-boutique.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "aouattaraesca@gmail.com"
ADMIN_PASS = "Admin123!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------- P5 scaffold ----------
def test_health_endpoint():
    r = requests.get(f"{BASE_URL}/api/health", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data == {"ok": True, "service": "chez-dina", "v": "2.0"}


# ---------- Loyalty settings — new fields ----------
def test_loyalty_settings_defaults(admin_headers):
    r = requests.get(f"{BASE_URL}/api/loyalty/settings", headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "referral_code_prefix" in d
    assert "referral_code_length" in d
    assert "referral_validity_days" in d
    # Defaults
    assert d["referral_code_prefix"] == "DINA"
    assert d["referral_code_length"] == 4
    assert d["referral_validity_days"] == 90


def test_loyalty_settings_patch_persists(admin_headers):
    # Read current to preserve
    cur = requests.get(f"{BASE_URL}/api/loyalty/settings", headers=admin_headers, timeout=15).json()
    payload = {
        "points_per_fcfa": cur.get("points_per_fcfa", 500),
        "tiers": cur.get("tiers", []),
        "referral_bonus_parrain": cur.get("referral_bonus_parrain", 1000),
        "referral_bonus_filleul": cur.get("referral_bonus_filleul", 500),
        "enabled": cur.get("enabled", True),
        "referral_code_prefix": "TEST",
        "referral_code_length": 5,
        "referral_validity_days": 60,
    }
    r = requests.patch(f"{BASE_URL}/api/loyalty/settings", json=payload, headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    g = requests.get(f"{BASE_URL}/api/loyalty/settings", headers=admin_headers, timeout=15).json()
    assert g["referral_code_prefix"] == "TEST"
    assert g["referral_code_length"] == 5
    assert g["referral_validity_days"] == 60

    # Restore
    payload["referral_code_prefix"] = cur.get("referral_code_prefix", "DINA")
    payload["referral_code_length"] = cur.get("referral_code_length", 4)
    payload["referral_validity_days"] = cur.get("referral_validity_days", 90)
    requests.patch(f"{BASE_URL}/api/loyalty/settings", json=payload, headers=admin_headers, timeout=15)
