# Chez Dina — PRD

## Problem Statement
**Chez Dina** — retail OS femme Abidjan Cocody Angré 7e. Français, FCFA, Africa/Abidjan. 3 faces : Console back-office / Rider mobile / Storefront public.

## Session 12 (Feb 7 2026) — Rider Space v2 (section 6.8 complète)

### Nouvelle navigation Rider (/rider)
Bottom nav 5 onglets : **Courses · Carte · Historique · Performance · Profil**. Plus de sidebar console pour les livreurs. Login role=rider redirige vers `/rider`.

### 1. Courses (`rider/Courses.jsx`)
- 5 KPIs du jour : À livrer, Livrées, À encaisser, Encaissé, Solde à remettre
- 7 filtres segmentés avec compteurs : Toutes / À livrer / En route / Livrées / Annulées / Reportées / Échecs
- Carte compacte par commande dans l'ordre proposé : code, prénom cliente, zone, COD ou "Déjà payé", badge statut coloré
- Bouton "Scanner une fiche" (QR → ouvre commande)
- Détail commande : Appeler / WhatsApp (sélecteur de template) / Itinéraire Google Maps, articles, totaux, boutons statut (démarrer, livrer, échec, reporter)
- WhatsApp : chaque ouverture est loggée via `POST /orders/{id}/contact-log` avec template_key

### 2. Carte (`rider/Carte.jsx`)
- Carte Leaflet/OSM plein onglet, pins colorés par statut (jaune=à livrer, bleu=en route, vert=livrée, rouge=échec, gris=reportée)
- Position live du livreur (pin rouge)
- Bouton "Optimiser ma tournée" : nearest-neighbor depuis la position actuelle → pins numérotés + polyline rouge pointillée
- Filtre "À livrer seulement / Toutes"
- Bottom card au tap d'un pin : code, prénom, quartier, COD, 4 boutons (Appel, WA, GPS Maps, Ouvrir commande)

### 3. WhatsApp templates (`GET/PATCH /delivery-templates`)
- 4 templates par défaut avec variables `{prenom_client}` / `{prenom_livreur}` / `{numero_commande}` / `{montant}` / `{lien_suivi}` : en_route / arrived / location / unreachable
- Éditables en console par admin/manager (route déjà prévue dans Paramètres)
- Chaque contact loggé sur la commande (`contact_log[]`)

### 4. Preuve de remise (`DeliveryProofModal.jsx` + `POST /orders/{id}/deliver`)
- **Code 4 chiffres** (défaut) : généré au passage `en_livraison`, envoyé via WhatsApp outbox (`kind:"delivery_code"`), visible sur page tracking cliente, saisi par le livreur. 3 codes erronés → `delivery_locked=true` + alerte gérante.
- **Photo + signature (fallback)** : upload photo colis + signature pad canvas (via `react-signature-canvas`). Marqué `needs_review=true`.
- **Remis à un tiers** : nom + relation + photo + signature.
- **High-value rule** : montant ≥ seuil (défaut 50 000 FCFA) → PIN gérante obligatoire sans code (vérifié via users.attendance_code).
- Chaque preuve stocke : at, by, lat, lng, amount_collected, payment_method, photo+signature base64, approuveur.

### 5. Historique (`rider/Historique.jsx`)
- 4 KPIs période : jours, livraisons, encaissé, écarts cumulés
- Sélecteur période (1j / 7j / 30j / 90j) + tabs statut
- Groupement par **journée de travail** (collapsible) : date, badge Validée/Écart, détail commandes
- **Téléphone masqué** côté backend : `07 •• •• •• 45` dans l'historique (phone=null)

### 6. Performance (`rider/Performance.jsx` + `GET /riders/{id}/score`)
- Score /100 formule pondérée : delivery_rate 35% + punctuality 20% + rating 25% + cash 10% + proof 10% (poids éditables par super admin)
- Badge niveau : Bronze (<60) / Argent (60-75) / Or (75-90) / Excellence (90+)
- Barres de progression par composante + 4 KPIs + BarChart distribution des notes + liste avis clientes (first_name + quartier only, pas de téléphone, respect modération `hidden`)

