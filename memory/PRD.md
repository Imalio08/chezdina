# Chez Dina — PRD

## Problem Statement
Chez Dina — retail OS femme Abidjan Cocody Angré 7e. Français, FCFA, Africa/Abidjan. 3 faces: Console / Rider / Storefront. TikTok @dinoush04 · WhatsApp +225 07 77 92 61 79.

## Session 13 (Feb 7 2026) — Storefront v3 + Rider offline sync

### Storefront refondu (acceptance checklist 6.8 bis)
- **Home.jsx** réécrit en marketplace boutique : Hero carousel 4 slides, bandeau annonce, **Vente flash** gradient rouge avec countdown live (apparaît/disparaît auto selon `promotion.flash && ends_at > now`), tuiles **6 catégories**, **row Bons plans** triés par discount, **row Nouveautés**, **une row par catégorie** (jamais mélangées), **Lookbook** éditorial (grid image + 2-4 produits), **Meilleures ventes**, bandeau confiance 4 colonnes, **floating WhatsApp**.
- **ProductCardV2** réutilisable partout : image portrait 3:4, max 2 badges prioritisés (-%, Flash, Nouveau, Top vente, Plus que 2, Bientôt de retour), cœur favoris (localStorage), color swatches, note si ≥3 avis, prix tabulaires + ancien prix barré, **bouton + Ajouter** → bottom sheet taille avec sold-out grisées, "🔥 X vendus" si >20.
- **Bons plans** `/boutique/bons-plans` : chips Tout/Flash/-30%/<10k/<20k/Derniers articles, bannières de promotions actives linkées, tri Discount/Prix/Nouveautés.
- **SearchBar** avec suggestions tolérantes aux fautes (`escarpain` → match `escarpin`), recherches récentes localStorage, fallback "Aucun résultat → Demander sur WhatsApp" + log dans `db.search_misses`.
- **WelcomePopup** : config `/public/popup` (enabled, image, title, offer, code, delay_s). Affiché 1x par session après délai configurable.

### Backend endpoints ajoutés
- `GET /public/search-suggestions?q=` : fuzzy match (startsWith, contains, short-substring, char-overlap ≥80%)
- `GET /public/best-sellers?limit=` : pipeline aggregation orders → produits les plus vendus
- `GET /public/lookbook` : récupère `site_settings.lookbook` ou génère un lookbook démo
- `GET /public/popup`, `/public/announcement` : paramétrables en console
- `GET /public/products/{pid}/delivery-estimate?zone=` : fee + delay par zone
- `POST /sync/batch` (rider auth) : accepte `ops:[{type:status|contact,...}]` pour rejouer les actions hors-ligne

### Rider offline sync
- **`/app/frontend/src/lib/offlineQueue.js`** : `enqueue(op)`, `queueSize()`, `flushQueue()`, `startAutoSync()` — queue localStorage avec replay auto sur `online` event + poll 30s + flush au mount du RiderShell.
- Backend `POST /sync/batch` rejoue status change + contact-log en marquant `timeline.offline=true` et `contact_log.offline=true` pour que la gérante voie les actions différées.

### Routes App.js ajoutées
- `/boutique/bons-plans` → BonsPlans.jsx
- RiderShell importe `offlineQueue.startAutoSync()` au mount

### Testing manuel (curl)
- `/public/search-suggestions?q=robe` → produits + catégories ✅
- `/public/lookbook` → 1 look ✅
- `/public/popup` → {enabled:false} par défaut ✅
- `/public/products/{id}/delivery-estimate?zone=Cocody` → fee 1500, delay 24h ✅
- `/sync/batch` avec 1 op contact → `{results:[{ok:true}], synced_at}` ✅

### Non livré (deferred)
- Admin UI pour éditer `welcome_popup`, `announcement`, `lookbook` (actuellement JSON direct dans site_settings)
- Mega-menu desktop avec sous-catégories (actuellement nav simple)
- Zoom au tap sur Product.jsx + bouton "Commander sur WhatsApp" pre-filled (endpoint prêt, UI à ajouter)
- Favoris merge au login (local → compte serveur)
- Service worker PWA complet (actuellement queue localStorage sans background sync)
- Filters bottom-sheet mobile avec pointure/couleur/talon sur Catalog
- Guide des tailles tooltip, estimation de livraison dans fiche produit

## Sessions précédentes
- S12 : Rider Space v2 (5 bottom tabs, preuve code/photo/signature, score, offline queue)
- S11 : Rebrand + CMS pages + Caisse + Encaissements + P&L + Marques/Catégories
- S10 : CMS Vitrine SectionBuilder + Compte Cliente code secret
- S9 : WhatsApp auto + Fidélité + Parrainage + Rôles + Kiosk
- S8 : Board DnD + Réconciliation PIN + GPS Leaflet + Wizard 4-steps + QR

## Credentials
- Admin `aouattaraesca@gmail.com` / `Admin123!` · PIN 1234
- Manager `manager.cocody@dinastore.ci` / `Manager123!` · PIN 2222
- Rider `rider1@dinastore.ci` / `Rider123!` · PIN 5555
- Cliente démo `+225 07 60 17 28 21` · code `142085`

## Backlog
### P0
- UI admin pour welcome_popup/announcement/lookbook/trust_band
- "Commander sur WhatsApp" sur Product.jsx (endpoint prêt)
- Favoris merge au login
### P1
- Mega-menu desktop sous-catégories
- Bottom sheet filtres mobile pour Catalog
- Service worker PWA + background sync réel
- QR scanner caméra rider (html5-qrcode)
### P2
- Multi-store réel, Dina IA rédige diffusions WA
