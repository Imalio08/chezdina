"""
Iter46 P5 refactor regression — ensure extracting attendance routes into
routers/attendance.py and shared deps into deps.py didn't change any
response shape or RBAC behavior.
"""
import os
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")

CREDS = {
    "admin":   ("aouattaraesca@gmail.com", "Admin123!"),
    "manager": ("manager.cocody@dinastore.ci", "Manager123!"),
    "sales":   ("agent1@dinastore.ci", "Agent123!"),
    "cm":      ("cm@dinastore.ci", "Cm123!"),
    "rider":   ("rider1@dinastore.ci", "Rider123!"),
}


def _login(role):
    email, pwd = CREDS[role]
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": pwd}, timeout=15)
    assert r.status_code == 200, f"Login {role} failed: {r.status_code} {r.text}"
    token = r.json().get("token") or r.json().get("access_token")
    assert token, f"No token in login response: {r.json()}"
    return token


@pytest.fixture(scope="session")
def tokens():
    return {k: _login(k) for k in CREDS}


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


# ------------------- Attendance (now in routers/attendance.py) ------------------- #
class TestAttendanceRouter:
    def test_attendance_me(self, tokens):
        r = requests.get(f"{BASE}/api/attendance/me", headers=H(tokens["admin"]))
        assert r.status_code == 200
        d = r.json()
        assert set(d.keys()) >= {"checked_in", "arrival", "departure"}
        assert isinstance(d["checked_in"], bool)

    def test_check_in_requires_selfie(self, tokens):
        r = requests.post(f"{BASE}/api/attendance/check-in", headers=H(tokens["rider"]), json={"kind": "arrival"})
        assert r.status_code == 400
        assert "Selfie" in r.text or "selfie" in r.text.lower()

    def test_check_in_with_selfie(self, tokens):
        # use manager to avoid dirtying rider data too much; small b64 payload
        selfie_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAeImBZsAAAAASUVORK5CYII="
        r = requests.post(
            f"{BASE}/api/attendance/check-in",
            headers=H(tokens["manager"]),
            json={"kind": "arrival", "selfie": selfie_b64, "method": "phone"},
        )
        # 200 ok, or 409 if already checked-in today (idempotency previously). Accept both.
        assert r.status_code in (200, 409), r.text
        if r.status_code == 200:
            d = r.json()
            assert d.get("ok") is True
            assert "late" in d and "at" in d

    def test_today_admin_ok(self, tokens):
        r = requests.get(f"{BASE}/api/attendance/today", headers=H(tokens["admin"]))
        assert r.status_code == 200
        d = r.json()
        assert set(d.keys()) >= {"today", "not_checked_in", "present_count", "total_employees"}
        assert isinstance(d["today"], list)
        assert isinstance(d["not_checked_in"], list)

    def test_today_manager_ok(self, tokens):
        r = requests.get(f"{BASE}/api/attendance/today", headers=H(tokens["manager"]))
        assert r.status_code == 200

    def test_today_sales_forbidden(self, tokens):
        r = requests.get(f"{BASE}/api/attendance/today", headers=H(tokens["sales"]))
        assert r.status_code == 403

    def test_today_cm_forbidden(self, tokens):
        r = requests.get(f"{BASE}/api/attendance/today", headers=H(tokens["cm"]))
        assert r.status_code == 403

    def test_all_stats_admin(self, tokens):
        r = requests.get(f"{BASE}/api/attendance/all-stats?days=30", headers=H(tokens["admin"]))
        assert r.status_code == 200
        d = r.json()
        assert d.get("period_days") == 30
        assert isinstance(d.get("rows"), list)
        if d["rows"]:
            row = d["rows"][0]
            assert set(row.keys()) >= {"user_id", "name", "role", "worked_days", "absences", "late_count", "late_min_total", "punctuality_pct"}

    def test_all_stats_sales_forbidden(self, tokens):
        r = requests.get(f"{BASE}/api/attendance/all-stats", headers=H(tokens["sales"]))
        assert r.status_code == 403

    def test_calendar(self, tokens):
        # pick first employee
        r = requests.get(f"{BASE}/api/attendance/all-stats?days=7", headers=H(tokens["admin"]))
        rows = r.json().get("rows") or []
        if not rows:
            pytest.skip("No employees to test calendar")
        eid = rows[0]["user_id"]
        r = requests.get(f"{BASE}/api/attendance/calendar/{eid}?month=2026-01", headers=H(tokens["admin"]))
        assert r.status_code == 200
        d = r.json()
        assert d.get("month") == "2026-01"
        assert "days" in d and isinstance(d["days"], dict)

    def test_stats_per_employee(self, tokens):
        r = requests.get(f"{BASE}/api/attendance/all-stats?days=7", headers=H(tokens["admin"]))
        rows = r.json().get("rows") or []
        if not rows:
            pytest.skip("No employees")
        eid = rows[0]["user_id"]
        r = requests.get(f"{BASE}/api/attendance/stats/{eid}?days=30", headers=H(tokens["admin"]))
        assert r.status_code == 200
        d = r.json()
        assert set(d.keys()) >= {"worked_days", "late_count", "late_min_total", "outside_count", "punctuality_pct", "avg_arrival"}


