# Chez Dina — PRD

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
