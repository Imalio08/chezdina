"""
Messagerie router — in-app messaging between store/riders/customers.

Extracted from server.py (P5 Refactor Feb 2026). Covers:
 - Staff ↔ customer / staff ↔ rider conversations (list, open, archive, pin,
   react, read, send).
 - Customer-side account thread helpers + reply.
 - Owner/manager broadcast to customers or riders.
 - Auto-close helper for customer↔rider threads when the order is delivered.

The `send_message_core` function is exposed for other routers / server.py to
reuse when they need to drop a message into a conversation (campaigns, bots).
"""
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException

from deps import (
    db, get_user, get_customer, require_role,
    clean, new_id, now_iso,
)
from routers.notify import notify, notify_staff, mark_ref_read

router = APIRouter(prefix="/api", tags=["messagerie"])


def _conv_key(parts: List[str]) -> str:
    return "|".join(sorted(parts))


async def _mark_read(cid: str, uid: str) -> None:
    await db.conversations.update_one({"id": cid}, {"$addToSet": {"messages.$[m].read_by": uid}},
                                      array_filters=[{"m.read_by": {"$ne": uid}}])


# -------- Core helper (reusable by server.py / other routers) --------
async def send_message_core(body: Dict[str, Any], user: dict) -> Dict[str, Any]:
    """Create or append to a conversation. Returns {ok, conversation_id, message}."""
    cust_id = body.get("customer_id")
    rider_id = body.get("rider_id")
    order_id = body.get("order_id")
    kind = body.get("kind") or ("boutique_livreur" if rider_id and not cust_id else "boutique_cliente")
    existing = await db.conversations.find_one({"id": body["conversation_id"]}) if body.get("conversation_id") else None
    if existing and not existing.get("key", "").startswith("order:"):
        pk = {p.get("kind"): p.get("id") for p in existing.get("participants") or []}
        cust_id, rider_id = pk.get("customer"), pk.get("rider")
    else:
        existing = None
    parts: List[str] = []
    if cust_id:
        parts.append(f"c:{cust_id}")
    if rider_id:
        parts.append(f"r:{rider_id}")
    if not cust_id and not rider_id:
        raise HTTPException(400, "customer_id ou rider_id requis")
    parts.append(f"s:{user['id']}")
    key = _conv_key(parts)
    conv = existing or await db.conversations.find_one({"key": key})
    safe_attachments = _image_attachments(body.get("attachments"))
    msg = {
        "id": new_id(), "at": now_iso(),
        "from_id": user["id"], "from_name": user.get("name"), "from_kind": "store",
        "text": str(body.get("text", "") or "")[:5000],
        "image": body.get("image"),
        "attachments": safe_attachments,
        "reactions": {}, "read_by": [user["id"]],
    }
    if not conv:
        participants = [{"kind": "store", "id": user["id"], "name": user.get("name")}]
        if cust_id:
            cust = await db.customers.find_one({"id": cust_id})
            if cust:
                participants.append({"kind": "customer", "id": cust_id, "name": cust.get("name")})
        if rider_id:
            r = await db.users.find_one({"id": rider_id})
            if r:
                participants.append({"kind": "rider", "id": rider_id, "name": r.get("name")})
        conv = {
            "id": new_id(), "key": key, "kind": kind, "order_id": order_id,
            "closed": False, "archived": False, "pinned": False,
            "participants": participants, "messages": [msg],
            "created_at": now_iso(), "updated_at": now_iso(),
        }
        await db.conversations.insert_one(conv)
    else:
        if conv.get("closed"):
            raise HTTPException(400, "Conversation fermée")
        await db.conversations.update_one(
            {"id": conv["id"]},
            {"$push": {"messages": msg}, "$set": {"updated_at": now_iso(), "archived": False, "archived_for": []}},
        )
    preview = msg["text"][:80] or "📷 Pièce jointe"
    if cust_id:
        await notify("customer", cust_id, "Nouveau message de la boutique", preview, f"/compte/messages/{conv['id']}", "message")
    if rider_id:
        await notify("rider", rider_id, f"Message de {user.get('name') or 'la boutique'}", preview, f"/riders/messages/{conv['id']}", "message", conv["id"], f"msg:{msg['id']}")
    return {"ok": True, "conversation_id": conv["id"], "message": msg}


