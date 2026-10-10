"""Scenario demo pack: covers every business situation (stock, orders, riders, cash, POs, CRM)."""
import random
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List

from deps import db, new_id, now_iso, gen_code

TAG = "DEMO_SCN"
COLLS = ["products", "customers", "orders", "delivery_sessions", "cash_sessions", "purchase_orders", "reviews",
         "abandoned_carts", "waitlist", "stock_alerts", "approval_requests", "expense_requests",
         "stock_adjustment_requests", "campaigns", "conversations", "stock_movements", "notifications", "expenses"]


def _ago(**kw) -> str:
    return (datetime.now(timezone.utc) - timedelta(**kw)).isoformat()


async def seed_scenarios(user: Dict[str, Any]) -> Dict[str, Any]:
    if await db.orders.count_documents({"demo_tag": TAG}):
        return {"skipped": True, "reason": "Pack scénarios déjà présent · effacez-le d'abord"}
    rnd = random.Random()
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    stats: Dict[str, int] = {}

    async def put(coll: str, doc: Dict[str, Any]) -> Dict[str, Any]:
        doc["demo_tag"] = TAG
        await db[coll].insert_one(doc)
        stats[coll] = stats.get(coll, 0) + 1
        return doc

    base = await db.products.find({"status": "actif", "demo_tag": {"$ne": TAG}}).to_list(200)
    imgs = [p["image"] for p in base if p.get("image")] or [None]
    cats = sorted({p.get("category") for p in base if p.get("category")}) or ["Talons"]

    # ---------- Products: rupture, stock bas, liste d'attente, promo ----------
    specs = [
        ("Mules Raphia Naturel", {"37": 0, "38": 0, "39": 0}, "actif", 0, 24500),
        ("Sandales Perles Dorées", {"38": 1, "39": 2, "40": 0}, "actif", 0, 19500),
        ("Sac Cabas Wax", {}, "liste_attente", 0, 35000),
        ("Escarpins Vernis Nude", {"37": 6, "38": 8, "39": 5}, "actif", 20, 32000),
    ]
    demo_products = []
    for i, (name, sbs, status, promo, price) in enumerate(specs):
        p = await put("products", {
            "id": new_id(), "name": name, "category": cats[i % len(cats)], "brand": "Dina Soles",
            "price": int(price * (100 - promo) / 100), "price_old": price if promo else 0, "cost": int(price * 0.5),
            "image": imgs[i % len(imgs)], "images": [imgs[i % len(imgs)]], "sizes": list(sbs.keys()), "colors": ["Noir"],
            "stock_by_size": sbs, "stock": sum(sbs.values()), "sku": f"DEMO-{100 + i}", "visibility": "both",
            "status": status, "featured": i == 3, "is_new": i == 3, "promo_pct": promo, "store_id": "store-cocody",
            "rating_avg": 4.5, "rating_count": 12, "created_at": now_iso()})
        demo_products.append(p)
    rupture, low, wait, promo_p = demo_products
    for p, delta, reason in [(low, 10, "Réception BC-DEMO-1"), (low, -7, "Vente comptoir"), (rupture, 6, "Réception BC-DEMO-0"),
                             (rupture, -6, "Commande en ligne"), (promo_p, 19, "Réception BC-DEMO-2"), (low, -1, "Casse / défaut")]:
        await put("stock_movements", {"id": new_id(), "product_id": p["id"], "size": (p.get("sizes") or [None])[0], "qty": delta,
                                      "reason": reason, "by": "Démo", "at": _ago(days=rnd.randint(1, 20))})

    # ---------- Customers with storefront access ----------
    people = [("Mariam Kouadio", "+225 07 48 11 22 01", "202601", "Cocody", "Or"),
              ("Grâce Yao", "+225 05 48 11 22 02", "202602", "Marcory", "Argent"),
              ("Nadège Bamba", "+225 01 48 11 22 03", "202603", "Yopougon", "Bronze"),
              ("Inès Koffi", "+225 07 48 11 22 04", "202604", "Riviera", "Diamant")]
    custs = []
    for name, phone, code, zone, tier in people:
        custs.append(await put("customers", {
            "id": new_id(), "name": name, "phone": phone, "access_code": code, "email": f"{name.split()[0].lower()}.demo@mail.ci",
            "address": f"{zone} · près de la pharmacie", "zone": zone, "shoe_size": "38", "clothing_size": "M",
            "loyalty_points": rnd.randint(100, 1500), "wallet": 0, "tier": tier, "status": "active",
            "referral_code": f"DINA-D{code[-2:]}", "created_at": _ago(days=90), "last_order_at": now_iso()}))

    # ---------- Riders & slots ----------
    riders = await db.users.find({"role": "rider", "active": {"$ne": False}}).to_list(10)
    for r in riders:
        if not r.get("delivery_slots"):
            await db.users.update_one({"id": r["id"]}, {"$set": {"demo_slots_seeded": True, "delivery_slots": [
                {"id": new_id(), "label": "Matin", "start": "09:00", "end": "12:00", "capacity": 4},
                {"id": new_id(), "label": "Après-midi", "start": "14:00", "end": "18:00", "capacity": 4}]}})
    riders = await db.users.find({"role": "rider", "active": {"$ne": False}}).to_list(10)

    def items_for(n=2, prods=None):
        picks = rnd.sample(prods or base, min(n, len(prods or base)))
        return [{"product_id": p["id"], "name": p["name"], "size": (p.get("sizes") or [""])[0], "color": (p.get("colors") or [""])[0],
                 "qty": 1, "price": p.get("price", 15000), "image": p.get("image")} for p in picks]

    async def order(status, mode="delivery", pay="cod", cust=None, rider=None, sid=None, slot=None, created=None, extra=None):
        cust = cust or rnd.choice(custs)
        its = items_for(rnd.randint(1, 2))
        fee = 1500 if mode == "delivery" else 0
        sub = sum(i["qty"] * i["price"] for i in its)
        created = created or _ago(hours=rnd.randint(1, 6))
        paid = pay != "cod" or status == "livree"
        doc = {"id": new_id(), "code": gen_code(), "items": its,
               "customer": {"id": cust["id"], "name": cust["name"], "phone": cust["phone"], "address": cust["address"]},
               "channel": "store" if mode == "store" else rnd.choice(["online", "whatsapp", "instagram"]),
               "payment_method": pay, "payment_status": "paye" if paid else "en_attente", "mode": mode, "store_id": "store-cocody",
               "delivery_zone": cust["zone"] if mode == "delivery" else None, "delivery_fee": fee, "discount": 0,
               "subtotal": sub, "total": sub + fee, "status": status, "created_at": created, "updated_at": now_iso(),
               "created_by": "Démo", "delivery_code": "4821", "timeline": [{"status": status, "at": created, "by": "Démo"}]}
        if rider:
            doc.update({"rider_id": rider["id"], "rider_name": rider["name"], "session_id": sid, "assigned_at": now_iso()})
        if slot:
            doc["delivery_slot"] = {k: slot[k] for k in ("id", "label", "start", "end")}
        if extra:
            doc.update(extra)
        return await put("orders", doc)

    # Pipeline (unassigned)
    await order("nouvelle", pay="wave", extra={"payment_status": "en_attente"})
    await order("nouvelle")
    await order("confirmee"); await order("confirmee", pay="wave")
    await order("en_preparation"); await order("en_preparation", pay="orange")
    await order("prete"); await order("prete", pay="wave")
    await order("prete", mode="pickup", pay="wave")
    await order("confirmee", extra={"rescheduled_for": (now + timedelta(days=2)).date().isoformat(),
                                    "delivery_date": (now + timedelta(days=2)).date().isoformat()})
    # POS sales of the day
    for _ in range(3):
        await order("livree", mode="store", pay=rnd.choice(["cash", "wave"]))
    # History (KPIs)
    for d in range(10):
        await order("livree", pay=rnd.choice(["cod", "wave", "cash"]), created=_ago(days=d + 1, hours=3))
    await order("annulee", created=_ago(days=3)); await order("retournee", created=_ago(days=6))

    # Rider days (today) with every delivery situation
    thread_targets = []
    for idx, r in enumerate(riders[:3]):
        slots = r.get("delivery_slots") or [None, None]
        sid = new_id()
        os_ = [await order("assignee", rider=r, sid=sid, slot=slots[0]),
               await order("assignee", pay="wave", rider=r, sid=sid, slot=slots[-1]),
               await order("en_livraison", rider=r, sid=sid, slot=slots[0]),
               await order("livree", rider=r, sid=sid, slot=slots[0], extra={"proof": {"method": "code", "amount_collected": None}}),
               await order("livree", rider=r, sid=sid, slot=slots[-1]),
               await order("echouee", rider=r, sid=sid)]
        post = await order("confirmee", extra={"rescheduled_for": (now + timedelta(days=2)).date().isoformat()})
        rec = {os_[3]["id"]: {"collected": True, "amount": os_[3]["total"], "approved_by": user.get("name"), "at": now_iso(), "ecart": 0}}
        await put("delivery_sessions", {"id": sid, "rider_id": r["id"], "rider_name": r["name"], "date": today, "closed": False,
                                        "created_at": now_iso(), "orders": [o["id"] for o in os_] + [post["id"]], "reconciliations": rec,
                                        "postponed": {post["id"]: {"to": post["rescheduled_for"], "at": now_iso(), "by": "Démo", "reason": "Cliente absente"}}})
        thread_targets.append((os_[2], r))
    if riders:
        r = riders[0]; sid = new_id()
        past = [await order("livree", rider=r, sid=sid, created=_ago(days=1, hours=5)) for _ in range(3)]
        await put("delivery_sessions", {"id": sid, "rider_id": r["id"], "rider_name": r["name"], "date": (now - timedelta(days=1)).date().isoformat(),
                                        "closed": True, "closed_at": _ago(hours=14), "created_at": _ago(days=1), "orders": [o["id"] for o in past],
                                        "reconciliations": {o["id"]: {"collected": True, "amount": o["total"], "approved_by": user.get("name"), "at": _ago(hours=15)} for o in past}})

    # ---------- Order threads (unread replies → badge) ----------
    for o, r in thread_targets[:2]:
        c = o["customer"]
        await put("conversations", {"id": new_id(), "key": f"order:{o['id']}|customer", "kind": "commande_cliente", "order_id": o["id"],
            "order_code": o["code"], "closed": False, "archived": False, "pinned": False,
            "participants": [{"kind": "store", "id": "store", "name": f"Chez Dina · {o['code']}"}, {"kind": "customer", "id": c["id"], "name": c["name"]}],
            "messages": [{"id": new_id(), "at": _ago(minutes=50), "from_id": user["id"], "from_name": user.get("name"), "from_kind": "store",
                          "text": f"Bonjour {c['name'].split()[0]}, votre commande {o['code']} est en route.", "read_by": [user["id"]]},
                         {"id": new_id(), "at": _ago(minutes=20), "from_id": c["id"], "from_name": c["name"], "from_kind": "customer",
                          "text": "Merci ! Je serai là à partir de 11h, appelez-moi en arrivant.", "read_by": [c["id"]]}],
            "created_at": _ago(hours=1), "updated_at": _ago(minutes=20)})
        await put("conversations", {"id": new_id(), "key": f"order:{o['id']}|rider", "kind": "commande_livreur", "order_id": o["id"],
            "order_code": o["code"], "closed": False, "archived": False, "pinned": False,
            "participants": [{"kind": "store", "id": "store", "name": f"Chez Dina · {o['code']}"}, {"kind": "rider", "id": r["id"], "name": r["name"]}],
            "messages": [{"id": new_id(), "at": _ago(minutes=10), "from_id": r["id"], "from_name": r["name"], "from_kind": "rider",
                          "text": "Je suis devant la résidence, la cliente ne répond pas.", "read_by": [r["id"]]}],
            "created_at": _ago(minutes=10), "updated_at": _ago(minutes=10)})

    # ---------- Cash sessions ----------
    mgr = await db.users.find_one({"role": "manager"}) or user
    await put("cash_sessions", {"id": new_id(), "opened_at": _ago(days=2, hours=10), "opened_by": mgr.get("name"), "manager_id": mgr.get("id"),
        "session_date": (now - timedelta(days=2)).date().isoformat(), "opening_cash": 50000.0, "closed": True, "closed_at": _ago(days=2),
        "closed_by": mgr.get("name"), "closing_cash": 183000.0, "expected": 185000.0, "ecart": -2000.0, "cash_sales": 135000,
        "ins": 0, "outs": 0, "status": "validated", "validated_by": user.get("name"), "validated_at": _ago(days=2), "validation_gap": 0, "note": ""})
    await put("cash_sessions", {"id": new_id(), "opened_at": _ago(days=1, hours=10), "opened_by": mgr.get("name"), "opened_by_id": mgr.get("id"),
        "manager_id": mgr.get("id"), "session_date": (now - timedelta(days=1)).date().isoformat(), "opening_cash": 50000.0, "closed": True,
        "closed_at": _ago(days=1), "closed_by": mgr.get("name"), "closing_cash": 212000.0, "expected": 212000.0, "ecart": 0.0, "cash_sales": 162000,
        "ins": 0, "outs": 0, "handover_amount": 162000, "handover_at": _ago(days=1), "handover_by": mgr.get("name"),
        "handover_note": "Versement de la journée", "status": "pending_validation", "note": ""})

    # ---------- Purchase orders ----------
    supp = await db.suppliers.find_one({}) or {"id": None, "name": "Fournisseur démo"}
    def line(p, size, qty):
        return {"product_id": p["id"], "product_name": p["name"], "size": size, "qty": qty, "unit_cost": p["cost"], "sell_price": p["price"]}
    po_specs = [("commande", [line(rupture, s, 5) for s in rupture["sizes"]], None),
                ("recu_partiel", [{**line(low, "40", 6), "qty_counted": 4, "qty_ordered": 6}], {"received_by": mgr.get("name"), "at": _ago(hours=5),
                  "gaps": [{"product_name": low["name"], "size": "40", "ordered": 6, "counted": 4, "gap": -2}], "validated": False, "photos": []}),
                ("recu", [{**line(promo_p, "38", 8), "qty_counted": 8, "qty_ordered": 8}], {"received_by": mgr.get("name"), "at": _ago(days=4),
                  "gaps": [], "validated": True, "photos": []})]
    for i, (st, its, rec) in enumerate(po_specs):
        total = sum(x["qty"] * x["unit_cost"] for x in its)
        doc = {"id": new_id(), "number": f"BC-DEMO-{i}", "supplier_id": supp.get("id"), "supplier_name": supp.get("name"), "items": its,
               "total": total, "balance_due": total if st != "recu" else 0, "status": st, "expected_at": (now + timedelta(days=3)).date().isoformat(),
               "created_at": _ago(days=6 - i)}
        if rec:
            doc["reception"] = rec; doc["received_at"] = rec["at"]
        await put("purchase_orders", doc)

    # ---------- CRM: reviews, carts, waitlist, alerts ----------
    for i, (rating, comment, st) in enumerate([(5, "Magnifiques, très confortables !", "pending"), (2, "Taille un peu petite, déçue.", "pending"),
                                               (4, "Belle qualité, livraison rapide.", "pending"), (5, "Je recommande Chez Dina !", "approved"),
                                               (4, "Conforme à la photo.", "approved"), (1, "Colis abîmé à la livraison.", "rejected")]):
        p = rnd.choice(base + [promo_p]); c = custs[i % len(custs)]
        await put("reviews", {"id": new_id(), "product_id": p["id"], "customer_name": c["name"], "customer_phone": c["phone"],
                              "rating": rating, "comment": comment, "status": st, "created_at": _ago(days=i)})
    for i, c in enumerate(custs[:3]):
        its = items_for(2)
        await put("abandoned_carts", {"id": new_id(), "customer_name": c["name"], "customer_phone": c["phone"], "phone": c["phone"],
                                      "customer": {"id": c["id"], "name": c["name"], "phone": c["phone"]}, "items": its,
                                      "value": sum(x["price"] for x in its), "total": sum(x["price"] for x in its),
                                      "recovered": i == 2, "status": ["nouveau", "relance", "recupere"][i], "created_at": _ago(hours=5 + i * 10)})
    for c in custs[:3]:
        await put("waitlist", {"id": new_id(), "product_id": wait["id"], "size": "", "phone": c["phone"], "name": c["name"],
                               "notified_at": None, "created_at": _ago(days=2)})
    for c, s in zip(custs[:2], ["38", "39"]):
        await put("stock_alerts", {"id": new_id(), "product_id": rupture["id"], "size": s, "phone": c["phone"], "name": c["name"],
                                   "notified": False, "created_at": _ago(days=1)})

    # ---------- Approvals & expenses ----------
    await put("approval_requests", {"id": new_id(), "kind": "discount", "requested_by_id": mgr.get("id"), "requested_by_name": mgr.get("name"),
        "payload": {"pct": 15}, "reason": "Remise fidélité cliente Diamant", "status": "pending", "created_at": _ago(hours=2)})
    await put("approval_requests", {"id": new_id(), "kind": "refund", "requested_by_id": mgr.get("id"), "requested_by_name": mgr.get("name"),
        "payload": {"amount": 24500}, "reason": "Retour article défectueux", "status": "pending", "created_at": _ago(hours=1)})
    await put("expense_requests", {"id": new_id(), "label": "Sacs d'emballage", "amount": 35000, "category": "Fournitures", "note": "",
        "receipt": None, "requested_by_name": mgr.get("name"), "requested_by_id": mgr.get("id"), "status": "pending", "created_at": _ago(hours=3)})
    await put("stock_adjustment_requests", {"id": new_id(), "created_at": _ago(hours=4), "status": "pending", "requested_by": mgr.get("name"),
        "requested_by_id": mgr.get("id"), "product_id": low["id"], "product_name": low["name"], "size": "40", "qty_delta": 3, "reason": "Erreur d'inventaire"})
    for label, amount in [("Électricité · mois en cours", 85000), ("Transport livreurs", 42000), ("Publicité Instagram", 60000)]:
        await put("expenses", {"id": new_id(), "label": label, "amount": amount, "category": label.split(" ")[0], "paid_at": _ago(days=rnd.randint(0, 9)),
                               "note": "", "created_at": now_iso()})

    # ---------- Campaigns ----------
    for name, st, stats_ in [("Nouveautés Harmattan", "draft", {"targets": 120, "sent": 0, "delivered": 0, "read": 0, "clicked": 0, "orders": 0, "revenue": 0}),
                             ("Soldes week-end -20%", "scheduled", {"targets": 300, "sent": 0, "delivered": 0, "read": 0, "clicked": 0, "orders": 0, "revenue": 0}),
                             ("Fête des mères", "sent", {"targets": 280, "sent": 280, "delivered": 271, "read": 198, "clicked": 64, "orders": 17, "revenue": 512000})]:
        await put("campaigns", {"id": new_id(), "name": name, "channels": ["whatsapp", "inapp"], "target_type": "all", "segment_ids": None,
            "customer_ids": None, "text": f"Bonjour {{prenom}}, découvrez « {name} » chez Chez Dina !", "image": None, "link": "/boutique",
            "offer": None, "scheduled_at": (now + timedelta(days=1)).isoformat() if st == "scheduled" else None,
            "created_at": _ago(days=3), "created_by": user.get("name"), "status": st, "stats": stats_})

    await put("notifications", {"id": new_id(), "type": "order", "title": "Données de démo prêtes", "msg": "Toutes les situations sont disponibles pour vos tests",
                                "color": "#1f8a4c", "at": now_iso(), "link": "/console/commandes"})
    return stats


async def purge_scenarios() -> Dict[str, int]:
    out = {}
    for c in COLLS:
        out[c] = (await db[c].delete_many({"demo_tag": TAG})).deleted_count
    await db.users.update_many({"demo_slots_seeded": True}, {"$unset": {"delivery_slots": "", "demo_slots_seeded": ""}})
    return out
