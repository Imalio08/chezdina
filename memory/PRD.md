# Chez Dina — PRD

## Problem Statement
**Chez Dina** — all-in-one retail OS for a women's fashion boutique in Abidjan (Cocody Angré 7e). Single codebase powers three faces: **Console** back-office, **Rider** mobile delivery space, and public **Storefront**. **Français uniquement**, FCFA (XOF), Africa/Abidjan. TikTok @dinoush04 · WhatsApp +225 07 77 92 61 79.

## Session 2 (Feb 6 2026) — Section 2 Fondations UX
### Composants partagés créés dans `/app/frontend/src/components/shared/`
- **`PeriodSelector.jsx`** : 14 presets (Aujourd'hui, Hier, Cette semaine, Semaine dernière, 7j, 30j, Ce mois, Mois dernier, Ce trimestre, Trimestre dernier, Cette année, Année dernière, Depuis le début, Personnalisée). Dropdown avec date pickers Du/Au pour custom. Sélecteur comparaison intégré (Période précédente / Même période l'an dernier / Aucune). Helpers `resolvePeriod()` + `previousPeriod()` exportés pour calculer les bornes dates côté caller.
- **`KPICard.jsx`** : Carte avec icône dans un carré coloré, label uppercase, value très large tabular, delta auto-calculé depuis `previousValue` (sens up/down/flat avec `inverse` pour KPI où monter = mauvais comme dépenses/annulations), couleurs vert #1f8a4c / rouge #c62828 / gris, info-tooltip (hover ou tap), lien **Rapport ›** vers détail, **sparkline** area chart si tableau de points fourni, variante `hero` double-colonne pour KPI principal.
- **`ViewToggle.jsx`** : toggle Tableau/Grille/Graphique/Kanban avec icônes lucide. Hook `useStoredView(tabKey)` qui persiste le choix par onglet dans `localStorage` (`dina_view_<tab>`).
- **`FiltersPanel.jsx`** : chip "Filtres" avec badge nb actif, side-sheet qui glisse de la droite avec champs typés (select, text, number, range min/max, multi tags), chips supprimables sous la barre + "Tout effacer", **Vues enregistrées** (sauvegarde par tabKey dans `localStorage`, charger/supprimer).
- **`CreateOnFlySelect.jsx`** : select avec option `+ Ajouter …` en bas qui bascule en mode input + Enter pour créer + Escape pour annuler. Callback `onCreate(value)` pour que le parent persiste et sélectionne immédiatement sans quitter le formulaire.
- **`ImageUpload.jsx`** : drag & drop + bouton parcourir + bouton appareil photo (mobile), compression Canvas → WebP (resize 1200px, qualité adaptative pour tenir sous `maxKB`, défaut 500 Ko), grid preview avec badge "Principale" sur la première image, boutons "Principale"/supprimer au hover, mode `single` pour avatars/logos. Retourne data URLs → stockage DB simple pour le MVP, pas de backend upload.
- **`EmptyState.jsx`** : état vide standard (icône, titre, description, action), évite les 0 et messages d'erreur quand il n'y a pas de données.

### Dashboard refondu (démo d'intégration des composants)
- Utilise **PeriodSelector** + **KPICard** (hero sur CA, sparkline sur CA et commandes).
- Header reformulé : "Chiffres au {date}, {heure} · comparaison vs les 30 jours précédents".
- Section titrée "Chiffres clés" + sous-ligne descriptive avant la grille KPI.
- Carte "Accès rapides" en bas avec chips cliquables vers les drill-downs (commandes, clientes, livrées, en cours, stock faible, dépenses).
- Modal drill-down déjà dark-mode compatible.

### Validé via Playwright
- 10 KPI cards nouvelles détectées, PeriodSelector cliquable, light + dark mode OK.
- Backend `/dashboard/kpis?period=30d` renvoie bien `revenue/prev/delta/description` + `sales_series` + `channels` + `top_products` + `payments`.

## Session 1 (Feb 6 2026)
### Rebrand & langue
- Rebrand complet "Chez Dina" partout (API title, business doc, storefront footer, login footer, invoicing header + PDF export, POS receipt, rider header). "Dina Store"/"Chez Dina Boutique" → **Chez Dina**.
- `index.html` title → "Chez Dina — Console".
- **Toggle langue retiré** du topbar (français only).
- **Store selector retiré** du topbar (single store, `store_id` reste en DB pour multi-store futur).

