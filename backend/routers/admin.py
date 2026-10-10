"""
Admin router — merchant-facing admin utilities.

Hosts the women's fashion catalog reseed. Launch set:
  • 20 chaussures (essentiellement talons / sandales à talons)
  • 10 sacs (sacs à main, pochettes, clutches)

Every image URL used below is a Pexels or Unsplash photo whose content was
VISUALLY confirmed by Gemini Flash Lite to show either a women's heeled shoe
or a women's handbag/clutch (Feb 2026). Images may repeat across a few
products (color variants) — correct subject matter is prioritized over
image uniqueness.
"""
import random
from fastapi import APIRouter, Depends

from deps import db, require_role, new_id, now_iso

router = APIRouter(prefix="/api", tags=["admin"])


# ----------------- VERIFIED image pools -----------------
# Each URL has been content-verified as women's heels (or heeled sandals).
VERIFIED_SHOE_IMAGES = [
    "https://images.unsplash.com/photo-1596703263926-eb0762ee17e4?w=800&q=80&auto=format",  # red satin stilettos
    "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80&auto=format",     # floral blue pumps
    "https://images.unsplash.com/photo-1515347619252-60a4bf4fff4f?w=800&q=80&auto=format",  # dark blue pumps
    "https://images.unsplash.com/photo-1562273138-f46be4ebdf33?w=800&q=80&auto=format",     # burgundy platform sandals
    "https://images.unsplash.com/photo-1535043934128-cf0b28d52f95?w=800&q=80&auto=format",  # white pointed-toe heels
    "https://images.unsplash.com/photo-1724606854879-9321f9340a89?w=800&q=80&auto=format",  # red glossy pumps
    "https://images.unsplash.com/photo-1718312267162-df826f8ce45f?w=800&q=80&auto=format",  # heel + pearls
    "https://images.pexels.com/photos/336372/pexels-photo-336372.jpeg?w=800",                # red glossy stilettos
    "https://images.pexels.com/photos/3782789/pexels-photo-3782789.jpeg?w=800",              # red strappy heeled sandals
]

# Each URL has been content-verified as a women's handbag / clutch / purse.
VERIFIED_BAG_IMAGES = [
    "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&q=80&auto=format",   # red Ferragamo
    "https://images.unsplash.com/photo-1566150902887-9679ecc155ba?w=800&q=80&auto=format",   # mauve chevron chain bag
    "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&q=80&auto=format",   # orange woven Ferragamo
    "https://images.unsplash.com/photo-1591561954555-607968c989ab?w=800&q=80&auto=format",   # tropical print flap
    "https://images.unsplash.com/photo-1559563458-527698bf5295?w=800&q=80&auto=format",      # gray studded clutch
    "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80&auto=format",      # Gucci black quilted
    "https://images.pexels.com/photos/27174565/pexels-photo-27174565.jpeg?w=800",             # white croc tote
    "https://images.pexels.com/photos/27100523/pexels-photo-27100523.jpeg?w=800",             # brown leather tote
    "https://images.pexels.com/photos/29579382/pexels-photo-29579382.jpeg?w=800",             # rhinestone evening clutch
    "https://images.pexels.com/photos/904350/pexels-photo-904350.jpeg?w=800",                 # white studded floral bag
]


# ----------------- 20 chaussures (name, price, cost, colors, subcategory, material, img_idx) -----------------
WOMEN_SHOES = [
    # Talons (12) — image index into VERIFIED_SHOE_IMAGES
    ("Escarpins Satin Rouge",             29500, 15000, ["Rouge"],   "Talons",   "Satin",  0),
    ("Escarpins Rouge Classique",         31500, 15500, ["Rouge"],   "Talons",   "Cuir",   5),
    ("Escarpins Rouge Perle",             34500, 17000, ["Rouge"],   "Talons",   "Cuir",   6),
    ("Escarpins Rouge Stiletto",          32500, 16000, ["Rouge"],   "Talons",   "Vernis", 7),
    ("Escarpins Fleuris Bleu",            28500, 14000, ["Multi"],   "Talons",   "Satin",  1),
    ("Escarpins Bleu Nuit",               30500, 15000, ["Bleu"],    "Talons",   "Daim",   2),
    ("Escarpins Blanc Mariage",           36500, 18000, ["Blanc"],   "Talons",   "Satin",  4),
    ("Escarpins Blanc Pointus",           33500, 16500, ["Blanc"],   "Talons",   "Cuir",   4),
    ("Escarpins Rouge Bordeaux",          29500, 14500, ["Bordeaux"],"Talons",   "Vernis", 0),
    ("Escarpins Rouge Soirée",            35500, 17500, ["Rouge"],   "Talons",   "Satin",  5),
    ("Escarpins Fleurs Pastel",           27500, 13500, ["Multi"],   "Talons",   "Satin",  1),
    ("Escarpins Bleu Marine Vernis",      31500, 15500, ["Bleu"],    "Talons",   "Vernis", 2),
    # Sandales à talon (6)
    ("Sandales Rouge Bijoux",             26500, 12500, ["Rouge"],   "Sandales", "Cuir",   8),
    ("Sandales Rouge Lanières",           28500, 13500, ["Rouge"],   "Sandales", "Cuir",   8),
    ("Sandales Bordeaux Plateforme",      29500, 14000, ["Bordeaux"],"Sandales", "Cuir",   3),
    ("Sandales Camel Plateforme Bois",    27500, 13000, ["Camel"],   "Sandales", "Cuir",   3),
    ("Sandales Rouge Strass",             31500, 15000, ["Rouge"],   "Sandales", "Cuir",   8),
    ("Sandales Rouge Mariage",            33500, 16000, ["Rouge"],   "Sandales", "Satin",  7),
    # Mariée / Soirée (2)
    ("Escarpins Mariée Pointus",          42500, 20500, ["Blanc"],   "Talons",   "Satin",  4),
    ("Escarpins Soirée Vernis Rouge",     38500, 18500, ["Rouge"],   "Talons",   "Vernis", 6),
]

