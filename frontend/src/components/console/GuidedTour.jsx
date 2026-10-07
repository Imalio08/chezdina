import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation, Link } from "react-router-dom";
import { X, ArrowRight, GraduationCap } from "lucide-react";

/**
 * Short guided tour shown on first login of each user.
 * Steps are personalized by role. State persisted in localStorage per user id.
 */
const STEPS_BY_ROLE = {
  admin: [
    { target: "nav-tableau-de-bord", title: "Tableau de bord", text: "Votre vue d'ensemble : CA, commandes, alertes, performance." },
    { target: "nav-caisse", title: "Caisse", text: "Encaissez les ventes en boutique avec scan et paiement." },
    { target: "nav-commandes", title: "Commandes", text: "Suivez et confirmez chaque commande web." },
    { target: "nav-produits", title: "Produits", text: "Catalogue, variantes, prix, stock, IA description." },
    { target: "nav-statistiques", title: "Statistiques", text: "12 onglets d'analyse pour piloter votre boutique." },
    { target: "nav-parametres", title: "Paramètres", text: "Identité, paiements, livraison, notifications." },
    { target: "nav-manuel-dutilisation", title: "Manuel d'utilisation", text: "16 modules illustrés pour maîtriser Chez Dina. Vous pouvez le rejouer à tout moment !" },
  ],
  manager: [
    { target: "nav-tableau-de-bord", title: "Tableau de bord", text: "Votre vue d'ensemble du jour." },
    { target: "nav-caisse", title: "Caisse", text: "Démarrez la journée en ouvrant votre session." },
    { target: "nav-commandes", title: "Commandes", text: "Confirmez les commandes web dès qu'elles arrivent." },
    { target: "nav-livraisons", title: "Livraisons", text: "Affectez les commandes à vos livreurs." },
    { target: "nav-clients", title: "Clientes", text: "Fiches 360° pour fidéliser." },
    { target: "nav-manuel-dutilisation", title: "Manuel", text: "Toutes les procédures sont ici." },
  ],
  sales: [
    { target: "nav-caisse", title: "Caisse", text: "Votre écran principal : scan, cliente, encaissement." },
    { target: "nav-commandes", title: "Commandes", text: "Préparez les commandes à expédier." },
    { target: "nav-clients", title: "Clientes", text: "Trouvez les préférences de chaque cliente." },
    { target: "nav-manuel-dutilisation", title: "Manuel", text: "Besoin d'aide ? Consultez vos modules." },
  ],
  rider: [
    { target: "rider-today", title: "Ma journée", text: "Les commandes du jour à livrer." },
    { target: "rider-active", title: "En cours", text: "La commande en route actuellement." },
    { target: "rider-score", title: "Mon score", text: "Ponctualité, note cliente, preuve de livraison." },
  ],
  stock: [
    { target: "nav-produits", title: "Produits", text: "Vérifiez le stock et les variantes." },
    { target: "nav-stock", title: "Stock & inventaires", text: "Faites vos comptages réguliers." },
    { target: "nav-approvisionnements", title: "Approvisionnements", text: "Suivez les commandes fournisseurs." },
    { target: "nav-manuel-dutilisation", title: "Manuel", text: "Procédures stock et réception." },
  ],
};

export default function GuidedTour() {
  const { user } = useAuth();
  const location = useLocation();
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);
  const [replay, setReplay] = useState(false);

  const key = user?.id ? `dina_tour_done_${user.id}` : null;
  const steps = useMemo(() => STEPS_BY_ROLE[user?.role] || STEPS_BY_ROLE.manager, [user?.role]);

  useEffect(() => {
    if (!user?.id) return;
    const done = localStorage.getItem(key);
    if (!done && location.pathname.startsWith("/console")) {
      setTimeout(() => setOpen(true), 800);
    }
  }, [user?.id, key, location.pathname]);

  useEffect(() => {
    const onReplay = () => { setStep(0); setOpen(true); setReplay(true); };
    window.addEventListener("dina-replay-tour", onReplay);
    const onKey = (e) => { if (e.key === "Escape" && open) close(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("dina-replay-tour", onReplay); window.removeEventListener("keydown", onKey); };
  }, [open]); // eslint-disable-line

  if (!open || !steps.length) return null;
  const current = steps[step];
  const last = step === steps.length - 1;

  const close = () => {
    setOpen(false);
    if (key) localStorage.setItem(key, "1");
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4" data-testid="guided-tour">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-[#fff5f5] text-[#b02a2a] grid place-items-center"><GraduationCap size={20}/></div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[#999]">Visite guidée · {step + 1}/{steps.length}</div>
              <div className="font-serif text-xl">{current.title}</div>
            </div>
          </div>
          <button onClick={close} className="text-[#666]" data-testid="tour-close"><X size={18}/></button>
        </div>
        <p className="text-sm text-[#1c1c1c] mb-4">{current.text}</p>
        <div className="flex gap-2">
          {step > 0 && <button onClick={() => setStep(s => s - 1)} className="dina-btn-secondary flex-1" data-testid="tour-prev">Précédent</button>}
          {!last && <button onClick={() => setStep(s => s + 1)} className="dina-btn-primary flex-1" data-testid="tour-next">Suivant <ArrowRight size={14}/></button>}
          {last && <Link to="/console/manuel" onClick={close} className="dina-btn-primary flex-1 text-center" data-testid="tour-finish">Ouvrir le manuel</Link>}
        </div>
        {replay && <div className="text-[10px] text-[#999] text-center mt-2">Vous rejouez la visite. Elle peut être relancée depuis le manuel.</div>}
      </div>
    </div>
  );
}
