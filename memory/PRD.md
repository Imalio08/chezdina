# Dina Store — PRD

## Problem Statement
Build Dina Store, an all-in-one retail OS for a women's fashion boutique in Abidjan, Côte d'Ivoire — one app, three faces (Console back-office, Delivery rider mobile space, public Storefront), one database, FR default, FCFA, Africa/Abidjan.

## Architecture
- Backend: FastAPI (/api), MongoDB, JWT auth (email+password + 4-digit PIN), Claude Sonnet via Emergent Universal Key for Ask Dina.
- Frontend: React 19, React Router 7, Tailwind + shadcn + Recharts + sonner + lucide-react.
- Three entrypoints: `/boutique` (public), `/console` (back-office w/ sidebar), `/console/livreur` (phone-first), `/suivi/:code` (public tracking).

## Implemented (Feb 5 2026)
- JWT auth (password + PIN quick-switch), 10 seeded accounts (admin, 2 managers, 2 sales, stock, 4 riders).
- Full seed: 2 stores (Cocody, Marcory), 120 produits, 300 customers, 260 orders over 6 months, 5 suppliers, 8 purchase orders, expenses 6 mois, 40 invoices, attendance 30 jours.
- Console modules (all navigable + data): Tableau de bord, Caisse (POS), Commandes (table + kanban), Livraisons (dispatch + perf), Produits (CRUD + variants), Stock, Achats & fournisseurs, Clients, Fidélité & parrainage, Promotions, Facturation, Dépenses & finances, Statistiques, Équipe (pointage), Ask Dina (Claude), Canaux & intégrations, Paramètres.
- Rider mobile space: 4 tabs, course detail with call/WhatsApp/map, status workflow (En route / Livrée / Échec), encaissements.
- Storefront: Home, Catalog, Product (variants, stock live), Checkout (zones + fees), Tracking page, Account placeholder.
- Design system: IBM Plex Serif + Inter, yellow #f4b12c / blue #0021cc / black #1c1c1c, 12px cards, 1px borders #ececec, FCFA formatting `25 000 FCFA`, FR UI with EN toggle, light/dark toggle, online/offline indicator.
- Offline-first state: cart + pending ops persisted to localStorage.
- Integrations: WhatsApp wa.me fallback, Wave link placeholder, Google Maps on rider, Ask Dina AI with real business context.

## Credentials (test_credentials.md)
- Admin: aouattaraesca@gmail.com / Admin123! · PIN 1234
- Manager: manager.cocody@dinastore.ci / Manager123! · PIN 2222
- Sales: agent1@dinastore.ci / Agent123! · PIN 3333
- Stock: stock@dinastore.ci / Stock123! · PIN 4444
- Rider: rider1@dinastore.ci / Rider123! · PIN 5555

## Backlog
- P1: real WhatsApp Cloud API, Wave API, ESC/POS network printing, PWA install + service worker.
- P1: Meta / TikTok Pixel + catalog feed.
- P2: Customer OTP login on storefront, back-in-stock & abandoned cart WhatsApp automation.
- P2: Full permission matrix editor UI (data model ready; defaults applied).
- P2: Supplier purchase order creation UI (listing + statuses are live).
