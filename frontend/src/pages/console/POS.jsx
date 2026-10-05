import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";
import { Search, Trash2, Plus, Minus, UserPlus, Printer, CreditCard, Smartphone, Wallet, X, Store, Truck, Home as HomeIcon, Share2, MessageCircle } from "lucide-react";

const ZONES_DEFAULT = {"Cocody":1500,"Riviera":2000,"Angré":2000,"Plateau":1000,"Marcory":1500,"Zone 4":1500,"Treichville":1500,"Koumassi":2000,"Yopougon":2500,"Abobo":3000,"Adjamé":1500,"Port-Bouët":2500,"Bingerville":3000,"Songon":3500,"Grand-Bassam":5000};

export default function POS() {
  const { cart, addToCart, updateCartQty, removeFromCart, clearCart } = useApp();
  const [products, setProducts] = useState([]);
  const [zones, setZones] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Tous");
  const [customer, setCustomer] = useState(null);
  const [custQ, setCustQ] = useState("");
  const [custResults, setCustResults] = useState([]);
  const [showNewCust, setShowNewCust] = useState(false);
  const [mode, setMode] = useState("store");
  const [zone, setZone] = useState("Cocody");
  const [address, setAddress] = useState("");
  const [discount, setDiscount] = useState(0);
  const [method, setMethod] = useState("cash");
  const [cash, setCash] = useState(0);
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    api.get("/products").then(r=>setProducts(r.data)).catch(()=>{});
    api.get("/zones").then(r=>setZones(r.data)).catch(()=>setZones(Object.entries(ZONES_DEFAULT).map(([name,fee])=>({name,fee}))));
  }, []);

  const cats = useMemo(()=>["Tous", ...Array.from(new Set(products.map(p=>p.category)))], [products]);
  const filtered = useMemo(()=>products.filter(p => (cat==="Tous"||p.category===cat) && (!q||p.name.toLowerCase().includes(q.toLowerCase())||p.sku?.includes(q))), [products, q, cat]);

  const subtotal = cart.reduce((s,x)=>s+x.qty*x.price,0);
  const zoneFee = zones.find(z=>z.name===zone)?.fee || 0;
  const fee = mode === "delivery" ? zoneFee : 0;
  const total = Math.max(0, subtotal + fee - Number(discount||0));
  const change = method === "cash" ? Math.max(0, Number(cash||0) - total) : 0;

  const searchCust = async (v) => {
    setCustQ(v);
    if (v.length<2) { setCustResults([]); return; }
    const r = await api.get(`/customers?q=${encodeURIComponent(v)}`);
    setCustResults(r.data.slice(0,6));
  };

  const pay = async () => {
    if (!cart.length) return toast.error("Panier vide");
    if (mode==="delivery" && (!customer || !address)) return toast.error("Client et adresse requis pour livraison");
    try {
      const { data } = await api.post("/orders", {
        items: cart.map(x=>({product_id:x.product_id,name:x.name,size:x.size,color:x.color,qty:x.qty,price:x.price,image:x.image})),
        customer, channel: "store", payment_method: method, mode, discount: Number(discount||0),
        delivery_zone: mode==="delivery" ? zone : null, delivery_fee: fee, note: address,
      });
      setReceipt(data); clearCart(); setDiscount(0); setCash(0);
      if (mode==="store") setCustomer(null);
      toast.success(`Vente ${data.code} enregistrée`);
    } catch { toast.error("Erreur lors du paiement"); }
  };

  const shareCart = () => {
    const link = `${window.location.origin}/boutique`;
    const text = `Bonjour${customer?" "+customer.name:""}, voici votre sélection Chez Dina:\n${cart.map(x=>`• ${x.qty}× ${x.name}`).join("\n")}\nTotal: ${fcfa(total)}\nFinalisez: ${link}`;
    const phone = customer?.phone?.replace(/\D/g,"") || "";
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="grid lg:grid-cols-[1fr_420px] gap-4 h-[calc(100vh-7rem)]">
      <div className="dina-card-white p-4 flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]"/><input className="dina-input pl-9" placeholder="Rechercher ou scanner un code-barres…" value={q} onChange={e=>setQ(e.target.value)} data-testid="pos-search"/></div>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-2 mb-3">
          {cats.map(c=><button key={c} onClick={()=>setCat(c)} className={`px-3 py-1.5 text-xs rounded-full border whitespace-nowrap ${cat===c?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec] text-[#666]"}`} data-testid={`pos-cat-${c}`}>{c}</button>)}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto scrollbar-thin flex-1 pr-1">
          {filtered.map(p=>(
            <button key={p.id} onClick={()=>addToCart(p,1,p.sizes?.[0],p.colors?.[0])} disabled={p.stock===0} className="text-left bg-white border border-[#ececec] rounded-xl overflow-hidden hover:border-[#b02a2a] hover:shadow-md transition group disabled:opacity-40" data-testid={`pos-product-${p.id}`}>
              <div className="aspect-square bg-[#fff5f5] overflow-hidden relative">
                <img src={p.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition"/>
                {p.stock<5 && p.stock>0 && <span className="absolute top-1.5 left-1.5 bg-[#e4991e] text-white text-[9px] px-1.5 py-0.5 rounded-full font-semibold">{p.stock} rest.</span>}
                {p.stock===0 && <span className="absolute inset-0 bg-black/40 grid place-items-center text-white text-xs font-bold">RUPTURE</span>}
              </div>
              <div className="p-2.5">
                <div className="text-[10px] text-[#b02a2a] uppercase tracking-wide font-semibold">{p.category}</div>
                <div className="text-sm font-medium leading-tight line-clamp-2 min-h-[2.2em]">{p.name}</div>
                <div className="text-[10px] text-[#999] mt-0.5">{p.brand}</div>
                <div className="flex items-center justify-between mt-1.5"><span className="tabular text-sm font-bold text-[#b02a2a]">{fcfa(p.price)}</span><span className="text-[10px] text-[#666] tabular">Stk {p.stock}</span></div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="dina-card-white p-4 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Panier · <span className="text-[#666] text-xs">{cart.length} article{cart.length>1?"s":""}</span></div>
          <div className="flex items-center gap-1">
            {cart.length>0 && customer && <button onClick={shareCart} className="text-xs text-[#1f8a4c] flex items-center gap-1" data-testid="pos-share"><Share2 size={11}/>Partager</button>}
            {cart.length>0 && <button onClick={clearCart} className="text-xs text-[#c62828]" data-testid="pos-clear">Vider</button>}
          </div>
        </div>

        {/* Mode: store/delivery/pickup */}
        <div className="grid grid-cols-3 gap-1 mb-3 bg-[#f5f5f5] rounded-lg p-1">
          <button onClick={()=>setMode("store")} className={`py-1.5 text-xs rounded-md flex items-center justify-center gap-1 ${mode==="store"?"bg-white shadow-sm font-semibold":""}`} data-testid="pos-mode-store"><Store size={12}/>Boutique</button>
          <button onClick={()=>setMode("delivery")} className={`py-1.5 text-xs rounded-md flex items-center justify-center gap-1 ${mode==="delivery"?"bg-white shadow-sm font-semibold":""}`} data-testid="pos-mode-delivery"><Truck size={12}/>Livraison</button>
          <button onClick={()=>setMode("pickup")} className={`py-1.5 text-xs rounded-md flex items-center justify-center gap-1 ${mode==="pickup"?"bg-white shadow-sm font-semibold":""}`} data-testid="pos-mode-pickup"><HomeIcon size={12}/>Retrait</button>
        </div>

        <div className="mb-3">
          {customer ? (
            <div className="flex items-center justify-between p-2 bg-[#fff5f5] border border-[#fde8e8] rounded-lg text-sm">
              <div><div className="font-medium">{customer.name}</div><div className="text-xs text-[#666]">{customer.phone} · {customer.loyalty_points||0} pts</div></div>
              <button onClick={()=>setCustomer(null)}><X size={14}/></button>
            </div>
          ) : (
            <div className="relative">
              <input className="dina-input" placeholder="Rattacher une cliente (nom ou tél)…" value={custQ} onChange={e=>searchCust(e.target.value)} data-testid="pos-customer-search"/>
              {custResults.length>0 && <div className="absolute z-10 bg-white border border-[#ececec] rounded-lg mt-1 w-full max-h-56 overflow-y-auto shadow">{custResults.map(c=><button key={c.id} onClick={()=>{setCustomer(c);setCustQ("");setCustResults([]);}} className="w-full text-left px-3 py-2 text-sm hover:bg-[#fff5f5]"><div className="font-medium">{c.name}</div><div className="text-xs text-[#666]">{c.phone}</div></button>)}</div>}
              <button onClick={()=>setShowNewCust(true)} className="mt-1 text-xs text-[#b02a2a] flex items-center gap-1" data-testid="pos-new-customer"><UserPlus size={12}/>Nouvelle cliente</button>
            </div>
          )}
        </div>

        {mode==="delivery" && (
          <div className="space-y-2 mb-3 p-3 bg-[#fff5f5] rounded-lg">
            <select className="dina-input" value={zone} onChange={e=>setZone(e.target.value)} data-testid="pos-zone">
              {zones.map(z=><option key={z.name} value={z.name}>{z.name} — {fcfa(z.fee)}</option>)}
            </select>
            <input className="dina-input" placeholder="Adresse de livraison" value={address} onChange={e=>setAddress(e.target.value)} data-testid="pos-address"/>
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-thin -mx-2 px-2">
          {cart.length===0 ? <div className="text-center text-sm text-[#666] py-10">Aucun article</div> :
            cart.map(it=>(
              <div key={it.key} className="flex items-center gap-2 py-2 border-b border-[#f0f0f0]">
                <div className="w-11 h-11 rounded bg-[#fff5f5] overflow-hidden shrink-0"><img src={it.image} alt="" className="w-full h-full object-cover"/></div>
                <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{it.name}</div><div className="text-xs text-[#666] truncate">{[it.size,it.color].filter(Boolean).join(" · ")} · {fcfa(it.price)}</div></div>
                <div className="flex items-center gap-1"><button onClick={()=>updateCartQty(it.key,it.qty-1)} className="w-6 h-6 border rounded"><Minus size={10} className="mx-auto"/></button><span className="w-6 text-center tabular text-sm">{it.qty}</span><button onClick={()=>updateCartQty(it.key,it.qty+1)} className="w-6 h-6 border rounded"><Plus size={10} className="mx-auto"/></button></div>
                <button onClick={()=>removeFromCart(it.key)} className="text-[#c62828]"><Trash2 size={14}/></button>
              </div>
            ))}
        </div>

        <div className="border-t border-[#ececec] pt-3 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-[#666]">Sous-total</span><span className="tabular">{fcfa(subtotal)}</span></div>
          {mode==="delivery" && <div className="flex justify-between"><span className="text-[#666]">Livraison · {zone}</span><span className="tabular">{fcfa(fee)}</span></div>}
          <div className="flex justify-between items-center"><span className="text-[#666]">Remise</span><input type="number" className="dina-input w-24 text-right tabular !py-1" value={discount} onChange={e=>setDiscount(e.target.value)} data-testid="pos-discount"/></div>
          <div className="flex justify-between font-semibold text-base"><span>Total</span><span className="tabular text-[#b02a2a]">{fcfa(total)}</span></div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <button onClick={()=>setMethod("cash")} className={`py-2 text-xs rounded-lg border ${method==="cash"?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec]"}`} data-testid="pay-cash"><Wallet size={14} className="inline mr-1"/>Espèces</button>
          <button onClick={()=>setMethod("wave")} className={`py-2 text-xs rounded-lg border ${method==="wave"?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec]"}`} data-testid="pay-wave"><Smartphone size={14} className="inline mr-1"/>Wave</button>
          <button onClick={()=>setMethod("cod")} className={`py-2 text-xs rounded-lg border ${method==="cod"?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec]"}`} data-testid="pay-cod"><CreditCard size={14} className="inline mr-1"/>À livrer</button>
        </div>
        {method==="cash" && <div className="mt-2 flex items-center gap-2 text-sm"><span className="text-[#666] w-20">Reçu</span><input type="number" className="dina-input tabular" value={cash} onChange={e=>setCash(e.target.value)} data-testid="pos-cash"/><span className="text-[#1f8a4c] tabular whitespace-nowrap">Rendu: {fcfa(change)}</span></div>}
        <button onClick={pay} disabled={!cart.length} className="dina-btn-primary w-full mt-3" data-testid="pos-checkout">{mode==="delivery"?"Commander · ":"Encaisser · "}{fcfa(total)}</button>
      </div>

      {showNewCust && <NewCustomerModal onClose={()=>setShowNewCust(false)} onCreated={(c)=>{setCustomer(c);setShowNewCust(false);}}/>}
      {receipt && <Receipt data={receipt} onClose={()=>setReceipt(null)}/>}
    </div>
  );
}

function NewCustomerModal({ onClose, onCreated }) {
  const [f, setF] = useState({ name:"", phone:"+225 ", email:"", address:"", shoe_size:"", clothing_size:"", notes:"" });
  const [loading, setLoading] = useState(false);
  const save = async () => {
    if (!f.name || !f.phone) return toast.error("Nom et téléphone requis");
    setLoading(true);
    try { const { data } = await api.post("/customers", f); toast.success("Cliente créée"); onCreated(data); }
    catch { toast.error("Erreur"); } finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="font-serif text-xl mb-4">Nouvelle cliente</div>
        <div className="space-y-2.5 text-sm">
          <input className="dina-input" placeholder="Nom complet *" value={f.name} onChange={e=>setF({...f,name:e.target.value})} data-testid="newcust-name"/>
          <input className="dina-input" placeholder="Téléphone *" value={f.phone} onChange={e=>setF({...f,phone:e.target.value})} data-testid="newcust-phone"/>
          <input className="dina-input" placeholder="Email (optionnel)" value={f.email} onChange={e=>setF({...f,email:e.target.value})} data-testid="newcust-email"/>
          <input className="dina-input" placeholder="Adresse" value={f.address} onChange={e=>setF({...f,address:e.target.value})} data-testid="newcust-address"/>
          <div className="grid grid-cols-2 gap-2">
            <input className="dina-input" placeholder="Pointure" value={f.shoe_size} onChange={e=>setF({...f,shoe_size:e.target.value})}/>
            <input className="dina-input" placeholder="Taille" value={f.clothing_size} onChange={e=>setF({...f,clothing_size:e.target.value})}/>
          </div>
          <textarea className="dina-input" placeholder="Notes (préférences, anniversaire…)" rows={2} value={f.notes} onChange={e=>setF({...f,notes:e.target.value})}/>
        </div>
        <div className="flex gap-2 mt-4"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={save} disabled={loading} className="dina-btn-primary flex-1" data-testid="newcust-save">{loading?"…":"Créer"}</button></div>
      </div>
    </div>
  );
}

function Receipt({ data, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-80 font-sora" onClick={e=>e.stopPropagation()}>
        <div className="text-center mb-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#fde8e8] grid place-items-center font-serif text-[#b02a2a] font-bold">CD</div>
          <div className="font-serif text-lg mt-2">Chez Dina Boutique</div>
          <div className="text-[10px] text-[#666]">Cocody Angré 7e · +225 07 77 92 61 79</div>
          <div className="text-[10px] text-[#666]">TikTok @dinoush04</div>
        </div>
        <div className="border-t-2 border-dashed border-[#ececec] my-2"/>
        <div className="text-xs text-center text-[#666]">Reçu N° {data.code}</div>
        <div className="text-xs text-center text-[#666]">{new Date(data.created_at).toLocaleString("fr-FR")}</div>
        <div className="border-t border-dashed my-2"/>
        {data.items.map((it,i)=><div key={i} className="text-xs flex justify-between py-0.5"><span className="flex-1 pr-2">{it.qty}× {it.name}{it.size?` (${it.size})`:""}</span><span className="tabular font-medium">{fcfa(it.qty*it.price)}</span></div>)}
        <div className="border-t border-dashed my-2"/>
        <div className="text-xs flex justify-between"><span className="text-[#666]">Sous-total</span><span className="tabular">{fcfa(data.subtotal)}</span></div>
        {data.delivery_fee>0 && <div className="text-xs flex justify-between"><span className="text-[#666]">Livraison</span><span className="tabular">{fcfa(data.delivery_fee)}</span></div>}
        {data.discount>0 && <div className="text-xs flex justify-between"><span className="text-[#666]">Remise</span><span className="tabular text-[#1f8a4c]">-{fcfa(data.discount)}</span></div>}
        <div className="flex justify-between font-bold text-sm mt-1 pt-1 border-t"><span>TOTAL</span><span className="tabular text-[#b02a2a]">{fcfa(data.total)}</span></div>
        <div className="text-[10px] text-center text-[#666] mt-3">Paiement : {data.payment_method.toUpperCase()}</div>
        {data.customer && <div className="text-[10px] text-center text-[#666] mt-1">Cliente : {data.customer.name}</div>}
        <div className="text-center mt-4 text-xs text-[#b02a2a] font-serif italic">Merci de votre visite 💕</div>
        <div className="text-[9px] text-center text-[#999] mt-1">Retrouvez-nous sur TikTok @dinoush04</div>
        <div className="flex gap-2 mt-4"><button onClick={()=>window.print()} className="dina-btn-secondary flex-1 !min-h-[36px]"><Printer size={14}/>Imprimer</button><button onClick={onClose} className="dina-btn-primary flex-1 !min-h-[36px]">OK</button></div>
      </div>
    </div>
  );
}