### 7. Profil (`rider/Profil.jsx`)
- Upload photo via caméra (crop circulaire, PATCH /users/me/photo), photo affichée dans la topbar et sur les fiches colis
- Préférences : thème (clair/sombre/auto, persisté localStorage + backend prefs), WhatsApp vs WhatsApp Business, son
- Contact gérante (appel/WhatsApp directs vers +225 07 77 92 61 79)
- Bouton rouge "Signaler un problème" → notification immédiate à la gérante

### 8. Console side (déjà prévu)
- Routes `/console/livreurs` déjà pointent vers `Deliveries.jsx` qui affiche KPIs riders
- `GET /riders/{id}/reviews` renvoie les avis (le rider ne voit pas les cachés, l'admin oui)
- `PATCH /reviews/{id}/moderate` (renommé en `moderate_review_hide` pour éviter conflit) : hidden + reason

### Backend endpoints ajoutés
- `POST /orders/{id}/deliver` (preuve + verrouillage 3 codes + high-value PIN)
- `POST /orders/{id}/contact-log`
- `GET/PATCH /delivery-templates` (WA templates + score weights + proof threshold)
- `PATCH /users/me/photo` + `PATCH /users/me/prefs`
- `GET /riders/{id}/score` (score pondéré + composantes)
- `GET /riders/{id}/reviews` (avec masking cliente + filter hidden pour rider)
- `GET /riders/me/today` (orders + counts + sums)
- `GET /riders/me/history?days=N` (sessions avec phone masqué)
- Hook `status=en_livraison` → génère `delivery_code` 4 chiffres + enfile `kind:"delivery_code"` dans outbox

### Dépendance ajoutée
- `react-signature-canvas@2.3.2` (signature pad canvas, 7 KB)

### Testing manuel (curl)
- Rider login + /riders/me/today ✅ (orders + counts corrects)
- `/delivery-templates` ✅ (4 templates, proof_method=code, threshold=50000)
- `/riders/{id}/score` ✅ (score pondéré avec 5 composantes)
- Status `en_livraison` sur commande → `delivery_code` 4 chiffres généré + outbox entry ✅
- Deliver avec code `0000` → 401 "Code invalide (1/3)" ✅
- Contact-log WA → 200 ok ✅

### Non livré (deferred)
- QR scanner caméra réel (actuellement bouton toast "à venir"). Nécessiterait `html5-qrcode` et une liste pour saisie manuelle en fallback.
- Offline sync IndexedDB complet (actuellement reload périodique). Service worker + queue de PATCH à construire.
- Page admin "Livrées sans code" (back-office pour revue des `proof.needs_review=true`) — endpoints prêts, UI à ajouter.
- Charts "deliveries per day" et "top reasons of failure" (actuellement remplacés par distribution notes). À ajouter dans Performance.jsx.

## Sessions précédentes
- S11 : Rebrand + CMS pages + Caisse + Encaissements + P&L + Marques/Catégories + Checklist + Intégrations
- S10 : CMS Vitrine SectionBuilder + Compte Cliente code secret
- S9 : WhatsApp auto + Fidélité + Parrainage + Rôles + Kiosk
- S8 : Board DnD + Réconciliation PIN + GPS Leaflet + Wizard 4-steps + QR variantes
- S1-7 : Rebrand, Dashboard v2, POS cash control, Delivery full redesign, Catalog v2, Dina IA

## Credentials
- Admin `aouattaraesca@gmail.com` / `Admin123!` · PIN 1234
- Manager `manager.cocody@dinastore.ci` / `Manager123!` · PIN 2222
- Rider `rider1@dinastore.ci` / `Rider123!` · PIN 5555 → redirige vers `/rider`
- Cliente démo `+225 07 60 17 28 21` · code `142085`

## Backlog
### P0
- Scanner QR réel (html5-qrcode) sur Courses
- Admin page "Livrées sans code" + bulk approval
- Rate limiting login-code + kiosk PIN

### P1
- Offline sync IndexedDB complet + service worker (statut + preuves)
- Charts deliveries/day + top reasons of failure sur Performance
- Scheduler panier abandonné auto-WA 24h
- Meta Business Embedded Signup

### P2
- PWA offline POS, multi-store réel, Dina IA auto-rédige diffusions
