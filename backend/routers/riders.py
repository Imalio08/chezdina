"""
Riders / Deliveries router.

Extracted from server.py (P5 Refactor Feb 2026). Covers daily rider sessions,
cash reconciliation, live GPS, delivery assignment and scoring/KPIs.

The order-status transitions (/orders/{oid}/status) and proof-of-delivery
flow (/orders/{oid}/deliver) remain in server.py because they are tightly
coupled to WhatsApp templates and the review/notification subsystems.
"""
import random
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException

from deps import db, get_user, require_role, clean, new_id, now_iso
from models import AssignIn, SessionIn, ReconcileIn, RiderLocationIn

router = APIRouter(prefix="/api", tags=["riders"])


# ---------- Live GPS ----------
@router.post("/rider/position")
async def rider_position(body: Dict[str, Any], user: dict = Depends(get_user)):
    if user.get("role") != "rider":
        raise HTTPException(403, "Livreur seulement")
    lat = body.get("lat")
    lng = body.get("lng")
    if lat is None or lng is None:
        raise HTTPException(400, "lat/lng requis")
    doc = {
        "rider_id": user["id"], "rider_name": user.get("name"),
        "lat": float(lat), "lng": float(lng),
        "heading": body.get("heading"), "speed": body.get("speed"),
        "at": now_iso(), "order_id": body.get("order_id"),
    }
    await db.rider_positions.update_one({"rider_id": user["id"]}, {"$set": doc}, upsert=True)
    return {"ok": True}


@router.post("/riders/location")
async def push_rider_location(body: RiderLocationIn, user: dict = Depends(get_user)):
    """Push rider GPS position (every ~30s, or ~60s in battery-saver mode).
    Writes to both `rider_locations` (admin map) and `rider_positions` (public order tracking)."""
    at = now_iso()
    base = {
        "rider_id": user.get("id"),
        "rider_name": user.get("name"),
        "lat": body.lat, "lng": body.lng,
        "heading": body.heading, "speed": body.speed,
    }
    await db.rider_locations.update_one(
        {"rider_id": user.get("id")},
        {"$set": {**base, "accuracy": body.accuracy or 0, "battery_level": body.battery_level, "battery_charging": body.battery_charging, "updated_at": at}},
        upsert=True,
    )
    await db.rider_positions.update_one(
        {"rider_id": user.get("id")},
        {"$set": {**base, "at": at, "accuracy": body.accuracy or 0}},
        upsert=True,
    )
    return {"ok": True}


@router.get("/riders/locations")
async def list_rider_locations(user: dict = Depends(get_user)):
    rows = await db.rider_locations.find({}).to_list(100)
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    rows = [r for r in rows if r.get("updated_at", "") >= cutoff]
    return clean(rows)


# ---------- Scoring & reviews ----------
@router.get("/riders/{rid}/score")
async def rider_score(rid: str, user: dict = Depends(get_user)):
    settings = await db.site_settings.find_one({"id": "main"}) or {}
    weights = (settings.get("delivery_templates") or {}).get("score_weights") or {"delivery_rate": 35, "punctuality": 20, "rating": 25, "cash": 10, "proof": 10}
    orders = await db.orders.find({"rider_id": rid}).to_list(2000)
    total = len(orders)
    delivered = [o for o in orders if o.get("status") == "livree"]
    failed = [o for o in orders if o.get("status") in ("echouee", "annulee")]
    delivery_rate = (len(delivered) / total * 100) if total else 100
    punctuality = 90
    reviews = await db.reviews.find({"rider_id": rid, "hidden": {"$ne": True}}).to_list(500)
    ratings = [r.get("rating", 0) for r in reviews if r.get("rating")]
    avg = (sum(ratings) / len(ratings)) if ratings else 5
    rating_score = avg / 5 * 100
    sessions = await db.delivery_sessions.find({"rider_id": rid}).to_list(500)
    recs = [v for s in sessions for v in (s.get("reconciliations") or {}).values() if isinstance(v, dict)]
    with_gap = [r for r in recs if abs(r.get("ecart", 0)) > 100]
    cash_score = max(0, 100 - (len(with_gap) * 10))
    code_proofs = [o for o in delivered if (o.get("proof") or {}).get("method") == "code"]
    proof_score = (len(code_proofs) / len(delivered) * 100) if delivered else 100
    components = {
        "delivery_rate": round(delivery_rate),
        "punctuality": round(punctuality),
        "rating": round(rating_score),
        "cash": round(cash_score),
        "proof": round(proof_score),
    }
    score = round(sum(components[k] * weights.get(k, 0) / 100 for k in components))
    level = "Excellence" if score >= 90 else "Or" if score >= 75 else "Argent" if score >= 60 else "Bronze"
    return {
        "score": score, "level": level, "weights": weights, "components": components,
        "stats": {"total": total, "delivered": len(delivered), "failed": len(failed),
                  "rating_avg": round(avg, 1), "reviews": len(reviews), "cash_gaps": len(with_gap)},
    }


