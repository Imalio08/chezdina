# Chez Dina — PRD

## Fix pack 4 (Feb 2026) — Livraison : 3 pages distinctes + score détaillé

### Backend
- Endpoints existants réutilisés : `/zones` CRUD, `/delivery-sessions` POST/GET/add-order/reconcile/close, `/riders/{rid}/score` avec weights + components (delivery_rate 35, punctuality 20, rating 25, cash 10, proof 10).

### Frontend — 3 pages distinctes
- **Zones.jsx** (nouveau) : KPIs (actives, tarif moyen, top zone, frais 30j), table CRUD (nom/communes/tarif/seuil offert/délai/couleur/statut/cmd 30j), formulaire modal.
- **Riders.jsx** (nouveau) : grid/table toggle, KPIs (actifs, livraisons jour, score moyen, soldes), cartes livreur avec photo + stats + score ⭐, page profil avec breakdown score pondéré (barres de progression) + explication textuelle.
- **DeliveryDays.jsx** (nouveau) : KPIs (ouvertes/clôturées/à encaisser/écarts), table journées, bouton "+ Créer une journée" avec date picker. Page détail avec 4 tabs : Affectation (checkbox selection + bouton "Affecter à…" vers un livreur, pas de drag), Suivi (statuts live), Réconciliation (par commande : articles/livraison/déjà payé/à encaisser/déclaré/écart), Fiches & feuilles de route (imprimer).
- Routes `/console/livraisons` → DeliveryDays · `/console/livreurs` → Riders · `/console/zones` → Zones.
- Rider space : scanner déjà retiré (préparation = Gérante côté console).

### Reste Pack 4 (à itérer)
- Carte Suivi avec Leaflet (actuellement liste simple)
- Suggestion automatique d'affectation par zone
- Clôture auto reportées → journée suivante
- Rider : écran "Confirmer la remise" avec code 4 chiffres déjà présent, calendar filter Historique à ajouter

## Fix pack 3 — Ventes POS/Commandes/Waitlist/Carts (voir précédent)
## Fix pack 2 — Internal control
## Fix pack 1 — Bugs, demo data

## Credentials
- Admin `aouattaraesca@gmail.com` / `Admin123!` · PIN 1234
- Manager `manager.cocody@dinastore.ci` / `Manager123!` · PIN 2222
- Rider `rider1@dinastore.ci` / `Rider123!` · PIN 5555
- Cliente démo `+225 07 60 17 28 21` · code `142085`

## Backlog
- Pack 5 : Catégories, Approvisionnements, AI desc fix, SEO
- Pack 6/7 : Statistiques, Marketing
- Pack 8 : Site vitrine pages/menu/SEO
- Pack 9 : Finale + optimisations
- Refactor server.py (3500 lignes) après Pack 9
