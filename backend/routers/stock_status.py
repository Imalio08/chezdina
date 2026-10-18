"""Unsellable stock: Défectueux, Invendable, Retour fournisseur, En réparation, Perdu (+ custom reasons).
Declaring takes items out of sellable stock after owner validation; every later change is logged."""
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException

from deps import db, get_user, require_role, new_id, now_iso, clean

router = APIRouter(prefix="/api", tags=["stock-status"])
STATUSES = ["Défectueux", "Invendable", "Retour fournisseur", "En réparation", "Perdu"]
# Outcomes once declared: back to sellable stock, or definitively out
OUTCOMES = {"remis_en_stock": "Réparé · remis en stock", "retour_fournisseur": "Renvoyé au fournisseur", "vendu_remise": "Vendu avec remise",
            "detruit": "Détruit", "en_reparation": "En réparation", "change_statut": "Statut modifié"}


async def _move_stock(pid: str, size: str, delta: int):
    inc = {"stock": delta}
    if size:
        inc[f"stock_by_size.{size}"] = delta
    await db.products.update_one({"id": pid}, {"$inc": inc})


@router.get("/stock/unsellable/statuses")
async def statuses(user: dict = Depends(get_user)):
    extra = (await db.settings_kv.find_one({"key": "unsellable_statuses"}) or {}).get("value") or []
    return STATUSES + [s for s in extra if s not in STATUSES]


@router.post("/stock/unsellable/statuses")
async def add_status(body: Dict[str, Any], user: dict = Depends(require_role("admin", "manager"))):
    s = str(body.get("label") or "").strip()[:40]
    if not s:
        raise HTTPException(400, "Motif obligatoire")
    await db.settings_kv.update_one({"key": "unsellable_statuses"}, {"$addToSet": {"value": s}}, upsert=True)
    return {"ok": True}


@router.get("/stock/unsellable")
async def list_items(user: dict = Depends(get_user)):
    return clean(await db.unsellable_items.find({}).sort("created_at", -1).to_list(500))


@router.post("/stock/unsellable")
async def declare(body: Dict[str, Any], user: dict = Depends(get_user)):
    p = await db.products.find_one({"id": body.get("product_id")})
    if not p:
        raise HTTPException(404, "Produit introuvable")
    qty = int(body.get("qty") or 1)
    if qty < 1:
        raise HTTPException(400, "Quantité invalide")
    if not (body.get("status") or "").strip() or not (body.get("reason") or "").strip():
        raise HTTPException(400, "Statut et motif obligatoires")
    size = body.get("size") or ""
    avail = int(((p.get("stock_by_size") or {}).get(size) if size else p.get("stock")) or 0)
    if qty > avail:
        raise HTTPException(400, f"Stock vendable insuffisant ({avail})")
    doc = {"id": new_id(), "product_id": p["id"], "product_name": p.get("name"), "sku": p.get("sku"), "image": p.get("image"),
           "size": size, "color": body.get("color") or "", "qty": qty, "unit_cost": float(p.get("cost") or 0),
           "status": body["status"].strip(), "reason": body["reason"].strip(), "comment": body.get("comment") or "", "photo": body.get("photo") or None,
           "approval": "pending", "outcome": None, "declared_by": user.get("name"), "declared_by_id": user.get("id"), "created_at": now_iso(),
           "history": [{"action": "declare", "label": f"Déclaré {body['status']}", "by": user.get("name"), "at": now_iso(), "note": body["reason"]}]}
    await db.unsellable_items.insert_one(doc)
    from routers.notify import notify
    for o in await db.users.find({"role": "admin", "active": {"$ne": False}}, {"id": 1}).to_list(10):
        await notify("staff", o["id"], f"Article à valider · {doc['status']}", f"{doc['product_name']} ×{qty} · {user.get('name')}", "/console/stock?tab=invendables", "approval")
    return clean(doc)


@router.post("/stock/unsellable/{iid}/decide")
async def decide(iid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin"))):
    d = await db.unsellable_items.find_one({"id": iid})
    if not d or d.get("approval") != "pending":
        raise HTTPException(400, "Déjà traité")
    ok = body.get("decision") == "approve"
    note = (body.get("note") or "").strip()
    if not ok and not note:
        raise HTTPException(400, "Indiquez le motif du refus")
    if ok:
        p = await db.products.find_one({"id": d["product_id"]}) or {}
        avail = int(((p.get("stock_by_size") or {}).get(d["size"]) if d["size"] else p.get("stock")) or 0)
        if d["qty"] > avail:
            raise HTTPException(400, f"Stock vendable insuffisant ({avail})")
        await _move_stock(d["product_id"], d["size"], -d["qty"])
        await db.stock_movements.insert_one({"id": new_id(), "product_id": d["product_id"], "size": d["size"], "qty": -d["qty"], "type": "unsellable", "ref": iid, "note": f"{d['status']} · {d['reason']}", "by": user.get("name"), "created_at": now_iso()})
    h = {"action": "approve" if ok else "reject", "label": "Validé · retiré du stock vendable" if ok else "Refusé", "by": user.get("name"), "at": now_iso(), "note": note}
    await db.unsellable_items.update_one({"id": iid}, {"$set": {"approval": "approved" if ok else "rejected", "decision_note": note, "decided_by": user.get("name")}, "$push": {"history": h}})
    if d.get("declared_by_id"):
        from routers.notify import notify
        await notify("staff", d["declared_by_id"], f"Déclaration {'validée' if ok else 'refusée'} · {d['product_name']}", note or "", "/console/stock?tab=invendables", "approval")
    return {"ok": True}


@router.post("/stock/unsellable/{iid}/change")
async def change(iid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin", "manager"))):
    d = await db.unsellable_items.find_one({"id": iid})
    if not d or d.get("approval") != "approved":
        raise HTTPException(400, "Article non validé")
    if d.get("outcome") in ("remis_en_stock", "retour_fournisseur", "vendu_remise", "detruit"):
        raise HTTPException(400, "Dossier clôturé")
    out = body.get("outcome")
    if out not in OUTCOMES:
        raise HTTPException(400, "Changement invalide")
    upd: Dict[str, Any] = {"outcome": out if out not in ("en_reparation", "change_statut") else None}
    if out == "en_reparation":
        upd["status"] = "En réparation"
    if out == "change_statut":
        upd["status"] = str(body.get("status") or d["status"])
    if out == "remis_en_stock":
        await _move_stock(d["product_id"], d["size"], d["qty"])
        await db.stock_movements.insert_one({"id": new_id(), "product_id": d["product_id"], "size": d["size"], "qty": d["qty"], "type": "back_to_stock", "ref": iid, "note": "Réparé · remis en stock", "by": user.get("name"), "created_at": now_iso()})
    h = {"action": out, "label": OUTCOMES[out] + (f" · {upd.get('status')}" if out == "change_statut" else ""), "by": user.get("name"), "at": now_iso(), "note": body.get("note") or ""}
    await db.unsellable_items.update_one({"id": iid}, {"$set": upd, "$push": {"history": h}})
    return {"ok": True}
