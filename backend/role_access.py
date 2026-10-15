"""Console access for limited staff roles (vendeuse, magasinière, community manager).

Deny-by-default API allow-list per role + server-side removal of money fields they must not see.
"""
import json
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, Depends, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from deps import db, get_user

LIMITED_ROLES = ("sales", "stock_keeper", "community_manager")

COMMON = ("/api/auth/", "/api/attendance/me", "/api/attendance/check-in", "/api/me/", "/api/notifications",
          "/api/manual", "/api/users/me", "/api/push/", "/api/public/", "/api/dashboard/role", "/api/orders-messages")
COMMON_READ = ("/api/business", "/api/brands", "/api/categories", "/api/products", "/api/stock", "/api/zones")

ROLE_API = {
    "sales": {
        "full": ("/api/pos", "/api/orders", "/api/customers", "/api/messages", "/api/waitlist", "/api/abandoned-carts",
                 "/api/invoices", "/api/out-of-catalog"),
        "read": ("/api/stock-movements", "/api/segments"),
    },
    "stock_keeper": {
        "full": ("/api/products", "/api/stock", "/api/stock-movements", "/api/stock-alerts", "/api/brands", "/api/categories",
                 "/api/collections", "/api/suppliers", "/api/purchase-orders", "/api/orders", "/api/deliveries"),
        "read": ("/api/abandoned-carts",),
    },
    "community_manager": {
        "full": ("/api/messages", "/api/reviews", "/api/promotions", "/api/promo-types", "/api/campaigns", "/api/segments",
                 "/api/loyalty", "/api/referrals", "/api/site", "/api/pages", "/api/storefront", "/api/cms"),
        "read": ("/api/customers", "/api/orders", "/api/wallet", "/api/stock-movements"),
    },
}
# Site settings stay with the owner even for the community manager.
CM_DENY = ("/api/site/settings", "/api/site-settings")

# Never returned to limited roles.
COST_KEYS = {"cost", "cost_price", "purchase_price", "buy_price", "unit_cost", "avg_cost", "landed_cost", "total_cost",
             "margin", "margin_pct", "margin_rate", "gross_margin", "profit", "revenue", "stock_value", "cost_value"}
MONEY_KEYS = {"total", "subtotal", "discount", "delivery_fee", "amount", "unit_price", "total_spent", "spent", "ltv",
              "lifetime_value", "avg_basket", "wallet_balance", "total_paid", "paid", "balance", "price"}
# path prefix -> extra keys hidden for that role
EXTRA_HIDDEN = {
    "stock_keeper": {"/api/purchase-orders": MONEY_KEYS},
    "community_manager": {"/api/customers": MONEY_KEYS - {"price"}, "/api/orders": MONEY_KEYS - {"price"}, "/api/wallet": MONEY_KEYS},
}


def api_allowed(role: str, method: str, path: str) -> bool:
    rules = ROLE_API.get(role)
    if rules is None:
        return True
    if role == "community_manager" and path.startswith(CM_DENY):
        return False
    if path.startswith(COMMON) or path.startswith(rules["full"]):
        return True
    return method in ("GET", "HEAD") and (path.startswith(COMMON_READ) or path.startswith(rules["read"]))


def _strip(obj: Any, keys: set) -> Any:
    if isinstance(obj, dict):
        return {k: _strip(v, keys) for k, v in obj.items() if k not in keys}
    if isinstance(obj, list):
        return [_strip(v, keys) for v in obj]
    return obj


class LimitedRoleFieldFilter(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        resp = await call_next(request)
        role = getattr(request.state, "role", None)
        if role not in LIMITED_ROLES or "application/json" not in resp.headers.get("content-type", ""):
            return resp
        path = request.url.path
        if path.startswith(("/api/auth/", "/api/dashboard/role")):
            return resp
        keys = set(COST_KEYS)
        for prefix, extra in EXTRA_HIDDEN.get(role, {}).items():
            if path.startswith(prefix):
                keys |= extra
        body = b"".join([chunk async for chunk in resp.body_iterator])
        try:
            data = _strip(json.loads(body), keys)
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
