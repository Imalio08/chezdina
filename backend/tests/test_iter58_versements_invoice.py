"""Iter58+ — Versements livreurs (reconcile + close) + Invoice preview backend coverage.

Covers:
  - POST /api/delivery-sessions         (admin)
  - PATCH /api/delivery-sessions/{sid}/add-order
  - PATCH /api/orders/{oid}/status      (set livree)
  - PATCH /api/delivery-sessions/{sid}/reconcile  (collected true/false, PIN rules)
  - PATCH /api/delivery-sessions/{sid}/close      (blocked when missing versements)
  - POST  /api/invoices/from-order/{oid}          (used by invoice preview on FE)
"""
import os
import requests
import pytest

def _read_frontend_env_url():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return None

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _read_frontend_env_url() or "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL missing"
ADMIN = {"email": "aouattaraesca@gmail.com", "password": "Admin123!"}
ADMIN_PIN = "1234"
MANAGER_PIN = "2222"
BAD_PIN = "0000"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    assert r.status_code == 200, r.text
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def rider(session):
    r = session.get(f"{BASE_URL}/api/users")
    assert r.status_code == 200
    riders = [u for u in r.json() if u.get("role") == "rider" and u.get("active") is not False]
    assert riders, "No rider in DB"
    return riders[0]


@pytest.fixture(scope="module")
def product(session):
    r = session.get(f"{BASE_URL}/api/products")
    assert r.status_code == 200
    prods = [p for p in r.json() if p.get("price")]
    assert prods, "No products"
    return prods[0]


def _make_order(session, product, payment_method):
    body = {
        "items": [{
            "product_id": product["id"],
            "name": product.get("name", "TEST_item"),
            "qty": 1,
            "price": int(product.get("price", 10000)),
        }],
        "customer": {"name": "TEST_versement", "phone": "+2250700000000"},
        "channel": "boutique",
        "payment_method": payment_method,
        "mode": "delivery",
        "delivery_fee": 0,
        "discount": 0,
        "note": "TEST_versement",
    }
    r = session.post(f"{BASE_URL}/api/public/orders", json=body)
    assert r.status_code == 200, r.text
    return r.json()  # {code, id, status}


def _set_status(session, oid, status):
    r = session.patch(f"{BASE_URL}/api/orders/{oid}/status", json={"status": status})
    assert r.status_code == 200, r.text


@pytest.fixture
def session_with_orders(session, rider, product):
    # Create 2 orders: 1 cod, 1 prepaid; one additional cod but not livree
    cod1 = _make_order(session, product, "cod")
    prepaid = _make_order(session, product, "wave")
    cod_not_delivered = _make_order(session, product, "cod")

    ds = session.post(f"{BASE_URL}/api/delivery-sessions", json={
        "rider_id": rider["id"], "rider_name": rider.get("name") or "TEST_rider"
    })
    assert ds.status_code == 200, ds.text
    sid = ds.json()["id"]

    for o in (cod1, prepaid, cod_not_delivered):
        r = session.patch(f"{BASE_URL}/api/delivery-sessions/{sid}/add-order",
                          json={"order_id": o["id"]})
        assert r.status_code == 200

    # Mark cod1 and prepaid as livree, cod_not_delivered stays "assignee"
    _set_status(session, cod1["id"], "livree")
    _set_status(session, prepaid["id"], "livree")

    yield {"sid": sid, "cod": cod1, "prepaid": prepaid, "cod_pending": cod_not_delivered}

    # Teardown — close session if open & remove test docs
    try:
        session.patch(f"{BASE_URL}/api/delivery-sessions/{sid}/close")
    except Exception:
        pass


class TestCloseBlockedByVersement:
    def test_close_blocked_when_cod_not_versed(self, session, session_with_orders):
        sid = session_with_orders["sid"]
        cod_code = session_with_orders["cod"]["code"]
        r = session.patch(f"{BASE_URL}/api/delivery-sessions/{sid}/close")
        assert r.status_code == 400, r.text
        detail = r.json().get("detail", "")
        assert "Versements manquants" in detail
        assert cod_code in detail

    def test_prepaid_and_pending_do_not_block(self, session, session_with_orders):
        sid = session_with_orders["sid"]
        prepaid_code = session_with_orders["prepaid"]["code"]
        pending_code = session_with_orders["cod_pending"]["code"]
        r = session.patch(f"{BASE_URL}/api/delivery-sessions/{sid}/close")
        assert r.status_code == 400
        detail = r.json().get("detail", "")
        # Prepaid livree should NOT be in missing list
        assert prepaid_code not in detail
        # cod but not delivered should NOT be in missing list
        assert pending_code not in detail


