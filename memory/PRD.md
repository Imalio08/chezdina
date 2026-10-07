# Chez Dina — PRD

### Vague P — Messagerie extraction + PWA icons dynamiques (Feb 2026) ✅
**Refactor P5 phase 7 : extraction du router messagerie**
- Nouveau `/app/backend/routers/messagerie.py` (328 lignes, 11 endpoints) :
  - `GET /api/public/account/threads` + `POST /api/public/account/thread/rider/{order_code}` (côté cliente)
  - `GET /api/messages/conversations` + `POST /api/messages/open` (staff)
  - `PATCH /api/messages/conversations/{id}/archive` + `/pin` + `POST /react`
  - `GET /api/messages/conversations/{id}` + `POST /api/messages/send`
  - `GET /api/public/account/messages` + `POST /api/public/account/messages/send` (cliente)
  - `POST /api/messages/broadcast` (owner/manager)
- Helpers exportés `send_message_core` et `close_rider_customer_convs` réutilisés depuis server.py (campaigns/send ligne 1976 + statut livraison).
- server.py : 5796 → 5590 lignes (−206, soit −3,5%). Total refactor P5 à date : 6827 → 5590 (−18,1%).

**PWA Logo dynamique (install icon = vrai logo)**
- Nouveau `/app/backend/routers/pwa.py` (156 lignes) utilisant Pillow 12.3 :
  - `GET /api/public/manifest.webmanifest` → JSON manifest avec nom/short_name tirés de `site_settings`+`business`, theme_color/bg_color configurables, 3 icônes pointant vers les endpoints de résize.
  - `GET /api/public/pwa-icon/{size}` → PNG 192/512/512-maskable généré à la volée depuis `site_settings.logo` (base64 data URL) via Pillow (resize LANCZOS, safe area 80% pour maskable, rounded square 22% radius sinon). Fallback : initiales du nom de marque sur fond `theme_color`.
