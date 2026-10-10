"""
Backend tests for Order Messaging (messagerie commande)
Covers:
 - GET /api/orders/{oid|code}/thread/{customer|rider} create/return shared thread
 - 400 cases (no rider, customer without account)
 - 403 for rider accessing wrong thread
 - POST send: staff vs rider from_kind, notification creation, empty text 400
 - Two different staff see same thread history
 - Customer threads + reply creates notification
"""
import os
import pytest
import requests
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = BASE_URL + "/api"

ADMIN = ("aouattaraesca@gmail.com", "Admin123!")
MANAGER = ("manager.cocody@dinastore.ci", "Manager123!")
RIDER1 = ("rider1@dinastore.ci", "Rider123!")

ORDER_CODE = "DN-261005-1044"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def admin_token():
    return _login(*ADMIN)


@pytest.fixture(scope="module")
def manager_token():
    return _login(*MANAGER)


@pytest.fixture(scope="module")
def rider_token():
    return _login(*RIDER1)


@pytest.fixture(scope="module")
def order(admin_token, rider_token):
    """Resolve an order assigned to rider1 (so rider-send test works), with a customer having an account."""
    me = requests.get(f"{API}/auth/me", headers=_auth(rider_token), timeout=30).json()
    rider1_id = me["id"]
    r = requests.get(f"{API}/orders", headers=_auth(admin_token), timeout=30)
    assert r.status_code == 200
    orders = r.json() if isinstance(r.json(), list) else r.json().get("orders", [])
    chosen = None
    for o in orders:
        if o.get("rider_id") == rider1_id and (o.get("customer") or {}).get("id"):
            chosen = o
            break
    if not chosen:
        # fallback: any order with rider+customer
        for o in orders:
            if o.get("rider_id") and (o.get("customer") or {}).get("id"):
                chosen = o
                break
    assert chosen, "No suitable order with rider1 + customer account found"
    return chosen


