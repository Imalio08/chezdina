"""Backend tests for the in-app messaging feature (Pack 6).

Covers:
- POST /api/messages/open idempotency (same rider_id => same conversation id)
- POST /api/messages/send with attachments persistence
- POST /api/messages/conversations/{id}/react toggle
- PATCH /api/messages/conversations/{id}/pin toggle
- PATCH /api/messages/conversations/{id}/archive toggle
- GET /api/messages/conversations?archived=true filter
"""
import os
import pytest
import requests

def _load_backend_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if not v:
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        v = line.split("=", 1)[1].strip()
                        break
        except FileNotFoundError:
            pass
    assert v, "REACT_APP_BACKEND_URL not set"
    return v.rstrip("/")


BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "aouattaraesca@gmail.com"
ADMIN_PASSWORD = "Admin123!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"no token in response: {data}"
    return tok


@pytest.fixture(scope="module")
def auth(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def rider_id(auth):
    r = auth.get(f"{API}/users", timeout=20)
    assert r.status_code == 200, r.text
    users = r.json()
    riders = [u for u in users if (u.get("role") or "").lower() == "rider" or "rider" in (u.get("roles") or [])]
    assert riders, "no rider available for tests"
    return riders[0]["id"]


# ----- open idempotency -----
def test_open_conversation_idempotent(auth, rider_id):
    r1 = auth.post(f"{API}/messages/open", json={"rider_id": rider_id}, timeout=20)
    assert r1.status_code == 200, r1.text
    id1 = r1.json()["id"]

    r2 = auth.post(f"{API}/messages/open", json={"rider_id": rider_id}, timeout=20)
    assert r2.status_code == 200, r2.text
    id2 = r2.json()["id"]

    assert id1 == id2, f"non-idempotent: {id1} vs {id2}"
    assert r2.json().get("created") is False


# ----- send with attachments -----
def test_send_with_attachments_persisted(auth, rider_id):
    attachments = [
        {"type": "image", "url": "data:image/png;base64,iVBORw0KGgo=", "name": "pic.png", "size": 1234, "mime": "image/png"},
        {"type": "file", "url": "https://example.com/doc.pdf", "name": "doc.pdf", "size": 5678, "mime": "application/pdf"},
    ]
    r = auth.post(f"{API}/messages/send", json={
        "rider_id": rider_id,
        "text": "**bold** test with attachments",
        "attachments": attachments,
        "kind": "boutique_livreur",
    }, timeout=20)
    assert r.status_code == 200, r.text

    # Fetch conversation and verify
    opened = auth.post(f"{API}/messages/open", json={"rider_id": rider_id}, timeout=20).json()
    conv = auth.get(f"{API}/messages/conversations/{opened['id']}", timeout=20).json()
    msgs = conv.get("messages") or []
    assert msgs, "no messages persisted"
    last = msgs[-1]
    assert last.get("text") == "**bold** test with attachments"
    atts = last.get("attachments") or []
    assert len(atts) == 2
    assert atts[0]["type"] == "image" and atts[0]["name"] == "pic.png"
    assert atts[1]["type"] == "file" and atts[1]["size"] == 5678


# ----- react toggle -----
def test_react_toggle(auth, rider_id):
    opened = auth.post(f"{API}/messages/open", json={"rider_id": rider_id}, timeout=20).json()
    conv_id = opened["id"]
    # ensure at least one message
    auth.post(f"{API}/messages/send", json={"rider_id": rider_id, "text": "react me"}, timeout=20)
    conv = auth.get(f"{API}/messages/conversations/{conv_id}", timeout=20).json()
    msg_id = (conv.get("messages") or [])[-1]["id"]

    # add
    r = auth.post(f"{API}/messages/conversations/{conv_id}/react", json={"message_id": msg_id, "emoji": "❤️"}, timeout=20)
    assert r.status_code == 200, r.text
    conv = auth.get(f"{API}/messages/conversations/{conv_id}", timeout=20).json()
    m = next(m for m in conv["messages"] if m["id"] == msg_id)
    assert "❤️" in (m.get("reactions") or {})
    assert len(m["reactions"]["❤️"]) == 1

    # toggle off
    r = auth.post(f"{API}/messages/conversations/{conv_id}/react", json={"message_id": msg_id, "emoji": "❤️"}, timeout=20)
    assert r.status_code == 200
    conv = auth.get(f"{API}/messages/conversations/{conv_id}", timeout=20).json()
    m = next(m for m in conv["messages"] if m["id"] == msg_id)
    assert "❤️" not in (m.get("reactions") or {})


# ----- pin toggle -----
def test_pin_toggle(auth, rider_id):
    opened = auth.post(f"{API}/messages/open", json={"rider_id": rider_id}, timeout=20).json()
    conv_id = opened["id"]
    r1 = auth.patch(f"{API}/messages/conversations/{conv_id}/pin", json={}, timeout=20)
    assert r1.status_code == 200, r1.text
    state1 = r1.json().get("pinned")
    r2 = auth.patch(f"{API}/messages/conversations/{conv_id}/pin", json={}, timeout=20)
    state2 = r2.json().get("pinned")
    assert state1 != state2, f"pin did not toggle: {state1} -> {state2}"


# ----- archive toggle + list filter -----
def test_archive_toggle_and_list_filter(auth, rider_id):
    opened = auth.post(f"{API}/messages/open", json={"rider_id": rider_id}, timeout=20).json()
    conv_id = opened["id"]

    # archive
    r = auth.patch(f"{API}/messages/conversations/{conv_id}/archive", json={}, timeout=20)
    assert r.status_code == 200, r.text
    assert r.json().get("archived") is True

    # should appear in archived list only
    arch = auth.get(f"{API}/messages/conversations?archived=true", timeout=20).json()
    assert any(c["id"] == conv_id for c in arch), "conv not in archived list"

    active = auth.get(f"{API}/messages/conversations", timeout=20).json()
    assert not any(c["id"] == conv_id for c in active), "archived conv leaking into active list"

    # unarchive (cleanup)
    r = auth.patch(f"{API}/messages/conversations/{conv_id}/archive", json={}, timeout=20)
    assert r.json().get("archived") is False
