import React from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Check, Shield } from "lucide-react";
import { statusLabel, statusColor } from "@/lib/format";

export const isVerse = (rec) => (typeof rec === "object" && rec ? !!rec.collected : !!rec);

export const missingVersements = (session) =>
  (session.orders_detail || []).filter(o => !o.postponed_to && o.status === "livree" && o.payment_method === "cod" && !isVerse(session.reconciliations?.[o.id]));

const ddmm = (iso) => { const [, m, d] = (iso || "").split("-"); return d && m ? `${d}/${m}` : iso; };

export function OrderDayStatus({ order, small }) {
  if (order.postponed_to) return <span className={`dina-chip !py-0.5 ${small ? "text-[9px]" : "text-[10px]"} !text-[#e4991e] !border-[#e4991e]`} data-testid={`postponed-${order.code}`}>Reportée au {ddmm(order.postponed_to)}</span>;
  return <span className={`dina-chip !py-0.5 ${small ? "text-[9px]" : "text-[10px]"}`} style={{ color: statusColor[order.status] || "#999", borderColor: statusColor[order.status] || "#999" }}>{statusLabel[order.status] || order.status}</span>;
}

export function VersementCell({ session, order, onVerse, onReload }) {
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
    <div className="flex items-center gap-1.5" data-testid={`versement-${order.code}`}>
      <span className="dina-chip !text-[#c62828] !border-[#c62828] text-[10px]">Non versé</span>
      {!session.closed && <button onClick={() => onVerse(order)} className="dina-btn-primary !min-h-[28px] text-[11px]" data-testid={`reconcile-${order.code}`}><Shield size={10}/>Marquer versé</button>}
    </div>
  );
}
