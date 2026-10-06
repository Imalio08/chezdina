# Chez Dina — PRD

## Problem Statement
Chez Dina — retail OS femme Abidjan Cocody Angré 7e. Français, FCFA, Africa/Abidjan. 3 faces: Console / Rider / Storefront. TikTok @dinoush04 · WhatsApp +225 07 77 92 61 79.

## Session 14 Phase C (Feb 2026) — Finalisation Storefront + Admin Apparence

### Backend (server.py)
- **Favoris cliente** : `/public/account/favorites` (GET), `/toggle` (POST), `/merge` (POST) — persistance par cliente, enrichissement produit, union set.
- **Auto-waitlist** : lors de la création d'une commande, si le stock total du produit tombe à 0, le statut passe automatiquement à `liste_attente` (sauf si archive/inactif).
- **Notification WhatsApp liste d'attente** : helper `_notify_waitlist(product_id, size)` prêt — envoie un WA aux clientes en attente et marque notified_at.
- **Fix route shadowing** : `GET /customers/{cid}` renommée `get_customer_detail` pour ne plus écraser la dependency `get_customer` → tous les endpoints public/account retrouvent leur authentification cliente.

### Frontend
- **SiteAppearance.jsx** (nouveau) : 5 tabs (Hero/Popup bienvenue/Bandeau annonce/Lookbook/Rassurance), formulaires visuels avec `ImageUpload`, color-pickers, aperçu live du bandeau, remplace l'édition JSON manuelle.
- **FiltersSheet.jsx** (nouveau) : bottom-sheet mobile pour catalog avec pointure/couleur/talon/prix + **guide des tailles** repliable (FR/EU pour pointures + S/M/L pour vêtements), chips rapides prix (<5k, <10k, <20k, <50k).
- **Catalog.jsx** réécrit : nouvelles chips sort (nouveautés/prix/notes), bouton Filtres avec compteur, chips actives supprimables individuellement, cartes `ProductCardV2`.
- **Product.jsx** : bloc **Estimation de livraison** avec sélecteur de zone, frais et délai (via `/public/products/{pid}/delivery-estimate`). Bouton WhatsApp pré-rempli avec nom + taille + couleur + prix + zone.
- **Account.jsx** : au login, lit `localStorage.dina_favorites` et appelle `/favorites/merge` → toast "N favoris synchronisés".
- Routes App.js : `/console/apparence` → SiteAppearance (remplace SectionBuilder).

### Test backend (iteration_12 attendue)
- /public/account/favorites toggle/list/merge ✓
- auto-waitlist stock=0 ✓
- /customers/{cid} admin regression ✓

### Non livré (futur backlog)
- Flash sales live countdowns déjà présents sur Home.jsx (via `Countdown` composant) — rien à ajouter.
- Service worker PWA complet + offline sync réel rider (foundation déjà posée).
- Multi-store réel.

## Sessions précédentes
- **S14 Phase B** — Produits console v3 + Marques + Scanner QR
- **S14 Phase A** — POS Caisse v3 + fuzzy search + shared-cart + Dina IA parse
- **S13** — Storefront v3 initial + Rider offline queue
- **S12** — Rider Space v2
- **S11** — Rebrand + CMS + Caisse + P&L
- **S10** — CMS Vitrine + Compte Cliente
- **S9** — WhatsApp auto + Fidélité + Rôles + Kiosk
- **S8** — Board DnD + GPS + QR

## Credentials
- Admin `aouattaraesca@gmail.com` / `Admin123!` · PIN 1234
- Manager `manager.cocody@dinastore.ci` / `Manager123!` · PIN 2222
- Rider `rider1@dinastore.ci` / `Rider123!` · PIN 5555
- Cliente démo `+225 07 60 17 28 21` · code `142085`

## Backlog
### P1
- Service worker PWA + background sync réel rider
- Multi-store (par magasin)
- Cross-sell IA sur fiche produit
### P2
- Refactor server.py (~2900 lignes) en routers séparés
- Embeddings pour /ai/parse-order sur catalogue large
