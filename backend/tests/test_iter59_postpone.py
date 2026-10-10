"""Iter59 — postponed orders in delivery sessions + preparation kanban"""
import os
import requests
from datetime import date, timedelta

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://dina-boutique.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _admin():
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {_login('aouattaraesca@gmail.com', 'Admin123!')}"
    s.headers["Content-Type"] = "application/json"
    return s


def _get_product(s):
    r = s.get(f"{API}/products")
    assert r.status_code == 200
    prods = r.json()
    assert prods, "no products"
    return prods[0]


def _make_order(s, name="TEST_postpone"):
    p = _get_product(s)
    payload = {
        "customer": {"name": name, "phone": "+2250700000011"},
        "items": [{"product_id": p["id"], "name": p.get("name", "Prod"), "qty": 1, "price": 10000}],
        "total": 10000,
        "payment_method": "cod",
        "mode": "delivery",
        "status": "confirmee",
    }
    r = s.post(f"{API}/orders", json=payload)
    assert r.status_code in (200, 201), r.text
    return r.json()


def _get_rider_id(s):
    r = s.get(f"{API}/users")
    assert r.status_code == 200
    for u in r.json():
        if u.get("email") == "rider1@dinastore.ci":
            return u["id"], u.get("name", "Rider 1")
    # fallback
    return None, None


def _open_session(s, rider_id, rider_name, d=None):
    body = {"rider_id": rider_id, "rider_name": rider_name}
    if d:
        body["date"] = d
    r = s.post(f"{API}/delivery-sessions", json=body)
    assert r.status_code == 200, r.text
    return r.json()


class TestPostpone:
    def test_full_flow(self):
        s = _admin()
        rid, rname = _get_rider_id(s)
        assert rid, "rider1 not found"
        today = date.today().isoformat()
        sess = _open_session(s, rid, rname, today)
        sid = sess["id"]
        order = _make_order(s)
        oid = order["id"]
        # assign order to session
        r = s.patch(f"{API}/delivery-sessions/{sid}/add-order", json={"order_id": oid})
        assert r.status_code == 200, r.text

        # Invalid date -> 400
        r = s.patch(f"{API}/orders/{oid}/status", json={"status": "reportee", "next_date": "notadate"})
        assert r.status_code == 400, r.text

        # Past date -> 400
        past = (date.today() - timedelta(days=2)).isoformat()
        r = s.patch(f"{API}/orders/{oid}/status", json={"status": "reportee", "next_date": past})
        assert r.status_code == 400, r.text

        # Valid future date
        next_d = (date.today() + timedelta(days=3)).isoformat()
        r = s.patch(f"{API}/orders/{oid}/status", json={"status": "reportee", "next_date": next_d, "reason": "cliente absente"})
        assert r.status_code == 200, r.text

        # Check order state: status=confirmee, rider_id null, session_id null, rescheduled_for set
        r = s.get(f"{API}/orders")
        assert r.status_code == 200
        od = next((x for x in r.json() if x["id"] == oid), None)
        assert od, "order not found in list"
        assert od["status"] == "confirmee", od
        assert od.get("rider_id") in (None, ""), od
        assert od.get("session_id") in (None, ""), od
        assert od.get("rescheduled_for") == next_d
        assert od.get("delivery_date") == next_d

        # Check session: postponed_count>=1; orders_detail still contains the order with postponed_to; totals exclude it
        r = s.get(f"{API}/delivery-sessions", params={"rider_id": rid, "date": today})
        assert r.status_code == 200
        rows = [x for x in r.json() if x["id"] == sid]
        assert rows, "session not found in list"
        srow = rows[0]
        assert srow.get("postponed_count", 0) >= 1
        od_in = [o for o in srow.get("orders_detail", []) if o["id"] == oid]
        assert od_in and od_in[0].get("postponed_to") == next_d
        # total_to_collect should NOT include this order's 10000
        assert srow.get("total_to_collect", 0) == 0 or 10000 not in [srow.get("total_to_collect")]
        # Actually assert it excludes the postponed amount: build sum ourselves
        active_cod_total = sum(o.get("total", 0) for o in srow["orders_detail"]
                               if o.get("payment_method") == "cod" and o["id"] not in (srow.get("postponed") or {}))
        assert srow["total_to_collect"] == active_cod_total

        # close_session should NOT be blocked by postponed order
        r = s.patch(f"{API}/delivery-sessions/{sid}/close")
        assert r.status_code == 200, r.text

    def test_future_date_in_payload(self):
        """next_date == today should be accepted."""
        s = _admin()
        rid, rname = _get_rider_id(s)
        today = date.today().isoformat()
        sess = _open_session(s, rid, rname, today)
        sid = sess["id"]
        order = _make_order(s, "TEST_postpone_today")
        oid = order["id"]
        s.patch(f"{API}/delivery-sessions/{sid}/add-order", json={"order_id": oid})
        r = s.patch(f"{API}/orders/{oid}/status", json={"status": "reportee", "next_date": today})
        assert r.status_code == 200, r.text
        # cleanup
        s.patch(f"{API}/delivery-sessions/{sid}/close")
