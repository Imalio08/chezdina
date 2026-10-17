"""
Catalog router — products, brands, categories, collections.

Extracted from server.py (P5 Refactor Feb 2026). Covers CRUD + KPIs + public
listings for the whole product catalog surface.
"""
import random
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException

from deps import db, get_user, require_role, clean, new_id, now_iso
from models import ProductIn, CategoryIn, CollectionIn, SimpleNameIn

router = APIRouter(prefix="/api", tags=["catalog"])


# ---------- Products ----------
@router.get("/products")
async def products(user: dict = Depends(get_user), q: Optional[str] = None):
    f: Dict[str, Any] = {}
    if q:
        f["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"sku": {"$regex": q, "$options": "i"}}]
    return clean(await db.products.find(f).to_list(500))


@router.get("/products/{pid}")
async def product_one(pid: str, user: dict = Depends(require_role("admin", "manager", "stock_keeper", "community_manager"))):
    p = await db.products.find_one({"$or": [{"id": pid}, {"slug": pid}]})
    if not p:
        raise HTTPException(404)
    return clean(p)


@router.post("/products")
async def create_product(body: ProductIn, user: dict = Depends(require_role("admin", "manager", "stock_keeper"))):
    doc = body.model_dump()
    doc.update({
        "id": new_id(), "created_at": now_iso(),
        "sku": body.sku or f"DN-{random.randint(10000, 99999)}",
        "store_id": "store-cocody", "rating_avg": 0, "rating_count": 0,
    })
    if body.stock_by_size and not body.stock:
        doc["stock"] = sum(body.stock_by_size.values())
    await db.products.insert_one(doc)
    return clean(doc)


@router.patch("/products/{pid}")
async def update_product(pid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin", "manager", "stock_keeper"))):
    body.pop("id", None)
    body.pop("_id", None)
    if user.get("role") not in ("admin", "manager"):
        for k in ("cost", "cost_price", "purchase_price"):
            body.pop(k, None)
    if "stock_by_size" in body and body["stock_by_size"]:
        body["stock"] = sum(body["stock_by_size"].values())
    await db.products.update_one({"id": pid}, {"$set": body})
    return {"ok": True}


@router.delete("/products/{pid}")
async def delete_product(pid: str, user: dict = Depends(require_role("admin", "manager"))):
    await db.products.delete_one({"id": pid})
    return {"ok": True}


@router.get("/public/products")
async def public_products(q: Optional[str] = None, category: Optional[str] = None):
    f: Dict[str, Any] = {"visibility": {"$ne": "store"}}
    if q:
        f["name"] = {"$regex": q, "$options": "i"}
    if category and category != "all":
        f["category"] = category
    from routers.storefront_extras import promo_fields
    return clean([promo_fields(p) for p in await db.products.find(f).to_list(500)])


# ---------- Brands ----------
@router.get("/brands")
async def list_brands(user: dict = Depends(get_user)):
    distinct = await db.products.distinct("brand")
    stored = {b["name"]: b for b in await db.brands.find({}).to_list(200)}
    out = []
    for name in sorted(set(distinct) | set(stored.keys())):
        cnt = await db.products.count_documents({"brand": name})
        s = stored.get(name, {})
        out.append({"id": s.get("id") or new_id(), "name": name, "product_count": cnt, "note": s.get("note", "")})
    return out


@router.post("/brands")
async def create_brand(body: SimpleNameIn, user: dict = Depends(require_role("admin", "manager"))):
    doc = {"id": new_id(), "name": body.name, "note": body.note or "", "created_at": now_iso()}
    await db.brands.insert_one(doc)
    return clean(doc)


@router.patch("/brands/{bid}")
async def update_brand(bid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin", "manager"))):
    body.pop("_id", None)
    body.pop("id", None)
    body["updated_at"] = now_iso()
    old = await db.brands.find_one({"id": bid})
    if not old and bid.startswith("name:"):
        old = {"id": new_id(), "name": bid[5:], "status": "active", "created_at": now_iso()}
        await db.brands.insert_one(dict(old))
        bid = old["id"]
    if not old:
        raise HTTPException(404, "Marque introuvable")
    if body.get("name") and old.get("name") and old["name"] != body["name"]:
        await db.products.update_many({"brand": old["name"]}, {"$set": {"brand": body["name"]}})
    await db.brands.update_one({"id": bid}, {"$set": body})
    return {"ok": True}


@router.delete("/brands/{bid}")
async def delete_brand(bid: str, user: dict = Depends(require_role("admin", "manager"))):
    await db.brands.delete_one({"id": bid})
    return {"ok": True}


@router.get("/brands/full")
async def list_brands_full(user: dict = Depends(get_user)):
    distinct = await db.products.distinct("brand")
    stored = {b["name"]: b for b in await db.brands.find({}).to_list(500)}
    names = sorted(set(distinct) | set(stored.keys()))
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    orders = await db.orders.find({"created_at": {"$gte": cutoff}, "status": {"$ne": "annulee"}}).to_list(5000)
    ca_by_brand: Dict[str, int] = {}
    for o in orders:
        for it in o.get("items", []):
            b = it.get("brand") or ""
            if not b and it.get("product_id"):
                p = await db.products.find_one({"id": it["product_id"]})
                b = (p or {}).get("brand", "")
            if b:
                ca_by_brand[b] = ca_by_brand.get(b, 0) + int(it.get("qty", 0)) * int(it.get("price", 0))
    out = []
    for name in names:
        s = stored.get(name, {})
        products_rows = await db.products.find({"brand": name}).to_list(500)
        margins = [((p["price"] - p["cost"]) / p["price"] * 100) for p in products_rows if p.get("price", 0) > 0 and p.get("cost", 0) > 0]
        out.append({
            "id": s.get("id") or f"name:{name}",
            "name": name,
            "logo": s.get("logo", ""),
            "note": s.get("note", ""),
            "status": s.get("status", "active"),
            "product_count": len(products_rows),
            "ca_30d": ca_by_brand.get(name, 0),
            "avg_margin": round(sum(margins) / len(margins), 1) if margins else 0,
        })
    return out


@router.get("/brands/{bid}")
async def brand_detail(bid: str, user: dict = Depends(get_user)):
    b = await db.brands.find_one({"id": bid})
    if not b and bid.startswith("name:"):
        b = await db.brands.find_one({"name": bid[5:]}) or {"id": bid, "name": bid[5:], "note": "", "logo": "", "status": "active"}
    if not b:
        b = {"id": bid, "name": bid, "note": "", "logo": "", "status": "active"}
    name = b.get("name")
    products_rows = await db.products.find({"brand": name}).to_list(500)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    orders = await db.orders.find({"created_at": {"$gte": cutoff}, "status": {"$ne": "annulee"}}).to_list(5000)
    ca_30 = 0
    for o in orders:
        for it in o.get("items", []):
            if it.get("brand") == name or any(p for p in products_rows if p["id"] == it.get("product_id")):
                ca_30 += int(it.get("qty", 0)) * int(it.get("price", 0))
    margins = [((p["price"] - p["cost"]) / p["price"] * 100) for p in products_rows if p.get("price", 0) > 0 and p.get("cost", 0) > 0]
    stock_value = sum((p.get("stock", 0) or 0) * (p.get("price", 0) or 0) for p in products_rows)
    return clean({**b, "products": products_rows, "stats": {
        "product_count": len(products_rows),
        "ca_30d": ca_30,
        "avg_margin": round(sum(margins) / len(margins), 1) if margins else 0,
        "stock_value": stock_value,
    }})


# ---------- Categories ----------
@router.get("/categories")
async def list_categories(user: dict = Depends(get_user)):
    distinct = await db.products.distinct("category")
    stored = {c["name"]: c for c in await db.categories.find({}).to_list(200)}
    out = []
    for name in sorted(set(distinct) | set(stored.keys())):
        cnt = await db.products.count_documents({"category": name})
        s = stored.get(name, {})
        out.append({"id": s.get("id") or new_id(), "name": name, "product_count": cnt, "note": s.get("note", "")})
    return out


@router.post("/categories")
async def create_category(body: SimpleNameIn, user: dict = Depends(require_role("admin", "manager"))):
    doc = {"id": new_id(), "name": body.name, "note": body.note or "", "created_at": now_iso()}
    await db.categories.insert_one(doc)
    return clean(doc)


@router.delete("/categories/{cid}")
async def delete_category(cid: str, user: dict = Depends(require_role("admin", "manager"))):
    await db.categories.delete_one({"id": cid})
    return {"ok": True}


@router.get("/categories/tree")
async def categories_tree(user: dict = Depends(get_user)):
    stored = await db.categories.find({}).to_list(500)
    distinct = await db.products.distinct("category")
    stored_names = {c["name"] for c in stored}
    extras = [{"id": new_id(), "name": n, "parent_id": None, "image": "", "order": 999, "visible": True, "note": ""} for n in distinct if n and n not in stored_names]
    all_cats = stored + extras
    for c in all_cats:
        c["product_count"] = await db.products.count_documents({"category": c["name"]})
    by_id = {c["id"]: {**c, "children": []} for c in all_cats}
    roots = []
    for c in all_cats:
        pid = c.get("parent_id")
        if pid and pid in by_id:
            by_id[pid]["children"].append(by_id[c["id"]])
        else:
            roots.append(by_id[c["id"]])
    roots.sort(key=lambda x: (x.get("order", 999), x["name"]))
    for r in roots:
        r["children"].sort(key=lambda x: (x.get("order", 999), x["name"]))
    return clean(roots)


@router.get("/categories/kpis")
async def categories_kpis(user: dict = Depends(get_user)):
    stored = await db.categories.find({}).to_list(500)
    distinct = await db.products.distinct("category")
    names = set([c["name"] for c in stored]) | set([n for n in distinct if n])
    with_parent = sum(1 for c in stored if c.get("parent_id"))
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    orders = await db.orders.find({"created_at": {"$gte": cutoff}, "status": {"$ne": "annulee"}}).to_list(5000)
    sales: Dict[str, int] = {}
    for o in orders:
        for it in o.get("items", []):
            cat = it.get("category") or ""
            if not cat and it.get("product_id"):
                p = await db.products.find_one({"id": it["product_id"]})
                cat = (p or {}).get("category", "")
            if cat:
                sales[cat] = sales.get(cat, 0) + int(it.get("qty", 0)) * int(it.get("price", 0))
    top = max(sales.items(), key=lambda x: x[1])[0] if sales else ""
    return {"total": len(names), "sub": with_parent, "top": top, "top_ca": sales.get(top, 0)}


@router.patch("/categories/{cid}")
async def update_category(cid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin", "manager"))):
    body.pop("_id", None)
    body.pop("id", None)
    body["updated_at"] = now_iso()
    old = await db.categories.find_one({"id": cid})
    if not old:
        body["id"] = cid
        await db.categories.insert_one(body)
    else:
        if body.get("name") and old.get("name") and old["name"] != body["name"]:
            await db.products.update_many({"category": old["name"]}, {"$set": {"category": body["name"]}})
        await db.categories.update_one({"id": cid}, {"$set": body})
    return {"ok": True}


# ---------- Collections ----------
@router.get("/collections")
async def list_collections(user: dict = Depends(get_user)):
    cols = await db.collections.find({}).to_list(200)
    for c in cols:
        if c.get("kind") == "auto":
            rules = c.get("rules") or {}
            flt: Dict[str, Any] = {}
            if rules.get("category"):
                flt["category"] = rules["category"]
            if rules.get("brand"):
                flt["brand"] = rules["brand"]
            if rules.get("price_max"):
                flt["price"] = {"$lte": int(rules["price_max"])}
            c["product_count"] = await db.products.count_documents(flt) if flt else 0
        else:
            c["product_count"] = len(c.get("product_ids") or [])
    return clean(cols)


@router.post("/collections")
async def create_collection(body: CollectionIn, user: dict = Depends(require_role("admin", "manager"))):
    doc = body.model_dump()
    doc.update({"id": new_id(), "created_at": now_iso()})
    await db.collections.insert_one(doc)
    return clean(doc)


@router.patch("/collections/{cid}")
async def update_collection(cid: str, body: Dict[str, Any], user: dict = Depends(require_role("admin", "manager"))):
    body.pop("_id", None)
    body.pop("id", None)
    body["updated_at"] = now_iso()
    await db.collections.update_one({"id": cid}, {"$set": body})
    return {"ok": True}


@router.delete("/collections/{cid}")
async def delete_collection(cid: str, user: dict = Depends(require_role("admin", "manager"))):
    await db.collections.delete_one({"id": cid})
    return {"ok": True}


@router.get("/collections/kpis")
async def collections_kpis(user: dict = Depends(get_user)):
    all_c = await db.collections.find({}).to_list(500)
    actives = sum(1 for c in all_c if c.get("visible", True))
    manual_products = sum(len(c.get("product_ids") or []) for c in all_c)
    return {"total": len(all_c), "actives": actives, "products": manual_products}
