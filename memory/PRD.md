# Chez Dina — PRD

## Credentials
- Admin: `aouattaraesca@gmail.com` / `Admin123!` · PIN 1234
- Manager: `manager.cocody@dinastore.ci` / `Manager123!` · PIN 2222
- Rider: `rider1@dinastore.ci` / `Rider123!` · PIN 5555

## Fix pack 7 Vague B (Feb 2026) — Statistiques (12 onglets)

### Backend : 11 nouveaux endpoints `/api/stats/*`
- `/stats/sales` : CA split (commandé/livré/annulé/reporté), heatmap jour×heure, by_dow, by_hour, channels, payments, sellers, cancel/defer reasons
- `/stats/products` : rankings qty/CA/marge + jamais vendus + **variant matrix** (ventes par taille × couleur, stock)
- `/stats/categories` : CA/orders/items/panier/marge%/evolution + top tailles/couleurs par catégorie
- `/stats/stock-purchases` : stock_value, rotation, ruptures, dormants, fournisseurs
- `/stats/orders-delivery` : by_status, perf riders, zones, cancel/defer reasons, fees collected
- `/stats/customers` : new/recurring/LTV/freq + **best_profile** (zones/cats/sizes/channels des TOP20)
- `/stats/demand` : waitlist agrégée par produit×variante + favorites
- `/stats/marketing` : promotions, campaigns, sources acquisition
- `/stats/site` : commandes/CA/paniers abandonnés
- `/stats/encaissements` : by_method, by_source, by_day
- `/stats/team` : vendeuses + ponctualité
- `/stats/zones` (existant) : map data

### Frontend : `Statistiques.jsx` nouvelle page
- 12 onglets avec icônes, PeriodSelector commun
- Chaque onglet avec KPIs, charts Recharts, tableau détaillé, boutons **Export CSV + Export Excel**
- Heatmap jour × heure (SVG grid rouge intensifié)
- Matrice variant taille × couleur (vendu / stock, click sur produit top → charge variant)
- Profil type des meilleures clientes (4 colonnes : zones/cats/sizes/channels)
- Route `/console/statistiques` corrigée (anciens doublons supprimés)

### Testé
- 12/12 endpoints retournent 200 avec données réelles ✅
- Smoke test : Ventes split OK (9.9M commandé, 5.3M livré, 112k annulé), heatmap visible, 7 jours colorés ✅

## Fix pack 7 Vague A — Dashboard refonte
Row 3 Par catégorie, charts statuts, Marge brute COGS, cancel_rate, "il y a X min".

## Fix pack 6 — Clients + Messagerie + Segments + Campagnes + Promotions renommables

## Backlog
- **Pack 7 Vague C** : Finances (Dépenses enrichies + Encaissements + P&L complet)
- Pack 8 Vitrine CMS, Pack 9 Finitions
