import re
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException

from deps import db, get_user, new_id, now_iso

router = APIRouter(prefix="/api", tags=["preparation"])

PREP_ROLES = ("admin", "manager", "stock_keeper", "sales")


def _n(x) -> str:
    return re.sub(r"\s+", "", str(x or "")).upper()


def _size_tag(product: Dict[str, Any], size) -> str:
    if not size:
        return ""
    return f"P{size}" if (product.get("category") or "").lower().startswith("chauss") else f"T{size}"


def expected(product: Dict[str, Any], item: Dict[str, Any]) -> Dict[str, Any]:
    """Expected label code for an order line + every accepted spelling."""
    sku = _n(product.get("sku") or item.get("sku"))
    size, color = item.get("size"), item.get("color")
    v = next((x for x in product.get("variants") or [] if x.get("size") == size and x.get("color") == color), {})
    parts = [p for p in (sku, _n(size), _n(color)) if p]
    display = _n(v.get("barcode") or v.get("sku")) or "-".join(parts) or _n(product.get("barcode")) or _n(product.get("id"))
    ok = {display, "-".join(parts), "|".join(parts), _n(v.get("sku")), _n(v.get("barcode"))}
    if not (size or color) or len({(x.get("size"), x.get("color")) for x in product.get("variants") or []}) <= 1:
        ok |= {sku, _n(product.get("barcode")), _n(product.get("ean"))}
    ok.discard("")
    label = " · ".join(x for x in (item.get("name") or product.get("name"), color, _size_tag(product, size)) if x)
    return {"code": display, "accepted": ok, "label": label}


async def _lines(o: Dict[str, Any]) -> List[Dict[str, Any]]:
    pids = [it.get("product_id") for it in o.get("items") or []]
    prods = {p["id"]: p for p in await db.products.find({"id": {"$in": pids}}).to_list(200)}
    checks = o.get("prep_checks") or []
    out = []
    for i, it in enumerate(o.get("items") or []):
        e = expected(prods.get(it.get("product_id"), {}), it)
        done = sum(1 for c in checks if c.get("line_index") == i and c.get("ok"))
        out.append({"line_index": i, "item": it, "expected_code": e["code"], "label": e["label"], "accepted": e["accepted"],
                    "qty": int(it.get("qty") or 1), "done": done})
    return out


def _public(lines):
    return [{k: v for k, v in ln.items() if k != "accepted"} for ln in lines]


async def prep_complete(o: Dict[str, Any]) -> List[str]:
    """Lines still missing a verified code (used by the 'prete' transition)."""
    return [f"{ln['label']} : {min(ln['done'], ln['qty'])}/{ln['qty']}" for ln in await _lines(o) if ln["done"] < ln["qty"]]


@router.get("/orders/{oid}/prep")
async def get_prep(oid: str, user: dict = Depends(get_user)):
    o = await db.orders.find_one({"id": oid})
    if not o:
        raise HTTPException(404, "Commande introuvable")
    return {"lines": _public(await _lines(o)), "log": (o.get("prep_checks") or [])[-100:]}


@router.post("/orders/{oid}/prep/verify")
async def verify_item(oid: str, body: Dict[str, Any], user: dict = Depends(get_user)):
    if user.get("role") not in PREP_ROLES:
        raise HTTPException(403, "Accès refusé")
    o = await db.orders.find_one({"id": oid})
    if not o:
        raise HTTPException(404, "Commande introuvable")
    if o.get("status") not in ("confirmee", "en_preparation"):
        raise HTTPException(400, "Commande hors préparation")
    code = _n(body.get("code"))
    method = "scan" if body.get("method") == "scan" else "saisie"
    if not code:
        raise HTTPException(400, "Code requis")
    lines = await _lines(o)
    idx = body.get("line_index")
    pool = [ln for ln in lines if ln["line_index"] == idx] if isinstance(idx, int) else lines
    if not pool:
        raise HTTPException(400, "Ligne introuvable")
    hit = next((ln for ln in pool if code in ln["accepted"] and ln["done"] < ln["qty"]), None)
    full = next((ln for ln in pool if code in ln["accepted"]), None)
    if hit:
        ok, msg, line = True, f"✓ {hit['label']} · {hit['done'] + 1}/{hit['qty']}", hit
    elif full:
        ok, msg, line = False, f"Déjà vérifié : {full['label']} ({full['qty']}/{full['qty']}) · article en trop", full
    else:
        line = next((ln for ln in pool if ln["done"] < ln["qty"]), pool[0])
        ok, msg = False, f"Mauvais article : attendu {line['label']}"
    entry = {"id": new_id(), "line_index": line["line_index"], "code": code, "method": method, "ok": ok, "message": msg,
             "expected": line["expected_code"], "by": user.get("name"), "by_id": user.get("id"), "at": now_iso()}
    upd: Dict[str, Any] = {"$push": {"prep_checks": entry}}
    if ok and o.get("status") == "confirmee":
        upd["$set"] = {"status": "en_preparation", "updated_at": now_iso()}
    await db.orders.update_one({"id": oid}, upd)
    await db.audit_log.insert_one({"id": new_id(), "user_id": user.get("id"), "user_name": user.get("name"),
                                   "action": f"order.prep.{'ok' if ok else 'refus'}", "entity_id": oid,
                                   "after": {k: entry[k] for k in ("line_index", "code", "method", "ok", "expected")}, "at": entry["at"]})
    o = await db.orders.find_one({"id": oid})
    return {"ok": ok, "message": msg, "entry": entry, "lines": _public(await _lines(o))}