@router.get("/riders/{rid}/reviews")
async def rider_reviews(rid: str, user: dict = Depends(get_user)):
    is_rider_self = user.get("role") == "rider" and user.get("id") == rid
    f: Dict[str, Any] = {"rider_id": rid}
    if is_rider_self:
        f["hidden"] = {"$ne": True}
    rows = await db.reviews.find(f).sort("created_at", -1).to_list(300)
    for r in rows:
        cust = r.get("customer") or {}
        r["customer"] = {"name": (cust.get("name") or "").split(" ")[0], "quartier": cust.get("quartier") or cust.get("zone")}
    return clean(rows)


@router.get("/riders/{rid}/kpis")
async def rider_kpis(rid: str, user: dict = Depends(get_user)):
    orders = await db.orders.find({"rider_id": rid}).to_list(2000)
    total = len(orders)
    delivered = sum(1 for o in orders if o.get("status") == "livree")
    failed = sum(1 for o in orders if o.get("status") in ("echouee", "annulee"))
    return {
        "total": total, "delivered": delivered, "failed": failed,
        "delivery_rate": round(delivered / max(1, total) * 100, 1),
        "cancel_rate": round(failed / max(1, total) * 100, 1),
        "satisfaction": round(random.uniform(4.1, 4.8), 1),
    }


# ---------- Rider self-service ----------
@router.get("/riders/me/today")
async def rider_today(user: dict = Depends(get_user)):
    """Rider dashboard summary for today."""
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    orders = await db.orders.find({
        "rider_id": user["id"],
        "$or": [{"assigned_at": {"$gte": start}}, {"created_at": {"$gte": start}}],
    }).to_list(500)
    to_collect = sum(o.get("total", 0) for o in orders if o.get("payment_method") == "cod" and o.get("status") not in ("livree", "annulee"))
    collected = 0
    for o in orders:
        p = o.get("proof") or {}
        if o.get("status") == "livree" and o.get("payment_method") == "cod":
            collected += p.get("amount_collected") or o.get("total", 0)
    counts = {"a_livrer": 0, "en_route": 0, "livrees": 0, "annulees": 0, "reportees": 0, "echecs": 0}
    for o in orders:
        s = o.get("status")
        if s in ("confirmee", "prete", "assignee"):
            counts["a_livrer"] += 1
        elif s == "en_livraison":
            counts["en_route"] += 1
        elif s == "livree":
            counts["livrees"] += 1
        elif s == "annulee":
            counts["annulees"] += 1
        elif s == "reportee":
            counts["reportees"] += 1
        elif s == "echouee":
            counts["echecs"] += 1
    return {"orders": clean(orders), "counts": counts, "to_collect": to_collect, "collected": collected, "balance_to_hand_over": collected}


@router.get("/riders/me/history")
async def rider_history(user: dict = Depends(get_user), days: int = 30):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    sessions = await db.delivery_sessions.find({"rider_id": user["id"], "date": {"$gte": cutoff[:10]}}).sort("date", -1).to_list(100)
    for s in sessions:
        for o in (s.get("orders_detail") or []):
            cust = o.get("customer") or {}
            ph = cust.get("phone", "")
            digits = "".join(c for c in ph if c.isdigit())
            if len(digits) >= 4:
                cust["phone_masked"] = f"{digits[:2]} •• •• •• {digits[-2:]}"
                cust["phone"] = None
    return clean(sessions)


