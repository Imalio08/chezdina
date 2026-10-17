# Iteration 91: per-user archive for rider & customer conversations + console archive
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


def H(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def rider_tok():
    r = requests.post(f"{API}/auth/rider-login-pin", json={"pin": "5555"}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"rider login failed {r.status_code}")
    return r.json()["token"]


@pytest.fixture(scope="module")
def rider2_tok():
    r = requests.post(f"{API}/auth/rider-login-pin", json={"pin": "5556"}, timeout=20)
    if r.status_code != 200:
        pytest.skip("rider2 login failed")
    return r.json()["token"]


@pytest.fixture(scope="module")
def cust_tok():
    r = requests.post(f"{API}/public/customer-login-code", json={"phone": "+225 07 85 55 58 88", "code": "386436"}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"customer login failed {r.status_code}")
    return r.json()["token"]


@pytest.fixture(scope="module")
def other_cust_tok():
    r = requests.post(f"{API}/public/customer-login-code", json={"phone": "+225 07 48 11 22 01", "code": "202601"}, timeout=20)
    if r.status_code != 200:
        pytest.skip("other customer login failed")
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_tok():
    r = requests.post(f"{API}/auth/login", json={"email": "aouattaraesca@gmail.com", "password": "Admin123!"}, timeout=20)
    if r.status_code != 200:
        pytest.skip("admin login failed")
    return r.json().get("token") or r.json().get("access_token")


# Rider archive
class TestRiderArchive:
    def test_list_has_archived_flag(self, rider_tok):
        r = requests.get(f"{API}/rider/conversations", headers=H(rider_tok), timeout=20)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list) and len(rows) > 0
        assert all("archived" in x and isinstance(x["archived"], bool) for x in rows)

    def test_archive_unarchive_roundtrip(self, rider_tok):
        rows = requests.get(f"{API}/rider/conversations", headers=H(rider_tok), timeout=20).json()
        conv = next(x for x in rows if not x["archived"])
        cid = conv["id"]
        try:
            r = requests.patch(f"{API}/rider/conversations/{cid}/archive", json={"archived": True}, headers=H(rider_tok), timeout=20)
            assert r.status_code == 200 and r.json()["archived"] is True
            rows2 = requests.get(f"{API}/rider/conversations", headers=H(rider_tok), timeout=20).json()
            assert next(x for x in rows2 if x["id"] == cid)["archived"] is True
            # idempotent
            r = requests.patch(f"{API}/rider/conversations/{cid}/archive", json={"archived": True}, headers=H(rider_tok), timeout=20)
            assert r.status_code == 200
        finally:
            r = requests.patch(f"{API}/rider/conversations/{cid}/archive", json={"archived": False}, headers=H(rider_tok), timeout=20)
        assert r.status_code == 200 and r.json()["archived"] is False
        rows3 = requests.get(f"{API}/rider/conversations", headers=H(rider_tok), timeout=20).json()
        assert next(x for x in rows3 if x["id"] == cid)["archived"] is False

    def test_archive_not_participant_404(self, rider_tok, rider2_tok):
        rows = requests.get(f"{API}/rider/conversations", headers=H(rider_tok), timeout=20).json()
        rows2 = requests.get(f"{API}/rider/conversations", headers=H(rider2_tok), timeout=20).json()
        ids2 = {x["id"] for x in rows2}
        foreign = next((x["id"] for x in rows if x["id"] not in ids2), None)
        if not foreign:
            pytest.skip("no foreign conversation")
        r = requests.patch(f"{API}/rider/conversations/{foreign}/archive", json={"archived": True}, headers=H(rider2_tok), timeout=20)
        assert r.status_code == 404

    def test_archive_unknown_404(self, rider_tok):
        r = requests.patch(f"{API}/rider/conversations/nope-xyz/archive", json={"archived": True}, headers=H(rider_tok), timeout=20)
        assert r.status_code == 404

    def test_archive_no_auth(self):
        r = requests.patch(f"{API}/rider/conversations/nope-xyz/archive", json={"archived": True}, timeout=20)
        assert r.status_code in (401, 403)


