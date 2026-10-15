"""
Orders / POS / Cash-sessions router.

Extracted from server.py (P5 Refactor Feb 2026). Covers the core sales flow:
back-office order CRUD + status recomputation, POS PIN authorizations,
on-hold carts, cash movements, and open/close cash sessions.

The heavier status-transition endpoint (/orders/{oid}/status with WhatsApp
auto-templates), deliver proofs, invoice generation and the handover
workflow remain in server.py because they are tightly coupled to the
messagerie / PDF subsystems not yet extracted.
"""
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException

from deps import db, get_user, require_role, clean, new_id, now_iso, gen_code
from models import (
    OrderIn, CashSessionOpenIn, CashSessionCloseIn,
    PinAuthIn, CashMovementIn, HoldIn,
)

router = APIRouter(prefix="/api", tags=["orders"])


# ---------- Orders ----------
@router.get("/orders")
async def orders(user: dict = Depends(get_user), status: Optional[str] = None, channel: Optional[str] = None, q: Optional[str] = None):
    f: Dict[str, Any] = {}
    if status:
        f["status"] = status
    if channel:
        f["channel"] = channel
    if q:
        f["$or"] = [
            {"code": {"$regex": q, "$options": "i"}},
            {"customer.name": {"$regex": q, "$options": "i"}},
            {"customer.phone": {"$regex": q, "$options": "i"}},
        ]
    return clean(await db.orders.find(f).sort("created_at", -1).to_list(1000))


@router.post("/orders")
async def create_order(body: OrderIn, user: dict = Depends(get_user)):
    sub = sum(it.qty * it.price for it in body.items)
    total = sub + body.delivery_fee - body.discount
    doc = {
        "id": new_id(), "code": gen_code(),
        "items": [it.model_dump() for it in body.items],
        "customer": body.customer, "channel": body.channel, "payment_method": body.payment_method,
        "delivery_zone": body.delivery_zone, "delivery_fee": body.delivery_fee,
        "discount": body.discount, "note": body.note, "mode": body.mode,
        "store_id": body.store_id or "store-cocody",
        "subtotal": sub, "total": total,
        "status": "livree" if body.mode == "store" else "nouvelle",
        "payment_status": "paye" if body.payment_method in ("cash", "wave") and body.mode == "store" else "en_attente",
        "created_at": now_iso(), "created_by": user.get("name"),
        "timeline": [{"status": "nouvelle" if body.mode != "store" else "livree", "at": now_iso(), "by": user.get("name", "système")}],
    }
    for it in body.items:
        await db.products.update_one({"id": it.product_id}, {"$inc": {"stock": -it.qty}})
        if it.size:
            await db.products.update_one({"id": it.product_id}, {"$inc": {f"stock_by_size.{it.size}": -it.qty}})
        fresh = await db.products.find_one({"id": it.product_id})
        if fresh:
            total_stk = sum((fresh.get("stock_by_size") or {}).values()) if fresh.get("stock_by_size") else fresh.get("stock", 0)
            if total_stk <= 0 and fresh.get("status") not in ("liste_attente", "archive", "inactif"):
                await db.products.update_one({"id": it.product_id}, {"$set": {"status": "liste_attente", "auto_waitlist_at": now_iso()}})
    if body.customer and body.customer.get("id"):
        await db.customers.update_one(
            {"id": body.customer["id"]},
            {"$set": {"last_order_at": now_iso()}, "$inc": {"loyalty_points": int(total / 500)}},
        )
        doc["points_awarded"] = True
    await db.orders.insert_one(doc)
    return clean(doc)


