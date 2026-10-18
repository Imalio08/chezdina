# Probe: manager GET endpoints - full phone regex in raw text (incl. free text)
import re, sys, requests
sys.path.insert(0, "/app/backend/tests")
from test_privacy_onboarding import manager, BASE_URL, ST, MDB, TODAY
PAT = re.compile(r"\+?225[ ]?0[157][ ]?\d{2}[ ]?\d{2}[ ]?\d{2}[ ]?\d{2}|\b0[157][ ]?\d{2}[ ]?\d{2}[ ]?\d{2}[ ]?\d{2}\b")
m = manager()
paths = ["/api/deliveries", "/api/delivery-sessions", "/api/whatsapp-outbox", "/api/invoices", "/api/reviews", "/api/abandoned-carts",
         "/api/waitlist", "/api/messages/conversations", "/api/orders", "/api/customers", "/api/notifications", "/api/me/notifications",
         "/api/segments", "/api/loyalty", "/api/referrals", "/api/dashboard", "/api/search?q=07", "/api/opportunities", "/api/out-of-catalog",
         "/api/cash-sessions", "/api/encaissements", "/api/audit-logs", "/api/approval-requests", "/api/orders-messages", "/api/rider-reports",
         "/api/wallet", "/api/pos/customers?q=07", "/api/customers/search?q=07"]
conv = m.get(BASE_URL + "/api/messages/conversations").json()
conv = conv if isinstance(conv, list) else conv.get("conversations", conv.get("items", []))
if conv:
    paths.append(f"/api/messages/conversations/{conv[0]['id']}")
for p in paths:
    r = m.get(BASE_URL + p)
    hits = PAT.findall(r.text) if r.status_code == 200 else []
    print(p, r.status_code, len(r.text), "FULL PHONES:" if hits else "", hits[:3])
for uid in ST["att"]:
    MDB.attendance.delete_many({"user_id": uid, "day": TODAY})
