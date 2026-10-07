"""
Rider CMS router — owner-managed customization of the livreur app.

Stores the config under db.site_settings.rider_cms. Exposes:
 - GET  /api/public/rider-cms   → public read (consumed by RiderShell)
 - GET  /api/rider-cms          → authenticated read (any staff)
 - PATCH /api/rider-cms         → admin/manager write
"""
from typing import Any, Dict
from fastapi import APIRouter, Depends

from deps import db, get_user, require_role, clean, now_iso

router = APIRouter(prefix="/api", tags=["rider-cms"])


DEFAULT_RIDER_CMS: Dict[str, Any] = {
    "logo": "",
    "primary_color": "#b02a2a",
    "accent_color": "#fff5f5",
    "greeting": "Bonjour {name}",
    "subtitle": "{brand} · Livreur",
    "announcement": {"enabled": False, "text": "", "variant": "info"},
    "help": {
        "enabled": True,
        "title": "Besoin d'aide ?",
        "content": "Appelez votre gérante · +225 07 77 92 61 79 · ou utilisez la messagerie interne.",
    },
    "tabs": [
        {"key": "courses", "to": "/rider", "icon": "Package", "label": "Courses", "visible": True, "builtin": True},
        {"key": "carte", "to": "/rider/carte", "icon": "Map", "label": "Carte", "visible": True, "builtin": True},
        {"key": "historique", "to": "/rider/historique", "icon": "History", "label": "Historique", "visible": True, "builtin": True},
        {"key": "performance", "to": "/rider/performance", "icon": "Trophy", "label": "Performance", "visible": True, "builtin": True},
        {"key": "profil", "to": "/rider/profil", "icon": "User", "label": "Profil", "visible": True, "builtin": True},
    ],
}


async def _load() -> Dict[str, Any]:
    s = await db.site_settings.find_one({"id": "main"}) or {}
    cfg = (s.get("rider_cms") or {})
    # Merge defaults so missing keys stay sane
    out = {**DEFAULT_RIDER_CMS, **cfg}
    out["announcement"] = {**DEFAULT_RIDER_CMS["announcement"], **(cfg.get("announcement") or {})}
    out["help"] = {**DEFAULT_RIDER_CMS["help"], **(cfg.get("help") or {})}
    out["tabs"] = cfg.get("tabs") or list(DEFAULT_RIDER_CMS["tabs"])
    return out


@router.get("/public/rider-cms")
async def public_rider_cms():
    return clean(await _load())


@router.get("/rider-cms")
async def rider_cms_get(user: dict = Depends(get_user)):
    return clean(await _load())


@router.patch("/rider-cms")
async def rider_cms_update(body: Dict[str, Any], user: dict = Depends(require_role("admin", "manager"))):
    body.pop("_id", None)
    current = await _load()
    merged = {**current, **{k: v for k, v in body.items() if v is not None}}
    # Keep tabs as list of dicts
    if "tabs" in body and isinstance(body["tabs"], list):
        merged["tabs"] = body["tabs"]
    await db.site_settings.update_one(
        {"id": "main"},
        {"$set": {"id": "main", "rider_cms": merged, "updated_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True, "rider_cms": clean(merged)}


@router.post("/rider-cms/reset")
async def rider_cms_reset(user: dict = Depends(require_role("admin"))):
    await db.site_settings.update_one(
        {"id": "main"},
        {"$set": {"id": "main", "rider_cms": DEFAULT_RIDER_CMS, "updated_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True, "rider_cms": DEFAULT_RIDER_CMS}
