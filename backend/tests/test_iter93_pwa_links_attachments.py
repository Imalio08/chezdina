"""Iteration 93: PWA manifests, customer sign-in links (?cl=), shared attachments on all send endpoints."""
import os
import random
import pytest
import requests


def _url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if not v:
        for line in open("/app/frontend/.env"):
            if line.startswith("REACT_APP_BACKEND_URL="):
                v = line.split("=", 1)[1].strip()
    return v.rstrip("/")


API = f"{_url()}/api"
IMG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
VID = "data:video/mp4;base64,AAAAIGZ0eXBpc29t"
PDF = "data:application/pdf;base64,JVBERi0xLjQK"
DOCX = "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,UEsDBA=="
TXT = "data:text/plain;base64,aGVsbG8="
ATTS = [
    {"type": "image", "url": IMG, "name": "p.png", "mime": "image/png", "size": 70},
    {"type": "video", "url": VID, "name": "v.mp4", "mime": "video/mp4", "size": 12},
    {"type": "file", "url": PDF, "name": "f.pdf", "mime": "application/pdf", "size": 9},
    {"type": "evil", "url": IMG},
    {"type": "image", "url": "javascript:alert(1)"},
]


def login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=20)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def admin():
    return login("aouattaraesca@gmail.com", "Admin123!")


@pytest.fixture(scope="module")
def rider():
    return login("rider1@dinastore.ci", "Rider123!")


