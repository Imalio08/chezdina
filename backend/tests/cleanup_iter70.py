"""Cleanup iter70 TEST_ data: customers, orders, wallet_tx, referrals, opens, points_tx, audit, stock restore."""
import os, asyncio, re
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
NAME = re.compile(r"^TEST_(Marraine70|Filleule70|Cap70|Points70|Race70|UIMarraine|UIFilleule|UIPoints70|UINon|CookieChk)")


async def main():
    cs = await db.customers.find({"name": NAME}, {"id": 1, "referral_code": 1}).to_list(500)
    ids = [c["id"] for c in cs]; codes = [c.get("referral_code") for c in cs]
    orders = await db.orders.find({"$or": [{"customer.id": {"$in": ids}}, {"customer.name": {"$in": ["TEST_guest", "TEST_x"]}}]}).to_list(500)
    for o in orders:
        for it in o.get("items", []):
            inc = {"stock": it["qty"]}
            if it.get("size"):
                inc[f"stock_by_size.{it['size']}"] = it["qty"]
            await db.products.update_one({"id": it["product_id"]}, {"$inc": inc})
    ocodes = [o["code"] for o in orders]; oids = [o["id"] for o in orders]
    r = {
        "orders": (await db.orders.delete_many({"id": {"$in": oids}})).deleted_count,
        "stock_mov": (await db.stock_movements.delete_many({"ref": {"$in": ocodes}})).deleted_count if "stock_movements" in await db.list_collection_names() else 0,
        "invoices": (await db.invoices.delete_many({"order_id": {"$in": oids}})).deleted_count,
        "wallet_tx": (await db.wallet_tx.delete_many({"customer_id": {"$in": ids}})).deleted_count,
        "points_tx": (await db.points_tx.delete_many({"customer_id": {"$in": ids}})).deleted_count,
        "referrals": (await db.referrals.delete_many({"$or": [{"parrain_id": {"$in": ids}}, {"filleul_id": {"$in": ids}}]})).deleted_count,
        "opens": (await db.referral_opens.delete_many({"code": {"$in": codes}})).deleted_count,
        "audit": (await db.audit_log.delete_many({"customer_id": {"$in": ids}})).deleted_count,
        "customers": (await db.customers.delete_many({"id": {"$in": ids}})).deleted_count,
    }
    print(r, "orders restocked:", len(orders))
    p = await db.products.find_one({"id": "2c2005f5-cabe-46e5-9a4b-657f093f24a6"}, {"stock": 1, "stock_by_size": 1})
    print("product stock now", p.get("stock"), p.get("stock_by_size"))

asyncio.run(main())
