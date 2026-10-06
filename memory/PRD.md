# Chez Dina — PRD

## Problem Statement
**Chez Dina** — all-in-one retail OS for a women's fashion boutique in Abidjan (Cocody Angré 7e). Single codebase powers three faces: **Console** back-office, **Rider** mobile delivery space, and public **Storefront**. **Français uniquement**, FCFA (XOF), Africa/Abidjan. TikTok @dinoush04 · WhatsApp +225 07 77 92 61 79.

## Session 8 (Feb 7 2026) — Section 6 finalisation + Section 7 reliquats

### Section 6 compléments livrés
- **Board d'affectation drag & drop** (`Deliveries.jsx` tab `board`) : colonne gauche "À assigner" avec cartes draggables, colonnes par livreur à droite scrollables horizontalement. HTML5 DnD (`draggable`, `onDragStart`, `onDrop`) → `PATCH /delivery-sessions/{sid}/add-order`. "+ Ouvrir" crée la journée du livreur à la volée.
- **Réconciliation ligne-par-ligne avec PIN gérante** : nouveau `ReconcileLineModal` ouvre pour chaque ligne COD avec input montant reçu + input PIN masqué (tracking large) + note. Backend `/delivery-sessions/{sid}/reconcile` étendu : si `collected:true`, vérifie `PIN` (admin/manager actif) et stocke objet `{collected, amount, due, ecart, approved_by, note, at}`. Écart affiché en vert (surplus) ou rouge (manque) dans le tableau Journées. 403 si PIN invalide, 400 si PIN manquant.
- **Carte GPS live** : nouvel onglet `Carte GPS` avec composant `/components/shared/LeafletMap.jsx` (react-leaflet + OSM, icônes marker rouges via leaflet-color-markers, `FitBounds` auto). Rider.jsx push position toutes les 20s via `navigator.geolocation.watchPosition` → `POST /riders/location`. Console `GET /riders/locations` filtre les positions < 30 min. Rafraîchissement auto de la carte toutes les 30s.

### Section 7 reliquats livrés
- **Wizard 4 étapes Approvisionnements** (`PoWizard` dans `Purchases.jsx`) : Fournisseur → Articles (produit via select, taille+couleur suivant le produit, qté, coût unitaire) → Coûts annexes (fret, douane, commission avec libellé libre) → Récap. Landed unit cost calculé en live par répartition proportionnelle (`landed_u = unit_cost + (extras_total * share) / qty`). Stepper visuel avec check marks.
- **Réception + étiquettes QR par variante** (`ReceiveModal` + `LabelsPrintModal`) : à la réception, ajustement qté reçue par ligne, backend `POST /purchase-orders/{pid}/receive` incrémente `stock_by_size[size]` + `stock` par ligne, applique les coûts annexes au landed cost, génère **une étiquette par unité** avec QR encodé `sku|size|color`. Planche A4 — 3 colonnes × 8 lignes (70×37mm par cellule). CSS `@page A4` et `page-break-inside:avoid` par cellule.

### Backend endpoints ajoutés/modifiés
- `POST /api/riders/location` (upsert rider_locations)
- `GET /api/riders/locations` (filtre > 30 min)
- `PATCH /api/delivery-sessions/{sid}/reconcile` étendu (amount, pin, note, ecart, approved_by)
- `PATCH /api/purchase-orders/{pid}` (update générique)
- `DELETE /api/purchase-orders/{pid}` (suppression)
- `POST /api/purchase-orders/{pid}/receive` (reception + QR labels + stock inflow + landed cost)
- Modèles: `ReconcileIn` étendu, `RiderLocationIn`, `POReceiveIn`, `PurchaseOrderIn` enrichi

### Testing (testing_agent_v3)
- **Backend pytest 10/10** : rider location upsert+list, reconcile PIN missing/bad/admin/manager, PO CRUD, PO receive avec landed cost proportionnel + 3 QR labels + incrément stock
- **Frontend 100%** : Deliveries 5 onglets rendent, Board 4 colonnes livreurs + 31 cartes draggables, Carte GPS avec LeafletMap après push rider, Reconcile PIN 1234 OK/9999 KO, Wizard 4 étapes complète, Receive génère labels avec bouton `print-qr-labels` et <img alt="QR">
- **1 bug critique corrigé** par testing agent : `Rider.jsx` `useEffect(load, [])` retournait une Promise → StrictMode `destroy is not a function` → ErrorBoundary. Fixé en `useEffect(() => { load(); }, [])`.

