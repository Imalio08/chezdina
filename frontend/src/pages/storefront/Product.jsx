import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";
import { MessageCircle, ShoppingBag } from "lucide-react";

export default function ProductPage() {
  const { id } = useParams(); const nav = useNavigate();
  const [p, setP] = useState(null); const [size, setSize] = useState(""); const [color, setColor] = useState("");
  const { addToCart } = useApp();
  useEffect(()=>{api.get(`/public/product/${id}`).then(r=>{setP(r.data);setSize(r.data.sizes?.[0]||"");setColor(r.data.colors?.[0]||"");});},[id]);
  if (!p) return <div className="p-10 text-sm text-[#666]">Chargement…</div>;
  const add = () => {addToCart(p,1,size,color);toast.success("Ajouté au panier");};
  const wa = () => window.open(`https://wa.me/2250700000000?text=${encodeURIComponent(`Bonjour, je veux commander: ${p.name} (${size}, ${color}) ${fcfa(p.price)}`)}`,"_blank");
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 grid md:grid-cols-2 gap-10">
      <div className="aspect-[4/5] bg-[#f5f5f5] rounded-2xl overflow-hidden"><img src={p.image} alt="" className="w-full h-full object-cover"/></div>
      <div>
        <div className="text-xs text-[#666] uppercase tracking-wide">{p.brand} · {p.category}</div>
        <h1 className="font-serif text-3xl mt-1">{p.name}</h1>
        <div className="tabular text-2xl font-semibold mt-3">{fcfa(p.price)}</div>
        <p className="text-sm text-[#666] mt-4 leading-relaxed">{p.description}</p>
        {!!p.sizes?.length && <div className="mt-6"><div className="text-xs uppercase text-[#666] mb-2">Taille</div><div className="flex gap-2 flex-wrap">{p.sizes.map(s=><button key={s} onClick={()=>setSize(s)} className={`w-11 h-11 rounded-lg border text-sm ${size===s?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec]"}`} data-testid={`product-size-${s}`}>{s}</button>)}</div></div>}
        {!!p.colors?.length && <div className="mt-5"><div className="text-xs uppercase text-[#666] mb-2">Couleur</div><div className="flex gap-2 flex-wrap">{p.colors.map(c=><button key={c} onClick={()=>setColor(c)} className={`px-3 h-9 rounded-lg border text-xs ${color===c?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec]"}`} data-testid={`product-color-${c}`}>{c}</button>)}</div></div>}
        <div className="text-xs text-[#666] mt-5">{p.stock>0 ? `En stock · ${p.stock} disponible${p.stock>1?"s":""}` : "Rupture de stock"}</div>
        <div className="flex gap-3 mt-6">
          <button onClick={add} className="dina-btn-primary flex-1" data-testid="product-add-cart"><ShoppingBag size={16}/>Ajouter</button>
          <button onClick={wa} className="dina-btn-secondary flex-1" style={{background:"#1f8a4c",color:"white",borderColor:"#1f8a4c"}} data-testid="product-whatsapp"><MessageCircle size={16}/>WhatsApp</button>
        </div>
      </div>
    </div>
  );
}
