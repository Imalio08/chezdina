"""Iter52 — Messagerie router extraction regression + new PWA icon endpoints."""
import os
import io
import base64
import requests
import pytest

def _read_frontend_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return None

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or _read_frontend_env() or "").rstrip("/")

ADMIN = {"email": "aouattaraesca@gmail.com", "password": "Admin123!"}
CUST = {"phone": "+225 07 85 55 58 88", "code": "386436"}


@pytest.fixture(scope="module")
def admin_s():
    s = requests.Session()
    r = s.post(f"{BASE}/api/auth/login", json=ADMIN, timeout=20)
    assert r.status_code == 200, r.text
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers["Authorization"] = f"Bearer {tok}"
    return s


@pytest.fixture(scope="module")
def customer_s():
    s = requests.Session()
    r = s.post(f"{BASE}/api/public/customer-login-code",
               json={"phone": CUST["phone"], "code": CUST["code"]}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"customer login failed: {r.status_code} {r.text[:200]}")
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers["Authorization"] = f"Bearer {tok}"
    return s


# ---------- Messagerie regression ----------
class TestMessagerie:
    def test_list_conversations(self, admin_s):
        r = admin_s.get(f"{BASE}/api/messages/conversations", timeout=20)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_full_flow(self, admin_s):
        # Pick a customer
        rc = admin_s.get(f"{BASE}/api/customers", timeout=20)
        assert rc.status_code == 200, rc.text
        customers = rc.json()
        assert isinstance(customers, list) and len(customers) > 0
        cid = customers[0]["id"]

        # Open
        ro = admin_s.post(f"{BASE}/api/messages/open",
                          json={"customer_id": cid}, timeout=20)
        assert ro.status_code == 200, ro.text
        od = ro.json()
        assert "id" in od and "created" in od
        conv_id = od["id"]

        # Send
        rs = admin_s.post(f"{BASE}/api/messages/send",
                         json={"customer_id": cid, "text": "Test iter52",
                               "kind": "boutique_cliente"}, timeout=20)
        assert rs.status_code == 200, rs.text
        sd = rs.json()
        assert sd.get("ok") is True
        assert sd.get("conversation_id")
        assert sd["message"]["text"] == "Test iter52"
        msg_id = sd["message"]["id"]
        conv_id = sd["conversation_id"]

        # Get conversation
        rg = admin_s.get(f"{BASE}/api/messages/conversations/{conv_id}", timeout=20)
        assert rg.status_code == 200, rg.text
        conv = rg.json()
        assert any(m.get("id") == msg_id for m in conv.get("messages", []))

        # Archive toggle
        ra = admin_s.patch(f"{BASE}/api/messages/conversations/{conv_id}/archive", json={}, timeout=20)
        assert ra.status_code == 200, ra.text
        assert "archived" in ra.json()
        # Toggle back
        ra2 = admin_s.patch(f"{BASE}/api/messages/conversations/{conv_id}/archive", json={"archived": False}, timeout=20)
        assert ra2.status_code == 200
        assert ra2.json().get("archived") is False

        # Pin toggle
        rp = admin_s.patch(f"{BASE}/api/messages/conversations/{conv_id}/pin", json={}, timeout=20)
        assert rp.status_code == 200
        assert "pinned" in rp.json()

        # React
        rr = admin_s.post(f"{BASE}/api/messages/conversations/{conv_id}/react",
                          json={"message_id": msg_id, "emoji": "❤️"}, timeout=20)
        assert rr.status_code == 200, rr.text
        assert rr.json().get("ok") is True

    def test_broadcast(self, admin_s):
        r = admin_s.post(f"{BASE}/api/messages/broadcast",
                         json={"target": "all", "text": "Smoke"}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert d.get("count", 0) > 0

    def test_customer_messages(self, customer_s):
        r = customer_s.get(f"{BASE}/api/public/account/messages", timeout=20)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)


# ---------- PWA endpoints ----------
class TestPWA:
    def test_manifest(self):
        r = requests.get(f"{BASE}/api/public/manifest.webmanifest", timeout=20)
        assert r.status_code == 200, r.text
        assert "application/manifest+json" in r.headers.get("content-type", "")
        d = r.json()
        assert d.get("name")
        assert d.get("short_name")
        icons = d.get("icons") or []
        assert len(icons) == 3
        srcs = [i["src"] for i in icons]
        assert "/api/public/pwa-icon/192" in srcs
        assert "/api/public/pwa-icon/512" in srcs
        assert "/api/public/pwa-icon/512-maskable" in srcs

    @pytest.mark.parametrize("size,expected_px", [("192", 192), ("512", 512), ("512-maskable", 512)])
    def test_icon(self, size, expected_px):
        r = requests.get(f"{BASE}/api/public/pwa-icon/{size}", timeout=30)
        assert r.status_code == 200, r.text[:200]
        assert r.headers.get("content-type") == "image/png"
        assert len(r.content) > 1024
        # Verify dimensions with Pillow
        from PIL import Image
        img = Image.open(io.BytesIO(r.content))
        assert img.size == (expected_px, expected_px)

    def test_icon_404(self):
        r = requests.get(f"{BASE}/api/public/pwa-icon/foo", timeout=10)
        assert r.status_code == 404

    def test_icon_with_user_logo(self, admin_s):
        # Save existing site to restore
        rget = requests.get(f"{BASE}/api/public/site", timeout=20)
        assert rget.status_code == 200
        original = rget.json() if rget.content else {}
        prev_logo = original.get("logo") if isinstance(original, dict) else None

        # 1x1 red PNG data URL
        red_png_b64 = (
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP8z8DwHwAFBQIAX8jx0g"
            "AAAABJRU5ErkJggg=="
        )
        data_url = f"data:image/png;base64,{red_png_b64}"
        try:
            rp = admin_s.patch(f"{BASE}/api/site", json={"logo": data_url}, timeout=30)
            assert rp.status_code in (200, 204), rp.text
            # Fetch icon — should not crash
            ri = requests.get(f"{BASE}/api/public/pwa-icon/192", timeout=30)
            assert ri.status_code == 200
            assert ri.headers.get("content-type") == "image/png"
            from PIL import Image
            img = Image.open(io.BytesIO(ri.content))
            assert img.size == (192, 192)
        finally:
            # Restore
            admin_s.patch(f"{BASE}/api/site", json={"logo": prev_logo or ""}, timeout=30)
