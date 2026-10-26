"""Manual addenda: procedure sections for recent features, merged idempotently into manual_modules by title keyword."""
from deps import db, now_iso

S = lambda i: {"type": "steps", "items": i}
T = lambda c: {"type": "text", "content": c}
TIP = lambda t: {"type": "callout", "variant": "tip", "text": t}
INFO = lambda t: {"type": "callout", "variant": "info", "text": t}

ADDENDA = [
    ("caisse", [
        {"id": "add-cash-open", "heading": "Ouvrir une session de caisse", "blocks": [
            T("Aucune vente n'est possible sans session ouverte. L'ouverture se fait depuis Sessions de caisse ou directement depuis la Caisse."),
            S(["Cliquez sur « Ouvrir une session »", "Choisissez la gérante responsable", "Vérifiez la date (aujourd'hui ou une date passée)",
               "Comptez le tiroir et saisissez le fond de caisse (ex. 50,000 FCFA)", "Tapez le PIN de la gérante choisie puis « Ouvrir la session »"]),
            INFO("Les chiffres de Sessions de caisse se mettent à jour automatiquement toutes les 10 secondes.")]},
        {"id": "add-pos-session-banner", "heading": "Bandeau de session en haut de la Caisse", "blocks": [
            T("En haut de la Caisse, un bandeau indique l'état de la session : « Session ouverte depuis 8h02 · [Gérante] » avec le bouton « Fermer la session », ou « Aucune session ouverte » avec le bouton « Ouvrir la session »."),
            S(["Sans session ouverte, les ventes sont bloquées", "« Fermer la session » demande le montant compté et le PIN, comme dans Sessions de caisse",
               "Sessions de caisse reste la page de suivi : historique, versements, validation ou rejet par la propriétaire"])]},
        {"id": "add-handover-reject", "heading": "Validation ou rejet du versement de la gérante", "blocks": [
            S(["La propriétaire ouvre Sessions de caisse et choisit « Valider » ou « Rejeter » (aussi depuis l'historique)",
               "Rejet : type d'anomalie (montant incorrect, justificatif manquant, écart de caisse, autre), montant attendu, écart calculé et motif obligatoires",
               "La gérante est notifiée, voit le motif, les montants et l'écart, corrige puis déclare à nouveau son versement"])]},
        {"id": "add-pos-grid", "heading": "Trouver et ajouter un produit rapidement", "blocks": [
            S(["Faites défiler la liste des produits (grille ou liste)", "Touchez le bouton rouge « + » sur la carte",
               "Sans taille ni couleur : l'article est ajouté directement", "Sinon : choisissez la taille et la couleur dans la fenêtre"]),
            TIP("« En stock » masque les produits en rupture ; « Tous » les affiche grisés avec la mention RUPTURE.")]},
    ]),
    ("commande", [
        {"id": "add-orders-pdf", "heading": "Aperçu et envoi de la facture PDF", "blocks": [
            S(["Dans Commandes, cliquez sur l'icône œil de la ligne (ou « Aperçu » dans la fiche)", "Vérifiez la facture dans la fenêtre",
               "Cliquez « Télécharger » ou « WhatsApp »"]),
            INFO("Sur téléphone, WhatsApp s'ouvre avec le PDF déjà joint. Sur ordinateur, le PDF est téléchargé : glissez-le dans la conversation.")]},
        {"id": "add-orders-chat", "heading": "Échanger avec la cliente et le livreur", "blocks": [
            T("Chaque commande a deux fils partagés par toute l'équipe : « Cliente » et « Livreur ». L'historique reste attaché à la commande."),
            S(["Ouvrez la fiche commande, bloc « Messages de la commande »", "Choisissez l'onglet Cliente ou Livreur",
               "Écrivez ou touchez une réponse rapide", "Pour une photo (colis, adresse, preuve) : icône appareil photo, puis Envoyer"]),
            TIP("Un point rouge dans la liste Commandes et un badge sur le menu signalent les réponses non lues. Le filtre « Messages non lus » les regroupe."),
            INFO("Une cliente sans compte ne peut pas répondre dans l'app : utilisez le bouton WhatsApp du fil Cliente.")]},
        {"id": "add-orders-postpone", "heading": "Reporter une livraison", "blocks": [
            S(["Dans la fiche ou depuis l'app livreur, choisissez « Reporter »", "Sélectionnez la nouvelle date et le motif", "Confirmez"]),
            INFO("La commande reste visible « Reportée au JJ/MM » dans la journée d'origine, sort du montant à encaisser et revient à affecter le jour choisi.")]},
        {"id": "add-prep-views", "heading": "Commandes : confirmer, préparer, affecter", "blocks": [
            T("Préparation fait maintenant partie de Commandes. Choisissez la vue Table ou Kanban en haut à droite ; le choix est mémorisé."),
            S(["Onglet « À confirmer » : cliquez « Confirmer » (ou cochez plusieurs commandes puis « Confirmer »)",
               "Onglet « À préparer » : cliquez « Préparer » pour ouvrir le scan article par article",
               "Quand tout est scanné (ou validé à la main avec un motif), la commande passe « Prête » et la fiche colis s'imprime",
               "Cochez les commandes « Prête » puis « Affecter à une journée de livraison » (date + livreur)",
               "« Imprimer les fiches colis » regroupe les commandes cochées dans un seul PDF"]),
            INFO("Une commande « En attente d'acompte » ne peut être confirmée qu'après avoir marqué l'acompte comme reçu.")]},
    ]),
    ("livraison", [
        {"id": "add-slots", "heading": "Créneaux de livraison", "blocks": [
            S(["Ouvrez la fiche du livreur › « Créneaux de livraison »", "Ajoutez un nom, une heure de début, une heure de fin et une capacité", "Enregistrez",
               "À l'affectation (glisser-déposer ou « Affecter à »), choisissez le créneau ou « Sans créneau »"]),
            INFO("Un créneau complet affiche un avertissement mais l'affectation reste possible.")]},
        {"id": "add-versement", "heading": "Versements livreur et clôture de journée", "blocks": [
            S(["Onglet Réconciliation de la journée", "Pour chaque commande livrée payée à la livraison : « Marquer versé », montant reçu + PIN gérante",
               "Quand tout est « Versé », cliquez « Clôturer la journée »"]),
            INFO("La clôture est bloquée tant qu'une livraison payée à la livraison reste « Non versé ». Les commandes reportées ne comptent pas.")]},
        {"id": "add-versement-reject", "heading": "Rejeter un versement livreur", "blocks": [
            S(["À côté de « Valider », le bouton « Rejeter » ouvre une fenêtre : type d'anomalie, montant remis (écart calculé) et motif obligatoires",
               "Le livreur est notifié et voit le rejet dans Profil › Mon solde ; il envoie une correction avec le bon montant",
               "La console affiche « Corrigé : X FCFA » ; validez ensuite le versement. Un versement rejeté n'est jamais compté comme validé"])]},
        {"id": "add-print-all", "heading": "Imprimer toutes les feuilles de route", "blocks": [
            S(["Journées de livraison › « Imprimer toutes les feuilles »", "Un PDF est généré avec une page par livreur ayant des courses aujourd'hui"])]},
    ]),
    ("stock", [
        {"id": "add-adjust", "heading": "Ajuster le stock depuis la fiche produit", "blocks": [
            S(["Ouvrez la fiche produit › « Ajuster stock »", "Choisissez la taille, « Entrée » ou « Sortie », la quantité", "Choisissez le motif puis Valider"]),
            INFO("Admin : appliqué immédiatement. Gérante : une demande d'approbation est envoyée. Chaque ajustement apparaît dans l'historique du produit.")]},
        {"id": "add-po-mov", "heading": "Réception de bon de commande et historique", "blocks": [
            T("La réception d'un bon de commande fournisseur (sans écart, ou après validation des écarts) ajoute le stock et crée une ligne « Réception BC-… » dans l'historique du produit.")]},
    ]),
    ("param", [
        {"id": "add-console-nav-2026", "heading": "Organisation du menu de la console", "blocks": [
            S(["Ventes › Opportunités : 3 sous-onglets (Liste d'attente, Demandes hors catalogue, Paniers abandonnés) et des indicateurs communs : demandes en attente, demandes hors catalogue, paniers abandonnés, valeur à récupérer, taux de récupération",
               "Produits & achats › Catégories & marques : sous-onglets Catégories, Collections et Marques",
               "Équipe › Présences : historique, retards, absences, heures travaillées et statistiques ; visible par la propriétaire et les rôles qu'elle coche en haut de la page. Le bouton de pointage reste dans la barre du haut pour tout le monde",
               "Paramètres › Sécurité & audit : réglages de sécurité et Journal d'audit, réservés à la propriétaire"]),
            TIP("Les montants trop longs s'affichent en format court (ex. 77,4 M FCFA) : survolez ou touchez la carte pour voir le montant exact.")]},
        {"id": "add-notifs", "heading": "Notifications ciblées et sons", "blocks": [
            T("Un clic sur une notification ouvre directement l'élément : commande, produit, cliente, avis, approbation ou session de caisse."),
            S(["Un son court accompagne chaque nouvelle notification", "Un son distinct signale une réponse de cliente ou de livreur",
               "Coupez ou réactivez les sons avec l'icône haut-parleur en haut de la console"]),
            INFO("Les navigateurs n'autorisent le son qu'après un premier clic sur la page.")]},
        {"id": "add-demo", "heading": "Données de démonstration", "blocks": [
            S(["Paramètres › « Ajouter démo » pour générer toutes les situations de test", "« Supprimer » efface uniquement les données de démo"]),
            TIP("Clientes de démo pour le site : Mariam Kouadio +225 07 48 11 22 01, code 202601.")]},
    ]),
    ("livreur", [
        {"id": "add-rider-tools", "heading": "Reporter, écrire à la boutique, sons", "blocks": [
            S(["Ouvrez une course › « Reporter » : choisissez la date et le motif", "« Message boutique » : lire et répondre, avec photo si besoin",
               "Un son et un message à l'écran signalent une nouvelle course ou un message de la boutique"]),
            TIP("Un son accompagne chaque nouvelle course ou message.")]},
        {"id": "add-rider-nav", "heading": "Navigation : 4 onglets et le Profil", "blocks": [
            T("La barre du bas compte 4 onglets : Courses · Carte · Messages · Profil. Historique et Performance se trouvent désormais dans Profil."),
            S(["Messages : vos conversations avec la boutique (gérante) et avec les clientes de vos courses en livraison ; un badge rouge compte les messages non lus et un son signale chaque nouveau message",
               "Une conversation cliente reste liée à sa commande : elle s'ouvre aussi depuis la course (bouton « Message »)",
               "Profil : votre photo, votre nom et l'heure de pointage du jour",
               "La carte rouge résume votre score sur 100 avec sa tendance de la semaine, vos livraisons du jour (livrées / à livrer) et l'encaissé du jour ; touchez-la pour ouvrir Performance",
               "Menu : Historique, Performance, Avis clients, Mon solde, Contacter la gérante, Signaler un problème, Paramètres, Pointer mon départ",
               "Paramètres : changer votre photo, votre nom et votre numéro de téléphone, et choisir le thème (clair, sombre, auto)",
               "Les boutons WhatsApp ouvrent directement la conversation avec le numéro : le téléphone utilise l'application WhatsApp installée (personnelle ou Business), il n'y a rien à choisir",
               "Côté cliente, elle vous joint par la messagerie interne (bouton « Message ») ou par le bouton WhatsApp qui ouvre directement la conversation",
               "Historique et Performance s'ouvrent en pleine page avec leurs filtres, calendrier, indicateurs et graphiques ; la flèche en haut à gauche ramène au Profil"]),
            TIP("« Pointer mon départ » n'apparaît qu'après avoir pointé votre arrivée.")]},
        {"id": "add-rider-offline", "heading": "Mode hors ligne", "blocks": [
            T("L'app livreur fonctionne sans internet. À chaque pointage et à chaque actualisation en ligne, elle enregistre sur le téléphone vos courses du jour : clientes, adresses et positions GPS, articles, montants à encaisser, codes de livraison et la carte des zones."),
            S(["Sans réseau, vous pouvez voir vos courses et leur détail, ouvrir l'itinéraire, appeler la cliente, passer une course en Livrée, Annulée, Reportée ou Échec avec le motif",
               "Livraison avec code : le code est vérifié directement sur le téléphone ; sans code : photo du colis et signature comme d'habitude",
               "Les messages écrits hors ligne sont gardés et envoyés automatiquement dès le retour du réseau",
               "Chaque action est enregistrée avec son heure exacte et votre position GPS, puis envoyée dans l'ordre, sans doublon, dès que la connexion revient",
               "Le bandeau en haut indique « Hors ligne · X actions en attente », puis « Synchronisé » une fois tout envoyé ; touchez-le pour forcer l'envoi",
               "Rien n'est perdu si l'app est fermée ou si le téléphone redémarre avant la synchronisation"]),
            INFO("Si la boutique a modifié une commande pendant que vous étiez hors ligne (réaffectée, annulée…), c'est la version de la boutique qui compte : vous recevez une notification et votre action reste visible dans l'historique de la commande pour vérification."),
            TIP("Ouvrez l'app une fois connecté au début de la journée (ou pointez votre arrivée) pour que tout soit téléchargé.")]},
        {"id": "add-rider-checkin-reports", "heading": "Pointage caméra, historique et signalements", "blocks": [
            S(["Pointage : la caméra avant s'ouvre et vous vous voyez à l'écran ; si l'accès est refusé, un message explique comment l'autoriser (iPhone : Réglages › Safari › Caméra ; Android : cadenas › Autorisations › Caméra), puis touchez « Réessayer »",
               "Courses : la carte « Annulées / Retournées » compte les commandes du jour annulées, retournées ou refusées",
               "Profil › Historique : touchez une journée pour voir ses commandes, puis une commande pour voir son détail complet (articles, adresse, paiement, suivi) en lecture seule",
               "Profil › Signaler un problème : type (panne moto, accident, client injoignable, client agressif, colis endommagé, autre), commande concernée (facultatif), description, photo et urgence ; votre position est jointe automatiquement",
               "La gérante est alertée immédiatement ; le statut de votre signalement (Envoyé, Pris en charge, Résolu) et sa réponse s'affichent sous « Mes signalements »"]),
            INFO("Côté console : Livraison › Livreurs affiche le bloc « Signalements livreurs » pour prendre en charge, répondre et marquer résolu.")]},
    ]),
]

