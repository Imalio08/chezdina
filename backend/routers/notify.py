"""Notifications for riders, customers and staff: in-app feed + Web Push (VAPID)."""
import asyncio
import json
import logging
import os
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pywebpush import webpush, WebPushException

from deps import db, get_user, get_customer, clean, new_id, now_iso

router = APIRouter(prefix="/api", tags=["notify"])
log = logging.getLogger("notify")
STAFF_ROLES = ("admin", "manager", "sales", "stock", "cashier")


def _send_push(sub: Dict[str, Any], payload: Dict[str, Any]) -> Optional[int]:
    try:
        webpush(subscription_info=sub, data=json.dumps(payload),
                vapid_private_key=os.environ["VAPID_PRIVATE_KEY"],
                vapid_claims={"sub": os.environ["VAPID_SUBJECT"]}, ttl=86400)
        return 201
    except WebPushException as e:
        return getattr(e.response, "status_code", 500)
    except Exception as e:  # noqa: BLE001
        log.warning("push failed: %s", e)
        return 500


async def _push_to(query: Dict[str, Any], payload: Dict[str, Any]) -> None:
    subs = await db.push_subscriptions.find(query).to_list(200)
    for s in subs:
        code = await asyncio.to_thread(_send_push, s["subscription"], payload)
        if code in (404, 410):
            await db.push_subscriptions.delete_one({"endpoint": s["endpoint"]})


async def notify(kind: str, target_id: str, title: str, msg: str, link: str, ntype: str = "info") -> None:
    """kind: rider | customer | staff (target_id='all' for every staff member)."""
    doc = {"id": new_id(), "kind": kind, "target_id": target_id, "type": ntype, "title": title,
           "msg": (msg or "")[:160], "link": link, "at": now_iso(), "read": False}
    await db.user_notifications.insert_one(doc)
    q = {"kind": kind} if target_id == "all" else {"kind": kind, "owner_id": target_id}
    asyncio.create_task(_push_to(q, {"title": title, "body": doc["msg"], "url": link}))


async def notify_staff(title: str, msg: str, link: str) -> None:
    asyncio.create_task(_push_to({"kind": "staff"}, {"title": title, "body": (msg or "")[:160], "url": link}))


STATUS_FR = {"nouvelle": "reçue", "confirmee": "confirmée", "en_preparation": "en préparation", "prete": "prête",
             "assignee": "confiée à un livreur", "en_livraison": "en route", "livree": "livrée", "reportee": "reportée",
             "annulee": "annulée", "echouee": "non livrée", "retournee": "retournée", "refusee": "refusée"}


async def order_status_event(o: Dict[str, Any], status: str, by_rider: bool) -> None:
    code = o.get("code")
    cid = (o.get("customer") or {}).get("id")
    if cid and status in STATUS_FR:
        await notify("customer", cid, f"Commande {code}", f"Votre commande est {STATUS_FR[status]}.",
                     f"/boutique/compte/commandes/{code}", "order")
    if o.get("rider_id") and not by_rider and status not in ("assignee", "livree"):
        await notify("rider", o["rider_id"], f"Course {code} modifiée", f"Nouveau statut : {STATUS_FR.get(status, status)}",
                     "/rider", "delivery")


async def _save_sub(kind: str, owner_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    sub = body.get("subscription") or {}
    ep = sub.get("endpoint")
    if not ep or not (sub.get("keys") or {}).get("p256dh"):
        raise HTTPException(400, "Abonnement invalide")
    await db.push_subscriptions.update_one(
        {"endpoint": ep},
        {"$set": {"endpoint": ep, "subscription": sub, "kind": kind, "owner_id": owner_id, "updated_at": now_iso()}},
        upsert=True)
    return {"ok": True}


@router.post("/push/subscribe")
async def staff_subscribe(body: Dict[str, Any], user: dict = Depends(get_user)):
    return await _save_sub("rider" if user.get("role") == "rider" else "staff", user["id"], body)


@router.post("/public/account/push/subscribe")
async def customer_subscribe(body: Dict[str, Any], c: dict = Depends(get_customer)):
    return await _save_sub("customer", c["id"], body)


@router.post("/push/test")
async def push_test(user: dict = Depends(get_user)):
    kind = "rider" if user.get("role") == "rider" else "staff"
    await _push_to({"kind": kind, "owner_id": user["id"]}, {"title": "Chez Dina", "body": "Les notifications fonctionnent ✅", "url": "/"})
    return {"ok": True}


async def _feed(kind: str, owner_id: str) -> Dict[str, Any]:
    q = {"kind": kind, "target_id": owner_id}
    rows = await db.user_notifications.find(q).sort("at", -1).to_list(50)
    unread = await db.user_notifications.count_documents({**q, "read": False})
    return {"items": clean(rows), "unread": unread}


@router.get("/me/notifications")
async def my_notifications(user: dict = Depends(get_user)):
    return await _feed("rider" if user.get("role") == "rider" else "staff", user["id"])


@router.post("/me/notifications/read")
async def my_notifications_read(user: dict = Depends(get_user)):
    kind = "rider" if user.get("role") == "rider" else "staff"
    await db.user_notifications.update_many({"kind": kind, "target_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


@router.get("/public/account/notifications")
async def customer_notifications(c: dict = Depends(get_customer)):
    return await _feed("customer", c["id"])


@router.post("/public/account/notifications/read")
async def customer_notifications_read(c: dict = Depends(get_customer)):
    await db.user_notifications.update_many({"kind": "customer", "target_id": c["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}
