"""Audit: for each limited role, list write routes on allowed prefixes whose require_role excludes that role."""
import re, glob, sys
sys.path.insert(0, "/app/backend")
from role_access import ROLE_API, COMMON

files = ["/app/backend/server.py"] + glob.glob("/app/backend/routers/*.py")
pat = re.compile(r'@(?:api|router|app)\.(get|post|patch|put|delete)\("([^"]+)"')
routes = []
for f in files:
    src = open(f).read().split("\n")
    for i, line in enumerate(src):
        m = pat.search(line)
        if not m:
            continue
        sig = " ".join(src[i:i + 4])
        rr = re.search(r'require_role\(([^)]*)\)', sig)
        roles = re.findall(r'"(\w+)"', rr.group(1)) if rr else None
        prefix = "/api" if "router = APIRouter(prefix=\"/api\")" in open(f).read() or f.endswith("server.py") else ""
        routes.append((m.group(1).upper(), "/api" + m.group(2) if not m.group(2).startswith("/api") else m.group(2), roles, f.split("/")[-1]))

for role, rules in ROLE_API.items():
    print(f"=== {role}")
    for meth, path, roles, f in routes:
        if roles is None:
            continue
        if path.startswith(rules["full"]) or (meth == "GET" and path.startswith(rules["read"] + ("/api/business", "/api/brands", "/api/categories", "/api/products", "/api/stock", "/api/zones"))):
            if role not in roles:
                print(f"  {meth} {path} -> require_role{roles} ({f})")