class TestReconcilePin:
    def test_reconcile_requires_pin(self, session, session_with_orders):
        sid = session_with_orders["sid"]
        oid = session_with_orders["cod"]["id"]
        r = session.patch(f"{BASE_URL}/api/delivery-sessions/{sid}/reconcile", json={
            "order_id": oid, "collected": True, "amount": 10000
        })
        assert r.status_code == 400
        assert "PIN" in r.json().get("detail", "")

    def test_reconcile_bad_pin(self, session, session_with_orders):
        sid = session_with_orders["sid"]
        oid = session_with_orders["cod"]["id"]
        r = session.patch(f"{BASE_URL}/api/delivery-sessions/{sid}/reconcile", json={
            "order_id": oid, "collected": True, "amount": 10000, "pin": BAD_PIN
        })
        assert r.status_code == 403

    def test_reconcile_with_manager_pin_then_close(self, session, session_with_orders):
        sid = session_with_orders["sid"]
        # Fetch the (possibly shared) session and reconcile ALL cod+livree orders
        s = session.get(f"{BASE_URL}/api/delivery-sessions").json()
        cur = next(x for x in s if x["id"] == sid)
        rec = cur.get("reconciliations") or {}
        pending = [o for o in cur.get("orders_detail", [])
                   if o.get("status") == "livree" and o.get("payment_method") == "cod"
                   and not (rec.get(o["id"]) or {}).get("collected")]
        assert pending, "fixture should leave at least one unversed cod"
        for o in pending:
            r = session.patch(f"{BASE_URL}/api/delivery-sessions/{sid}/reconcile", json={
                "order_id": o["id"], "collected": True, "amount": int(o.get("total") or 10000),
                "pin": MANAGER_PIN,
            })
            assert r.status_code == 200, r.text
            got = r.json()["reconciliation"]
            assert got["collected"] is True
            assert got["approved_by"]
        # Close should now succeed
        r = session.patch(f"{BASE_URL}/api/delivery-sessions/{sid}/close")
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    def test_unmark_sets_non_verse(self, session, rider, product):
        # Fresh mini-session so we don't collide with previous close
        order = _make_order(session, product, "cod")
        ds = session.post(f"{BASE_URL}/api/delivery-sessions", json={
            "rider_id": rider["id"], "rider_name": rider.get("name") or "TEST_rider"
        })
        sid = ds.json()["id"]
        session.patch(f"{BASE_URL}/api/delivery-sessions/{sid}/add-order",
                      json={"order_id": order["id"]})
        _set_status(session, order["id"], "livree")
        # Mark versé
        r = session.patch(f"{BASE_URL}/api/delivery-sessions/{sid}/reconcile", json={
            "order_id": order["id"], "collected": True, "amount": 10000, "pin": ADMIN_PIN
        })
        assert r.status_code == 200
        # Unmark
        r = session.patch(f"{BASE_URL}/api/delivery-sessions/{sid}/reconcile", json={
            "order_id": order["id"], "collected": False
        })
        assert r.status_code == 200
        assert r.json()["reconciliation"]["collected"] is False
        # Close should now be blocked
        r = session.patch(f"{BASE_URL}/api/delivery-sessions/{sid}/close")
        assert r.status_code == 400
        # Cleanup: mark versé & close
        session.patch(f"{BASE_URL}/api/delivery-sessions/{sid}/reconcile", json={
            "order_id": order["id"], "collected": True, "amount": 10000, "pin": ADMIN_PIN
        })
        session.patch(f"{BASE_URL}/api/delivery-sessions/{sid}/close")


class TestInvoiceFromOrder:
    def test_invoice_from_order_returns_structure(self, session, product):
        o = _make_order(session, product, "cod")
        r = session.post(f"{BASE_URL}/api/invoices/from-order/{o['id']}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "number" in data
        assert data.get("total") is not None
