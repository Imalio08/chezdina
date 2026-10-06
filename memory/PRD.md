# Chez Dina — PRD

## Problem Statement
**Chez Dina** — all-in-one retail OS for a women's fashion boutique in Abidjan (Cocody Angré 7e). Single codebase powers three faces: **Console** back-office, **Rider** mobile delivery space, and public **Storefront**. **Français uniquement**, FCFA (XOF), Africa/Abidjan. TikTok @dinoush04 · WhatsApp +225 07 77 92 61 79.

## Session 9 (Feb 7 2026) — WhatsApp auto + Section 8 Marketing/Fidélité/Parrainage + Section 9 Rôles & Pointage

### WhatsApp Auto Notifs (enqueue sur changement de statut)
- **Hook `_enqueue_wa`** dans `PATCH /orders/{oid}/status` : à chaque transition de statut, génère un message FR via `_wa_message_for_status` (templates pour confirmee / prete / assignee / en_livraison / livree / echouee / annulee) et pousse une entrée dans `db.whatsapp_outbox` avec `kind:"status"`, `message`, `link` (wa.me/{digits}?text=encoded). Pas d'enqueue si le statut ne change pas (idempotence). Pas d'enqueue si `site_settings.whatsapp_auto === false`.

### Section 8 — Campagnes WhatsApp / Fidélité / Parrainage
- **Endpoints Outbox** : `GET /whatsapp-outbox` (filtres `?status=pending|sent`, `?kind=status|broadcast`), `POST /whatsapp-outbox/{mid}/mark-sent`, `DELETE /whatsapp-outbox/{mid}` (admin/manager).
- **Diffusions** : `POST /whatsapp-outbox/broadcast` {segment, message} enfile un message par cliente du segment avec remplacement des variables `{prenom}` et `{code}`. 6 segments : all, active, inactive, vip, blacklist, nouvelles.
- **Segments counts** : `GET /customer-segments` renvoie les comptes pour tous les segments.
- **Loyalty settings** : `GET/PATCH /loyalty/settings` → points_per_fcfa, enabled, 3 paliers par défaut (Bronze 0 / Silver 500 / Gold 2000), bonus parrain/filleul configurables.
- **Parrainage** : `POST /referrals/apply {code, customer_id}` → crédite wallet parrain (+1000) & filleul (+500), incrémente `referral_count` du parrain, pose `referred_by` sur le filleul, crée une ligne dans `db.referrals`. Erreurs : 404 code introuvable, 400 déjà parrainée, 400 auto-parrainage. `GET /referrals` et `GET /referrals/leaderboard`.
- **Pages Console** :
  - `/console/campagnes-whatsapp` (`WhatsAppCampaigns.jsx`) : 4 KPIs, filtres tabs (Tous / Notifs statut / Diffusions), tableau outbox avec bouton Envoyer (ouvre wa.me + mark-sent), **BroadcastModal** avec 6 segment cards + 4 templates rapides + textarea avec variables.
  - `/console/fidelite` (`Loyalty.jsx` refondu) : règles éditables (points par FCFA, bonus parrain/filleul, toggle actif), éditeur de paliers (add/remove/edit nom/min_points/discount_pct/free_delivery), tableau top ambassadrices.
  - `/console/parrainage` (`Referrals.jsx` nouveau) : 4 KPIs, classement cliquable pour copier le code, dernières conversions, modal "Appliquer un code" pour saisir manuellement un parrainage.

### Section 9 — Rôles & Permissions / Pointage Kiosk
- **Matrice droits** : `GET/PATCH /roles-permissions` (admin only pour PATCH). Matrix par défaut : admin all:true, manager (pos/orders/deliveries/products/stock/customers/expenses), sales (pos/orders/stock/customers), stock_keeper (orders/products/stock), rider (deliveries). Page `/console/roles` (`RolesPermissions.jsx`) : grille 9 permissions × 5 rôles avec boutons check/X verts/gris cliquables.
- **Pointage kiosk** : endpoint **public** `POST /attendance/punch-kiosk {code, kind}` sans auth → vérifie PIN et logge dans `db.attendance`. 403 si PIN invalide. Page `/console/pointage` (`Kiosk.jsx` nouveau) : clavier numérique 0-9, boutons Arrivée/Départ, affichage PIN masqué, auto-submit à 4 chiffres, feedback "kiosk-last" après succès avec nom+rôle+heure, mode plein écran, liste des pointages du jour.

