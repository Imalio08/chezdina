"""Wave: the customer uploads a payment proof, the manager checks Wave then marks the payment received."""
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Request

from deps import db, now_iso, norm_phone, get_customer, require_role

router = APIRouter(prefix="/api", tags=["wave"])
DONE = ("paye", "acompte_recu")


def _is_deposit(o: Dict[str, Any]) -> bool:
    return o.get("status") == "en_attente_acompte"


def _needs_wave(o: Dict[str, Any]) -> bool:
    return (o.get("payment_method") == "wave" or _is_deposit(o)) and o.get("payment_status") not in DONE


@router.post("/public/orders/{code}/wave-proof")
async def submit_proof(code: str, body: Dict[str, Any], request: Request):
    o = await db.orders.find_one({"code": code})
    if not o:
        raise HTTPException(404, "Commande introuvable")
    if not _needs_wave(o):
        raise HTTPException(400, "Aucun paiement Wave en attente pour cette commande")
    if o.get("status") in ("annulee", "livree"):
        raise HTTPException(400, "Commande clôturée")
    try:
        logged = await get_customer(request)
    except HTTPException:
        logged = None
    cust = o.get("customer") or {}
    same_account = logged and cust.get("id") and logged["id"] == cust["id"]
    phone = norm_phone(body.get("phone") or "")[-8:]
    if not same_account and (len(phone) < 8 or phone != norm_phone(cust.get("phone") or "")[-8:]):
        raise HTTPException(403, "Ce numéro ne correspond pas à celui de la commande")
    image = body.get("image") or ""
    if not isinstance(image, str) or not image.startswith("data:image/"):
        raise HTTPException(400, "Ajoutez la capture d'écran de votre paiement Wave")
    if len(image) > 4_000_000:
        raise HTTPException(400, "Image trop lourde · 3 Mo maximum")
    proof = {"image": image, "tx_ref": (body.get("tx_ref") or "").strip()[:60] or None, "submitted_at": now_iso(),
             "status": "en_attente", "kind": "acompte" if _is_deposit(o) else "total",
             "amount": int(o.get("deposit_required") or 0) if _is_deposit(o) else int(o.get("total") or 0)}
    await db.orders.update_one({"id": o["id"]}, {"$set": {"wave_proof": proof, "payment_status": "preuve_envoyee"},
                               "$push": {"timeline": {"status": o.get("status"), "at": now_iso(), "by": cust.get("name") or "Cliente",
                                                      "note": "Preuve de paiement Wave envoyée · en attente de vérification"}}})
    from routers.notify import notify_staff
    await notify_staff("Paiement Wave à vérifier", f"{code} · {cust.get('name') or ''} · {proof['amount']} FCFA", f"/console/commandes/{code}")
    return {"ok": True, "payment_status": "preuve_envoyee"}


@router.post("/orders/{oid}/wave-verify")
async def verify_proof(oid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin", "manager"))):
    o = await db.orders.find_one({"id": oid})
    if not o:
        raise HTTPException(404)
    if o.get("payment_status") in DONE:
        raise HTTPException(400, "Paiement déjà validé")
    decision = body.get("decision")
    cust = o.get("customer") or {}
    tx = (body.get("tx_ref") or (o.get("wave_proof") or {}).get("tx_ref") or "").strip() or None
    if decision == "accept":
        s = {"wave_proof.status": "acceptee", "wave_proof.verified_by": user.get("name"), "wave_proof.verified_at": now_iso()}
        if _is_deposit(o):
            s.update({"deposit_paid": int(o.get("deposit_required") or 0), "deposit_tx_ref": tx, "deposit_paid_at": now_iso(),
                      "status": "confirmee", "payment_status": "acompte_recu"})
            note, status, msg = "Acompte Wave vérifié et reçu", "confirmee", "Votre acompte Wave a bien été reçu. Merci !"
        else:
            s.update({"payment_status": "paye", "paid_at": now_iso(), "payment_tx_ref": tx})
            note, status, msg = "Paiement Wave vérifié et reçu", o.get("status"), "Votre paiement Wave a bien été reçu. Merci !"
    elif decision == "reject":
        reason = (body.get("reason") or "").strip()
        if not reason:
            raise HTTPException(400, "Indiquez le motif du refus")
        s = {"wave_proof.status": "refusee", "wave_proof.reject_reason": reason, "wave_proof.verified_by": user.get("name"),
             "wave_proof.verified_at": now_iso(), "payment_status": "preuve_refusee"}
        note, status, msg = f"Preuve Wave refusée · {reason}", o.get("status"), f"Paiement Wave non retrouvé : {reason}. Merci d'envoyer une nouvelle preuve."
    else:
        raise HTTPException(400, "Décision invalide")
    await db.orders.update_one({"id": oid}, {"$set": s, "$push": {"timeline": {"status": status, "at": now_iso(), "by": user.get("name"), "note": note}}})
    if cust.get("id"):
        from routers.notify import notify
        await notify("customer", cust["id"], f"Commande {o.get('code')}", msg, f"/compte/commandes/{o.get('code')}", "order", o.get("code"),
                     f"wave:{oid}:{decision}:{now_iso()[:19]}")
    return {"ok": True, "payment_status": s["payment_status"]}
