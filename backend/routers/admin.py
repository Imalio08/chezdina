"""
Admin router — merchant-facing admin utilities.

Currently hosts the women's fashion catalog reseed used at launch to replace
the generic demo products with a cohesive set: women's shoes, handbags and
clothing (Zara-style + African fabrics). Each product is assigned ONE
unique Unsplash photo ID — guaranteed no cross-SKU image re-use.
"""
import random
from fastapi import APIRouter, Depends

from deps import db, require_role, new_id, now_iso

router = APIRouter(prefix="/api", tags=["admin"])


# 40 unique Unsplash photo IDs — one per product, zero overlap.
# (name, price, cost, photo_id, colors, subcategory, material)
WOMEN_SHOES = [
    ("Escarpins Satin Rouge",            29500, 15000, "1596703263926-eb0762ee17e4", ["Rouge"],       "Talons",      "Satin"),
    ("Escarpins Noir Classique",         27500, 14000, "1543163521-1bf539c55dd2",    ["Noir"],        "Talons",      "Cuir"),
    ("Escarpins Nude Pointus",           32000, 16500, "1580906461029-8d8c6e4e1a04", ["Nude"],        "Talons",      "Cuir"),
    ("Sandales Dorées à Brides",         24000, 11500, "1562273138-f46be4ebdf33",    ["Doré"],        "Sandales",    "Métallisé"),
    ("Sandales Compensées Beige",        22500, 10500, "1549318441-67f3b31d6e3c",    ["Beige"],       "Sandales",    "Daim"),
    ("Mules Crème Minimalistes",         21000, 9500,  "1603808033192-082d6919d3e1", ["Crème"],       "Mules",       "Cuir"),
    ("Mules Noires à Talon Carré",       26000, 12000, "1515347619252-60a4bf4fff4f", ["Noir"],        "Mules",       "Cuir"),
    ("Ballerines Pointues Beige",        18500, 8500,  "1512820790803-83ca734da794", ["Beige"],       "Ballerines",  "Cuir"),
    ("Baskets Blanches Minimalistes",    32000, 15500, "1549298916-b41d501d3772",    ["Blanc"],       "Baskets",     "Cuir"),
    ("Baskets Chunky Beige",             36000, 18000, "1600269452121-4f2416e55c28", ["Beige"],       "Baskets",     "Mesh"),
    ("Bottes Hautes Daim Taupe",         48000, 24000, "1483121942849-3b8f81b4b2d5", ["Taupe"],       "Bottes",      "Daim"),
    ("Bottines Chelsea Noires",          38000, 19000, "1542838132-92c53300491e",    ["Noir"],        "Bottes",      "Cuir"),
    ("Mocassins Dorés Chaîne",           29000, 14000, "1573100925118-870b8efc799d", ["Doré"],        "Mocassins",   "Cuir"),
    ("Espadrilles Pagne Wax",            19500, 8000,  "1584792212036-f0d47e95dfd0", ["Wax"],         "Espadrilles", "Toile"),
    ("Sandales Plates Minimalistes",     15500, 6500,  "1593032529762-cf13f32aafe3", ["Noir"],        "Sandales",    "Cuir"),
]

WOMEN_BAGS = [
    ("Sac Baguette Cuir Noir",           38500, 18500, "1584917865442-de89df76afd3", ["Noir"],   "Sacs à main", "Cuir"),
    ("Sac Besace Camel",                 32000, 15000, "1548036328-c9fa89d128fa",    ["Camel"],  "Sacs à main", "Cuir"),
    ("Sac Shopping Beige XL",            29500, 13500, "1591561954555-607968c989ab", ["Beige"],  "Sacs à main", "Cuir"),
    ("Sac Pochette Soirée Dorée",        24500, 11500, "1559563458-527698bf5295",    ["Doré"],   "Pochettes",   "Satin"),
    ("Pochette Clutch Nude",             18500, 8500,  "1612336307429-8a898d10e223", ["Nude"],   "Pochettes",   "Satin"),
    ("Sac Seau Cuir Marron",             34000, 16500, "1566150902887-9679ecc155ba", ["Marron"], "Sacs à main", "Cuir"),
    ("Sac Cabas Pagne",                  22000, 9500,  "1595777457583-95e059d581b8", ["Wax"],    "Cabas",       "Wax"),
    ("Mini Sac Chaîne Dorée",            26500, 12500, "1618354691373-d851c5c3a990", ["Noir"],   "Mini sacs",   "Cuir"),
    ("Sac à Dos Cuir Noir",              42000, 20000, "1553062407-98eeb64c6a62",    ["Noir"],   "Sacs à dos",  "Cuir"),
    ("Sac Hobo Beige Souple",            31000, 14500, "1588444837495-c6cfeb53f32d", ["Beige"],  "Sacs à main", "Daim"),
    ("Pochette Enveloppe Rouge",         19500, 8800,  "1601924994987-69e26d50dc26", ["Rouge"],  "Pochettes",   "Cuir"),
    ("Sac Trapèze Nude",                 28500, 13500, "1590874103328-eac38a683ce7", ["Nude"],   "Sacs à main", "Cuir"),
]