- Service workers / navigateurs : `Cache-Control: max-age=60`. Cache-buster `?v={updated_at}` ajouté par le frontend après chaque save pour forcer le refresh.
- `/app/frontend/public/index.html` : `<link rel="manifest">` récupéré par querySelector (CRA normalise et strip l'id).
- `/app/frontend/src/components/BrandingBootstrapper.jsx` : fetch `/public/site`, swap `link[rel="manifest"].href` vers l'endpoint backend, met à jour favicon + apple-touch-icon + document.title. Écoute l'event `branding-changed` pour refresher sans recharger la page.
- `Settings.jsx IdentiteTab.save` : dispatche `window.dispatchEvent(new Event("branding-changed"))` après sauvegarde réussie.

**Tests Iter52+53 : 10/10 backend (messagerie regression + manifest + icons incl. logo utilisateur), 100% frontend (manifest href swappé sur /boutique et refresh sur upload logo). Backend reporté à 100%.**


### Vague O — Rider CMS + Catalog 100 SKUs + Logo partout (Feb 2026) ✅
**Rider CMS complet (console → app livreur temps réel)**
- Nouveau router `/app/backend/routers/rider_cms.py` (85 lignes) : `GET /api/public/rider-cms` (public), `GET /api/rider-cms` (auth), `PATCH /api/rider-cms` (admin/manager), `POST /api/rider-cms/reset` (admin). Stocké sous `db.site_settings.rider_cms`. Config par défaut incluant logo, primary_color, accent_color, greeting template (`{name}` + `{brand}`), subtitle, announcement (enabled/text/variant info/success/warning/danger), help (enabled/title/content), tabs (5 par défaut : Courses/Carte/Historique/Performance/Profil).
- Nouvel onglet "App Livreur" dans `/console/parametres?tab=rider-app` (`Settings.jsx` : `RiderAppTab` component, data-testid=`settings-tab-rider-app` + `tab-rider-app`) :
  - Upload logo rider (base64), color pickers primaire + fond, placeholders explicites
  - Message d'accueil (greeting + subtitle avec substitutions `{name}` / `{brand}`)
  - Annonce avec 4 variantes stylisées
  - Modal aide intégrée (titre + contenu libre)
  - Gestion des onglets : réordonner (▲▼), renommer, changer icône (15 options lucide), masquer, ajouter des onglets personnalisés avec URL externe (ouverture nouvel onglet via `<a target=_blank>`), supprimer custom (builtins protégés)
  - Save broadcasts `rider-cms-changed` event → RiderShell refetch sans recharger la page
- `RiderShell.jsx` entièrement refactorisé (280 lignes) : consomme `/public/rider-cms`, applique les couleurs via CSS variables (`--rider-primary` / `--rider-accent`), bottom nav dynamique (grid-template-columns calculé), annonce dismissible par livreur (localStorage), bouton Aide dans topbar ouvrant une modal.

**Catalog expansion 40 → 100 SKUs**
- `/app/backend/routers/admin.py` étendu : `POST /api/admin/reseed-women-fashion` insère désormais exactement **100 produits avec 100% d'images Unsplash uniques** (vérifié 100/100 distinctes).
- Répartition : Chaussures 37 (10 talons · 8 sandales · 3 mules · 2 ballerines · 5 baskets · 4 bottes · 3 mocassins · 2 espadrilles), Sacs 27 (12 sacs à main · 6 pochettes · 3 mini sacs · 4 cabas · 2 sacs à dos), Vêtements 36 (10 robes · 7 hauts · 4 pantalons · 3 jupes · 8 pagne/wax · 4 vestes/combinaisons).
- Marques : Dina Soles / Dina Carry / Dina Dress. Prix 11 500 – 55 000 FCFA. Stocks aléatoires 3-15 par taille.

**Logo propagation globale (vrai logo écrase CD partout)**
- `BrandingBootstrapper.jsx` déjà en place : favicon dynamique + document.title.
- Login desktop collage + mobile header → initiales du `site.name` au lieu de "CD" dur, affiche `site.logo` quand uploadé.
- POS receipt (`POS.jsx` ligne 445-449) → logo biz + initiales fallback.
- Invoice preview (`Invoicing.jsx` ligne ~62) → logo biz + initiales fallback.
- Shared cart (`SharedCart.jsx` ligne 62) → fetch `/public/site`, logo + initiales fallback.

**Tests Iter51 : 8/8 backend, 100% frontend validé (data-testids présents, flux end-to-end OK, livreur voit annonce + onglet WhatsApp custom + couleur primaire personnalisée).**


### Vague N — Logo + Favicon + PWA + WhatsApp + Catalog femme (Feb 2026) ✅
**Branding & icônes PWA**
- Création `/app/frontend/public/manifest.json` (short_name, icons 192/512/512-maskable, theme_color #b02a2a, start_url /boutique, display standalone)
- Création des 3 icônes PNG (`/public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`) + favicon.ico — fond rouge Dina avec "CD" centré, générées en Python stdlib (sans dépendance externe)
- `/public/index.html` : theme_color #b02a2a, meta description FR, `<link rel="icon" id="dynamic-favicon">`, `<link rel="apple-touch-icon" id="dynamic-apple-icon">`, `<link rel="manifest">`, titre "Chez Dina — Boutique femme à Abidjan"
- Nouveau composant `/app/frontend/src/components/BrandingBootstrapper.jsx` : fetch `/api/public/site`, puis bascule `favicon.href` et `apple-touch-icon.href` sur le vrai logo marchand. Mis à jour aussi le `document.title`. Monté dans `App.js` au-dessus de `SubdomainRouter`.
- `Login.jsx` : affiche désormais `site.logo` fetched depuis `/public/site` (deux emplacements : hero gauche desktop + header mobile), avec fallback CD stylé si pas de logo

**WhatsApp**
- Confirmé que le footer storefront + bouton flottant utilisent déjà `+225 07 77 92 61 79` → `https://wa.me/2250777926179` (fallback dur dans `StorefrontLayout.jsx` + override via `site_settings.whatsapp`)

**Catalog femme (reseed)**
- Création `/app/backend/routers/admin.py` (180 lignes) : endpoint `POST /api/admin/reseed-women-fashion`
- Catalogue curé 40 produits avec **40 photos Unsplash uniques** (1 par SKU, zéro overlap) :
  - 15 chaussures femme (talons, sandales, mules, ballerines, baskets, bottes, mocassins, espadrilles)
  - 12 sacs femme (sacs à main, pochettes, cabas pagne, mini sacs, sacs à dos)
  - 13 vêtements femme (robes, blazers, chemisiers, pantalons, jupes, pagne wax moderne, boubou brodé)
- Marques dédiées : Dina Soles / Dina Carry / Dina Dress. Tailles cohérentes par catégorie (36-41, Unique, XS-XL). Mélange de promos aléatoires 0/10/15/20%.
- Vérifié : 40 images principales uniques sur 40 produits (100% distinctes).

**Refactor P5 : total à date — server.py 6827 → 5791 (-15,2%), 6 routers (meta/attendance/auth/catalog/orders/riders/admin), 21 modèles mutualisés dans models.py.**

### Vague M — Refactor P5 : extraction riders / deliveries / GPS / scoring (Feb 2026) ✅
**Tranche 5 du refactor du monolithe server.py (6076 → 5791 lignes, -285).**

- `/app/backend/models.py` étendu (202 lignes) : ajout de `AssignIn`, `SessionIn`, `ReconcileIn`, `RiderLocationIn`
- Création `/app/backend/routers/riders.py` (320 lignes, 15 endpoints) :
  - GPS : `POST /rider/position` (rider only), `POST /riders/location` (dual upsert dans `rider_locations` + `rider_positions`), `GET /riders/locations` (filtre stale >30min)
  - Scoring : `GET /riders/{rid}/score` (5 composantes pondérées + niveau Bronze→Excellence), `GET /riders/{rid}/reviews` (phones masqués), `GET /riders/{rid}/kpis`
  - Self-service livreur : `GET /riders/me/today`, `GET /riders/me/history` (phones masqués)
  - Livraisons : `GET /deliveries` (scope rider si rôle rider), `PATCH /deliveries/{oid}/assign`, `POST /deliveries/suggest-split` (algo zone-based + load-balancing)
  - Sessions quotidiennes : `POST /delivery-sessions`, `GET /delivery-sessions` (avec `total_to_collect`, `collected_total`, counts), `PATCH /{sid}/add-order`, `PATCH /{sid}/reconcile` (PIN gérante requis pour cash), `PATCH /{sid}/close`
- `server.py` modifié : imports étendus. Classes et endpoints extraits supprimés. `app.include_router(riders_router)` ajouté.
- Endpoints laissés dans server.py (couplés messagerie/notifs non extraites) : `PATCH /orders/{oid}/status`, `/orders/{oid}/deliver` (preuve livraison), `PATCH /reviews/{rid}/moderate`.
- Smoke curl parallèle : `/deliveries` → 324, `/delivery-sessions` → 6, rider1 score=76 (niveau Or), rider1 KPIs total=29 delivered=19, `/riders/me/today` counts dict OK, `/riders/location` POST OK. Regression `/orders` (587), `/attendance/me`, `/products` (120) toujours OK.

**Total refactor P5 à date :** server.py **6827 → 5791 (-1036 lignes, -15,2%)**. Modules extraits : attendance, auth, catalog, orders, riders. Modèles mutualisés : 21 classes dans `models.py`.

### Vague L — Refactor P5 : extraction orders / POS / cash-sessions (Feb 2026) ✅
**Tranche 4 du refactor du monolithe server.py (6262 → 6076 lignes, -186).**

- `/app/backend/models.py` étendu (172 lignes) : ajout de `OrderItem`, `OrderIn`, `CashSessionOpenIn`, `CashSessionCloseIn`, `PinAuthIn`, `CashMovementIn`, `HoldIn`
- `/app/backend/deps.py` étendu (124 lignes) : ajout de `gen_code()` (code commande `DN-YYMMDD-XXXX`)
- Création `/app/backend/routers/orders.py` (230 lignes, 11 endpoints) :
  - Commandes : `GET /orders`, `POST /orders` (décrément stock + auto-liste_attente), `PATCH /orders/{oid}`, `GET /orders/track/{code}` (public)
  - POS : `POST /pos/pin-authorize`, `POST /cash-movements`, `GET /cash-movements` (avec `cash_sales`, `ins`, `outs`, `expected`)
  - Holds : `POST /pos/holds`, `GET /pos/holds`, `DELETE /pos/holds/{hid}`
  - Caisse : `GET /cash-sessions`, `POST /cash-sessions/open`, `POST /cash-sessions/{sid}/close` (avec PIN gérante + calcul écart)
- `server.py` modifié : imports étendus (`gen_code`, 7 modèles). Classes et endpoints extraits supprimés. `app.include_router(orders_router)` ajouté.
- Endpoints laissés dans server.py (couplés messagerie/PDF/notifs non extraites) : `PATCH /orders/{oid}/status` (templates WhatsApp), `/orders/{oid}/deliver` (preuve livraison), `/orders/{oid}/contact-log`, `/pos/shortcuts`, `/pos/shared-cart`, `/pos/pdf-receipt`, `/cash-sessions/*/handover`, `/orders/{oid}/status-v3`, `/orders/{oid}/invoice`, `/orders/{oid}/generate-invoice`.
- Smoke curl parallèle : `/orders` → 585, `/cash-sessions` → 3, `/pos/holds` → 0, `/cash-movements` → expected 0, POS PIN 0000 → 403, PIN 1234 → 200 avec approver Aïcha Ouattara. `/products` (120), `/attendance/me`, `/auth/me` toujours OK.

**Total refactor P5 à date :** server.py **6827 → 6076 (-751 lignes, -11,0%)**. Modules extraits : attendance, auth, catalog, orders. Modèles mutualisés : 17 classes dans `models.py`.

### Vague K — Refactor P5 : extraction catalog (Feb 2026) ✅
**Tranche 3 du refactor du monolithe server.py (6548 → 6262 lignes, -286).**

- `/app/backend/models.py` étendu (117 lignes) : ajout de `SimpleNameIn`, `ProductIn`, `CategoryIn`, `CollectionIn`
- Création `/app/backend/routers/catalog.py` (300 lignes, 16 endpoints) :
  - Produits : `GET /products`, `POST /products`, `PATCH /products/{pid}`, `DELETE /products/{pid}`, `GET /public/products`
  - Marques : `GET /brands`, `POST /brands`, `PATCH /brands/{bid}` (renomme en cascade dans products), `DELETE /brands/{bid}`, `GET /brands/full` (CA 30j + marge), `GET /brands/{bid}` (détail + produits)
  - Catégories : `GET /categories`, `POST /categories`, `DELETE /categories/{cid}`, `GET /categories/tree`, `GET /categories/kpis`, `PATCH /categories/{cid}`
  - Collections : `GET /collections`, `POST /collections`, `PATCH /collections/{cid}`, `DELETE /collections/{cid}`, `GET /collections/kpis`
- `server.py` modifié :
  - Imports : `from models import ..., ProductIn, CategoryIn, CollectionIn, SimpleNameIn`
  - Classes `ProductIn`, `SimpleNameIn`, `CategoryIn`, `CollectionIn` : supprimées
  - Blocs d'endpoints extraits : supprimés (`/products` CRUD, `/brands/*`, `/categories/*`, `/collections/*`, `/public/products`)
  - Inclusion : `app.include_router(catalog_router)`
- Smoke curl parallèle : `/products` → 120, `/public/products` → 120, `/brands` → 11, `/brands/full` → 11, `/categories` → 8, `/categories/tree` → 8 racines, `/categories/kpis` → top=Accessoires (CA 2 086 000 FCFA), `/collections/kpis` → structure OK, `/auth/me` & `/attendance/me` toujours OK.

**Total refactor P5 à date :** server.py **6827 → 6262 (-565 lignes, -8,3%)**. Modules extraits : attendance, auth, catalog. Modèles mutualisés : 10 classes dans `models.py`.

### Vague J — Refactor P5 : extraction auth (Feb 2026) ✅
**Tranche 2 du refactor du monolithe server.py (6656 → 6548 lignes, -108).**

- Création `/app/backend/models.py` (52 lignes) : schémas Pydantic partagés
  - `LoginIn`, `PinIn`, `UserIn` (staff auth)
  - `CustomerIn`, `CustomerLoginIn`, `CustomerLoginCodeIn` (customer auth)
- `/app/backend/deps.py` étendu (118 lignes) :
  - `get_customer` (dép FastAPI pour clients authentifiés — JWT `customer_token`)
  - `norm_phone` (util matching téléphone sur les 8 derniers chiffres)
- Création `/app/backend/routers/auth.py` (127 lignes, 9 endpoints) :
  - Staff : `POST /auth/login`, `POST /auth/login-pin`, `GET /auth/me`, `POST /auth/logout`
  - Client : `POST /public/customer-register`, `POST /public/customer-login`, `POST /public/customer-login-code`, `POST /public/customer-logout`, `GET /public/account/me`
- `server.py` modifié :
  - Imports étendus depuis `deps` (ajout de `get_customer`, `norm_phone`) et `models` (6 classes)
  - Classes `LoginIn`/`PinIn`/`UserIn`/`CustomerIn`/`CustomerLoginIn`/`CustomerLoginCodeIn` : supprimées
  - Ancien bloc auth (lignes 258-361) : supprimé
  - Inclusion : `app.include_router(auth_router)` ajouté
- Smoke curl parallèle : login admin OK (token + user), /auth/me OK, /auth/logout OK, customer-register OK (400 correct pour compte existant), /api/products OK (120), /api/attendance/me OK.

**Total refactor P5 à date :** server.py 6827 → 6548 (-279 lignes, -4,1%). Modules extraits : attendance, auth.

### Vague I — Refactor P5 : extraction attendance (Feb 2026) ✅
**Tranche 1 du refactor du monolithe server.py (6827 → 6656 lignes).**

- Création `/app/backend/deps.py` (91 lignes) : primitives partagées
  - Motor client + db (singleton), JWT_SECRET/ALG
  - `hash_pw`, `verify_pw`, `make_token`, `make_customer_token`, `new_id`, `now_iso`, `gen_access_code`, `clean`
  - `get_user` + `require_role` (auth deps)
- Création `/app/backend/routers/attendance.py` (186 lignes, 9 endpoints) :
  - `GET /attendance/me`, `POST /attendance/check-in`, `GET /attendance/today`
  - `GET /attendance/calendar/{eid}`, `GET /attendance/stats/{eid}`, `GET /attendance/all-stats`
  - `PATCH /business/geofence`, `PATCH /business/working-hours`, `PATCH /business/attendance-config`
  - Toutes utilisent `APIRouter(prefix="/api", tags=["attendance"])` + import de `deps`
- `server.py` modifié :
  - Lignes 15-41 : importent les primitives depuis `deps.py` (plus de doublon)
  - Lignes 6271-6410 (ancien bloc attendance) : supprimées
  - Inclusion du router : `app.include_router(attendance_router)` après `app.include_router(api)`
- Tests smoke curl : tous les endpoints extraits répondent avec les mêmes shapes qu'avant. `/api/public/products` et `/api/auth/login` toujours OK.

**Prochaines tranches à faire :** auth, catalog, orders, riders, messagerie.

### Vague H — Photos robustes + Paramètres Pointage + Stats CSV/PDF (Feb 2026) ✅
**Photos (SmartImage)**
- Nouveau composant `/app/frontend/src/components/shared/SmartImage.jsx` : `<img>` avec `onError` → fallback (lettre initiale ou icône) sur gradient `#fff5f5 → #fde8e8`.
- Appliqué partout : `ProductCardV2`, `Home` (hero, catégories, lookbook, mosaic), `storefront/Product` (image principale + miniatures), `MosaicSection`, console `Products` (grid + table), `CustomerDetail` (avatar + produits favoris + listes), `Customers` (avatars table/grid), `ProductDetailView` (gallery + miniatures).
- Fini les visuels cassés : si une URL Unsplash expire ou est bloquée, un placeholder élégant s'affiche automatiquement.

**Paramètres → Pointage (nouveau tab)**
- `/console/parametres?tab=pointage` avec :
  - Toggle global « Activation du pointage » (si OFF, le bouton Pointer disparaît pour tout le monde)
  - Par rôle (`manager`, `sales`, `stock_keeper`, `community_manager`, `rider`) : toggle d'autorisation + horaires (ouverture, fermeture, tolérance min de retard)
- Backend : nouvelle route `PATCH /api/business/attendance-config` (admin). Les boutons Pointer dans ConsoleLayout + RiderShell lisent cette config et se cachent selon le rôle.

**Historique pointages (/console/presence)**
- Refonte complète en table des stats par employé : jours travaillés, absences, retards, minutes de retard, heure moyenne d'arrivée, ponctualité %.
- Sélecteur de période : 7, 30, 60, 90 jours.
- **Export CSV** (UTF-8 BOM pour Excel) via `data-testid='export-csv'`.
- **Export PDF** via jsPDF (A4 paysage, logo + totaux agrégés) via `data-testid='export-pdf'`.
- Backend : nouvelle route `GET /api/attendance/all-stats?days=N` (admin + manager).
- Drill-down par employé conservé (calendrier mensuel + KPI).

**P0 Refactor server.py — en attente**
- Le monolithe reste à découper. Les ajouts d'endpoints restent inline en attendant la prochaine itération refactor.

### Vague G — Pointage selfie-only + RBAC par rôle (Feb 2026) ✅
**Pointage simplifié**
- `/api/attendance/check-in` ne demande plus de GPS/géofence : seul le selfie est requis (`method=phone`). Les champs `lat/lng/distance_m/outside` sont enregistrés à `null`.
- Nouveau composant partagé `AttendancePunchModal.jsx` : selfie seul, boutons Arrivée/Départ (désactivés selon statut du jour via `GET /attendance/me`).
- Bouton `topbar-punch` ajouté dans `ConsoleLayout` (visible pour tous les rôles authentifiés), avec badge "Pointer" / "Pointé" / "Terminé" selon statut.
- Bouton `rider-punch-btn` dans `RiderShell` ; **plus de `CheckInGate` bloquant** : le livreur accède à l'app immédiatement et pointe quand il veut.
- Le tracking GPS live des livreurs reste actif (séparé du pointage).
- Historique pointages : page `/console/presence` renommée "Historique pointages" (accès admin + manager).

**RBAC**
- Nouveau rôle `community_manager` seedé idempotemment (compte `cm@dinastore.ci / Cm123!`, PIN `6666`).
- Nouveau module `/app/frontend/src/lib/rbac.js` : map `PATH_ROLES` (path → rôles autorisés) + `canAccess(role, pathname)` (longest-prefix match) + `landingFor(role)`.
- `ConsoleLayout` filtre la sidebar via `canAccess` ET redirige par `useEffect` quand l'utilisateur essaie un path interdit (direct URL).
- Matrice livrée :
  - **admin** : accès total (bypass dans `canAccess`)
  - **manager** : POS, catalogue complet, livraisons, clients, marketing, finances, statistiques, pointage équipe
  - **sales** : POS, commandes, préparation, clients, messagerie, pointage perso
  - **stock_keeper** : produits, marques, catégories, fournisseurs, achats, stock, pointage perso
  - **community_manager** : site vitrine, messagerie, segments/campagnes, promotions, fidélité, parrainage, avis, statistiques, pointage perso
  - **rider** : app livreur uniquement (route `/rider`)
- Testing agent iter 42 → bug prefix-match détecté → iter 43 : fix (sort keys longest-first) + NFD unicode slug → **100% PASS** sur toute la matrice (sidebar filtrée, direct-URL guard, punch modals Rider+Console).

### Vague F — Multi-domaines + Branding + GPS Heading + Wave Webhook (Feb 2026) ✅

**Multi-domaines SPA**
- `SubdomainRouter.jsx` : détecte l'hôte au premier mount, redirige automatiquement :
  - `console.chezdina.net` → `/console`
  - `livreur.chezdina.net` (ou `rider.chezdina.net`) → `/rider`
  - `www.chezdina.net` / `chezdina.net` → `/boutique`
- Fonctionne également pour les TLD `.ci` et `.com`
- **Configuration DNS requise** : ajouter 3 CNAME chez le registrar vers le même déploiement — toute la logique est côté frontend, aucun routing serveur à toucher

**Logos de marque**
- `BrandIcons.jsx` : composants React SVG fidèles pour Facebook (bleu #1877F2), WhatsApp Business (vert #25D366), TikTok (noir + cyan #25F4EE + rose #FE2C55)
- Footer vitrine : 3 logos de marque remplacent les icônes Lucide génériques
- **Bouton WhatsApp flottant** vitrine : utilise désormais le logo WhatsApp Business (sur fond blanc, plus pro) au lieu de l'icône `MessageCircle`

**Rider GPS Heading + Battery mode**
- `RiderShell.jsx` écoute `deviceorientation` (iOS `webkitCompassHeading` + Android `alpha`), envoie le cap compas (0-359°) avec chaque ping
- Lit `navigator.getBattery()` : passe automatiquement de 30s à 60s de ping quand batterie < 20% et pas en charge · badge « GPS live ⚡ » dans la topbar
- Backend `RiderLocationIn` étendu avec `heading`, `speed`, `battery_level`, `battery_charging`
- `/public/order/.../rider-position` retourne maintenant `heading` et `speed` pour que la flèche sur la carte client pointe la bonne direction

**Wave Webhook**
- `POST /api/public/wave/webhook` : confirme automatiquement la commande dès réception du callback de paiement Wave
- Vérification signature HMAC-SHA256 avec `wave_webhook_secret` (configurable dans Paramètres → Paiements ou via env `WAVE_WEBHOOK_SECRET`)
- Idempotent : skip si `transaction_id` déjà traité
- Détecte paiement total vs acompte selon montant · met à jour `status` (`payee` ou `confirmee`), `payment_status`, timeline

### Vague E.3 — Code quality cleanup (Feb 2026) ✅
Appliqué à partir du rapport de revue de code (deployment-ready) :
- **9 vrais correctifs** dans `server.py` : 3 variables locales inutilisées supprimées (`oid` dans `_simulated_rider_position`, `cod_delivered` dans `rider_score`, `total_qty` dans `receive_po`), 3 imports datetime dupliqués retirés (déjà présents au niveau module), 2 f-strings sans placeholders corrigées, 1 variable d'exception inutilisée (`as e`)
- **Pyflakes propre** : 0 warning après cleanup
- **Faux positifs identifiés** (non modifiés) :
  - « Hardcoded secrets » dans `tests/` : fixtures de test intentionnelles avec fallback `os.environ.get("REACT_APP_BACKEND_URL")` et credentials démo documentés dans `test_credentials.md`
  - « 115 instances `is True`/`is False` » dans les tests : fonctionne correctement en Python car `True`/`False`/`None` sont des singletons garantis
  - « 45 instances `random` » : utilisées uniquement dans le seed de démo pour générer des noms/dates/prix d'exemple, aucun usage sécuritaire (pas de PIN/token/password)
  - Complexité `send_message`/`stock_kpis`/`rider_score` et 50 imports : refactoring déjà au backlog (`server.py` → `routers/`)

### Vague E.2 — Rider GPS Live (Feb 2026) ✅
**Objectif** : supprimer le chemin simulé en captant la position réelle du livreur toutes les 30 s.

- **RiderShell.jsx** : hybride `watchPosition` (changements de position live) + `setInterval(30000)` (heartbeat garanti même si le livreur est immobile) · envoi vers `/riders/location` · fallback `getCurrentPosition` si pas encore de cache
- **Indicateur UI** dans la topbar livreur (`[data-testid=rider-gps-indicator]`) : `GPS live` (vert, avec heure du dernier envoi en tooltip) · `GPS en attente…` (orange) · `GPS refusé` (rouge, si l'utilisateur a refusé la permission)
- **Carte.jsx** : passe de `getCurrentPosition` ponctuel à `watchPosition` continu — le livreur voit sa propre position se mettre à jour en direct sur la carte
- **Backend `/riders/location`** : correction du bug critique — écrivait seulement dans `rider_locations` alors que l'endpoint public `/public/order/{code}/rider-position` lit `rider_positions` · maintenant upsert dans les 2 collections
- **Fenêtre de fraîcheur** côté public : passée de 60 s à 90 s (tolère la cadence 30 s + latence réseau)
- **Testé via curl** : push lat/lng → endpoint public retourne `simulated: false` avec les bonnes coordonnées (vérifié sur la commande live DN-260920-1032, rider Kouamé Serge)

### Vague E.1 — Clean slate pre-launch (Feb 2026) ✅
- Nouveau bouton rouge **« Vider la base avant mise en prod »** dans Paramètres → Données
- Backend `POST /api/admin/wipe-for-production` (admin only) : vide 32 collections transactionnelles (produits, commandes, clientes, livraisons, promotions, factures, bons de commande, messages, événements analytics, etc.) · conserve `users`, `business`, `site_settings`, `stores`, `zones`
- UI : modale avec saisie forcée de « VIDER » pour empêcher les clics accidentels, résumé des collections vidées affiché après confirmation, rechargement auto de la console
- Testé via curl : bon rejet si confirm ≠ "VIDER" (400 avec message FR)

## Vague E — Final Pass before Production (Feb 2026) ✅

### Responsive
- `ConsoleLayout.jsx` : hamburger menu `[data-testid=mobile-menu-toggle]` sur <lg, drawer sidebar en overlay fixe sur mobile/tablet portrait, auto-fermeture au changement de route, bouton Créer/sync/HelpButton masqués sous md pour libérer l'espace
- `POS.jsx` : grille passe de `lg:grid-cols-[1fr_min(400px,33vw)]` à `md:grid-cols-[1fr_min(360px,36vw)] lg:grid-cols-[1fr_min(400px,33vw)]` — panier + bouton Encaisser toujours visibles dès 768px (tablet portrait)
- `index.css` : wrapper responsive sur `.dina-table` (overflow-x), header title tronqué sous sm, padding card réduit sous lg
- Vitrine : header déjà `sticky top-0` + bouton WhatsApp `fixed bottom-5 right-5` toujours visible

### Storefront Footer
- Social : **Facebook + WhatsApp + TikTok uniquement** (Instagram/YouTube/LinkedIn supprimés), chaque icône pointe vers l'URL stockée dans `/business.social` avec fallback live
- Les 7 liens Boutique/Aide confirmés 200 OK (Catalogue, Nouveautés, Promotions, Guide tailles, Livraison & retours, Suivi commande, Contact)

### Mocks persistants (reportés)
- Base MongoDB : seed démo généré au startup (produits, commandes, clientes, livreurs, zones, promotions) — **comportement attendu avant mise en prod** · passer `/api/seed?force=true` pour réinitialiser
- Position GPS du livreur : `_simulated_rider_position()` interpole entre magasin et adresse de livraison tant qu'aucun ping réel n'est enregistré via `/rider/location` (prêt à recevoir des vrais GPS)
- Scores satisfaction / dernier achat : `random.uniform()` et `random.randint()` dans le seed de démo (ligne 1584, 4148, 6532)
- Wave : lien de paiement statique dans `/public/payment-config` (éditable dans Paramètres → Paiements), aucun SDK Wave intégré (webhook de confirmation à ajouter côté backend quand le compte Wave Business sera actif)
- SMS / Email : aucun provider branché · WhatsApp opère via lien `wa.me` (ouverture app, zéro coût API) · si envoi serveur requis, intégrer Resend + Twilio
- Analytics first-party : opérationnel · note "nécessite outil d'analytique" dans `/stats/site` est **obsolète** (remplacé par `/analytics/funnel`)

## Vague D — Logo partout + Analytics first-party (Feb 2026) ✅

### Logo centralisé
- `Invoicing.jsx` : facture PDF (window.open HTML) avec logo + nom boutique + téléphone/email/adresse en header, infos tirées de `/public/site` + `/public/business`
- `FichesColis.jsx` : étiquette colis affiche logo + nom boutique à côté (fallback texte si pas de logo)
- `DeliveryDays.jsx` : feuille de route livreur PDF avec logo + nom boutique en en-tête
- `PurchaseOrders.jsx` : bon de commande / bon de réception PDF avec logo + nom boutique
- `pdfReceipt.js` + `POS.jsx` : déjà en place
- `RiderShell.jsx` : déjà en place

### Analytics first-party
- Backend `/api/analytics/events` (POST) + `/api/analytics/funnel` (GET) déjà en place dans `server.py` lignes 5888-5938
- `lib/analytics.js` helper `track(name, extra)` : visitor_id (localStorage), session_id (sessionStorage), UTM, device, consentement
- Événements trackés : `page_view` (Home + Catalog), `product_view` (ProductPage), `add_to_cart` (bouton Ajouter), `checkout_started` (Checkout mount), `order_placed` (après POST /public/orders)
- Consentement implicite activé automatiquement au premier chargement de la vitrine (`dina_consent=yes` dans localStorage)
- Vue console `Statistiques > Entonnoir vitrine` : KPIs visiteurs/pages/ajouts/commandes/conversion + graphique entonnoir en 5 étapes avec taux de drop-off entre étapes

## Vague C — Polish & footer (Feb 2026) ✅
- `StorefrontLayout.jsx` footer : logo + nom « Chez Dina » affichés côte à côte (data-testid `footer-brand-name`)
- `SaveButton` component (`/components/shared/SaveButton.jsx`) : loading spinner + anti-double-clic, utilisé sur Settings (identite/coordonnees/ventes/livraison/documents/notifications/securite/paiements), SiteAppearance (hero/popup/announcement/lookbook/trust), SectionBuilder, SiteVitrine (apparence), CmsPages, Loyalty, RolesPermissions, Integrations
- GuidedTour : fermeture par touche Escape
- Toasts uniformisés : « Modifications enregistrées » / « Erreur · modifications non enregistrées »
- Backend `/pages POST` : unicité du slug déjà appliquée (409 si déjà pris)

## Vague B — UX console & vitrine (Feb 2026) ✅
- `ConsoleLayout.jsx` : sidebar redimensionnable (poignée droite 200-400 px, persistance `dina_sidebar_width`) + bouton réduction/déploiement (`sidebar-collapse-toggle`, 72 px en mode icônes seulement, persistance `dina_sidebar_collapsed`)
- `StorefrontLayout.jsx` : toggle dark mode manuel header (`storefront-theme-toggle`, soleil/lune), défaut = préférence système, persistance `dina_theme`, dark variants ajoutés header + footer + menus utilisateur + inputs
- `IconPicker` component (`/components/shared/IconPicker.jsx`) : grille visuelle de 60+ icônes Lucide avec recherche, remplace les `<select>` dans SiteAppearance (trust_band) + SectionBuilder (trust_strip)
- Fix pré-existant Checkout.jsx : wrapping Fragment pour supporter le modal acompte en frère du grid

## Vague A — Wave acompte + Footer vitrine + Nettoyage TEST (Feb 2026) ✅

### Wave + Acompte à la livraison
- Backend `site_settings.wave_payment_link` + `deposit_policy: {mode: 'none'|'pct'|'fixed', value, threshold}`
- Nouveau status commande `en_attente_acompte` (orange) avec champs `deposit_required`, `deposit_paid`, `deposit_tx_ref`, `deposit_paid_at`
- `POST /public/orders` calcule l'acompte automatiquement si COD + total ≥ threshold ; status initial = `en_attente_acompte`
- `GET /public/payment-config` expose wave_link + deposit_policy pour vitrine/POS/rider
- `POST /orders/:id/mark-deposit-paid {tx_ref}` → bascule en « Confirmée » (admin+manager)
- Checkout : panneau acompte dynamique (À payer / À régler livraison), modal post-commande avec bouton Wave + référence copiable + instructions
- Settings > Paiements : lien Wave éditable + politique acompte (none/pct/fixed/threshold) avec hints
- 💰 Testé : commande 30k FCFA en COD → acompte 9 450 FCFA (30%) automatique, mark-deposit-paid confirme en 1 clic

### Footer vitrine fonctionnel
- 6 nouvelles pages : `/boutique/nouveautes`, `/promotions`, `/guide-tailles`, `/livraison-retours`, `/suivi-commande`, `/contact`
- Suivi commande : saisie code + téléphone OU listing commandes personnelles si cliente loguée + timeline + info acompte
- Contact : WhatsApp, téléphone, adresse, horaires, carte, formulaire
- Guide tailles & Livraison : contenu CMS-éditable avec fallback statique si non défini
- Settings > Paiements : éditeur réseaux sociaux (whatsapp/tiktok/facebook/instagram) persisté dans `site.social`

### Nettoyage TEST + propagation vitrine
- `POST /startup/clean-test-data` purge les préfixes TEST_* de `business` et `site_settings`
- `/public/business` déjà en place, retourne données réelles
- Header vitrine affiche logo + « Chez Dina » à droite (desktop + mobile)
- Footer utilise `site.social` dynamique avec icônes brand officielles

### Logo header
- `StorefrontLayout.jsx` : logo image + nom boutique toujours visibles côte à côte

## Messagerie interne enrichie (Feb 2026) ✅

### Formatage riche (markdown)
- Barre d'outils : **Gras** (`fmt-bold`), *Italique* (`fmt-italic`), ~~Barré~~ (`fmt-strike`), listes (`fmt-list`)
- Rendu markdown côté client : `**gras**`, `*italique*`, `__souligné__`, `~~barré~~`, `` `code` ``, `[lien](url)`, URLs auto-liées, retours ligne, listes `-`/`•`
- Textarea avec insertion intelligente autour de la sélection

### Emojis
- Picker custom avec 5 catégories (Visages, Gestes, Cœurs, Mode, Objets)
- Barre de réactions rapides au survol (❤️ 👍 👏 😂 🔥 💯)
- Toggle réaction via `POST /messages/conversations/:id/react`

### Pièces jointes
- Upload image / vidéo / audio / PDF / docs (10 Mo max) via `fmt-attach`
- Preview inline avec icône, nom et taille, bouton retrait
- Rendu dans la bulle : image responsive, vidéo contrôlée, audio player, lien téléchargement pour fichiers
- Backend `/messages/send` étendu avec `attachments: [{type, url, name, size, mime}]` + validation stricte URL (data:image|video|audio|pdf ou http(s)), cap 10 pièces, nom <= 200 car.

### Archivage & épinglage
- `PATCH /messages/conversations/:id/archive` et `/pin` (toggle)
- Les conversations épinglées remontent en tête (tri `pinned desc, updated_at desc`)
- Bouton bascule « Voir actives / Archives (N) » dans l'en-tête
- Icônes au survol (épingler, archiver) + boutons dédiés dans l'en-tête du thread

### Deep-link & recherche
- `/console/messagerie?rider_id=X` ou `?customer_id=X` → crée/réveille via `POST /messages/open`
- `/console/messagerie?segment_id=X` → ouvre la diffusion pré-ciblée
- Recherche dans la liste (noms + contenu messages)
- Recherche dans le fil ouvert (`thread-search`)

### Testing
- `/app/backend/tests/test_messaging.py` : 5/5 pytest green (open idempotent, send+attachments, react toggle, pin toggle, archive toggle)
- Testing agent frontend : 100% des data-testid validés

## Vague 4 — Clients, messagerie & UX globale (Feb 2026) ✅

### KPI cards compactes
- `KPICard.jsx` : taille des textes et chiffres réduite (padding p-4, label text-[10px], value text-xl au lieu de text-3xl, hero text-3xl au lieu de text-5xl, delta text-xs, sparkline h-8)

### ConfirmDialog universel
- Nouveau composant `components/shared/ConfirmDialog.jsx` (ConfirmProvider + useConfirm hook)
- Monté globalement dans `App.js` autour de l'arborescence
- Remplace `window.confirm` pour les actions sensibles : blacklist/réactivation cliente, régénération code d'accès (Customers.jsx)
- Testids : `confirm-dialog`, `confirm-ok`, `confirm-cancel`

### Classement top clientes
- Nouveau endpoint `GET /api/customers/top?limit=20` (admin+manager) : rank + name + phone + tier + loyalty_points + total_spent + orders_count
- Nouveau endpoint public `GET /api/public/account/top-customers?limit=10` : version anonymisée (prénom + initiale, pas de téléphone)
- Nouvel onglet « Top clientes » dans `/console/clientes` avec podium or/argent/bronze pour les 3 premières

### Segments IA & broadcast
- Nouveau endpoint `POST /api/segments/ai {prompt, name?}` : utilise Claude Sonnet via EMERGENT_LLM_KEY pour parser une demande FR naturelle → règles de segment auto
- Nouveau modal `AISegmentModal` dans `/console/segments` (bouton `seg-ai` + modal `seg-ai-modal`) avec exemples cliquables
- Chaque segment a un bouton Megaphone (`seg-broadcast-<name>`) qui navigue vers `/console/messagerie?segment_id=X` → ouvre automatiquement le BroadcastModal pré-sélectionné
- `BroadcastModal` étendu : le `<select>` target inclut un `<optgroup>` avec tous les segments définis

### Riders — messagerie interne
- Dans `RiderProfile` : nouveau bouton « Messagerie interne » (`rider-internal-msg`) à côté de WhatsApp, navigue vers `/console/messagerie?rider_id=X`

## Vague 3 — Appros, promos & stock (Feb 2026) ✅

### Appros — Coûts additionnels dans le bon de commande
- `PurchaseOrders.jsx` PoForm : ajout d'un éditeur « Coûts additionnels » (label + amount, add/remove) directement dans la création/édition du BC
- Backend `PromoIn` schema inchangé (déjà `extra_costs: List[Dict]`), le landed cost se calcule à la réception comme prix achat + frais

### Stock — Âge et alerte immobilisation
- Nouveau endpoint `GET /api/stock/aged?days=60` → liste produits immobilisés + nombre de jours
- `GET /api/stock/kpis` renvoie désormais le champ `aged` (compteur)
- `StockInventories.jsx` : nouveau KPI « Immobilisé >60j » + colonne « Âge » dans la table (chip rouge >60j, orange >30j, vert <30j)

### Promotions — Scope & 2 pour 1 ciblés
- `PromoIn` étendu : `scope` (all/products/category), `products: List[str]`, `category`, `buy_qty`, `get_qty`, `get_discount_pct`
- `FlashLauncher` : nouveau sélecteur Périmètre (Tous / Produits ciblés / Catégorie) + picker produits + sélecteur catégorie
- `PromoForm` : même sélecteur Périmètre + bloc « Acheter N / Obtenir N / % » visible quand mécanique = bogo ou x_for_y + validation produits obligatoire
- Vente flash et « 2 pour 1 » peuvent désormais s'appliquer à 1 produit, plusieurs, une catégorie ou tout le catalogue

## Vague 2 — POS/Handover/Paniers/Liste d'attente (Feb 2026) ✅

### POS
- Grille produits moins dense (`grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4` + gap réduit) → panier et bouton « Valider » visibles sans scroll latéral/vertical

### Sessions de caisse — Rejet versement
- Nouveau endpoint `POST /api/cash-sessions/:sid/reject-handover` (admin only) : motif obligatoire (min. 5 car.), session passe en `status='rejected'`, versement vidé, Gérante notifiée
- Nouveau composant `RejectHandoverModal` + bouton `cash-reject-handover` à côté de « Valider versement »
- Nouvelle bannière rouge « Versement rejeté » affichée dans la session en cours avec motif + date
- Nouveau status badge « Rejeté » dans l'historique

### Paniers abandonnés — Offre 100% personnalisable
- Formulaire `RelaunchForm` entièrement réécrit (`AbandonedCarts.jsx`) :
  - Cible : 1 cliente / plusieurs (ticks) / toutes (3 modes avec sélecteur `rf-mode-*`)
  - Validité : 2 inputs `datetime-local` début + fin (plus de chips 24h/3j/1sem)
  - Canaux : checkboxes multi — WhatsApp, in-app, Pop-up espace cliente
  - Image : toggle Oui/Non + `ImageUpload`
  - Type d'offre : ajout « Offre personnalisée » (nom, description, valeur)

### Liste d'attente
- `Notifier` ouvre désormais `NotifyModal` (même richesse que RelaunchForm) au lieu d'envoyer automatiquement
- Endpoint `POST /api/waitlist/:wid/notify` étendu : accepte `{channels, message, offer_type, offer_value, offer_custom, image, starts_at, ends_at}`, enregistre dans `waitlist_notifications`
- Table OOC : nouvelle colonne « Source » avec chip coloré (Site vitrine / Caisse POS / Recherche sans résultat / Console admin)
- Modèle `WaitlistIn` étendu avec `source` field
- Vitrine `/boutique/catalog` : quand une recherche renvoie 0 résultat, bloc dédié permet de soumettre une demande via `/public/out-of-catalog?channel=search`

### Testing
- `/app/backend/tests/test_wave2_bugs.py` : 4/4 pytest green
- Testing agent frontend : 100% des data-testid validés

## Vague 1 bugs corrigés (Feb 2026) ✅

### 1. Fiches colis & Feuille de route (DeliveryDays)
- Avant : les 2 boutons appelaient `window.print()` directement → capture d'écran de la console
- Après : « Imprimer les fiches colis » navigue vers `/console/fiches-colis?ids=...` avec préselection, « Feuille de route livreur » génère un vrai PDF via jsPDF (nom, téléphone, adresse, montant à encaisser par commande + signature)
- Nouveau helper `printRouteSheetPDF(session, assigned)` dans `DeliveryDays.jsx`
- `FichesColis.jsx` étendu avec `useSearchParams` pour lire `?ids=`

### 2. Étiquettes QR appros (PurchaseOrders)
- Avant : QR encode `SKU|size|color` (illisible) + `window.print()` capturait toute la console (position fixed cassée en impression) + modal non monté quand la vue détail PO est ouverte (early-return cache le JSX du modal)
- Après : QR encode une URL `${origin}/scan?sku=&size=&color=&pid=` → nouveau composant `ScanRedirect.jsx` résout vers `/console/produits?highlight=` (staff) ou `/boutique/product/:id` (public)
- Nouveau helper `buildScanUrl()` ; `LabelsPrintModal` ouvre une nouvelle fenêtre `window.open()` dédiée à l'impression (ne blank plus la console)
- Fragment wrap du early-return `if (detail) return (<><PoDetail/>{labels && <LabelsPrintModal/>}</>)` → modal désormais accessible depuis la vue détail PO
- Nouvelle route `/scan` publique dans `App.js`

### 3. Code d'accès cliente (Customers)
- Avant : `regenCode` faisait `setNewCode(r.data)` directement alors que le backend renvoie `{access_code, phone, name}` → la modale affichait `data.code = undefined`, les boutons Copier et WhatsApp étaient inactifs
- Après : mapping explicite `{code: r.data.access_code, phone, name}` + dialog de confirmation avant régénération
- Message WhatsApp pré-rempli contient maintenant le code à 6 chiffres

### Testing
- `/app/backend/tests/test_wave1_bugs.py` : 7/7 pytest green (regen-access-code + no-regression /customers /products /purchase-orders /orders /delivery-sessions)
- Testing agent frontend : 100% success (iter 34)

## Manuel enrichi · captures annotées 05→16 (Feb 2026) ✅

### Extension du composant AnnotatedScreenshot
14 nouveaux écrans SVG ajoutés dans `components/manual/AnnotatedScreenshot.jsx` :
- `delivery_riders` · `delivery_zones` (module 05)
- `products_grid` · `product_variants` (module 06)
- `suppliers_po` (module 07)
- `stock_list` (module 08)
- `customers_list` (module 09)
- `promo_codes` (module 10)
- `stats_tabs` (module 11)
- `cms_pages` (module 12)
- `attendance_kiosk` (module 13)
- `settings_identity` (module 14)
- `rider_app` — mockup téléphone (module 15)
- `approvals_inbox` (module 16)

Total : 20 écrans annotés disponibles (6 initiaux + 14 nouveaux)

### Modules 05→16 réécrits en mode "rich"
`POST /api/manual/reseed` renvoie désormais `{updated: 16}` — tous les modules sont enrichis avec :
- Captures SVG annotées (cercles rouges numérotés + légendes contextuelles)
- Blocs `steps` numérotés avec étapes exploitables
- Blocs `callout` (info / tip / warning)
- Blocs `statuses` (ex: segments clientes, scores livreurs, statuts BC)
- Blocs `faq` (modules 11, 13)
- Blocs `memo` A4 imprimable (module 11 propriétaire)
- Blocs `video_placeholder` (modules 2, 6)

Chaque module couvre 2-3 sections avec en moyenne 3-4 blocs par section.

## Manuel enrichi avec captures annotées (Feb 2026) ✅

### Nouveau composant
- `components/manual/AnnotatedScreenshot.jsx` : SVG mockup des écrans console (POS panier, Commandes, Préparation scan, Journée de livraison, Dashboard, Session caisse) + overlay de callouts numérotés rouges avec labels contextuels

### Nouveaux types de blocs manuel
- `annotated` : screenshot SVG + callouts [{x,y,n,label,w?,h?}] (coordonnées en %)
- `video_placeholder` : encart pour vidéo 10–30 s à venir
- `memo` : mémo A4 imprimable par rôle (Gérante / Livreur)
- `glossary` : liste de définitions terme/définition
- `faq` : questions fréquentes dépliantes

### Backend
- `POST /api/manual/reseed` (admin only, idempotent) : écrase les 16 modules avec la version illustrée (étendu Feb 2026)
- Chaque module contient captures annotées + étapes numérotées + mémos + FAQ + glossaire

## P4 Horaires éditeur (Feb 2026) ✅

### Éditeur visuel
- Nouveau composant `OpeningHoursEditor.jsx` (7 lignes jours lun→dim)
- Pour chaque jour : input `time` ouverture + `time` fermeture + case "Fermé" + bouton copie "depuis au-dessus"
- Bouton "Appliquer lundi à toute la semaine" pour cas simple
- Monté dans `SiteSettings.jsx` sous "Hero mosaïque", persisté via `PATCH /site { opening_hours }`
- Bannière storefront `OpeningHoursBanner` lit `/public/site` et affiche "Boutique fermée actuellement · ouvre à HH:MM · **dans X h Y min**" (compte à rebours automatique)

## P4 Finitions bis + Logo partout + P5 scaffold (Feb 2026) ✅

### Parrainage configurable
- Backend `LoyaltySettingsIn` : `referral_code_prefix` (default DINA), `referral_code_length` (3-8, default 4), `referral_validity_days` (default 90)
- Frontend `Loyalty.jsx` : nouvelle section "Code de parrainage" avec préfixe + longueur + validité jours + aperçu live `DINA-XXXX · récompenses valides N jours`

### Horaires storefront
- Nouveau composant `OpeningHoursBanner.jsx` : si l'heure courante est hors `opening_hours[today]` ou `today.closed=true`, affiche bandeau rouge "Boutique fermée actuellement · ouvre à HH:MM ou rouvre {jour} à HH:MM"
- Monté sur `/boutique` dans `App.js`
- Dismissible pour la session via sessionStorage

### Logo partout
- `RiderShell` : charge `/public/site`, montre `site.logo` dans la topbar (fallback photo rider → initiale), affiche `site.name` ("Chez Dina · Livreur · ● Pointé")
- `pdfReceipt.js` : nouveau paramètre `business.logo` (base64/URL) rendu en vignette centrée 18 mm, `business.name` dans le titre
- `POS.jsx` : `POSInner` et `Receipt` chargent `/public/site` et passent `logo + name + address + phone + tiktok` au PDF receipt
- `ConsoleLayout.jsx` : logo + nom déjà propagés depuis iter28

### P5 Refactor (scaffold)
- `/app/backend/routers/__init__.py` : package avec roadmap de migration domaine par domaine (auth, catalog, stock, purchases, orders, pos, delivery, customers, marketing, stats, settings, storefront)
- `/app/backend/routers/meta.py` : première slice extraite (`GET /api/health`)
- `server.py` monte `routers.meta.router` sans toucher au reste — zero behaviour change, prêt pour migration incrémentale PR par PR

## P4 Finitions (Feb 2026) ✅

### Avis clientes
- `/console/avis` enrichie : 4 KPI cards cliquables (pending/approved/rejected/note moyenne), bouton **Répondre** admin/manager → modal + réponse publique inline sous l'avis avec style "Chez Dina · {moderator}"
- Backend `ReviewModerationIn` : accepte `reply` optionnel ; `moderate_review` persiste `reply`, `reply_by`, `reply_at`, `moderated_by`, `moderated_at`

### Dina IA ↔ Manuel
- `/api/ai/ask` : priorité **manuel** si question how-to (comment/créer/modifier/remboursement/remise/préparer/clôturer…)
- `_search_manual` : fuzzy keyword match sur `manual_modules.sections.blocks` (text/content/items) filtré par rôle
- Réponse structurée : étapes numérotées + lien profond `/console/manuel/{module}#{section}`
- Questions non trouvées loggées dans `manual_gaps` (visible via `/manual-gaps` admin only)

### Logo global
- `ConsoleLayout` charge `/public/site` et propage `site.logo` + `site.name` dans sidebar + header (fallback pastille "CD")

### Service Worker & Push
- `/public/sw.js` : handler `push` + `notificationclick`
- `/lib/sw.js` : `registerSW`, `subscribePush` (attend `REACT_APP_VAPID_PUBLIC_KEY`), `listenInstallPrompt`, `triggerInstall`
- `registerSW()` au démarrage dans `App.js`

### Analytics 1st-party
- `POST /api/analytics/events` : stocke événement {name, visitor_id, session_id, page, utm_*, device, consent}
- `GET /api/analytics/funnel?days=N` : agrégation visitors / page_views / product_views / add_to_cart / checkout_started / order_placed / conversion_rate
- `/lib/analytics.js` : `track(name, extra)` + visitor_id persistant + consent gate

### Testé (iteration_28)
- Backend 6/6 pytest ✅ (reviews reply, ai manual, manual-gaps 403, analytics events + funnel)
- Frontend reviews moderation+reply + 15/15 regression ✅
- 2 bugs mineurs corrigés par le testing agent (dict items dans _search_manual, state site manquant dans ConsoleLayout — déduplication locale appliquée post-test)

## P3 Produits & achats (Feb 2026) ✅

### Backend
- `ProductIn` : nouveaux champs `variants: List[Dict]` (size, color, stock, enabled, price?), `videos: List[str]` (max 2, base64 data URL ou URL externe), `video_posters: List[str]`

### Frontend
- `VariantsGrid.jsx` (new) : grille taille × couleur Existe/N'existe pas avec input stock par cellule, bulk par ligne (tout +), par colonne (tout +), globaux (Tout activer / Désactiver tout)
- `VideoUpload.jsx` (new) : max 2 vidéos MP4/MOV, validation durée (≤ 60 s mesurée via `video.loadedmetadata`) + taille (≤ 50 MB) + MIME ; preview avec `controls muted playsInline` ; stockage base64 in-memory
- `ProductFormV3.jsx` : sections `3b. Vidéos` et sous-section `5b. Combinaisons réelles taille × couleur`
- `lib/variants.js` (new) : helpers `hasRealVariants`, `availableColorsForSize`, `availableSizesForColor`, `stockFor`, `comboExists` avec fallback descendant vers `stock_by_size`
- `storefront/Product.jsx` : filtre `visibleSizes` et `visibleColors` par variantes réelles ; sélection size filtre colors et vice-versa ; combos n'existant pas sont CACHÉES ; combos existantes OOS → "M'alerter" ligne barrée ; vidéos affichées en grille 2 colonnes sous la galerie, `controls muted playsInline` (jamais d'autoplay mobile)

### Déjà en place avant P3 ✅
- Pages séparées : Catégories & collections / Marques / Fournisseurs / Approvisionnements
- `AiDescribeModal` + `SeoSection` fonctionnels (fallback texte si LLM key absente)

## P2 Livraison (Feb 2026) ✅

### Nouvelles pages / composants
- `DeliveryDays.jsx` — rewritten : KPIs 4 cartes, modal `CreateDayModal` avec sélecteur date + livreur obligatoire (plus de auto-pick premier livreur), tableau cliquable
- `DayDetail` enrichi : tab **Affectation** avec cases à cocher mobile-friendly + "Tout sélectionner" + bouton "Affecter à {rider session}" ou "Affecter à un autre livreur…" (modal `pick-rider-modal` qui call `PATCH /deliveries/{oid}/assign`); nouveau bouton **"Suggérer une répartition"** → `POST /deliveries/suggest-split` affiche panneau avec propositions zones+charge+Apply
- `LiveDeliveryMap.jsx` (new) — tab **Suivi** : carte Leaflet, pins commandes colorés par statut (prete=f4b12c, assignee=5867fd, en_livraison=0021cc, livree=1f8a4c, annulee=c62828), markers livreurs ronds rouges avec initiales + popup. Polling `/riders/locations` toutes les 15 s. Légende statique en bas.
- `Riders.jsx` → `RiderProfile` : filtre calendrier (from/to + chips 7j/30j), 4 StatMini (Total/Livrées/Annulées/CA livré), tableau historique filtré

### Backend
- `POST /api/deliveries/suggest-split` (admin/manager) : groupe par zone, round-robin biased vers livreur déjà sur la zone, équilibre la charge actuelle du jour

## P1 Sprint 2 (Feb 2026) — Préparation scan + Kiosk selfie ✅

### Nouvelles pages / composants
- `Preparation.jsx` (new, `/console/preparation`) — Liste des commandes en Nouvelle / Confirmée / En préparation avec 3 KPI cards cliquables ; vue détail PrepRunner qui scanne article par article (SKU bare ou SKU|size|color) via input focus-trap compatible douchette ; fallback "Override manuel" avec motif obligatoire (dropdown : Étiquette illisible / Code-barres endommagé / Caméra indisponible / Produit sans étiquette / Scan refusé plusieurs fois / Autre) ; bouton "Marquer comme Prête" désactivé tant que toutes les lignes ne sont pas scannées ou override ; soumission PATCH `/orders/{id}/status-v3` avec `scanned_items[]` incluant {scanned, manual, manual_reason} loggé dans audit
- `Kiosk.jsx` — rewritten avec `navigator.mediaDevices.getUserMedia` : webcam front qui s'active au mount, miroir visuel, capture 240×180 JPEG (base64) lors du punch ; fallback gracieux "Caméra indisponible" badge rouge sans crash ; dernier punch affiche le selfie
- `App.js` — route `/console/pointage` → **Kiosk** (nouveau) ; legacy Pointage (présence + géofence) déplacé en `/console/presence`
- `ConsoleLayout.jsx` — sidebar : "Pointage (kiosk)" + "Présence & géofence" (admin only) + nouvelle entrée "Préparation"

### Backend
- `AttendancePunchIn.selfie: Optional[str]` — accepte base64 data URL
- `/api/attendance/punch-kiosk` stocke le selfie dans `attendance` doc et renvoie `has_selfie`

### Testé (iteration_25)
- Backend 6/6 pytest ✅ (punch avec selfie, sans selfie, PIN invalide 403, scan incomplet 400, scan complet 200)
- Frontend Preparation 100% ✅ · Kiosk UI corrigée (route montée post-test)

## P1 Sprint 1 (Feb 2026) — Fix packs 2 & 3 ✅

### Nouvelles pages / composants
- `RolesPermissions.jsx` — matrice 4 niveaux par cellule (Aucun / Lecture / Modif. / Complet), bordure rouge sur droits sensibles, bulk par section via `<select>` par rôle, bouton "Nouveau rôle" (vierge), suppression de rôles custom
- `Approvals.jsx` (new, `/console/approbations`, owner only) — inbox unifiée approval_requests + expense_requests + stock_adjustment_requests, 3 KPI cards (pending/approved/rejected) cliquables, filtre par type, Approuver/Refuser avec commentaire
- `Audit.jsx` (new, `/console/audit`, owner only) — filtres utilisateur/action/période/recherche libre, export Excel, diff before/after dans `<details>`
- `POSSessionGuard.jsx` (new) — overlay bloquant "Ouvrez votre session de caisse pour commencer" si aucune session non closed ; bouton "Ouvrir la session" avec montant initial
- `CashSessions.jsx` — rewritten : 4 KPI cards, flow Gérante déclare versement → Owner valide (modal avec écart temps réel) → écart appliqué au solde Gérante
- `Orders.jsx` — rewritten : 9 KPI mini-cards cliquables (Nouvelles/À préparer/Prêtes/En livraison/Livrées/Annulées/Reportées/Taux/CA livré) + colonne Facture (Voir/PDF/WhatsApp) + bloc Facture dans OrderDrawer
- `POS.jsx` — exports `POS` wrappé dans `POSSessionGuard` (POSInner = ancien composant)
- `ConsoleLayout.jsx` — entrées sidebar "À approuver" + "Journal d'audit" (admin only)
- `App.js` — routes `/console/approbations` + `/console/audit`

### Testé (iteration_24)
- Backend 10/10 pytest ✅ (roles-permissions, approvals, audit-logs, cash-sessions handover+validate, manager-balance, invoices/from-order, access-control sales→403)
- Frontend 100% ✅ (8 groupes fonctionnels + 9/9 pages regression)

## P0 Stabilité (Feb 2026) — Fix pack 1 remnants ✅

### Backend
- `POST /api/pages` enforce slug uniqueness → 409 "Slug déjà utilisé" (confirmed by pytest)

### Frontend
- `/app/frontend/src/lib/format.js` : nouveau `fcfaCompact(n)` (ex. "77,4 M FCFA", "12,5 k FCFA", "2,1 Md FCFA") + `numCompact(n)`
- `KPICard.jsx` : fix NaN delta — parse `previousValue` string ou number ; handle 0/0 → flat ; prev=0 non-zero current → affiche delta absolu (plus de `+NaN%`) ; nouveau prop `valueFull` → attribut HTML `title` pour tooltip exacte sur la version compacte
- `Dashboard.jsx` : KPIs CA période, Panier moyen, Marge brute en `fcfaCompact` + `valueFull=fcfa(...)` ; empty states "Aucune donnée pour cette période" sur CA & marge, Commandes par statut, Ventes par canal, Top 5 produits
- `Statistiques.jsx` : `HeatmapCard` guard matrix undefined ; `SalesTab` défauts sur `d.split/d.by_dow/d.by_hour` ; `RankTable` empty state ; `ZonesTab` empty state et defensive loader catch
- `Orders.jsx` : data-testid `orders-view-table`, `orders-view-kanban`

### Testé (iteration_23)
- Backend 3/3 pytest (slug uniqueness) ✅
- Frontend 13/13 period presets, 12/12 stats tabs, 7/7 regression pages, ZERO TypeError, ZERO NaN ✅

## Correctif urgent (Feb 2026) — Crash "Cannot read properties of undefined (reading 'length')" ✅

Bulk-patch défensif sur tous les points qui crashaient lorsqu'un endpoint renvoyait un payload partiel :
- `Statistiques.jsx` : tous les `d.FIELD.(map|slice|length|filter)` → `(d.FIELD || []).XXX`, plus `v.sales_by_size[x]` → `(v.sales_by_size || {})[x]`, `d.best_profile.top_X` → `(d.best_profile?.top_X || [])`
- `Dashboard.jsx` : même patch sur `d.FIELD` et `k.FIELD` (notamment `k.channels.map` qui crashait)
- `Deliveries.jsx`, `MarquesV2.jsx`, `Suppliers.jsx`, `Rider.jsx`, `Statistics.jsx`, `Waitlist.jsx` : guards sur `s.orders`, `b.products`, `s.products`, `o.items`, `zones.zones`, `g.customers`
- Tests iteration_22 : frontend 100% — ZÉRO TypeError confirmé sur Dashboard, 12 onglets Statistiques, Livraisons, Marques, Fournisseurs, Liste d'attente, Rider

## Fix pack 9/9 (Feb 2026) — Manuel d'utilisation ✅


### Backend
- Collection `manual_modules` seedée au démarrage avec 16 modules complets (Prise en main → Espace livreur)
- Collection `manual_progress` par utilisateur avec `read_sections[]`
- Endpoints : GET /manual/modules (filtre `?role=`), GET /manual/modules/{n}, PATCH (admin/manager), GET+POST /manual/progress, GET /manual/search, GET /manual/module-for-path

### Frontend
- Route `/console/manuel` (Manuel.jsx) : header + barre de recherche live (debounce 200ms) + 6 filtres rôle + grid de 16 cartes modules avec progression (sections lues)
- Route `/console/manuel/:number` (ManuelModule.jsx) : TOC gauche sticky, Objectifs du module (checklist), sections numérotées, Block renderer (text/list/steps/statuses/callout/screenshot), callouts stylisés (info bleu, astuce jaune, attention rouge), "Marquer comme lu", cartes prev/next, modal édition JSON pour admin/manager
- `HelpButton.jsx` dans le header console : panneau latéral qui pop le module associé à la page courante via `/manual/module-for-path`
- `GuidedTour.jsx` : visite guidée 4-7 étapes à la première connexion, personnalisée par rôle, rejouable via `window.dispatchEvent(new Event("dina-replay-tour"))`
- Sidebar : entrée "Manuel d'utilisation" en bas avec icône GraduationCap

### Modules mappés aux pages
Dashboard→1, POS→3, Commandes→4, Livraisons→5, Produits→6, Fournisseurs→7, Stock→8, Clients→9, Promotions→10, Sessions caisse→11, Stats/Finances→12, Site→13, Équipe/Rôles/Pointage→14, Paramètres→15, Rider→16

## Fix pack 8 Vague C (correctif) + Vague D (Feb 2026) ✅


### Correctif Vague C — Hero mosaïque + Upload uniquement
- Hero : 2 colonnes verticales défilant du bas vers le haut à vitesses alternées (18 et 22 px/s), prefers-reduced-motion respecté
- Supprimé le type "Mosaïque défilante" standalone — intégré dans hero.mosaic (24 images migrées)
- Section Builder : hero + banner acceptent uniquement l'upload (plus aucun champ URL)
- Tests iteration_20 : backend 13/13, frontend 100% ✅

### Vague D — Paramètres restructurés
- `/console/parametres` : 11 onglets dans un menu latéral sticky
  1. **Identité** — Logo centralisé (utilisé console/rider/vitrine/reçus/factures), nom, slogan, description, favicon
  2. **Coordonnées** — adresse, téléphones, WhatsApp, email, horaires, RCCM/NCC
  3. **Ventes & caisse** — remise max, règle rupture, politique échange, fond caisse, motifs annulation
  4. **Livraison** — zones (link), créneaux, seuil preuve, 4 pondérations score livreur
  5. **Paiements** — 7 modes togglables, lien Wave Business, numéros Mobile Money
  6. **Documents** — pied reçu, pied facture, QR fiche colis, code-barres étiquette
  7. **Notifications** — 5 toggles WhatsApp/email
  8. **Intégrations** — link page dédiée
  9. **Équipe** — links employés/rôles/pointage
  10. **Sécurité** — PIN requis, timeout session, 2FA
  11. **Données** — export JSON, add/delete démo
- Backend : /site PATCH accepte sales/delivery/payments/documents/notifications/security


### Backend
- `/public/site` GET expose `theme`, `social`, `seo`, `menu`, `footer`, `sections`
- `/site` PATCH accepte updates partiels sur ces 5 clés
- `/pages` POST enforced slug uniqueness (409), PATCH exige page existante (404)

### Frontend — Nouvelle page `SiteVitrine` (`/console/site`)
- **5 onglets** : Apparence / Accueil / Pages & navigation / SEO & partage / Aperçu
- **Apparence** : 7 color pickers (primaire, secondaire, bouton, fond, texte, dark bg, dark text), 4 presets, contrast badges WCAG, font selector 7 polices Google (Sora, Inter, Playfair, DM Sans, Poppins, Montserrat, Cormorant), radius slider 0-24, 3 card styles
- **Accueil** : réutilise `SectionBuilder` (hero, mosaic, product_grid, banner, trust_strip, text_block, newsletter)
- **Pages & nav** : 4 sous-onglets — Pages (CRUD + éditeur plein), Menu (header), Pied de page (colonnes), Réseaux sociaux (7 réseaux, seuls les remplis apparaissent)
- **SEO** : titre/description avec compteurs, upload image partage base64, pixels FB/TikTok/GA, lien sitemap
- **Aperçu** : iframe desktop/mobile, partage lien, publier
- `useSiteTheme` hook : applique CSS vars + injecte Google Fonts sur storefront
- Footer storefront : affiche uniquement les réseaux renseignés avec icônes
- Tests iteration_19 : backend 8/8, frontend 98% ✅

## Fix pack 8 Vague B — Compte client ✅
(voir ci-dessus)

## Fix pack 8 Vague A — Storefront & mosaïque ✅
(voir ci-dessus)
- Marque "Chez Dina" nettoyée partout (plus de sous-titre "boutique")
- Barre de recherche permanente dans le header avec autosuggest (produits/catégories/marques, debounce 200ms)
- Nouvelle section `MosaicSection` (masonry 3-4 cols desktop / 2 mobile, défilement vertical continu à vitesses alternées, pause au hover, prefers-reduced-motion respecté, lien optionnel par image)
- Console `SectionBuilder` : type "mosaic" avec drag-drop upload multi-images
- Tests iteration_17 : 22/22 ✅

## Fix pack 8 Vague B (Feb 2026) — Compte client ✅
### Backend
- `/public/account/photo` upload base64
- `/public/account/update` patch (nom, email, tailles, prefs com)
- `/public/account/addresses` CRUD + default
- `/public/account/orders-split` buckets en_cours/livrees/annulees
- `/public/account/order/{code}` détail + rider info
- `/public/account/recently-viewed` GET+track
- `/public/account/reviews-pending` + `POST /reviews`
- `/public/account/vouchers`
- `/public/account/change-code` avec vérif old
- `/public/account/threads` + `thread/rider/{code}`
- `/rider/position` POST (rider only)
- `/public/order/{code}/rider-position` avec simulateur (interpolation Cocody→zone sur 15 min)

### Frontend
- `CustomerContext` + `AccountShell` sur `/boutique/compte/*`
- 14 items dans le menu gauche (desktop) / liste (mobile)
- Overview : 4 cartes (Infos + photo upload, Adresse défaut, Porte-monnaie+points, Préférences)
- `OrdersPage` 2 onglets avec compteurs
- `OrderDetail` : timeline + items + Paiement + Livraison + facture
- `LiveDelivery` : carte Leaflet, polling 30s, Appeler/WhatsApp/Message in-app, placeholder si position vide
- `MessagesPage` : threads + chat polling 5s
- `ReviewsPending`, `Security` (changer code 6 chiffres), `Addresses` CRUD, `Preferences`, empty states partout
- Header storefront : greeting "Bonjour, {prénom}" + dropdown
- Tests iteration_18 : backend 16/16, frontend 90%+ (après fix simulateur+placeholder)


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

## Backlog (priorisé après P0 Feb 2026)

### P1 — Fix packs 2 & 3 (Sprint 2 restant)
- ~~Kiosk tablette boutique : Pointage PIN+selfie~~ ✅ livré
- ~~Blind inventory & reception~~ ✅ déjà en place (audit OK)
- ~~Préparation screen : scan article par article + fallback manuel~~ ✅ livré

### P2 — Fix pack 4 (Livraison) ✅ TERMINÉ

### P3 — Fix pack 5 (Produits & achats) ✅ TERMINÉ

### P4 — Packs 6, 7, 8, 9 (livré)
- ✅ Avis modération inbox (approuver/rejeter/répondre + KPI cards)
- ✅ Dina IA branchée sur le manuel (recherche manuel first, lien module/étape, filtrée par rôle, gaps loggés)
- ✅ Service Worker + infra Web push (VAPID à configurer en production)
- ✅ Analytics 1st-party (events + funnel)
- ✅ Logo global (sidebar + header console propagent site.logo)
- 🟡 **Reste P4 à faire plus tard** : Parrainage configurable UI, dark mode complet audit, horaires storefront bannière, police storefront only, WhatsApp outbox UI dédiée, logo sur reçus/factures/fiches colis/rider, "Installer l'application" bannière iOS

### P5 — Dernière étape
- Refactor `server.py` en modules par domaine
- Avis modération inbox (approuver/rejeter/répondre)
- Parrainage configurable (format code + validité)
- Web push notifications (Service Worker + VAPID .env + bannière "Installer l'application" iOS)
- Dark mode complet partout
- Logo centralisé (sidebar, rider, storefront, reçus, factures, fiches colis)
- Horaires sur contact + footer + bannière "Fermé actuellement"
- Police storefront only (console reste en Sora)
- WhatsApp outbox (préparé pour API future)
- Analytics 1st-party (events table + funnel : page_view, product_view, add_to_cart, checkout_started, order_placed, search)
- Manuel richement illustré (captures annotées SVG, GIFs placeholders, FAQ 30 Q/R, mémo A4 par rôle, glossaire)
- **Dina IA branchée sur le manuel** (recherche manuel first, réponse par étapes + lien module/étape, filtrée par rôle, questions non répondues listées pour owner)

### P5 — Dernière étape
- Refactor `server.py` en modules par domaine (auth, catalog, stock, purchases, orders, POS, cash, delivery, customers, marketing, stats, settings, storefront)

### Décisions
- ❌ Pas de badge "Déjà vu X fois" — remplacé par signaux réels (prix en baisse, plus que X en stock, retour en stock)
- ✅ WhatsApp outbox + wa.me (API Business branché plus tard)
- ✅ Analytics first-party (pas d'outil externe)
