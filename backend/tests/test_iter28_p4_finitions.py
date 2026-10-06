"""Iter28 P4 Finitions — Reviews moderation (with reply), Dina IA manual-first, manual-gaps, Analytics."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://dina-boutique.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "aouattaraesca@gmail.com", "password": "Admin123!"}
SALES = {"email": "agent1@dinastore.ci", "password": "Agent123!"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed {creds['email']}: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def admin():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def sales():
    return _login(SALES)


# --- Public site -------------------------------------------------------------
def test_public_site_ok():
    r = requests.get(f"{API}/public/site", timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    # Should return without crashing. name/logo may be absent → front has fallback.
    assert isinstance(d, dict)


# --- Reviews moderation with reply ------------------------------------------
def test_reviews_moderation_with_reply(admin):
    # Pick first product
    rp = admin.get(f"{API}/products", timeout=15)
    assert rp.status_code == 200
    prods = rp.json()
    assert prods, "no products seeded"
    pid = prods[0]["id"]

    # Create a pending review via public endpoint
    r = requests.post(
        f"{API}/public/reviews",
        json={"product_id": pid, "rating": 5, "comment": "TEST_IT28 excellent produit", "customer_name": "TEST_IT28"},
        timeout=15,
    )
    assert r.status_code in (200, 201), r.text

    # Find a pending review
    rl = admin.get(f"{API}/reviews?status=pending", timeout=15)
    assert rl.status_code == 200
    pending = rl.json()
    assert any(x.get("comment", "").startswith("TEST_IT28") for x in pending), f"no pending TEST_IT28 review found: {len(pending)} pending"
    rev = next(x for x in pending if x.get("comment", "").startswith("TEST_IT28"))
    rid = rev["id"]

    # PATCH approve + reply
    pr = admin.patch(
        f"{API}/reviews/{rid}",
        json={"status": "approved", "reply": "Merci pour votre retour !"},
        timeout=15,
    )
    assert pr.status_code == 200, pr.text
    assert pr.json().get("ok") is True

    # Verify persistence via listing approved
    la = admin.get(f"{API}/reviews?status=approved", timeout=15)
    assert la.status_code == 200
    approved = la.json()
    hit = next((x for x in approved if x["id"] == rid), None)
    assert hit, "approved review not found after PATCH"
    assert hit.get("reply") == "Merci pour votre retour !"
    assert hit.get("status") == "approved"
    assert hit.get("reply_by")  # moderator name recorded

    # cleanup
    admin.delete(f"{API}/reviews/{rid}", timeout=10)


# --- Dina IA manual-first ----------------------------------------------------
def test_ai_ask_manual_howto(admin):
    r = admin.post(f"{API}/ai/ask", json={"question": "Comment faire un remboursement ?"}, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    # Expectation: if manual_modules has a matching section → source=manual
    # Else → logged in manual_gaps (and source will be tool/llm/fallback)
    if d.get("source") == "manual":
        assert d.get("manual_hint", {}).get("deep_link", "").startswith("/console/manuel/")
        assert isinstance(d.get("answer"), str) and len(d["answer"]) > 10
    else:
        # Verify fallback happened AND manual_gaps logs the question
        gaps = admin.get(f"{API}/manual-gaps", timeout=15)
        assert gaps.status_code == 200
        qs = [g.get("question", "") for g in gaps.json()]
        assert any("remboursement" in (q or "").lower() for q in qs), \
            f"no 'remboursement' logged in manual_gaps when source={d.get('source')}"


def test_manual_gaps_admin_access(admin):
    r = admin.get(f"{API}/manual-gaps", timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_manual_gaps_sales_forbidden(sales):
    r = sales.get(f"{API}/manual-gaps", timeout=15)
    assert r.status_code == 403, f"expected 403 for sales, got {r.status_code}"


# --- Analytics ---------------------------------------------------------------
def test_analytics_events_and_funnel(admin):
    visitor = "TEST_IT28_abc"
    events = [
        {"name": "page_view", "visitor_id": visitor, "page": "/boutique"},
        {"name": "product_view", "visitor_id": visitor, "product_id": "px"},
        {"name": "add_to_cart", "visitor_id": visitor, "product_id": "px"},
        {"name": "checkout_started", "visitor_id": visitor},
        {"name": "order_placed", "visitor_id": visitor, "value": 1000},
    ]
    for ev in events:
        r = requests.post(f"{API}/analytics/events", json=ev, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert "id" in d

    f = admin.get(f"{API}/analytics/funnel?days=1", timeout=15)
    assert f.status_code == 200, f.text
    data = f.json()
    for k in ["visitors", "page_views", "product_views", "add_to_cart", "checkout_started", "order_placed", "conversion_rate", "funnel"]:
        assert k in data, f"missing key {k}"
    assert data["visitors"] >= 1
    assert data["page_views"] >= 1
    assert data["product_views"] >= 1
    assert data["add_to_cart"] >= 1
    assert data["checkout_started"] >= 1
    assert data["order_placed"] >= 1
    assert isinstance(data["funnel"], list) and len(data["funnel"]) == 5
    assert all("step" in x and "value" in x for x in data["funnel"])