# ----------------- 10 sacs -----------------
WOMEN_BAGS = [
    ("Sac à Main Rouge Ferragamo",        45500, 22000, ["Rouge"],   "Sacs à main", "Cuir",   0),
    ("Sac à Main Mauve Chevron",          32500, 15500, ["Mauve"],   "Sacs à main", "Cuir",   1),
    ("Sac Panier Orange Tressé",          38500, 18500, ["Orange"],  "Sacs à main", "Osier",  2),
    ("Sac Tropical Multicolore",          36500, 17500, ["Multi"],   "Sacs à main", "Cuir",   3),
    ("Pochette Clutch Grise Clous",       27500, 13000, ["Gris"],    "Pochettes",   "Cuir",   4),
    ("Sac Chaîne Noir Matelassé",         48500, 23500, ["Noir"],    "Sacs à main", "Cuir",   5),
    ("Sac Cabas Blanc Croco",             33500, 16000, ["Blanc"],   "Cabas",       "Cuir",   6),
    ("Sac Cabas Marron Camel",            37500, 18000, ["Camel"],   "Cabas",       "Cuir",   7),
    ("Pochette Strass Soirée Argent",     29500, 14000, ["Argent"],  "Pochettes",   "Perles", 8),
    ("Sac Blanc Fleurs Chaîne",           31500, 15000, ["Blanc"],   "Sacs à main", "Cuir",   9),
    # 4 pochettes additionnelles (Feb 2026, demande gérante)
    ("Pochette Enveloppe Noir Soirée",    24500, 11500, ["Noir"],    "Pochettes",   "Cuir",   4),
    ("Pochette Chaîne Métal Doré",        28500, 13500, ["Doré"],    "Pochettes",   "Satin",  8),
    ("Pochette Perles Nude Mariée",       31500, 15000, ["Nude"],    "Pochettes",   "Perles", 9),
    ("Pochette Satin Rouge Clutch",       26500, 12500, ["Rouge"],   "Pochettes",   "Satin",  0),
]


@router.post("/admin/reseed-women-fashion")
async def reseed_women_fashion(user: dict = Depends(require_role("admin"))):
    """Wipe the catalog and seed it with the launch set: 20 heeled shoes +
    10 handbags. Every image is content-verified as women's heels or handbag
    (no men's shoes, sneakers, clothing, pasta, or books)."""
    await db.products.delete_many({})

    universes = [
        ("Chaussures", WOMEN_SHOES, "Dina Soles", VERIFIED_SHOE_IMAGES, ["36", "37", "38", "39", "40", "41"]),
        ("Sacs",       WOMEN_BAGS,  "Dina Carry", VERIFIED_BAG_IMAGES,  ["Unique"]),
    ]
    inserted = 0
    for cat, items, brand, images, sizes in universes:
        for name, price, cost, colors, subcat, material, img_idx in items:
            url = images[img_idx]
            stock_by_size = {sz: random.randint(5, 25) for sz in sizes}
            doc = {
                "id": new_id(),
                "name": name,
                "category": subcat,
                "brand": brand,
                "price": price,
                "cost": cost,
                "price_old": price + random.choice([0, 3000, 5000]),
                "description": f"{name} — pièce signature {brand}. Finitions soignées, pensée pour la femme élégante d'Abidjan.",
                "image": url,
                "images": [url],
                "sizes": sizes,
                "colors": colors,
                "stock_by_size": stock_by_size,
                "stock": sum(stock_by_size.values()),
                "sku": f"DN-{random.randint(10000, 99999)}",
                "visibility": "both",
                "status": "actif",
                "featured": random.random() < 0.25,
                "is_new": random.random() < 0.4,
                "promo_pct": random.choice([0, 0, 0, 10, 15, 20]),
                "material": material,
                "store_id": "store-cocody",
                "rating_avg": round(random.uniform(4.2, 4.9), 1),
                "rating_count": random.randint(5, 180),
                "created_at": now_iso(),
            }
            await db.products.insert_one(doc)
            inserted += 1

    return {"ok": True, "inserted": inserted, "universes": [u[0] for u in universes]}
