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

router = APIRouter(prefix="/api", tags=["messagerie"])


def _conv_key(parts: List[str]) -> str:
    return "|".join(sorted(parts))


# -------- Core helper (reusable by server.py / other routers) --------
async def send_message_core(body: Dict[str, Any], user: dict) -> Dict[str, Any]:
    """Create or append to a conversation. Returns {ok, conversation_id, message}."""
    cust_id = body.get("customer_id")
    rider_id = body.get("rider_id")
    order_id = body.get("order_id")
    kind = body.get("kind", "boutique_cliente")
    parts: List[str] = []
    if cust_id:
        parts.append(f"c:{cust_id}")
    if rider_id:
        parts.append(f"r:{rider_id}")
    if not cust_id and not rider_id:
        raise HTTPException(400, "customer_id ou rider_id requis")
    parts.append(f"s:{user['id']}")
    key = _conv_key(parts)
    conv = await db.conversations.find_one({"key": key})
    # Validate attachments to prevent javascript: URL injection
    allowed_types = {"image", "video", "audio", "file"}
    safe_attachments: List[Dict[str, Any]] = []
    for a in (body.get("attachments") or [])[:10]:
        if not isinstance(a, dict):
            continue
        t = a.get("type")
        u = str(a.get("url") or "")
        if t not in allowed_types:
            continue
        if not (
            u.startswith("http://") or u.startswith("https://")
            or u.startswith("data:image/") or u.startswith("data:video/")
            or u.startswith("data:audio/") or u.startswith("data:application/pdf")
        ):
            continue
        safe_attachments.append({
            "type": t, "url": u,
            "name": str(a.get("name") or "fichier")[:200],
            "size": int(a.get("size") or 0),
            "mime": str(a.get("mime") or "")[:80],
        })
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
            {"$push": {"messages": msg}, "$set": {"updated_at": now_iso(), "archived": False}},
        )
    return {"ok": True, "conversation_id": conv["id"], "message": msg}


async def close_rider_customer_convs(order_id: str) -> None:
    """Auto-close customer↔rider convos when order becomes 'livree'."""
    await db.conversations.update_many(
        {"order_id": order_id, "kind": "cliente_livreur"},
        {"$set": {"closed": True, "closed_at": now_iso()}},
    )


# ---------- Customer thread helpers ----------
@router.get("/public/account/threads")
async def account_threads(c: dict = Depends(get_customer)):
    rows = await db.conversations.find({"participants.id": c["id"]}).sort("updated_at", -1).to_list(100)
    out = []
    for r in rows:
        parts = r.get("participants") or []
        other = next((p for p in parts if p.get("id") != c["id"]), {})
        last = (r.get("messages") or [{}])[-1] if r.get("messages") else None
        unread = sum(1 for m in (r.get("messages") or []) if c["id"] not in (m.get("read_by") or []))
        out.append({
            "id": r.get("id"), "kind": r.get("kind"), "order_id": r.get("order_id"),
            "with": other, "last_message": last, "unread": unread,
            "updated_at": r.get("updated_at"),
        })
    return clean(out)


