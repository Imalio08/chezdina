# Chez Dina — PRD

## Problem Statement
Chez Dina — retail OS femme Abidjan Cocody Angré 7e. Français, FCFA, Africa/Abidjan. 3 faces: Console / Rider / Storefront. TikTok @dinoush04 · WhatsApp +225 07 77 92 61 79.

## Session 14 Phase B (Feb 2026) — Produits Console v3 + Marques + Scanner QR

### Backend (server.py)
- **ProductIn** étendu avec 14 nouveaux champs Phase B (price_old, status, collections, tags, material, occasion, heel_type, care, supplier, alert_threshold, featured, is_new, seo_title, seo_description) + `location`, `season`, `promo_pct` → POST /api/products persiste maintenant tous ces champs.
- **GET /api/products/kpis** : actifs/inactifs/brouillon/liste_attente/rupture/stock_bas/valeur_vente/valeur_cout/marge_moyenne/total.
- **GET /api/products/sales-30d** : {product_id: units_sold_30d}.
- **POST /api/products/bulk-status** : {ids, status} → bulk update.
- **POST /api/products/bulk-promo** : {ids, discount_pct} → set price_old + reduce price.
- **GET /api/products/{pid}/history** : {sales, sales_total, sales_revenue, waitlist enrichi}.
- **PATCH /api/brands/{bid}** : rename cascade (produits mis à jour), 404 propre si inconnu.

### Frontend
- **Products.jsx** réécrit : 7 KPI cards (actifs/inactifs/liste d'attente/rupture/stock bas/valeur stock/marge moy.), toggle Grille/Tableau, filtres avancés (catégorie/marque/statut/stock/prix/taille/couleur/promo) avec chips, barre de recherche enrichie, sélection multiple + bulk actions (activer/désactiver/liste d'attente/archiver/promo), export CSV, cards cliquables → vue détail.
- **ProductDetailView.jsx** (nouveau) : vue read-only avec galerie, KPI prix/marge, tabs Variantes/Ventes & marge/Historique/Liste d'attente, actions rapides (Modifier/Dupliquer/Partager/Archiver/Étiquettes).
- **ProductFormV3.jsx** (nouveau) : form pleine page avec aperçu vitrine live, 8 sections (Informations/Description/Photos/Prix & marge/Variantes/Stock/Visibilité/SEO), matrice taille × couleur, bouton « Appliquer à toutes », IA description via /ai/ask, warning prix < coût, 3 boutons (Annuler / Enregistrer et créer un autre / Enregistrer).
- **Marques.jsx** (nouveau) : CRUD complet marques avec logo + stats produits, tab Catégories, formulaire modal avec ImageUpload.
- **PosScanner.jsx** (nouveau) : scanner QR/code-barres continu caméra (html5-qrcode), bip + ajout auto au panier, match SKU/barcode/id, erreur toast si inconnu.
- POS.jsx : bouton Scanner câblé.

### Test backend (iteration_11)
- 13/13 passing après fix ProductIn + bulk-promo message + brand 404.

### Non livré (Phase C)
- Favoris merge au login
- Bottom-sheet filtres mobile catalog + guide tailles
- Flash sales live countdowns + estimations livraison fiche produit
- Admin CMS « Apparence » : popup/bandeau/lookbook en UI
- Rider offline queue sync réel

## Session 14 Phase A — POS Caisse v3 (livré)
- POS.jsx réécrit (grille produits full-featured, raccourcis top 8, sheet taille × couleur, formulaire cliente complet, mode À emporter/Livraison/Retrait, partager panier, coller WA Dina IA, écran paiement 9 modes, PDF reçu, mobile bottom-sheet).
- Backend : /pos/shortcuts, /pos/shared-cart + public confirm, /waitlist, /ai/parse-order, /pos/pdf-receipt. Fuzzy search fix.
- `/boutique/panier-partage/:id` storefront page.

## Sessions précédentes
- S13 — Storefront v3 initial + Rider offline queue
- S12 — Rider Space v2 (5 tabs, preuves)
- S11 — Rebrand + CMS + Caisse + P&L
- S10 — CMS Vitrine + Compte Cliente
- S9 — WhatsApp auto + Fidélité + Rôles + Kiosk
- S8 — Board DnD + GPS + QR

## Credentials
- Admin `aouattaraesca@gmail.com` / `Admin123!` · PIN 1234
- Manager `manager.cocody@dinastore.ci` / `Manager123!` · PIN 2222
- Rider `rider1@dinastore.ci` / `Rider123!` · PIN 5555
- Cliente démo `+225 07 60 17 28 21` · code `142085`

## Backlog
### P0 (Phase C)
- Favoris merge login
- Bottom-sheet filtres mobile catalog + guide tailles
- Admin CMS popup/bandeau/lookbook UI
- Flash sales live countdowns storefront
### P1
- Rider offline queue sync réel + service worker PWA
- Scan auto-flip stock=0 → liste_attente (actuellement manuel via bulk)
- Multi-store
### P2
- Refactor server.py (2820 lignes) en routers séparés
