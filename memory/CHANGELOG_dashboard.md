## 2026-10-15 — Tableau de bord console
- KPICard : écart calculé depuis la valeur exacte (valueFull) → plus de chiffres bruts ; écart compact FCFA, % avec virgule.
- ActionItems : délai d'attente en min / h / j.

## 2026-10-15 — Expérience mobile & retours visuels (site client)
- Toasts mobile en haut, centrés, agrandis ; ScrollToTop ; lib/reveal.js (défilement + halo).
- Ajout panier « Voir le panier », catalogue, checkout, suivi, compte (routes uniques matchMedia, /boutique/compte/profil).
- Tests : iteration_72 → iteration_73 100 %.

## 2026-10-15 — Application livreur connectée (notifications, messagerie, synchro)
- notify(): champs ref (code commande / id conversation) + event_key (anti-doublon) ; push avec tag ; sw.js navigue la fenêtre existante vers l'URL.
- Événements livreur : attribution / retrait / réaffectation (assign + ajout tournée), statut changé par la boutique (annulée, reportée…), course modifiée (adresse, tél., articles, montant, créneau, instructions), messages cliente / gérante / boutique, annonce CMS livreurs.
- API : GET /me/notifications?unread_only&before&limit, POST /me/notifications/read {ids|ref|{}} ; POST /rider/conversations/store ; /messages/send accepte conversation_id ; lecture atomique ($addToSet read_by) ; PATCH /orders interdit aux livreurs.
- Front livreur : cloche avec filtres Toutes/Non lues, non lues mises en avant, « Tout marquer comme lu », page /rider/notifications (historique paginé) ; clic → /rider?course=CODE ou conversation ; toasts « Ouvrir » + son pour chaque nouvel événement, rattrapage au retour au premier plan / reconnexion ; onglet Messages (badge) avec boîtes Clientes / Boutique-gérante, « Écrire à la boutique », « Voir la course ».
- Console Messagerie : ouverture d'une conversation = messages lus ; réponse dans la même conversation.
- Correctif : aperçu facture console (biz → brand).
- Tests : iteration_74 (2 bugs mineurs) → iteration_75 100 % (17/17 backend).


## 2026-10-15 — Domaine chezdina.net & pointage obligatoire
- Routes : vitrine à la racine « / » (catalog, product/:id, checkout, compte/*, suivi-commande…), console « /console » (connexion /console/connexion), livreur « /riders » (connexion /riders/connexion). Anciennes URL /boutique/*, /rider/*, /login redirigées (query conservée). Liens CMS /boutique nettoyés (siteLink). Retour vers la page demandée après connexion.
- Sessions séparées : livreur → 403 hors préfixes livreur (deps.RIDER_PREFIXES) et redirigé de /console ; équipe refusée sur /riders/connexion ; cliente 401 sur l'API équipe.
- Pointage : deps.punch_required (rôles attendance_config hors admin/livreur ; dernier pointage du jour = arrivée) → HTTP 428 sur toute l'API sauf auth / attendance/me / check-in ; PunchGate plein écran (caméra, Réessayer, erreurs) ; selfie obligatoire validé côté serveur ; départ pointé = accès bloqué jusqu'à la prochaine arrivée.
- Page connexion : identifiants admin pré-remplis retirés ; case « pointer » remplacée par l'écran obligatoire.
- Manifests : vitrine start_url « / », livreur start_url/scope « /riders » (ids inchangés pour les PWA installées). Liens notifications / partage → chezdina.net.
- Tests : iteration_76 backend 9/9, frontend OK ; corrections suite au rapport (deep link après connexion, CTA CMS, onglet livreur vide).
- Connu : rôles vendeuse / magasinière / community manager → menu console vide après pointage (RBAC ne connaît que admin + gérante).


## 2026-10-15 — Menus et droits par rôle (vendeuse, magasinière, community manager)
- backend/role_access.py : liste d'accès API par rôle (refus par défaut), lecture seule (produits, stock…), règles de refus (suppressions, ajustement porte-monnaie, acompte, actions groupées, modification du manuel, affectation livreur) ; dans sa liste, chaque rôle hérite des droits gérante (deps.require_role).
- Filtre de champs serveur : clés coût / marge / profit / CA retirées pour ces rôles et sur toutes les routes /api/public ; montants des achats masqués pour la magasinière ; montants clients et commandes masqués pour la community manager.
- Magasinière : statut de commande limité à en_preparation / prete. Community manager : PATCH /api/site limité à theme, menu, footer, social, seo, sections, hero, logo, favicon.
- /api/dashboard/role + RoleDashboard (ventes du jour de la vendeuse via created_by_id) ; menus rbac.js ; menu « Créer » filtré et masqué s'il est vide ; assistant IA masqué pour ces rôles ; colonnes et tuiles coût / marge / dépensé masquées ; boutons d'édition retirés pour les rôles en lecture seule.
- Tests : iteration_77 (manques) → iteration_78 (faille d'héritage trouvée) → corrigée, pytest 65/65.

## 2026-10-15 — Correctifs PIN pointage & formulaire cliente Caisse
- Pointage : le PIN était toujours refusé depuis la console (get_user retire pin_hash) → lecture du pin_hash en base, PIN normalisé en chiffres, message « Code PIN incorrect pour ce compte ». Doublons bloqués (409 « Arrivée/Départ déjà pointé », départ sans arrivée refusé).
- Caisse : POSSessionGuard revérifiait la session toutes les 30 s en affichant un écran de chargement → toute la Caisse (formulaire + panier) était démontée. Revérification désormais silencieuse ; le formulaire ne se ferme plus en cliquant à côté ; téléphone normalisé (+225 + 10 chiffres) ; messages d'erreur explicites, données conservées.
- Tests : iteration_79 100 % (5/5 backend, UI avec attente de 70 s).

