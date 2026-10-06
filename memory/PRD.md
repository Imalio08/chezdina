# Chez Dina — PRD

## Credentials
- Admin: `aouattaraesca@gmail.com` / `Admin123!` · PIN 1234
- Manager: `manager.cocody@dinastore.ci` / `Manager123!` · PIN 2222
- Rider: `rider1@dinastore.ci` / `Rider123!` · PIN 5555

## Fix pack 7 Vague A (Feb 2026) — Dashboard refonte

### Backend
- `/api/dashboard/kpis` enrichi :
  - `generated_at` pour label "Chiffres au X (il y a Y min)"
  - `cancel_rate` et `cancelled` séparés
  - `deferred` (reportées)
  - `margin` basé sur **CA - COGS** (coût marchandises) au lieu de CA - dépenses
  - `by_category` : agrégation par catégorie {revenue, orders, items, avg_basket, margin, margin_pct, delta_pct} triée par CA
  - `sales_series` enrichi avec `delivered`, `cancelled`, `deferred`, `margin` par jour

### Frontend (Dashboard.jsx reconstruit)
- Header avec dernière mise à jour "il y a X min" + bouton Actualiser animé + PeriodSelector
- Row 1 : ActionItems (existant)
- Row 2 Ventes : 6 KPIs (CA, Commandes, Articles, Panier moyen, **Marge brute**, Taux d'annulation) — l'espace vide à côté de Marge brute est maintenant comblé
- Row 3 Par catégorie : tableau compact (catégorie, CA, commandes, articles, panier, marge FCFA+%, évolution %) + lien "Voir dans les statistiques →"
- Charts : CA & marge quotidiens (AreaChart Recharts) + Statuts quotidiens (LineChart Recharts avec 4 lignes : passées/livrées/annulées/reportées)
- Ventes par canal (PieChart) + Top 5 produits avec "Voir plus →" vers Statistiques
- Accès rapides (drill-downs existants)
- Toutes les comparaisons labelisées "vs X" dynamiquement

### Testé
- Backend : revenue 9.9M, cancel_rate 1.9%, margin 5M (CA-COGS), by_category 9 catégories, series avec statuts ✅
- Frontend : Dashboard rendu avec 6 KPIs + table catégories + 2 charts avec données ✅

## Fix pack 6 (Vagues A + B) — Clients + Messagerie + Segments + Campagnes + Promotions renommables
Toutes les features livrées.

## Backlog
- **Pack 7 Vague B** : Statistiques (12 onglets)
- **Pack 7 Vague C** : Finances (Dépenses enrichies + Encaissements + P&L complet)
- Pack 8 Vitrine CMS, Pack 9 Finitions

## Dépendances
- xlsx@0.18.5 (Excel export) · jspdf · recharts · leaflet
