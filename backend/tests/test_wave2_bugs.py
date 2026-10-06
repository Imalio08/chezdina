"""Wave 2 backend tests: reject-handover, waitlist notify, out-of-catalog with channel."""
import os
import pytest
import requests
from datetime import datetime, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": "aouattaraesca@gmail.com", "password": "Admin123!"})
    assert r.status_code == 200, r.text
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="session")
def manager_token():
    r = requests.post(f"{API}/auth/login", json={"email": "manager.cocody@dinastore.ci", "password": "Manager123!"})
    assert r.status_code == 200, r.text
    return r.json().get("token") or r.json().get("access_token")


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- Out-of-catalog (public) ----------
class TestOutOfCatalog:
    def test_create_with_channel_search(self, admin_token):
        r = requests.post(f"{API}/public/out-of-catalog",
                          json={"keyword": "TEST_xyz_wave2", "customer_phone": "+22507000011", "channel": "search"})
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        g = requests.get(f"{API}/out-of-catalog", headers=h(admin_token))
        assert g.status_code == 200
        data = g.json()
        kw = next((k for k in data.get("keywords", []) if k["keyword"] == "test_xyz_wave2"), None)
        assert kw is not None, "keyword missing"
        assert kw["requests"][0].get("channel") == "search"


# ---------- Reject handover ----------
class TestRejectHandover:
    @pytest.fixture
    def pending_session(self, admin_token, manager_token):
        # Try to find existing pending_validation session
        r = requests.get(f"{API}/cash-sessions", headers=h(admin_token))
        if r.status_code == 200:
            sessions = r.json() if isinstance(r.json(), list) else r.json().get("sessions", [])
            pending = next((s for s in sessions if s.get("status") == "pending_validation"), None)
            if pending:
                return pending["id"]

        # Create via manager: open then declare handover
        o = requests.post(f"{API}/cash-sessions/open", headers=h(manager_token),
                          json={"opening_amount": 10000})
        if o.status_code != 200:
            # Maybe already open — try to find current manager session
            r2 = requests.get(f"{API}/cash-sessions", headers=h(manager_token))
            sess_list = r2.json() if isinstance(r2.json(), list) else r2.json().get("sessions", [])
            open_s = next((s for s in sess_list if not s.get("closed")), None)
            if not open_s:
                pytest.skip(f"Cannot open session: {o.text}")
            sid = open_s["id"]
        else:
            sid = o.json().get("id") or o.json().get("session_id") or o.json().get("session", {}).get("id")

        hv = requests.post(f"{API}/cash-sessions/{sid}/declare-handover", headers=h(manager_token),
                           json={"amount": 10000, "note": "test handover"})
        if hv.status_code != 200:
            pytest.skip(f"Cannot declare handover: {hv.text}")
        return sid

    def test_reject_empty_reason(self, admin_token, pending_session):
        r = requests.post(f"{API}/cash-sessions/{pending_session}/reject-handover",
                          headers=h(admin_token), json={"reason": ""})
        assert r.status_code == 400, r.text

    def test_reject_valid(self, admin_token, pending_session):
        r = requests.post(f"{API}/cash-sessions/{pending_session}/reject-handover",
                          headers=h(admin_token), json={"reason": "test motif de rejet"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("reason") == "test motif de rejet"

        # Verify status rejected via listing
        g = requests.get(f"{API}/cash-sessions", headers=h(admin_token))
        sessions = g.json() if isinstance(g.json(), list) else g.json().get("sessions", [])
        s = next((x for x in sessions if x.get("id") == pending_session), None)
        assert s is not None
        assert s.get("status") == "rejected"
        assert s.get("rejection_reason") == "test motif de rejet"


# ---------- Waitlist notify ----------
class TestWaitlistNotify:
    @pytest.fixture
    def waitlist_entry(self, admin_token):
        # Grab any pending waitlist id from grouped
        g = requests.get(f"{API}/waitlist/grouped", headers=h(admin_token))
        if g.status_code == 200:
            for grp in g.json().get("groups", []):
                if grp.get("customers"):
                    return grp["customers"][0]["id"]
        pytest.skip("no waitlist entry available")

    def test_notify_with_body(self, admin_token, waitlist_entry):
        starts = datetime.utcnow().isoformat()
        ends = (datetime.utcnow() + timedelta(days=3)).isoformat()
        r = requests.post(f"{API}/waitlist/{waitlist_entry}/notify",
                          headers=h(admin_token),
                          json={"channels": ["whatsapp", "popup"], "message": "test",
                                "offer_type": "pct", "offer_value": 10,
                                "starts_at": starts, "ends_at": ends})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert "notification_id" in body
