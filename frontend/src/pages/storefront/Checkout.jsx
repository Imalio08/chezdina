import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

const ZONES = {"Cocody":1500,"Riviera":2000,"Angré":2000,"Plateau":1000,"Marcory":1500,"Zone 4":1500,"Treichville":1500,"Koumassi":2000,"Yopougon":2500,"Abobo":3000,"Adjamé":1500,"Port-Bouët":2500,"Bingerville":3000,"Songon":3500,"Grand-Bassam":5000};

export default function Checkout() {
  const { cart, updateCartQty, removeFromCart, clearCart } = useApp();
  const [name,setName] = useState(""); const [phone,setPhone] = useState("");
  const [zone,setZone] = useState("Cocody"); const [addr,setAddr] = useState(""); const [method,setMethod] = useState("cod");
  const nav = useNavigate();
  const sub = cart.reduce((s,x)=>s+x.qty*x.price,0); const fee = ZONES[zone]||0; const total = sub+fee;
  const checkout = async () => {
    if (!cart.length) return toast.error("Panier vide");
    if (!name||!phone) return toast.error("Nom et téléphone requis");
    try {
      const { data } = await api.post("/public/orders", {
        items: cart.map(x=>({product_id:x.product_id,name:x.name,size:x.size,color:x.color,qty:x.qty,price:x.price,image:x.image})),
        customer: { name, phone, address: addr }, channel: "boutique", payment_method: method,
        delivery_zone: zone, delivery_fee: fee, mode: "delivery",
      });
      clearCart(); toast.success("Commande confirmée !"); nav(`/suivi/${data.code}`);
    } catch { toast.error("Erreur commande"); }
  };
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 grid md:grid-cols-[1fr_380px] gap-8">
      <div>
        <h1 className="font-serif text-3xl mb-5">Panier & Livraison</h1>
        {cart.length===0 ? <div className="text-sm text-[#666] py-10 text-center dina-card">Votre panier est vide.</div> : (
          <div className="space-y-3 mb-6">{cart.map(it=>(
            <div key={it.key} className="flex items-center gap-3 border-b border-[#ececec] pb-3">
              <div className="w-16 h-16 bg-[#f5f5f5] rounded-lg overflow-hidden"><img src={it.image} alt="" className="w-full h-full object-cover"/></div>
              <div className="flex-1 min-w-0"><div className="font-medium truncate">{it.name}</div><div className="text-xs text-[#666]">{[it.size,it.color].filter(Boolean).join(" · ")}</div><div className="tabular text-sm font-semibold mt-1">{fcfa(it.price)}</div></div>
              <input type="number" min="1" className="dina-input w-16 text-center tabular" value={it.qty} onChange={e=>updateCartQty(it.key,+e.target.value)}/>
              <button onClick={()=>removeFromCart(it.key)} className="text-[#c62828]"><Trash2 size={16}/></button>
            </div>
          ))}</div>
        )}
        <div className="dina-card p-5 space-y-3">
          <div className="font-semibold">Informations de livraison</div>
          <input className="dina-input" placeholder="Nom complet" value={name} onChange={e=>setName(e.target.value)} data-testid="checkout-name"/>
          <input className="dina-input" placeholder="+225 XX XX XX XX XX" value={phone} onChange={e=>setPhone(e.target.value)} data-testid="checkout-phone"/>
          <select className="dina-input" value={zone} onChange={e=>setZone(e.target.value)} data-testid="checkout-zone">{Object.keys(ZONES).map(z=><option key={z}>{z}</option>)}</select>
          <textarea className="dina-input" placeholder="Adresse ou point de repère" value={addr} onChange={e=>setAddr(e.target.value)} data-testid="checkout-address"/>
          <div className="font-semibold pt-2">Paiement</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={()=>setMethod("cod")} className={`py-3 text-sm rounded-lg border ${method==="cod"?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec]"}`} data-testid="checkout-cod">Paiement à la livraison</button>
            <button onClick={()=>setMethod("wave")} className={`py-3 text-sm rounded-lg border ${method==="wave"?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec]"}`} data-testid="checkout-wave">Wave</button>
          </div>
        </div>
      </div>
      <aside className="dina-card p-5 h-fit sticky top-24">
        <div className="font-semibold mb-3">Résumé</div>
        <div className="text-sm space-y-1"><div className="flex justify-between"><span className="text-[#666]">Sous-total</span><span className="tabular">{fcfa(sub)}</span></div><div className="flex justify-between"><span className="text-[#666]">Livraison · {zone}</span><span className="tabular">{fcfa(fee)}</span></div><div className="flex justify-between font-semibold text-base pt-2 border-t border-[#ececec]"><span>Total</span><span className="tabular">{fcfa(total)}</span></div></div>
        <button onClick={checkout} disabled={!cart.length} className="dina-btn-primary w-full mt-4" data-testid="checkout-submit">Confirmer la commande</button>
      </aside>
    </div>
  );
}
