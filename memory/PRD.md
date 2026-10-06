# Chez Dina — PRD

## Problem Statement
Chez Dina — retail OS femme Abidjan Cocody Angré 7e. Français, FCFA, Africa/Abidjan. 3 faces: Console / Rider / Storefront. TikTok @dinoush04 · WhatsApp +225 07 77 92 61 79.

## Fix pack 3 (Feb 2026) — Ventes : POS, Commandes, Liste d'attente, Paniers abandonnés

### Backend
- **/waitlist/grouped** : groupe par produit + taille + couleur avec client list + KPIs (pending / products_affected / customers_total / conversion_pct)
- **/waitlist/{wid}/notify** : notification WhatsApp immédiate
- **/public/out-of-catalog** (public) et **/out-of-catalog** (admin) : regroupement par mot-clé
- **/abandoned-carts/{aid}** : détail enrichi (customer stats, reminders history)
- **/abandoned-carts/relaunch** : POST avec cart_ids ou period, offer_type (none/pct/amount/special_price/free_delivery/gift), value, dates, channels (whatsapp/inapp/both), message avec variables {prénom}/{produits}/{code}/{date_fin}/{lien_panier}
- **/orders/{oid}/status-v3** : role-enforced transitions (admin libre, manager interdit livrée/annulée/reportée/échoué, rider terrain seulement). Admin override avec reason obligatoire. Scan check pour "prete". Invoice auto générée à "livree".
- **/orders/{oid}/invoice** et **/orders/{oid}/generate-invoice** : récupération + génération manuelle

### Frontend
- **POS Liste view** : table une ligne par produit (image/nom/marque/catégorie/SKU/tailles+stock/couleurs/stock/prix/+Ajouter). Toggle Liste/Grille (Liste par défaut). Chip "Meilleures ventes" filtre top 8. Sort A-Z/Prix/Stock. Clic +Ajouter → sheet variante.
- **Cart stock restant** : chaque ligne affiche "Reste N en stock", rouge si dépassement + bloque Encaisser.
- **Waitlist.jsx** (nouveau, remplace AlertsAndCarts) : KPIs, groupes expandables par produit/variant, actions Notifier/Retirer, tab "Demandes hors catalogue".
- **AbandonedCarts.jsx** (nouveau, remplace AlertsAndCarts) : KPIs (count/valeur/relancés/récupérés/taux/CA récupéré), table sélectionnable, panneau détail latéral (cliente stats + panier full + relances envoyées), formulaire "Relancer" avec offre + variables + canal, "Créer une offre de relance" bulk.
- Route `/console/liste-attente` → Waitlist · Route `/console/paniers-abandonnes` → AbandonedCarts.

### Reste pour Pack 3
- POS enforce cash session ouverte (endpoint prêt /cash-sessions, UI non branchée)
- Commandes UI : scan preparation Prête, colonne Facture (icônes Voir/PDF/WA), bloc Facture dans order detail
- KPIs commandes (nouvelles/à confirmer/prêtes/.../taux annulation/CA livré)
- Facturation tab retirée (route déjà supprimée Pack 1)

## Fix pack 2 — Internal control (voir sessions précédentes du PRD)
## Fix pack 1 — Bugs, demo data, interface rules (voir sessions précédentes)

## Credentials
- Admin `aouattaraesca@gmail.com` / `Admin123!` · PIN 1234
- Manager `manager.cocody@dinastore.ci` / `Manager123!` · PIN 2222
- Rider `rider1@dinastore.ci` / `Rider123!` · PIN 5555
- Cliente démo `+225 07 60 17 28 21` · code `142085`

## Backlog ordonné
### Pack 3 reste
- POS: block sale if no open cash session · scan preparation flow
- Commandes UI: invoice column + detail bloc + KPI cards complète
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

## Known hygiene
- server.py ~3500 lignes — refactor en routers après Pack 9
- _seed_demo_content_legacy pas appelé (ancienne seed orpheline nettoyée en fonction nommée)
