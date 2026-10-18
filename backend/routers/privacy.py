"""Customer-data protection: masked phones, record-opening log + alerts, device / hours access policy, instant deactivation."""
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request

from deps import db, get_user, require_role, new_id, now_iso, clean

router = APIRouter(prefix="/api", tags=["privacy"])
ABJ = ZoneInfo("Africa/Abidjan")
DEFAULTS = {"alert_threshold": 20, "alert_window_min": 10, "restricted_roles": ["manager"],
            "enforce_devices": False, "enforce_hours": False,
            "hours": {"days": [0, 1, 2, 3, 4, 5], "start": "08:00", "end": "20:00"}}
OWNER_ONLY = re.compile(r"^/api/(campaigns|whatsapp-campaigns|whatsapp-outbox/broadcast|messages/broadcast|admin/sync/export)")
_cache: Dict[str, Any] = {"at": 0.0, "cfg": None}


def mask_phone(p: Optional[str]) -> Optional[str]:
    d = "".join(ch for ch in (p or "") if ch.isdigit())
    if d.startswith("225") and len(d) > 10:
        d = d[3:]
    return f"{d[:2]} •• •• •• {d[-2:]}" if len(d) >= 4 else None


async def privacy_cfg() -> Dict[str, Any]:
    if time.time() - _cache["at"] > 30 or _cache["cfg"] is None:
        biz = await db.business.find_one({"id": "main"}, {"privacy": 1}) or {}
        _cache.update(at=time.time(), cfg={**DEFAULTS, **(biz.get("privacy") or {})})
    return _cache["cfg"]


def device_id(request: Request) -> str:
    return (request.headers.get("x-device-id") or "").strip()[:80]


def client_ip(request: Request) -> str:
    return (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "")).split(",")[0].strip()


async def enforce_access(user: Dict[str, Any], request: Request) -> None:
    """Restricted roles (Gérante by default): approved devices only, within owner-set hours. Raises 403."""
    path = request.url.path
    if user.get("role") != "admin" and OWNER_ONLY.match(path):
        raise HTTPException(403, "Réservé au propriétaire")
    cfg = await privacy_cfg()
    if user.get("role") not in (cfg.get("restricted_roles") or []) or path == "/api/auth/logout":
        return
    if cfg.get("enforce_hours"):
        h = cfg.get("hours") or {}
        now = datetime.now(ABJ)
        hm = now.strftime("%H:%M")
        if now.weekday() not in (h.get("days") or []) or not (h.get("start", "00:00") <= hm < h.get("end", "23:59")):
            raise HTTPException(403, f"Accès à la console autorisé uniquement pendant les horaires fixés ({h.get('start')}–{h.get('end')})")
    if cfg.get("enforce_devices"):
        did = device_id(request)
        dev = await db.staff_devices.find_one({"device_id": did}) if did else None
        if not dev or dev.get("status") != "approved":
            if did and not dev:
                await db.staff_devices.insert_one({"id": new_id(), "device_id": did, "status": "pending", "label": "",
                                                   "requested_by": user.get("name"), "requested_by_id": user["id"],
                                                   "ua": (request.headers.get("user-agent") or "")[:200], "ip": client_ip(request), "at": now_iso()})
                from routers.notify import notify
                async for a in db.users.find({"role": "admin"}, {"id": 1}):
                    await notify("staff", a["id"], "Nouvel appareil à autoriser", f"{user.get('name')} tente de se connecter depuis un appareil inconnu.",
                                 "/console/equipe?onglet=securite", "security", None, f"device:{did}")
            raise HTTPException(403, "Appareil non autorisé · une demande a été envoyée au propriétaire")