@router.post("/public/account/thread/rider/{order_code}")
async def account_open_rider_thread(order_code: str, c: dict = Depends(get_customer)):
    o = await db.orders.find_one({"code": order_code, "customer.id": c["id"]})
    if not o:
        raise HTTPException(404, "Commande introuvable")
    rid = o.get("rider_id")
    if not rid:
        raise HTTPException(400, "Pas de livreur assigné")
    key = f"c:{c['id']}|r:{rid}"
    existing = await db.conversations.find_one({"key": key})
    if existing:
        return {"id": existing["id"]}
    r = await db.users.find_one({"id": rid}, {"password_hash": 0, "pin_hash": 0})
    conv = {
        "id": new_id(), "key": key, "kind": "cliente_livreur", "order_id": o["id"], "closed": False,
        "participants": [
            {"kind": "customer", "id": c["id"], "name": c.get("name")},
            {"kind": "rider",    "id": rid,     "name": r.get("name") if r else "Livreur"},
        ],
        "messages": [], "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.conversations.insert_one(conv)
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
        await db.conversations.update_one({"id": conv_id}, {"$set": {"messages": msgs}})
    return clean(c)


@router.post("/messages/send")
async def send_message(body: Dict[str, Any], user: dict = Depends(get_user)):
    """Create or append to a conversation. Body: {customer_id?, rider_id?, order_id?, text, image?, attachments?, kind?}"""
    return await send_message_core(body, user)


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
    msg = {
        "id": new_id(), "at": now_iso(),
        "from_id": c["id"], "from_name": c.get("name"), "from_kind": "customer",
        "text": body.get("text", ""), "image": body.get("image"),
        "read_by": [c["id"]],
    }
    await db.conversations.update_one({"id": conv_id}, {"$push": {"messages": msg}, "$set": {"updated_at": now_iso()}})
    if conv.get("order_code"):
        await _notify_reply(conv, c.get("name"), "cliente", msg["text"])
    return {"ok": True, "message": msg}


# ---------- Order-scoped threads (shared by the whole team) ----------
async def _notify_reply(conv: Dict[str, Any], who: str, role: str, text: str) -> None:
    await db.notifications.insert_one({
        "id": new_id(), "type": "order_message", "title": f"Message {role} · {conv.get('order_code')}",
        "msg": f"{who} : {(text or '')[:70]}", "color": "#5867fd", "at": now_iso(),
        "link": f"/console/commandes/{conv.get('order_code')}?focus=order-messages",
    })


async def _order_thread(o: Dict[str, Any], party: str) -> Dict[str, Any]:
    if party not in ("customer", "rider"):
        raise HTTPException(400, "Fil inconnu")
    key = f"order:{o['id']}|{party}"
    conv = await db.conversations.find_one({"key": key})
    if party == "customer":
        cust = o.get("customer") or {}
        if not cust.get("id"):
            raise HTTPException(400, "Cette cliente n'a pas de compte · utilisez WhatsApp")
        other = {"kind": "customer", "id": cust["id"], "name": cust.get("name")}
    else:
        if not o.get("rider_id"):
            raise HTTPException(400, "Aucun livreur assigné")
        other = {"kind": "rider", "id": o["rider_id"], "name": o.get("rider_name")}
    participants = [{"kind": "store", "id": "store", "name": f"Chez Dina · {o.get('code')}"}, other]
    if conv:
        if conv.get("participants") != participants:
            await db.conversations.update_one({"id": conv["id"]}, {"$set": {"participants": participants}})
            conv["participants"] = participants
        return conv
    conv = {
        "id": new_id(), "key": key, "kind": f"commande_{'cliente' if party == 'customer' else 'livreur'}",
        "order_id": o["id"], "order_code": o.get("code"), "closed": False, "archived": False, "pinned": False,
        "participants": participants, "messages": [], "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.conversations.insert_one(conv)
    return conv


async def _order_for(oid: str, party: str, user: dict) -> Dict[str, Any]:
    o = await db.orders.find_one({"$or": [{"id": oid}, {"code": oid}]})
    if not o:
        raise HTTPException(404, "Commande introuvable")
    if user.get("role") == "rider" and (party != "rider" or o.get("rider_id") != user["id"]):
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
        await db.conversations.update_one({"id": conv["id"]}, {"$set": {"messages": msgs}})
    return clean(conv)


@router.post("/orders/{oid}/thread/{party}/send")
async def send_order_thread(oid: str, party: str, body: Dict[str, Any], user: dict = Depends(get_user)):
    text = str(body.get("text") or "").strip()[:5000]
    if not text:
        raise HTTPException(400, "Message vide")
    conv = await _order_thread(await _order_for(oid, party, user), party)
    if conv.get("closed"):
        raise HTTPException(400, "Conversation fermée")
    is_rider = user.get("role") == "rider"
    msg = {"id": new_id(), "at": now_iso(), "from_id": user["id"], "from_name": user.get("name"),
           "from_kind": "rider" if is_rider else "store", "text": text, "read_by": [user["id"]], "reactions": {}}
    await db.conversations.update_one({"id": conv["id"]}, {"$push": {"messages": msg}, "$set": {"updated_at": now_iso(), "archived": False}})
    if is_rider:
        await _notify_reply(conv, user.get("name"), "livreur", text)
    return {"ok": True, "conversation_id": conv["id"], "message": msg}


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
        await send_message_core({"customer_id": cid, "text": text, "image": image, "kind": "boutique_cliente"}, user)
        count += 1
    return {"ok": True, "count": count, "valid_until": valid_until}