@pytest.fixture(scope="module")
def test_customer(admin):
    phone = f"+225 07 {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)}"
    r = requests.post(f"{API}/public/customer-signup", json={"name": "TEST_Iter93", "phone": phone, "pin": "482915"}, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    yield d
    requests.delete(f"{API}/customers/{d['customer']['id']}", headers=admin, timeout=20)


# --- PWA manifests
class TestManifests:
    def test_console(self):
        r = requests.get(f"{API}/public/manifest-console.webmanifest", timeout=20)
        assert r.status_code == 200
        m = r.json()
        assert m["name"] == "Console" and m["short_name"] == "Console" and m["scope"] == "/console"
        assert m["start_url"] == "/console"
        assert "launch_handler" in m and m.get("handle_links") == "preferred"

    def test_rider(self):
        m = requests.get(f"{API}/public/manifest-rider.webmanifest", timeout=20).json()
        assert m["name"] == "Livreur" and m["short_name"] == "Livreur"
        assert m["start_url"].startswith("/riders")

    def test_storefront(self):
        m = requests.get(f"{API}/public/manifest.webmanifest", timeout=20).json()
        s = requests.get(f"{API}/public/settings", timeout=20)
        assert m["short_name"] and m["scope"] == "/"
        assert "launch_handler" in m
        print("storefront manifest name:", m["name"], m["short_name"])


# --- link-login
class TestLinkLogin:
    def test_bad_token(self):
        r = requests.post(f"{API}/public/account/link-login", json={"t": "abc.def.ghi"}, timeout=20)
        assert r.status_code == 401

    def test_staff_token_rejected(self, admin):
        r = requests.post(f"{API}/public/account/link-login", json={"t": admin["Authorization"].split()[1]}, timeout=20)
        assert r.status_code == 401

    def test_shared_cart_link_and_exchange(self, admin, test_customer):
        c = test_customer["customer"]
        r = requests.post(f"{API}/pos/shared-cart", headers=admin, json={"items": [], "customer": {"id": c["id"], "name": c["name"], "phone": c.get("phone")}}, timeout=20)
        assert r.status_code == 200, r.text
        link = r.json()["link"]
        assert link.startswith("/panier-partage/") and "?cl=" in link
        t = link.split("?cl=")[1]
        r2 = requests.post(f"{API}/public/account/link-login", json={"t": t}, timeout=20)
        assert r2.status_code == 200, r2.text
        d = r2.json()
        assert d["customer"]["id"] == c["id"] and isinstance(d["token"], str)
        assert "password_hash" not in d["customer"]
        assert "customer_token" in r2.headers.get("set-cookie", "")
        me = requests.get(f"{API}/public/account/messages", headers={"Authorization": f"Bearer {d['token']}"}, timeout=20)
        assert me.status_code == 200

    def test_shared_cart_without_customer(self, admin):
        r = requests.post(f"{API}/pos/shared-cart", headers=admin, json={"items": []}, timeout=20)
        assert r.status_code == 200 and "cl=" not in r.json()["link"]

    def test_share_order(self, admin):
        orders = requests.get(f"{API}/orders", headers=admin, params={"limit": 20}, timeout=30).json()
        orders = orders.get("items", orders) if isinstance(orders, dict) else orders
        o = next(x for x in orders if (x.get("customer") or {}).get("id"))
        r = requests.post(f"{API}/share/order", headers=admin, json={"order_id": o["id"]}, timeout=20)
        assert r.status_code == 200
        link = r.json()["link"]
        assert link.startswith(f"/suivi/{o['code']}?cl=")
        r2 = requests.post(f"{API}/public/account/link-login", json={"t": link.split("?cl=")[1]}, timeout=20)
        assert r2.status_code == 200 and r2.json()["customer"]["id"] == o["customer"]["id"]


# --- attachments on all send endpoints
class TestAttachments:
    def test_console_and_customer_send(self, admin, test_customer):
        cid = test_customer["customer"]["id"]
        r = requests.post(f"{API}/messages/send", headers=admin, json={"customer_id": cid, "text": "**TEST_** gras\n- a\n- b", "attachments": ATTS}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        types = [a["type"] for a in d["message"]["attachments"]]
        assert types == ["image", "video", "file"], types
        conv_id = d["conversation_id"]
        ch = {"Authorization": f"Bearer {test_customer['token']}"}
        r2 = requests.post(f"{API}/public/account/messages/send", headers=ch, json={"conversation_id": conv_id, "text": "TEST_ reply", "attachments": ATTS}, timeout=30)
        assert r2.status_code == 200, r2.text
        conv = requests.get(f"{API}/messages/conversations/{conv_id}", headers=admin, timeout=20).json()
        last = conv["messages"][-1]
        assert [a["type"] for a in last["attachments"]] == ["image", "video", "file"]
        # only attachment, no text
        r3 = requests.post(f"{API}/public/account/messages/send", headers=ch, json={"conversation_id": conv_id, "text": "", "attachments": [ATTS[0]]}, timeout=30)
        assert r3.status_code == 200
        # empty + invalid only
        r4 = requests.post(f"{API}/public/account/messages/send", headers=ch, json={"conversation_id": conv_id, "text": "", "attachments": [ATTS[3]]}, timeout=30)
        assert r4.status_code == 400

    def test_console_docx_txt(self, admin, test_customer):
        """Composer accepts .docx/.txt: console endpoint should keep them like customer/rider endpoints."""
        cid = test_customer["customer"]["id"]
        atts = [{"type": "file", "url": DOCX, "name": "a.docx"}, {"type": "file", "url": TXT, "name": "a.txt"}]
        r = requests.post(f"{API}/messages/send", headers=admin, json={"customer_id": cid, "text": "TEST_ docs", "attachments": atts}, timeout=30)
        assert r.status_code == 200
        kept = [a["name"] for a in r.json()["message"]["attachments"]]
        assert kept == ["a.docx", "a.txt"], f"console dropped office/text files: kept={kept}"

    def test_bad_size_no_500(self, test_customer, admin):
        cid = test_customer["customer"]["id"]
        r = requests.post(f"{API}/messages/send", headers=admin, json={"customer_id": cid, "text": "TEST_ s", "attachments": [{"type": "image", "url": IMG, "size": "big"}]}, timeout=30)
        assert r.status_code < 500, f"size='big' -> {r.status_code}"

    def test_rider_send(self, rider):
        r = requests.post(f"{API}/rider/conversations/store", headers=rider, timeout=20)
        assert r.status_code == 200
        cid = r.json()["id"]
        r2 = requests.post(f"{API}/rider/conversations/{cid}/send", headers=rider, json={"text": "TEST_ rider pj", "attachments": ATTS}, timeout=30)
        assert r2.status_code == 200, r2.text
        assert [a["type"] for a in r2.json()["message"]["attachments"]] == ["image", "video", "file"]