@router.patch("/orders/{oid}")
async def update_order(oid: str, body: Dict[str, Any], user: dict = Depends(get_user)):
    o = await db.orders.find_one({"id": oid})
    if not o:
        raise HTTPException(404)
    if o.get("status") == "livree":
        raise HTTPException(400, "Commande livrée, non modifiable")
    body.pop("id", None)
    body.pop("_id", None)
    if "items" in body or "delivery_fee" in body or "discount" in body:
        items = body.get("items", o.get("items", []))
        sub = sum(it["qty"] * it["price"] for it in items)
        body["subtotal"] = sub
        body["total"] = sub + body.get("delivery_fee", o.get("delivery_fee", 0)) - body.get("discount", o.get("discount", 0))
    await db.orders.update_one({"id": oid}, {"$set": body})
    from routers.notify import order_edited
    await order_edited(o, await db.orders.find_one({"id": oid}))
    return {"ok": True}


@router.get("/orders/track/{code}")
async def track(code: str):
    o = await db.orders.find_one({"code": code})
    if not o:
        raise HTTPException(404)
    return clean(o)


# ---------- POS: PIN authorizations ----------
@router.post("/pos/pin-authorize")
async def pin_authorize(body: PinAuthIn, user: dict = Depends(get_user)):
    """Verify a manager/admin PIN to authorize a sensitive POS action. Logs approval."""
    approver = await db.users.find_one({"attendance_code": body.pin.strip(), "role": {"$in": ["admin", "manager"]}, "active": True})
    if not approver:
        raise HTTPException(403, "PIN invalide ou droits insuffisants")
    log = {
        "id": new_id(), "action": body.action, "amount": body.amount,
        "requested_by": user.get("id"), "requested_by_name": user.get("name"),
        "approved_by": approver.get("id"), "approved_by_name": approver.get("name"),
        "created_at": now_iso(),
    }
    await db.pos_authorizations.insert_one(log)
    return {"ok": True, "approver": approver.get("name"), "approval_id": log["id"]}


# ---------- POS: Cash movements ----------
@router.post("/cash-movements")
async def create_cash_movement(body: CashMovementIn, user: dict = Depends(get_user)):
    if body.type not in ("in", "out"):
        raise HTTPException(400, "Type invalide")
    doc = {
        "id": new_id(), "type": body.type, "amount": float(body.amount),
        "reason": body.reason, "note": body.note or "",
        "user_id": user.get("id"), "user_name": user.get("name"),
        "created_at": now_iso(),
    }
    await db.cash_movements.insert_one(doc)
    return clean(doc)


@router.get("/cash-movements")
async def list_cash_movements(user: dict = Depends(get_user), date: Optional[str] = None):
    """List today's movements by default. date='YYYY-MM-DD' for a specific day."""
    if date:
        try:
            d = datetime.fromisoformat(date).replace(tzinfo=timezone.utc)
        except Exception:
            d = datetime.now(timezone.utc)
    else:
        d = datetime.now(timezone.utc)
    s = d.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    e = (d.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)).isoformat()
    rows = await db.cash_movements.find({"created_at": {"$gte": s, "$lt": e}}).sort("created_at", -1).to_list(500)
    orders = await db.orders.find({"created_at": {"$gte": s, "$lt": e}, "payment_method": "cash", "status": {"$ne": "annulee"}}).to_list(1000)
    cash_sales = sum(o.get("total", 0) for o in orders)
    ins = sum(r["amount"] for r in rows if r["type"] == "in")
    outs = sum(r["amount"] for r in rows if r["type"] == "out")
    return {"movements": clean(rows), "cash_sales": cash_sales, "ins": ins, "outs": outs, "expected": cash_sales + ins - outs}


# ---------- POS: Holds (parked carts) ----------
@router.post("/pos/holds")
async def create_hold(body: HoldIn, user: dict = Depends(get_user)):
    exp = (datetime.now(timezone.utc) + timedelta(hours=body.expires_in_hours or 24)).isoformat()
    doc = {
        "id": new_id(), "items": body.items, "customer": body.customer,
        "note": body.note or "", "user_name": user.get("name"),
        "created_at": now_iso(), "expires_at": exp, "resumed": False,
    }
    await db.pos_holds.insert_one(doc)
    return clean(doc)


