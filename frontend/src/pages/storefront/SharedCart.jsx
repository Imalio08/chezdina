import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { fcfa } from "@/lib/format";
import { toast } from "sonner";
import { Check, X, Minus, Plus, Truck, Clock } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function SharedCart() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [items, setItems] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(null);
  const [brand, setBrand] = useState({ name: "Chez Dina", logo: "" });

  useEffect(() => {
    axios.get(`${API}/public/shared-cart/${id}`).then(r => {
      if (r.data?.error === "expired") { setData({ expired: true }); return; }
      if (r.data?.error === "already_confirmed") { setData({ already: true, code: r.data.order_code }); return; }
      setData(r.data); setItems(r.data.items||[]);
    }).catch(()=>setData({ error: true }));
    axios.get(`${API}/public/site`).then(r => { const s = r.data || {}; setBrand(b => ({ ...b, logo: s.logo || "", name: s.name || b.name })); }).catch(() => {});
  }, [id]);

  if (!data) return <div className="min-h-screen grid place-items-center text-sm text-[#666]">Chargement…</div>;
  if (data.error) return <div className="min-h-screen grid place-items-center text-sm text-[#c62828]">Panier introuvable</div>;
  if (data.expired) return <div className="min-h-screen grid place-items-center text-sm text-[#666]">Ce lien a expiré. Contactez la boutique pour recréer votre panier.</div>;
  if (data.already) return <div className="min-h-screen grid place-items-center p-6 text-center"><div><Check size={48} className="text-[#1f8a4c] mx-auto mb-3"/><div className="font-serif text-2xl mb-2">Déjà confirmé</div><div className="text-sm text-[#666]">Commande N° <b>{data.code}</b></div></div></div>;

  const subtotal = items.reduce((s,x)=>s+x.qty*x.price,0);
  const total = subtotal + (data.delivery_fee||0) - (data.discount||0);

  const upd = (i, qty) => setItems(items.map((it,idx) => idx===i ? {...it, qty: Math.max(1, qty)} : it));
  const rm = (i) => setItems(items.filter((_,idx)=>idx!==i));

  const confirm = async () => {
    if (!items.length) return toast.error("Panier vide");
    setConfirming(true);
    try {
      const { data: r } = await axios.post(`${API}/public/shared-cart/${id}/confirm`, { items, payment_method: paymentMethod });
      setConfirmed(r);
      toast.success(`Commande ${r.code} confirmée !`);
    } catch(e) { toast.error(e?.response?.data?.detail || "Erreur"); } finally { setConfirming(false); }
  };

  if (confirmed) return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="bg-white rounded-2xl p-8 max-w-sm text-center shadow-lg">
        <div className="w-16 h-16 rounded-full bg-[#f0f9f4] text-[#1f8a4c] grid place-items-center mx-auto mb-3"><Check size={32}/></div>
        <div className="font-serif text-2xl mb-1">Merci {data.customer?.name?.split(" ")[0] || ""} !</div>
        <div className="text-sm text-[#666] mb-4">Votre commande <b>{confirmed.code}</b> est enregistrée.</div>
        <button onClick={()=>nav(`/suivi/${confirmed.code}`)} className="dina-btn-primary w-full" data-testid="sc-track">Suivre la commande</button>
      </div>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <div className="text-center mb-5">
        {brand.logo ? <img src={brand.logo} alt="" className="w-12 h-12 mx-auto rounded-full object-cover bg-[#fde8e8]"/> : <div className="w-12 h-12 mx-auto rounded-full bg-[#fde8e8] grid place-items-center font-serif text-[#b02a2a] font-bold">{(brand.name || "CD").split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase() || "CD"}</div>}
        <div className="font-serif text-2xl mt-2">Votre panier {brand.name}</div>
        {data.customer?.name && <div className="text-sm text-[#666]">Bonjour {data.customer.name.split(" ")[0]} · préparé par {data.created_by_name}</div>}
      </div>

      <div className="bg-white border border-[#ececec] rounded-xl divide-y divide-[#f0f0f0]">
        {items.map((it, i) => (
          <div key={i} className="p-3 flex items-center gap-3">
            <div className="w-14 h-14 rounded bg-[#fff5f5] overflow-hidden shrink-0">{it.image && <img src={it.image} alt="" className="w-full h-full object-cover"/>}</div>
            <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{it.name}</div><div className="text-xs text-[#666]">{[it.size, it.color].filter(Boolean).join(" · ")} · {fcfa(it.price)}</div></div>
            <div className="flex items-center gap-1"><button onClick={()=>upd(i,it.qty-1)} className="w-7 h-7 border rounded"><Minus size={10} className="mx-auto"/></button><span className="w-7 text-center tabular text-sm">{it.qty}</span><button onClick={()=>upd(i,it.qty+1)} className="w-7 h-7 border rounded"><Plus size={10} className="mx-auto"/></button></div>
            <button onClick={()=>rm(i)} className="text-[#c62828]" data-testid={`sc-rm-${i}`}><X size={14}/></button>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#ececec] rounded-xl p-4 mt-4 space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-[#666]">Sous-total</span><span className="tabular">{fcfa(subtotal)}</span></div>
        {data.delivery_fee>0 && <div className="flex justify-between"><span className="text-[#666]"><Truck size={11} className="inline mr-1"/>Livraison · {data.zone}</span><span className="tabular">{fcfa(data.delivery_fee)}</span></div>}
        {data.discount>0 && <div className="flex justify-between text-[#1f8a4c]"><span>Remise</span><span className="tabular">-{fcfa(data.discount)}</span></div>}
        <div className="flex justify-between font-bold text-base pt-2 border-t"><span>Total</span><span className="tabular text-[#b02a2a]">{fcfa(total)}</span></div>
      </div>

      <div className="bg-white border border-[#ececec] rounded-xl p-4 mt-4">
        <div className="text-[10px] uppercase font-semibold text-[#666] mb-2">Mode de paiement</div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={()=>setPaymentMethod("cod")} className={`py-2 text-xs rounded-lg border ${paymentMethod==="cod"?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec]"}`} data-testid="sc-cod">À la livraison</button>
          <button onClick={()=>setPaymentMethod("wave")} className={`py-2 text-xs rounded-lg border ${paymentMethod==="wave"?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec]"}`} data-testid="sc-wave">Wave (lien envoyé)</button>
        </div>
      </div>

      <button onClick={confirm} disabled={confirming||!items.length} className="dina-btn-primary w-full mt-5 !min-h-[48px]" data-testid="sc-confirm"><Check size={16}/>{confirming?"Confirmation…":`Confirmer ma commande · ${fcfa(total)}`}</button>
      <div className="text-[11px] text-center text-[#666] mt-3"><Clock size={10} className="inline mr-1"/>Lien valable jusqu'au {new Date(data.expires_at).toLocaleString("fr-FR")}</div>
    </div>
  );
}
