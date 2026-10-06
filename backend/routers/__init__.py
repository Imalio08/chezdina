"""
Chez Dina backend — modular package scaffold (P5 Refactor, incremental).

Status (Feb 2026): the historical server.py (~5500 lines) remains the entry point and
owns all route definitions. This routers package exists so that domain modules can be
extracted one-by-one WITHOUT breaking the running app. New routes may be added here;
existing routes stay in server.py until each domain is migrated and smoke-tested.

Suggested migration order (one PR per domain, no behaviour change):
    1. auth          — /auth/*
    2. catalog       — /products, /brands, /categories, /collections
    3. stock         — /stock/*, /inventories, blind reception
    4. purchases     — /purchase-orders, /suppliers
    5. orders        — /orders/*
    6. pos           — /pos/*, /cash-sessions/*
    7. delivery      — /delivery-sessions, /deliveries/*, /riders/*
    8. customers     — /customers, /segments, /loyalty, /referrals
    9. marketing     — /campaigns, /promotions, /reviews
    10. stats        — /dashboard, /stats, /statistiques, /analytics
    11. settings     — /site_settings, /roles-permissions, /audit-logs, /approvals
    12. storefront   — /public/*

Each module should export an APIRouter named `router` prefixed with `/<domain>`.
server.py will call `app.include_router(router)` after local setup.

Smoke-test checklist before merging a migration:
    - pytest -q /app/backend/tests
    - curl GET /api/<domain>/<existing-endpoint>  → same shape/status
    - frontend regression on the pages touching that domain
"""
__all__ = []
