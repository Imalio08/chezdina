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


async def notify(kind: str, target_id: str, title: str, msg: str, link: str, ntype: str = "info",
                 ref: Optional[str] = None, event_key: Optional[str] = None) -> None:
    """kind: rider | customer | staff. ref = order code / conversation id (auto-read); event_key dedups."""
    if event_key and await db.user_notifications.find_one({"kind": kind, "target_id": target_id, "event_key": event_key}, {"_id": 1}):
        return
    doc = {"id": new_id(), "kind": kind, "target_id": target_id, "type": ntype, "title": title,
           "msg": (msg or "")[:160], "link": link, "ref": ref, "event_key": event_key, "at": now_iso(), "read": False}
    await db.user_notifications.insert_one(doc)
    q = {"kind": kind} if target_id == "all" else {"kind": kind, "owner_id": target_id}
    asyncio.create_task(_push_to(q, {"title": title, "body": doc["msg"], "url": link, "tag": event_key or doc["id"]}))


def course_link(code: Optional[str]) -> str:
    return f"/riders?course={code}" if code else "/riders"


async def notify_riders(title: str, msg: str, link: str, event_key: str) -> None:
    async for r in db.users.find({"role": "rider", "active": {"$ne": False}}, {"id": 1}):
        await notify("rider", r["id"], title, msg, link, "announcement", None, event_key)


async def rider_assigned(o: Dict[str, Any], rider_id: str, prev_rider: Optional[str]) -> None:
    code = o.get("code")
    if prev_rider == rider_id:
        return
    stamp = new_id()[:8]
    if prev_rider:
        await notify("rider", prev_rider, f"Course {code} retirée", "Cette livraison a été réaffectée à un autre livreur.",
                     "/riders", "delivery", code, f"unassign:{o['id']}:{stamp}")
    c = o.get("customer") or {}
    await notify("rider", rider_id, "Nouvelle course attribuée", f"{code} · {c.get('name') or ''} · {o.get('delivery_zone') or ''}",
                 course_link(code), "delivery", code, f"assign:{o['id']}:{rider_id}:{stamp}")


WATCHED = {"customer": "adresse / téléphone", "items": "articles", "total": "montant à encaisser", "payment_method": "mode de paiement",
           "delivery_date": "date de livraison", "delivery_slot": "créneau", "delivery_zone": "zone", "note": "instructions"}


async def order_edited(before: Dict[str, Any], after: Dict[str, Any]) -> None:
    rid = after.get("rider_id")
    if not rid or after.get("status") in ("livree", "annulee"):
        return
    changed = [lbl for k, lbl in WATCHED.items() if before.get(k) != after.get(k)]
    if not changed:
        return
    code = after.get("code")
    await notify("rider", rid, f"Course {code} modifiée", "Mise à jour : " + ", ".join(changed), course_link(code), "delivery", code,
                 f"edit:{after['id']}:{now_iso()[:19]}")


async def notify_staff(title: str, msg: str, link: str) -> None:
    asyncio.create_task(_push_to({"kind": "staff"}, {"title": title, "body": (msg or "")[:160], "url": link}))


STATUS_FR = {"nouvelle": "reçue", "confirmee": "confirmée", "en_preparation": "en préparation", "prete": "prête",
             "assignee": "confiée à un livreur", "en_livraison": "en route", "livree": "livrée", "reportee": "reportée",
             "annulee": "annulée", "echouee": "non livrée", "retournee": "retournée", "refusee": "refusée"}


async def order_status_event(o: Dict[str, Any], status: str, by_rider: bool, rider_id: Optional[str] = None) -> None:
    code = o.get("code")
    key = f"status:{o.get('id')}:{status}:{len(o.get('timeline') or [])}"
    cid = (o.get("customer") or {}).get("id")
    if cid and status in STATUS_FR:
        await notify("customer", cid, f"Commande {code}", f"Votre commande est {STATUS_FR[status]}.",
                     f"/compte/commandes/{code}", "order", code, key)
    rid = rider_id or o.get("rider_id")
    if rid and not by_rider and status not in ("assignee", "livree"):
        label = {"annulee": "annulée par la boutique", "reportee": "reportée par la boutique"}.get(status, STATUS_FR.get(status, status))
        gone = not o.get("rider_id")
        await notify("rider", rid, f"Course {code} {('retirée' if gone else 'mise à jour')}", f"Nouveau statut : {label}",
                     "/riders" if gone else course_link(code), "delivery", code, key)


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


async def _feed(kind: str, owner_id: str, unread_only: bool = False, before: Optional[str] = None, limit: int = 50) -> Dict[str, Any]:
    q: Dict[str, Any] = {"kind": kind, "target_id": owner_id}
    unread = await db.user_notifications.count_documents({**q, "read": False})
    if unread_only:
        q["read"] = False
    if before:
        q["at"] = {"$lte": before}
    rows = await db.user_notifications.find(q).sort("at", -1).to_list(min(max(limit, 1), 100))
    return {"items": clean(rows), "unread": unread}


def _kind(user: dict) -> str:
    return "rider" if user.get("role") == "rider" else "staff"


async def mark_ref_read(kind: str, owner_id: str, ref: str) -> None:
    await db.user_notifications.update_many({"kind": kind, "target_id": owner_id, "ref": ref, "read": False}, {"$set": {"read": True}})


@router.get("/me/notifications")
async def my_notifications(user: dict = Depends(get_user), unread_only: bool = False, before: Optional[str] = None, limit: int = 50):
    return await _feed(_kind(user), user["id"], unread_only, before, limit)


@router.post("/me/notifications/read")
async def my_notifications_read(body: Optional[Dict[str, Any]] = None, user: dict = Depends(get_user)):
    q: Dict[str, Any] = {"kind": _kind(user), "target_id": user["id"], "read": False}
    if body and body.get("ref"):
        q["ref"] = str(body["ref"])
    if body and body.get("ids"):
        q["id"] = {"$in": [str(i) for i in body["ids"]][:200]}
    r = await db.user_notifications.update_many(q, {"$set": {"read": True}})
    return {"ok": True, "updated": r.modified_count}


@router.get("/public/account/notifications")
async def customer_notifications(c: dict = Depends(get_customer)):
    return await _feed("customer", c["id"])


@router.post("/public/account/notifications/read")
async def customer_notifications_read(c: dict = Depends(get_customer)):
    await db.user_notifications.update_many({"kind": "customer", "target_id": c["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}
