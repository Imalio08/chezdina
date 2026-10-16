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
