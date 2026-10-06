# Chez Dina — PRD

## P2 Livraison (Feb 2026) ✅

### Nouvelles pages / composants
- `DeliveryDays.jsx` — rewritten : KPIs 4 cartes, modal `CreateDayModal` avec sélecteur date + livreur obligatoire (plus de auto-pick premier livreur), tableau cliquable
- `DayDetail` enrichi : tab **Affectation** avec cases à cocher mobile-friendly + "Tout sélectionner" + bouton "Affecter à {rider session}" ou "Affecter à un autre livreur…" (modal `pick-rider-modal` qui call `PATCH /deliveries/{oid}/assign`); nouveau bouton **"Suggérer une répartition"** → `POST /deliveries/suggest-split` affiche panneau avec propositions zones+charge+Apply
- `LiveDeliveryMap.jsx` (new) — tab **Suivi** : carte Leaflet, pins commandes colorés par statut (prete=f4b12c, assignee=5867fd, en_livraison=0021cc, livree=1f8a4c, annulee=c62828), markers livreurs ronds rouges avec initiales + popup. Polling `/riders/locations` toutes les 15 s. Légende statique en bas.
- `Riders.jsx` → `RiderProfile` : filtre calendrier (from/to + chips 7j/30j), 4 StatMini (Total/Livrées/Annulées/CA livré), tableau historique filtré

### Backend
- `POST /api/deliveries/suggest-split` (admin/manager) : groupe par zone, round-robin biased vers livreur déjà sur la zone, équilibre la charge actuelle du jour

## P1 Sprint 2 (Feb 2026) — Préparation scan + Kiosk selfie ✅

### Nouvelles pages / composants
- `Preparation.jsx` (new, `/console/preparation`) — Liste des commandes en Nouvelle / Confirmée / En préparation avec 3 KPI cards cliquables ; vue détail PrepRunner qui scanne article par article (SKU bare ou SKU|size|color) via input focus-trap compatible douchette ; fallback "Override manuel" avec motif obligatoire (dropdown : Étiquette illisible / Code-barres endommagé / Caméra indisponible / Produit sans étiquette / Scan refusé plusieurs fois / Autre) ; bouton "Marquer comme Prête" désactivé tant que toutes les lignes ne sont pas scannées ou override ; soumission PATCH `/orders/{id}/status-v3` avec `scanned_items[]` incluant {scanned, manual, manual_reason} loggé dans audit
- `Kiosk.jsx` — rewritten avec `navigator.mediaDevices.getUserMedia` : webcam front qui s'active au mount, miroir visuel, capture 240×180 JPEG (base64) lors du punch ; fallback gracieux "Caméra indisponible" badge rouge sans crash ; dernier punch affiche le selfie
- `App.js` — route `/console/pointage` → **Kiosk** (nouveau) ; legacy Pointage (présence + géofence) déplacé en `/console/presence`
- `ConsoleLayout.jsx` — sidebar : "Pointage (kiosk)" + "Présence & géofence" (admin only) + nouvelle entrée "Préparation"

### Backend
- `AttendancePunchIn.selfie: Optional[str]` — accepte base64 data URL
- `/api/attendance/punch-kiosk` stocke le selfie dans `attendance` doc et renvoie `has_selfie`

### Testé (iteration_25)
- Backend 6/6 pytest ✅ (punch avec selfie, sans selfie, PIN invalide 403, scan incomplet 400, scan complet 200)
- Frontend Preparation 100% ✅ · Kiosk UI corrigée (route montée post-test)

## P1 Sprint 1 (Feb 2026) — Fix packs 2 & 3 ✅