@router.get("/pos/holds")
async def list_holds(user: dict = Depends(get_user)):
    now = datetime.now(timezone.utc).isoformat()
    rows = await db.pos_holds.find({"resumed": False, "expires_at": {"$gte": now}}).sort("created_at", -1).to_list(100)
    return clean(rows)


@router.delete("/pos/holds/{hid}")
async def delete_hold(hid: str, user: dict = Depends(get_user)):
    await db.pos_holds.update_one({"id": hid}, {"$set": {"resumed": True, "resumed_at": now_iso()}})
    return {"ok": True}


# ---------- Cash sessions (open / close) ----------
@router.get("/cash-sessions")
async def list_cash_sessions(user: dict = Depends(get_user)):
    rows = await db.cash_sessions.find({}).sort("opened_at", -1).to_list(50)
    return clean(rows)


@router.get("/cash-sessions/managers")
async def list_session_managers(user: dict = Depends(get_user)):
    rows = await db.users.find({"role": {"$in": ["admin", "manager"]}, "active": True}, {"_id": 0, "id": 1, "name": 1, "role": 1}).to_list(100)
    return rows


@router.post("/cash-sessions/open")
async def open_cash_session(body: CashSessionOpenIn, user: dict = Depends(get_user)):
    exists = await db.cash_sessions.find_one({"closed": False})
    if exists:
        raise HTTPException(400, "Une session de caisse est déjà ouverte")
    try:
        d = datetime.strptime(body.session_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Date invalide")
    if d > datetime.now(timezone.utc).date():
        raise HTTPException(400, "La date ne peut pas être dans le futur")
    if body.opening_cash < 0:
        raise HTTPException(400, "Fond de caisse invalide")
    mgr = await db.users.find_one({"id": body.manager_id, "role": {"$in": ["admin", "manager"]}, "active": True})
    if not mgr:
        raise HTTPException(404, "Gérante introuvable")
    if mgr.get("attendance_code") != body.pin.strip():
        raise HTTPException(403, "PIN de la gérante invalide")
    doc = {
        "id": new_id(), "opened_at": now_iso(), "opened_by": mgr.get("name"),
        "manager_id": mgr["id"], "session_date": body.session_date, "created_by": user.get("name"),
        "opening_cash": float(body.opening_cash), "closed": False, "note": body.note or "",
    }
    await db.cash_sessions.insert_one(doc)
    return clean(doc)


@router.post("/cash-sessions/{sid}/close")
async def close_cash_session(sid: str, body: CashSessionCloseIn, user: dict = Depends(get_user)):
    approver = await db.users.find_one({"attendance_code": body.pin.strip(), "role": {"$in": ["admin", "manager"]}, "active": True})
    if not approver:
        raise HTTPException(403, "PIN gérante invalide")
    s = await db.cash_sessions.find_one({"id": sid})
    if not s:
        raise HTTPException(404)
    start = s["opened_at"]
    movements = await db.cash_movements.find({"created_at": {"$gte": start}}).to_list(500)
    ins = sum(m["amount"] for m in movements if m["type"] == "in")
    outs = sum(m["amount"] for m in movements if m["type"] == "out")
    cash_sales = sum(
        o.get("total", 0) for o in await db.orders.find(
            {"created_at": {"$gte": start}, "payment_method": "cash", "status": {"$ne": "annulee"}}
        ).to_list(2000)
    )
    expected = s["opening_cash"] + cash_sales + ins - outs
    ecart = body.closing_cash - expected
    upd = {
        "closed": True, "closed_at": now_iso(), "closed_by": user.get("name"),
        "approved_by": approver.get("name"),
        "closing_cash": body.closing_cash, "cash_sales": cash_sales,
        "ins": ins, "outs": outs, "expected": expected, "ecart": ecart,
        "close_note": body.note or "",
    }
    await db.cash_sessions.update_one({"id": sid}, {"$set": upd})
    return {"ok": True, "summary": upd}
