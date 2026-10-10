"""
Attendance & working-hours router.

Owns the modern selfie-only pointage endpoints and the per-business
attendance configuration (geofence legacy, working hours, enabled roles).
Extracted from the historical server.py monolith (P5 Refactor, Feb 2026).
"""
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException

from deps import db, get_user, require_role, clean, new_id, now_iso

router = APIRouter(prefix="/api", tags=["attendance"])


@router.get("/attendance/me")
async def attendance_me(user: dict = Depends(get_user)):
    today = datetime.now(timezone.utc).date().isoformat()
    arr = await db.attendance.find_one({"user_id": user.get("id"), "day": today, "kind": "arrival"})
    dep = await db.attendance.find_one({"user_id": user.get("id"), "day": today, "kind": "departure"})
    return {"checked_in": bool(arr), "arrival": clean(arr), "departure": clean(dep)}


@router.post("/attendance/check-in")
async def check_in(body: Dict[str, Any], user: dict = Depends(get_user)):
    """kind: 'arrival' | 'departure'. Requires live selfie (b64). Optional PIN
    double-checks identity (if provided, must match user.pin_hash)."""
    kind = body.get("kind", "arrival")
    method = body.get("method", "phone")  # phone | tablet
    selfie = body.get("selfie")
    pin = (body.get("pin") or "").strip()
    if not selfie:
        raise HTTPException(400, "Selfie requis (caméra avant)")
    if pin:
        import bcrypt
        pin_hash = user.get("pin_hash")
        if not pin_hash or not bcrypt.checkpw(pin.encode(), pin_hash.encode()):
            raise HTTPException(401, "PIN incorrect")
    today = datetime.now(timezone.utc).date().isoformat()
    now = datetime.now(timezone.utc)
    biz = await db.business.find_one({"id": "main"}) or {}
    hours = (biz.get("working_hours") or {}).get(user.get("role", "")) or {"open": "08:00", "tolerance_min": 10}
    late = False
    late_min = 0
    if kind == "arrival":
        oh, om = (hours.get("open", "08:00").split(":") + ["00"])[:2]
        open_dt = now.replace(hour=int(oh), minute=int(om), second=0, microsecond=0)
        tol = int(hours.get("tolerance_min", 10))
        delta = int((now - open_dt).total_seconds() / 60)
        if delta > tol:
            late = True
            late_min = delta
    flags = []
    if kind == "departure" and user.get("role") == "rider":
        pending_recon = await db.delivery_sessions.count_documents({"rider_id": user.get("id"), "status": {"$ne": "reconciled"}})
        if pending_recon > 0:
            flags.append("depart_sans_reconciliation")
            await db.notifications.insert_one({
                "id": new_id(), "type": "attendance_alert",
                "title": "Départ sans réconciliation",
                "msg": f"{user.get('name')} a pointé le départ sans réconcilier ses livraisons",
                "color": "#c62828", "at": now_iso(), "link": "/console/livraisons",
            })
    doc = {
        "id": new_id(),
        "user_id": user.get("id"), "user_name": user.get("name"), "user_role": user.get("role"),
        "day": today, "kind": kind, "method": method, "at": now_iso(), "selfie": selfie,
        "lat": None, "lng": None, "distance_m": None, "outside": False,
        "late": late, "late_min": late_min, "flags": flags,
    }
    await db.attendance.insert_one(doc)
    return {"ok": True, "late": late, "late_min": late_min, "flags": flags, "at": doc["at"]}


@router.get("/attendance/today")
async def attendance_today(user: dict = Depends(require_role("admin", "manager"))):
    today = datetime.now(timezone.utc).date().isoformat()
    rows = await db.attendance.find({"day": today}).sort("at", -1).to_list(200)
    all_employees = await db.users.find(
        {"role": {"$in": ["manager", "rider", "caissiere", "sales", "stock_keeper", "community_manager"]}, "active": True}
    ).to_list(200)
    present_ids = {r["user_id"] for r in rows if r["kind"] == "arrival"}
    not_checked = [{"id": u["id"], "name": u["name"], "role": u["role"]} for u in all_employees if u["id"] not in present_ids]
    return {"today": clean(rows), "not_checked_in": not_checked, "present_count": len(present_ids), "total_employees": len(all_employees)}


@router.get("/attendance/calendar/{eid}")
async def attendance_calendar(eid: str, month: Optional[str] = None, user: dict = Depends(require_role("admin", "manager"))):
    """Per-day status for a given employee and month (YYYY-MM)."""
    now = datetime.now(timezone.utc)
    ym = month or now.strftime("%Y-%m")
    rows = await db.attendance.find({"user_id": eid, "day": {"$regex": f"^{ym}"}}).to_list(1000)
    days: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        d = days.setdefault(r["day"], {"arrival": None, "departure": None, "late": False, "late_min": 0, "flags": []})
        if r["kind"] == "arrival":
            d["arrival"] = r["at"]
            d["late"] = r.get("late", False)
            d["late_min"] = r.get("late_min", 0)
        if r["kind"] == "departure":
            d["departure"] = r["at"]
        d["flags"] = list(set(d["flags"] + (r.get("flags") or [])))
    return {"month": ym, "days": days}


