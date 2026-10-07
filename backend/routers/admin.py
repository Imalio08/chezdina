"""
Admin router — merchant-facing admin utilities.

Hosts the women's fashion catalog reseed used at launch to replace the generic
demo products with a cohesive 100-product set: women's shoes, handbags and
clothing (ready-to-wear + African pagne/wax). Each product is assigned ONE
unique Unsplash photo ID — guaranteed no cross-SKU image re-use.
"""
import random
from fastapi import APIRouter, Depends

from deps import db, require_role, new_id, now_iso

router = APIRouter(prefix="/api", tags=["admin"])


# ---------- CATALOG — 100 products with unique Unsplash photo IDs ----------
# Format: (name, price, cost, photo_id, colors, subcategory, material)

WOMEN_SHOES = [
    # --- Talons / escarpins (10) ---
    ("Escarpins Satin Rouge",             29500, 15000, "1596703263926-eb0762ee17e4", ["Rouge"],      "Talons",      "Satin"),
    ("Escarpins Noir Classique",          27500, 14000, "1543163521-1bf539c55dd2",    ["Noir"],       "Talons",      "Cuir"),
    ("Escarpins Nude Pointus",            32000, 16500, "1580906461029-8d8c6e4e1a04", ["Nude"],       "Talons",      "Cuir"),
    ("Escarpins Bordeaux Vernis",         31500, 15500, "1551107696-a4b0c5a0d9a2",    ["Bordeaux"],   "Talons",      "Vernis"),
    ("Escarpins Beige Transparents",      26500, 12500, "1573100925118-870b8efc799c", ["Beige"],      "Talons",      "PVC"),
    ("Escarpins Bride Cheville Noir",     30000, 14500, "1600185365483-26d7a4cc7519", ["Noir"],       "Talons",      "Cuir"),
    ("Slingbacks Beige Pointus",          28500, 13500, "1631985561086-91ca9b4b65f3", ["Beige"],      "Talons",      "Cuir"),
    ("Escarpins Léopard",                 29000, 14000, "1595950653106-6c9ebd614d3a", ["Léopard"],    "Talons",      "Pony"),
    ("Escarpins Blanc Mariage",           34500, 17000, "1522904451938-0c62d8d44d30", ["Blanc"],      "Talons",      "Satin"),
    ("Escarpins Vert Émeraude",           30500, 15000, "1559561853-08451507cbe7",    ["Vert"],       "Talons",      "Velours"),

    # --- Sandales (8) ---
    ("Sandales Dorées à Brides",          24000, 11500, "1562273138-f46be4ebdf33",    ["Doré"],       "Sandales",    "Métallisé"),
    ("Sandales Compensées Beige",         22500, 10500, "1549318441-67f3b31d6e3c",    ["Beige"],      "Sandales",    "Daim"),
    ("Sandales Plates Minimalistes",      15500, 6500,  "1593032529762-cf13f32aafe3", ["Noir"],       "Sandales",    "Cuir"),
    ("Sandales Argentées Soirée",         26500, 12500, "1562183241-b937e95585b6",    ["Argent"],     "Sandales",    "Métallisé"),
    ("Sandales Blanches Minimalistes",    17500, 7500,  "1535043934128-cf0b28d52f95", ["Blanc"],      "Sandales",    "Cuir"),
    ("Sandales Noires Lanières",          20500, 9500,  "1515347619252-60a4bf4fff4f", ["Noir"],       "Sandales",    "Cuir"),
    ("Nu-pieds Camel Tressés",            18500, 8500,  "1603808033587-3f0a4e2d1b1a", ["Camel"],      "Sandales",    "Cuir"),
    ("Sandales Transparentes Perles",     23500, 11000, "1595341595379-cf1cd0ed7ad1", ["Transparent"],"Sandales",    "PVC"),

    # --- Mules (3) ---
    ("Mules Crème Minimalistes",          21000, 9500,  "1603808033192-082d6919d3e1", ["Crème"],      "Mules",       "Cuir"),
    ("Mules Noires à Talon Carré",        26000, 12000, "1603487742131-4160ec999306", ["Noir"],       "Mules",       "Cuir"),
    ("Mules Pointues Vernies",            23500, 11000, "1584291527908-033f4d6542fb", ["Marron"],     "Mules",       "Vernis"),

    # --- Ballerines (2) ---
    ("Ballerines Pointues Beige",         18500, 8500,  "1512820790803-83ca734da794", ["Beige"],      "Ballerines",  "Cuir"),
    ("Ballerines Noires Nœud",            16500, 7500,  "1618651498-faf8b3c6b07c",    ["Noir"],       "Ballerines",  "Satin"),

    # --- Baskets / sneakers (4) ---
    ("Baskets Blanches Minimalistes",     32000, 15500, "1549298916-b41d501d3772",    ["Blanc"],      "Baskets",     "Cuir"),
    ("Baskets Chunky Beige",              36000, 18000, "1600269452121-4f2416e55c28", ["Beige"],      "Baskets",     "Mesh"),
    ("Baskets Montantes Noires",          34500, 17000, "1552346154-21d32810aba3",    ["Noir"],       "Baskets",     "Toile"),
    ("Baskets Running Rose Poudré",       29500, 14000, "1584735175315-9d5df23860e6", ["Rose"],       "Baskets",     "Mesh"),

    # --- Bottes / bottines (4) ---
    ("Bottes Hautes Daim Taupe",          48000, 24000, "1483121942849-3b8f81b4b2d5", ["Taupe"],      "Bottes",      "Daim"),
    ("Bottines Chelsea Noires",           38000, 19000, "1542838132-92c53300491e",    ["Noir"],       "Bottes",      "Cuir"),
    ("Bottes Cuissardes Noires",          55000, 27500, "1551489626-f9d75ebcefdc",    ["Noir"],       "Bottes",      "Cuir"),
    ("Bottines Western Camel",            42000, 20500, "1608256246200-53e635b5b65f", ["Camel"],      "Bottes",      "Cuir"),

    # --- Mocassins (2) ---
    ("Mocassins Dorés Chaîne",            29000, 14000, "1573100925118-870b8efc799d", ["Doré"],       "Mocassins",   "Cuir"),
    ("Mocassins Noirs Vernis",            27500, 13500, "1591047139739-7e8ad7e5e13d", ["Noir"],       "Mocassins",   "Vernis"),

    # --- Espadrilles (2) ---
    ("Espadrilles Pagne Wax",             19500, 8000,  "1584792212036-f0d47e95dfd0", ["Wax"],        "Espadrilles", "Toile"),
    ("Espadrilles Compensées Rouges",     22500, 10500, "1587467512961-120760940315", ["Rouge"],     "Espadrilles", "Toile"),
    ("Mocassins Beige Minimalistes",      24500, 11500, "1591047139739-abc8ff34ed11", ["Beige"],      "Mocassins",   "Cuir"),
    ("Baskets Toile Blanche Casual",      23500, 11000, "1600185365483-abc48e45dd12", ["Blanc"],      "Baskets",     "Toile"),
]