# ---------- Deliveries ----------
@router.get("/deliveries")
async def deliveries(user: dict = Depends(get_user)):
    f: Dict[str, Any] = {"mode": "delivery"}
    if user.get("role") == "rider":
        f["rider_id"] = user["id"]
    return clean(await db.orders.find(f).sort("created_at", -1).to_list(500))


@router.patch("/deliveries/{oid}/assign")
async def assign_delivery(oid: str, body: AssignIn, user: dict = Depends(require_role("admin", "manager"))):
    o = await db.orders.find_one({"id": oid})
    if not o:
        raise HTTPException(404)
    tl = o.get("timeline", [])
    tl.append({"status": "assignee", "at": now_iso(), "by": user.get("name"), "note": f"→ {body.rider_name}"})
    await db.orders.update_one({"id": oid}, {"$set": {"rider_id": body.rider_id, "rider_name": body.rider_name, "status": "assignee", "timeline": tl}})
    return {"ok": True}


@router.post("/deliveries/suggest-split")
async def suggest_split(body: Dict[str, Any], user: dict = Depends(require_role("admin", "manager"))):
    """Propose a zone-based + load-balanced split of unassigned orders among active riders."""
    requested_oids = body.get("order_ids") or []
    requested_rids = body.get("rider_ids") or []
    order_filter = {"id": {"$in": requested_oids}} if requested_oids else {"mode": "delivery", "status": {"$in": ["prete", "confirmee"]}, "rider_id": {"$in": [None, ""]}}
    orders = await db.orders.find(order_filter).to_list(500)
    rider_filter = {"id": {"$in": requested_rids}} if requested_rids else {"role": "rider", "active": {"$ne": False}}
    riders = await db.users.find(rider_filter).to_list(200)
    if not riders:
        return {"suggestions": [], "unassigned": [o["id"] for o in orders], "message": "Aucun livreur actif"}
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    load = {r["id"]: 0 for r in riders}
    cur = await db.orders.find({"rider_id": {"$in": [r["id"] for r in riders]}, "created_at": {"$regex": f"^{today}"}, "status": {"$nin": ["livree", "annulee", "echouee"]}}).to_list(500)
    for o in cur:
        load[o.get("rider_id")] = load.get(o.get("rider_id"), 0) + 1
    by_zone: Dict[str, List[dict]] = {}
    for o in orders:
        z = o.get("delivery_zone") or "—"
        by_zone.setdefault(z, []).append(o)
    suggestions = {r["id"]: {"rider_id": r["id"], "rider_name": r.get("name"), "orders": [], "zones": set(), "total_load": load.get(r["id"], 0)} for r in riders}
    zone_rider: Dict[str, str] = {}
    for z, zorders in by_zone.items():
        for o in zorders:
            if z in zone_rider:
                rid = zone_rider[z]
            else:
                rid = min(suggestions.keys(), key=lambda k: suggestions[k]["total_load"])
                zone_rider[z] = rid
            suggestions[rid]["orders"].append(o["id"])
            suggestions[rid]["zones"].add(z)
            suggestions[rid]["total_load"] += 1
    out = [{"rider_id": s["rider_id"], "rider_name": s["rider_name"], "orders": s["orders"], "zones": sorted(list(s["zones"])), "total_load": s["total_load"]} for s in suggestions.values() if s["orders"]]
    return {"suggestions": out, "unassigned": []}


# ---------- Delivery sessions ----------
def _verse(r):
    return bool(r.get("collected")) if isinstance(r, dict) else bool(r)


@router.post("/delivery-sessions")
async def create_session(body: SessionIn, user: dict = Depends(require_role("admin", "manager"))):
    d = body.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    existing = await db.delivery_sessions.find_one({"rider_id": body.rider_id, "date": d, "closed": {"$ne": True}})
    if existing:
        return clean(existing)
    doc = {"id": new_id(), "rider_id": body.rider_id, "rider_name": body.rider_name, "date": d,
           "orders": [], "closed": False, "reconciliations": {}, "created_at": now_iso()}
    await db.delivery_sessions.insert_one(doc)
    return clean(doc)


