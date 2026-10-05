import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa, dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";
import { Bell, MessageCircle, ShoppingBag, Phone } from "lucide-react";

export default function AlertsAndCarts() {
  const [tab, setTab] = useState("stock");
  const [alerts, setAlerts] = useState([]);
  const [carts, setCarts] = useState([]);
  const load = async () => {
    try { const [a, c] = await Promise.all([api.get("/stock-alerts"), api.get("/abandoned-carts")]); setAlerts(a.data); setCarts(c.data); }
    catch { toast.error("Erreur"); }
  };
  useEffect(() => { load(); }, []);

  const notify = async (a) => {
    await api.patch(`/stock-alerts/${a.id}/notify`);
    const url = `https://wa.me/${a.phone.replace(/\D/g,"")}?text=${encodeURIComponent(`Bonjour ! Le produit que vous attendiez est de nouveau en stock Chez Dina. Commandez vite sur dinaboutique.ci`)}`;
    window.open(url, "_blank");
    toast.success("Message WhatsApp préparé");
    load();
  };
  const relance = (c) => {
    const url = `https://wa.me/${(c.customer_phone||"").replace(/\D/g,"")}?text=${encodeURIComponent(`Bonjour ${c.customer_name}, vous avez laissé des articles dans votre panier Chez Dina (${fcfa(c.value)}). Finalisez votre commande avec -10% : code RETOUR10`)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-5">
      <div><h1 className="font-serif text-3xl">Alertes & paniers</h1><p className="text-sm text-[#666]">Retour en stock et relance paniers abandonnés par WhatsApp</p></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Alertes stock</div><div className="font-serif text-2xl tabular">{alerts.filter(a=>!a.notified).length}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Déjà notifiées</div><div className="font-serif text-2xl tabular text-[#1f8a4c]">{alerts.filter(a=>a.notified).length}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Paniers abandonnés</div><div className="font-serif text-2xl tabular">{carts.length}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Valeur paniers</div><div className="font-serif text-2xl tabular text-[#b02a2a]">{fcfa(carts.reduce((s,x)=>s+(x.value||0),0))}</div></div>
      </div>

      <div className="flex gap-1 bg-[#f5f5f5] p-1 rounded-lg w-fit">
        <button onClick={()=>setTab("stock")} className={`px-4 py-1.5 text-sm rounded-md ${tab==="stock"?"bg-white shadow-sm font-semibold":""}`} data-testid="alerts-tab-stock">Retour en stock</button>
        <button onClick={()=>setTab("cart")} className={`px-4 py-1.5 text-sm rounded-md ${tab==="cart"?"bg-white shadow-sm font-semibold":""}`} data-testid="alerts-tab-cart">Paniers abandonnés</button>
      </div>

      {tab==="stock" ? (
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Clientes en attente de retour en stock</div>
          {alerts.length===0 ? <div className="text-center text-sm text-[#666] py-8">Aucune alerte en attente.</div> :
            <div className="space-y-2">{alerts.map(a=>(
              <div key={a.id} className="flex items-center justify-between p-3 border border-[#ececec] rounded-lg" data-testid={`alert-${a.id}`}>
                <div><div className="font-medium text-sm flex items-center gap-2"><Phone size={11}/>{a.phone}</div><div className="text-xs text-[#666]">Produit {a.product_id?.slice(0,8)}… {a.size && `· Taille ${a.size}`} · {dateTimeFmt(a.created_at)}</div></div>
                {a.notified ? <span className="dina-chip" style={{color:"#1f8a4c"}}>Notifiée</span> : <button onClick={()=>notify(a)} className="dina-btn-primary !min-h-[36px] text-xs" data-testid={`notify-${a.id}`}><MessageCircle size={12}/>Notifier WhatsApp</button>}
              </div>
            ))}</div>
          }
        </div>
      ) : (
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Paniers abandonnés (non récupérés)</div>
          {carts.length===0 ? <div className="text-center text-sm text-[#666] py-8">Aucun panier abandonné.</div> :
            <div className="space-y-2">{carts.map(c=>(
              <div key={c.id} className="flex items-center justify-between p-3 border border-[#ececec] rounded-lg" data-testid={`cart-${c.id}`}>
                <div><div className="font-medium text-sm">{c.customer_name}</div><div className="text-xs text-[#666]">{c.customer_phone} · {c.items?.map(i=>i.name).join(", ")} · {dateTimeFmt(c.created_at)}</div></div>
                <div className="flex items-center gap-3"><div className="tabular font-semibold">{fcfa(c.value)}</div><button onClick={()=>relance(c)} className="dina-btn-primary !min-h-[36px] text-xs" data-testid={`relance-${c.id}`}><MessageCircle size={12}/>Relancer -10%</button></div>
              </div>
            ))}</div>
          }
        </div>
      )}
    </div>
  );
}
