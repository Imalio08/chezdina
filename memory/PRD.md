# Chez Dina — PRD

## Problem Statement
**Chez Dina** — all-in-one retail OS for a women's fashion boutique in Abidjan (Cocody Angré 7e). Single codebase powers three faces: **Console** back-office, **Rider** mobile delivery space, and public **Storefront**. **Français uniquement**, FCFA (XOF), Africa/Abidjan. TikTok @dinoush04 · WhatsApp +225 07 77 92 61 79.

## Session 10 (Feb 7 2026) — Section 10 CMS Vitrine + Compte Cliente

### CMS Vitrine — SectionBuilder drag & drop
- Nouveau endpoint `GET /api/public/storefront/sections` (pas d'auth) → renvoie les sections activées depuis `site_settings.sections`. Si aucune : retourne 3 sections par défaut (hero, product_grid, trust_strip).
- `GET /api/storefront/sections` (auth) renvoie **tout** incluant désactivées.
- `PATCH /api/storefront/sections` (admin/manager) persiste la liste ordonnée {id, type, enabled, props}.
- **Page `/console/apparence`** (`SectionBuilder.jsx`) : liste draggable (HTML5 DnD), 6 types supportés — hero / product_grid / banner / trust_strip / text_block / newsletter. Chaque section a : toggle visibilité (eye icon), bouton Éditer (PropsEditor modal avec champs typés par type), bouton Supprimer. Boutons globaux : Ajouter (picker), Prévisualiser (ouvre /boutique), Enregistrer.
- **Home.jsx refondu** : rendu dynamique des sections depuis l'API publique. Chaque composant interne (`Hero`, `ProductGrid`, `TrustStrip`, `Banner`, `TextBlock`, `Newsletter`) lit `sec.props`. Les sections désactivées sont filtrées côté serveur.

### Compte Cliente — login par code secret 6 chiffres (sans SMS OTP)
- Nouveau champ `access_code` (6 chiffres crypto-random via `secrets.randbelow`) auto-généré sur :
  - `POST /customers` (création admin)
  - `POST /customers/bulk` (import CSV)
  - `POST /public/customer-register`
  - Seed des 300 clientes de démo (backfill one-off exécuté sur les clientes existantes)
- Nouvelle route **publique** `POST /api/public/customer-login-code {phone, code}` : matching sur les 8 derniers chiffres du numéro, blacklist exclue, retourne `{customer, token}` et pose cookie `customer_token` httpOnly 30j. 404 si phone introuvable, 401 si code invalide.
- `GET /api/public/account/me` (dépendance `get_customer`) renvoie `{customer, orders[], metrics:{total_orders, total_spent, referrals}}` via le cookie ou Bearer. Vérifie `payload.kind == "customer"` pour rejeter les tokens staff.
- `POST /api/public/customer-logout` supprime le cookie.
- **Page `/boutique/account`** (`Account.jsx` refondu) : écran LoginForm (phone + code 6 chiffres masqué) → écran Dashboard (profil avec tier/points, 4 KPIs porte-monnaie/points/commandes/parrainages, code parrainage copiable + bouton Partager WhatsApp, liste des commandes avec lien vers `/suivi/:code`, bouton déconnexion). Session persistée dans `sessionStorage.dina_customer`.
- **Admin Customers.jsx** : la cellule téléphone affiche aussi le code à 6 chiffres (`cust-code-{phone}`) pour que l'admin le partage facilement avec la cliente par WhatsApp.

### Testing (testing_agent itération 7)
- **Backend pytest 18/18** : sections GET public (défaut + filter disabled) / GET auth / PATCH role gating (admin OK, manager OK, sales 403), login-code (success, bad code 401, bad phone 400, no match 404, blacklist exclue), /account/me (401 sans token, 401 avec token staff kind=user, 200 Bearer, 200 cookie), customer-logout, access_code assigné sur création/bulk/register.
- **Frontend 100%** : SectionBuilder DnD, PropsEditor hero inputs, 6 types ajoutables, Home dynamique, LoginForm (bon code → Dashboard, mauvais code → toast "Code secret invalide" sans quitter la page), persistance sessionStorage, cust-code visible dans Customers.jsx.

### Durcissement appliqué
- `gen_access_code()` utilise désormais `secrets.randbelow(1_000_000)` (crypto-random, pas `random.randint`) pour éviter la prédictibilité.

### Non livré dans cette session (deferred)
- Rate limiting sur `/public/customer-login-code` et `/attendance/punch-kiosk` (brute-force 6/4 chiffres encore possible)
- Index MongoDB sur phone_digits_last8 (le login-code scan linéairement 300 lignes aujourd'hui)
- Pydantic discriminated union pour schema de sections (actuellement Dict[str, Any] permissif)
- JWT retiré du sessionStorage client (cookie httpOnly suffirait, mais pratique pour debug)
- Pages CMS custom (`/console/pages`, `/console/menus`, `/console/seo`) — placeholders en attendant la section 11

## Sessions précédentes

### Session 9 — WhatsApp auto + Section 8 Marketing/Fidélité/Parrainage + Section 9 Rôles & Pointage
- WA auto-enqueue sur changement de statut commande (7 templates FR), Campagnes outbox avec broadcast 6 segments et templates, Fidélité éditable (règles + paliers), Parrainage (code unique + crédit auto), Rôles & permissions matrix 9×5, Kiosk pointage PIN avec plein écran.

### Session 8 — Section 6 finalisation + Section 7 reliquats
- Board drag & drop livraisons, réconciliation PIN gérante, carte GPS Leaflet, wizard Approvisionnements 4-steps, étiquettes QR variante planche A4.

### Session 7 — Section 6 compléments + Section 7 Catalog v2
- Fiches colis, formulaire produit matrice variantes + images + IA description.

### Sessions 1-6
- Rebrand "Chez Dina", français only, Sora + IBM Plex Serif, Dashboard & Statistiques v2, POS cash control, Delivery full redesign, Dina IA flottant avec tool-calling, 7 composants partagés UX.

## Architecture
- **Backend**: FastAPI `/api`, MongoDB motor, JWT cookie + Bearer, bcrypt, PIN 4 chiffres staff, access_code 6 chiffres cliente.
- **Frontend**: React 19, Router 7, Tailwind + Shadcn + Recharts + sonner + lucide-react + react-leaflet (OSM), Sora + IBM Plex Serif, palette red/pink #b02a2a.
- **AI**: Claude Sonnet 5.5 via Emergent Universal Key — floating "Dina IA".
- **Routes publiques** : `/boutique` (home dynamique), `/boutique/catalog`, `/boutique/product/:id`, `/boutique/checkout`, `/boutique/account` (login code), `/suivi/:code`, `/noter/:code`, `/login`.
- **Routes Console** : `/console/*` (back-office avec sidebar 10 sections), `/console/livreur` (mobile rider), `/console/apparence` (CMS), `/console/pointage` (kiosk).
- **Collections DB** : `products`, `orders`, `customers`, `users`, `delivery_sessions`, `pos_holds`, `pos_authorizations`, `cash_movements`, `attendance`, `reviews`, `suppliers`, `purchase_orders`, `zones`, `expenses`, `promotions`, `stock_alerts`, `abandoned_carts`, `notifications`, `site_settings` (avec `.sections` depuis session 10), `rider_locations`, `whatsapp_outbox`, `loyalty_settings`, `referrals`, `roles_permissions`, `stores`, `business`, `invoices`.

## Credentials (`/app/memory/test_credentials.md`)
- Admin: `aouattaraesca@gmail.com` / `Admin123!` · PIN 1234
- Manager: `manager.cocody@dinastore.ci` / `Manager123!` · PIN 2222
- Sales: `agent1@dinastore.ci` / `Agent123!` · PIN 3333
- Stock: `stock@dinastore.ci` / `Stock123!` · PIN 4444
- Rider: `rider1@dinastore.ci` / `Rider123!` · PIN 5555
- Public cliente demo: `+225 07 60 17 28 21` · code `142085` (Aminata Koné)

## Backlog
### P0 — Durcir avant go-live
- Rate limiting `/public/customer-login-code` + `/attendance/punch-kiosk` (anti brute-force)
- Gating `/whatsapp-outbox` admin/manager/sales uniquement (téléphones sensibles)
- Index MongoDB sur `phone_digits_last8` pour la connexion cliente à l'échelle

### P1 — Section 11 Paramètres & Intégrations
- WhatsApp Business Embedded Signup (Meta Cloud API)
- Pixels Meta/TikTok + feed catalogue
- Imprimante Wi-Fi ESC/POS pour reçus thermiques
- Pages CMS custom (/console/pages), menus & footer builder, SEO par page

### P1 — Section 12 Checklist d'acceptation finale
- Parcourir la checklist du cahier des charges, cocher chaque flow sur le preview

### P2 — Nice-to-have
- Scheduler panier abandonné auto-WhatsApp 24h après
- Dina IA rédige automatiquement les diffusions WhatsApp
- Export factures bulk ZIP
- PWA offline POS (service worker + IndexedDB sync)
- Multi-store réel
