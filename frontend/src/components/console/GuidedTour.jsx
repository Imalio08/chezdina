import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { useLocation, useNavigate } from "react-router-dom";
import { X, ArrowRight, GraduationCap } from "lucide-react";
import { canAccess } from "@/lib/rbac";

// Step-by-step tour of the main screens, shown at first login (console + rider app), relaunchable from the manual.
const C = (to, target, title, text) => ({ to, target, title, text });
const CONSOLE = [
  C("/console", "nav-tableau-de-bord", "Tableau de bord", "Votre point de départ : chiffre du jour, commandes à traiter, alertes de stock et tâches en attente. Touchez une carte pour ouvrir le détail."),
  C("/console/pos", "nav-caisse", "Caisse", "Ouvrez d'abord la session de caisse avec le fond de caisse. Scannez ou touchez « + » sur un produit, choisissez la cliente, appliquez un code promo ou le solde, puis encaissez."),
  C("/console/commandes", "nav-commandes", "Commandes", "Toutes les commandes du site et de la caisse. Confirmez, préparez (chaque article vérifié par son code), affectez un livreur et suivez le statut jusqu'à la livraison."),
  C("/console/livraisons", "nav-livraisons", "Livraisons", "Affectez les courses aux livreurs, suivez-les sur la carte en direct et réconciliez l'argent rapporté en fin de journée."),
  C("/console/produits", "nav-produits", "Produits", "Catalogue, tailles, couleurs, prix et photos. La baguette magique crée des visuels supplémentaires ; la vraie photo reste la principale."),
  C("/console/stock", "nav-stock", "Stock & inventaires", "Stock par taille, mouvements, demandes d'ajustement, articles non vendables et inventaires réguliers (planifiés, surprise, partiels) validés par le propriétaire."),
  C("/console/clients", "nav-clients", "Clientes", "Les numéros sont masqués dans les listes. Ouvrez une fiche pour voir le numéro complet : chaque ouverture est enregistrée."),
  C("/console/messagerie", "nav-messagerie", "Messagerie", "Échangez avec les clientes et les livreurs, avec mise en forme, emojis et pièces jointes."),
  C("/console/sessions-caisse", "nav-sessions-de-caisse", "Sessions de caisse", "Clôture à l'aveugle : la gérante compte sans voir l'attendu. Le propriétaire reçoit l'analyse et valide ou rejette avec un motif."),
  C("/console/equipe", "nav-equipe", "Équipe", "Employés, présences, rôles & permissions, sécurité des accès et dossier d'onboarding de chaque employé."),
  C("/console/parametres", "nav-parametres", "Paramètres", "Coordonnées et GPS de la boutique, horaires et fermetures exceptionnelles, paiements, documents RH."),
  C("/console/manuel", "nav-manuel-dutilisation", "Manuel d'utilisation", "Toutes les procédures en détail. Vous pouvez relancer cette visite à tout moment depuis le manuel."),
];
const RIDER = [
  C("/riders", "rider-tab-courses", "Courses", "Vos commandes du jour. Ouvrez une course pour voir le prénom, le quartier, le repère, les articles et le montant à encaisser."),
  C("/riders", "rider-tab-courses", "Démarrer une course", "« Je démarre » ouvre la carte sur cette course avec l'itinéraire et le guidage vocal. À 50 m de la cliente, l'arrivée est signalée automatiquement."),
  C("/riders", "rider-tab-courses", "Contacter la cliente", "Utilisez « Appeler » (quand la course est en route) ou la messagerie. Le numéro n'est jamais affiché et chaque appel est noté."),
  C("/riders/carte", "rider-tab-carte", "Carte", "Toutes vos courses sur la carte. « Optimiser ma tournée » propose l'ordre le plus court."),
  C("/riders/messages", "rider-tab-messages", "Messages", "Vos échanges avec la boutique et les clientes, même hors connexion : tout part dès le retour du réseau."),
  C("/riders/profil", "rider-tab-profil", "Profil", "Historique, performance, solde à remettre, signalements et manuel. La visite peut être relancée d'ici."),
];

export default function GuidedTour() {
  const { user } = useAuth();
  const location = useLocation();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);
  const rider = location.pathname.startsWith("/riders");
  const key = user?.id ? `dina_tour_done_${user.id}` : null;
  const steps = useMemo(() => rider ? RIDER : CONSOLE.filter(s => canAccess(user?.role, s.to)), [rider, user?.role]);

  useEffect(() => {
    if (!user?.id || user.onboarding_required || !(rider || location.pathname.startsWith("/console"))) return;
    if (user.tour_done || localStorage.getItem(key)) return;
    localStorage.setItem(key, "1"); api.post("/auth/me/tour-done").catch(() => {});
    setStep(0); setOpen(true);
  }, [user?.id, user?.tour_done, user?.onboarding_required, key, rider]); // eslint-disable-line

  useEffect(() => {
    const onReplay = () => { setStep(0); setOpen(true); };
    window.addEventListener("dina-replay-tour", onReplay);
    return () => window.removeEventListener("dina-replay-tour", onReplay);
  }, []);

  const cur = open ? steps[step] : null;
  useEffect(() => {
    if (!cur) return;
    if (cur.to && location.pathname !== cur.to) nav(cur.to);
    let el = null;
    const t = setTimeout(() => {
      el = document.querySelector(`[data-testid="${cur.target}"]`) || document.querySelector(`aside a[href="${cur.to}"], nav a[href="${cur.to}"]`);
      if (el) { el.scrollIntoView({ block: "nearest", behavior: "smooth" }); el.classList.add("dina-tour-focus"); }
    }, 350);
    return () => { clearTimeout(t); el?.classList.remove("dina-tour-focus"); };
  }, [cur?.title, open]); // eslint-disable-line
  useEffect(() => {
    if (!open) return;
    const k = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  if (!cur) return null;
  const last = step === steps.length - 1;
  return (
    <div className="fixed inset-x-0 bottom-20 sm:bottom-6 z-[90] px-3 pointer-events-none" data-testid="guided-tour">
      <style>{`.dina-tour-focus{outline:3px solid #b02a2a!important;outline-offset:3px;border-radius:10px;position:relative;z-index:60}`}</style>
      <div className="pointer-events-auto mx-auto bg-white dark:bg-[#1a1a1a] rounded-2xl p-5 max-w-md w-full shadow-2xl border border-[#f0dede]">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-[#fff5f5] text-[#b02a2a] grid place-items-center"><GraduationCap size={18} /></div>
            <div><div className="text-[10px] uppercase tracking-widest text-[#999]" data-testid="tour-progress">Visite guidée · {step + 1}/{steps.length}</div><div className="font-serif text-lg" data-testid="tour-title">{cur.title}</div></div>
          </div>
          <button onClick={() => setOpen(false)} className="text-[#666]" data-testid="tour-close"><X size={18} /></button>
        </div>
        <p className="text-sm mb-3" data-testid="tour-text">{cur.text}</p>
        <div className="flex gap-2">
          {step > 0 && <button onClick={() => setStep(s => s - 1)} className="dina-btn-secondary flex-1" data-testid="tour-prev">Précédent</button>}
          {!last && <button onClick={() => setStep(s => s + 1)} className="dina-btn-primary flex-1" data-testid="tour-next">Suivant <ArrowRight size={14} /></button>}
          {last && <button onClick={() => setOpen(false)} className="dina-btn-primary flex-1" data-testid="tour-finish">Terminer</button>}
        </div>
      </div>
    </div>
  );
}
