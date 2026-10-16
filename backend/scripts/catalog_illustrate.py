"""One-off: store catalogue photos locally, give every product 3+ images and half of them colour x size variants."""
import asyncio, io, os, random, hashlib
import requests
from PIL import Image
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
OUT = "/app/frontend/public/catalog"
POOL = {
    "Talons": ["https://images.unsplash.com/photo-1573100925118-870b8efc799d", "https://images.unsplash.com/photo-1611233299310-f6276ff55307",
               "https://images.unsplash.com/photo-1562687848-c1664eff566d", "https://images.unsplash.com/photo-1543163521-1bf539c55dd2",
               "https://images.pexels.com/photos/12112063/pexels-photo-12112063.jpeg", "https://images.pexels.com/photos/27352802/pexels-photo-27352802.png"],
    "Sandales": ["https://images.unsplash.com/photo-1689193504554-358af52b681a", "https://images.unsplash.com/photo-1619510331283-a46c425e48bb",
                 "https://images.unsplash.com/photo-1662132090867-57a37fa1edf8", "https://images.unsplash.com/photo-1638859436319-662beea3bfa8",
                 "https://images.pexels.com/photos/9267585/pexels-photo-9267585.jpeg", "https://images.pexels.com/photos/27046150/pexels-photo-27046150.jpeg"],
    "Sacs à main": ["https://images.unsplash.com/photo-1624687943971-e86af76d57de", "https://images.unsplash.com/photo-1705909237050-7a7625b47fac",
                    "https://images.unsplash.com/photo-1691480150204-66dd1eb77391", "https://images.unsplash.com/photo-1605733513597-a8f8341084e6",
                    "https://images.pexels.com/photos/9327162/pexels-photo-9327162.jpeg", "https://images.pexels.com/photos/27046143/pexels-photo-27046143.jpeg"],
    "Pochettes": ["https://images.unsplash.com/photo-1789110854836-a7e790d83736", "https://images.unsplash.com/photo-1789110853982-ac028cd604ae",
                  "https://images.unsplash.com/photo-1598552105309-9243044d2002", "https://images.unsplash.com/photo-1786482376175-ff0feb2d8ae1",
                  "https://images.pexels.com/photos/18586865/pexels-photo-18586865.jpeg", "https://images.pexels.com/photos/38738314/pexels-photo-38738314.jpeg"],
    "Cabas": ["https://images.unsplash.com/photo-1630381260512-e3fe55c11973", "https://images.unsplash.com/photo-1572196284554-4e321b0e7e0b",
              "https://images.unsplash.com/photo-1630381259916-72321f3bafe0", "https://images.unsplash.com/photo-1721111260419-03565e518110",
              "https://images.pexels.com/photos/7735446/pexels-photo-7735446.jpeg", "https://images.pexels.com/photos/36365228/pexels-photo-36365228.jpeg"],
}
EXTRA_COLORS = ["Noir", "Rouge", "Nude", "Camel", "Bordeaux", "Blanc", "Doré", "Argent", "Bleu"]


def save(url: str) -> str:
    name = hashlib.md5(url.split("?")[0].encode()).hexdigest()[:16] + ".jpg"
    path = os.path.join(OUT, name)
    if not os.path.exists(path):
        src = url if "?" in url else (url + ("?w=1000&q=80&auto=format" if "unsplash" in url else "?auto=compress&w=1000"))
        r = requests.get(src, timeout=40)
        r.raise_for_status()
        im = Image.open(io.BytesIO(r.content)).convert("RGB")
        im.thumbnail((1000, 1000))
        im.save(path, "JPEG", quality=82)
    return f"/catalog/{name}"


async def main():
    os.makedirs(OUT, exist_ok=True)
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    local = {cat: [save(u) for u in urls] for cat, urls in POOL.items()}
    products = await db.products.find({}).sort("created_at", 1).to_list(1000)
    rnd = random.Random(42)
    for i, p in enumerate(products):
        pool = local.get(p.get("category")) or local["Sacs à main"]
        first = p.get("image") or ""
        imgs = [save(first) if first.startswith("http") else first] if first else []
        for u in rnd.sample(pool, len(pool)):
            if len(imgs) >= 3:
                break
            if u not in imgs:
                imgs.append(u)
        patch = {"image": imgs[0], "images": imgs}
        if i % 2 == 0:
            base = (p.get("colors") or ["Noir"])[0]
            if base in ("Multi", "Unique"):
                base = "Noir"
            colors = [base] + rnd.sample([c for c in EXTRA_COLORS if c != base], 2)
            sizes = [s for s in (p.get("sizes") or []) if s != "Unique"] or ["Unique"]
            total = max(int(p.get("stock") or 0), len(colors) * len(sizes) * 2)
            variants, left = [], total
            combos = [(s, c) for c in colors for s in sizes]
            for k, (s, c) in enumerate(combos):
                q = left if k == len(combos) - 1 else max(1, total // len(combos) + rnd.randint(-1, 2))
                q = max(0, min(q, left))
                left -= q
                variants.append({"size": s, "color": c, "stock": q, "enabled": True})
            patch.update({"colors": colors, "sizes": sizes, "variants": variants, "stock": sum(v["stock"] for v in variants),
                          "stock_by_size": {s: sum(v["stock"] for v in variants if v["size"] == s) for s in sizes}})
        await db.products.update_one({"id": p["id"]}, {"$set": patch})
    print("products", len(products), "with variants", sum(1 for i in range(len(products)) if i % 2 == 0))


asyncio.run(main())
