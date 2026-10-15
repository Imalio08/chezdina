"""Customer wallet ledger (parrainage, fidélité, promotions, remboursements) + referral program."""
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pymongo import ReturnDocument

from deps import db, get_user, get_customer, require_role, clean, new_id, now_iso

router = APIRouter(prefix="/api", tags=["wallet"])
CANCELLED = ("annulee", "retournee", "refusee", "echouee")
DEFAULTS = {"referral_bonus_parrain": 1000, "referral_bonus_filleul": 1000, "points_per_fcfa": 500,
            "point_value_fcfa": 10, "min_points_conversion": 100}
SOURCES = {"parrainage": "Parrainage", "fidelite": "Fidélité", "promotion": "Promotion", "remboursement": "Remboursement",
           "commande": "Commande", "correction": "Correction", "initial": "Solde initial", "autre": "Autre"}


async def settings() -> Dict[str, Any]:
    s = await db.loyalty_settings.find_one({"id": "main"}) or {}
    return {k: int(s.get(k) if s.get(k) is not None else v) for k, v in DEFAULTS.items()}


async def _ensure_opening(cid: str) -> None:
    """Legacy balances (before the ledger existed) get one 'Solde initial' entry."""
    if await db.wallet_tx.find_one({"customer_id": cid}):
        return
    c = await db.customers.find_one({"id": cid}, {"wallet": 1})
    bal = int((c or {}).get("wallet") or 0)
    if bal:
        try:
            await db.wallet_tx.insert_one({"id": new_id(), "ref": f"init:{cid}", "customer_id": cid, "type": "credit", "source": "initial",
                                           "amount": bal, "balance_after": bal, "status": "available", "label": "Solde existant repris", "at": now_iso()})
        except Exception:  # noqa: BLE001 (duplicate ref)
            pass


