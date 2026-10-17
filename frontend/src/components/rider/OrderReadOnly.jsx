import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa, statusLabel, statusColor, dateTimeFmt } from "@/lib/format";
import { X, MapPin, User, Package, Wallet, Clock, Lock } from "lucide-react";

const PAY = { cod: "Paiement à la livraison", wave: "Wave", orange_money: "Orange Money", mtn: "MTN MoMo", card: "Carte", cash: "Espèces" };

function Section({ icon: Icon, title, children }) {
  return (
    <div className="border-t border-[#f0f0f0] dark:border-[#2a2a2a] pt-3">
      <div className="text-[10px] uppercase font-semibold text-[#999] flex items-center gap-1 mb-1.5"><Icon size={11}/>{title}</div>
      {children}
    </div>
  );
}

/** Read-only order sheet for the rider history. */
export default function OrderReadOnly({ orderId, onClose }) {
  const [o, setO] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { api.get(`/riders/me/orders/${orderId}`).then(r => setO(r.data)).catch(e => setErr(e?.response?.data?.detail || "Commande indisponible")); }, [orderId]);
  const c = o?.customer || {};
  const addr = [o?.delivery_address, c.address, c.quartier, o?.delivery_zone].filter(Boolean)
    .filter((p, i, arr) => !arr.slice(0, i).some(q => q.toLowerCase().includes(p.toLowerCase())));
  return (
    <div className="fixed inset-0 bg-black/60 z-[90] grid place-items-end" onClick={onClose} data-testid="hist-order-sheet">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-t-2xl w-full max-h-[90vh] overflow-y-auto p-4 pb-8 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-serif text-xl" data-testid="hist-order-code">{o?.code || "…"}</div>
            <div className="text-[11px] text-[#999] flex items-center gap-1"><Lock size={10}/>Lecture seule</div>
          </div>
          <div className="flex items-center gap-2">
            {o && <span className="dina-chip text-[10px]" style={{ color: statusColor[o.status] }} data-testid="hist-order-status">{statusLabel[o.status] || o.status}</span>}
            <button onClick={onClose} data-testid="hist-order-close"><X size={18}/></button>
          </div>
        </div>
        {err && <div className="text-sm text-[#c62828]">{err}</div>}
        {o && <>
          <Section icon={User} title="Cliente">
            <div className="text-sm font-medium">{c.name || "—"}</div>
            {c.phone_masked && <div className="text-xs text-[#666] tabular">{c.phone_masked}</div>}
          </Section>
          <Section icon={MapPin} title="Adresse">
            <div className="text-sm">{addr.join(" · ") || "—"}</div>
            {c.landmark && <div className="text-xs text-[#666]">Repère : {c.landmark}</div>}
            {o.delivery_slot?.label && <div className="text-xs text-[#666]">Créneau : {o.delivery_slot.label}</div>}
          </Section>
          <Section icon={Package} title={`Articles (${(o.items || []).length})`}>
            <div className="space-y-1.5" data-testid="hist-order-items">
              {(o.items || []).map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded bg-[#fff5f5] overflow-hidden shrink-0">{it.image && <img src={it.image} alt="" className="w-full h-full object-cover"/>}</div>
                  <div className="flex-1 min-w-0"><div className="text-sm break-words">{it.qty}× {it.name}</div><div className="text-[11px] text-[#666]">{[it.size, it.color].filter(Boolean).join(" · ")}</div></div>
                  <div className="text-sm tabular">{fcfa((it.qty || 1) * (it.price || 0))}</div>
                </div>
              ))}
            </div>
          </Section>
          <Section icon={Wallet} title="Paiement">
            <div className="text-xs space-y-0.5 tabular">
              <div className="flex justify-between"><span>Sous-total</span><span>{fcfa(o.subtotal || 0)}</span></div>
              <div className="flex justify-between"><span>Livraison</span><span>{fcfa(o.delivery_fee || 0)}</span></div>
              {!!o.discount && <div className="flex justify-between"><span>Remise</span><span>−{fcfa(o.discount)}</span></div>}
              <div className="flex justify-between font-semibold text-sm pt-1"><span>Total</span><span data-testid="hist-order-total">{fcfa(o.total || 0)}</span></div>
              <div className="text-[#666] pt-1">{PAY[o.payment_method] || o.payment_method}{o.payment_status === "paid" ? " · payé" : ""}</div>
              {o.proof?.amount_collected != null && <div className="text-[#1f8a4c]">Encaissé : {fcfa(o.proof.amount_collected)}</div>}
              {o.proof?.method && <div className="text-[#666]">Preuve : {o.proof.method === "code" ? "code client" : o.proof.method}{o.proof.at ? ` · ${dateTimeFmt(o.proof.at)}` : ""}</div>}
            </div>
            {o.proof?.photo && <img src={o.proof.photo} alt="Preuve" className="mt-2 rounded-lg max-h-48"/>}
          </Section>
          {o.note && <Section icon={Package} title="Instructions"><div className="text-sm">{o.note}</div></Section>}
          <Section icon={Clock} title="Suivi">
            <div className="space-y-1" data-testid="hist-order-timeline">
              {(o.timeline || []).map((t, i) => (
                <div key={i} className="text-xs flex gap-2">
                  <span className="text-[#999] tabular shrink-0">{dateTimeFmt(t.at)}</span>
                  <span><b style={{ color: statusColor[t.status] }}>{statusLabel[t.status] || t.status}</b>{t.by ? ` · ${t.by}` : ""}{t.reason ? <span className="italic text-[#c62828]"> « {t.reason} »</span> : null}</span>
                </div>
              ))}
            </div>
          </Section>
        </>}
      </div>
    </div>
  );
}