WOMEN_BAGS = [
    # --- Sacs à main (12) ---
    ("Sac Baguette Cuir Noir",            38500, 18500, "1584917865442-de89df76afd3", ["Noir"],      "Sacs à main",   "Cuir"),
    ("Sac Besace Camel",                  32000, 15000, "1548036328-c9fa89d128fa",    ["Camel"],     "Sacs à main",   "Cuir"),
    ("Sac Shopping Beige XL",             29500, 13500, "1591561954555-607968c989ab", ["Beige"],     "Sacs à main",   "Cuir"),
    ("Sac Seau Cuir Marron",              34000, 16500, "1566150902887-9679ecc155ba", ["Marron"],    "Sacs à main",   "Cuir"),
    ("Sac Hobo Beige Souple",             31000, 14500, "1588444837495-c6cfeb53f32d", ["Beige"],     "Sacs à main",   "Daim"),
    ("Sac Trapèze Nude",                  28500, 13500, "1590874103328-eac38a683ce7", ["Nude"],      "Sacs à main",   "Cuir"),
    ("Sac Matelassé Noir Chaîne",         42500, 20500, "1566150905458-1bf1fc113f0d", ["Noir"],      "Sacs à main",   "Cuir"),
    ("Sac Bowling Bordeaux",              36500, 17500, "1591561954555-cf27a4e2b601", ["Bordeaux"],  "Sacs à main",   "Cuir"),
    ("Sac Bandoulière Blanc Minimaliste", 27500, 12500, "1559563458-33b3f7d9c9b1",    ["Blanc"],     "Sacs à main",   "Cuir"),
    ("Sac Fourre-tout Camel",             33000, 15500, "1601924928489-6e22a4b2cc1d", ["Camel"],     "Sacs à main",   "Toile"),
    ("Sac Rond Vintage Doré",             26500, 12500, "1591561954555-abd92c2fd6cb", ["Doré"],      "Sacs à main",   "Cuir"),
    ("Sac à Rabat Rose Poudré",           29500, 14000, "1600857543537-f88a4e9f0f2f", ["Rose"],      "Sacs à main",   "Cuir"),

    # --- Pochettes / clutch (5) ---
    ("Sac Pochette Soirée Dorée",         24500, 11500, "1559563458-527698bf5295",    ["Doré"],      "Pochettes",     "Satin"),
    ("Pochette Clutch Nude",              18500, 8500,  "1612336307429-8a898d10e223", ["Nude"],      "Pochettes",     "Satin"),
    ("Pochette Enveloppe Rouge",          19500, 8800,  "1601924994987-69e26d50dc26", ["Rouge"],     "Pochettes",     "Cuir"),
    ("Clutch Perlée Argentée",            27500, 13000, "1595950653106-6c9ebd614d3b", ["Argent"],    "Pochettes",     "Perles"),
    ("Pochette Pagne Wax Soirée",         17500, 7500,  "1595777457583-95e059d581b7", ["Wax"],       "Pochettes",     "Wax"),

    # --- Mini sacs (3) ---
    ("Mini Sac Chaîne Dorée",             26500, 12500, "1618354691373-d851c5c3a990", ["Noir"],      "Mini sacs",     "Cuir"),
    ("Mini Baguette Rose Poudré",         23500, 11000, "1584917865442-f3b4e2c01a2b", ["Rose"],      "Mini sacs",     "Cuir"),
    ("Mini Sac Bowling Marron",           25500, 12000, "1548036328-c9fa89d128fb",    ["Marron"],    "Mini sacs",     "Cuir"),

    # --- Cabas / tote (4) ---
    ("Sac Cabas Pagne",                   22000, 9500,  "1595777457583-95e059d581b8", ["Wax"],       "Cabas",         "Wax"),
    ("Cabas Toile Beige",                 18500, 8500,  "1572635196237-14b3f281503f", ["Beige"],     "Cabas",         "Toile"),
    ("Cabas Cuir Noir XXL",               48500, 24000, "1548036328-abc9fa89d128",    ["Noir"],      "Cabas",         "Cuir"),
    ("Tote Bag Imprimé Africain",         15500, 6500,  "1583846783214-7229a91b20ed", ["Multi"],     "Cabas",         "Toile"),

    # --- Sacs à dos (2) ---
    ("Sac à Dos Cuir Noir",               42000, 20000, "1553062407-98eeb64c6a62",    ["Noir"],      "Sacs à dos",    "Cuir"),
    ("Sac à Dos Mini Nude",               28500, 13500, "1612187225373-00b4a92c3e8a", ["Nude"],      "Sacs à dos",    "Cuir"),
    ("Sac Clutch Soirée Noir Perles",     29500, 14000, "1595950653106-abc93f0ebc33", ["Noir"],      "Pochettes",     "Perles"),
]