@router.get("/delivery-sessions")
async def list_sessions(user: dict = Depends(get_user), rider_id: Optional[str] = None, date: Optional[str] = None):
    f: Dict[str, Any] = {}
    if rider_id:
        f["rider_id"] = rider_id
    if date:
        f["date"] = date
    rows = await db.delivery_sessions.find(f).sort("created_at", -1).to_list(100)
    out = []
    for s in rows:
        oids = s.get("orders", [])
        orders = await db.orders.find({"id": {"$in": oids}}).to_list(200)
        postponed = s.get("postponed", {})
        for o in orders:
            if o["id"] in postponed:
                o["postponed_to"] = postponed[o["id"]].get("to")
        active = [o for o in orders if o["id"] not in postponed]
        rec = s.get("reconciliations", {})
        s["orders_detail"] = orders
        s["postponed_count"] = len(orders) - len(active)
        s["total_to_collect"] = sum(o.get("total", 0) for o in active if o.get("payment_method") == "cod")
        s["prepaid_count"] = sum(1 for o in active if o.get("payment_method") != "cod")
        s["delivered_count"] = sum(1 for o in active if o.get("status") == "livree")
        s["cancelled_count"] = sum(1 for o in active if o.get("status") in ("annulee", "echouee"))
        s["collected_total"] = sum(o.get("total", 0) for o in active if o.get("payment_method") == "cod" and _verse(rec.get(o["id"])))
        out.append(s)
    return clean(out)


@router.patch("/delivery-sessions/{sid}/add-order")
async def session_add_order(sid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin", "manager"))):
    oid = body.get("order_id")
    s = await db.delivery_sessions.find_one({"id": sid})
    if not s:
        raise HTTPException(404)
    orders = s.get("orders", [])
    if oid not in orders:
        orders.append(oid)
    await db.delivery_sessions.update_one({"id": sid}, {"$set": {"orders": orders}})
    await db.orders.update_one({"id": oid}, {"$set": {"rider_id": s["rider_id"], "rider_name": s["rider_name"], "status": "assignee", "session_id": sid}})
    return {"ok": True}


@router.patch("/delivery-sessions/{sid}/reconcile")
async def reconcile(sid: str, body: ReconcileIn, user: dict = Depends(require_role("admin", "manager"))):
    s = await db.delivery_sessions.find_one({"id": sid})
    if not s:
        raise HTTPException(404)
    rec = s.get("reconciliations", {})
    if body.collected:
        if not body.pin:
            raise HTTPException(400, "PIN gérante requis pour valider l'encaissement")
        approver = await db.users.find_one({"attendance_code": body.pin.strip(), "role": {"$in": ["admin", "manager"]}, "active": True})
        if not approver:
            raise HTTPException(403, "PIN invalide ou droits insuffisants")
        o = await db.orders.find_one({"id": body.order_id})
        due = (o or {}).get("total", 0) if (o or {}).get("payment_method") == "cod" else 0
        amount = float(body.amount) if body.amount is not None else float(due)
        rec[body.order_id] = {
            "collected": True, "amount": amount, "due": due, "ecart": amount - due,
            "approved_by": approver.get("name"), "approved_by_id": approver.get("id"),
            "note": body.note or "", "at": now_iso(),
        }
    else:
        rec[body.order_id] = {"collected": False, "at": now_iso()}
    await db.delivery_sessions.update_one({"id": sid}, {"$set": {"reconciliations": rec}})
    return {"ok": True, "reconciliation": rec[body.order_id]}


@router.patch("/delivery-sessions/{sid}/close")
async def close_session(sid: str, user: dict = Depends(require_role("admin", "manager"))):
    s = await db.delivery_sessions.find_one({"id": sid})
    if not s:
        raise HTTPException(404)
    rec = s.get("reconciliations", {})
    postponed = s.get("postponed", {})
    orders = await db.orders.find({"id": {"$in": s.get("orders", [])}}).to_list(500)
    missing = [o.get("code") for o in orders
               if o["id"] not in postponed and o.get("status") == "livree" and o.get("payment_method") == "cod" and not _verse(rec.get(o["id"]))]
    if missing:
        raise HTTPException(400, f"Versements manquants : {', '.join(missing)}")
    await db.delivery_sessions.update_one({"id": sid}, {"$set": {"closed": True, "closed_at": now_iso()}})
    return {"ok": True}