### Nouvelles pages / composants
- `RolesPermissions.jsx` — matrice 4 niveaux par cellule (Aucun / Lecture / Modif. / Complet), bordure rouge sur droits sensibles, bulk par section via `<select>` par rôle, bouton "Nouveau rôle" (vierge), suppression de rôles custom
- `Approvals.jsx` (new, `/console/approbations`, owner only) — inbox unifiée approval_requests + expense_requests + stock_adjustment_requests, 3 KPI cards (pending/approved/rejected) cliquables, filtre par type, Approuver/Refuser avec commentaire
- `Audit.jsx` (new, `/console/audit`, owner only) — filtres utilisateur/action/période/recherche libre, export Excel, diff before/after dans `<details>`
- `POSSessionGuard.jsx` (new) — overlay bloquant "Ouvrez votre session de caisse pour commencer" si aucune session non closed ; bouton "Ouvrir la session" avec montant initial
- `CashSessions.jsx` — rewritten : 4 KPI cards, flow Gérante déclare versement → Owner valide (modal avec écart temps réel) → écart appliqué au solde Gérante
- `Orders.jsx` — rewritten : 9 KPI mini-cards cliquables (Nouvelles/À préparer/Prêtes/En livraison/Livrées/Annulées/Reportées/Taux/CA livré) + colonne Facture (Voir/PDF/WhatsApp) + bloc Facture dans OrderDrawer
- `POS.jsx` — exports `POS` wrappé dans `POSSessionGuard` (POSInner = ancien composant)
- `ConsoleLayout.jsx` — entrées sidebar "À approuver" + "Journal d'audit" (admin only)
- `App.js` — routes `/console/approbations` + `/console/audit`

### Testé (iteration_24)
- Backend 10/10 pytest ✅ (roles-permissions, approvals, audit-logs, cash-sessions handover+validate, manager-balance, invoices/from-order, access-control sales→403)
- Frontend 100% ✅ (8 groupes fonctionnels + 9/9 pages regression)

## P0 Stabilité (Feb 2026) — Fix pack 1 remnants ✅

### Backend
- `POST /api/pages` enforce slug uniqueness → 409 "Slug déjà utilisé" (confirmed by pytest)

### Frontend
- `/app/frontend/src/lib/format.js` : nouveau `fcfaCompact(n)` (ex. "77,4 M FCFA", "12,5 k FCFA", "2,1 Md FCFA") + `numCompact(n)`
- `KPICard.jsx` : fix NaN delta — parse `previousValue` string ou number ; handle 0/0 → flat ; prev=0 non-zero current → affiche delta absolu (plus de `+NaN%`) ; nouveau prop `valueFull` → attribut HTML `title` pour tooltip exacte sur la version compacte
- `Dashboard.jsx` : KPIs CA période, Panier moyen, Marge brute en `fcfaCompact` + `valueFull=fcfa(...)` ; empty states "Aucune donnée pour cette période" sur CA & marge, Commandes par statut, Ventes par canal, Top 5 produits
- `Statistiques.jsx` : `HeatmapCard` guard matrix undefined ; `SalesTab` défauts sur `d.split/d.by_dow/d.by_hour` ; `RankTable` empty state ; `ZonesTab` empty state et defensive loader catch
- `Orders.jsx` : data-testid `orders-view-table`, `orders-view-kanban`

### Testé (iteration_23)
- Backend 3/3 pytest (slug uniqueness) ✅
- Frontend 13/13 period presets, 12/12 stats tabs, 7/7 regression pages, ZERO TypeError, ZERO NaN ✅

## Correctif urgent (Feb 2026) — Crash "Cannot read properties of undefined (reading 'length')" ✅

Bulk-patch défensif sur tous les points qui crashaient lorsqu'un endpoint renvoyait un payload partiel :
- `Statistiques.jsx` : tous les `d.FIELD.(map|slice|length|filter)` → `(d.FIELD || []).XXX`, plus `v.sales_by_size[x]` → `(v.sales_by_size || {})[x]`, `d.best_profile.top_X` → `(d.best_profile?.top_X || [])`
- `Dashboard.jsx` : même patch sur `d.FIELD` et `k.FIELD` (notamment `k.channels.map` qui crashait)
- `Deliveries.jsx`, `MarquesV2.jsx`, `Suppliers.jsx`, `Rider.jsx`, `Statistics.jsx`, `Waitlist.jsx` : guards sur `s.orders`, `b.products`, `s.products`, `o.items`, `zones.zones`, `g.customers`
- Tests iteration_22 : frontend 100% — ZÉRO TypeError confirmé sur Dashboard, 12 onglets Statistiques, Livraisons, Marques, Fournisseurs, Liste d'attente, Rider

