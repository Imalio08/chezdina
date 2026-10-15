import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Lock, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { OpenModal } from "@/pages/console/CashSessions";

/**
 * Verrou POS : interdit la vente sans session de caisse ouverte.
 * Affiche un overlay bloquant avec bouton "Ouvrir la session de caisse".
 */
export default function POSSessionGuard({ children }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);  // session objet | null si pas ouverte
  const [showOpen, setShowOpen] = useState(false);

  const check = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await api.get("/cash-sessions");
      const current = (r.data || []).find(s => !s.closed);
      setOpen(current || null);
    } catch { if (!silent) setOpen(null); }
    finally { setLoading(false); }
  };
  // Background re-check stays silent so the Caisse (cart, open forms) is never unmounted.
  useEffect(() => { check(); const t = setInterval(() => check(true), 30000); return () => clearInterval(t); }, []);


  if (loading) return <div className="min-h-[60vh] grid place-items-center text-sm text-[#666]">Vérification de la session…</div>;
  if (open) return children;

  return (
    <div className="min-h-[70vh] grid place-items-center p-6" data-testid="pos-session-guard">
      <div className="dina-card-white p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-[#fff5f5] dark:bg-[#2a1818] grid place-items-center mx-auto mb-4">
          <Lock size={28} className="text-[#b02a2a]"/>
        </div>
        <div className="font-serif text-2xl mb-2">Ouvrez votre session de caisse pour commencer</div>
        <div className="text-sm text-[#666] mb-5">Aucune vente ne peut être effectuée sans session ouverte. Choisissez la gérante, la date et saisissez le fond de caisse.</div>
        <div className="flex gap-2">
          <button onClick={() => nav("/console")} className="dina-btn-secondary flex-1">Retour au tableau de bord</button>
          <button onClick={() => setShowOpen(true)} className="dina-btn-primary flex-1" data-testid="pos-guard-open"><PlayCircle size={14}/>Ouvrir une session</button>
        </div>
        {showOpen && <OpenModal user={user} onCancel={() => setShowOpen(false)} onDone={() => { setShowOpen(false); check(); }}/>}
        <div className="text-[11px] text-[#999] mt-3">Ou allez dans <b>Sessions de caisse</b> pour plus d'options.</div>
      </div>
    </div>
  );
}
