"""Cash session analysis sent to the owner when the Gérante submits her (blind) count."""
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException

from deps import db, require_role, clean, amount_due

router = APIRouter(prefix="/api", tags=["cash-analysis"])
CANCELLED = ("annulee", "retournee", "refusee", "echouee")


async def analyze(s: Dict[str, Any]) -> Dict[str, Any]:
    start = s["opened_at"]
    end = s.get("closed_at") or s.get("handover_at") or "9999"
    rng = {"$gte": start, "$lte": end}
    movs = await db.cash_movements.find({"created_at": rng}).sort("created_at", 1).to_list(1000)
    rider_in = sum(m["amount"] for m in movs if m["type"] == "in" and m.get("kind") == "rider_cod")
    other_in = sum(m["amount"] for m in movs if m["type"] == "in" and m.get("kind") != "rider_cod")
    refunds = [m for m in movs if m["type"] == "out" and m.get("kind") == "refund"]
    outs = sum(m["amount"] for m in movs if m["type"] == "out")
    orders = await db.orders.find({"created_at": rng, "channel": {"$in": ["store", "pos"]}}).to_list(3000)
    by_method: Dict[str, float] = {}
    for o in orders:
        if o.get("status") in CANCELLED:
            continue
        by_method[o.get("payment_method") or "autre"] = by_method.get(o.get("payment_method") or "autre", 0) + float(o.get("total") or 0)
    cash_sales = by_method.get("cash", 0)
    expected = int(float(s.get("opening_cash") or 0) + cash_sales + rider_in + other_in - outs)
    counted = s.get("handover_amount")
    gap = None if counted is None else int(counted) - expected

    attention = []
    day = start[:10]
    unrec = 0
    for d in await db.delivery_sessions.find({"date": day}).to_list(50):
        rec = d.get("reconciliations") or {}
        for oid in d.get("orders") or []:
            if not (rec.get(oid) or {}).get("collected"):
                o = await db.orders.find_one({"id": oid, "status": "livree", "payment_method": "cod"}, {"total": 1, "deposit_paid": 1, "payment_method": 1})
                if o and amount_due(o) > 0:
                    unrec += 1
    if unrec:
        attention.append(f"{unrec} livraison(s) payée(s) en espèces pas encore réconciliée(s) avec les livreurs")
    if len(refunds) >= 2:
        attention.append(f"{len(refunds)} remboursements en espèces pendant la session")
    voided = [o for o in orders if o.get("status") in CANCELLED and o.get("payment_status") == "paye"]
    if voided:
        attention.append(f"{len(voided)} vente(s) annulée(s) après paiement : " + ", ".join(o["code"] for o in voided[:5]))
    disc = [o for o in orders if float(o.get("discount") or 0) > 0.15 * max(1, float(o.get("total") or 0) + float(o.get("discount") or 0))]
    if disc:
        attention.append(f"{len(disc)} vente(s) avec une remise supérieure à 15 %")
    pend = await db.approval_requests.count_documents({"status": "pending"}) + await db.stock_adjustment_requests.count_documents({"status": "pending"})
    if pend:
        attention.append(f"{pend} demande(s) d'approbation en attente")
    return {
        "opening_cash": s.get("opening_cash") or 0, "cash_sales": cash_sales, "rider_cash": rider_in, "other_in": other_in, "outs": outs,
        "refunds": sum(m["amount"] for m in refunds), "expected": expected, "counted": counted, "gap": gap,
        "verdict": None if gap is None else ("Conforme" if gap == 0 else f"Écart de {gap:+,} FCFA".replace(",", " ")),
        "attention": attention, "by_method": by_method, "movements": clean(movs),
    }


@router.get("/cash-sessions/{sid}/analysis")
async def cash_analysis(sid: str, user: dict = Depends(require_role("admin"))):
    s = await db.cash_sessions.find_one({"id": sid})
    if not s:
        raise HTTPException(404)
    return await analyze(s)