## Fix pack 9/9 (Feb 2026) — Manuel d'utilisation ✅


### Backend
- Collection `manual_modules` seedée au démarrage avec 16 modules complets (Prise en main → Espace livreur)
- Collection `manual_progress` par utilisateur avec `read_sections[]`
- Endpoints : GET /manual/modules (filtre `?role=`), GET /manual/modules/{n}, PATCH (admin/manager), GET+POST /manual/progress, GET /manual/search, GET /manual/module-for-path

### Frontend
- Route `/console/manuel` (Manuel.jsx) : header + barre de recherche live (debounce 200ms) + 6 filtres rôle + grid de 16 cartes modules avec progression (sections lues)
- Route `/console/manuel/:number` (ManuelModule.jsx) : TOC gauche sticky, Objectifs du module (checklist), sections numérotées, Block renderer (text/list/steps/statuses/callout/screenshot), callouts stylisés (info bleu, astuce jaune, attention rouge), "Marquer comme lu", cartes prev/next, modal édition JSON pour admin/manager
- `HelpButton.jsx` dans le header console : panneau latéral qui pop le module associé à la page courante via `/manual/module-for-path`
- `GuidedTour.jsx` : visite guidée 4-7 étapes à la première connexion, personnalisée par rôle, rejouable via `window.dispatchEvent(new Event("dina-replay-tour"))`
- Sidebar : entrée "Manuel d'utilisation" en bas avec icône GraduationCap

### Modules mappés aux pages
Dashboard→1, POS→3, Commandes→4, Livraisons→5, Produits→6, Fournisseurs→7, Stock→8, Clients→9, Promotions→10, Sessions caisse→11, Stats/Finances→12, Site→13, Équipe/Rôles/Pointage→14, Paramètres→15, Rider→16

## Fix pack 8 Vague C (correctif) + Vague D (Feb 2026) ✅


### Correctif Vague C — Hero mosaïque + Upload uniquement
- Hero : 2 colonnes verticales défilant du bas vers le haut à vitesses alternées (18 et 22 px/s), prefers-reduced-motion respecté
- Supprimé le type "Mosaïque défilante" standalone — intégré dans hero.mosaic (24 images migrées)
- Section Builder : hero + banner acceptent uniquement l'upload (plus aucun champ URL)
- Tests iteration_20 : backend 13/13, frontend 100% ✅

### Vague D — Paramètres restructurés
- `/console/parametres` : 11 onglets dans un menu latéral sticky
  1. **Identité** — Logo centralisé (utilisé console/rider/vitrine/reçus/factures), nom, slogan, description, favicon
  2. **Coordonnées** — adresse, téléphones, WhatsApp, email, horaires, RCCM/NCC
  3. **Ventes & caisse** — remise max, règle rupture, politique échange, fond caisse, motifs annulation
  4. **Livraison** — zones (link), créneaux, seuil preuve, 4 pondérations score livreur
  5. **Paiements** — 7 modes togglables, lien Wave Business, numéros Mobile Money
  6. **Documents** — pied reçu, pied facture, QR fiche colis, code-barres étiquette
  7. **Notifications** — 5 toggles WhatsApp/email
  8. **Intégrations** — link page dédiée
  9. **Équipe** — links employés/rôles/pointage
  10. **Sécurité** — PIN requis, timeout session, 2FA
  11. **Données** — export JSON, add/delete démo
- Backend : /site PATCH accepte sales/delivery/payments/documents/notifications/security


### Backend
- `/public/site` GET expose `theme`, `social`, `seo`, `menu`, `footer`, `sections`
- `/site` PATCH accepte updates partiels sur ces 5 clés
- `/pages` POST enforced slug uniqueness (409), PATCH exige page existante (404)

