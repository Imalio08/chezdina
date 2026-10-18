"""Discount codes & vouchers at checkout (storefront + POS): validation, listing, redemption."""
import re
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from deps import db, get_user, get_customer, now_iso

router = APIRouter(prefix="/api", tags=["coupons"])


def _label(p: Dict[str, Any]) -> str:
    t, v = p.get("type"), p.get("value") or p.get("amount") or 0
    if t == "percent":
        return f"-{int(v)} %"
    if t == "free_delivery":
        return "Livraison offerte"
    return f"-{int(v):,} FCFA".replace(",", " ")


def _calc(p: Dict[str, Any], sub: float, fee: float) -> float:
    t, v = p.get("type"), float(p.get("value") or p.get("amount") or 0)
    if t == "percent":
        d = sub * v / 100
    elif t == "free_delivery":
        d = fee
    else:
        d = v
    return float(int(max(0, min(d, sub + fee))))


async def resolve(code: str, sub: float, fee: float, customer_id: Optional[str], channel: Optional[str] = None) -> Dict[str, Any]:
    """Valid coupon → {code, label, discount, source, ref_id}; raises 400 with a clear message otherwise."""
    code = (code or "").strip().upper()
    if not code:
        raise HTTPException(400, "Saisissez un code")
    now = now_iso()
    v = await db.vouchers.find_one({"code": code})
    if v:
        if v.get("customer_id") and v["customer_id"] != customer_id:
            raise HTTPException(400, "Ce bon d'achat appartient à une autre cliente")
        if v.get("status") in ("used", "utilise") or v.get("used_at"):
            raise HTTPException(400, "Ce bon d'achat a déjà été utilisé")
        if v.get("expires_at") and v["expires_at"] < now:
            raise HTTPException(400, "Ce bon d'achat a expiré")
        p = {"type": v.get("type") or "amount", "value": v.get("value") or v.get("amount")}
        if sub < float(v.get("min_order") or 0):
            raise HTTPException(400, f"Valable dès {int(v['min_order'])} FCFA d'achat")
        return {"code": code, "label": _label(p), "discount": _calc(p, sub, fee), "source": "voucher", "ref_id": v.get("id")}
    p = await db.promotions.find_one({"code": {"$regex": f"^{re.escape(code)}$", "$options": "i"}})
    if not p or not p.get("active"):
        raise HTTPException(400, "Code inconnu ou inactif")
    if p.get("type") not in ("percent", "amount", "fixed", "free_delivery", None) or p.get("scope") in ("products", "category"):
        raise HTTPException(400, "Cette offre s'applique automatiquement sur les articles concernés")
    if channel and p.get("channel") not in (None, "", "all", channel):
        raise HTTPException(400, "Ce code n'est pas valable ici" if channel == "pos" else "Ce code est réservé à la boutique physique")
    if p.get("starts_at") and p["starts_at"] > now:
        raise HTTPException(400, "Ce code n'est pas encore valable")
    if p.get("ends_at") and p["ends_at"] < now:
        raise HTTPException(400, "Ce code a expiré")
    if p.get("usage_limit") and (p.get("uses") or 0) >= p["usage_limit"]:
        raise HTTPException(400, "Ce code a atteint son nombre maximal d'utilisations")
    if sub < float(p.get("min_order") or 0):
        raise HTTPException(400, f"Valable dès {int(p['min_order']):,} FCFA d'achat".replace(",", " "))
    return {"code": p["code"].upper(), "label": _label(p), "discount": _calc(p, sub, fee), "source": "promo", "ref_id": p["id"]}


async def redeem(info: Optional[Dict[str, Any]], order_code: str):
    """Atomic: a voucher is used once, a code never goes over its usage limit."""
    if not info:
        return
    if info["source"] == "voucher":
        r = await db.vouchers.update_one({"id": info["ref_id"], "status": {"$nin": ["used", "utilise"]}}, {"$set": {"status": "used", "used_at": now_iso(), "order_code": order_code}})
    else:
        p = await db.promotions.find_one({"id": info["ref_id"]}, {"usage_limit": 1})
        q = {"id": info["ref_id"]}
        if (p or {}).get("usage_limit"):
            q["$or"] = [{"uses": {"$lt": p["usage_limit"]}}, {"uses": None}]
        r = await db.promotions.update_one(q, {"$inc": {"uses": 1}})
    if not r.modified_count:
        raise HTTPException(409, "Ce code vient d'être utilisé · retirez-le et réessayez")


async def available(customer_id: Optional[str], sub: float, fee: float, channel: Optional[str] = None):
    out = []
    now = now_iso()
    if customer_id:
        for v in await db.vouchers.find({"customer_id": customer_id, "status": {"$nin": ["used", "utilise"]}, "used_at": None}).to_list(50):
            if v.get("code") and not (v.get("expires_at") and v["expires_at"] < now):
                out.append(v["code"])
    for p in await db.promotions.find({"active": True, "code": {"$nin": [None, ""]}}).to_list(50):
        out.append(p["code"])
    rows = []
    for c in out:
        try:
            rows.append({**await resolve(c, sub, fee, customer_id, channel), "usable": True})
        except HTTPException as e:
            rows.append({"code": c.upper(), "usable": False, "reason": e.detail})
    return rows


async def _maybe_customer(request: Request):
    try:
        return await get_customer(request)
    except HTTPException:
        return None


@router.post("/public/coupons/check")
async def public_check(body: Dict[str, Any], request: Request):
    c = await _maybe_customer(request)
    return await resolve(body.get("code"), float(body.get("subtotal") or 0), float(body.get("delivery_fee") or 0), (c or {}).get("id"), "boutique")


@router.post("/public/coupons/available")
async def public_available(body: Dict[str, Any], request: Request):
    c = await _maybe_customer(request)
    return await available((c or {}).get("id"), float(body.get("subtotal") or 0), float(body.get("delivery_fee") or 0), "boutique")


@router.post("/pos/coupons/check")
async def pos_check(body: Dict[str, Any], user: dict = Depends(get_user)):
    return await resolve(body.get("code"), float(body.get("subtotal") or 0), float(body.get("delivery_fee") or 0), body.get("customer_id"), "pos")


@router.post("/pos/coupons/available")
async def pos_available(body: Dict[str, Any], user: dict = Depends(get_user)):
    return await available(body.get("customer_id"), float(body.get("subtotal") or 0), float(body.get("delivery_fee") or 0), "pos")
