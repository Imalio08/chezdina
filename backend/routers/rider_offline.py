"""Rider offline mode: replay actions recorded on the phone, in order, idempotently; console version wins on conflict."""
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException

from deps import db, get_user, now_iso

router = APIRouter(prefix="/api", tags=["rider-offline"])
LABEL = {"status": "changement de statut", "deliver": "livraison", "thread": "message", "conv": "message"}


async def _stamp(oid: str, before_len: int, op: Dict[str, Any], extra: Dict[str, Any] = None) -> None:
    o = await db.orders.find_one({"id": oid}, {"timeline": 1})
    tl = (o or {}).get("timeline") or []
    for e in tl[before_len:]:
        e.update({"at": op["at"], "offline": True, "synced_at": now_iso(), "lat": op.get("lat"), "lng": op.get("lng")})
    await db.orders.update_one({"id": oid}, {"$set": {"timeline": tl, **(extra or {})}})


async def _msg_time(r: Any, op: Dict[str, Any]) -> None:
    m = (r or {}).get("message") if isinstance(r, dict) else None
    if m and m.get("id"):
        await db.conversations.update_one({"messages.id": m["id"]}, {"$set": {"messages.$.at": op["at"], "messages.$.offline": True, "messages.$.synced_at": now_iso()}})


async def _review(o: Dict[str, Any], op: Dict[str, Any], user: dict, why: str) -> Dict[str, Any]:
    p = op.get("payload") or {}
    what = LABEL.get(op["kind"], op["kind"]) + (f" « {p.get('status')} »" if p.get("status") else "")
    await db.orders.update_one({"id": o["id"]}, {"$push": {"timeline": {
        "status": "action_hors_ligne", "at": now_iso(), "by": f"{user.get('name')} (hors ligne)", "offline": True, "offline_rejected": True,
        "offline_action": {"kind": op["kind"], "status": p.get("status"), "reason": p.get("reason"), "at": op["at"], "lat": op.get("lat"), "lng": op.get("lng")},
        "note": f"Action hors ligne non appliquée ({what}, faite à {op['at'][11:16]}) · {why}"}}})
    from routers.notify import notify
    await notify("rider", user["id"], f"Course {o.get('code')} · action non appliquée", f"{why}. La version de la boutique est conservée.",
                 "/riders", "delivery", o.get("code"), f"offline:{op['id']}")
    return {"id": op["id"], "ok": True, "conflict": True, "code": o.get("code"), "message": f"{o.get('code')} : {why}"}


async def _apply(op: Dict[str, Any], user: dict) -> Dict[str, Any]:
    from server import update_order_status, deliver_order, StatusIn, ProofIn
    from routers.messagerie import send_order_thread, rider_conversation_send
    kind, p = op.get("kind"), op.get("payload") or {}
    if kind == "conv":
        try:
            r = await rider_conversation_send(op["conv_id"], p, user)
        except HTTPException as e:
            return {"id": op["id"], "ok": True, "conflict": True, "message": f"Message non envoyé : {e.detail}"}
        await _msg_time(r, op)
        return {"id": op["id"], "ok": True}
    o = await db.orders.find_one({"id": op.get("order_id")})
    if not o:
        return {"id": op["id"], "ok": True, "conflict": True, "message": "Commande supprimée par la boutique"}
    if o.get("rider_id") != user["id"]:
        return await _review(o, op, user, "la commande a été réaffectée à un autre livreur")
    if kind != "thread" and o.get("status") in ("annulee", "livree"):
        return await _review(o, op, user, "la commande a été annulée par la boutique" if o["status"] == "annulee" else "la commande est déjà livrée")
    n = len(o.get("timeline") or [])
    try:
        if kind == "status":
            await update_order_status(o["id"], StatusIn(**p), user)
            await _stamp(o["id"], n, op)
        elif kind == "deliver":
            await deliver_order(o["id"], ProofIn(**p), user)
            await _stamp(o["id"], n, op, {"delivered_at": op["at"], "proof.at": op["at"], "proof.offline": True})
        elif kind == "thread":
            r = await send_order_thread(o["id"], op.get("party") or "rider", p, user)
            await _msg_time(r, op)
        else:
            raise HTTPException(400, "Action inconnue")
    except HTTPException as e:
        return await _review(o, op, user, str(e.detail))
    return {"id": op["id"], "ok": True}


@router.post("/rider/sync")
async def rider_sync(body: Dict[str, Any], user: dict = Depends(get_user)):
    if user.get("role") != "rider":
        raise HTTPException(403, "Réservé aux livreurs")
    ops: List[Dict[str, Any]] = sorted(body.get("ops") or [], key=lambda x: (x.get("seq") or 0))[:100]
    results = []
    for op in ops:
        if not op.get("id") or not op.get("at"):
            continue
        done = await db.rider_sync_ops.find_one({"op_id": op["id"], "rider_id": user["id"]})
        if done:
            results.append(done["result"])
            continue
        res = await _apply(op, user)
        await db.rider_sync_ops.insert_one({"op_id": op["id"], "rider_id": user["id"], "kind": op.get("kind"), "at": op["at"], "synced_at": now_iso(), "result": res})
        results.append(res)
    return {"results": results}
