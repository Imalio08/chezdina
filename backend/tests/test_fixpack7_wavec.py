"""
Fix Pack 7 Wave C — Finances (expenses, expense-categories, encaissements, profit-loss)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://dina-boutique.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "aouattaraesca@gmail.com", "password": "Admin123!"}
MANAGER = {"email": "manager.cocody@dinastore.ci", "password": "Manager123!"}

EXPECTED_SEEDED = [
    "Loyer", "Électricité", "Eau", "Salaires", "Transport", "Marketing",
    "Internet", "Fournitures", "Taxes", "Emballage", "Carburant livreurs", "Autre",
]


@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def manager_client():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=MANAGER, timeout=15)
    if r.status_code != 200:
        pytest.skip("manager login failed")
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


# ---------------- Expense categories ----------------
class TestCategories:
    def test_seeded_categories_present(self, admin_client):
        r = admin_client.get(f"{API}/expense-categories")
        assert r.status_code == 200
        names = {c["name"] for c in r.json()}
        missing = [n for n in EXPECTED_SEEDED if n not in names]
        assert not missing, f"Missing seeded categories: {missing}"

    def test_create_category_and_duplicate_400(self, admin_client):
        name = "TEST_FP7_CatA"
        # cleanup if present
        existing = admin_client.get(f"{API}/expense-categories").json()
        for c in existing:
            if c["name"] == name:
                admin_client.delete(f"{API}/expense-categories/{c['id']}")
        r = admin_client.post(f"{API}/expense-categories", json={"name": name, "type": "fixe"})
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["name"] == name and created["type"] == "fixe" and "id" in created
        # duplicate
        r2 = admin_client.post(f"{API}/expense-categories", json={"name": name, "type": "fixe"})
        assert r2.status_code == 400
        # patch type
        r3 = admin_client.patch(f"{API}/expense-categories/{created['id']}", json={"type": "variable"})
        assert r3.status_code == 200
        after = admin_client.get(f"{API}/expense-categories").json()
        row = next(c for c in after if c["id"] == created["id"])
        assert row["type"] == "variable"
        # delete
        r4 = admin_client.delete(f"{API}/expense-categories/{created['id']}")
        assert r4.status_code == 200


# ---------------- Expenses CRUD ----------------
class TestExpenses:
    created_id = None

    def test_create_expense(self, admin_client):
        payload = {
            "label": "TEST_FP7 Loyer mars",
            "category": "Loyer",
            "amount": 150000,
            "type": "fixe",
            "payment_method": "virement",
            "paid_at": "2026-01-15",
            "supplier": "TEST_FP7 Owner",
            "note": "TEST_FP7 note",
        }
        r = admin_client.post(f"{API}/expenses", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["amount"] == 150000
        assert data["type"] == "fixe"
        assert data["label"] == payload["label"]
        TestExpenses.created_id = data["id"]
        # verify via GET
        rows = admin_client.get(f"{API}/expenses").json()
        assert any(x["id"] == data["id"] for x in rows)

    def test_filter_by_type_and_category(self, admin_client):
        r = admin_client.get(f"{API}/expenses", params={"type": "fixe"})
        assert r.status_code == 200
        assert all(x["type"] == "fixe" for x in r.json())
        r2 = admin_client.get(f"{API}/expenses", params={"category": "Loyer"})
        assert r2.status_code == 200
        assert all(x["category"] == "Loyer" for x in r2.json())

    def test_filter_q_search(self, admin_client):
        r = admin_client.get(f"{API}/expenses", params={"q": "TEST_FP7"})
        assert r.status_code == 200
        assert any("TEST_FP7" in (x.get("label", "") + x.get("note", "")) for x in r.json())

    def test_filter_days(self, admin_client):
        r = admin_client.get(f"{API}/expenses", params={"days": 30})
        assert r.status_code == 200

    def test_patch_expense(self, admin_client):
        assert TestExpenses.created_id
        r = admin_client.patch(f"{API}/expenses/{TestExpenses.created_id}", json={"amount": 160000})
        assert r.status_code == 200
        after = admin_client.get(f"{API}/expenses", params={"q": "TEST_FP7"}).json()
        row = next(x for x in after if x["id"] == TestExpenses.created_id)
        assert row["amount"] == 160000

    def test_upload_receipt(self, admin_client):
        assert TestExpenses.created_id
        tiny_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        r = admin_client.post(f"{API}/expenses/{TestExpenses.created_id}/receipt", json={"receipt": tiny_b64})
        assert r.status_code == 200
        rows = admin_client.get(f"{API}/expenses", params={"q": "TEST_FP7"}).json()
        row = next(x for x in rows if x["id"] == TestExpenses.created_id)
        assert row.get("receipt", "").startswith("data:image/png;base64,")

    def test_delete_expense(self, admin_client):
        assert TestExpenses.created_id
        r = admin_client.delete(f"{API}/expenses/{TestExpenses.created_id}")
        assert r.status_code == 200
        rows = admin_client.get(f"{API}/expenses", params={"q": "TEST_FP7"}).json()
        assert not any(x["id"] == TestExpenses.created_id for x in rows)


# ---------------- Encaissements ----------------
class TestEncaissements:
    @pytest.mark.parametrize("days", [7, 30, 90])
    def test_encaissements_shape(self, admin_client, days):
        r = admin_client.get(f"{API}/encaissements", params={"days": days})
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("by_method", "daily", "total", "count"):
            assert k in d, f"missing {k}"
        assert isinstance(d["by_method"], list)
        assert isinstance(d["daily"], list)
        assert isinstance(d["total"], (int, float))
        assert isinstance(d["count"], int)


# ---------------- Profit & Loss ----------------
class TestPnL:
    def test_profit_loss_shape(self, admin_client):
        r = admin_client.get(f"{API}/profit-loss", params={"days": 30})
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("revenue", "cogs", "gross_margin", "gross_margin_pct",
                  "expenses_total", "expenses_by_cat", "net", "net_margin_pct"):
            assert k in d, f"missing {k} in P&L response"
        assert isinstance(d["expenses_by_cat"], list)
        # math sanity
        assert d["gross_margin"] == d["revenue"] - d["cogs"]
        assert d["net"] == d["gross_margin"] - d["expenses_total"]
