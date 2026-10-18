"""Console access for limited staff roles (vendeuse, magasinière, community manager).

Deny-by-default API allow-list per role + server-side removal of money fields they must not see.
Inside its allow-list a limited role gets the gérante's permissions (see deps.require_role).
"""
import json
import re
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, Depends, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from deps import db, get_user

LIMITED_ROLES = ("sales", "stock_keeper", "community_manager")
READ = ("GET", "HEAD")

COMMON = ("/api/auth/", "/api/attendance/", "/api/attendance/me", "/api/attendance/check-in", "/api/attendance/today-kiosk", "/api/me/",
          "/api/notifications", "/api/manual", "/api/users/me", "/api/push/", "/api/public/", "/api/dashboard/role",
          "/api/orders-messages", "/api/onboarding/me", "/api/onboarding/files/", "/api/onboarding/employees/")
COMMON_READ = ("/api/business", "/api/brands", "/api/categories", "/api/products", "/api/stock", "/api/zones")

ROLE_API = {
    "sales": {
        "full": ("/api/pos", "/api/orders", "/api/customers", "/api/messages", "/api/waitlist", "/api/abandoned-carts",
                 "/api/invoices", "/api/out-of-catalog", "/api/cash-sessions"),
        "read": ("/api/stock-movements", "/api/segments"),
        "rules": (),
    },
    "stock_keeper": {
        "full": ("/api/products", "/api/stock", "/api/stock-movements", "/api/stock-alerts", "/api/brands", "/api/categories",
                 "/api/collections", "/api/suppliers", "/api/purchase-orders", "/api/deliveries"),
        "read": ("/api/abandoned-carts", "/api/orders"),
        "rules": ((("PATCH",), re.compile(r"^/api/orders/[^/]+/status(-v3)?$")),),
    },
    "community_manager": {
        "full": ("/api/messages", "/api/reviews", "/api/promotions", "/api/promo-types", "/api/campaigns", "/api/segments",
                 "/api/loyalty", "/api/referrals", "/api/site", "/api/pages", "/api/storefront", "/api/cms"),
        "read": ("/api/customers", "/api/orders", "/api/wallet", "/api/stock-movements"),
        "rules": (),
    },
}

# Any key naming a purchase cost, margin, profit or turnover is removed for limited roles (and on public routes).
SENSITIVE_RE = re.compile(r"(cost|cout|coût|marge|margin|profit|revenue|benefice|bénéfice|landed|^ca$|^ca_|_ca$)", re.I)
MONEY_KEYS = {"total", "subtotal", "discount", "delivery_fee", "amount", "unit_price", "total_spent", "spent", "ltv",
              "lifetime_value", "avg_basket", "wallet", "wallet_balance", "total_paid", "paid", "balance", "price",
              "total_month", "due", "valeur_vente"}
EXTRA_HIDDEN = {
    "stock_keeper": {"/api/purchase-orders": MONEY_KEYS},
    "community_manager": {"/api/customers": MONEY_KEYS - {"price"}, "/api/orders": MONEY_KEYS - {"price"}, "/api/wallet": MONEY_KEYS},
}


# Sensitive gérante actions that stay out of reach even inside a role's prefixes.
W = ("POST", "PATCH", "PUT", "DELETE")
DENY_ALL = (
    (W, re.compile(r"^/api/manual/modules")),
    (W, re.compile(r"/wallet/adjust")),
)
DENY = {
    "sales": (
        (("DELETE",), re.compile(r"^/api/")),
        (W, re.compile(r"^/api/customers/bulk|/regen-access-code|/mark-deposit-paid|/wave-verify|^/api/messages/broadcast")),
    ),
    "stock_keeper": (
        (("DELETE",), re.compile(r"^/api/")),
        (W, re.compile(r"^/api/products/bulk|^/api/deliveries/[^/]+/assign")),
    ),
    "community_manager": (
        (("DELETE",), re.compile(r"^/api/(?!promotions|promo-types|campaigns|segments|pages|storefront)")),
    ),
}


def api_allowed(role: str, method: str, path: str) -> bool:
    rules = ROLE_API.get(role)
    if rules is None:
        return True
    if any(method in m and rx.search(path) for m, rx in DENY.get(role, ()) + DENY_ALL):
        return False
    if path.startswith(COMMON) or path.startswith(rules["full"]):
        return True
    if method in READ and (path.startswith(COMMON_READ) or path.startswith(rules["read"])):
        return True
    return any(method in m and rx.match(path) for m, rx in rules["rules"])


# Customer phones are masked for every non-owner on customer-facing lists; the full number only comes from GET /api/customers/{id} (logged).
PHONE_MASKED = ("/api/customers", "/api/orders", "/api/deliveries", "/api/delivery-sessions", "/api/whatsapp-outbox", "/api/invoices",
                "/api/reviews", "/api/abandoned-carts", "/api/waitlist", "/api/segments", "/api/loyalty", "/api/referrals", "/api/wallet",
                "/api/notifications", "/api/messages", "/api/conversations", "/api/opportunit", "/api/search", "/api/dashboard", "/api/campaigns",
                "/api/out-of-catalog", "/api/me/notifications", "/api/ask", "/api/ai")