async def close_rider_customer_convs(order_id: str) -> None:
    """Auto-close customer↔rider convos when order becomes 'livree'."""
    await db.conversations.update_many(
        {"order_id": order_id, "kind": {"$in": ["cliente_livreur", "livreur_cliente"]}},
        {"$set": {"closed": True, "closed_at": now_iso()}},
    )


# ---------- Customer thread helpers ----------
def _conv_match(r: Dict[str, Any], q: str) -> bool:
    q = (q or "").strip().lower()
    if not q:
        return True
    hay = " ".join([str(r.get("order_code") or "")] + [str(p.get("name") or "") for p in r.get("participants") or []]).lower()
    return q in hay or any(q in (m.get("text") or "").lower() for m in r.get("messages") or [])


@router.get("/public/account/threads")
async def account_threads(q: str = "", c: dict = Depends(get_customer)):
    rows = [r for r in await db.conversations.find({"participants.id": c["id"]}).sort("updated_at", -1).to_list(100) if _conv_match(r, q)]
    out = []
    for r in rows:
        parts = r.get("participants") or []
        other = next((p for p in parts if p.get("id") != c["id"]), {})
        last = (r.get("messages") or [{}])[-1] if r.get("messages") else None
        unread = sum(1 for m in (r.get("messages") or []) if c["id"] not in (m.get("read_by") or []))
        out.append({
            "id": r.get("id"), "kind": r.get("kind"), "order_id": r.get("order_id"),
            "with": other, "last_message": last, "unread": unread,
            "updated_at": r.get("updated_at"), "archived": c["id"] in (r.get("archived_for") or []),
        })
    return clean(out)


async def _archive_for(cid: str, uid: str, archived: bool):
    r = await db.conversations.find_one({"id": cid, "participants.id": uid}, {"id": 1})
    if not r:
        raise HTTPException(404, "Conversation introuvable")
    op = {"$addToSet": {"archived_for": uid}} if archived else {"$pull": {"archived_for": uid}}
    await db.conversations.update_one({"id": cid}, op)
    return {"ok": True, "archived": archived}


@router.patch("/public/account/threads/{cid}/archive")
async def account_archive(cid: str, body: Dict[str, Any], c: dict = Depends(get_customer)):
    return await _archive_for(cid, c["id"], bool(body.get("archived", True)))


@router.patch("/rider/conversations/{cid}/archive")
async def rider_archive(cid: str, body: Dict[str, Any], user: dict = Depends(get_user)):
    return await _archive_for(cid, user["id"], bool(body.get("archived", True)))


@router.post("/public/account/thread/rider/{order_code}")
async def account_open_rider_thread(order_code: str, c: dict = Depends(get_customer)):
    o = await db.orders.find_one({"code": order_code, "customer.id": c["id"]})
    if not o:
        raise HTTPException(404, "Commande introuvable")
    if not o.get("rider_id"):
        raise HTTPException(400, "Pas de livreur assigné")
    conv = await _order_thread(o, "rider_customer")
    return {"id": conv["id"]}


# ---------- Staff messaging ----------
@router.get("/messages/conversations")
async def list_conversations(user: dict = Depends(get_user), archived: bool = False):
    """List conversations where staff is a participant. ?archived=true shows archived only."""
    q: Dict[str, Any] = {"participants.kind": {"$in": ["store", "rider"]}}
    if archived:
        q["archived"] = True
    else:
        q["$or"] = [{"archived": {"$exists": False}}, {"archived": False}]
    rows = await db.conversations.find(q).sort([("pinned", -1), ("updated_at", -1)]).to_list(500)
    for r in rows:
        unread_me = sum(
            1 for m in (r.get("messages") or [])
            if not (m.get("read_by") or []) or user["id"] not in (m.get("read_by") or [])
        )
        r["unread"] = unread_me
        r["last_message"] = (r.get("messages") or [{}])[-1] if r.get("messages") else None
    return clean(rows)


