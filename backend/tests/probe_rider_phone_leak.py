# Probe: rider-accessible endpoints must never return a customer phone number
import re, requests, sys
sys.path.insert(0, "/app/backend/tests")
from test_privacy_onboarding import rider1, BASE_URL, EN_LIV, _tok
PAT = re.compile(r"\+?225[ ]?0[157][ ]?\d{2}[ ]?\d{2}[ ]?\d{2}[ ]?\d{2}")
r = rider1()
rid = _tok["rider_id"]
paths = ["/api/riders/me/today", "/api/riders/me/history?days=365", f"/api/riders/me/orders/{EN_LIV}", "/api/riders/me/versements-rejetes",
         f"/api/riders/{rid}/reviews", f"/api/riders/{rid}/kpis", f"/api/riders/{rid}/score", "/api/riders/locations", "/api/rider/reports",
         "/api/orders-messages/unread", f"/api/orders-messages/{EN_LIV}", f"/api/orders/{EN_LIV}/messages", "/api/me/notifications", "/api/notifications",
         "/api/delivery-templates", "/api/auth/me", "/api/business", "/api/deliveries/suggest-split", f"/api/deliveries/{EN_LIV}"]
for p in paths:
    x = r.get(BASE_URL + p)
    hits = PAT.findall(x.text) if x.status_code == 200 else []
    print(p, x.status_code, len(x.text), "PHONE LEAK:" if hits else "", hits[:2])