async def log_customer_open(user: Dict[str, Any], cid: str, name: str, request: Request) -> None:
    if user.get("role") == "admin":
        return
    await db.customer_access_log.insert_one({"id": new_id(), "user_id": user["id"], "user_name": user.get("name"), "role": user.get("role"),
                                             "customer_id": cid, "customer_name": name, "ip": client_ip(request), "at": now_iso()})
    cfg = await privacy_cfg()
    win = int(cfg.get("alert_window_min") or 10)
    since = (datetime.now(timezone.utc) - timedelta(minutes=win)).isoformat()
    n = len(await db.customer_access_log.distinct("customer_id", {"user_id": user["id"], "at": {"$gte": since}}))
    if n >= int(cfg.get("alert_threshold") or 20):
        slot = int(time.time() // (win * 60))
        from routers.notify import notify
        await db.privacy_alerts.update_one({"key": f"{user['id']}:{slot}"}, {"$setOnInsert": {
            "id": new_id(), "user_id": user["id"], "user_name": user.get("name"), "count": n, "window_min": win, "at": now_iso()}}, upsert=True)
        async for a in db.users.find({"role": "admin"}, {"id": 1}):
            await notify("staff", a["id"], "Alerte · consultation inhabituelle de fiches clientes",
                         f"{user.get('name')} a ouvert {n} fiches clientes en {win} min.", "/console/equipe?onglet=securite",
                         "security", None, f"privacy:{user['id']}:{slot}")


@router.get("/privacy/settings")
async def get_settings(user: dict = Depends(require_role("admin"))):
    return await privacy_cfg()


@router.put("/privacy/settings")
async def put_settings(body: Dict[str, Any], user: dict = Depends(require_role("admin"))):
    cfg = {k: body[k] for k in DEFAULTS if k in body}
    if "alert_threshold" in cfg and int(cfg["alert_threshold"]) < 1:
        raise HTTPException(400, "Seuil invalide")
    await db.business.update_one({"id": "main"}, {"$set": {f"privacy.{k}": v for k, v in cfg.items()}}, upsert=True)
    _cache["at"] = 0.0
    return await privacy_cfg()


@router.get("/privacy/devices")
async def list_devices(request: Request, user: dict = Depends(require_role("admin"))):
    rows = await db.staff_devices.find({}).sort("at", -1).to_list(200)
    return {"devices": clean(rows), "current_device": device_id(request)}


@router.post("/privacy/devices/current")
async def approve_current(body: Dict[str, Any], request: Request, user: dict = Depends(require_role("admin"))):
    did = device_id(request)
    if not did:
        raise HTTPException(400, "Appareil non identifié")
    await db.staff_devices.update_one({"device_id": did}, {"$set": {"status": "approved", "label": (body.get("label") or "Tablette boutique")[:60],
                                                                    "approved_by": user.get("name"), "approved_at": now_iso()},
                                                           "$setOnInsert": {"id": new_id(), "at": now_iso(), "ua": (request.headers.get("user-agent") or "")[:200]}}, upsert=True)
    return {"ok": True}


@router.patch("/privacy/devices/{did}")
async def patch_device(did: str, body: Dict[str, Any], user: dict = Depends(require_role("admin"))):
    upd: Dict[str, Any] = {}
    if body.get("status") in ("approved", "revoked"):
        upd.update(status=body["status"], approved_by=user.get("name"), approved_at=now_iso())
    if "label" in body:
        upd["label"] = str(body["label"])[:60]
    r = await db.staff_devices.update_one({"id": did}, {"$set": upd})
    if not r.matched_count:
        raise HTTPException(404, "Appareil introuvable")
    return {"ok": True}


@router.delete("/privacy/devices/{did}")
async def delete_device(did: str, user: dict = Depends(require_role("admin"))):
    await db.staff_devices.delete_one({"id": did})
    return {"ok": True}


async def revoke_sessions(uid: str, deactivate: bool) -> None:
    upd: Dict[str, Any] = {"$inc": {"session_version": 1}}
    if deactivate:
        upd["$set"] = {"active": False, "deactivated_at": now_iso()}
    await db.users.update_one({"id": uid}, upd)


@router.post("/privacy/users/{uid}/deactivate")
async def deactivate(uid: str, user: dict = Depends(require_role("admin"))):
    t = await db.users.find_one({"id": uid}, {"role": 1})
    if not t:
        raise HTTPException(404, "Employé introuvable")
    if t.get("role") == "admin":
        raise HTTPException(400, "Le compte propriétaire ne peut pas être désactivé")
    await revoke_sessions(uid, True)
    await db.audit_log.insert_one({"id": new_id(), "action": "user.deactivate", "target": uid, "by": user.get("name"), "at": now_iso()})
    return {"ok": True}


@router.post("/privacy/users/{uid}/reactivate")
async def reactivate(uid: str, user: dict = Depends(require_role("admin"))):
    await db.users.update_one({"id": uid}, {"$set": {"active": True}, "$unset": {"deactivated_at": ""}})
    return {"ok": True}


@router.get("/privacy/access-log")
async def access_log(user: dict = Depends(require_role("admin")), user_id: Optional[str] = None, customer_id: Optional[str] = None, limit: int = 100):
    f: Dict[str, Any] = {}
    if user_id:
        f["user_id"] = user_id
    if customer_id:
        f["customer_id"] = customer_id
    rows = await db.customer_access_log.find(f).sort("at", -1).to_list(min(limit, 500))
    alerts = await db.privacy_alerts.find({}).sort("at", -1).to_list(30)
    return {"rows": clean(rows), "alerts": clean(alerts)}
