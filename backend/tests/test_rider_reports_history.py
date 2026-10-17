# Run with: pytest -n 0 (module fixture shared across classes)
# Rider reports (Signaler un problème), today counts, history and read-only order detail
import os
import base64
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP" + "A" * 50


def login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"Authorization": f"Bearer {d['token']}"}, d["user"]


@pytest.fixture(scope="module")
def ctx():
    a, _ = login("aouattaraesca@gmail.com", "Admin123!")
    m, mu = login("manager.cocody@dinastore.ci", "Manager123!")
    mc0 = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    before = {x["id"] for x in mc0.attendance.find({"user_id": mu["id"]}, {"id": 1})}
    if mu.get("punch_required"):
        sel = "data:image/jpeg;base64," + base64.b64encode(os.urandom(1500)).decode()
        requests.post(f"{API}/attendance/check-in", json={"kind": "arrival", "selfie": sel}, headers=m)
    r1, r1u = login("rider1@dinastore.ci", "Rider123!")
    r2, r2u = login("rider2@dinastore.ci", "Rider123!")
    c = {"a": a, "m": m, "r1": r1, "r1u": r1u, "r2": r2, "r2u": r2u, "ids": []}
    yield c
    # cleanup
    mc0.attendance.delete_many({"user_id": mu["id"], "id": {"$nin": list(before)}})
    mc = MongoClient(os.environ["MONGO_URL"])
    db = mc[os.environ["DB_NAME"]]
    db.rider_reports.delete_many({"details": {"$regex": "^TEST_"}})
    db.notifications.delete_many({"type": "rider_report", "msg": {"$regex": "TEST_"}})
    db.user_notifications.delete_many({"msg": {"$regex": "TEST_"}})


def _rider_orders(h):
    r = requests.get(f"{API}/riders/me/history?days=365", headers=h)
    assert r.status_code == 200
    return [o for d in r.json() for o in d["orders_detail"]]


