import React, { useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Check, Shield, XCircle, X } from "lucide-react";
import { statusLabel, statusColor, fcfa } from "@/lib/format";

const CATS = [["montant", "Montant incorrect"], ["justificatif", "Justificatif manquant"], ["ecart", "Écart de caisse"], ["autre", "Autre anomalie"]];

function RejectVersementModal({ session, order, onClose, onDone }) {
  const [cat, setCat] = useState("");
  const [reason, setReason] = useState("");
  const [declared, setDeclared] = useState("");
  const [busy, setBusy] = useState(false);
  const ecart = declared === "" ? null : (+declared) - (order.total || 0);
  const submit = async () => {
    if (!cat) return toast.error("Choisissez le type d'anomalie");
    if (reason.trim().length < 3) return toast.error("Le motif est obligatoire");
    setBusy(true);
    try { await api.post(`/delivery-sessions/${session.id}/reject-versement`, { order_id: order.id, category: cat, reason, declared }); toast.success("Versement rejeté · le livreur est prévenu"); onDone(); }
    catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()} data-testid="reject-versement-modal">
        <div className="flex justify-between items-start mb-3"><div className="font-serif text-xl text-[#c62828]">Rejeter le versement {order.code}</div><button onClick={onClose}><X size={18}/></button></div>
        <div className="text-xs text-[#666] mb-3">Attendu : <b className="tabular">{fcfa(order.total || 0)}</b></div>
        <label className="text-xs uppercase font-semibold text-[#666]">Montant remis par le livreur</label>
        <input type="number" className="dina-input mb-1 tabular" value={declared} onChange={e => setDeclared(e.target.value)} data-testid="reject-versement-declared"/>
        {ecart !== null && <div className={`text-xs mb-3 tabular ${ecart < 0 ? "text-[#c62828]" : "text-[#1f8a4c]"}`}>Écart : {ecart > 0 ? "+" : ""}{fcfa(ecart)}</div>}
        <label className="text-xs uppercase font-semibold text-[#666]">Type d'anomalie *</label>
        <div className="grid grid-cols-2 gap-2 mt-1 mb-3">{CATS.map(([k, l]) => <button key={k} type="button" onClick={() => setCat(k)} className={`py-2 rounded-lg border text-xs ${cat === k ? "bg-[#c62828] text-white border-[#c62828]" : "border-[#ececec]"}`} data-testid={`reject-versement-cat-${k}`}>{l}</button>)}</div>
        <label className="text-xs uppercase font-semibold text-[#666]">Motif *</label>
        <textarea rows={3} className="dina-input mb-4" placeholder="Ex. 2 000 FCFA manquants, reçu Wave absent…" value={reason} onChange={e => setReason(e.target.value)} data-testid="reject-versement-reason"/>
        <div className="flex gap-2"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={submit} disabled={busy} className="dina-btn-primary flex-1 !bg-[#c62828]" data-testid="reject-versement-confirm"><XCircle size={13}/>{busy ? "Rejet…" : "Rejeter"}</button></div>
      </div>
    </div>
  );
}

export const isVerse = (rec) => (typeof rec === "object" && rec ? !!rec.collected : !!rec);

export const missingVersements = (session) =>
  (session.orders_detail || []).filter(o => !o.postponed_to && o.status === "livree" && o.payment_method === "cod" && !isVerse(session.reconciliations?.[o.id]));

const ddmm = (iso) => { const [, m, d] = (iso || "").split("-"); return d && m ? `${d}/${m}` : iso; };

export function OrderDayStatus({ order, small }) {
  if (order.postponed_to) return <span className={`dina-chip !py-0.5 ${small ? "text-[9px]" : "text-[10px]"} !text-[#e4991e] !border-[#e4991e]`} data-testid={`postponed-${order.code}`}>Reportée au {ddmm(order.postponed_to)}</span>;
  return <span className={`dina-chip !py-0.5 ${small ? "text-[9px]" : "text-[10px]"}`} style={{ color: statusColor[order.status] || "#999", borderColor: statusColor[order.status] || "#999" }}>{statusLabel[order.status] || order.status}</span>;
}

export function VersementCell({ session, order, onVerse, onReload }) {
  const [rejecting, setRejecting] = useState(false);
  if (order.postponed_to) return <span className="text-[10px] text-[#999]">Hors encaissement (reportée)</span>;
  if (order.payment_method !== "cod") return <span className="text-xs text-[#666]">Prépayée</span>;
  const rec = session.reconciliations?.[order.id];
  const unmark = async () => {
    if (!window.confirm(`Repasser ${order.code} en « Non versé » ?`)) return;
    try { await api.patch(`/delivery-sessions/${session.id}/reconcile`, { order_id: order.id, collected: false }); toast.success("Marquée non versée"); onReload(); }
    catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };
  if (isVerse(rec)) return (
    <div className="flex items-center gap-1.5" data-testid={`versement-${order.code}`}>
      <span className="dina-chip !text-[#1f8a4c] !border-[#1f8a4c] text-[10px]"><Check size={10}/>Versé{rec?.approved_by ? ` · ${rec.approved_by}` : ""}</span>
      {!session.closed && <button onClick={unmark} className="text-[10px] text-[#999] hover:text-[#c62828] hover:underline" data-testid={`versement-unmark-${order.code}`}>Annuler</button>}
    </div>
  );
  return (
    <div className="flex items-center gap-1.5 flex-wrap" data-testid={`versement-${order.code}`}>
      {rec?.rejected ? <span className="dina-chip !text-[#c62828] !border-[#c62828] text-[10px]" title={rec.reason} data-testid={`versement-rejected-${order.code}`}><XCircle size={10}/>Rejeté · {rec.category_label}</span> : <span className="dina-chip !text-[#c62828] !border-[#c62828] text-[10px]">Non versé</span>}
      {rec?.resubmitted && <span className="text-[10px] text-[#e4991e] font-semibold" data-testid={`versement-resubmitted-${order.code}`}>Corrigé : {fcfa(rec.resubmitted.amount)}</span>}
      {!session.closed && <button onClick={() => onVerse(order)} className="dina-btn-primary !min-h-[28px] text-[11px]" data-testid={`reconcile-${order.code}`}><Shield size={10}/>Valider</button>}
      {!session.closed && <button onClick={() => setRejecting(true)} className="dina-btn-secondary !min-h-[28px] text-[11px] !text-[#c62828] !border-[#c62828]" data-testid={`reject-versement-${order.code}`}><XCircle size={10}/>Rejeter</button>}
      {rejecting && <RejectVersementModal session={session} order={order} onClose={() => setRejecting(false)} onDone={() => { setRejecting(false); onReload(); }}/>}
    </div>
  );
}
