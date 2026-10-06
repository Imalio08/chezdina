# Chez Dina — PRD

## Problem Statement
Chez Dina — retail OS femme Abidjan Cocody Angré 7e. Français, FCFA, Africa/Abidjan. 3 faces: Console / Rider / Storefront. TikTok @dinoush04 · WhatsApp +225 07 77 92 61 79.

## Session 14 (Feb 2026) — POS v3 Upgrade + Bugs Fix (Phase A)

### Backend (server.py)
- **Fuzzy search fix** : `/public/search-suggestions`, `/public/best-sellers`, `/public/lookbook` acceptent désormais produits sans champ `active` (seed historique). Les typos « chausures », « rbe », « escarpain » retournent bien des produits.
- **POS shortcuts** : `GET /api/pos/shortcuts?limit=8` → top 8 best-sellers des 7 derniers jours avec `sold_count`.
- **Shared cart** : `POST /api/pos/shared-cart` crée un panier partageable (expires 48h), `GET /api/public/shared-cart/{id}` récupère sans auth, `POST /api/public/shared-cart/{id}/confirm` crée l'ordre et décrémente le stock. Les commandes sont taguées `channel=shared_cart` + `placed_by_agent`.
- **Waitlist** : `POST /api/waitlist` (auth) & `POST /api/public/waitlist`, `GET /api/waitlist` enrichi avec product_name/image, `DELETE /api/waitlist/{wid}` marque notified.
- **AI parse-order** : `POST /api/ai/parse-order` {text} → Claude Sonnet via EMERGENT_LLM_KEY, retourne `{items, customer_hint, confidence}` avec product_id matché depuis le catalogue (≤200 produits en contexte).
- **PDF receipt data** : `GET /api/pos/pdf-receipt/{oid}` retourne {order, business} pour génération client-side.
- EMERGENT_LLM_KEY mise à jour dans `/app/backend/.env` (ancienne clé invalide).

### Frontend — POS v3 (`/app/frontend/src/pages/console/POS.jsx`)
- Grille produits **identique pour toutes les catégories** (y compris « Tous ») avec cartes complètes : image, marque, nom, prix (avec ancien prix barré + -%), stock badge, résumé variantes (`7 pointures · 3 couleurs`).
- **Raccourcis Top 8** 7 derniers jours en row horizontale (uniquement en vue « Tous »).
- **Recherche enrichie** : nom, marque, SKU, barcode, et typing d'un nombre matche les produits ayant cette taille disponible.
- Produits en **liste d'attente** affichés grisés avec overlay (non cliquables), produits inactifs masqués.
- **Tap produit** → `PosProductSheet` (nouveau) : couleur swatches + grille tailles avec stock par taille, taille sold-out → bouton liste d'attente pour la cliente rattachée.
- **Bloc client** enrichi : tier, points, wallet balance, pointure, taille, alerte blacklist.
- **« + Nouvelle cliente »** → `PosNewCustomer` (nouveau) : Prénom/Nom/Tél/WhatsApp/Email/commune/quartier/repère/zone/pointure/taille/anniversaire/source/code parrain/consentement WA. Vérification doublon téléphone.
- **Flow livraison** complet : zone (frais auto), adresse, date, créneau, instructions livreur.
- **Partager le panier** : POST shared-cart → ouvre WhatsApp pré-rempli ou copie le lien.
- **Partager produit** par WhatsApp.
- **« Coller WA »** → `PosPasteWA` (nouveau) : analyse Dina IA, remplit le panier et pré-remplit la cliente/zone/adresse.
- **Écran paiement** `PosPayment` (nouveau) : Espèces / Wave / Orange Money / MTN MoMo / Moov Money / Porte-monnaie / Points / Mixte / Paiement à la livraison. Cash avec quick buttons (exact, 10k, 20k, 50k) + rendu, Wave avec référence + bouton envoi lien WA.
- **Mobile** : panier en bottom-sheet déclenchable avec FAB flottant montrant nb articles + total.
- **PDF reçu** via jsPDF (80mm) + bouton envoi reçu WA.

### Frontend — Storefront (`/app/frontend/src/pages/storefront/SharedCart.jsx`)
- Page `/boutique/panier-partage/:id` : liste modifiable (changer qty, retirer), choix paiement (COD / Wave), confirmation → ordre créé, redirect vers suivi.

### Routes App.js ajoutées
- `/boutique/panier-partage/:id` → SharedCart.jsx

### Non livré (Phase B + C — à venir)
- **Produits tab v3** : KPI cards, Grille/Tableau toggle, filtres avancés, vue read-only, form full-page, matrice taille×couleur, Marques CRUD, liste d'attente admin, statuts avancés.
- **Scanner QR/code-barres caméra** (html5-qrcode installé mais pas câblé).
- **Marques page** CRUD complet avec logo/stats.
- **Admin CMS « Apparence »** : sous-onglets popup/bandeau/lookbook (UI au lieu de JSON).
- **Favoris merge** au login.
- **Mobile bottom-sheet filtres** catalog (pointure/couleur/talon/prix) + guide tailles.
- **Flash sales countdowns** live sur Home, boutons « Commander sur WhatsApp », estimations livraison par zone sur fiche produit.
- **Rider offline queue** sync réel (foundation posée).

## Session 13 — Storefront v3 initial + Rider offline (voir sections précédentes du PRD)
## Session 12 — Rider Space v2 (5 tabs, preuve code/photo/signature, score)
## Session 11 — Rebrand + CMS pages + Caisse + Encaissements + P&L + Marques/Catégories
## Session 10 — CMS Vitrine SectionBuilder + Compte Cliente code secret
## Session 9 — WhatsApp auto + Fidélité + Parrainage + Rôles + Kiosk
## Session 8 — Board DnD + Réconciliation PIN + GPS Leaflet + Wizard 4-steps + QR

## Credentials
- Admin `aouattaraesca@gmail.com` / `Admin123!` · PIN 1234
- Manager `manager.cocody@dinastore.ci` / `Manager123!` · PIN 2222
- Rider `rider1@dinastore.ci` / `Rider123!` · PIN 5555
- Cliente démo `+225 07 60 17 28 21` · code `142085`

## Backlog
### P0 (Phase B — prochaine itération)
- Produits tab v3 (KPI, Grille/Tableau, vue read-only, form pleine page, matrice variantes, statuts, waitlist admin)
- Marques CRUD complet
- Scanner QR caméra POS (html5-qrcode)
### P1 (Phase C)
- Admin CMS popup/bandeau/lookbook (UI)
- Favoris merge login
- Bottom-sheet filtres mobile catalog + guide tailles
- Flash sales live countdowns + estimations livraison fiche produit
- Rider offline queue sync réel
### P2
- Service worker PWA full
- Multi-store réel
