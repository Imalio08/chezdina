import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Lock, PlayCircle, StopCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { OpenModal, CloseModal } from "@/pages/console/CashSessions";

const hhmm = (iso) => iso ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h") : "";

function SessionBanner({ session, onOpen, onClose }) {
  if (!session) return (
    <div className="flex items-center justify-between gap-2 flex-wrap rounded-xl px-4 py-2.5 mb-3 bg-[#fdecec] text-[#991b1b]" data-testid="pos-session-banner">
      <span className="text-sm font-semibold flex items-center gap-2"><Lock size={14}/>Aucune session ouverte · ventes bloquées</span>
      <button onClick={onOpen} className="dina-btn-primary !min-h-[36px] text-xs" data-testid="pos-banner-open"><PlayCircle size={13}/>Ouvrir la session</button>
    </div>
  );
  const pending = session.status === "pending_validation";
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap rounded-xl px-4 py-2.5 mb-3 bg-[#eafaf1] text-[#1f6b3a] dark:bg-[#12261a] dark:text-[#7fd6a0]" data-testid="pos-session-banner">
      <span className="text-sm font-semibold flex items-center gap-2" data-testid="pos-session-status"><CheckCircle2 size={14}/>Session ouverte depuis {hhmm(session.opened_at)} · {session.opened_by}</span>
      {!pending && <button onClick={onClose} className="dina-btn-secondary !min-h-[36px] text-xs !text-[#c62828] !border-[#c62828]" data-testid="pos-banner-close"><StopCircle size={13}/>Fermer la session</button>}
    </div>
  );
}

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

  const [showClose, setShowClose] = useState(false);
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
  if (open) return (
    <>
      <SessionBanner session={open} onClose={() => setShowClose(true)}/>
      {children}
      {showClose && <CloseModal session={open} onClose={() => setShowClose(false)} onDone={() => { setShowClose(false); check(); }}/>}
    </>
  );

  return (
    <>
    <SessionBanner session={null} onOpen={() => setShowOpen(true)}/>
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
    </>
  );
}
