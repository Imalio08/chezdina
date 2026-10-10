"""Tests for /api/admin/sync/* (export-token, export, import)."""
import os
import gzip
import pytest
import requests
from bson import json_util

def _load_backend_url():
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
    return (v or "").rstrip("/")

BASE_URL = _load_backend_url()


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password, "mark_attendance": False}, timeout=30)
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login("aouattaraesca@gmail.com", "Admin123!")


@pytest.fixture(scope="module")
def manager_token():
    return _login("manager.cocody@dinastore.ci", "Manager123!")


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# --- export-token ---
def test_export_token_admin_ok(admin_token):
    r = requests.post(f"{BASE_URL}/api/admin/sync/export-token", headers=_h(admin_token), timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 20
    assert "expires_at" in data


def test_export_token_manager_forbidden(manager_token):
    r = requests.post(f"{BASE_URL}/api/admin/sync/export-token", headers=_h(manager_token), timeout=30)
    assert r.status_code == 403, r.text


def test_export_token_unauth():
    r = requests.post(f"{BASE_URL}/api/admin/sync/export-token", timeout=30)
    assert r.status_code in (401, 403)


# --- export ---
def test_export_bad_token():
    r = requests.get(f"{BASE_URL}/api/admin/sync/export", params={"token": "nope-not-a-token"}, timeout=30)
    assert r.status_code == 403


def test_export_valid_token_returns_gzip_dump(admin_token):
    tr = requests.post(f"{BASE_URL}/api/admin/sync/export-token", headers=_h(admin_token), timeout=30).json()
    token = tr["token"]
    r = requests.get(f"{BASE_URL}/api/admin/sync/export", params={"token": token}, timeout=120)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("application/gzip")
    raw = gzip.decompress(r.content)
    dump = json_util.loads(raw.decode())
    assert isinstance(dump, dict)
    assert "products" in dump and "users" in dump
    assert "sync_tokens" not in dump  # SKIP respected
    assert len(dump["products"]) > 0
    assert len(dump["users"]) > 0


# --- import ---
def test_import_wrong_pin(admin_token):
    tr = requests.post(f"{BASE_URL}/api/admin/sync/export-token", headers=_h(admin_token), timeout=30).json()
    r = requests.post(f"{BASE_URL}/api/admin/sync/import", headers=_h(admin_token), json={
        "source_url": BASE_URL, "token": tr["token"], "pin": "0000"
    }, timeout=30)
    assert r.status_code == 403
    assert "PIN" in r.json().get("detail", "")


def test_import_http_rejected(admin_token):
    r = requests.post(f"{BASE_URL}/api/admin/sync/import", headers=_h(admin_token), json={
        "source_url": "http://insecure.example.com", "token": "x", "pin": "1234"
    }, timeout=30)
    assert r.status_code == 400


def test_import_empty_source_rejected(admin_token):
    r = requests.post(f"{BASE_URL}/api/admin/sync/import", headers=_h(admin_token), json={
        "source_url": "", "token": "x", "pin": "1234"
    }, timeout=30)
    assert r.status_code == 400


def test_import_bad_token(admin_token):
    r = requests.post(f"{BASE_URL}/api/admin/sync/import", headers=_h(admin_token), json={
        "source_url": BASE_URL, "token": "invalid-token-xyz", "pin": "1234"
    }, timeout=60)
    assert r.status_code == 400
    assert "403" in r.json().get("detail", "")


def test_import_self_sync_ok_and_app_still_works(admin_token):
    # Generate token on source (self)
    tr = requests.post(f"{BASE_URL}/api/admin/sync/export-token", headers=_h(admin_token), timeout=30).json()
    r = requests.post(f"{BASE_URL}/api/admin/sync/import", headers=_h(admin_token), json={
        "source_url": BASE_URL, "token": tr["token"], "pin": "1234"
    }, timeout=180)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["ok"] is True
    assert data["counts"].get("products") == 38, f"products={data['counts'].get('products')}"
    assert data["counts"].get("users") == 11, f"users={data['counts'].get('users')}"

    # App still works - re-login (token likely invalidated after import)
    tok2 = _login("aouattaraesca@gmail.com", "Admin123!")
    prods = requests.get(f"{BASE_URL}/api/products", headers=_h(tok2), timeout=30)
    assert prods.status_code == 200
    plist = prods.json()
    plist = plist if isinstance(plist, list) else plist.get("items", plist.get("products", []))
    assert len(plist) == 38, f"products listed: {len(plist)}"

    orders = requests.get(f"{BASE_URL}/api/orders", headers=_h(tok2), timeout=30)
    assert orders.status_code == 200
    olist = orders.json()
    olist = olist if isinstance(olist, list) else olist.get("items", olist.get("orders", []))
    assert len(olist) > 0, "orders should still be present"