### Testing (testing_agent_v3 itération 6)
- **Backend pytest 21/21** : outbox CRUD + broadcast, auto-enqueue sur changement de statut (+ idempotence), segments, loyalty GET/PATCH, referral apply (+ 3 erreurs), roles-permissions GET/PATCH (admin only vs manager 403), kiosk punch (public PIN 1234 OK / 9999 403), /attendance/today auth required.
- **Frontend 95%** : les 5 nouvelles pages rendent avec tous les data-testid attendus. PIN 1234 live kiosk → "Arrivée · Aïcha Ouattara". PIN 9999 → toast "Code invalide".
- **1 micro-gap fixé** : segment `blacklist` ajouté au tableau SEGMENTS de WhatsAppCampaigns.jsx (le backend l'acceptait déjà). Dead code branch `confirmee or nouvelle` retiré de `_wa_message_for_status`.

### Non livré dans cette session (deferred)
- Rate limiting sur `/attendance/punch-kiosk` (actuellement sans limite anti-brute-force PIN)
- Gating `/whatsapp-outbox` par rôle (actuellement tout authentifié lit tous les messages avec téléphones)
- Modération avis en batch (page `Reviews.jsx` reste individuelle, UX actuelle suffit)
- Panier abandonné auto-WhatsApp scheduler (actuellement relance manuelle depuis AlertsAndCarts)

## Session 8 (Feb 7 2026) — Section 6 finalisation + Section 7 reliquats
- Board drag & drop livraisons, réconciliation PIN gérante avec écart, carte GPS live Leaflet/OSM, wizard Approvisionnements 4-steps avec landed cost proportionnel, étiquettes QR par variante planche A4 24 par page.
- Bug critique Rider.jsx `useEffect(load, [])` → Promise cleanup crash corrigé.

## Session 7 — Section 6 compléments + Section 7 Catalog v2
- Fiches colis "Imprimer du jour", formulaire produit refondu (grid 2 colonnes, matrice variantes, images multi WebP, IA description).

## Session 6 — Section 6 Delivery full redesign (partiel)
- Fiches colis QR imprimables, page publique `/noter/:code`, Rider.jsx avec sheet Annulée/Reportée.

## Session 5 — POS cash control
- PIN auth, cash movements, holds, garde-fou remise >20%.

## Session 4 — Dashboard & Statistiques v2
- "À traiter maintenant" live, 5 tabs rapports (Ventes, Zones, Clientes, Livraisons, Finances).

## Session 3 — Navigation + Dina IA
- Sidebar 10 sections collapsibles, Dina IA widget flottant avec tool-calling.

## Session 2 — Fondations UX
- 7 composants partagés (PeriodSelector, KPICard, ViewToggle, FiltersPanel, CreateOnFlySelect, ImageUpload, EmptyState).

## Session 1 — Rebrand & Langue
- "Chez Dina", français only, Sora + IBM Plex Serif, ErrorBoundary partout.

## Architecture
- **Backend**: FastAPI `/api`, MongoDB motor, JWT cookie + Bearer, bcrypt, PIN 4-chiffres.
- **Frontend**: React 19, Router 7, Tailwind + Shadcn + Recharts + sonner + lucide-react + **react-leaflet** (OSM), **Sora** + IBM Plex Serif, palette red/pink #b02a2a.
- **AI**: Claude Sonnet 5.5 via Emergent Universal Key — floating "Dina IA".
- **Routes**: `/boutique`, `/console/*`, `/console/livreur`, `/suivi/:code`, `/noter/:code`, `/login`.
- **Collections DB** (ajouts session 9) : `whatsapp_outbox`, `loyalty_settings`, `referrals`, `roles_permissions`, `rider_locations`. Historique : `products`, `orders`, `customers`, `users`, `delivery_sessions`, `pos_holds`, `pos_authorizations`, `cash_movements`, `attendance`, `reviews`, `suppliers`, `purchase_orders`, `zones`, `expenses`, `promotions`, `stock_alerts`, `abandoned_carts`, `notifications`, `site_settings`, `stores`, `business`, `invoices`.

## Credentials (`/app/memory/test_credentials.md`)
- Admin: `aouattaraesca@gmail.com` / `Admin123!` · PIN 1234
- Manager: `manager.cocody@dinastore.ci` / `Manager123!` · PIN 2222
- Sales: `agent1@dinastore.ci` / `Agent123!` · PIN 3333
- Stock: `stock@dinastore.ci` / `Stock123!` · PIN 4444
- Rider: `rider1@dinastore.ci` / `Rider123!` · PIN 5555

## Backlog
### P0 — Durcir avant go-live
- Rate limiting kiosk punch (brute-force PIN)
- Gating `/whatsapp-outbox` admin/manager/sales uniquement (téléphones sensibles)
- Scheduler panier abandonné → relance WhatsApp auto après 24h

### P1 — Sections restantes du cahier des charges
- Section 10 — CMS Storefront : section builder drag & drop, pages custom, compte cliente par code secret 4-6 chiffres
- Section 11 — Paramètres & Intégrations : WhatsApp Meta Business Embedded Signup, Pixels Meta/TikTok, imprimante Wi-Fi ESC/POS
- Section 12 — Checklist d'acceptation finale

### P2 — Nice-to-have
- Export factures ZIP
- PWA offline (service worker + IndexedDB sync pour POS)
- Multi-store réel (collection `stores` déjà en place, UI partielle)