CUSTOMER_RECORD = re.compile(r"^/api/customers/[^/]+$")
PHONE_KEYS = {"phone", "customer_phone", "to", "to_phone", "whatsapp", "phone_digits", "digits"}
PHONE_RE = re.compile(r"^\+?[\d\s().-]{8,}$")
# Phone numbers embedded in free text / wa.me links (8+ digits, optional +225 and spaces).
PHONE_IN_TEXT = re.compile(r"(?<![\w/-])(?:\+?225[\s.]?)?0\d(?:[\s.]?\d{2}){4}(?!\d)|(?<=wa\.me/)\d{8,15}")


def _mask_phones(obj: Any) -> Any:
    from routers.privacy import mask_phone
    if isinstance(obj, dict):
        return {k: (mask_phone(v) if k in PHONE_KEYS and isinstance(v, str) and PHONE_RE.match(v) else _mask_phones(v)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_mask_phones(v) for v in obj]
    if isinstance(obj, str) and sum(ch.isdigit() for ch in obj) >= 8:
        return PHONE_IN_TEXT.sub(lambda m: mask_phone(m.group(0)) or "••", obj)
    return obj


def _strip(obj: Any, extra: set) -> Any:
    if isinstance(obj, dict):
        return {k: _strip(v, extra) for k, v in obj.items() if k not in extra and not SENSITIVE_RE.search(k)}
    if isinstance(obj, list):
        return [_strip(v, extra) for v in obj]
    return obj


class LimitedRoleFieldFilter(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        resp = await call_next(request)
        path = request.url.path
        role = getattr(request.state, "role", None)
        public = path.startswith("/api/public/")
        if "application/json" not in resp.headers.get("content-type", ""):
            return resp
        mask = role not in (None, "admin") and request.method == "GET" and path.startswith(PHONE_MASKED) and not CUSTOMER_RECORD.match(path)
        if (role not in LIMITED_ROLES and not public) and not mask:
            return resp
        if path.startswith(("/api/auth/", "/api/dashboard/role")):
            return resp
        extra: set = set()
        for prefix, keys in EXTRA_HIDDEN.get(role, {}).items():
            if path.startswith(prefix):
                extra |= keys
        body = b"".join([chunk async for chunk in resp.body_iterator])
        try:
            data = json.loads(body)
            if role in LIMITED_ROLES or public:
                data = _strip(data, extra)
            if mask:
                data = _mask_phones(data)
        except ValueError:
            return Response(body, status_code=resp.status_code, headers=dict(resp.headers))
        headers = {k: v for k, v in resp.headers.items() if k.lower() != "content-length"}
        return Response(json.dumps(data, ensure_ascii=False), status_code=resp.status_code, headers=headers, media_type="application/json")


router = APIRouter(prefix="/api")


@router.get("/dashboard/role")
async def role_dashboard(user: dict = Depends(get_user)) -> Dict[str, Any]:
    role = user.get("role")
    today = datetime.now(timezone.utc).date().isoformat()
    out: Dict[str, Any] = {"role": role}
    if role in ("sales", "stock_keeper"):
        out["to_process"] = await db.orders.count_documents({"status": {"$in": ["nouvelle", "confirmee"]}})
        out["to_prepare"] = await db.orders.count_documents({"status": {"$in": ["confirmee", "en_preparation"]}})
    if role == "sales":
        mine = {"created_at": {"$gte": today}, "status": {"$nin": ["annulee", "retournee", "echouee"]},
                "$or": [{"created_by_id": user["id"]}, {"created_by": user.get("name")}]}
        rows = await db.orders.find(mine, {"total": 1}).to_list(2000)
        out["my_sales_count"] = len(rows)
        out["my_sales_total"] = sum(float(r.get("total") or 0) for r in rows)
        out["waitlist"] = await db.waitlist.count_documents({"notified": {"$ne": True}})
    if role == "stock_keeper":
        out["low_stock"] = await db.products.count_documents({"stock": {"$lte": 3}, "status": {"$ne": "archived"}})
        out["out_of_stock"] = await db.products.count_documents({"stock": {"$lte": 0}, "status": {"$ne": "archived"}})
        out["purchases_pending"] = await db.purchase_orders.count_documents({"status": {"$in": ["en_attente", "en_transit"]}})
    if role == "community_manager":
        out["reviews_pending"] = await db.reviews.count_documents({"status": "pending"})
        out["active_promotions"] = await db.promotions.count_documents({"active": True})
        out["campaigns"] = await db.campaigns.count_documents({})
    if role in ("sales", "community_manager"):
        convs = await db.conversations.find({"closed": {"$ne": True}}, {"messages": {"$slice": -20}}).to_list(500)
        out["unread_messages"] = sum(1 for c in convs for m in (c.get("messages") or [])
                                     if m.get("from_kind") != "store" and user["id"] not in (m.get("read_by") or []))
    return out
