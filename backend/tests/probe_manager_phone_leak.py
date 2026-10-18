# Probe: which manager-accessible endpoints still return full customer phone numbers (not masked)
import re, requests, sys
sys.path.insert(0, "/app/backend/tests")
from test_privacy_onboarding import manager, BASE_URL, ST, MDB, TODAY
PAT = re.compile(r"\+?225[ ]?0[157][ ]?\d{2}[ ]?\d{2}[ ]?\d{2}[ ]?\d{2}")
m = manager()
paths = ["/api/invoices", "/api/customer-segments", "/api/segments", "/api/waitlist", "/api/encaissements", "/api/audit-logs", "/api/rider-reports", "/api/team", "/api/users", "/api/approval-requests",
         
         
         ]
for p in paths:
    r = m.get(BASE_URL + p)
    hits = PAT.findall(r.text) if r.status_code == 200 else []
    print(p, r.status_code, len(r.text), "FULL PHONES:" if hits else "", hits[:2])
for uid in ST["att"]:
    MDB.attendance.delete_many({"user_id": uid, "day": TODAY})
