"""Capture real screenshots for the user manual + callout positions from data-testid bounding boxes.
Run: python3 /app/scripts/manual_capture.py  → /app/frontend/public/manual/*.jpg + /app/backend/manual_shots.json"""
import asyncio
import json
import os
from datetime import datetime, timezone

from pymongo import MongoClient
from playwright.async_api import async_playwright

BASE = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].strip()
OUT = "/app/frontend/public/manual"
os.makedirs(OUT, exist_ok=True)
env = dict(line.split("=", 1) for line in open("/app/backend/.env").read().splitlines() if "=" in line)
db = MongoClient(env["MONGO_URL"].strip('"'))[env["DB_NAME"].strip('"')]

PROMO_PID = db.products.find_one({"price_old": {"$gt": 0}}, {"id": 1})["id"]
LABEL_PID = db.products.find_one({"sku": "DEMO-100"}, {"id": 1})["id"]
p = db.products.find_one({"sku": "DEMO-100"})
v = (p.get("variants") or [{}])[0]
TEST_OID = "TEST_manual_prep"
db.orders.delete_one({"id": TEST_OID})
db.orders.insert_one({"id": TEST_OID, "code": "DN-EXEMPLE-01", "status": "en_preparation", "mode": "pickup",
                      "items": [{"product_id": p["id"], "name": p["name"], "size": v.get("size"), "color": v.get("color"), "qty": 1, "price": p.get("price", 0), "image": p.get("image")}],
                      "customer": {"name": "Cliente Exemple", "phone": "+2250700000000"}, "total": p.get("price", 0), "subtotal": p.get("price", 0),
                      "created_at": datetime.now(timezone.utc).isoformat(), "timeline": []})

DESK = {"width": 1440, "height": 900}
MOB = {"width": 390, "height": 844}

SHOTS = [
    # (id, who, viewport, path, pre-actions, [(selector, label)])
    ("console-prep", "console", DESK, f"/console/commandes/DN-EXEMPLE-01", [('[data-testid="order-prepare-DN-EXEMPLE-01"]', "click")],
     [('[data-testid="prep-mode-scan"]', "Scanner l'étiquette"), ('[data-testid="prep-mode-type"]', "Ou taper le code"), ('[data-testid="prep-line-0"]', "Article + code attendu"), ('[data-testid="prep-mark-ready"]', "Actif quand tout est vérifié"), ('[data-testid="prep-print-slip"]', "Fiche colis")]),
    ("console-product-labels", "console", DESK, f"/console/produits/{LABEL_PID}", [],
     [('[data-testid="product-print-labels"]', "1 étiquette par variante"), ('[data-testid="product-print-labels-stock"]', "1 par pièce en stock")]),
    ("console-products", "console", DESK, "/console/produits", [('role=button[name="Tableau"s]', "click")],
     [('[data-testid^="view-"]', "Voir"), ('[data-testid^="edit-product-"]', "Modifier"), ('[data-testid^="delete-product-"]', "Supprimer")]),
    ("console-coordonnees", "console", DESK, "/console/parametres?tab=coordonnees", [],
     [('[data-testid="store-locate"]', "Position actuelle"), ('[data-testid="store-map-pick"]', "Placer sur la carte"), ('[data-testid="opening-grid"]', "Horaires lun → dim"), ('[data-testid="coordonnees-save"]', "Enregistrer")]),
    ("console-livraison-slots", "console", DESK, "/console/parametres?tab=livraison", [],
     [('[data-testid="dslots-grid"]', "Créneaux par jour"), ('[data-testid^="dslots-add-"]', "Ajouter une plage")]),
    ("console-pointage", "console", DESK, "/console/parametres?tab=pointage", [],
     [('[data-testid="role-manager-open"]', "Horaires du rôle"), ('[data-testid="role-manager-days"]', "Jours travaillés"), ('[data-testid="employee-hours"]', "Horaires par employé")]),
    ("console-messagerie", "console", DESK, "/console/messagerie", [],
     [('[data-testid="msg-search"]', "Nom, n° commande ou texte"), ('text=Archivées', "Conversations archivées")]),
    ("console-livreurs", "console", DESK, "/console/livreurs", [],
     [('[data-testid="rider-reports-panel"]', "Signalements livreurs")]),
    ("console-achats", "console", DESK, "/console/achats", [],
     [('text=Nouvelle commande', "Créer une commande fournisseur")]),
    ("rider-courses", "rider", MOB, "/riders", [],
     [('[data-testid="kpi-annulees-retournees"]', "Annulées / Retournées")]),
    ("rider-historique", "rider", MOB, "/riders/historique", [('[data-testid="hist-period-90"]', "click"), ('[data-testid^="hist-day-toggle-"]', "click")],
     [('[data-testid^="hist-day-toggle-"]', "Journée"), ('[data-testid^="hist-order-"]', "Touchez pour le détail")]),
    ("rider-signalement", "rider", MOB, "/riders/signalements", [],
     [('[data-testid="report-kind-panne_moto"]', "Type"), ('[data-testid="report-urgency-haute"]', "Urgence"), ('[data-testid="report-photo-btn"]', "Photo"), ('[data-testid="report-location"]', "Position auto"), ('[data-testid="report-submit"]', "Envoyer")]),
    ("rider-messages", "rider", MOB, "/riders/messages", [],
     [('[data-testid="rider-inbox-search"]', "Rechercher"), ('[data-testid="rider-inbox-archived-toggle"]', "Archivées")]),
    ("store-home", "guest", MOB, "/", [],
     [('[data-testid="promo-banner"]', "Bandeau défilant"), ('[data-testid^="badge-disc-"]', "Sticker promo")]),
    ("store-product-promo", "guest", MOB, f"/product/{PROMO_PID}", [],
     [('[data-testid="product-promo-sticker"]', "Réduction"), ('[data-testid="product-old-price"]', "Ancien prix barré")]),
    ("store-account-messages", "customer", MOB, "/compte/messages", [],
     [('[data-testid="msg-cat-boutique"]', "Boutique"), ('[data-testid="msg-cat-livreur"]', "Livreur"), ('[data-testid="msg-search"]', "Rechercher"), ('[data-testid="msg-archived-toggle"]', "Archivées")]),
    ("store-account-address", "customer", MOB, "/compte/adresses", [('[data-testid="address-new"]', "click")],
     [('[data-testid="addr-locate"]', "GPS"), ('[data-testid="addr-map-pick"]', "Carte")]),
]
ONLY = set(filter(None, os.environ.get("ONLY", "").split(",")))
SHOTS = [s for s in SHOTS if not ONLY or s[0] in ONLY]