@router.get("/attendance/stats/{eid}")
async def attendance_stats(eid: str, days: int = 30, user: dict = Depends(require_role("admin", "manager"))):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
    rows = await db.attendance.find({"user_id": eid, "day": {"$gte": cutoff}}).to_list(1000)
    worked_days = len({r["day"] for r in rows if r["kind"] == "arrival"})
    late_count = sum(1 for r in rows if r["kind"] == "arrival" and r.get("late"))
    total_late_min = sum(r.get("late_min", 0) for r in rows)
    outside = sum(1 for r in rows if r.get("outside"))
    arrivals = [r for r in rows if r["kind"] == "arrival" and r.get("at")]
    avg_arrival_h = None
    if arrivals:
        total_min = sum(
            (datetime.fromisoformat(r["at"].replace("Z", "+00:00")).hour * 60 + datetime.fromisoformat(r["at"].replace("Z", "+00:00")).minute)
            for r in arrivals
        )
        avg = total_min // len(arrivals)
        avg_arrival_h = f"{avg//60:02d}:{avg%60:02d}"
    return {
        "worked_days": worked_days, "late_count": late_count, "late_min_total": total_late_min,
        "outside_count": outside,
        "punctuality_pct": round((worked_days - late_count) / max(1, worked_days) * 100, 1),
        "avg_arrival": avg_arrival_h,
    }


@router.get("/attendance/all-stats")
async def attendance_all_stats(days: int = 30, user: dict = Depends(require_role("admin", "manager"))):
    """Bulk ponctualité/retards/absences per employee for CSV/PDF export."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
    employees = await db.users.find(
        {"role": {"$in": ["manager", "sales", "stock_keeper", "community_manager", "rider"]}, "active": True},
        {"id": 1, "name": 1, "role": 1},
    ).to_list(500)
    out = []
    for u in employees:
        rows = await db.attendance.find({"user_id": u["id"], "day": {"$gte": cutoff}}).to_list(1000)
        arr_rows = [r for r in rows if r.get("kind") == "arrival"]
        worked_days = len({r["day"] for r in arr_rows})
        late_count = sum(1 for r in arr_rows if r.get("late"))
        late_min_total = sum(r.get("late_min", 0) for r in arr_rows)
        absences = max(0, days - worked_days)
        avg_arrival_h = None
        if arr_rows:
            total_min = sum(
                (datetime.fromisoformat(r["at"].replace("Z", "+00:00")).hour * 60 + datetime.fromisoformat(r["at"].replace("Z", "+00:00")).minute)
                for r in arr_rows if r.get("at")
            )
            if total_min:
                avg = total_min // len(arr_rows)
                avg_arrival_h = f"{avg//60:02d}:{avg%60:02d}"
        out.append({
            "user_id": u["id"], "name": u.get("name"), "role": u.get("role"),
            "worked_days": worked_days, "absences": absences,
            "late_count": late_count, "late_min_total": late_min_total,
            "avg_arrival": avg_arrival_h,
            "punctuality_pct": round((worked_days - late_count) / max(1, worked_days) * 100, 1),
        })
    return {"period_days": days, "rows": out}


@router.patch("/business/geofence")
async def update_geofence(body: Dict[str, Any], user: dict = Depends(require_role("admin"))):
    """Legacy geofence setter (kept for backward compatibility; no longer enforced)."""
    geo = {
        "lat": float(body.get("lat") or 0), "lng": float(body.get("lng") or 0),
        "radius_m": int(body.get("radius_m", 150)), "mandatory": bool(body.get("mandatory", False)),
    }
    await db.business.update_one({"id": "main"}, {"$set": {"geofence": geo}}, upsert=True)
    return {"ok": True, "geofence": geo}


@router.patch("/business/working-hours")
async def update_working_hours(body: Dict[str, Any], user: dict = Depends(require_role("admin"))):
    await db.business.update_one({"id": "main"}, {"$set": {"working_hours": body.get("working_hours") or {}}}, upsert=True)
    return {"ok": True}


@router.patch("/business/attendance-config")
async def update_attendance_config(body: Dict[str, Any], user: dict = Depends(require_role("admin"))):
    """Who can punch? body: {enabled: bool, enabled_roles: [role_keys...]}"""
    cfg = {
        "enabled": bool(body.get("enabled", True)),
        "enabled_roles": list(body.get("enabled_roles") or ["manager", "sales", "stock_keeper", "community_manager", "rider"]),
    }
    await db.business.update_one({"id": "main"}, {"$set": {"attendance_config": cfg}}, upsert=True)
    return {"ok": True, "attendance_config": cfg}
