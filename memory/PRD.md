# Chez Dina Boutique — PRD

## Problem Statement
Chez Dina Boutique — all-in-one retail OS for a women's fashion boutique in Abidjan (Cocody Angré 7e). One codebase powers three faces: **Console** back-office, **Rider** mobile delivery space, and public **Storefront**. French-first, FCFA (XOF), Africa/Abidjan. TikTok @dinoush04 · WhatsApp +225 07 77 92 61 79.

## Architecture
- **Backend**: FastAPI (`/api` prefix), MongoDB (motor async), JWT auth via httpOnly cookie + Bearer header, bcrypt hashing, 4-digit PIN quick-switch.
- **Frontend**: React 19, React Router 7, Tailwind + Shadcn + Recharts + sonner + lucide-react, Sora/IBM Plex Serif typography, red/pink theme (#b02a2a).
- **AI**: Claude Sonnet 5.5 via Emergent Universal Key — floating "Dina Assistant" widget on every Console page.
- **Routes**: `/boutique` (public storefront), `/console/*` (back-office with sidebar), `/console/livreur` (mobile rider UI), `/suivi/:code` (public order tracking), `/login`.

## Credentials (`/app/memory/test_credentials.md`)
- Admin: `aouattaraesca@gmail.com` / `Admin123!` · PIN 1234
- Manager: `manager.cocody@dinastore.ci` / `Manager123!` · PIN 2222
- Sales: `agent1@dinastore.ci` / `Agent123!` · PIN 3333
- Stock: `stock@dinastore.ci` / `Stock123!` · PIN 4444
- Rider: `rider1@dinastore.ci` / `Rider123!` · PIN 5555

## Implemented
### Back-office Console (19 modules)
- **Dashboard**: 10 KPI cards with period filter (today/7d/30d/90d/year), delta vs previous period, info tooltip, **clickable drill-down modals** (orders, new customers, delivered, pending, low-stock, expenses). Area chart CA+orders, pie chart channels, bar chart payments, top-5 products.
- **Statistics**: 6+ charts — hourly sales, revenue by category, sizes/colors, top10/worst, customers returning vs inactive, status breakdown, expenses by category.
- **POS (Caisse)**: Grid product browser with stock badges, 3 modes (Boutique/Livraison/Retrait), full customer modal (name/phone/email/address/sizes/notes), zone + address for delivery, cash/wave/COD payments, change calc, **share cart via WhatsApp link**, thermal receipt with Chez Dina logo + Sora font.
- **Orders**: Table + Kanban views, filters by status, inline order edit (items/qty/fees/discount) **until delivered**, status change buttons with **reason prompt for Annulée/Échouée/Retournée and date prompt for Reportée**.
- **Deliveries**: 4 tabs — Dispatch (assign orders to rider sessions), **Journées livreurs** (daily reconciliation: cash collected vs due, prepaid count, delivered count), Riders KPIs cards, Zones CRUD.
- **Products**: full CRUD, variant management, image URL, SKU.
- **Stock**: value at cost/retail, low-stock alerts, searchable product list, **manual stock adjustment modal** per size with +/- buttons and motif note.
- **Purchases**: supplier CRUD (name/country/phone/email/balance/notes), purchase-order creation with supplier dropdown + status.
- **Reviews**: moderation (approve/reject/delete), aggregated star rating recomputed on product.
- **Customers**: segments (Toutes/Actives/Inactives 30j/VIP/Blacklist), **CSV bulk import**, customer detail panel with top products + order history, blacklist toggle.
- **Loyalty**: tier breakdown, top ambassadors list.
- **Promotions**: full CRUD, code copy, flash flag (⚡), period, channel, usage limit, min-order, toggle active.
- **Alerts & carts**: list of back-in-stock requests → **one-click WhatsApp notify**, abandoned carts → relance with -10% code via WhatsApp.
- **Expenses**: category tracking, 6 months seeded.
- **Team**: user CRUD with role assignment, PIN & password reset.
- **Invoicing**: list, preview modal, PDF export (printable), WhatsApp share.
- **Site vitrine**, **Intégrations**, **Paramètres** split tabs.

### Floating AI Assistant
Available on **every console page** via bottom-right ⚡ button. Opens chat panel with suggested chips, context-aware answers using live DB stats (products count, revenue, top products) powered by Claude Sonnet via Emergent LLM key.

### Rider mobile space
- 4 tabs (Courses, Historique, Encaissements, Profil), course detail bottom-sheet with Call / WhatsApp / Google Maps, status workflow.

### Storefront
- **Home**: Hero mosaic with animated zoom, **flash sale countdown banner** (fetched from `/public/promotions`), featured products, trust strip.
- **Product**: image carousel, size selector showing stock-per-size + "rupture"/"X restants", color pills, star reviews, review form, **"Alertez-moi" modal** for OOS sizes (POST `/public/stock-alert`).
- **Checkout**: cart with image carousel per item, zones + delivery fee, **GPS location pin with OpenStreetMap embed**, Wave/COD payment.
- **Order tracking** at `/suivi/:code`.

### Theming / UX
- Sora (body) + IBM Plex Serif (headings) + Inter fallback.
- Red/pink palette: #b02a2a primary, #fde8e8 light, #fff5f5 soft-bg.
- Global search bar (products + orders + customers), lang toggle (fr/en), dark mode toggle (persists to localStorage + document.html class), online/offline chip, notifications dropdown bell.

## Backlog
### P1
- Replace WhatsApp wa.me placeholders with real Cloud API (business number already configured).
- Wave API real payment flow.
- Meta / TikTok Pixel + catalog feed sync.
- ESC/POS network thermal printing.
- PWA install + service worker (offline POS).

### P2
- Customer OTP login on storefront (phone-based).
- Automated abandoned-cart WhatsApp jobs (currently manual).
- Full permission matrix editor UI (data model exists).
- Multi-store inventory (stores collection ready, UI partial).
- Export invoices in bulk ZIP.