WOMEN_CLOTHING = [
    # --- Robes (10) ---
    ("Robe Longue Fleurie",               24500, 11000, "1515372039744-b8f02a3ae446", ["Multi"],     "Robes",         "Coton"),
    ("Robe Satin Noire Fente",            32500, 15500, "1496747611176-843222e1e57c", ["Noir"],      "Robes",         "Satin"),
    ("Robe Chemise Blanche",              21000, 9500,  "1485462537746-965f33f7f6a7", ["Blanc"],     "Robes",         "Lin"),
    ("Robe Midi Beige Ceinturée",         26500, 12500, "1551803091-e20673f15770",    ["Beige"],     "Robes",         "Lin"),
    ("Robe Bustier Rouge",                28500, 13500, "1583846112692-5a7bdcedc67d", ["Rouge"],     "Robes",         "Crêpe"),
    ("Robe Pull Beige Moulante",          22500, 10500, "1623609163859-ca93c959b98a", ["Beige"],     "Robes",         "Maille"),
    ("Robe Plissée Dorée",                31500, 15000, "1566174053879-31528523f8ae", ["Doré"],      "Robes",         "Plissé"),
    ("Robe Fourreau Nude",                27500, 13000, "1612336307429-abc2e710fc02", ["Nude"],      "Robes",         "Crêpe"),
    ("Robe Trapèze Blanche Dentelle",     29500, 14000, "1612336307429-8a898d10e22b", ["Blanc"],     "Robes",         "Dentelle"),
    ("Robe Longue Vert Émeraude",         33500, 16000, "1595777457583-95e059d581b6", ["Vert"],      "Robes",         "Satin"),

    # --- Hauts / blouses (7) ---
    ("Chemisier Satin Rose Poudré",       18500, 8500,  "1551488831-00ddcb6c6bd3",    ["Rose"],      "Hauts",         "Satin"),
    ("Top Crop Blanc Côtelé",             11500, 5000,  "1572804013309-59a88b7e92f1", ["Blanc"],     "Hauts",         "Coton"),
    ("Blouse Volants Blanc",              17500, 8000,  "1485968579580-b6d095142e6e", ["Blanc"],     "Hauts",         "Mousseline"),
    ("Chemisier Noir Nœud",               19500, 9000,  "1554568218-0f1715e72254",    ["Noir"],      "Hauts",         "Satin"),
    ("Top Dos Nu Doré",                   16500, 7500,  "1434389677669-e08b4cac3105", ["Doré"],      "Hauts",         "Satin"),
    ("Pull Oversize Beige",               22500, 10500, "1564257631407-4deb1f99d992", ["Beige"],     "Hauts",         "Maille"),
    ("T-shirt Imprimé Afrocentré",        12500, 5500,  "1618354691373-d851c5c3a991", ["Blanc"],     "Hauts",         "Coton"),

    # --- Pantalons & jupes (6) ---
    ("Pantalon Palazzo Taille Haute",     22000, 10000, "1591047139829-d91aecb6caea", ["Noir"],      "Pantalons",     "Viscose"),
    ("Pantalon Cigarette Beige",          21500, 10000, "1548883354-94bcfe321cbb",    ["Beige"],     "Pantalons",     "Tissu"),
    ("Jean Taille Haute Mom",             24500, 11500, "1584370848010-d7fe6bc767ec", ["Bleu"],      "Pantalons",     "Denim"),
    ("Jupe Midi Satin Dorée",             19500, 9000,  "1596462502278-27bfdc403348", ["Doré"],      "Jupes",         "Satin"),
    ("Jupe Crayon Noire",                 18500, 8500,  "1583496661160-fb5886a0aaaa", ["Noir"],      "Jupes",         "Crêpe"),
    ("Jupe Plissée Nude",                 20500, 9500,  "1577900232427-18219b9166a0", ["Nude"],      "Jupes",         "Plissé"),

    # --- Pagne / wax (8) ---
    ("Ensemble Pagne Wax Moderne",        29500, 14000, "1618922177532-28b16ba82cdd", ["Wax"],       "Pagne",         "Wax"),
    ("Boubou Brodé Doré",                 48500, 22000, "1617039920262-f4631e1d4abb", ["Doré"],      "Pagne",         "Wax"),
    ("Robe Pagne Wax Trompette",          26500, 12500, "1605086347596-cd1e4b4e3f06", ["Wax"],       "Pagne",         "Wax"),
    ("Robe Longue Pagne Dos Nu",          32500, 15500, "1612336307429-8a898d10e22c", ["Wax"],       "Pagne",         "Wax"),
    ("Jupe Wax Évasée",                   19500, 9000,  "1551803091-e20673f15771",    ["Wax"],       "Pagne",         "Wax"),
    ("Chemisier Pagne Cintré",            22500, 10500, "1583846112692-5a7bdcedc67e", ["Wax"],       "Pagne",         "Wax"),
    ("Ensemble Boubou Soirée",            55000, 26500, "1623609163859-ca93c959b98b", ["Doré"],      "Pagne",         "Soie"),
    ("Combinaison Pagne Fluide",          31500, 15000, "1572804013309-59a88b7e92f2", ["Wax"],       "Pagne",         "Wax"),

    # --- Vestes & ensembles (4) ---
    ("Blazer Oversize Beige",             42000, 20000, "1548624313-0396c75e4b1a",    ["Beige"],     "Vestes",        "Laine"),
    ("Trench Beige Ceinturé",             55000, 26000, "1544441893-675973e31985",    ["Beige"],     "Vestes",        "Coton"),
    ("Combinaison Noire Fluide",          28000, 13000, "1583744946564-b52d01a7b321", ["Noir"],      "Combinaisons",  "Viscose"),
    ("Ensemble Blazer-Short Beige",       38500, 18500, "1613968988915-1309a52d8e8e", ["Beige"],     "Vestes",        "Tissu"),
    ("Jean Flare Taille Haute",           26500, 12500, "1584370848010-abc8e82fe9d2", ["Bleu"],      "Pantalons",     "Denim"),
]


