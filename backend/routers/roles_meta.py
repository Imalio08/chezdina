"""Roles catalogue: built-in + custom roles, each renamable and (de)activable — no role list hard-coded in the UI."""
import time
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException

from deps import db, get_user, require_role, now_iso, new_id

router = APIRouter(prefix="/api", tags=["roles-meta"])
BUILTIN = [("admin", "Propriétaire"), ("manager", "Gérante"), ("sales", "Vendeuse"), ("stock_keeper", "Stock"),
           ("community_manager", "Community manager"), ("rider", "Livreur")]
_cache = {"at": 0.0, "inactive": set()}


async def all_roles():
    meta = {m["key"]: m for m in await db.role_meta.find({}).to_list(200)}
    out = [{"key": k, "label": (meta.get(k) or {}).get("label") or lbl, "active": (meta.get(k) or {}).get("active", True), "builtin": True} for k, lbl in BUILTIN]
    for r in await db.roles.find({}).to_list(200):
        if r.get("key") and r["key"] not in [x["key"] for x in out]:
            m = meta.get(r["key"]) or {}
            out.append({"key": r["key"], "label": m.get("label") or r.get("name") or r["key"], "active": m.get("active", r.get("active", True)), "builtin": False, "id": r.get("id")})
    perms = (await db.roles_permissions.find_one({"id": "main"}) or {}).get("matrix") or {}
    for k in perms:
        if k not in [x["key"] for x in out]:
            m = meta.get(k) or {}
            out.append({"key": k, "label": m.get("label") or k.replace("_", " ").capitalize(), "active": m.get("active", True), "builtin": False})
    return out


async def inactive_roles() -> set:
    if time.time() - _cache["at"] > 30:
        _cache["inactive"] = {m["key"] for m in await db.role_meta.find({"active": False}, {"key": 1}).to_list(200)}
        _cache["at"] = time.time()
    return _cache["inactive"]


@router.get("/roles/all")
async def roles_all(user: dict = Depends(get_user)):
    return await all_roles()


@router.patch("/roles/meta/{key}")
async def roles_meta(key: str, body: Dict[str, Any], user: dict = Depends(require_role("admin"))):
    upd: Dict[str, Any] = {"key": key, "updated_at": now_iso()}
    if "label" in body:
        label = str(body["label"] or "").strip()[:40]
        if not label:
            raise HTTPException(400, "Nom du rôle obligatoire")
        upd["label"] = label
    if "active" in body:
        if key == "admin" and not body["active"]:
            raise HTTPException(400, "Le rôle Propriétaire ne peut pas être désactivé")
        upd["active"] = bool(body["active"])
    await db.role_meta.update_one({"key": key}, {"$set": upd}, upsert=True)
    _cache["at"] = 0.0
    await db.audit_log.insert_one({"id": new_id(), "user_id": user.get("id"), "user_name": user.get("name"), "action": "role.meta", "entity_id": key, "after": upd, "at": now_iso()})
    return {"ok": True}
