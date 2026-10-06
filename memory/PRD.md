# Chez Dina — PRD

## Problem Statement
Chez Dina — retail OS femme Abidjan Cocody Angré 7e. Français, FCFA, Africa/Abidjan. 3 faces: Console / Rider / Storefront. TikTok @dinoush04 · WhatsApp +225 07 77 92 61 79.

## Fix pack 1 (Feb 2026) — Bugs, demo data & interface rules

### Fait
- **Sidebar réorganisée** exactement selon spec : Tableau de bord seul en haut, puis Ventes · Livraison · Produits & achats · Clients & marketing · Équipe · Site vitrine · Pilotage · Paramètres · Manuel.
- **AI floating button** masqué sur /console/pos (ne couvre plus "Encaisser").
- **POS cart overflow** : grid lg:grid-cols-[1fr_min(400px,33vw)], scrollable, visible à 1280 px.
- **Rider spelling** : Historique tabs rendus avec labels accentués (Livrées / Annulées / Reportées / Échecs).
- **Sora global** : CSS unifiée, IBM Plex Serif supprimé, `.font-serif` → Sora 600.
- **Search icon spacing** : règle CSS globale `.dina-input.pl-9/pl-10` pour éviter chevauchement.
- **Demo seed** : POST /api/admin/seed-demo génère 300 clientes · 300 commandes 6 mois · 80 dépenses · 500 visites · 20 waitlist · 30 paniers abandonnés · 30 avis · 5 fournisseurs. Tag DEMO_PACK1. DELETE /api/admin/demo-data pour cleanup.
- **Routes nouvelles** : /console/accueil (SectionBuilder), /console/apercu (redirect boutique), /console/finances (redirect /resultat), /console/segments (WhatsAppCampaigns), /console/manuel (Placeholder).
- Bouton **"Supprimer les données de démonstration"** dans Settings (admin only).

### Reste pour Pack 1
- Bugs 1,2 (Period filter crash + Dashboard charts empty) — à investiguer en Pack 3.
- Bugs 3,4 (Livraison 3 pages différentes) → Pack 4.
- Bugs 5,6,8,9 (Catégories, Approvisionnements, IA desc, SEO section vide) → Pack 5.
- Bug 7 (Site vitrine pages) → Pack 8.
- Bug 10 (Statistiques Zones) → Pack 7.
- Bug 11 (POS loading grey) → fix via demo seed (produits chargés). Si persiste en Pack 3.
- KPI compact format "77,4 M FCFA" + tooltip → Pack 3.
- Toggle Tableau/Grille/Kanban généralisé → Pack 3.
- Standardisation du Period filter sur toutes les pages → Pack 3.

## Fix pack 2 (Feb 2026) — Internal control, roles, cash & attendance

### Backend (3100+ lignes)
- **ROLE_TEMPLATES** : gerante, livreur, caissiere avec permissions pré-remplies.
- **/roles CRUD** : GET (avec user_count + pending_approvals), POST, PATCH, DELETE. builtin=False non modifiables.
- **/approval-requests** : POST (créer demande), GET (liste), POST /{id}/decide (approuver/rejeter → audit).
- **/expense-requests** : POST (Gérante soumet), GET, POST /{id}/decide → crée expense si approuvée.
- **/audit-logs** : GET (admin), tracé automatique sur role.*, approval.*, expense_request.*, cash.*, stock.adjust.
- **Cash sessions handover** : POST /{sid}/declare-handover (Gérante déclare), POST /{sid}/validate-handover (owner valide, gap → manager_balance).
- **/manager-balance/{mid}** : solde cumulé Gérante.
- **Attendance complet** : /check-in (selfie + GPS + geofence Haversine + late detection + flags), /me, /today, /calendar/{eid}, /stats/{eid}. Flag "depart_sans_reconciliation" automatique pour riders. Geofence mandatory → 400 si hors zone.
- **/business/geofence** et **/business/working-hours** PATCH.
- **/stock/adjustments** : admin → appliqué + audit, sinon → approval_request.
- Legacy /attendance/today renommé /attendance/today-kiosk.

### Frontend
- **CheckInGate.jsx** (nouveau) : selfie live caméra avant + GPS + submit, blocage toutes les tabs rider.
- **RiderShell.jsx** : charge /attendance/me, affiche CheckInGate si !checked_in, badge "● Pointé" dans la topbar.
- **Pointage.jsx** (réécrit) : KPIs présents/retards/hors boutique, liste aujourd'hui avec selfie, non-pointés, geofence (lat/lng/rayon/mandatory), horaires par rôle (open/close/tolerance), détail employé (calendrier mensuel coloré + stats ponctualité).
- Route `/console/pointage` → Pointage (remplace Kiosk).

### Reste pour Pack 2
- UI RolesPermissions matrice complète (4 niveaux par cellule) → simplifier/ajouter en Pack ultérieur.
- UI CashSessions workflow handover/validate — endpoints prêts, UI à brancher.
- Blind inventory UI → Pack 5.
- Audit log viewer owner UI → à ajouter dans RolesPermissions.
- Store tablet kiosk mode pour Gérante → endpoint existant (/attendance/punch-kiosk).

## Sessions précédentes
- **S14 Phase A/B/C** — POS v3, Produits v3, Storefront finalization
- **S13** — Storefront v3 initial + Rider offline
- **S12** — Rider Space v2
- **S11** — Rebrand + CMS + Caisse + P&L
- **S10** — CMS Vitrine + Compte Cliente
- **S9** — WhatsApp auto + Fidélité
- **S8** — Board DnD + GPS + QR

## Credentials
- Admin `aouattaraesca@gmail.com` / `Admin123!` · PIN 1234
- Manager `manager.cocody@dinastore.ci` / `Manager123!` · PIN 2222
- Rider `rider1@dinastore.ci` / `Rider123!` · PIN 5555
- Cliente démo `+225 07 60 17 28 21` · code `142085`

## Backlog ordonné
### Pack 3
- Period filter crash fix + Dashboard charts + POS loading
- KPI compact format + toggle Tableau/Grille/Kanban
- Facturation move into Commandes
### Pack 4
- Livraisons: journées / livreurs / zones séparés
### Pack 5
- Catégories & collections distinct · Approvisionnements vs Fournisseurs · AI description fix · SEO section
### Pack 6/7
- Statistiques zones · Marketing
### Pack 8
- Site vitrine pages/menu/SEO distincts
### Pack 9
- Finale + optimisations