### Frontend — Nouvelle page `SiteVitrine` (`/console/site`)
- **5 onglets** : Apparence / Accueil / Pages & navigation / SEO & partage / Aperçu
- **Apparence** : 7 color pickers (primaire, secondaire, bouton, fond, texte, dark bg, dark text), 4 presets, contrast badges WCAG, font selector 7 polices Google (Sora, Inter, Playfair, DM Sans, Poppins, Montserrat, Cormorant), radius slider 0-24, 3 card styles
- **Accueil** : réutilise `SectionBuilder` (hero, mosaic, product_grid, banner, trust_strip, text_block, newsletter)
- **Pages & nav** : 4 sous-onglets — Pages (CRUD + éditeur plein), Menu (header), Pied de page (colonnes), Réseaux sociaux (7 réseaux, seuls les remplis apparaissent)
- **SEO** : titre/description avec compteurs, upload image partage base64, pixels FB/TikTok/GA, lien sitemap
- **Aperçu** : iframe desktop/mobile, partage lien, publier
- `useSiteTheme` hook : applique CSS vars + injecte Google Fonts sur storefront
- Footer storefront : affiche uniquement les réseaux renseignés avec icônes
- Tests iteration_19 : backend 8/8, frontend 98% ✅

## Fix pack 8 Vague B — Compte client ✅
(voir ci-dessus)

## Fix pack 8 Vague A — Storefront & mosaïque ✅
(voir ci-dessus)
- Marque "Chez Dina" nettoyée partout (plus de sous-titre "boutique")
- Barre de recherche permanente dans le header avec autosuggest (produits/catégories/marques, debounce 200ms)
- Nouvelle section `MosaicSection` (masonry 3-4 cols desktop / 2 mobile, défilement vertical continu à vitesses alternées, pause au hover, prefers-reduced-motion respecté, lien optionnel par image)
- Console `SectionBuilder` : type "mosaic" avec drag-drop upload multi-images
- Tests iteration_17 : 22/22 ✅

## Fix pack 8 Vague B (Feb 2026) — Compte client ✅
### Backend
- `/public/account/photo` upload base64
- `/public/account/update` patch (nom, email, tailles, prefs com)
- `/public/account/addresses` CRUD + default
- `/public/account/orders-split` buckets en_cours/livrees/annulees
- `/public/account/order/{code}` détail + rider info
- `/public/account/recently-viewed` GET+track
- `/public/account/reviews-pending` + `POST /reviews`
- `/public/account/vouchers`
- `/public/account/change-code` avec vérif old
- `/public/account/threads` + `thread/rider/{code}`
- `/rider/position` POST (rider only)
- `/public/order/{code}/rider-position` avec simulateur (interpolation Cocody→zone sur 15 min)

### Frontend
- `CustomerContext` + `AccountShell` sur `/boutique/compte/*`
- 14 items dans le menu gauche (desktop) / liste (mobile)
- Overview : 4 cartes (Infos + photo upload, Adresse défaut, Porte-monnaie+points, Préférences)
- `OrdersPage` 2 onglets avec compteurs
- `OrderDetail` : timeline + items + Paiement + Livraison + facture
- `LiveDelivery` : carte Leaflet, polling 30s, Appeler/WhatsApp/Message in-app, placeholder si position vide
- `MessagesPage` : threads + chat polling 5s
- `ReviewsPending`, `Security` (changer code 6 chiffres), `Addresses` CRUD, `Preferences`, empty states partout
- Header storefront : greeting "Bonjour, {prénom}" + dropdown
- Tests iteration_18 : backend 16/16, frontend 90%+ (après fix simulateur+placeholder)


## Credentials
- Admin: `aouattaraesca@gmail.com` / `Admin123!` · PIN 1234
- Manager: `manager.cocody@dinastore.ci` / `Manager123!` · PIN 2222
- Rider: `rider1@dinastore.ci` / `Rider123!` · PIN 5555

## Fix pack 7 Vague C (Feb 2026) — Finances ✅

### Backend
- Modèle `ExpenseIn` enrichi : `label`, `type` (fixe/variable), `paid_at`, `receipt` (base64), `supplier`
- Modèle `ExpenseCategoryIn` + collection `expense_categories` seed de 12 catégories (Loyer, Électricité, Eau, Salaires, Transport, Marketing, Internet, Fournitures, Taxes, Emballage, Carburant livreurs, Autre)
- `GET /api/expenses` avec filtres `category`, `type`, `days` (sur paid_at), `q`
- `PATCH /api/expenses/{id}` (admin/manager)
- `POST /api/expenses/{id}/receipt` upload base64
- CRUD complet `/api/expense-categories` (list, create, patch, delete)
- Les endpoints existants `/encaissements`, `/profit-loss` sont intégrés dans la nouvelle page