async def move(cid: str, amount: int, typ: str, source: str, label: str, ref: str,
               order_code: Optional[str] = None, by: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Atomic, idempotent balance movement. Returns the tx, or None if ref already used. Raises on insufficient balance."""
    amount = int(amount)
    if not amount or await db.wallet_tx.find_one({"ref": ref}):
        return None
    await _ensure_opening(cid)
    flt = {"id": cid}
    if amount < 0:
        flt["wallet"] = {"$gte": -amount}
    c = await db.customers.find_one_and_update(flt, {"$inc": {"wallet": amount}}, return_document=ReturnDocument.AFTER)
    if not c:
        raise HTTPException(400, "Solde du porte-monnaie insuffisant")
    tx = {"id": new_id(), "ref": ref, "customer_id": cid, "type": typ, "source": source, "amount": amount,
          "balance_after": int(c.get("wallet") or 0), "status": "available", "label": label, "order_code": order_code, "by": by, "at": now_iso()}
    try:
        await db.wallet_tx.insert_one(tx)
    except Exception:  # noqa: BLE001 - concurrent duplicate: undo
        await db.customers.update_one({"id": cid}, {"$inc": {"wallet": -amount}})
        return None
    return tx


async def add_pending(cid: str, amount: int, source: str, label: str, ref: str) -> None:
    if await db.wallet_tx.find_one({"ref": ref}):
        return
    await db.wallet_tx.insert_one({"id": new_id(), "ref": ref, "customer_id": cid, "type": "credit", "source": source, "amount": int(amount),
                                   "balance_after": None, "status": "pending", "label": label, "at": now_iso()})


async def release_pending(ref: str, label: str) -> None:
    p = await db.wallet_tx.find_one_and_update({"ref": ref, "status": "pending"}, {"$set": {"status": "validated", "validated_at": now_iso()}})
    if p:
        await move(p["customer_id"], p["amount"], "credit", p["source"], label, f"{ref}:ok")


async def find_marraine(code: str):
    code = (code or "").strip().upper()
    return await db.customers.find_one({"referral_code": code}) if code else None


async def apply_referral(marraine: dict, filleul: dict, source: str = "inscription") -> Dict[str, Any]:
    if marraine["id"] == filleul["id"]:
        raise HTTPException(400, "Impossible de se parrainer soi-même")
    res = await db.customers.update_one({"id": filleul["id"], "referred_by": {"$in": [None, ""]}},
                                        {"$set": {"referred_by": marraine["id"], "referred_by_code": marraine["referral_code"]}})
    if not res.modified_count:
        raise HTTPException(400, "Cette cliente a déjà été parrainée")
    s = await settings()
    bp, bf = s["referral_bonus_parrain"], s["referral_bonus_filleul"]
    await db.customers.update_one({"id": marraine["id"]}, {"$inc": {"referral_count": 1}})
    await move(filleul["id"], bf, "credit", "parrainage", f"Bienvenue · parrainée par {marraine.get('name') or 'une cliente'}", f"ref-filleul:{filleul['id']}")
    await add_pending(marraine["id"], bp, "parrainage", f"Parrainage de {filleul.get('name')} · versé à sa 1re commande livrée", f"ref-parrain:{filleul['id']}")
    doc = {"id": new_id(), "parrain_id": marraine["id"], "parrain_name": marraine.get("name"), "filleul_id": filleul["id"],
           "filleul_name": filleul.get("name"), "code": marraine["referral_code"], "bonus_parrain": bp, "bonus_filleul": bf,
           "status": "inscrite", "created_at": now_iso(), "source": source}
    await db.referrals.insert_one(doc)
    await db.referral_opens.update_many({"code": marraine["referral_code"], "visitor_id": filleul.get("visitor_id")}, {"$set": {"signed_up": True}})
    return doc


async def on_order_status(o: Dict[str, Any], status: str) -> None:
    """Points + referral at delivery, wallet refund on cancellation. All idempotent."""
    cid = (o.get("customer") or {}).get("id")
    if not cid:
        return
    if status == "livree":
        s = await settings()
        base = int(o.get("subtotal") or o.get("total") or 0) - int(o.get("discount") or 0) - int(o.get("wallet_used") or 0)
        pts = max(0, base) // max(1, s["points_per_fcfa"])
        if pts and (await db.orders.update_one({"id": o["id"], "points_awarded": {"$ne": True}}, {"$set": {"points_awarded": True, "points_earned": pts}})).modified_count:
            await db.customers.update_one({"id": cid}, {"$inc": {"loyalty_points": pts}})
            await db.points_tx.insert_one({"id": new_id(), "customer_id": cid, "points": pts, "kind": "gain", "order_code": o.get("code"), "at": now_iso()})
        r = await db.referrals.find_one({"filleul_id": cid, "status": "inscrite"})
        if r:
            await db.referrals.update_one({"id": r["id"]}, {"$set": {"status": "recompensee", "first_order_code": o.get("code"), "rewarded_at": now_iso()}})
            await release_pending(f"ref-parrain:{cid}", f"Parrainage validé · 1re commande de {r.get('filleul_name')}")
    elif status in CANCELLED and int(o.get("wallet_used") or 0) > 0:
        await move(cid, int(o["wallet_used"]), "credit", "remboursement", f"Commande {o.get('code')} annulée · porte-monnaie restitué", f"refund:{o['id']}", o.get("code"))


async def debit_for_order(cid: str, requested: int, eligible: int, order_id: str, code: str) -> int:
    amt = max(0, min(int(requested or 0), int(eligible)))
    if not amt:
        return 0
    c = await db.customers.find_one({"id": cid}, {"wallet": 1})
    amt = min(amt, int((c or {}).get("wallet") or 0))
    if amt and await move(cid, -amt, "debit", "commande", f"Utilisé sur la commande {code}", f"order:{order_id}", code):
        return amt
    return 0


async def _summary(cid: str) -> Dict[str, Any]:
    await _ensure_opening(cid)
    c = await db.customers.find_one({"id": cid}, {"wallet": 1, "loyalty_points": 1})
    rows = await db.wallet_tx.find({"customer_id": cid}).sort("at", -1).to_list(500)
    avail = [r for r in rows if r["status"] == "available"]
    by_source: Dict[str, int] = {}
    for r in avail:
        if r["amount"] > 0:
            by_source[r["source"]] = by_source.get(r["source"], 0) + r["amount"]
    s = await settings()
    return {"balance": int(c.get("wallet") or 0), "pending": sum(r["amount"] for r in rows if r["status"] == "pending"),
            "earned_total": sum(r["amount"] for r in avail if r["amount"] > 0 and r["source"] not in ("remboursement",)),
            "used_total": -sum(r["amount"] for r in avail if r["amount"] < 0), "by_source": by_source,
            "points": int(c.get("loyalty_points") or 0), "point_value": s["point_value_fcfa"], "min_points": s["min_points_conversion"],
            "points_per_fcfa": s["points_per_fcfa"], "history": clean(rows)}


# ---------- Customer ----------
@router.get("/public/account/wallet")
async def my_wallet(c: dict = Depends(get_customer)):
    return await _summary(c["id"])


@router.post("/public/account/wallet/convert")
async def convert_points(body: Dict[str, Any], c: dict = Depends(get_customer)):
    s = await settings()
    pts = int(body.get("points") or 0)
    if pts < s["min_points_conversion"]:
        raise HTTPException(400, f"Minimum {s['min_points_conversion']} points")
    key = str(body.get("key") or new_id())[:64]
    if await db.wallet_tx.find_one({"ref": f"conv:{c['id']}:{key}"}):
        return await _summary(c["id"])
    upd = await db.customers.update_one({"id": c["id"], "loyalty_points": {"$gte": pts}}, {"$inc": {"loyalty_points": -pts}})
    if not upd.modified_count:
        raise HTTPException(400, "Points insuffisants")
    await db.points_tx.insert_one({"id": new_id(), "customer_id": c["id"], "points": -pts, "kind": "conversion", "at": now_iso()})
    await move(c["id"], pts * s["point_value_fcfa"], "conversion", "fidelite", f"Conversion de {pts} points", f"conv:{c['id']}:{key}")
    return await _summary(c["id"])


@router.get("/public/account/referral")
async def my_referral(request: Request, c: dict = Depends(get_customer)):
    s = await settings()
    rows = await db.referrals.find({"parrain_id": c["id"]}).sort("created_at", -1).to_list(500)
    opens = await db.referral_opens.count_documents({"code": c.get("referral_code")})
    items = []
    for r in rows:
        f = await db.customers.find_one({"id": r["filleul_id"]}, {"name": 1})
        first = await db.orders.find_one({"customer.id": r["filleul_id"], "status": {"$nin": list(CANCELLED)}}, {"code": 1, "status": 1})
        st = "recompensee" if r.get("status") == "recompensee" else ("premiere_commande" if first else "inscrite")
        items.append({"id": r["id"], "name": (f or {}).get("name") or r.get("filleul_name"), "created_at": r.get("created_at"),
                      "status": st, "reward": r.get("bonus_parrain"), "rewarded_at": r.get("rewarded_at")})
    return {"code": c.get("referral_code"), "rules": {"parrain": s["referral_bonus_parrain"], "filleul": s["referral_bonus_filleul"]},
            "stats": {"opened": opens, "signed_up": len(items), "first_purchase": sum(1 for i in items if i["status"] in ("premiere_commande", "recompensee")),
                      "rewarded": sum(1 for i in items if i["status"] == "recompensee"),
                      "earned": sum(i["reward"] or 0 for i in items if i["status"] == "recompensee"),
                      "pending": sum(i["reward"] or 0 for i in items if i["status"] != "recompensee")},
            "items": items}


# ---------- Public (invitation link) ----------
@router.get("/public/referral/{code}")
async def check_code(code: str):
    m = await find_marraine(code)
    if not m:
        raise HTTPException(404, "Code de parrainage introuvable")
    s = await settings()
    return {"valid": True, "code": m["referral_code"], "first_name": (m.get("name") or "").split(" ")[0], "bonus_filleul": s["referral_bonus_filleul"]}


@router.post("/public/referral/{code}/open")
async def track_open(code: str, body: Dict[str, Any]):
    m = await find_marraine(code)
    vid = str(body.get("visitor_id") or "")[:64]
    if m and vid:
        await db.referral_opens.update_one({"code": m["referral_code"], "visitor_id": vid},
                                           {"$setOnInsert": {"id": new_id(), "code": m["referral_code"], "visitor_id": vid, "at": now_iso()}}, upsert=True)
    return {"ok": True}


# ---------- Console ----------
@router.get("/customers/{cid}/wallet")
async def customer_wallet(cid: str, user: dict = Depends(get_user)):
    return await _summary(cid)


@router.post("/customers/{cid}/wallet/adjust")
async def adjust_wallet(cid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin", "manager"))):
    amount = int(body.get("amount") or 0)
    reason = str(body.get("reason") or "").strip()
    source = body.get("source") if body.get("source") in ("promotion", "remboursement", "correction", "autre") else "correction"
    if not amount:
        raise HTTPException(400, "Montant requis")
    if len(reason) < 3:
        raise HTTPException(400, "Motif obligatoire")
    tx = await move(cid, amount, "credit" if amount > 0 else "correction", source, reason, f"adj:{new_id()}", body.get("order_code"), user.get("name"))
    await db.audit_log.insert_one({"id": new_id(), "at": now_iso(), "user": user.get("name"), "user_id": user["id"], "action": "wallet_adjust",
                                   "customer_id": cid, "amount": amount, "reason": reason, "source": source})
    return {"ok": True, "tx": clean(tx)}


@router.get("/wallet/transactions")
async def all_transactions(user: dict = Depends(require_role("admin", "manager"))):
    rows = await db.wallet_tx.find({}).sort("at", -1).to_list(500)
    names = {c["id"]: c.get("name") for c in await db.customers.find({"id": {"$in": list({r["customer_id"] for r in rows})}}, {"id": 1, "name": 1}).to_list(1000)}
    return [{**clean(r), "customer_name": names.get(r["customer_id"])} for r in rows]
