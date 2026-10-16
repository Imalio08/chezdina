import React, { useState } from "react";
import { toast } from "sonner";
import { Wallet, CheckCircle2, XCircle } from "lucide-react";
import api from "@/lib/api";
import { fcfa, dateTimeFmt, payInfo } from "@/lib/format";

export default function WaveProofCard({ order, canVerify, onDone }) {
  const [zoom, setZoom] = useState(false);
  const [busy, setBusy] = useState(false);
  const p = order.wave_proof;
  if (order.payment_method !== "wave" && order.status !== "en_attente_acompte" && !p) return null;
  const info = order.status === "en_attente_acompte" && !p ? { label: "Acompte non payé", color: "#c62828" } : payInfo(order);
  const verify = async (decision) => {
    const body = { decision };
    if (decision === "reject") {
      const reason = prompt("Motif du refus (visible par la cliente) :", "Paiement non reçu sur Wave");
      if (!reason) return;
      body.reason = reason;
    } else if (!window.confirm(`Confirmez-vous avoir bien reçu ${fcfa(p?.amount || order.total)} sur Wave ?`)) return;
    setBusy(true);
    try { await api.post(`/orders/${order.id}/wave-verify`, body); toast.success(decision === "accept" ? "Paiement marqué reçu" : "Preuve refusée · la cliente est prévenue"); onDone(); }
    catch (e) { toast.error(e.response?.data?.detail || "Action impossible"); }
    finally { setBusy(false); }
  };
  return (
    <div className="dina-card-white p-5" data-testid="wave-proof-card">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2 font-semibold"><Wallet size={14} className="text-[#b02a2a]"/>Paiement Wave{p?.kind === "acompte" ? " · acompte" : ""}</div>
        <span className="dina-chip font-semibold" style={{ color: info.color }} data-testid="wave-pay-status">{info.label}</span>
      </div>
      {!p ? <div className="text-sm text-[#666]" data-testid="wave-no-proof">La cliente n'a pas encore envoyé de preuve de paiement.</div> : (
        <div className="flex gap-4 flex-wrap">
          <button type="button" onClick={() => setZoom(true)} className="shrink-0" data-testid="wave-proof-thumb"><img src={p.image} alt="Preuve Wave" className="w-32 h-44 object-cover rounded-lg border border-[#ececec]"/></button>
          <div className="text-sm space-y-1 min-w-0 flex-1">
            <div><span className="text-[#666]">Montant attendu :</span> <b className="tabular">{fcfa(p.amount)}</b></div>
            <div><span className="text-[#666]">ID transaction :</span> <b className="font-mono">{p.tx_ref || "—"}</b></div>
            <div className="text-xs text-[#666]">Envoyée le {dateTimeFmt(p.submitted_at)}</div>
            {p.verified_by && <div className="text-xs text-[#666]">{p.status === "refusee" ? "Refusée" : "Validée"} par {p.verified_by} · {dateTimeFmt(p.verified_at)}{p.reject_reason ? ` · ${p.reject_reason}` : ""}</div>}
            {canVerify && order.payment_status === "preuve_envoyee" && (
              <div className="pt-2 space-y-2">
                <div className="text-xs text-[#8a5a00] bg-[#fff7e6] rounded p-2">Vérifiez dans votre application Wave que le montant est bien arrivé avant de valider.</div>
                <div className="flex gap-2 flex-wrap">
                  <button disabled={busy} onClick={() => verify("accept")} className="dina-btn-primary !min-h-[36px] text-xs !bg-[#1f8a4c]" data-testid="wave-accept"><CheckCircle2 size={13}/>Paiement reçu</button>
                  <button disabled={busy} onClick={() => verify("reject")} className="dina-btn-secondary !min-h-[36px] text-xs !text-[#c62828]" data-testid="wave-reject"><XCircle size={13}/>Refuser la preuve</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {zoom && <div className="fixed inset-0 bg-black/80 z-50 grid place-items-center p-4" onClick={() => setZoom(false)} data-testid="wave-proof-zoom"><img src={p.image} alt="Preuve Wave" className="max-h-[90vh] max-w-full rounded-lg"/></div>}
    </div>
  );
}
