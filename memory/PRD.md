# Chez Dina — PRD

## Original Problem Statement
Women's fashion boutique retail OS in Abidjan: POS, Deliveries (Rider App), E-commerce Storefront, Catalog, Customers, Finances. Language FR only. Amounts FCFA.

## Credentials
- Admin: `aouattaraesca@gmail.com` / `Admin123!` · PIN 1234
- Manager: `manager.cocody@dinastore.ci` / `Manager123!` · PIN 2222
- Rider: `rider1@dinastore.ci` / `Rider123!` · PIN 5555

## Fix pack 6 Vague B (Feb 2026) — Segments + Campagnes + Promotions renommables

### Backend
- Segments CRUD : `/api/segments` (list/create/update/delete) + `/api/segments/{id}/customers`. Modes `manual` (customer_ids) / `auto` (rules: zone, tier, status, source, size, category, total_spent_min, last_order_days_max) / `hybrid` (règles + ajouts/exclusions). Résolution automatique quotidienne via `_resolve_segment_ids`.
- Campaigns : `/api/campaigns` CRUD + `/api/campaigns/{id}/send` (envoi WA via outbox + in-app via messagerie) + `/api/campaigns/{id}/report` (envoyés, lus, commandes, CA post-envoi). Variables `{prenom}` `{nom}` `{code}` `{reduction}`. Cibles `all` / `segments` / `ids`. Multi-canal (WhatsApp + in-app) avec respect des consentements `wa_consent` / `msg_consent`.
- Promo types renommables : `/api/promo-types` CRUD. 7 types seedés (percent, fixed, special_price, bogo, x_for_y, free_delivery, gift) tous **renommables**. Mécanique verrouillée pour les built-in. Types custom supprimables.

### Frontend
- **Segments.jsx** (`/console/segments`) : grille de segments avec count, modal création avec 3 modes (Manuel/Automatique/Hybride) et règles complètes (zone, tier, dépensé min, jours max, catégorie, taille). Page détail avec liste des clientes résolues.
- **Campagnes.jsx** (`/console/campagnes`) : table avec stats colonnes (cibles, envoyés, lus, CA), modal création wizard (canaux WA+inapp, cibles 3 modes, message avec variables, offre promo optionnelle, planification), rapport détaillé avec KPIs (taux ouverture, conversion, CA).
- **Promotions.jsx** mis à jour : bouton "Types" ouvrant modal de gestion où la propriétaire renomme chaque type (ex "2 pour 1" → "Le deuxième offert") et crée ses propres types. Le select du formulaire utilise désormais `/api/promo-types`.
- Sidebar : "Campagnes WhatsApp" → "Campagnes" pointant vers `/console/campagnes`.

## Pack 6 Vague A — Clients enrichis + Messagerie in-app
Code temporaire + Customers 7 tabs + CustomerDetail full-page 15 onglets + Messagerie inbox + broadcast.

## Backlog
- Avis clients modération + KPIs (demo)
- Fidélité/Parrainage : format code activation + validité
- Push notifications Service Worker
- Pack 7/8/9 : Statistiques, Vitrine CMS, Finitions + refactor server.py (~4400 lignes)