# --- POST /rider/report
class TestReportCreate:
    def test_create_full(self, ctx):
        orders = _rider_orders(ctx["r1"])
        oid = orders[0]["id"] if orders else None
        body = {"kind": "panne_moto", "urgency": "haute", "details": "TEST_panne moteur", "photo": PHOTO,
                "lat": 5.35, "lng": -3.99, "acc": 12, "order_id": oid}
        r = requests.post(f"{API}/rider/report", json=body, headers=ctx["r1"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "nouveau" and d["kind"] == "panne_moto" and d["urgency"] == "haute"
        assert d["location"]["lat"] == 5.35 and d["photo"].startswith("data:image/")
        if oid:
            assert d["order_id"] == oid and d["order_code"]
        assert "_id" not in d
        ctx["ids"].append(d["id"])

    def test_invalid_kind_defaults_autre(self, ctx):
        r = requests.post(f"{API}/rider/report", json={"kind": "xyz", "urgency": "zzz", "details": "TEST_kind"}, headers=ctx["r1"])
        assert r.status_code == 200
        assert r.json()["kind"] == "autre" and r.json()["urgency"] == "moyenne" and r.json()["location"] is None
        ctx["ids"].append(r.json()["id"])

    def test_empty_details_400(self, ctx):
        r = requests.post(f"{API}/rider/report", json={"kind": "accident", "details": "   "}, headers=ctx["r1"])
        assert r.status_code == 400

    def test_foreign_order_404(self, ctx):
        o2 = _rider_orders(ctx["r2"])
        if not o2:
            pytest.skip("rider2 has no orders")
        r = requests.post(f"{API}/rider/report", json={"details": "TEST_foreign", "order_id": o2[0]["id"]}, headers=ctx["r1"])
        assert r.status_code == 404

    def test_bad_photo_400(self, ctx):
        r = requests.post(f"{API}/rider/report", json={"details": "TEST_photo", "photo": "http://x/y.jpg"}, headers=ctx["r1"])
        assert r.status_code == 400

    def test_non_rider_403(self, ctx):
        r = requests.post(f"{API}/rider/report", json={"details": "TEST_mgr"}, headers=ctx["m"])
        assert r.status_code == 403

    def test_invalid_lat_not_500(self, ctx):
        r = requests.post(f"{API}/rider/report", json={"details": "TEST_lat", "lat": "abc", "lng": "x"}, headers=ctx["r1"])
        assert r.status_code < 500, f"got {r.status_code}"


# --- GET /rider/reports and staff list/patch
class TestReportList:
    def test_my_reports_own_only_no_photo(self, ctx):
        r = requests.get(f"{API}/rider/reports", headers=ctx["r1"])
        assert r.status_code == 200
        rows = r.json()
        assert all(x["rider_id"] == ctx["r1u"]["id"] for x in rows)
        assert all("photo" not in x for x in rows)
        assert ctx["ids"][0] in [x["id"] for x in rows]
        r2 = requests.get(f"{API}/rider/reports", headers=ctx["r2"]).json()
        assert ctx["ids"][0] not in [x["id"] for x in r2]

    def test_staff_list(self, ctx):
        for h in (ctx["m"], ctx["a"]):
            r = requests.get(f"{API}/rider-reports", headers=h)
            assert r.status_code == 200
            assert ctx["ids"][0] in [x["id"] for x in r.json()]
        assert requests.get(f"{API}/rider-reports", headers=ctx["r1"]).status_code == 403
        r = requests.get(f"{API}/rider-reports?status=nouveau", headers=ctx["m"])
        assert all(x["status"] == "nouveau" for x in r.json())

    def test_staff_notification_created(self, ctx):
        mc = MongoClient(os.environ["MONGO_URL"])
        db = mc[os.environ["DB_NAME"]]
        n = db.notifications.find_one({"type": "rider_report", "msg": {"$regex": "TEST_panne"}})
        assert n and n["title"].startswith("URGENT")

    def test_patch_flow(self, ctx):
        rid = ctx["ids"][0]
        assert requests.patch(f"{API}/rider-reports/{rid}", json={"status": "bad"}, headers=ctx["m"]).status_code == 400
        assert requests.patch(f"{API}/rider-reports/nope", json={"status": "resolu"}, headers=ctx["m"]).status_code == 404
        assert requests.patch(f"{API}/rider-reports/{rid}", json={"status": "resolu"}, headers=ctx["r1"]).status_code == 403
        r = requests.patch(f"{API}/rider-reports/{rid}", json={"status": "pris_en_charge", "note": "TEST_on arrive"}, headers=ctx["m"])
        assert r.status_code == 200 and r.json()["status"] == "pris_en_charge"
        assert r.json()["history"][-1]["note"] == "TEST_on arrive"
        r = requests.patch(f"{API}/rider-reports/{rid}", json={"status": "resolu", "note": "TEST_ok"}, headers=ctx["a"])
        assert r.json()["status"] == "resolu" and len(r.json()["history"]) == 3
        mine = {x["id"]: x for x in requests.get(f"{API}/rider/reports", headers=ctx["r1"]).json()}
        assert mine[rid]["status"] == "resolu"
        notifs = requests.get(f"{API}/me/notifications", headers=ctx["r1"])
        if notifs.status_code == 200:
            data = notifs.json()
            items = data.get("items", data) if isinstance(data, dict) else data
            assert any("TEST_on arrive" in (n.get("msg") or "") for n in items)


# --- today / history / order detail
class TestTodayHistory:
    def test_today_counts(self, ctx):
        r = requests.get(f"{API}/riders/me/today", headers=ctx["r1"])
        assert r.status_code == 200
        assert "annulees_retournees" in r.json()["counts"]
        assert isinstance(r.json()["counts"]["annulees_retournees"], int)

    def test_history_orders_detail_masked(self, ctx):
        r = requests.get(f"{API}/riders/me/history?days=90", headers=ctx["r1"])
        assert r.status_code == 200
        days = r.json()
        assert len(days) > 0
        tot = sum(len(d["orders_detail"]) for d in days)
        assert tot > 0
        for d in days:
            for o in d["orders_detail"]:
                assert o["customer"].get("phone") is None
                assert "proof" not in o and "timeline" not in o
        dates = [d["date"] for d in days]
        assert dates == sorted(dates, reverse=True)

    def test_order_detail_own_and_foreign(self, ctx):
        o1 = _rider_orders(ctx["r1"])
        r = requests.get(f"{API}/riders/me/orders/{o1[0]['id']}", headers=ctx["r1"])
        assert r.status_code == 200
        d = r.json()
        assert d["code"] == o1[0]["code"] and "items" in d and "timeline" in d
        assert "phone" not in d["customer"] and "_id" not in d
        assert requests.get(f"{API}/riders/me/orders/{o1[0]['id']}", headers=ctx["r2"]).status_code == 404
        assert requests.get(f"{API}/riders/me/orders/nope", headers=ctx["r1"]).status_code == 404
