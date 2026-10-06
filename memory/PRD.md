# Chez Dina — PRD

## Problem Statement
**Chez Dina** — all-in-one retail OS pour une boutique femme à Abidjan (Cocody Angré 7e). Français uniquement, FCFA (XOF). TikTok @dinoush04 · WhatsApp +225 07 77 92 61 79.

## Session 11 (Feb 7 2026) — Consolidation Section 5-11 + Rebrand + CMS

### Rebrand & nettoyage login
- "Chez Dina Boutique." → "Chez Dina." dans tous les templates WhatsApp automatiques
- Sous-titre Login : "boutique · Abidjan" → "Abidjan"
- PIN démo retiré de la page de connexion (envoyés dans le chat agent uniquement)

### Nouveaux modules Console (ex-placeholders → fonctionnels)
- **`/console/sessions-caisse` (`CashSessions.jsx`)** : ouverture avec fond initial, clôture avec PIN gérante, calcul auto `expected = fond + ventes_cash + ins − outs` et écart ± affiché en vert/rouge
- **`/console/pages` + `/console/menus` + `/console/seo` (`CmsPages.jsx`)** : CRUD complet des pages À propos / Livraison / CGV / FAQ + pages custom. Chaque page : titre, contenu, SEO title+description, toggle visibilité, bouton Prévisualiser (/boutique/page/:slug)
- **`/console/marques` + `/console/categories` (`BrandsCategories.jsx`)** : liste dérivée des produits + overrides stockés, création/suppression, compte de produits par item
- **`/console/encaissements` (`Encaissements.jsx`)** : KPIs total/commandes/panier moyen + pie chart par mode de paiement + bar chart quotidien + détail par mode (ventes 7/30/90 jours)
- **`/console/resultat` (`ProfitLoss.jsx`)** : compte de résultat FR complet · CA − COGS = Marge brute, Dépenses par catégorie, Résultat net avec marges %
- **`/console/checklist` (`AcceptanceChecklist.jsx`)** : 16 tests automatiques (orders, customers, products, zones, sections, pages, loyalty, roles, WA outbox, cash, brands, suppliers, team, attendance, promotions, integrations) avec score % live
- **`/console/integrations` refondu (`Integrations.jsx`)** : WhatsApp Meta (token + phone_id), Pixels Meta/TikTok, imprimante Wi-Fi ESC/POS (IP + port). Toggle "messages auto". Token masqué en lecture.

### Routes placeholder → vraies pages
- `/console/livreurs`, `/console/zones`, `/console/journees-livraison` → `Deliveries.jsx` (5 onglets existants)
- `/console/fournisseurs` → `Purchases.jsx`
- `/console/liste-attente`, `/console/paniers-abandonnes` → `AlertsAndCarts.jsx`
- `/console/employes` → `Team.jsx`

### Nouveaux endpoints backend
- CMS: `GET /public/pages`, `GET /public/pages/{slug}`, `GET/POST/PATCH/DELETE /pages`
- Référentiels: `GET/POST/DELETE /brands`, `GET/POST/DELETE /categories`
- Caisse: `GET /cash-sessions`, `POST /cash-sessions/open`, `POST /cash-sessions/{id}/close` (PIN gérante requis)
- Finances: `GET /encaissements?days=N`, `GET /profit-loss?days=N`
- Intégrations: `GET /integrations` (secrets masqués), `PATCH /integrations`

### Collections DB ajoutées
`cms_pages`, `brands`, `categories`, `cash_sessions`. Les intégrations sont stockées sous `site_settings.integrations`.

### Testing manuel (curl)
- 4 pages par défaut créées à la 1ère lecture `/pages` ✅
- 10 marques + 8 catégories dérivées des produits ✅
- Encaissements 7j : 869 000 FCFA sur 3 modes ✅
- P&L 30j : CA 5 203 500 · Net 1 989 612 ✅
- Cash open 50 000 → close 65 000 avec PIN 1234 → écart +15 000 ✅

### Non livré dans cette session (deferred)
- Section 11 full : connect UI Meta Business Embedded Signup réel (actuellement champs manuels)
- Scheduler panier abandonné auto après 24h
- Export factures bulk ZIP
- PWA offline + service worker POS
- Rate limiting kiosk/login-code

## Sessions précédentes
- S10 : CMS Vitrine SectionBuilder + Compte Cliente code secret 6 chiffres
- S9 : WhatsApp auto + Fidélité + Parrainage + Rôles & Pointage kiosk
- S8 : Board DnD livraisons + réconciliation PIN + GPS Leaflet + Wizard Approvisionnements 4-steps + QR variantes
- S1-7 : Rebrand, Dashboard v2, POS cash control, Delivery full redesign, Catalog v2, Dina IA tool-calling

## Architecture
- Backend FastAPI `/api`, MongoDB motor, JWT staff + customer (kind="customer"), bcrypt, PIN 4 chiffres staff, access_code 6 chiffres cliente (crypto-random)
- Frontend React 19 + Router 7 + Tailwind + Shadcn + Recharts + sonner + lucide-react + react-leaflet
- Routes : `/boutique` (home dynamique + login code), `/console/*` (back-office 10 sections), `/console/livreur` (mobile rider), `/suivi/:code`, `/noter/:code`, `/login`

## Credentials
- Admin `aouattaraesca@gmail.com` / `Admin123!` · PIN 1234
- Manager `manager.cocody@dinastore.ci` / `Manager123!` · PIN 2222
- Sales `agent1@dinastore.ci` / `Agent123!` · PIN 3333
- Stock `stock@dinastore.ci` / `Stock123!` · PIN 4444
- Rider `rider1@dinastore.ci` / `Rider123!` · PIN 5555
- Cliente démo `+225 07 60 17 28 21` · code `142085`

## Backlog
### P0
- Rate limiting login-code + kiosk PIN
- Gating `/whatsapp-outbox` admin/manager/sales

### P1
- Meta Business Embedded Signup réel
- Scheduler panier abandonné auto-WhatsApp 24h
- Pixels auto-injectés sur vitrine
- Export factures ZIP

### P2
- PWA offline POS
- Multi-store réel
- Dina IA rédige les diffusions WhatsApp
