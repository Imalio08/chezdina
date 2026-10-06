# Chez Dina — PRD

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

## Backlog
- Pack 8 Vitrine CMS
- Pack 9 Finitions
- Refactor `server.py` monolith (4879 lignes)
