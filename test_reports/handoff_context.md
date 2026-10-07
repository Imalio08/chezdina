# Context for testing agent — Rider CMS + 100 products + logo propagation

## Changes made (Feb 2026)
1. **New backend router**: `/app/backend/routers/rider_cms.py`
   - GET `/api/public/rider-cms` (public, consumed by RiderShell)
   - GET `/api/rider-cms` (auth)
   - PATCH `/api/rider-cms` (admin/manager)
   - POST `/api/rider-cms/reset` (admin)
   - Stored under `db.site_settings.rider_cms`.

2. **Settings.jsx (console)**: New tab "App Livreur" (id `rider-app`) between Pointage and Sécurité.
   - Owner can edit: logo rider, primary/accent colors (color pickers), greeting + subtitle (with `{name}` / `{brand}` placeholders), announcement banner (enabled, text, variant: info/success/warning/danger), help modal (enabled, title, content), tabs (reorder with up/down arrows, rename, change icon, toggle visible, add custom tabs with URL, delete non-builtin). Save broadcasts `rider-cms-changed` event.

3. **RiderShell.jsx**: Consumes `/public/rider-cms`:
   - Uses `--rider-primary` / `--rider-accent` CSS variables for colors (bg, punch button text, active tab color).
   - Greeting/subtitle substitute `{name}` and `{brand}`.
   - Dynamic bottom nav from tabs config (filters out visible=false, uses external `<a>` for URLs starting with http(s)://).
   - Announcement banner (dismissible per-livreur via localStorage, 4 variants with distinct colors).
   - Help button in topbar opens modal with configurable title/content.
   - Logo CMS overrides site.logo if set.

4. **Expanded catalog**: `/app/backend/routers/admin.py` — `/api/admin/reseed-women-fashion` now seeds exactly 100 products across 3 universes (Chaussures 37, Sacs 27, Vêtements 36). All 100 images are unique Unsplash photo IDs (verified: 100 unique / 100).

5. **Logo propagation**: Replaced "CD" hard-coded fallback with brand initials fallback + real logo rendering in:
   - `/app/frontend/src/pages/Login.jsx` (desktop collage + mobile header)
   - `/app/frontend/src/pages/console/Invoicing.jsx` (invoice preview header)
   - `/app/frontend/src/pages/console/POS.jsx` (receipt header)
   - `/app/frontend/src/pages/storefront/SharedCart.jsx` (shared cart header)
   - `BrandingBootstrapper` already propagates to favicon + document.title.

## Test credentials
- Super Admin: `aouattaraesca@gmail.com` / `Admin123!` (PIN 1234)
- Gérante: `manager.cocody@dinastore.ci` / `Manager123!`
- Livreur: `rider1@dinastore.ci` / `Rider123!`

## Previous test reports: /app/test_reports/iteration_42.json – iteration_50.json
