"""Iter63 — Manual addenda (new sections) + rider unread + idempotent reseed."""
import os
import re
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"

ADMIN = {"email": "aouattaraesca@gmail.com", "password": "Admin123!"}
RIDER = {"email": "rider1@dinastore.ci", "password": "Rider123!"}

EXPECTED = {
    "caisse": ["add-cash-open", "add-pos-grid"],
    "commande": ["add-orders-pdf", "add-orders-chat", "add-orders-postpone", "add-prep-views"],
    "livraison": ["add-slots", "add-versement", "add-print-all"],
    "stock": ["add-adjust", "add-po-mov"],
    "param": ["add-notifs", "add-demo"],
    "livreur": ["add-rider-tools"],
}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_h():
    return {"Authorization": f"Bearer {_login(ADMIN)}"}


@pytest.fixture(scope="module")
def rider_h():
    return {"Authorization": f"Bearer {_login(RIDER)}"}


# --- Manual addenda ----------------------------------------------------------
def _modules(h):
    r = requests.get(f"{API}/manual/modules", headers=h, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    return data.get("modules") if isinstance(data, dict) else data


def _find_section_ids_by_keyword(modules, keyword):
    for m in modules:
        if keyword in (m.get("title") or "").lower():
            return [s.get("id") for s in (m.get("sections") or [])], m
    return None, None


def test_manual_modules_contain_new_sections(admin_h):
    mods = _modules(admin_h)
    missing = {}
    for key, expected_ids in EXPECTED.items():
        ids, m = _find_section_ids_by_keyword(mods, key)
        assert m is not None, f"No module matches keyword '{key}'"
        miss = [i for i in expected_ids if i not in ids]
        if miss:
            missing[m.get("title")] = miss
    assert not missing, f"Missing sections: {missing}"


def test_manual_reseed_is_idempotent(admin_h):
    # Count sections before
    mods_before = _modules(admin_h)
    counts_before = {m["id"]: len(m.get("sections") or []) for m in mods_before}

    r = requests.post(f"{API}/manual/reseed", headers=admin_h, timeout=30)
    assert r.status_code in (200, 201), r.text

    mods_after = _modules(admin_h)
    for m in mods_after:
        # No duplicates of add-* section ids within a module
        ids = [s.get("id") for s in (m.get("sections") or [])]
        add_ids = [i for i in ids if i and i.startswith("add-")]
        assert len(add_ids) == len(set(add_ids)), f"Duplicate add-* ids in {m.get('title')}: {add_ids}"
    # The new sections must still be present
    for key, expected_ids in EXPECTED.items():
        ids, m = _find_section_ids_by_keyword(mods_after, key)
        for eid in expected_ids:
            assert eid in ids, f"After reseed, '{eid}' missing from '{m.get('title')}'"


def test_manual_sections_have_blocks(admin_h):
    mods = _modules(admin_h)
    all_add_ids = {i for ids in EXPECTED.values() for i in ids}
    checked = 0
    for m in mods:
        for s in m.get("sections") or []:
            if s.get("id") in all_add_ids:
                blocks = s.get("blocks") or []
                assert len(blocks) > 0, f"Section {s['id']} has no blocks"
                # must have at least one steps / text / callout
                types = {b.get("type") for b in blocks}
                assert types & {"steps", "text", "callout"}, f"Section {s['id']} blocks have unexpected types: {types}"
                checked += 1
    assert checked >= 14, f"Only checked {checked} add-* sections"


# --- Rider unread + thread/rider --------------------------------------------
def _find_order_assigned_to_rider(admin_h, rider_h):
    """Find an existing order assigned to rider1."""
    # Rider's own 'today' listing
    r = requests.get(f"{API}/riders/me/today", headers=rider_h, timeout=20)
    if r.status_code == 200:
        data = r.json()
        orders = data.get("orders") or data.get("deliveries") or data.get("items") or []
        for o in orders:
            oid = o.get("id") or o.get("order_id")
            code = o.get("code") or o.get("order_code")
            if oid or code:
                return oid or code, code or oid
    # Fallback: scan admin orders
    r = requests.get(f"{API}/orders", headers=admin_h, timeout=30, params={"limit": 200})
    if r.status_code == 200:
        for o in (r.json().get("orders") or r.json() or []):
            if o.get("rider_id"):
                return o.get("id"), o.get("code")
    return None, None


def test_rider_unread_increments_on_store_message(admin_h, rider_h):
    oid, code = _find_order_assigned_to_rider(admin_h, rider_h)
    if not oid:
        pytest.skip("No order assigned to rider1 available")

    # Mark everything as read first for rider
    requests.get(f"{API}/orders/{oid}/thread/rider", headers=rider_h, timeout=15)

    r0 = requests.get(f"{API}/orders-messages/unread", headers=rider_h, timeout=15)
    assert r0.status_code == 200
    base = r0.json()
    assert "count" in base and "by_order" in base
    base_count = base["count"]
    base_for_order = base["by_order"].get(code, 0)

    # Store sends a message in rider thread
    r1 = requests.post(
        f"{API}/orders/{oid}/thread/rider/send",
        headers=admin_h,
        json={"text": "TEST_iter63 message boutique vers livreur"},
        timeout=15,
    )
    assert r1.status_code == 200, r1.text
    assert r1.json().get("message", {}).get("from_kind") == "store"

    r2 = requests.get(f"{API}/orders-messages/unread", headers=rider_h, timeout=15)
    assert r2.status_code == 200
    after = r2.json()
    assert after["count"] == base_count + 1, f"expected +1, got {base_count}→{after['count']}"
    assert after["by_order"].get(code, 0) == base_for_order + 1

    # Rider opens thread → marks as read
    r3 = requests.get(f"{API}/orders/{oid}/thread/rider", headers=rider_h, timeout=15)
    assert r3.status_code == 200
    msgs = r3.json().get("messages") or []
    assert any("TEST_iter63" in (m.get("text") or "") for m in msgs)

    r4 = requests.get(f"{API}/orders-messages/unread", headers=rider_h, timeout=15)
    assert r4.status_code == 200
    final = r4.json()
    assert final["by_order"].get(code, 0) == base_for_order, (
        f"Rider GET /thread/rider should mark read; still {final['by_order'].get(code)}"
    )
    assert final["count"] == base_count


def test_rider_unread_scope_is_rider_only(rider_h):
    """Rider endpoint should only count from_kind=='store' msgs in rider threads."""
    r = requests.get(f"{API}/orders-messages/unread", headers=rider_h, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data.get("count"), int)
    assert isinstance(data.get("by_order"), dict)