### Error Boundaries
- Nouveau composant `/app/frontend/src/components/ErrorBoundary.jsx` (mode page ou widget compact).
- Chaque route Console enveloppée dans `<ErrorBoundary>` dans `App.js` → un onglet qui crash affiche une carte "Oups, un problème est survenu · Réessayer / Recharger" en français avec détails techniques repliables. Le reste de l'app continue de tourner.
- Même protection sur Rider.

### P0 bugs fixés
1. **Onglets qui crashaient** → protégés par ErrorBoundary + bugs structurels corrigés en sessions précédentes (useEffect retournant Promise, rendering d'objets).
2. **Search bar** → raccourci **Ctrl+K / Cmd+K** actif, placeholder enrichi (produits/variantes/clientes/commandes).
3. **Bell notifications** → endpoint réel `/api/notifications` (session précédente).
4. **Dark mode** → polish complet (session précédente).
5. **Toggle langue** → **retiré**.
6. **AI assistant** → gestion d'erreur francisée : "Je n'arrive pas à récupérer la réponse IA pour le moment. Voici un résumé local…" (plus de `(Erreur IA : ...)` technique). Flag `error: True` renvoyé pour que le front affiche un bouton Réessayer.
7. **POS "Tous"** → grille déjà uniforme (vérifiée).
8. **Chart legends** → `wrapperStyle` déjà toujours visible dans Dashboard/Statistics (session précédente).
9. **Voir détails** → drill-down vers onglets filtrés (session précédente).
10. **Rider** → "Dina Livraison" → "Chez Dina · Livreurs". Flow stable.

### Labels paiement humanisés
- "Cash", "Cash à collecter", "Cash à livrer", "À livrer" (bouton POS) → **"Paiement à la livraison"** partout (Deliveries, POS, Rider, Storefront).

## Architecture
- **Backend**: FastAPI `/api`, MongoDB motor, JWT cookie + Bearer, bcrypt, PIN 4-chiffres.
- **Frontend**: React 19, React Router 7, Tailwind + Shadcn + Recharts + sonner + lucide-react, **Sora** (body) + IBM Plex Serif (titres), palette red/pink #b02a2a.
- **AI**: Claude Sonnet 5.5 via Emergent Universal Key — floating "Dina IA" sur chaque page Console.
- **Routes**: `/boutique` (public), `/console/*` (back-office), `/console/livreur` (mobile rider), `/suivi/:code` (public tracking), `/login`.

## Credentials (`/app/memory/test_credentials.md`)
- Admin: `aouattaraesca@gmail.com` / `Admin123!` · PIN 1234
- Manager: `manager.cocody@dinastore.ci` / `Manager123!` · PIN 2222 (emails techniques conservés)
- Rider: `rider1@dinastore.ci` / `Rider123!` · PIN 5555

## Backlog (sessions suivantes)
### Session 2 — Section 2 (UX globales, fondations)
- Composants partagés : `PeriodSelector` (presets + custom range + comparison), `FiltersPanel` (side-sheet avec saved views + URL state), `KPICard` enrichi (sparkline, info tooltip, Voir détails), `ViewToggle` (Tableau/Grille/Graphique/Kanban), `CreateOnFlyDropdown`, `ImageUpload` (drag+drop, multi, WebP compression), détail page template.

### Section 3 — Navigation + Dina IA
- Sidebar refactor en sections collapsibles (10 groupes du cahier des charges).
- Topbar quick-actions "+" (Nouvelle vente, Nouvelle commande, Nouveau produit, Nouvel appro, Nouvelle dépense, Nouveau client).
- Dina IA avec **tool-calling** (get_sales, get_top_products, get_stock_alerts, …), vision multimodale (photos produits, factures fournisseurs → OCR + pré-remplissage), création catalogue/promos/affectations par langage naturel avec carte de confirmation + log + undo 10min.

### Sections 4-11 (à faire)
- Section 4 : Dashboard refondu + Statistiques (14 onglets de rapports, KPI dictionary complet avec formules).
- Section 5 : POS enrichi + Commandes avec édition complète + Factures/devis + reçu redesigné 80mm.
- Section 6 : Delivery full redesign — Journées de livraison, Réconciliation du soir, Fiches colis QR, Rider space v2.
- Section 7 : Catalogue — statuts produits, création avec variant matrix, Approvisionnements 4-steps, Fournisseurs stats, Scan barcode/QR.
- Section 8 : Clients deep + Paniers abandonnés auto + Avis + Fidélité configurable + Parrainage + Promotions avec affiches + Campagnes WhatsApp.
- Section 9 : Dépenses + Employés + Rôles & permissions matrix + Pointage kiosk.
- Section 10 : Storefront CMS + section builder + account par code secret 4-6 chiffres.
- Section 11 : Paramètres + Intégrations (WhatsApp Business Embedded Signup, Meta/TikTok Pixel, Wave, imprimante WiFi).
- Section 12 : Checklist d'acceptation.


## Problem Statement
Chez Dina Boutique — all-in-one retail OS for a women's fashion boutique in Abidjan (Cocody Angré 7e). One codebase powers three faces: **Console** back-office, **Rider** mobile delivery space, and public **Storefront**. French-first, FCFA (XOF), Africa/Abidjan. TikTok @dinoush04 · WhatsApp +225 07 77 92 61 79.

## Architecture
- **Backend**: FastAPI (`/api` prefix), MongoDB (motor async), JWT auth via httpOnly cookie + Bearer header, bcrypt hashing, 4-digit PIN quick-switch.
- **Frontend**: React 19, React Router 7, Tailwind + Shadcn + Recharts + sonner + lucide-react, Sora/IBM Plex Serif typography, red/pink theme (#b02a2a).
- **AI**: Claude Sonnet 5.5 via Emergent Universal Key — floating "Dina Assistant" widget on every Console page.
- **Routes**: `/boutique` (public storefront), `/console/*` (back-office with sidebar), `/console/livreur` (mobile rider UI), `/suivi/:code` (public order tracking), `/login`.

## Credentials (`/app/memory/test_credentials.md`)
- Admin: `aouattaraesca@gmail.com` / `Admin123!` · PIN 1234
- Manager: `manager.cocody@dinastore.ci` / `Manager123!` · PIN 2222
- Sales: `agent1@dinastore.ci` / `Agent123!` · PIN 3333
- Stock: `stock@dinastore.ci` / `Stock123!` · PIN 4444
- Rider: `rider1@dinastore.ci` / `Rider123!` · PIN 5555

## Implemented
### Back-office Console (19 modules)
- **Dashboard**: 10 KPI cards with period filter (today/7d/30d/90d/year), delta vs previous period, info tooltip, **clickable drill-down modals** (orders, new customers, delivered, pending, low-stock, expenses). Area chart CA+orders, pie chart channels, bar chart payments, top-5 products.
- **Statistics**: 6+ charts — hourly sales, revenue by category, sizes/colors, top10/worst, customers returning vs inactive, status breakdown, expenses by category.
- **POS (Caisse)**: Grid product browser with stock badges, 3 modes (Boutique/Livraison/Retrait), full customer modal (name/phone/email/address/sizes/notes), zone + address for delivery, cash/wave/COD payments, change calc, **share cart via WhatsApp link**, thermal receipt with Chez Dina logo + Sora font.
- **Orders**: Table + Kanban views, filters by status, inline order edit (items/qty/fees/discount) **until delivered**, status change buttons with **reason prompt for Annulée/Échouée/Retournée and date prompt for Reportée**.
- **Deliveries**: 4 tabs — Dispatch (assign orders to rider sessions), **Journées livreurs** (daily reconciliation: cash collected vs due, prepaid count, delivered count), Riders KPIs cards, Zones CRUD.
- **Products**: full CRUD, variant management, image URL, SKU.
- **Stock**: value at cost/retail, low-stock alerts, searchable product list, **manual stock adjustment modal** per size with +/- buttons and motif note.
- **Purchases**: supplier CRUD (name/country/phone/email/balance/notes), purchase-order creation with supplier dropdown + status.
- **Reviews**: moderation (approve/reject/delete), aggregated star rating recomputed on product.
- **Customers**: segments (Toutes/Actives/Inactives 30j/VIP/Blacklist), **CSV bulk import**, customer detail panel with top products + order history, blacklist toggle.
- **Loyalty**: tier breakdown, top ambassadors list.
- **Promotions**: full CRUD, code copy, flash flag (⚡), period, channel, usage limit, min-order, toggle active.
- **Alerts & carts**: list of back-in-stock requests → **one-click WhatsApp notify**, abandoned carts → relance with -10% code via WhatsApp.
- **Expenses**: category tracking, 6 months seeded.
- **Team**: user CRUD with role assignment, PIN & password reset.
- **Invoicing**: list, preview modal, PDF export (printable), WhatsApp share.
- **Site vitrine**, **Intégrations**, **Paramètres** split tabs.

### Floating AI Assistant
Available on **every console page** via bottom-right ⚡ button. Opens chat panel with suggested chips, context-aware answers using live DB stats (products count, revenue, top products) powered by Claude Sonnet via Emergent LLM key.

### Rider mobile space
- 4 tabs (Courses, Historique, Encaissements, Profil), course detail bottom-sheet with Call / WhatsApp / Google Maps, status workflow.

### Storefront
- **Home**: Hero mosaic with animated zoom, **flash sale countdown banner** (fetched from `/public/promotions`), featured products, trust strip.
- **Product**: image carousel, size selector showing stock-per-size + "rupture"/"X restants", color pills, star reviews, review form, **"Alertez-moi" modal** for OOS sizes (POST `/public/stock-alert`).
- **Checkout**: cart with image carousel per item, zones + delivery fee, **GPS location pin with OpenStreetMap embed**, Wave/COD payment.
- **Order tracking** at `/suivi/:code`.

### Theming / UX
- Sora (body) + IBM Plex Serif (headings) + Inter fallback.
- Red/pink palette: #b02a2a primary, #fde8e8 light, #fff5f5 soft-bg.
- Global search bar (products + orders + customers), lang toggle (fr/en), dark mode toggle (persists to localStorage + document.html class), online/offline chip, notifications dropdown bell.

## Implemented (Feb 6 2026 — this session)
### Dark Mode Polish
- All cards/tables/modals/inputs auto-recolour via `html.dark` cascade and CSS variable overrides.
- **Recharts** fully themed: grid lines, axis labels, legends and tooltips swap to dark palette (`.recharts-cartesian-grid line`, `.recharts-text`, `.recharts-tooltip-wrapper`).
- Hover states, soft-red backgrounds, text/border colour utilities (`bg-white`, `bg-[#fff5f5]`, `text-[#666]`, `border-[#ececec]`, etc.) all have dark-mode variants — no more glaring white panels at night.

### Smart Notifications (real-time, from DB)
- New backend endpoint `GET /api/notifications` aggregates in real-time from Mongo collections:
  - New orders (status=nouvelle) · Low-stock products (stock<5) · Pending reviews · Back-in-stock alerts not notified · Abandoned carts not recovered
- Each notification has `id/type/title/msg/at/link/color`; sorted newest first; capped at 30.
- Frontend bell: unread count badge (red pill), polls every 30s, click-through routes to the right tab, "Tout lu" button, read-state persisted in localStorage, time-ago formatting.

### Flash Sale Scheduler (one-tap)
- New ⚡ "Vente flash" button on Promotions page opens dedicated modal:
  - Discount slider 5–70% · Duration presets (1h/6h/24h/48h/7j) or custom datetime
  - Auto-generated code (editable), channel picker, min-order cap, live end-time preview
- Fires `POST /api/promotions` with `flash:true`, `starts_at=now`, `ends_at` computed — storefront picks it up instantly via `/public/promotions` and renders the live countdown banner.

## Backlog
### P1
- Replace WhatsApp wa.me placeholders with real Cloud API (business number already configured).
- Wave API real payment flow.
- Meta / TikTok Pixel + catalog feed sync.
- ESC/POS network thermal printing.
- PWA install + service worker (offline POS).

### P2
- Customer OTP login on storefront (phone-based).
- Automated abandoned-cart WhatsApp jobs (currently manual).
- Full permission matrix editor UI (data model exists).
- Multi-store inventory (stores collection ready, UI partial).
- Export invoices in bulk ZIP.
