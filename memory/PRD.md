# Chez Dina — PRD

## Original Problem Statement
Women's fashion boutique retail OS in Abidjan: POS, Deliveries (Rider App), E-commerce Storefront, Catalog, Customers, Finances. Language FR only. Amounts FCFA.

## Credentials
- Admin: `aouattaraesca@gmail.com` / `Admin123!` · PIN 1234
- Manager: `manager.cocody@dinastore.ci` / `Manager123!` · PIN 2222
- Rider: `rider1@dinastore.ci` / `Rider123!` · PIN 5555

## Fix pack 5 (Feb 2026, Wave A + Wave B) — Products & Purchasing

### Wave A — Products / Brands / Categories & Collections
**Backend** (added endpoints):
- `POST /api/ai/product-description` — Claude Sonnet, FR description with tone (elegant/chic/casual/luxe/playful) and length (short/medium/long). Never commercial data. Fallback template.
- `POST /api/ai/product-seo` — JSON {seo_title ≤60, seo_description ≤160, slug}. Fallback included.
- `GET /api/brands/kpis` — total, actives, avg products/brand, top_brand, top_brand_ca, avg_margin
- `GET /api/brands/full` — list with ca_30d + avg_margin per brand
- `GET /api/brands/{bid}` — detail with products + stats
- `GET /api/categories/tree` — hierarchical with parent_id, image, order, visible, product_count
- `GET /api/categories/kpis`
- `PATCH /api/categories/{cid}` — upsert (supports derived cats from products)
- `GET /api/collections` + CRUD — manual (product_ids) or auto (rules: cat/brand/price_max) + banner + dates + visible
- `GET /api/collections/kpis`

**Frontend**:
- `ProductFormV3`: new `AiDescribeModal` with tone+length+regenerate+insert; new `SeoSection` with char counters (60/160), slug auto/edit, OG image, Google + WhatsApp preview cards; `Générer avec l'IA` button for SEO.
- `Products.jsx` KPIs: refactored to 8 compact `KpiMini` cards (actifs/inactifs/en attente/rupture/stock bas/val coût/val vente/marge moy.) — no overflow.
- `MarquesV2.jsx` (replaces Marques route): KPIs + grid/table view + brand detail page with CA 30j, marge, stock value, products.
- `CategoriesCollections.jsx` (new, replaces Marques on /categories route): 2 tabs — Catégories tree (indent, ↑↓ order, visible toggle, add sub-category) + Collections (manual/auto, banner, dates, visibility, product picker/rules).

### Wave B — Suppliers / Purchase Orders / Stock & Inventories
**Backend** (added endpoints):
- `SupplierIn` extended: trade_name, city, address, whatsapp, website, logo, manager_{name,role,phone,whatsapp}, payment_terms, lead_time_days, categories, documents, status.
- `GET /api/suppliers` — hides sensitive fields for non-admin (only owner sees phone/email/manager/etc.)
- `GET /api/suppliers/kpis` — total, actives, purchased_30d, balance, avg_lead_days
- `GET /api/suppliers/{sid}` — owner-only, with products, POs, stats
- `GET /api/purchase-orders/kpis` — this_month, total_month, pending, partial, due, avg_expected_margin
- `GET /api/purchase-orders/{pid}` — detail
- `PATCH /api/purchase-orders/{pid}/edit-guard` — enforces read-only after reception
- `POST /api/purchase-orders/{pid}/blind-receive` — receiver enters counted qty without seeing ordered; gaps logged; if no gaps, stock auto-increments
- `POST /api/purchase-orders/{pid}/validate-gaps` — owner validates, stock increments w/ counted qty
- `GET /api/stock/kpis` — value, items, ruptures, low, dormant (60d no sales), ecarts_month
- `GET /api/stock/movements` — journal from `stock_adjustments`
- `GET /api/stock/adjustment-requests` + `POST` + `POST /{aid}/decide` — manager proposes, owner approves/rejects
- `GET /api/stock/inventories` — list; non-admin don't see `qty_expected` on open inventories (blind count)
- `POST /api/stock/inventories` — create (all or picked products)
- `POST /api/stock/inventories/{iid}/count` — record counts
- `POST /api/stock/inventories/{iid}/close` — owner closes, applies gaps as stock_adjustments

**Frontend**:
- `Suppliers.jsx`: KPIs + grid/table view + supplier detail page (owner only) + full supplier form (logo, trade_name, address, phone+WA, email, website, manager+contact, payment_terms, lead_time_days, categories, notes). Non-admins see only name/country.
- `PurchaseOrders.jsx`: KPIs + Kanban (5 columns) / table toggle, create+edit form (locked after reception), detail page with export PDF (bon de commande + bon de réception) via jspdf, Excel via xlsx, QR labels print (A4 planche 3×8), **blind reception modal** (no qty_ordered shown, photos+signature+note), **validate-gaps panel** for owner.
- `StockInventories.jsx`: KPIs + 4 tabs (Stock par variante / Mouvements / Demandes d'ajustement / Inventaires). Adjust modal creates `adjustment-request` — auto-approved for owner, pending for manager. Owner approves/rejects. Blind inventory count modal; close applies gaps.

### Routing
- `/console/produits` → Products (updated KPIs)
- `/console/marques` → MarquesV2
- `/console/categories` → CategoriesCollections (new, no longer alias of Marques)
- `/console/fournisseurs` → Suppliers (own page)
- `/console/achats` → PurchaseOrders (own page)
- `/console/stock` → StockInventories

### Dependencies added
- `xlsx@0.18.5` (Excel export)

## Fix pack 4 — Delivery (3 pages: Zones/Riders/Days) + rider score detail
- Scanner retiré de l'espace Rider.
- Performance : encart « Comment est calculé votre score ? » + barres pondérées.
- DeliveryProofModal : code 4 chiffres OU photo+signature (+PIN gérante pour cmd ≥ 50 000).

## Earlier packs (1-3)
Pack 1 : nav, UI, demo. Pack 2 : roles, cash sessions, attendance geofencing. Pack 3 : POS liste, waitlist, abandoned carts, invoices PDF.

## Backlog
- Pack 6/7 : Statistiques, Marketing
- Pack 8 : Site vitrine pages/menu/SEO
- Pack 9 : Finale + optimisations
- Refactor server.py (~3900 lignes)
