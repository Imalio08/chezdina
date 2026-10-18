# Cleanup for iteration 94 e2e: removes TEST_E2E Cliente94 customers + all linked data, restores stock.
import os, asyncio, re
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


async def main():
    cs = await db.customers.find({"name": {"$regex": "^TEST_E2E Cliente94"}}).to_list(50)
    cids = [c["id"] for c in cs]
    orders = await db.orders.find({"customer.id": {"$in": cids}}).to_list(500)
    oids, codes = [o["id"] for o in orders], [o["code"] for o in orders]
    for o in orders:
        if o.get("restocked_at"):
            continue
        for it in o.get("items") or []:
            inc = {"stock": int(it.get("qty") or 1)}
            if it.get("size"):
                inc[f"stock_by_size.{it['size']}"] = int(it.get("qty") or 1)
            await db.products.update_one({"id": it["product_id"]}, {"$inc": inc})
            if it.get("size") or it.get("color"):
                await db.products.update_one({"id": it["product_id"], "variants": {"$elemMatch": {"size": it.get("size"), "color": it.get("color")}}},
                                             {"$inc": {"variants.$.stock": int(it.get("qty") or 1)}})
    sess = await db.delivery_sessions.find({"orders": {"$in": oids}}).to_list(50)
    for s in sess:
        rest = [x for x in s.get("orders", []) if x not in oids]
        if not rest:
            await db.delivery_sessions.delete_one({"id": s["id"]})
        else:
            await db.delivery_sessions.update_one({"id": s["id"]}, {"$set": {"orders": rest}})
    rx = "|".join(map(re.escape, codes)) or "^$"
    res = {
        "orders": (await db.orders.delete_many({"id": {"$in": oids}})).deleted_count,
        "conversations": (await db.conversations.delete_many({"$or": [{"order_id": {"$in": oids}}, {"participants.id": {"$in": cids}}]})).deleted_count,
        "user_notifications": (await db.user_notifications.delete_many({"$or": [{"target_id": {"$in": cids}}, {"ref": {"$in": codes}}, {"title": {"$regex": rx}}, {"msg": {"$regex": rx}}]})).deleted_count,
        "notifications": (await db.notifications.delete_many({"$or": [{"title": {"$regex": rx}}, {"msg": {"$regex": "TEST_"}}]})).deleted_count,
        "whatsapp_outbox": (await db.whatsapp_outbox.delete_many({"order_id": {"$in": oids}})).deleted_count,
        "rider_sync_ops": (await db.rider_sync_ops.delete_many({"result.code": {"$in": codes}})).deleted_count + (await db.rider_sync_ops.delete_many({"op_id": {"$regex": "^TEST_op_"}})).deleted_count,
        "invoices": (await db.invoices.delete_many({"order_id": {"$in": oids}})).deleted_count,
        "stock_movements": (await db.stock_movements.delete_many({"ref": {"$in": codes}})).deleted_count,
        "wallet": (await db.wallet_moves.delete_many({"customer_id": {"$in": cids}})).deleted_count if "wallet_moves" in await db.list_collection_names() else 0,
        "customers": (await db.customers.delete_many({"id": {"$in": cids}})).deleted_count,
        "sessions": len(sess),
    }
    print(res, "codes:", codes)


asyncio.run(main())