# Customer archive
class TestCustomerArchive:
    def test_threads_archived_flag(self, cust_tok):
        r = requests.get(f"{API}/public/account/threads", headers=H(cust_tok), timeout=20)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list) and len(rows) > 0
        assert all(isinstance(x.get("archived"), bool) for x in rows)

    def test_roundtrip(self, cust_tok):
        rows = requests.get(f"{API}/public/account/threads", headers=H(cust_tok), timeout=20).json()
        cid = next(x for x in rows if not x["archived"])["id"]
        try:
            r = requests.patch(f"{API}/public/account/threads/{cid}/archive", json={"archived": True}, headers=H(cust_tok), timeout=20)
            assert r.status_code == 200 and r.json()["archived"] is True
            rows2 = requests.get(f"{API}/public/account/threads", headers=H(cust_tok), timeout=20).json()
            assert next(x for x in rows2 if x["id"] == cid)["archived"] is True
        finally:
            r = requests.patch(f"{API}/public/account/threads/{cid}/archive", json={"archived": False}, headers=H(cust_tok), timeout=20)
        assert r.status_code == 200
        rows3 = requests.get(f"{API}/public/account/threads", headers=H(cust_tok), timeout=20).json()
        assert next(x for x in rows3 if x["id"] == cid)["archived"] is False

    def test_other_customer_404(self, cust_tok, other_cust_tok):
        rows = requests.get(f"{API}/public/account/threads", headers=H(cust_tok), timeout=20).json()
        cid = rows[0]["id"]
        r = requests.patch(f"{API}/public/account/threads/{cid}/archive", json={"archived": True}, headers=H(other_cust_tok), timeout=20)
        assert r.status_code == 404

    def test_rider_token_rejected_on_customer_route(self, rider_tok):
        r = requests.patch(f"{API}/public/account/threads/x/archive", json={"archived": True}, headers=H(rider_tok), timeout=20)
        assert r.status_code in (401, 403, 404)

    def test_customer_archive_does_not_affect_rider(self, cust_tok, rider_tok):
        """Per-user: archiving on customer side must not archive for rider."""
        rows = requests.get(f"{API}/public/account/threads", headers=H(cust_tok), timeout=20).json()
        rrows = requests.get(f"{API}/rider/conversations", headers=H(rider_tok), timeout=20).json()
        rids = {x["id"]: x for x in rrows}
        shared = next((x["id"] for x in rows if x["id"] in rids and not x["archived"] and not rids[x["id"]]["archived"]), None)
        if not shared:
            pytest.skip("no shared conv")
        try:
            requests.patch(f"{API}/public/account/threads/{shared}/archive", json={"archived": True}, headers=H(cust_tok), timeout=20)
            rr = requests.get(f"{API}/rider/conversations", headers=H(rider_tok), timeout=20).json()
            assert next(x for x in rr if x["id"] == shared)["archived"] is False
        finally:
            requests.patch(f"{API}/public/account/threads/{shared}/archive", json={"archived": False}, headers=H(cust_tok), timeout=20)


# Console archive (global flag)
class TestConsoleArchive:
    def test_console_archive_toggle(self, admin_tok):
        r = requests.get(f"{API}/messages/conversations", headers=H(admin_tok), timeout=20)
        assert r.status_code == 200
        rows = r.json()
        rows = rows if isinstance(rows, list) else rows.get("items", [])
        if not rows:
            pytest.skip("no conversations")
        cid = rows[0]["id"]
        try:
            r = requests.patch(f"{API}/messages/conversations/{cid}/archive", json={"archived": True}, headers=H(admin_tok), timeout=20)
            assert r.status_code == 200 and r.json()["archived"] is True
            arch = requests.get(f"{API}/messages/conversations?archived=true", headers=H(admin_tok), timeout=20).json()
            arch = arch if isinstance(arch, list) else arch.get("items", [])
            assert any(x["id"] == cid for x in arch)
        finally:
            r = requests.patch(f"{API}/messages/conversations/{cid}/archive", json={"archived": False}, headers=H(admin_tok), timeout=20)
        assert r.json()["archived"] is False
