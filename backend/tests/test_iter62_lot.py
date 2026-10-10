"""Iter62 backend tests — Lot: Photos messages, Demo pack, BC reception, Unread badge."""
import os
import time
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE}/api"

ADMIN = {"email": "aouattaraesca@gmail.com", "password": "Admin123!"}
MGR = {"email": "manager.cocody@dinastore.ci", "password": "Manager123!"}
RIDER = {"email": "rider1@dinastore.ci", "password": "Rider123!"}

# A 1x1 transparent PNG data URL
TINY_PNG = ("data:image/png;base64,"
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")


def _stock(headers, product_id):
    prods = requests.get(f"{API}/products", headers=headers, timeout=15).json()
    p = next((x for x in prods if x.get("id") == product_id), None)
    return int((p or {}).get("stock") or 0)


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_h():
    return {"Authorization": f"Bearer {_login(ADMIN)}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def mgr_h():
    return {"Authorization": f"Bearer {_login(MGR)}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def rider_h():
    return {"Authorization": f"Bearer {_login(RIDER)}", "Content-Type": "application/json"}


# ---------- P0: Demo pack ----------
class TestDemoPack:
    def test_pos_rupture_products_present(self, admin_h):
        """Demo pack must have rupture product 'Mules Raphia Naturel' (stock==0 unless BC-DEMO-0 received)."""
        r = requests.get(f"{API}/products", headers=admin_h, timeout=15)
        assert r.status_code == 200
        prods = r.json()
        rupture = [p for p in prods if p.get("name") == "Mules Raphia Naturel"]
        assert rupture, "Demo product 'Mules Raphia Naturel' not seeded"
        # If BC-DEMO-0 has been received in a previous test run, stock may now be > 0 (seed state).
        pos = requests.get(f"{API}/purchase-orders", headers=admin_h).json()
        bc0 = next((p for p in pos if p.get("number") == "BC-DEMO-0"), None)
        if bc0 and bc0.get("status") == "commande":
            assert rupture[0].get("stock", 0) == 0

    def test_purchase_orders_demo_statuses(self, admin_h):
        r = requests.get(f"{API}/purchase-orders", headers=admin_h, timeout=15)
        assert r.status_code == 200
        pos = r.json()
        by_num = {p["number"]: p for p in pos if "DEMO" in (p.get("number") or "")}
        assert "BC-DEMO-0" in by_num and by_num["BC-DEMO-0"]["status"] in ("commande", "recu")
        assert "BC-DEMO-1" in by_num and by_num["BC-DEMO-1"]["status"] in ("recu_partiel", "recu")
        assert "BC-DEMO-2" in by_num and by_num["BC-DEMO-2"]["status"] == "recu"

    def test_second_seed_skipped(self, admin_h):
        """Second seed-demo call must return scenarios.skipped (do NOT wipe)."""
        r = requests.post(f"{API}/admin/seed-demo", headers=admin_h, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        scn = data.get("created", {}).get("scenarios") or {}
        assert scn.get("skipped") is True, f"Second seed should be skipped, got {scn}"

    def test_demo_customers_can_login(self):
        r = requests.post(f"{API}/public/customer-login-code",
                          json={"phone": "+225 07 48 11 22 01", "code": "202601"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("token") or r.json().get("customer")

    def test_delivery_sessions_today(self, admin_h):
        from datetime import date
        r = requests.get(f"{API}/delivery-sessions", headers=admin_h,
                        params={"date": date.today().isoformat()}, timeout=15)
        assert r.status_code == 200
        sessions = r.json()
        assert isinstance(sessions, list) and len(sessions) >= 1

    def test_cash_sessions_pending(self, admin_h):
        r = requests.get(f"{API}/cash-sessions", headers=admin_h, timeout=15)
        assert r.status_code == 200
        rows = r.json()
        pending = [s for s in rows if s.get("status") == "pending_validation"]
        assert pending, "Expected a cash_session pending_validation from demo pack"


# ---------- P1: BC reception ----------
class TestBCReception:
    def test_blind_receive_no_gap_increments_stock(self, admin_h):
        """BC-DEMO-0 blind-receive with ordered=counted → stock += qty + stock_movement."""
        po = next(p for p in requests.get(f"{API}/purchase-orders", headers=admin_h).json()
                  if p.get("number") == "BC-DEMO-0")
        if po.get("status") == "recu":
            pytest.skip("BC-DEMO-0 already received in a previous run")
        pid = po["id"]
        counts = [{"line_id": i, "product_id": it.get("product_id"), "qty_counted": int(it.get("qty", 0))}
                  for i, it in enumerate(po["items"])]
        product_id = po["items"][0]["product_id"]
        stock_before = _stock(admin_h, product_id)
        total_ordered = sum(int(it.get("qty", 0)) for it in po["items"])
        r = requests.post(f"{API}/purchase-orders/{pid}/blind-receive",
                          headers=admin_h, json={"counts": counts}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("status") == "recu"
        assert body.get("gaps") == []
        # stock after
        stock_after = _stock(admin_h, product_id)
        assert stock_after == stock_before + total_ordered, \
            f"Stock not incremented: {stock_before} + {total_ordered} != {stock_after}"
        # stock movement
        mv = requests.get(f"{API}/stock-movements", headers=admin_h,
                         params={"product_id": product_id}).json()
        assert any("Réception BC-DEMO-0" in (m.get("reason") or "") for m in mv), \
            "No stock_movement 'Réception BC-DEMO-0'"

    def test_validate_gaps_increments_stock_bc1(self, admin_h):
        po = next(p for p in requests.get(f"{API}/purchase-orders", headers=admin_h).json()
                  if p.get("number") == "BC-DEMO-1")
        if (po.get("reception") or {}).get("validated"):
            pytest.skip("BC-DEMO-1 already validated")
        pid = po["id"]
        product_id = po["items"][0]["product_id"]
        qty_counted = int(po["items"][0].get("qty_counted", 0))
        before = _stock(admin_h, product_id)
        r = requests.post(f"{API}/purchase-orders/{pid}/validate-gaps",
                          headers=admin_h, json={"note": "TEST_iter62"}, timeout=20)
        assert r.status_code == 200, r.text
        after = _stock(admin_h, product_id)
        assert after == before + qty_counted
        mv = requests.get(f"{API}/stock-movements", headers=admin_h,
                         params={"product_id": product_id}).json()
        assert any("BC-DEMO-1" in (m.get("reason") or "") for m in mv)


# ---------- P2: Unread badge ----------
class TestUnreadBadge:
    def test_unread_count_present(self, admin_h):
        r = requests.get(f"{API}/orders-messages/unread", headers=admin_h, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "count" in d and "by_order" in d
        assert d["count"] >= 1
        assert isinstance(d["by_order"], dict)

    def test_mark_order_threads_read_clears_badge(self, admin_h):
        before = requests.get(f"{API}/orders-messages/unread", headers=admin_h).json()
        assert before["count"] >= 1
        order_code = next(iter(before["by_order"]))
        decrement = before["by_order"][order_code]
        r = requests.post(f"{API}/orders/{order_code}/threads/read", headers=admin_h, json={}, timeout=15)
        assert r.status_code == 200
        after = requests.get(f"{API}/orders-messages/unread", headers=admin_h).json()
        assert order_code not in after["by_order"]
        assert after["count"] == before["count"] - decrement

    def test_rider_unread_zero(self, rider_h):
        r = requests.get(f"{API}/orders-messages/unread", headers=rider_h, timeout=15)
        assert r.status_code == 200
        assert r.json() == {"count": 0, "by_order": {}}


# ---------- Photos in order thread messages ----------
class TestPhotoAttachments:
    @pytest.fixture(scope="class")
    def order_with_customer(self, admin_h):
        orders = requests.get(f"{API}/orders", headers=admin_h, timeout=15).json()
        for o in orders:
            if (o.get("customer") or {}).get("id"):
                return o
        pytest.skip("No order with customer id found")

    def test_staff_send_photo_to_customer_thread(self, admin_h, order_with_customer):
        oid = order_with_customer["id"]
        r = requests.post(f"{API}/orders/{oid}/thread/customer/send",
                          headers=admin_h, json={"text": "", "attachments": [
                              {"type": "image", "url": TINY_PNG, "name": "TEST_iter62.png", "mime": "image/png"}
                          ]}, timeout=15)
        assert r.status_code == 200, r.text
        msg = r.json()["message"]
        assert msg.get("attachments")
        assert msg["attachments"][0]["url"] == TINY_PNG
        assert msg["attachments"][0]["type"] == "image"

    def test_empty_text_and_no_attachments_rejected(self, admin_h, order_with_customer):
        oid = order_with_customer["id"]
        r = requests.post(f"{API}/orders/{oid}/thread/customer/send",
                          headers=admin_h, json={"text": "", "attachments": []}, timeout=15)
        assert r.status_code == 400

    def test_non_image_attachment_ignored(self, admin_h, order_with_customer):
        oid = order_with_customer["id"]
        # Non-image attachment with empty text should be rejected (filtered to empty list)
        r = requests.post(f"{API}/orders/{oid}/thread/customer/send",
                          headers=admin_h, json={"text": "", "attachments": [
                              {"type": "file", "url": "https://example.com/doc.pdf", "name": "doc.pdf"}
                          ]}, timeout=15)
        assert r.status_code == 400, "Non-image attachment should be filtered → empty → 400"

    def test_customer_send_photo(self):
        # Login demo customer
        r = requests.post(f"{API}/public/customer-login-code",
                          json={"phone": "+225 07 48 11 22 01", "code": "202601"}, timeout=15)
        assert r.status_code == 200
        tok = r.json().get("token")
        if not tok:
            pytest.skip("Customer login did not return a token")
        ch = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
        # Fetch threads
        threads = requests.get(f"{API}/public/account/threads", headers=ch, timeout=15).json()
        # threads may be a dict or list
        if isinstance(threads, dict):
            threads = threads.get("threads") or threads.get("conversations") or []
        order_thread = next((t for t in threads if t.get("kind") == "commande_cliente"), None)
        if not order_thread:
            pytest.skip("No commande_cliente thread for demo customer")
        r = requests.post(f"{API}/public/account/messages/send", headers=ch,
                          json={"conversation_id": order_thread["id"], "text": "",
                                "attachments": [{"type": "image", "url": TINY_PNG, "name": "cust.png",
                                                 "mime": "image/png"}]}, timeout=15)
        assert r.status_code == 200, r.text
        msg = r.json()["message"]
        assert msg.get("attachments") and msg["attachments"][0]["url"] == TINY_PNG
