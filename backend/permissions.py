"""Permission matrix actually applied: each console page (module) has a level per role (none/read/write/full), enforced on the API."""
import time
from typing import Dict, Optional, Tuple

from deps import db

LV = {"none": 0, "read": 1, "write": 2, "full": 3}
M, S, K, C = "manager", "sales", "stock_keeper", "community_manager"
BUILTIN = ("manager", "sales", "stock_keeper", "community_manager")

# console page -> (API prefixes it owns, API prefixes it may only read), default roles (mirrors frontend rbac.PATH_ROLES)
MODULES: Dict[str, Tuple[tuple, tuple, list]] = {
    "/console": (("/api/dashboard",), (), [M, S, K, C]),
    "/console/pos": (("/api/pos", "/api/cash-movements"), ("/api/customers", "/api/promotions", "/api/wallet", "/api/cash-sessions", "/api/orders", "/api/users"), [M, S]),
    "/console/commandes": (("/api/orders", "/api/invoices", "/api/out-of-catalog"), ("/api/customers", "/api/deliveries", "/api/riders", "/api/users"), [M, S, K]),
    "/console/sessions-caisse": (("/api/cash-sessions", "/api/manager-balance"), ("/api/users",), [M]),
    "/console/liste-attente": (("/api/waitlist",), (), [M, S]),
    "/console/paniers-abandonnes": (("/api/abandoned-carts",), (), [M, S]),
    "/console/livraisons": (("/api/deliveries", "/api/delivery-templates"), ("/api/orders", "/api/riders", "/api/users"), [M]),
    "/console/journees-livraison": (("/api/delivery-sessions",), ("/api/riders",), [M]),
    "/console/livreurs": (("/api/riders", "/api/rider-reports", "/api/rider-cms"), (), [M]),
    "/console/zones": (("/api/zones",), (), [M]),
    "/console/produits": (("/api/products", "/api/ai"), (), [M, S, K, C]),
    "/console/marques": (("/api/brands",), (), [M, K]),
    "/console/categories": (("/api/categories", "/api/collections"), (), [M, K]),
    "/console/fournisseurs": (("/api/suppliers",), (), [M, K]),
    "/console/achats": (("/api/purchase-orders",), ("/api/suppliers",), [M, K]),
    "/console/stock": (("/api/stock", "/api/stock-movements", "/api/stock-alerts"), (), [M, S, K]),
    "/console/clients": (("/api/customers", "/api/wallet", "/api/customer-segments"), (), [M, S, C]),
    "/console/messagerie": (("/api/messages",), ("/api/customers",), [M, S, C]),
    "/console/promotions": (("/api/promotions", "/api/promo-types"), (), [M, C]),
    "/console/fidelite": (("/api/loyalty",), (), [M, C]),
    "/console/parrainage": (("/api/referrals",), (), [M, C]),
    "/console/avis": (("/api/reviews",), (), [M, C]),
    "/console/statistiques": (("/api/stats", "/api/analytics"), (), [M]),
    "/console/depenses": (("/api/expenses", "/api/expense-categories", "/api/expense-requests"), (), [M]),
    "/console/encaissements": (("/api/encaissements",), (), [M]),
    "/console/finances": (("/api/profit-loss",), (), []),
    "/console/equipe": (("/api/users", "/api/team"), (), []),
    "/console/approbations": ((), (), []),
    "/console/site": (("/api/site", "/api/pages", "/api/storefront"), (), [C]),
    "/console/parametres": (("/api/integrations", "/api/stores"), (), []),
    "/console/audit": (("/api/audit-logs",), (), []),
}
_cache: Dict[str, object] = {"at": 0.0, "v2": None}


def default_level(role: str, page: str) -> str:
    roles = MODULES[page][2]
    if role not in roles:
        return "none"
    return "full" if role == "manager" else "write"


async def _v2() -> Dict[str, Dict[str, str]]:
    if time.time() - float(_cache["at"]) > 15 or _cache["v2"] is None:
        doc = await db.roles_permissions.find_one({"id": "main"}, {"v2": 1}) or {}
        _cache.update(at=time.time(), v2=doc.get("v2") or {})
    return _cache["v2"]  # type: ignore[return-value]


def invalidate() -> None:
    _cache["at"] = 0.0


async def role_levels(role: str) -> Dict[str, str]:
    if role == "admin":
        return {p: "full" for p in MODULES}
    saved = (await _v2()).get(role) or {}
    return {p: saved.get(p) if saved.get(p) in LV else default_level(role, p) for p in MODULES}


async def check(role: str, method: str, path: str) -> Optional[bool]:
    """True/False when a module covers this API path; None when no module does (legacy rules apply)."""
    from role_access import COMMON, COMMON_READ, READ
    if path.startswith(COMMON) or (method in READ and path.startswith(COMMON_READ)):
        return None
    levels = await role_levels(role)
    need = 1 if method in READ else 3 if method == "DELETE" else 2
    best = -1
    for page, (own, reads, _) in MODULES.items():
        lv = LV[levels[page]]
        if path.startswith(own):
            best = max(best, lv)
        elif reads and method in READ and path.startswith(reads):
            best = max(best, min(lv, 1))
    if best < 0:
        return None
    return best >= need
