import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useCustomer } from "@/context/CustomerContext";
import { fcfa, statusLabel, statusColor } from "@/lib/format";
import { toast } from "sonner";
import { reveal } from "@/lib/reveal";
import { Package, Search, Loader2 } from "lucide-react";

export default function Suivi() {
  const { customer } = useCustomer();
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [myOrders, setMyOrders] = useState([]);

  useEffect(() => {
    if (customer) api.get("/public/account/orders-split").then(r => { const d = r.data || {}; setMyOrders([...(d.in_progress || []), ...(d.delivered || []), ...(d.cancelled || [])].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))); }).catch(() => {});
  }, [customer]);

  const track = async (c = code, ph = phone) => {
    if (!c.trim()) { reveal('[data-testid="track-code"]'); return toast.error("Code commande requis"); }
    setBusy(true); setRes(null);
    try {
      const r = await api.get(`/public/orders/track?code=${encodeURIComponent(c.trim())}&phone=${encodeURIComponent(ph.trim())}`);
      setRes(r.data); reveal('[data-testid="track-result"]', { block: "start" });
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Introuvable");
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8" data-testid="page-suivi">
      <h1 className="font-serif text-3xl mb-2">Suivi de commande</h1>
      <p className="text-sm text-[#666] mb-6">Entrez votre numéro de commande et votre téléphone pour voir l'état en temps réel.</p>

      {customer && myOrders.length > 0 && (
        <section className="mb-8">
          <h2 className="font-serif text-xl mb-3">Mes commandes récentes</h2>
          <div className="space-y-2">
            {myOrders.slice(0, 10).map(o => (
              <button key={o.id} onClick={() => { setCode(o.code); setPhone(customer.phone || ""); track(o.code, customer.phone || ""); }} className="w-full flex items-center justify-between p-3 dina-card hover:border-[#b02a2a] text-left" data-testid={`my-order-${o.code}`}>
                <div><div className="font-semibold">{o.code}</div><div className="text-xs text-[#666]">{new Date(o.created_at).toLocaleDateString("fr-FR")}</div></div>
                <div className="text-right"><div className="tabular font-semibold">{fcfa(o.total)}</div><span className="dina-chip text-[10px]" style={{ color: statusColor[o.status], borderColor: statusColor[o.status] }}>{statusLabel[o.status] || o.status}</span></div>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="dina-card p-5 space-y-3">
        <input className="dina-input" placeholder="Code commande (ex: CD-2026-0458)" value={code} onChange={e => setCode(e.target.value.toUpperCase())} data-testid="track-code"/>
        <input className="dina-input" placeholder="Téléphone (facultatif pour affiner la recherche)" value={phone} onChange={e => setPhone(e.target.value)} data-testid="track-phone"/>
        <button onClick={() => track()} disabled={busy} className="dina-btn-primary w-full" data-testid="track-submit">{busy ? <Loader2 size={14} className="animate-spin"/> : <Search size={14}/>}{busy ? "Recherche…" : "Suivre ma commande"}</button>
      </div>

      {res && (
        <div className="dina-card p-5 mt-5 scroll-mt-24" data-testid="track-result">
          <div className="flex items-center justify-between mb-3">
            <div><div className="font-serif text-xl">{res.code}</div><div className="text-xs text-[#666]">{res.customer_name} · {res.items_count} article(s)</div></div>
            <span className="dina-chip" style={{ color: statusColor[res.status], borderColor: statusColor[res.status] }}>{statusLabel[res.status] || res.status}</span>
          </div>
          {res.deposit_required > 0 && (
            <div className="bg-[#fff5f5] rounded-lg p-3 mb-3 text-sm">
              <div className="flex justify-between"><span className="text-[#666]">Acompte requis</span><span className="tabular font-semibold">{fcfa(res.deposit_required)}</span></div>
              <div className="flex justify-between"><span className="text-[#666]">Acompte payé</span><span className={`tabular font-semibold ${res.deposit_paid >= res.deposit_required ? "text-[#1f8a4c]" : "text-[#c62828]"}`}>{fcfa(res.deposit_paid)}{res.deposit_tx_ref ? ` · ref ${res.deposit_tx_ref}` : ""}</span></div>
              <div className="flex justify-between pt-1 border-t"><span className="font-semibold">À régler à la livraison</span><span className="tabular font-bold">{fcfa((res.total || 0) - (res.deposit_paid || 0))}</span></div>
            </div>
          )}
          <div className="space-y-2">
            {(res.timeline || []).map((t, i) => (
              <div key={i} className="flex gap-2 text-sm"><Package size={12} className="mt-0.5 text-[#b02a2a]"/><div><div className="font-semibold">{statusLabel[t.status] || t.status}</div><div className="text-xs text-[#666]">{new Date(t.at).toLocaleString("fr-FR")} · {t.by}{t.note ? ` — ${t.note}` : ""}</div></div></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