# ------------------- Business config PATCH (RBAC) ------------------- #
class TestBusinessPatchRBAC:
    def test_attendance_config_sales_forbidden(self, tokens):
        r = requests.patch(f"{BASE}/api/business/attendance-config", headers=H(tokens["sales"]), json={"enabled": True})
        assert r.status_code == 403

    def test_attendance_config_manager_forbidden(self, tokens):
        r = requests.patch(f"{BASE}/api/business/attendance-config", headers=H(tokens["manager"]), json={"enabled": True})
        assert r.status_code == 403

    def test_attendance_config_admin_ok_and_persist(self, tokens):
        payload = {"enabled": True, "enabled_roles": ["manager", "sales", "stock_keeper", "community_manager", "rider"]}
        r = requests.patch(f"{BASE}/api/business/attendance-config", headers=H(tokens["admin"]), json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True
        assert d["attendance_config"]["enabled"] is True
        assert set(d["attendance_config"]["enabled_roles"]) == set(payload["enabled_roles"])
        # verify via GET /api/business
        g = requests.get(f"{BASE}/api/business", headers=H(tokens["admin"]))
        assert g.status_code == 200
        cfg = g.json().get("attendance_config") or {}
        assert cfg.get("enabled") is True
        assert set(cfg.get("enabled_roles") or []) == set(payload["enabled_roles"])

    def test_working_hours_admin(self, tokens):
        r = requests.patch(f"{BASE}/api/business/working-hours", headers=H(tokens["admin"]), json={"working_hours": {"manager": {"open": "08:00", "tolerance_min": 10}}})
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_geofence_admin(self, tokens):
        r = requests.patch(f"{BASE}/api/business/geofence", headers=H(tokens["admin"]), json={"lat": 5.3, "lng": -4.0, "radius_m": 150})
        assert r.status_code == 200
        assert r.json()["geofence"]["radius_m"] == 150


# ------------------- Non-attendance regression (still in server.py) ------------------- #
class TestServerCore:
    def test_me(self, tokens):
        r = requests.get(f"{BASE}/api/auth/me", headers=H(tokens["admin"]))
        assert r.status_code == 200
        assert r.json().get("role") == "admin"

    def test_login_all_roles(self, tokens):
        # tokens fixture already proves this; add quick sanity
        for role in CREDS:
            assert tokens[role]

    def test_products_auth(self, tokens):
        r = requests.get(f"{BASE}/api/products", headers=H(tokens["admin"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_public_products(self):
        r = requests.get(f"{BASE}/api/public/products")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_orders(self, tokens):
        r = requests.get(f"{BASE}/api/orders", headers=H(tokens["admin"]))
        assert r.status_code == 200

    def test_customers(self, tokens):
        r = requests.get(f"{BASE}/api/customers", headers=H(tokens["admin"]))
        assert r.status_code == 200

    def test_business(self, tokens):
        r = requests.get(f"{BASE}/api/business", headers=H(tokens["admin"]))
        assert r.status_code == 200

    def test_public_site(self):
        r = requests.get(f"{BASE}/api/public/site")
        assert r.status_code == 200

    def test_public_business(self):
        r = requests.get(f"{BASE}/api/public/business")
        assert r.status_code == 200