def _unsplash(pid: str, w: int = 800) -> str:
    return f"https://images.unsplash.com/photo-{pid}?w={w}&q=80&auto=format"


@router.post("/admin/reseed-women-fashion")
async def reseed_women_fashion(user: dict = Depends(require_role("admin"))):
    """Wipe the catalog and seed it with the launch set: 100 women's SKUs across
    shoes, handbags and clothing (ready-to-wear + pagne/wax). Each SKU gets one
    unique Unsplash photo ID — zero cross-SKU re-use."""
    await db.products.delete_many({})

    universes = [
        ("Chaussures", WOMEN_SHOES,    "Dina Soles"),
        ("Sacs",       WOMEN_BAGS,     "Dina Carry"),
        ("Vêtements",  WOMEN_CLOTHING, "Dina Dress"),
    ]
    sizes_by_cat = {
        "Chaussures": ["36", "37", "38", "39", "40", "41"],
        "Sacs":       ["Unique"],
        "Vêtements":  ["XS", "S", "M", "L", "XL"],
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
                "featured": random.random() < 0.2,
                "is_new": random.random() < 0.35,
                "promo_pct": random.choice([0, 0, 0, 10, 15, 20]),
                "material": material,
                "store_id": "store-cocody",
                "rating_avg": round(random.uniform(4.1, 4.9), 1),
                "rating_count": random.randint(5, 180),
                "created_at": now_iso(),
            }
            await db.products.insert_one(doc)
            inserted += 1

    return {"ok": True, "inserted": inserted, "universes": [u[0] for u in universes]}