async def login(page, who):
    if who == "console":
        await page.goto(BASE + "/console/connexion"); await page.wait_for_timeout(1500)
        await page.fill('[data-testid="login-email"]', "aouattaraesca@gmail.com")
        await page.fill('[data-testid="login-password"]', "Admin123!")
        await page.click('[data-testid="login-submit"]'); await page.wait_for_timeout(3500)
    elif who == "rider":
        await page.goto(BASE + "/riders/connexion"); await page.wait_for_timeout(1500)
        for d in "5555":
            await page.get_by_role("button", name=d, exact=True).click(); await page.wait_for_timeout(120)
        await page.get_by_text("Démarrer ma journée").click(); await page.wait_for_timeout(3500)
    elif who == "customer":
        await page.goto(BASE + "/compte"); await page.wait_for_timeout(1500)
        await page.fill('[data-testid="account-phone"]', "+225 07 85 55 58 88")
        await page.fill('[data-testid="account-code"]', "386436")
        await page.click('[data-testid="account-login"]'); await page.wait_for_timeout(3000)


async def main():
    result = {}
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        ctxs = {}
        for sid, who, vp, path, pre, targets in SHOTS:
            key = (who, vp["width"])
            if key not in ctxs:
                ctx = await b.new_context(viewport=vp, device_scale_factor=1, locale="fr-FR", geolocation={"latitude": 5.36, "longitude": -4.0}, permissions=["geolocation"])
                page = await ctx.new_page()
                if who != "guest":
                    await login(page, who)
                ctxs[key] = page
            page = ctxs[key]
            try:
                await page.goto(BASE + path); await page.wait_for_timeout(3500)
                for close in ('[data-testid="punch-close"]',):
                    if await page.locator(close).count():
                        await page.locator(close).first.click(force=True); await page.wait_for_timeout(400)
                for sel, act in pre:
                    loc = page.locator(sel).first
                    if await loc.count():
                        await loc.click(); await page.wait_for_timeout(1800)
                first = page.locator(targets[0][0]).first
                if await first.count():
                    await first.scroll_into_view_if_needed(); await page.wait_for_timeout(500)
                    box = await first.bounding_box()
                    if box and box["y"] > vp["height"] * 0.6:
                        await page.mouse.wheel(0, box["y"] - vp["height"] * 0.3); await page.wait_for_timeout(500)
                callouts = []
                for n, (sel, label) in enumerate(targets, 1):
                    loc = page.locator(sel).first
                    if not await loc.count():
                        continue
                    bb = await loc.bounding_box()
                    if not bb or bb["y"] + bb["height"] < 0 or bb["y"] > vp["height"]:
                        continue
                    callouts.append({"n": len(callouts) + 1, "label": label,
                                     "x": round(min(98, max(2, (bb["x"] + bb["width"] / 2) / vp["width"] * 100)), 1),
                                     "y": round(min(98, max(2, (bb["y"] + bb["height"] / 2) / vp["height"] * 100)), 1),
                                     "w": round(bb["width"] / vp["width"] * 100, 1), "h": round(bb["height"] / vp["height"] * 100, 1)})
                await page.screenshot(path=f"{OUT}/{sid}.jpg", type="jpeg", quality=70)
                result[sid] = {"image": f"/manual/{sid}.jpg", "callouts": callouts, "ratio": vp["width"] / vp["height"]}
                print(sid, len(callouts))
            except Exception as e:  # noqa: BLE001
                print("FAIL", sid, e)
        await b.close()
    json.dump({**(json.load(open("/app/backend/manual_shots.json")) if ONLY and os.path.exists("/app/backend/manual_shots.json") else {}), **result}, open("/app/backend/manual_shots.json", "w"), ensure_ascii=False, indent=1)
    db.orders.delete_one({"id": TEST_OID})
    db.audit_log.delete_many({"entity_id": TEST_OID})


asyncio.run(main())
