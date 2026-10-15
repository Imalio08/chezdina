"""Scan all parameter-less GET routes allowed for each limited role; report status + suspicious money keys."""
import re, glob, sys, requests
sys.path.insert(0, "/app/backend"); sys.path.insert(0, "/app/backend/tests")
from role_access import api_allowed
from test_role_access_limited import sess, BASE_URL, _walk_keys, cleanup  # noqa

SUS = re.compile(r"(cost|cout|coût|marg|profit|revenue|chiffre|^ca$|^ca_|benef|achat_total|purchase_price|valeur)", re.I)
files = ["/app/backend/server.py"] + glob.glob("/app/backend/routers/*.py")
pat = re.compile(r'@(?:api|router)\.get\("([^"]+)"')
paths = sorted({"/api" + m.group(1) for f in files for m in pat.finditer(open(f).read()) if "{" not in m.group(1)})
for role in ("sales", "stock_keeper", "community_manager"):
    s = sess(role)
    print("=====", role)
    for p in paths:
        if not api_allowed(role, "GET", p) or p.startswith("/api/public/"):
            continue
        try:
            r = s.get(BASE_URL + p, timeout=20)
        except Exception as e:
            print("  ERR", p, e); continue
        keys = set()
        if r.headers.get("content-type", "").startswith("application/json"):
            try: keys = {k for k in _walk_keys(r.json()) if SUS.search(str(k))}
            except Exception: pass
        if r.status_code >= 400 or keys:
            print(f"  {r.status_code} {p} {sorted(keys)[:10]} {r.text[:80] if r.status_code>=400 else ''}")
