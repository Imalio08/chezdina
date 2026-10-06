import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Lock, PlayCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * Verrou POS : interdit la vente sans session de caisse ouverte.
 * Affiche un overlay bloquant avec bouton "Ouvrir la session de caisse".
 */
export default function POSSessionGuard({ children }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);  // session objet | null si pas ouverte
  const [openingAmount, setOpeningAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const check = async () => {
    setLoading(true);
    try {
      const r = await api.get("/cash-sessions");
      const current = (r.data || []).find(s => !s.closed);
      setOpen(current || null);
    } catch { setOpen(null); }
    finally { setLoading(false); }
  };
  useEffect(() => { check(); const t = setInterval(check, 30000); return () => clearInterval(t); }, []);

  const openSession = async () => {
    const n = parseInt(openingAmount || "0", 10);
    if (Number.isNaN(n) || n < 0) { toast.error("Montant invalide"); return; }
    setSubmitting(true);
    try {
      await api.post("/cash-sessions/open", { opening_cash: n });
      toast.success("Session ouverte · bonne journée !");
      await check();
    } catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="min-h-[60vh] grid place-items-center text-sm text-[#666]">Vérification de la session…</div>;
  if (open) return children;

  return (
    <div className="min-h-[70vh] grid place-items-center p-6" data-testid="pos-session-guard">
      <div className="dina-card-white p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-[#fff5f5] dark:bg-[#2a1818] grid place-items-center mx-auto mb-4">
          <Lock size={28} className="text-[#b02a2a]"/>
        </div>
        <div className="font-serif text-2xl mb-2">Ouvrez votre session de caisse pour commencer</div>
        <div className="text-sm text-[#666] mb-5">Aucune vente ne peut être effectuée sans session ouverte. Comptez votre fond de caisse et entrez le montant initial.</div>
        <label className="text-xs uppercase text-[#666] font-semibold block text-left mb-1">Fond de caisse initial (FCFA)</label>
        <input type="number" inputMode="numeric" min="0" className="dina-input tabular text-right text-xl mb-4"
               value={openingAmount} onChange={e => setOpeningAmount(e.target.value)}
               placeholder="0" data-testid="pos-guard-opening" autoFocus/>
        <div className="flex gap-2">
          <button onClick={() => nav("/console")} className="dina-btn-secondary flex-1">Retour au tableau de bord</button>
          <button onClick={openSession} disabled={submitting} className="dina-btn-primary flex-1" data-testid="pos-guard-open"><PlayCircle size={14}/>{submitting ? "…" : "Ouvrir la session"}</button>
        </div>
        <div className="text-[11px] text-[#999] mt-3">Ou allez dans <b>Sessions de caisse</b> pour plus d'options.</div>
      </div>
    </div>
  );
}