### Non livré dans cette session (deferred backlog)
- Section 8 — Clients & marketing : segments auto, campagnes WhatsApp panier abandonné, modération avis, fidélité + parrainage, scheduler ventes flash — **prochaine session**
- Section 9 — Dépenses + employés + rôles & permissions matrix + pointage kiosk
- Section 10 — Storefront CMS + section builder + account par code secret 4-6 chiffres
- Section 11 — Paramètres & Intégrations (WhatsApp Meta, Pixels, imprimante Wi-Fi)
- Section 12 — Checklist d'acceptation finale

## Session 7 (Feb 6 2026) — Section 6 compléments + Section 7 Catalog v2
### Section 6 compléments
- Bouton "Imprimer fiches du jour" sur la page Livraisons → route directe vers `/console/fiches-colis` qui liste toutes les commandes prêtes/assignées/en_livraison.
- Backend `public_order` + `public_rate` endpoints restaurés après conflit de nommage avec `public_create_order` (collision F811 ruff).

### Section 7 Catalog v2 — Nouveau formulaire produit (`Products.jsx` refondu)
- Grid 2 colonnes desktop, variant matrix auto, images multi (WebP compression), IA description, pills tailles/couleurs, tableau variantes.
- Composants partagés utilisés : `ImageUpload`, `CreateOnFlySelect`, `ErrorBoundary`.

## Session 6 (Feb 6 2026) — Section 6 Delivery full redesign (partiel)
- Fiches colis QR imprimables, page publique `/noter/:code`, Rider.jsx refondu (bouton Gérante, strip 3 KPI live, statut `recuperee`, bottom-sheet avec actions, sheet Annulée + Reportée).

## Session 5 — POS cash control
- PIN auth (`/pos/pin-authorize`), cash movements, holds. `POSExtensions.jsx` : PinAuthModal, CashDrawer, HoldsPanel. Garde-fou remise >20% avec PIN.

## Session 4 — Dashboard & Statistiques v2
- "À traiter maintenant" live, 8 cartes action. Statistiques en 5 tabs (Ventes & produits, Zones géographiques, Clientes, Livraisons, Finances) avec Compte de résultat.

## Session 3 — Navigation + Dina IA
- Sidebar 10 sections collapsibles (40+ liens), topbar "+ Créer" 6 raccourcis, Dina IA widget flottant avec tool-calling backend (6 outils).

## Session 2 — Section 2 Fondations UX
- 7 composants partagés : PeriodSelector, KPICard, ViewToggle, FiltersPanel, CreateOnFlySelect, ImageUpload, EmptyState.

## Session 1 — Rebrand & Langue
- Rebrand complet "Chez Dina", français only, Sora + IBM Plex Serif, ErrorBoundary sur toutes les routes, labels paiement humanisés ("Paiement à la livraison").

## Architecture
- **Backend**: FastAPI `/api`, MongoDB motor, JWT cookie + Bearer, bcrypt, PIN 4-chiffres.
- **Frontend**: React 19, React Router 7, Tailwind + Shadcn + Recharts + sonner + lucide-react + **react-leaflet** (OSM), **Sora** (body) + IBM Plex Serif (titres), palette red/pink #b02a2a.
- **AI**: Claude Sonnet 5.5 via Emergent Universal Key — floating "Dina IA" sur chaque page Console.
- **Routes**: `/boutique` (public), `/console/*` (back-office), `/console/livreur` (mobile rider), `/suivi/:code` (public tracking), `/noter/:code` (public rating), `/login`.

## Credentials (`/app/memory/test_credentials.md`)
- Admin: `aouattaraesca@gmail.com` / `Admin123!` · PIN 1234
- Manager: `manager.cocody@dinastore.ci` / `Manager123!` · PIN 2222
- Rider: `rider1@dinastore.ci` / `Rider123!` · PIN 5555

## Backlog
### P0 — Section 8 (prochaine session)
- Segments clients auto (VIP, Dormants, Nouveaux, Blacklist déjà existant)
- Campagnes WhatsApp panier abandonné (scheduler + templates)
- Modération avis par lot
- Fidélité : règles configurables (points par X FCFA, paliers, cadeaux)
- Parrainage : code unique par cliente + tracking conversions
- Scheduler ventes flash avec affiche auto-générée

### P1 — Section 9
- Dépenses : catégories custom + récurrence
- Employés : fiches complètes + horaires
- Rôles & permissions : matrix UI complète
- Pointage kiosk : écran dédié + PIN

### P2 — Sections 10, 11, 12
- CMS site vitrine (section builder drag & drop)
- Compte cliente par code secret 4-6 chiffres (pas d'SMS OTP)
- Paramètres + Intégrations WhatsApp Meta, Pixels, imprimante Wi-Fi
- Checklist d'acceptation finale (section 12 du cahier des charges)
