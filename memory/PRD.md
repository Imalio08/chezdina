# Chez Dina — PRD

## Problem Statement
**Chez Dina** — all-in-one retail OS for a women's fashion boutique in Abidjan (Cocody Angré 7e). Single codebase powers three faces: **Console** back-office, **Rider** mobile delivery space, and public **Storefront**. **Français uniquement**, FCFA (XOF), Africa/Abidjan. TikTok @dinoush04 · WhatsApp +225 07 77 92 61 79.

## Session 7 (Feb 6 2026) — Section 6 compléments + Section 7 Catalog v2
### Section 6 compléments
- **Bouton "Imprimer fiches du jour"** sur la page Livraisons → route directe vers `/console/fiches-colis` qui liste toutes les commandes prêtes/assignées/en_livraison.
- Backend `public_order` + `public_rate` endpoints restaurés après conflit de nommage avec `public_create_order` (collision F811 ruff).

### Section 7 Catalog v2 — Nouveau formulaire produit (`Products.jsx` refondu)
- **Grid 2 colonnes** desktop : Informations générales (nom, catégorie **CreateOnFlySelect**, marque **CreateOnFlySelect**, matière, saison) · Prix & marge avec **marge calculée en live** (vert ≥40%, orange, rouge <20%).
- **ImageUpload multi** (jusqu'à 6 photos, compression WebP ~400 Ko, première image = vitrine) remplaçant l'ancien input URL.
- **Bouton "Rédiger avec l'IA"** sur la description → POST `/ai/ask` avec un prompt structuré (catégorie, marque, matière, prix) → insère la réponse dans le textarea.
- **Pills tailles & couleurs** : pointures 36-41 si catégorie chaussure/mule/sandale, sinon XS-XXL. Pills couleurs standard. Sélection multi-click.
- **Bouton "Générer la matrice de variantes"** → crée automatiquement `stock_by_size` avec 2 unités par taille sélectionnée. **Tableau variantes** : par taille, stock initial éditable, valeur au coût calculée, ligne Total en bas.
- Toggle visibilité : Boutique + site · Boutique uniquement · Site uniquement.
- Liste produits enrichie : colonne **Marge %** avec coloration (vert ≥40% / rouge <20%).

### Composants partagés utilisés
- `ImageUpload` (session 2) · `CreateOnFlySelect` (session 2) · `ErrorBoundary` auto via App.js.

### Testé en curl
- Backend health OK · Public fetch OK · Public rate submit OK · Frontend compile OK sans erreurs module.

### Non livré dans cette session (deferred)
- Journées de livraison avec drag&drop d'affectation (board unassigned/par livreur colonnes) — Deliveries actuel fonctionne par dropdown
- Réconciliation du soir ligne-par-ligne avec validation PIN gérante — réconciliation existe mais sans PIN auth
- GPS live rider tracking carte — pas de WebSocket actif
- Approvisionnements 4-steps wizard — Purchases.jsx actuel reste en modal simple (CRUD complet session 2 déjà en place)
- Étiquettes produits QR par variante à la réception

## Session 6 (Feb 6 2026) — Section 6 Delivery full redesign (partiel)
### Nouveaux endpoints backend
- `GET /api/public/order/{code}` → récupère les infos safe d'une commande (nom cliente, items, livreur, date livraison) depuis l'extérieur sans auth, pour la page de notation
- `POST /api/public/rate/{code}` → la cliente soumet rating (1-5), rider_rating, comment, recommend. Stocké dans `order_ratings` + agrégé sur `orders.rating`

### Nouvelle page `/app/frontend/src/pages/console/FichesColis.jsx`
- Accessible via sidebar **Livraison > Fiches colis** et route `/console/fiches-colis`.
- Liste toutes les commandes en statuts prete/assignee/en_livraison avec checkbox sélection + "Tout sélectionner".
- Sélecteur de format : **Thermique 80mm · A6 100×150mm · A4 — 4 par feuille**.
- Bouton Imprimer déclenche `window.print()`, les éléments `.print:hidden` disparaissent.
- Chaque fiche contient : logo Chez Dina + téléphone + TikTok, **QR code du code commande** (via api.qrserver.com), numéro large, date livraison, cliente avec téléphone en gras, zone + adresse + **mini-QR Google Maps pour itinéraire**, articles détaillés (qty × nom · taille · couleur), montants (articles / livraison / total), **badge "À encaisser X FCFA" en rouge** OU **"Déjà payé" en vert**, livreur assigné, notes italique.
- CSS print rules pour pagination correcte selon le format.

### Nouvelle page publique `/noter/:code`
- Route publique dans App.js, lien envoyé par WhatsApp aux clientes après livraison.
- Form : étoiles pour la commande (obligatoire), étoiles pour le livreur si assigné, textarea commentaire, boutons 👍/👎 "Recommanderiez-vous Chez Dina ?".
- Design mobile-first avec logo rouge Chez Dina en haut, écran de succès "Merci {prénom} !" après soumission.

### Rider.jsx entièrement refondu
- Nouveau header avec bouton direct **"Gérante"** (WhatsApp vers manager) en plus du logout.
- Strip 3 KPI live sur l'onglet Courses : **À livrer · Livrées · Collecté (FCFA)**.
- Nouveau statut **"Récupérée" (recuperee)** entre Assignée et En livraison, ajouté dans `format.js` statusLabel/statusColor + supporté backend.
- Cartes courses enrichies : affichage "À encaisser X FCFA" en rouge gras si COD, "Déjà payé" vert sinon.
- Bottom-sheet commande détaillée :
  - 3 gros boutons action : **Appeler (tel:) · WhatsApp vert · Itinéraire bleu (ouvre Google Maps directions avec adresse)**
  - Articles détaillés avec taille/couleur, livraison séparée, total avec couleur selon mode paiement
  - 5 boutons statuts : **Récupérée (pour assignee) → En route → Livrée verte → Reportée orange → Annulée/Échec rouge**
  - **Sheet "Annulée"** : 7 motifs preset cliquables + commentaire optionnel, confirmer envoie reason au backend
  - **Sheet "Reportée"** : date picker (demain par défaut) + motif, confirme → change status en "confirmee" avec next_date
- Onglet Encaissements : 2 KPI (Collecté aujourd'hui vert / Reste à encaisser rouge) + détail des livraisons payées cash
- Onglet Profil : KPIs (livraisons jour, taux de réussite, reste à encaisser) + bouton "Signaler un problème" → WhatsApp gérante

### Testé en curl
- Backend OK · Public order fetch OK · Public rate submit OK (5★ + commentaire) · Status 'recuperee' accepté par `/orders/{id}/status` ✅

## Session 5 (Feb 6 2026) — Section 5 POS cash control
### Nouveaux endpoints backend (contrôle caisse)
- **`POST /api/pos/pin-authorize`** → vérifie le PIN d'un admin/gérante actif (`attendance_code` + role in admin/manager) et logge l'approbation dans `pos_authorizations` (requested_by/approved_by/action/amount). Retourne 403 si PIN invalide.
- **`POST /api/cash-movements`** + **`GET /api/cash-movements?date=YYYY-MM-DD`** → entrées/sorties d'espèces. Le GET renvoie aussi `cash_sales` (ventes espèces du jour), `ins`, `outs` et **`expected`** = cash_sales + ins − outs, qui est le montant attendu en caisse au closing.
- **`POST /api/pos/holds`** + **`GET /api/pos/holds`** + **`DELETE /api/pos/holds/{id}`** → commandes ouvertes (hold cart). Expiration automatique après N heures (défaut 24h).

### Nouveau composant `/app/frontend/src/components/pos/POSExtensions.jsx`
- **`PinAuthModal`** : modal centré avec input PIN à 4-6 chiffres (tracking large façon code sécurisé), affiche l'action demandée + montant, erreur en FR si PIN invalide, toast de succès avec nom de l'approbateur.
- **`CashDrawer`** : panel qui glisse du bas (mobile) ou centré (desktop) avec 4 KPI (Ventes espèces, Entrées, Sorties, **Attendu en caisse** en rouge), formulaire Nouveau mouvement (toggle Entrée/Sortie, montant, motif dropdown avec 4-5 presets, note), historique du jour avec icônes vertes/rouges.
- **`HoldsPanel`** : liste des commandes ouvertes avec cliente/montant/items/note/user/date, boutons Reprendre (restore cart + customer) et Supprimer.

### POS.jsx mis à jour
- Deux nouveaux chips header **"Ouvertes" (PauseCircle)** et **"Caisse" (Banknote)** à côté de la search bar.
- Nouveau bouton **"Mettre en attente" (PauseCircle)** sur le panier (quand items > 0) qui prompt une note puis POST `/pos/holds` et clear le cart.
- **Garde-fou remise > 20%** : si l'utilisatrice tape une remise supérieure à 20% du sous-total, la modal PIN s'ouvre automatiquement et bloque jusqu'à validation par le PIN d'une gérante. Après validation, l'icône Shield verte apparaît à côté du champ pour montrer que c'est autorisé.
- `onResume` reconstruit le cart item par item + attache la cliente d'origine.

### Testé en curl
- PIN 1234 (admin) → `ok=True, approver=Aïcha Ouattara` ✅
- PIN 9999 → 403 "PIN invalide ou droits insuffisants" ✅
- Cash entrée 50 000 FCFA fond de caisse → stocké ✅
- Cash summary → M:1, cash_sales:0, ins:50000, outs:0, expected:50000 ✅
- Hold create → ID retourné · Hold list → 1 ouverte avec cliente Fatou · Delete → ok ✅

## Session 4 (Feb 6 2026) — Section 4 Dashboard & Statistiques v2
### Dashboard "À traiter maintenant"
- Nouveau composant `/app/frontend/src/components/dashboard/ActionItems.jsx` au-dessus des KPI, mis à jour chaque minute.
- 8 cartes action live, chacune cliquable vers la page filtrée : À confirmer · À préparer · À assigner (prêtes sans livreur) · En livraison (avec breakdown par livreur) · Ruptures · Stock bas · Paniers abandonnés · Avis à valider.
- Badge rouge "⏱Xmin" sur la plus vieille commande en attente.
- Nouveau endpoint backend **`GET /api/dashboard/action-items`** qui calcule tout en live depuis Mongo (count_documents + aggregation).
- Les KPI existants sont désormais **groupés par domaine** (Ventes · Opérations) avec titres et sous-lignes contextuelles.

### Statistiques — bibliothèque de rapports (tabs)
- Nouvelle architecture en 5 tabs : Ventes & produits · **Zones géographiques** · Clientes · Livraisons · Finances.
- **Nouveau tab Zones** : 4 KPI (zones actives, clientes géolocalisées, commandes, CA total), bar chart "Part du CA par zone" (top 8), bar chart "Commandes vs Livrées par zone", **tableau détail 10 colonnes** (zone, tarif, clientes, commandes, livrées, CA, part CA, panier moyen, taux annulation, frais encaissés).
- Backend endpoint **`GET /api/stats/zones?period=`** qui calcule tout par zone depuis orders+customers+zones Mongo.
- Nouveau tab Finances avec **Compte de résultat** : CA − coût marchandises = Marge brute − dépenses = Résultat net (coloré rouge/vert).
- Tab Ventes & produits enrichi : ajout du **Taux de marge** (%) et des charts Top pointures + Top couleurs avec légendes toujours visibles.

### Résultats testés en curl
- Action items réels : 14 nouvelles / 27 préparation / 17 à assigner / 17 en livraison / 0 ruptures / 1 stock bas / 6 paniers / 0 avis
- Zones (30j) : 13 zones actives · 300 clientes · 47 commandes · 5 280 500 FCFA · Top : Cocody 13.9% · Angré 10.6% · Port-Bouët 7.8%

## Session 3 (Feb 6 2026) — Navigation + Dina IA
### 3.1 Sidebar refaite en 10 sections dépliables
- Pilotage · Ventes · Livraison · Catalogue & stock · Achats · Clientes & marketing · Finances · Équipe · Site vitrine · Paramètres
- Chaque section a un header cliquable avec `ChevronDown/ChevronRight` qui plie/déplie et persiste l'état dans `localStorage.dina_sidebar_open`.
- **40+ liens** vers tous les sous-modules du cahier des charges. Les modules pas encore implémentés routent vers un composant **`Placeholder.jsx`** qui affiche un `EmptyState` "Bientôt disponible" — sidebar fonctionnelle à 100%.
- **Role-filtering** : sections/items avec `adminOnly: true` cachés pour les non-admins (Paramètres, Rôles & permissions).
- Menu utilisateur en bas de la sidebar : avatar/nom/rôle cliquable → sous-menu "Mode sombre/clair · Changer d'utilisateur · Déconnexion".

### 3.2 Topbar enrichi
- Logo "Chez Dina · Console" (plus de store selector).
- Search Ctrl+K ✅ · Chip indicateur online/offline ✅ · Theme toggle ✅ · Bell avec unread count ✅.
- **Nouveau bouton "+ Créer"** avec dropdown 6 raccourcis : Nouvelle vente / Nouvelle commande / Nouveau produit / Nouvel approvisionnement / Nouvelle dépense / Nouvelle cliente. Chaque lien va à la page concernée avec `?new=1` query pour auto-ouvrir le formulaire.

### 3.3 Dina IA — widget flottant retravaillé
- Button `Sparkles` en bas-droite partout, avec badge nombre de réponses précédentes.
- Panel 400px × 600px, header gradient red→amber, titre "Dina IA · En ligne · contexte : {pathname}".
- Boutons dans l'entête : **Nouvelle conversation (+)**, **Réduire (Minimize2)** → bascule en pastille compacte "Dina IA" en bas-droite qui restaure au clic, **Fermer (X)**.
- Conversation persistée dans `sessionStorage.dina_ai_history` (jusqu'à 30 messages, reset entre sessions).
- **Chips contextuelles par page** (`CHIPS_BY_PAGE`) : Dashboard → "CA cette semaine ?", "Résumé du jour", "Clientes inactives ?", "Pointures en rupture ?" · Produits → "Top produits ce mois", "Produits jamais vendus", "Marge moyenne" · Stock → "Quelles pointures racheter ?" · Commandes → "Taux d'annulation ce mois" · Livraisons → "Livreur avec plus d'annulations" · etc. (défaut si page inconnue).
- Rendu messages avec markdown léger (**gras**, retours ligne), badge `TOOL:xxx` sous chaque réponse pour montrer la source.
- État `error` affiche un fond rouge discret.

### 3.4 Dina IA — Tool-calling côté backend (vraies données, jamais inventées)
Six outils implémentés dans `server.py` qui calculent sur Mongo en direct :
- `_ai_tool_sales(period_days)` → CA + nombre commandes + comparaison vs période précédente
- `_ai_tool_top_products(period, limit)` → classement par CA
- `_ai_tool_stock_alerts()` → produits sous seuil 5
- `_ai_tool_inactive_customers(days)` → clientes avec total_spent > 0 sans commande récente
- `_ai_tool_rider_perf(period)` → livreurs classés par taux d'annulation
- `_ai_tool_daily_summary()` → résumé 3-blocs (jour + semaine + alertes stock)

**Router** `_match_tool(q)` repère les intentions via mots-clés FR (résumé/brief, rupture/stock bas, inactif/pas commandé, livreur+annul, top/meilleur/rentable, ca/chiffre/vente) → appelle l'outil adapté, retourne `{answer, source:"tool:xxx"}`. Si pas de match → fallback LLM (Claude Sonnet via Universal Key) avec contexte DB (counts + top5) + info page courante. En dernier recours : résumé local avec `error:True`.

**Testé en curl** : 5 des 6 questions-types matchent un tool réel avec chiffres de la DB (CA cette semaine, Top 5, Rupture, Résumé, Livreur avec annulations), 1 question tombe sur fallback (quand "clientes inactives" matché mais LLM erreur → résumé local propre).

### Validé via Playwright
- Login via localStorage token → `/console` rendu, 10 sidebar sections dépliables, menu "+ Créer" ouvre 6 raccourcis, AI chat panel + chip "CA cette semaine ?" → réponse réelle "629 500 FCFA sur 9 cmd · +16.9%" avec badge `TOOL:SALES`, minimize → pastille restorable.

## Session 2 (Feb 6 2026) — Section 2 Fondations UX
### Composants partagés créés dans `/app/frontend/src/components/shared/`
- **`PeriodSelector.jsx`** : 14 presets (Aujourd'hui, Hier, Cette semaine, Semaine dernière, 7j, 30j, Ce mois, Mois dernier, Ce trimestre, Trimestre dernier, Cette année, Année dernière, Depuis le début, Personnalisée). Dropdown avec date pickers Du/Au pour custom. Sélecteur comparaison intégré (Période précédente / Même période l'an dernier / Aucune). Helpers `resolvePeriod()` + `previousPeriod()` exportés pour calculer les bornes dates côté caller.
- **`KPICard.jsx`** : Carte avec icône dans un carré coloré, label uppercase, value très large tabular, delta auto-calculé depuis `previousValue` (sens up/down/flat avec `inverse` pour KPI où monter = mauvais comme dépenses/annulations), couleurs vert #1f8a4c / rouge #c62828 / gris, info-tooltip (hover ou tap), lien **Rapport ›** vers détail, **sparkline** area chart si tableau de points fourni, variante `hero` double-colonne pour KPI principal.
- **`ViewToggle.jsx`** : toggle Tableau/Grille/Graphique/Kanban avec icônes lucide. Hook `useStoredView(tabKey)` qui persiste le choix par onglet dans `localStorage` (`dina_view_<tab>`).
- **`FiltersPanel.jsx`** : chip "Filtres" avec badge nb actif, side-sheet qui glisse de la droite avec champs typés (select, text, number, range min/max, multi tags), chips supprimables sous la barre + "Tout effacer", **Vues enregistrées** (sauvegarde par tabKey dans `localStorage`, charger/supprimer).
- **`CreateOnFlySelect.jsx`** : select avec option `+ Ajouter …` en bas qui bascule en mode input + Enter pour créer + Escape pour annuler. Callback `onCreate(value)` pour que le parent persiste et sélectionne immédiatement sans quitter le formulaire.
- **`ImageUpload.jsx`** : drag & drop + bouton parcourir + bouton appareil photo (mobile), compression Canvas → WebP (resize 1200px, qualité adaptative pour tenir sous `maxKB`, défaut 500 Ko), grid preview avec badge "Principale" sur la première image, boutons "Principale"/supprimer au hover, mode `single` pour avatars/logos. Retourne data URLs → stockage DB simple pour le MVP, pas de backend upload.
- **`EmptyState.jsx`** : état vide standard (icône, titre, description, action), évite les 0 et messages d'erreur quand il n'y a pas de données.

### Dashboard refondu (démo d'intégration des composants)
- Utilise **PeriodSelector** + **KPICard** (hero sur CA, sparkline sur CA et commandes).
- Header reformulé : "Chiffres au {date}, {heure} · comparaison vs les 30 jours précédents".
- Section titrée "Chiffres clés" + sous-ligne descriptive avant la grille KPI.
- Carte "Accès rapides" en bas avec chips cliquables vers les drill-downs (commandes, clientes, livrées, en cours, stock faible, dépenses).
- Modal drill-down déjà dark-mode compatible.

### Validé via Playwright
- 10 KPI cards nouvelles détectées, PeriodSelector cliquable, light + dark mode OK.
- Backend `/dashboard/kpis?period=30d` renvoie bien `revenue/prev/delta/description` + `sales_series` + `channels` + `top_products` + `payments`.

## Session 1 (Feb 6 2026)
### Rebrand & langue
- Rebrand complet "Chez Dina" partout (API title, business doc, storefront footer, login footer, invoicing header + PDF export, POS receipt, rider header). "Dina Store"/"Chez Dina Boutique" → **Chez Dina**.
- `index.html` title → "Chez Dina — Console".
- **Toggle langue retiré** du topbar (français only).
- **Store selector retiré** du topbar (single store, `store_id` reste en DB pour multi-store futur).

### Error Boundaries
- Nouveau composant `/app/frontend/src/components/ErrorBoundary.jsx` (mode page ou widget compact).
- Chaque route Console enveloppée dans `<ErrorBoundary>` dans `App.js` → un onglet qui crash affiche une carte "Oups, un problème est survenu · Réessayer / Recharger" en français avec détails techniques repliables. Le reste de l'app continue de tourner.
- Même protection sur Rider.

### P0 bugs fixés
1. **Onglets qui crashaient** → protégés par ErrorBoundary + bugs structurels corrigés en sessions précédentes (useEffect retournant Promise, rendering d'objets).
2. **Search bar** → raccourci **Ctrl+K / Cmd+K** actif, placeholder enrichi (produits/variantes/clientes/commandes).
3. **Bell notifications** → endpoint réel `/api/notifications` (session précédente).
4. **Dark mode** → polish complet (session précédente).
5. **Toggle langue** → **retiré**.
6. **AI assistant** → gestion d'erreur francisée : "Je n'arrive pas à récupérer la réponse IA pour le moment. Voici un résumé local…" (plus de `(Erreur IA : ...)` technique). Flag `error: True` renvoyé pour que le front affiche un bouton Réessayer.
7. **POS "Tous"** → grille déjà uniforme (vérifiée).
8. **Chart legends** → `wrapperStyle` déjà toujours visible dans Dashboard/Statistics (session précédente).
9. **Voir détails** → drill-down vers onglets filtrés (session précédente).
10. **Rider** → "Dina Livraison" → "Chez Dina · Livreurs". Flow stable.

### Labels paiement humanisés
- "Cash", "Cash à collecter", "Cash à livrer", "À livrer" (bouton POS) → **"Paiement à la livraison"** partout (Deliveries, POS, Rider, Storefront).

## Architecture
- **Backend**: FastAPI `/api`, MongoDB motor, JWT cookie + Bearer, bcrypt, PIN 4-chiffres.
- **Frontend**: React 19, React Router 7, Tailwind + Shadcn + Recharts + sonner + lucide-react, **Sora** (body) + IBM Plex Serif (titres), palette red/pink #b02a2a.
- **AI**: Claude Sonnet 5.5 via Emergent Universal Key — floating "Dina IA" sur chaque page Console.
- **Routes**: `/boutique` (public), `/console/*` (back-office), `/console/livreur` (mobile rider), `/suivi/:code` (public tracking), `/login`.

## Credentials (`/app/memory/test_credentials.md`)
- Admin: `aouattaraesca@gmail.com` / `Admin123!` · PIN 1234
- Manager: `manager.cocody@dinastore.ci` / `Manager123!` · PIN 2222 (emails techniques conservés)
- Rider: `rider1@dinastore.ci` / `Rider123!` · PIN 5555

## Backlog (sessions suivantes)
### Session 2 — Section 2 (UX globales, fondations)
- Composants partagés : `PeriodSelector` (presets + custom range + comparison), `FiltersPanel` (side-sheet avec saved views + URL state), `KPICard` enrichi (sparkline, info tooltip, Voir détails), `ViewToggle` (Tableau/Grille/Graphique/Kanban), `CreateOnFlyDropdown`, `ImageUpload` (drag+drop, multi, WebP compression), détail page template.

### Section 3 — Navigation + Dina IA
- Sidebar refactor en sections collapsibles (10 groupes du cahier des charges).
- Topbar quick-actions "+" (Nouvelle vente, Nouvelle commande, Nouveau produit, Nouvel appro, Nouvelle dépense, Nouveau client).
- Dina IA avec **tool-calling** (get_sales, get_top_products, get_stock_alerts, …), vision multimodale (photos produits, factures fournisseurs → OCR + pré-remplissage), création catalogue/promos/affectations par langage naturel avec carte de confirmation + log + undo 10min.

### Sections 4-11 (à faire)
- Section 4 : Dashboard refondu + Statistiques (14 onglets de rapports, KPI dictionary complet avec formules).
- Section 5 : POS enrichi + Commandes avec édition complète + Factures/devis + reçu redesigné 80mm.
- Section 6 : Delivery full redesign — Journées de livraison, Réconciliation du soir, Fiches colis QR, Rider space v2.
- Section 7 : Catalogue — statuts produits, création avec variant matrix, Approvisionnements 4-steps, Fournisseurs stats, Scan barcode/QR.
- Section 8 : Clients deep + Paniers abandonnés auto + Avis + Fidélité configurable + Parrainage + Promotions avec affiches + Campagnes WhatsApp.
- Section 9 : Dépenses + Employés + Rôles & permissions matrix + Pointage kiosk.
- Section 10 : Storefront CMS + section builder + account par code secret 4-6 chiffres.
- Section 11 : Paramètres + Intégrations (WhatsApp Business Embedded Signup, Meta/TikTok Pixel, Wave, imprimante WiFi).
- Section 12 : Checklist d'acceptation.


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

## Implemented (Feb 6 2026 — this session)
### Dark Mode Polish
- All cards/tables/modals/inputs auto-recolour via `html.dark` cascade and CSS variable overrides.
- **Recharts** fully themed: grid lines, axis labels, legends and tooltips swap to dark palette (`.recharts-cartesian-grid line`, `.recharts-text`, `.recharts-tooltip-wrapper`).
- Hover states, soft-red backgrounds, text/border colour utilities (`bg-white`, `bg-[#fff5f5]`, `text-[#666]`, `border-[#ececec]`, etc.) all have dark-mode variants — no more glaring white panels at night.

### Smart Notifications (real-time, from DB)
- New backend endpoint `GET /api/notifications` aggregates in real-time from Mongo collections:
  - New orders (status=nouvelle) · Low-stock products (stock<5) · Pending reviews · Back-in-stock alerts not notified · Abandoned carts not recovered
- Each notification has `id/type/title/msg/at/link/color`; sorted newest first; capped at 30.
- Frontend bell: unread count badge (red pill), polls every 30s, click-through routes to the right tab, "Tout lu" button, read-state persisted in localStorage, time-ago formatting.

### Flash Sale Scheduler (one-tap)
- New ⚡ "Vente flash" button on Promotions page opens dedicated modal:
  - Discount slider 5–70% · Duration presets (1h/6h/24h/48h/7j) or custom datetime
  - Auto-generated code (editable), channel picker, min-order cap, live end-time preview
- Fires `POST /api/promotions` with `flash:true`, `starts_at=now`, `ends_at` computed — storefront picks it up instantly via `/public/promotions` and renders the live countdown banner.

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