### Frontend : `Finances.jsx` (route `/console/finances`)
- 4 onglets :
  1. **Dépenses** — KPIs (total, fixe, variable, #), filtres (type/catégorie/période/recherche), CRUD complet avec upload reçu (viewer modal)
  2. **Encaissements** — KPIs, pie répartition par mode, bar par jour, détail
  3. **Compte de résultat** — Breakdown P&L + waterfall + pie dépenses par cat (résultat d'exploitation, pas de taxes)
  4. **Catégories** — Ajouter / toggler fixe-variable / supprimer

### Testé (iteration_16)
- Backend 13/13 pytest green ✅
- Frontend E2E : 4 onglets + CRUD dépense + catégorie round-trip ✅
- Regression 6 routes précédentes ✅

## Fix pack 7 Vague B — Statistiques (12 onglets)
- 11 endpoints `/api/stats/*` : sales (split commandé/livré/annulé/reporté, heatmap), products (variant matrix), categories, stock-purchases, orders-delivery, customers (best_profile), demand (waitlist), marketing, site, encaissements, team, zones
- `Statistiques.jsx` : 12 onglets, PeriodSelector, Recharts, Leaflet, Export CSV/Excel, heatmap SVG, matrice variant

## Fix pack 7 Vague A — Dashboard refonte
Row 3 Par catégorie, charts statuts, Marge brute COGS, cancel_rate, "il y a X min".

## Fix pack 6 — Clients + Messagerie + Segments + Campagnes + Promotions renommables

## Backlog (priorisé après P0 Feb 2026)

### P1 — Fix packs 2 & 3 (Sprint 2 restant)
- ~~Kiosk tablette boutique : Pointage PIN+selfie~~ ✅ livré
- ~~Blind inventory & reception~~ ✅ déjà en place (audit OK)
- ~~Préparation screen : scan article par article + fallback manuel~~ ✅ livré

### P2 — Fix pack 4 (Livraison) ✅ TERMINÉ

### P3 — Fix pack 5 (Produits & achats)
- Séparer Catégories & collections de Marques ; Approvisionnements vs Fournisseurs
- Fix "Rédiger avec l'IA" + SEO
- **Variantes taille × couleur** : grille Existe/N'existe pas, POS et storefront filtrent les combinaisons réelles
- **Vidéos produit** : jusqu'à 2 par produit (MP4/MOV ≤ 60s ≤ 50 MB), no autoplay mobile

### P4 — Packs 6, 7, 8, 9
- Avis modération inbox (approuver/rejeter/répondre)
- Parrainage configurable (format code + validité)
- Web push notifications (Service Worker + VAPID .env + bannière "Installer l'application" iOS)
- Dark mode complet partout
- Logo centralisé (sidebar, rider, storefront, reçus, factures, fiches colis)
- Horaires sur contact + footer + bannière "Fermé actuellement"
- Police storefront only (console reste en Sora)
- WhatsApp outbox (préparé pour API future)
- Analytics 1st-party (events table + funnel : page_view, product_view, add_to_cart, checkout_started, order_placed, search)
- Manuel richement illustré (captures annotées SVG, GIFs placeholders, FAQ 30 Q/R, mémo A4 par rôle, glossaire)
- **Dina IA branchée sur le manuel** (recherche manuel first, réponse par étapes + lien module/étape, filtrée par rôle, questions non répondues listées pour owner)

### P5 — Dernière étape
- Refactor `server.py` en modules par domaine (auth, catalog, stock, purchases, orders, POS, cash, delivery, customers, marketing, stats, settings, storefront)

### Décisions
- ❌ Pas de badge "Déjà vu X fois" — remplacé par signaux réels (prix en baisse, plus que X en stock, retour en stock)
- ✅ WhatsApp outbox + wa.me (API Business branché plus tard)
- ✅ Analytics first-party (pas d'outil externe)