import json as _json  # noqa: E402
import os as _os  # noqa: E402

_SHOTS_PATH = _os.path.join(_os.path.dirname(__file__), "manual_shots.json")
_SHOTS = _json.load(open(_SHOTS_PATH)) if _os.path.exists(_SHOTS_PATH) else {}


def P(shot: str, caption: str):
    s = _SHOTS.get(shot) or {}
    return {"type": "photo", "image": s.get("image", f"/manual/{shot}.jpg"), "callouts": s.get("callouts", []), "caption": caption, "ratio": s.get("ratio")}


ADDENDA += [
    ("prise en main", [
        {"id": "add-v3-stock-rule", "heading": "Règle du stock, articles non vendables et clôture de caisse", "blocks": [
            T("Tout article qui sort de la boutique sans être enregistré dans le système est considéré comme toujours en stock. Les inventaires réguliers vérifient que le stock réel correspond au stock du système."),
            S(["Stock › Non vendables : déclarez un article Défectueux, Invendable, Retour fournisseur, En réparation ou Perdu (ou ajoutez un motif), avec la raison, un commentaire et une photo",
               "Le propriétaire valide : l'article sort alors du stock vendable. Plus tard, changez son état : réparé et remis en stock, renvoyé au fournisseur, vendu avec remise ou détruit. Chaque changement est noté",
               "Clôture de caisse : la Gérante compte ses espèces sans voir le montant attendu. Le système calcule l'attendu (fond + ventes espèces + argent des livreurs − sorties) et envoie au propriétaire le verdict « Conforme » ou « Écart », avec les points d'attention",
               "Le propriétaire valide ou rejette avec un motif ; la Gérante reçoit la décision",
               "Équipe regroupe Employés, Présences et Rôles & permissions ; chaque rôle peut être renommé, désactivé ou réactivé"]),
        ]},

        {"id": "add-v2-all-platforms", "heading": "Nouveautés communes : console, app livreur, site", "blocks": [
            T("Ces règles s'appliquent partout, sur ordinateur, tablette et téléphone (y compris l'application installée sur l'écran d'accueil)."),
            S(["Plus de zoom automatique : en touchant un champ, l'écran ne grossit plus ; tous les champs sont lisibles en 16 px",
               "iPhone (encoche, coins arrondis) : rien n'est coupé sur les côtés, les marges latérales sont conservées sur chaque page",
               "Bandeaux longs (« Livraison 24h à Abidjan… », « Boutique fermée actuellement… ») : si le texte dépasse l'écran, il défile de droite à gauche",
               "Option choisie toujours visible : la case sélectionnée (Oui / Non, taille, couleur, filtre, mode de paiement…) prend un fond coloré",
               "Messagerie : chaque conversation peut être archivée puis désarchivée ; le filtre « Archivées » les regroupe ; un nouveau message la fait revenir dans les conversations actives",
               "Recherche dans les messages : tapez un nom, un numéro de commande (ex. DN-261017-2366) ou un mot du message"]),
            P("console-messagerie", "Console › Messagerie : recherche et conversations archivées"),
            TIP("Sur iPhone, ajoutez le site à l'écran d'accueil (Partager › Sur l'écran d'accueil) pour recevoir les notifications.")]},
    ]),
    ("caisse", [
        {"id": "add-v2-paste-variant", "heading": "Commande depuis un message : choisir taille et couleur", "blocks": [
            S(["Collez le message de la cliente puis « Analyser »", "Si un article n'est pas reconnu, choisissez le produit à la main dans la liste",
               "Deux listes apparaissent : Taille… et Couleur… avec le stock de chaque option (les options épuisées sont grisées)",
               "« Remplir le panier » reste bloqué tant que la taille et la couleur ne sont pas choisies"])]},
        {"id": "add-v2-shared-cart", "heading": "Panier partagé : parcours complet de la cliente", "blocks": [
            S(["À la Caisse, « Partager le panier » génère un lien à envoyer par WhatsApp",
               "La cliente ouvre le lien, vérifie les articles et peut réduire les quantités ou retirer un article (jamais augmenter)",
               "Elle saisit son nom et son téléphone, choisit « À la livraison / Au retrait » ou « Wave », puis confirme",
               "Wave : le numéro Wave de la boutique s'affiche, elle paie et envoie la capture ; la gérante vérifie puis marque « Paiement reçu »",
               "La commande apparaît aussitôt dans Commandes au statut « Confirmée » et une notification est envoyée à l'équipe"]),
            INFO("Un panier préparé en caisse sans livraison devient une commande « Retrait en boutique » à préparer.")]},
    ]),
    ("préparer", [
        {"id": "add-v2-prep-codes", "heading": "Préparation : chaque article vérifié par son code", "blocks": [
            T("Une commande ne peut plus passer « Prête » sans que chaque pièce ait été vérifiée avec le code de son étiquette. Il n'existe plus de validation manuelle."),
            P("console-prep", "Écran « Préparer » : une ligne par article avec photo, taille, couleur, quantité et code attendu"),
            S(["Depuis une commande « À préparer », cliquez « Préparer » (ou « Reprendre »)",
               "La caméra s'ouvre directement : scannez le QR code ou le code-barres de l'étiquette",
               "Si le scan ne marche pas : onglet « Taper le code » et saisissez le code imprimé (ex. DEMO-100-37-NOIR)",
               "Bon article : la ligne devient verte (pour une quantité 2, il faut 2 vérifications)",
               "Mauvais article : refus avec le message « Mauvais article : attendu Mules Raphia Naturel · Noir · P37 »",
               "Quand tout est vert : « Marquer comme prête » s'active, puis « Imprimer la fiche colis » en un clic"]),
            INFO("Chaque vérification (scan ou code tapé, code, personne, heure, réussite ou refus) est inscrite dans le journal en bas de l'écran et dans le journal d'audit.")]},
    ]),
    ("produits", [
        {"id": "add-v2-labels", "heading": "Imprimer les étiquettes QR d'un produit", "blocks": [
            P("console-product-labels", "Fiche produit : boutons d'impression des étiquettes"),
            S(["Ouvrez la fiche du produit dans Produits", "« Étiquettes QR » : une étiquette par taille et couleur",
               "« Étiquettes × stock » : une étiquette par pièce en stock", "La fenêtre d'impression s'ouvre (A4, 3 colonnes) : imprimez ou enregistrez en PDF"]),
            TIP("Le code imprimé est exactement celui demandé à la préparation : SKU-TAILLE-COULEUR (ex. DEMO-100-37-NOIR).")]},
        {"id": "add-v2-products-actions", "heading": "Liste des produits : boutons d'action et promotions", "blocks": [
            P("console-products", "Vue Tableau : Voir, Modifier, Supprimer alignés"),
            S(["En vue Tableau, chaque ligne a trois boutons carrés : Voir, Modifier, Supprimer", "En vue Grille, le crayon Modifier est toujours visible sur la carte",
               "Un produit avec un ancien prix supérieur au prix actuel affiche « -X % » sur la carte et la fiche, avec le prix barré",
               "Ces produits apparaissent dans la section « Promotions » de l'accueil du site et sur la page Promotions"])]},
    ]),
    ("fournisseurs", [
        {"id": "add-v2-reception-labels", "heading": "Étiquettes des pièces reçues", "blocks": [
            S(["Ouvrez la commande fournisseur et cliquez « Réceptionner », comptez les pièces puis validez",
               "Dès la réception enregistrée, la fenêtre d'impression des étiquettes s'ouvre : une étiquette QR par pièce reçue",
               "Pour réimprimer plus tard : bouton « Étiquettes QR des pièces reçues » sur la commande"]),
            INFO("Les codes des étiquettes de réception sont les mêmes que ceux demandés à la préparation des commandes.")]},
    ]),
    ("pointage", [
        {"id": "add-v2-work-hours", "heading": "Horaires de travail par rôle et par employé", "blocks": [
            P("console-pointage", "Paramètres › Pointage : horaires et jours par rôle, horaires personnels"),
            S(["Paramètres › Pointage : chaque rôle (y compris ceux créés plus tard) a son heure d'arrivée, de départ, sa tolérance de retard et ses jours travaillés",
               "Enregistrez avec « Enregistrer la configuration »",
               "Bloc « Horaires spécifiques par employé » : « Définir des horaires » remplace ceux du rôle pour cette personne",
               "« Revenir au rôle » supprime les horaires personnels"]),
            INFO("Le retard est calculé avec les horaires personnels s'ils existent, sinon avec ceux du rôle ; aucun retard n'est compté un jour non travaillé.")]},
    ]),
    ("paramètres", [
        {"id": "add-v2-store-gps-hours", "heading": "Coordonnées : position GPS et horaires d'ouverture", "blocks": [
            P("console-coordonnees", "Paramètres › Coordonnées"),
            S(["Depuis la boutique, touchez « Utiliser ma position actuelle » ou « Placer sur la carte » puis touchez l'emplacement exact",
               "La position sert à la page Contact du site (carte + itinéraire) et à l'app livreur (repère de la boutique)",
               "Horaires d'ouverture : pour chaque jour, cochez Ouvert, saisissez début et fin ; « Ajouter une plage » pour une pause de midi ; « Copier partout » applique le jour à la semaine",
               "Cliquez « Enregistrer »"])]},
        {"id": "add-v2-delivery-slots", "heading": "Créneaux de livraison par jour", "blocks": [
            P("console-livraison-slots", "Paramètres › Livraison : grille des créneaux"),
            S(["Pour chaque jour : ouvert ou fermé", "Un ou plusieurs créneaux avec un nom facultatif (ex. Matin) et les heures de début et de fin", "Enregistrez"])]},
    ]),
    ("livreur", [
        {"id": "add-v2-rider-screens", "heading": "App livreur en images", "blocks": [
            P("rider-courses", "Courses : la carte « Annulées / Retournées »"),
            P("rider-historique", "Profil › Historique : journées et commandes en lecture seule"),
            P("rider-signalement", "Profil › Signaler un problème"),
            P("rider-messages", "Messages : recherche et archives"),
            S(["Messages : la barre de recherche trouve une conversation par nom, numéro de commande ou texte",
               "Le bouton à droite de chaque conversation l'archive ; « Archivées » affiche les conversations archivées et permet de les désarchiver"])]},
    ]),
    ("site vitrine", [
        {"id": "add-v2-storefront", "heading": "Site et espace cliente : nouveautés", "blocks": [
            P("store-home", "Accueil : bandeau défilant, stickers promotion et section Promotions"),
            P("store-product-promo", "Fiche produit en promotion"),
            P("store-account-messages", "Mon compte › Messages : Boutique / Livreur, recherche, archives"),
            P("store-account-address", "Adresse : GPS ou placement sur la carte"),
            S(["Photo de profil : après le choix de la photo, la cliente la recadre (zoom, rotation) avant d'enregistrer",
               "GPS refusé : une fenêtre explique comment autoriser la position sur iPhone et Android, et propose « Placer ma position sur la carte »",
               "« Télécharger la facture » ouvre la facture (créée automatiquement si besoin) prête à imprimer ou enregistrer en PDF",
               "Messages rangés en deux onglets : Boutique et Livreur, avec recherche et archives",
               "Notifications : sur Android, bouton « Installer » et activation dans le navigateur ; sur iPhone, guide « Ajouter Chez Dina à l'écran d'accueil »",
               "Favoris, Vus récemment, Bons d'achat (codes promo actifs à copier) et Avis à donner fonctionnent sur téléphone",
               "Lien de parrainage : l'aperçu WhatsApp/Facebook montre une photo produit, le nom de la boutique et l'offre de bienvenue"])]},
        {"id": "add-v4-tour", "heading": "Visite guidée de la console et de l'app livreur", "blocks": [
            T("À la première connexion, une visite guidée présente pas à pas les écrans principaux : chaque étape ouvre l'écran concerné et entoure en rouge l'élément expliqué."),
            S(["Suivant / Précédent pour avancer, la croix ou Échap pour quitter",
               "Console : Manuel d'utilisation › bouton « Relancer la visite guidée »",
               "App livreur : Profil › « Revoir la visite guidée »",
               "La visite ne montre que les pages autorisées pour votre rôle"])]},
        {"id": "add-v4-inventories", "heading": "Inventaires réguliers : planifiés, surprise, partiels", "blocks": [
            T("Tout article qui sort de la boutique sans être enregistré dans le système est considéré comme toujours en stock. Les inventaires réguliers vérifient que le stock réel correspond au stock du système."),
            S(["Stock › Inventaires › « Planifier » (propriétaire) : nom, fréquence (semaine, 2 semaines, mois, trimestre), première date, rappel X jours avant, périmètre",
               "Chaque matin à 7h, les inventaires arrivés à échéance s'ouvrent tout seuls ; la gérante et la magasinière reçoivent un rappel avant la date, le jour même, puis tant que l'inventaire n'est pas soumis",
               "« Inventaire surprise » (propriétaire) : lancé immédiatement, l'équipe est prévenue",
               "Périmètre : tout le stock, ou une partie par catégorie, marque ou emplacement (champ Emplacement de la fiche produit)",
               "Comptage à l'aveugle : pour chaque ligne, quantité comptée, commentaire et photo ; « Enregistrer » garde le travail en cours",
               "« Soumettre au propriétaire » : toutes les lignes doivent être comptées",
               "Le propriétaire voit les écarts par article et leur valeur, puis « Valider et appliquer » (le stock est corrigé) ou « Faire recompter » avec un motif obligatoire",
               "L'historique garde tous les inventaires avec leurs résultats"])]},
        {"id": "add-v4-permissions", "heading": "Rôles & permissions appliqués", "blocks": [
            T("Équipe › Rôles & permissions : pour chaque page de la console et chaque rôle, choisissez un niveau. Il est appliqué par le serveur : taper l'adresse d'une page interdite ne donne aucun accès."),
            S(["Aucun : la page disparaît du menu et ses données sont refusées",
               "Lecture : consulter seulement ; un bandeau « Lecture seule » s'affiche et toute modification est refusée",
               "Modif. : consulter, créer et modifier (pas de suppression)",
               "Complet : tout, y compris supprimer",
               "Enregistrez la matrice ; elle s'applique immédiatement côté serveur et au menu à la prochaine connexion de l'employé",
               "Certaines actions restent réservées au propriétaire quoi qu'il arrive : validations, campagnes, exports, sécurité, rôles"])]},
    ]),
]


async def apply_manual_addenda() -> int:
    mods = await db.manual_modules.find({}).sort("number", 1).to_list(100)
    added = 0
    for key, sections in ADDENDA:
        m = next((x for x in mods if key in (x.get("title") or "").lower()), None)
        if not m:
            continue
        have = {s.get("id") for s in m.get("sections", [])}
        new = [s for s in sections if s["id"] not in have]
        if new:
            await db.manual_modules.update_one({"id": m["id"]}, {"$push": {"sections": {"$each": new}}, "$set": {"updated_at": now_iso()}})
            m.setdefault("sections", []).extend(new)
            added += len(new)
    return added
