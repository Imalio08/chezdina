import React from "react";
import { useLocation } from "react-router-dom";
import { Construction } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";

const TITLES = {
  "/console/factures": ["Factures & devis", "Éditer, visualiser et partager vos factures et devis par WhatsApp"],
  "/console/sessions-caisse": ["Sessions de caisse", "Ouverture/clôture, fond de caisse, mouvements et écarts"],
  "/console/journees-livraison": ["Journées de livraison", "Affectation, suivi live, réconciliation du soir"],
  "/console/livreurs": ["Livreurs", "Profils, performance, soldes dûs, avis clientes"],
  "/console/zones": ["Zones & tarifs", "Zones de livraison, tarifs, délais, créneaux"],
  "/console/marques": ["Marques", "Logos, pays, performance par marque"],
  "/console/categories": ["Catégories & collections", "Arborescence et collections manuelles ou automatiques"],
  "/console/liste-attente": ["Liste d'attente", "Tailles et modèles les plus demandés"],
  "/console/fournisseurs": ["Fournisseurs", "CRUD, soldes dus, statistiques fournisseurs"],
  "/console/paniers-abandonnes": ["Paniers abandonnés", "Relance automatique par WhatsApp"],
  "/console/parrainage": ["Parrainage", "Code de parrainage, récompenses parrain et filleul"],
  "/console/campagnes-whatsapp": ["Campagnes WhatsApp", "Templates, segments, envois programmés"],
  "/console/encaissements": ["Encaissements", "Par mode de paiement, trésorerie quotidienne"],
  "/console/resultat": ["Compte de résultat", "CA, coût des marchandises, marge, dépenses, résultat net"],
  "/console/employes": ["Employés", "CRUD, PIN, rôle, horaires"],
  "/console/roles": ["Rôles & permissions", "Matrice des droits par module"],
  "/console/pointage": ["Pointage & planning", "Kiosk, planning hebdo, retards & absences"],
  "/console/apparence": ["Apparence du site", "Logo, couleurs, police, cartes produits"],
  "/console/pages": ["Pages du site", "À propos, Livraison & retours, CGV, FAQ, Contact"],
  "/console/menus": ["Menus & footer", "Éditeur drag & drop du menu principal et du pied de page"],
  "/console/seo": ["SEO & partage", "Titres, meta, pixels Meta/TikTok, sitemap"],
};

export default function Placeholder() {
  const { pathname } = useLocation();
  const [title, desc] = TITLES[pathname] || ["Module", "Cette section arrive bientôt"];
  return (
    <div className="space-y-5">
      <div><h1 className="font-serif text-3xl">{title}</h1><p className="text-sm text-[#666] mt-1">{desc}</p></div>
      <div className="dina-card-white">
        <EmptyState icon={Construction} title="Bientôt disponible" description="Ce module est planifié dans la refonte en cours (sections 5-11 du cahier des charges). Les onglets existants dans la sidebar restent pleinement fonctionnels."/>
      </div>
    </div>
  );
}