WOMEN_CLOTHING = [
    ("Robe Longue Fleurie",              24500, 11000, "1515372039744-b8f02a3ae446", ["Multicolore"], "Robes",         "Coton"),
    ("Robe Satin Noire Fente",           32500, 15500, "1496747611176-843222e1e57c", ["Noir"],        "Robes",         "Satin"),
    ("Blazer Oversize Beige",            42000, 20000, "1548624313-0396c75e4b1a",    ["Beige"],       "Vestes",        "Laine"),
    ("Chemisier Satin Rose Poudré",      18500, 8500,  "1551488831-00ddcb6c6bd3",    ["Rose"],        "Hauts",         "Satin"),
    ("Pantalon Palazzo Taille Haute",    22000, 10000, "1591047139829-d91aecb6caea", ["Noir"],        "Pantalons",     "Viscose"),
    ("Jupe Midi Satin Dorée",            19500, 9000,  "1596462502278-27bfdc403348", ["Doré"],        "Jupes",         "Satin"),
    ("Top Crop Blanc Côtelé",            11500, 5000,  "1572804013309-59a88b7e92f1", ["Blanc"],       "Hauts",         "Coton"),
    ("Ensemble Pagne Wax Moderne",       29500, 14000, "1618922177532-28b16ba82cdd", ["Wax"],         "Pagne",         "Wax"),
    ("Boubou Brodé Doré",                48500, 22000, "1617039920262-f4631e1d4abb", ["Doré"],        "Pagne",         "Wax"),
    ("Robe Pagne Wax Trompette",         26500, 12500, "1605086347596-cd1e4b4e3f06", ["Wax"],         "Pagne",         "Wax"),
    ("Combinaison Noire Fluide",         28000, 13000, "1583744946564-b52d01a7b321", ["Noir"],        "Combinaisons",  "Viscose"),
    ("Trench Beige Ceinturé",            55000, 26000, "1544441893-675973e31985",    ["Beige"],       "Vestes",        "Coton"),
    ("Robe Chemise Blanche",             21000, 9500,  "1485462537746-965f33f7f6a7", ["Blanc"],       "Robes",         "Lin"),
]


def _unsplash(pid: str, w: int = 800) -> str:
    return f"https://images.unsplash.com/photo-{pid}?w={w}&q=80&auto=format"


@router.post("/admin/reseed-women-fashion")
async def reseed_women_fashion(user: dict = Depends(require_role("admin"))):
    """Wipe the catalog and seed it with the launch set: women's shoes, handbags and clothing.
    Each product is assigned ONE unique Unsplash photo ID — guaranteed no cross-SKU re-use."""
    await db.products.delete_many({})

    universes = [
        ("Chaussures", WOMEN_SHOES, "Dina Soles"),
        ("Sacs", WOMEN_BAGS, "Dina Carry"),
        ("Vêtements", WOMEN_CLOTHING, "Dina Dress"),
    ]
    sizes_by_cat = {
        "Chaussures": ["36", "37", "38", "39", "40", "41"],
        "Sacs": ["Unique"],
        "Vêtements": ["XS", "S", "M", "L", "XL"],
    }
    inserted = 0
    for cat, items, brand in universes:
        sizes = sizes_by_cat[cat]
        for name, price, cost, photo_id, colors, subcat, material in items:
            url = _unsplash(photo_id)
            stock_by_size = {sz: random.randint(3, 15) for sz in sizes}
            doc = {
                "id": new_id(),
                "name": name,
                "category": subcat,
                "brand": brand,
                "price": price,
                "cost": cost,
                "price_old": price + random.choice([0, 3000, 5000]),
                "description": f"{name} — pièce signature {brand}. Finitions soignées, confort pensé pour la femme active abidjanaise.",
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
                "promo_pct": random.choice([0, 0, 10, 15, 20]),
                "material": material,
                "store_id": "store-cocody",
                "rating_avg": round(random.uniform(4.1, 4.9), 1),
                "rating_count": random.randint(5, 180),
                "created_at": now_iso(),
            }
            await db.products.insert_one(doc)
            inserted += 1

    return {"ok": True, "inserted": inserted, "universes": [u[0] for u in universes]}
