# Chez Dina — PRD

## Original Problem Statement
Women's fashion boutique retail OS in Abidjan: POS, Deliveries (Rider App), E-commerce Storefront, Catalog, Customers, Finances. Language FR only. Amounts FCFA.

## Credentials
- Admin: `aouattaraesca@gmail.com` / `Admin123!` · PIN 1234
- Manager: `manager.cocody@dinastore.ci` / `Manager123!` · PIN 2222
- Rider: `rider1@dinastore.ci` / `Rider123!` · PIN 5555

## Fix pack 6 Vague A (Feb 2026) — Clients enrichis + Messagerie in-app

### Backend
- `POST /api/customers/{cid}/regen-access-code` — regenerate 6-digit code + flag must_change
- `POST /api/public/account/change-code` — customer sets own code (6 digits, rejects simple sequences)
- `GET /api/messages/conversations` — list for store/rider participant with unread count
- `GET /api/messages/conversations/{id}` — fetch + mark read
- `POST /api/messages/send` — create or append conversation (boutique_cliente | boutique_livreur | cliente_livreur)
- `GET /api/public/account/messages` + `POST /api/public/account/messages/send` — customer side
- `POST /api/messages/broadcast` — target: all | segment:ID | ids
- Helper `_close_rider_customer_convs(order_id)` to auto-close cliente↔livreur on order "livree"

### Frontend
- **Customers.jsx** (rewritten) — Sora font, 7 tabs (Toutes/Actives/Inactives/Nouvelles/VIP/À risque/Liste noire), grid/table toggle, message + WhatsApp icons per row, extended form (photo, multi-addresses, sizes/colors prefs, consents, referrer code, tags, notes). Access code modal on creation with Copy + Send-WA buttons.
- **CustomerDetail.jsx** (new, full-page route /console/clients/:id) — header + 5 KPIs + 15 tabs: Aperçu/Commandes/Paiements/Favoris/Vus récemment/Souvent consultés/Paniers abandonnés/Waitlist/Fidélité/Parrainage/Avis/Messages/Adresses/Notes/Historique. Messages tab has polling 5s chat UI.
- **Messagerie.jsx** (new, /console/messagerie) — Inbox with search + 4 filters (Toutes/Clientes/Livreurs/Non lus), conversation thread, send/receive, broadcast modal (target all + validity date).
- Sidebar: "Messagerie" now points to /console/messagerie (previously /campagnes-whatsapp).

## Fix pack 5 (Feb 2026) — Products & Purchasing
*(see git log and previous CHANGELOG)* AI product desc + SEO, brands/categories/collections overhaul, suppliers (owner-only), purchase orders Kanban + blind reception + validate-gaps, stock/inventories with blind count.

## Fix pack 4 — Rider & delivery
Scanner removed, Score explanation, DeliveryProofModal (code/photo/thirdparty + PIN).

## Backlog (packs 6B/7/8/9)
- Pack 6 Vague B : Segments manuels+auto, Campagnes multi-canal avec rapport, Promotions types renommables, Avis clients modération, Fidélité/Parrainage (code activation + validité)
- Pack 7/8/9 : Statistiques, Site vitrine CMS, Finitions + refactor server.py
