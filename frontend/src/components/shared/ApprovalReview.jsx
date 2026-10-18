import React, { useState } from "react";
import { toast } from "sonner";
import { X, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import api from "@/lib/api";
import { fcfa, dateTimeFmt } from "@/lib/format";

export const stockRow = (s) => ({
  id: s.id, kind: "stock_adjustment", source: "stock",
  title: `Ajustement de stock · ${s.product_name || ""}${s.size ? ` · ${s.size}` : ""}`,
  requestedBy: s.requested_by, reason: s.reason, createdAt: s.created_at,
  status: s.status === "approved" ? "approved" : s.status === "rejected" ? "rejected" : "pending",
  decisionBy: s.approved_by || s.rejected_by, decisionNote: s.decision_note,
  payload: { qty_delta: s.qty_delta }, stock: s,
});

const endpointOf = (r) => r.source === "expense" ? `/expense-requests/${r.id}/decide` : r.source === "stock" ? `/stock/adjustment-requests/${r.id}/decide` : `/approval-requests/${r.id}/decide`;
const bodyOf = (r, ok, note) => r.source === "stock" ? { decision: ok ? "approve" : "reject", note } : { decision: ok ? "approved" : "rejected", note };

function Content({ r }) {
  const s = r.stock;
  const p = r.payload || {};
  const extra = Object.entries(p).filter(([k, v]) => !["qty_delta", "category", "amount"].includes(k) && v != null && typeof v !== "object");
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><div className="text-[#999] uppercase text-[10px]">Demandé par</div><b data-testid="review-requester">{r.requestedBy || "—"}</b></div>
        <div><div className="text-[#999] uppercase text-[10px]">Le</div><b>{dateTimeFmt(r.createdAt)}</b></div>
      </div>
      <div><div className="text-[#999] uppercase text-[10px]">Motif</div><div className="italic" data-testid="review-reason">{r.reason || "Aucun motif indiqué"}</div></div>
      {s && (
        <div className="rounded-lg border border-[#ececec] p-3 flex gap-3 items-center" data-testid="review-stock">
          {s.image && <img src={s.image} alt="" className="w-14 h-14 rounded object-cover"/>}
          <div className="flex-1 min-w-0">
            <div className="font-semibold">{s.product_name}{s.size ? ` · ${s.size}` : ""}</div>
            {s.sku && <div className="text-[11px] font-mono text-[#666]">{s.sku}</div>}
            <div className="flex items-center gap-2 mt-1 text-sm tabular">
              <span>Stock {s.stock_before ?? s.stock_now ?? "—"}</span><ArrowRight size={12}/><b className={s.qty_delta < 0 ? "text-[#c62828]" : "text-[#1f8a4c]"}>{s.stock_after ?? "—"}</b>
              <span className={`text-xs ${s.qty_delta < 0 ? "text-[#c62828]" : "text-[#1f8a4c]"}`}>({s.qty_delta > 0 ? "+" : ""}{s.qty_delta} pièce{Math.abs(s.qty_delta) > 1 ? "s" : ""})</span>
            </div>
            {s.value_impact ? <div className="text-[11px] text-[#666]">Valeur du stock : {s.value_impact > 0 ? "+" : "−"}{fcfa(Math.abs(s.value_impact))}</div> : null}
          </div>
        </div>
      )}
      {r.amount != null && <div className="flex justify-between"><span className="text-[#666]">Montant</span><b className="tabular" data-testid="review-amount">{fcfa(r.amount)}</b></div>}
      {p.category && <div className="flex justify-between"><span className="text-[#666]">Catégorie</span><b>{p.category}</b></div>}
      {extra.map(([k, v]) => <div key={k} className="flex justify-between text-xs"><span className="text-[#666]">{k.replace(/_/g, " ")}</span><b>{String(v)}</b></div>)}
      {r.status !== "pending" && <div className="text-xs" style={{ color: r.status === "approved" ? "#1f8a4c" : "#c62828" }}>{r.status === "approved" ? "Validée" : "Refusée"} par {r.decisionBy || "—"}{r.decisionNote ? ` · Motif : ${r.decisionNote}` : ""}</div>}
    </div>
  );
}

// Request details → Valider (summary confirmation) or Rejeter (mandatory reason). Nothing is applied without confirming.
export default function ApprovalReview({ row, onClose, onDone }) {
  const [step, setStep] = useState("view");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async (ok) => {
    if (!ok && !note.trim()) return toast.error("Indiquez le motif du refus");
    setBusy(true);
    try { await api.post(endpointOf(row), bodyOf(row, ok, note.trim())); toast.success(ok ? "Demande validée" : "Demande refusée"); onDone(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-[70] grid place-items-center p-4" onClick={e => e.target === e.currentTarget && onClose()} data-testid="approval-review">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="font-serif text-xl">{step === "confirm" ? "Confirmer la validation" : step === "reject" ? "Refuser la demande" : row.title}</div>
          <button onClick={onClose} aria-label="Fermer" data-testid="approval-review-close"><X size={18}/></button>
        </div>
        {step === "view" && <>
          <Content r={row}/>
          {row.status === "pending" && <div className="flex gap-2 mt-5">
            <button onClick={() => setStep("confirm")} className="dina-btn-primary flex-1 !bg-[#1f8a4c]" data-testid="review-validate"><CheckCircle size={14}/>Valider</button>
            <button onClick={() => setStep("reject")} className="dina-btn-secondary flex-1 !text-[#c62828]" data-testid="review-reject"><XCircle size={14}/>Rejeter</button>
          </div>}
        </>}
        {step === "confirm" && <>
          <div className="text-sm mb-3">Vous allez valider cette demande. Elle sera appliquée immédiatement :</div>
          <div className="rounded-xl bg-[#f0f9f4] p-3"><div className="font-semibold mb-2">{row.title}</div><Content r={row}/></div>
          <div className="flex gap-2 mt-5">
            <button onClick={() => setStep("view")} className="dina-btn-secondary flex-1" data-testid="review-confirm-back">Retour</button>
            <button onClick={() => send(true)} disabled={busy} className="dina-btn-primary flex-1 !bg-[#1f8a4c]" data-testid="review-confirm-validate"><CheckCircle size={14}/>{busy ? "…" : "Confirmer la validation"}</button>
          </div>
        </>}
        {step === "reject" && <>
          <div className="text-sm mb-2">{row.title} · demandé par <b>{row.requestedBy || "—"}</b></div>
          <label className="text-[10px] uppercase text-[#666] font-semibold">Motif du refus (obligatoire)</label>
          <textarea rows={3} className="dina-input mt-1" value={note} onChange={e => setNote(e.target.value)} placeholder="Expliquez pourquoi : la personne verra ce motif" data-testid="review-reject-reason"/>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setStep("view")} className="dina-btn-secondary flex-1" data-testid="review-reject-back">Retour</button>
            <button onClick={() => send(false)} disabled={busy || !note.trim()} className="dina-btn-primary flex-1 !bg-[#c62828] disabled:opacity-50" data-testid="review-confirm-reject"><XCircle size={14}/>{busy ? "…" : "Confirmer le refus"}</button>
          </div>
        </>}
      </div>
    </div>
  );
}