# ---------- Thread creation / idempotency ----------
class TestOrderThread:
    def test_customer_thread_by_code(self, admin_token, order):
        r = requests.get(f"{API}/orders/{order['code']}/thread/customer", headers=_auth(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["kind"] == "commande_cliente"
        assert c["key"] == f"order:{order['id']}|customer"
        assert c.get("order_code") == order["code"]

    def test_customer_thread_by_id_same(self, admin_token, order):
        r = requests.get(f"{API}/orders/{order['id']}/thread/customer", headers=_auth(admin_token), timeout=30)
        assert r.status_code == 200
        assert r.json()["key"] == f"order:{order['id']}|customer"

    def test_rider_thread(self, admin_token, order):
        r = requests.get(f"{API}/orders/{order['code']}/thread/rider", headers=_auth(admin_token), timeout=30)
        assert r.status_code == 200
        c = r.json()
        assert c["kind"] == "commande_livreur"
        assert c["key"] == f"order:{order['id']}|rider"

    def test_rider_thread_requires_rider_assigned(self, admin_token):
        """Find an order without rider_id and expect 400 for rider thread."""
        r = requests.get(f"{API}/orders", headers=_auth(admin_token), timeout=30)
        orders = r.json() if isinstance(r.json(), list) else r.json().get("orders", [])
        no_rider = next((o for o in orders if not o.get("rider_id")), None)
        if not no_rider:
            pytest.skip("No order without rider_id to test 400")
        r = requests.get(f"{API}/orders/{no_rider['code']}/thread/rider", headers=_auth(admin_token), timeout=30)
        assert r.status_code == 400
        assert "livreur" in r.text.lower()

    def test_customer_thread_requires_account(self, admin_token):
        """Find an order whose customer has no id (guest) and expect 400."""
        r = requests.get(f"{API}/orders", headers=_auth(admin_token), timeout=30)
        orders = r.json() if isinstance(r.json(), list) else r.json().get("orders", [])
        guest = next((o for o in orders if not (o.get("customer") or {}).get("id")), None)
        if not guest:
            pytest.skip("No guest order to test 400")
        r = requests.get(f"{API}/orders/{guest['code']}/thread/customer", headers=_auth(admin_token), timeout=30)
        assert r.status_code == 400

    def test_invalid_party(self, admin_token, order):
        r = requests.get(f"{API}/orders/{order['code']}/thread/boutique", headers=_auth(admin_token), timeout=30)
        assert r.status_code == 400

    def test_rider_can_only_access_own_rider_thread(self, rider_token, admin_token, order):
        # rider should be forbidden on customer party even on their own order
        r = requests.get(f"{API}/orders/{order['code']}/thread/customer", headers=_auth(rider_token), timeout=30)
        assert r.status_code == 403
        # Find an order not assigned to rider1 → rider should get 403 on rider party
        rr = requests.get(f"{API}/orders", headers=_auth(admin_token), timeout=30)
        orders = rr.json() if isinstance(rr.json(), list) else rr.json().get("orders", [])
        # rider1 info
        me = requests.get(f"{API}/auth/me", headers=_auth(rider_token), timeout=30).json()
        other = next((o for o in orders if o.get("rider_id") and o["rider_id"] != me["id"]), None)
        if other:
            r = requests.get(f"{API}/orders/{other['code']}/thread/rider", headers=_auth(rider_token), timeout=30)
            assert r.status_code == 403


# ---------- Send message ----------
class TestOrderSend:
    def test_staff_send_customer(self, admin_token, order):
        text = f"TEST_staff_customer_{uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{API}/orders/{order['code']}/thread/customer/send",
            json={"text": text}, headers=_auth(admin_token), timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["message"]["from_kind"] == "store"
        assert d["message"]["text"] == text
        # verify persistence via GET
        g = requests.get(f"{API}/orders/{order['code']}/thread/customer", headers=_auth(admin_token), timeout=30)
        texts = [m.get("text") for m in g.json().get("messages", [])]
        assert text in texts

    def test_empty_text_400(self, admin_token, order):
        r = requests.post(
            f"{API}/orders/{order['code']}/thread/customer/send",
            json={"text": "   "}, headers=_auth(admin_token), timeout=30,
        )
        assert r.status_code == 400

    def test_rider_send_creates_notification(self, rider_token, admin_token, order):
        """Rider replies → notification type order_message with proper link."""
        text = f"TEST_rider_reply_{uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{API}/orders/{order['code']}/thread/rider/send",
            json={"text": text}, headers=_auth(rider_token), timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["message"]["from_kind"] == "rider"
        # notifications visible to admin
        n = requests.get(f"{API}/notifications", headers=_auth(admin_token), timeout=30)
        assert n.status_code == 200
        notifs = n.json()
        notif_items = notifs if isinstance(notifs, list) else notifs.get("items", [])
        found = [x for x in notif_items if x.get("type") == "order_message" and text[:30] in (x.get("msg") or "")]
        assert found, f"order_message notification not found; recent: {notif_items[:5]}"
        link = found[0].get("link", "")
        assert order["code"] in link and "focus=order-messages" in link


# ---------- Shared thread (two staff same history) ----------
class TestSharedThread:
    def test_admin_and_manager_see_same_history(self, admin_token, manager_token, order):
        marker = f"TEST_shared_{uuid.uuid4().hex[:6]}"
        requests.post(
            f"{API}/orders/{order['code']}/thread/customer/send",
            json={"text": marker}, headers=_auth(admin_token), timeout=30,
        )
        a = requests.get(f"{API}/orders/{order['code']}/thread/customer", headers=_auth(admin_token), timeout=30).json()
        m = requests.get(f"{API}/orders/{order['code']}/thread/customer", headers=_auth(manager_token), timeout=30).json()
        assert a["id"] == m["id"]
        a_texts = [x.get("text") for x in a.get("messages", [])]
        m_texts = [x.get("text") for x in m.get("messages", [])]
        assert marker in a_texts and marker in m_texts
        # manager can also send and admin sees it
        marker2 = f"TEST_mgr_{uuid.uuid4().hex[:6]}"
        requests.post(
            f"{API}/orders/{order['code']}/thread/customer/send",
            json={"text": marker2}, headers=_auth(manager_token), timeout=30,
        )
        a2 = requests.get(f"{API}/orders/{order['code']}/thread/customer", headers=_auth(admin_token), timeout=30).json()
        assert marker2 in [x.get("text") for x in a2.get("messages", [])]


# ---------- Customer side ----------
class TestCustomerSide:
    @pytest.fixture(scope="class")
    def customer_token(self, admin_token, order):
        """Login as the customer of our order using phone + access_code."""
        cust_id = order["customer"]["id"]
        # Fetch customer phone + access_code from admin API
        r = requests.get(f"{API}/customers/{cust_id}", headers=_auth(admin_token), timeout=30)
        if r.status_code != 200:
            # fallback via list
            r2 = requests.get(f"{API}/customers", headers=_auth(admin_token), timeout=30)
            allc = r2.json() if isinstance(r2.json(), list) else r2.json().get("items", [])
            cust = next((c for c in allc if c.get("id") == cust_id), None)
        else:
            cust = r.json().get("customer") or r.json()
        if not cust or not cust.get("access_code"):
            pytest.skip("Customer access_code not available via admin API")
        login = requests.post(
            f"{API}/public/customer-login-code",
            json={"phone": cust["phone"], "code": cust["access_code"]},
            timeout=30,
        )
        if login.status_code != 200:
            pytest.skip(f"Customer login failed: {login.status_code} {login.text}")
        return login.json()["token"], cust

    def test_customer_sees_order_thread_in_threads(self, admin_token, order, customer_token):
        tok, _ = customer_token
        # Ensure a store message exists so conv has activity
        requests.post(
            f"{API}/orders/{order['code']}/thread/customer/send",
            json={"text": f"TEST_for_customer_{uuid.uuid4().hex[:6]}"},
            headers=_auth(admin_token), timeout=30,
        )
        r = requests.get(f"{API}/public/account/threads", headers=_auth(tok), timeout=30)
        assert r.status_code == 200
        threads = r.json()
        # customer should see at least one commande_cliente thread for this order
        match = [t for t in threads if t.get("order_id") == order["id"] and t.get("kind") == "commande_cliente"]
        assert match, f"Customer threads missing order thread; got: {threads[:3]}"

    def test_customer_reply_creates_notification(self, admin_token, order, customer_token):
        tok, _ = customer_token
        # get conversation_id
        r = requests.get(f"{API}/public/account/threads", headers=_auth(tok), timeout=30)
        threads = r.json()
        conv = next((t for t in threads if t.get("order_id") == order["id"] and t.get("kind") == "commande_cliente"), None)
        assert conv
        text = f"TEST_cust_reply_{uuid.uuid4().hex[:6]}"
        s = requests.post(
            f"{API}/public/account/messages/send",
            json={"conversation_id": conv["id"], "text": text},
            headers=_auth(tok), timeout=30,
        )
        assert s.status_code == 200, s.text
        # Notification for staff
        n = requests.get(f"{API}/notifications", headers=_auth(admin_token), timeout=30).json()
        items = n if isinstance(n, list) else n.get("items", [])
        found = [x for x in items if x.get("type") == "order_message" and text[:30] in (x.get("msg") or "")]
        assert found, "customer reply did not create order_message notification"
        assert "focus=order-messages" in found[0].get("link", "")