@router.post("/messages/open")
async def open_or_create_conv(body: Dict[str, Any], user: dict = Depends(get_user)):
    """Open or create a conversation with a rider or customer. Body: {rider_id?|customer_id?, kind?}"""
    cust_id = body.get("customer_id")
    rider_id = body.get("rider_id")
    if not cust_id and not rider_id:
        raise HTTPException(400, "customer_id ou rider_id requis")
    kind = body.get("kind") or ("boutique_livreur" if rider_id else "boutique_cliente")
    parts = [f"s:{user['id']}"]
    if cust_id:
        parts.append(f"c:{cust_id}")
    if rider_id:
        parts.append(f"r:{rider_id}")
    key = _conv_key(parts)
    conv = await db.conversations.find_one({"key": key})
    if conv:
        if conv.get("archived"):
            await db.conversations.update_one({"id": conv["id"]}, {"$set": {"archived": False, "updated_at": now_iso()}})
        return {"id": conv["id"], "created": False}
    participants = [{"kind": "store", "id": user["id"], "name": user.get("name")}]
    if cust_id:
        cust = await db.customers.find_one({"id": cust_id})
        if cust:
            participants.append({"kind": "customer", "id": cust_id, "name": cust.get("name")})
    if rider_id:
        r = await db.users.find_one({"id": rider_id})
        if r:
            participants.append({"kind": "rider", "id": rider_id, "name": r.get("name")})
    conv = {
        "id": new_id(), "key": key, "kind": kind,
        "closed": False, "archived": False, "pinned": False,
        "participants": participants, "messages": [],
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.conversations.insert_one(conv)
    return {"id": conv["id"], "created": True}


@router.patch("/messages/conversations/{conv_id}/archive")
async def toggle_archive(conv_id: str, body: Dict[str, Any] = None, user: dict = Depends(get_user)):
    c = await db.conversations.find_one({"id": conv_id})
    if not c:
        raise HTTPException(404)
    nxt = not bool(c.get("archived", False)) if (body is None or body.get("archived") is None) else bool(body.get("archived"))
    await db.conversations.update_one({"id": conv_id}, {"$set": {"archived": nxt, "updated_at": now_iso()}})
    return {"ok": True, "archived": nxt}


@router.patch("/messages/conversations/{conv_id}/pin")
async def toggle_pin(conv_id: str, body: Dict[str, Any] = None, user: dict = Depends(get_user)):
    c = await db.conversations.find_one({"id": conv_id})
    if not c:
        raise HTTPException(404)
    nxt = not bool(c.get("pinned", False)) if (body is None or body.get("pinned") is None) else bool(body.get("pinned"))
    await db.conversations.update_one({"id": conv_id}, {"$set": {"pinned": nxt, "updated_at": now_iso()}})
    return {"ok": True, "pinned": nxt}


@router.post("/messages/conversations/{conv_id}/react")
async def react_message(conv_id: str, body: Dict[str, Any], user: dict = Depends(get_user)):
    """Toggle an emoji reaction from `user` on message `message_id`."""
    msg_id = body.get("message_id")
    emoji = (body.get("emoji") or "").strip()[:16]
    if not msg_id or not emoji:
        raise HTTPException(400, "message_id et emoji requis")
    c = await db.conversations.find_one({"id": conv_id})
    if not c:
        raise HTTPException(404)
    msgs = c.get("messages") or []
    for m in msgs:
        if m.get("id") == msg_id:
            reacts = m.setdefault("reactions", {})
            uids = reacts.get(emoji, [])
            if user["id"] in uids:
                uids.remove(user["id"])
                if not uids:
                    reacts.pop(emoji, None)
                else:
                    reacts[emoji] = uids
            else:
                reacts[emoji] = uids + [user["id"]]
            break
    await db.conversations.update_one({"id": conv_id}, {"$set": {"messages": msgs, "updated_at": now_iso()}})
    return {"ok": True}


@router.get("/messages/conversations/{conv_id}")
async def get_conversation(conv_id: str, user: dict = Depends(get_user)):
    c = await db.conversations.find_one({"id": conv_id})
    if not c:
        raise HTTPException(404)
    msgs = c.get("messages") or []
    changed = False
    for m in msgs:
        if user["id"] not in (m.get("read_by") or []):
            m.setdefault("read_by", []).append(user["id"])
            changed = True
    if changed:
        await _mark_read(conv_id, user["id"])
    return clean(c)


@router.post("/messages/send")
async def send_message(body: Dict[str, Any], user: dict = Depends(get_user)):
    """Create or append to a conversation. Body: {customer_id?, rider_id?, order_id?, text, image?, attachments?, kind?}"""
    return await send_message_core(body, user)


_ATT_TYPES = {"image": ("data:image/",), "video": ("data:video/",), "audio": ("data:audio/",), "file": ("data:application/", "data:text/")}


def _image_attachments(raw) -> List[Dict[str, Any]]:
    """Images, videos, audio and files (data URLs ≤ ~7 Mo or https links), max 5."""
    out: List[Dict[str, Any]] = []
    for a in (raw or [])[:5]:
        a = a if isinstance(a, dict) else {}
        t = a.get("type")
        u = str(a.get("url") or "")
        if t in _ATT_TYPES and len(u) <= 9_500_000 and (u.startswith(_ATT_TYPES[t]) or u.startswith("https://")):
            out.append({"type": t, "url": u, "name": str(a.get("name") or ("photo.jpg" if t == "image" else "fichier"))[:120],
                        "mime": str(a.get("mime") or ("image/jpeg" if t == "image" else ""))[:80], "size": _safe_int(a.get("size"))})
    return out


def _safe_int(v) -> int:
    try:
        return max(0, int(v or 0))
    except (TypeError, ValueError):
        return 0


# ---------- Customer-side send ----------
@router.get("/public/account/messages")
async def customer_messages(c: dict = Depends(get_customer)):
    rows = await db.conversations.find({"participants.id": c["id"]}).sort("updated_at", -1).to_list(100)
    return clean(rows)


@router.post("/public/account/messages/send")
async def customer_send(body: Dict[str, Any], c: dict = Depends(get_customer)):
    conv_id = body.get("conversation_id")
    conv = await db.conversations.find_one({"id": conv_id, "participants.id": c["id"]})
    if not conv:
        raise HTTPException(404)
    if conv.get("closed"):
        raise HTTPException(400, "Conversation fermée")
    atts = _image_attachments(body.get("attachments"))
    if not (body.get("text") or "").strip() and not atts:
        raise HTTPException(400, "Message vide")
    msg = {
        "id": new_id(), "at": now_iso(),
        "from_id": c["id"], "from_name": c.get("name"), "from_kind": "customer",
        "text": body.get("text", ""), "image": body.get("image"), "attachments": atts,
        "read_by": [c["id"]],
    }
    await db.conversations.update_one({"id": conv_id}, {"$push": {"messages": msg}, "$set": {"updated_at": now_iso(), "archived": False, "archived_for": []}})
    preview = (msg["text"] or "📷 Photo")[:80]
    rider = next((p for p in conv.get("participants") or [] if p.get("kind") == "rider"), None)
    if conv.get("kind") == "livreur_cliente" and rider:
        await notify("rider", rider["id"], f"Message de {c.get('name') or 'la cliente'}", preview, f"/riders/messages/{conv_id}", "message", conv_id, f"msg:{msg['id']}")
    elif conv.get("order_code"):
        await _notify_reply(conv, c.get("name"), "cliente", preview)
    else:
        await db.notifications.insert_one({"id": new_id(), "type": "message", "title": f"Message de {c.get('name')}", "msg": preview, "color": "#5867fd", "at": now_iso(), "link": "/console/messagerie"})
        await notify_staff(f"Message de {c.get('name')}", preview, "/console/messagerie")
    return {"ok": True, "message": msg}


# ---------- Order-scoped threads (shared by the whole team) ----------
async def _notify_reply(conv: Dict[str, Any], who: str, role: str, text: str) -> None:
    await db.notifications.insert_one({
        "id": new_id(), "type": "order_message", "title": f"Message {role} · {conv.get('order_code')}",
        "msg": f"{who} : {(text or '')[:70]}", "color": "#5867fd", "at": now_iso(),
        "link": f"/console/commandes/{conv.get('order_code')}?focus=order-messages",
    })
    await notify_staff(f"Message {role} · {conv.get('order_code')}", f"{who} : {(text or '')[:70]}", f"/console/commandes/{conv.get('order_code')}")


async def _order_thread(o: Dict[str, Any], party: str) -> Dict[str, Any]:
    if party not in ("customer", "rider", "rider_customer"):
        raise HTTPException(400, "Fil inconnu")
    key = f"order:{o['id']}|{party}"
    conv = await db.conversations.find_one({"key": key})
    cust = o.get("customer") or {}
    if party in ("customer", "rider_customer") and not cust.get("id"):
        raise HTTPException(400, "Cette cliente n'a pas de compte · utilisez WhatsApp")
    if party in ("rider", "rider_customer") and not o.get("rider_id"):
        raise HTTPException(400, "Aucun livreur assigné")
    if party == "rider_customer":
        participants = [{"kind": "rider", "id": o["rider_id"], "name": f"{o.get('rider_name') or 'Livreur'} (livreur) · {o.get('code')}"},
                        {"kind": "customer", "id": cust["id"], "name": cust.get("name")}]
    else:
        other = ({"kind": "customer", "id": cust["id"], "name": cust.get("name")} if party == "customer"
                 else {"kind": "rider", "id": o["rider_id"], "name": o.get("rider_name")})
        participants = [{"kind": "store", "id": "store", "name": f"Chez Dina · {o.get('code')}"}, other]
    if conv:
        if conv.get("participants") != participants:
            await db.conversations.update_one({"id": conv["id"]}, {"$set": {"participants": participants}})
            conv["participants"] = participants
        return conv
    conv = {
        "id": new_id(), "key": key, "kind": {"customer": "commande_cliente", "rider": "commande_livreur"}.get(party, "livreur_cliente"),
        "order_id": o["id"], "order_code": o.get("code"), "closed": False, "archived": False, "pinned": False,
        "participants": participants, "messages": [], "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.conversations.insert_one(conv)
    return conv


async def _order_for(oid: str, party: str, user: dict) -> Dict[str, Any]:
    o = await db.orders.find_one({"$or": [{"id": oid}, {"code": oid}]})
    if not o:
        raise HTTPException(404, "Commande introuvable")
    if user.get("role") == "rider" and (party not in ("rider", "rider_customer") or o.get("rider_id") != user["id"]):
        raise HTTPException(403, "Accès refusé")
    return o


@router.get("/orders/{oid}/thread/{party}")
async def get_order_thread(oid: str, party: str, user: dict = Depends(get_user)):
    conv = await _order_thread(await _order_for(oid, party, user), party)
    msgs = conv.get("messages") or []
    if any(user["id"] not in (m.get("read_by") or []) for m in msgs):
        for m in msgs:
            if user["id"] not in (m.get("read_by") or []):
                m.setdefault("read_by", []).append(user["id"])
        await _mark_read(conv["id"], user["id"])
    return clean(conv)


@router.post("/orders/{oid}/thread/{party}/send")
async def send_order_thread(oid: str, party: str, body: Dict[str, Any], user: dict = Depends(get_user)):
    text = str(body.get("text") or "").strip()[:5000]
    atts = _image_attachments(body.get("attachments"))
    if not text and not atts:
        raise HTTPException(400, "Message vide")
    if party == "rider_customer" and user.get("role") != "rider":
        raise HTTPException(403, "Échange livreur ↔ cliente en lecture seule")
    conv = await _order_thread(await _order_for(oid, party, user), party)
    if conv.get("closed"):
        raise HTTPException(400, "Conversation fermée")
    is_rider = user.get("role") == "rider"
    msg = {"id": new_id(), "at": now_iso(), "from_id": user["id"], "from_name": user.get("name"),
           "from_kind": "rider" if is_rider else "store", "text": text, "attachments": atts, "read_by": [user["id"]], "reactions": {}}
    await db.conversations.update_one({"id": conv["id"]}, {"$push": {"messages": msg}, "$set": {"updated_at": now_iso(), "archived": False, "archived_for": []}})
    await _after_order_msg(conv, party, user, text or "📷 Photo")
    return {"ok": True, "conversation_id": conv["id"], "message": msg}


async def _after_order_msg(conv: Dict[str, Any], party: str, user: dict, preview: str) -> None:
    code = conv.get("order_code")
    parts = {p.get("kind"): p for p in conv.get("participants") or []}
    if user.get("role") == "rider":
        if party == "rider_customer" and parts.get("customer"):
            await notify("customer", parts["customer"]["id"], "Message de votre livreur", preview[:80], f"/compte/messages/{conv['id']}", "message")
        else:
            await _notify_reply(conv, user.get("name"), "livreur", preview)
    elif party == "customer" and parts.get("customer"):
        await notify("customer", parts["customer"]["id"], f"Message de la boutique · {code}", preview[:80], f"/compte/messages/{conv['id']}", "message")
    elif party == "rider" and parts.get("rider"):
        await notify("rider", parts["rider"]["id"], f"Message de la boutique · {code}", preview[:80], f"/riders/messages/{conv['id']}", "message", conv["id"])


# ---------- Rider inbox (all conversations involving the rider) ----------
@router.get("/rider/conversations")
async def rider_conversations(q: str = "", user: dict = Depends(get_user)):
    rows = [r for r in await db.conversations.find({"participants.id": user["id"]}).sort("updated_at", -1).to_list(200)
            if not q or q.strip().lower() in str(r.get("order_code") or "").lower()]
    out = []
    for r in rows:
        msgs = r.get("messages") or []
        other = _first_name_only(next((p for p in r.get("participants") or [] if p.get("id") != user["id"]), {}))
        out.append({"id": r["id"], "kind": r.get("kind"), "order_code": r.get("order_code"), "closed": r.get("closed", False),
                    "with": other, "last_message": msgs[-1] if msgs else None, "updated_at": r.get("updated_at"),
                    "archived": user["id"] in (r.get("archived_for") or []),
                    "unread": sum(1 for m in msgs if user["id"] not in (m.get("read_by") or []))})
    return clean(out)


@router.get("/rider/conversations/{cid}")
async def rider_conversation(cid: str, user: dict = Depends(get_user)):
    conv = await db.conversations.find_one({"id": cid, "participants.id": user["id"]})
    if not conv:
        raise HTTPException(404, "Conversation introuvable")
    msgs = conv.get("messages") or []
    if any(user["id"] not in (m.get("read_by") or []) for m in msgs):
        for m in msgs:
            if user["id"] not in (m.get("read_by") or []):
                m.setdefault("read_by", []).append(user["id"])
        await _mark_read(cid, user["id"])
    await mark_ref_read("rider" if user.get("role") == "rider" else "staff", user["id"], cid)
    if user.get("role") == "rider":
        conv["participants"] = [_first_name_only(p) for p in conv.get("participants") or []]
    return clean(conv)


def _first_name_only(p: dict) -> dict:
    if p.get("kind") != "customer":
        return p
    return {"kind": "customer", "id": p.get("id"), "name": (p.get("name") or "Cliente").split(" ")[0]}


@router.post("/rider/conversations/store")
async def rider_open_store(user: dict = Depends(get_user)):
    if user.get("role") != "rider":
        raise HTTPException(403, "Réservé aux livreurs")
    key = _conv_key([f"r:{user['id']}", "store:main"])
    conv = await db.conversations.find_one({"key": key})
    if not conv:
        conv = {"id": new_id(), "key": key, "kind": "boutique_livreur", "closed": False, "archived": False, "pinned": False,
                "participants": [{"kind": "store", "id": "store", "name": "Chez Dina · Gérante"}, {"kind": "rider", "id": user["id"], "name": user.get("name")}],
                "messages": [], "created_at": now_iso(), "updated_at": now_iso()}
        await db.conversations.insert_one(conv)
    return {"id": conv["id"]}


@router.post("/rider/conversations/{cid}/send")
async def rider_conversation_send(cid: str, body: Dict[str, Any], user: dict = Depends(get_user)):
    conv = await db.conversations.find_one({"id": cid, "participants.id": user["id"]})
    if not conv:
        raise HTTPException(404, "Conversation introuvable")
    if conv.get("closed"):
        raise HTTPException(400, "Conversation fermée")
    text = str(body.get("text") or "").strip()[:5000]
    atts = _image_attachments(body.get("attachments"))
    if not text and not atts:
        raise HTTPException(400, "Message vide")
    msg = {"id": new_id(), "at": now_iso(), "from_id": user["id"], "from_name": user.get("name"), "from_kind": "rider",
           "text": text, "attachments": atts, "read_by": [user["id"]], "reactions": {}}
    await db.conversations.update_one({"id": cid}, {"$push": {"messages": msg}, "$set": {"updated_at": now_iso(), "archived": False, "archived_for": []}})
    key = conv.get("key") or ""
    party = "rider_customer" if conv.get("kind") == "livreur_cliente" else "rider"
    if key.startswith("order:"):
        await _after_order_msg(conv, party, user, text or "📷 Photo")
    else:
        await db.notifications.insert_one({"id": new_id(), "type": "message", "title": f"Message livreur · {user.get('name')}", "msg": (text or "📷 Photo")[:80], "color": "#5867fd", "at": now_iso(), "link": "/console/messagerie"})
        await notify_staff(f"Message livreur · {user.get('name')}", (text or "📷 Photo")[:80], "/console/messagerie")
    return {"ok": True, "message": msg}


@router.get("/orders-messages/unread")
async def orders_unread(user: dict = Depends(get_user)):
    if user.get("role") == "rider":
        rows = await db.conversations.find({"key": {"$regex": r"^order:.*\|rider(_customer)?$"}, "participants.id": user["id"]}, {"messages": 1, "order_code": 1}).to_list(500)
        by: Dict[str, int] = {}
        for c in rows:
            n = sum(1 for m in c.get("messages") or [] if m.get("from_kind") in ("store", "customer") and user["id"] not in (m.get("read_by") or []))
            if n:
                by[c.get("order_code")] = by.get(c.get("order_code"), 0) + n
        return {"count": sum(by.values()), "by_order": by}
    rows = await db.conversations.find({"key": {"$regex": "^order:"}}, {"messages": 1, "order_code": 1}).to_list(3000)
    by: Dict[str, int] = {}
    for c in rows:
        n = sum(1 for m in c.get("messages") or [] if m.get("from_kind") in ("customer", "rider") and user["id"] not in (m.get("read_by") or []))
        if n:
            by[c.get("order_code")] = by.get(c.get("order_code"), 0) + n
    return {"count": sum(by.values()), "by_order": by}


@router.post("/orders/{oid}/threads/read")
async def mark_order_threads_read(oid: str, user: dict = Depends(get_user)):
    o = await db.orders.find_one({"$or": [{"id": oid}, {"code": oid}]}, {"id": 1})
    if not o:
        raise HTTPException(404)
    for party in ("customer", "rider"):
        c = await db.conversations.find_one({"key": f"order:{o['id']}|{party}"})
        if not c:
            continue
        msgs = c.get("messages") or []
        changed = False
        for m in msgs:
            if user["id"] not in (m.get("read_by") or []):
                m.setdefault("read_by", []).append(user["id"]); changed = True
        if changed:
            await _mark_read(c["id"], user["id"])
    return {"ok": True}


# ---------- Broadcast (owner/manager) ----------
@router.post("/messages/broadcast")
async def broadcast(body: Dict[str, Any], user: dict = Depends(require_role("admin", "manager"))):
    """Broadcast to customers (segment or list) or riders. Creates one conversation per target."""
    target = body.get("target", "all")  # all | segment:ID | ids
    text = body.get("text", "")
    image = body.get("image")
    valid_until = body.get("valid_until")
    ids: List[str] = []
    if target == "all":
        async for c in db.customers.find({"status": "active"}, {"id": 1}):
            ids.append(c["id"])
    elif isinstance(target, list):
        ids = target
    elif isinstance(target, str) and target.startswith("segment:"):
        seg = await db.customer_segments.find_one({"id": target.split(":", 1)[1]})
        ids = (seg or {}).get("customer_ids") or []
    count = 0
    for cid in ids:
        await send_message_core({"customer_id": cid, "text": text, "image": image, "attachments": body.get("attachments") or [], "kind": "boutique_cliente"}, user)
        count += 1
    return {"ok": True, "count": count, "valid_until": valid_until}
