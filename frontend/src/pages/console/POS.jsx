import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";
import { Search, Trash2, Plus, Minus, UserPlus, Printer, CreditCard, Smartphone, Wallet, X } from "lucide-react";

export default function POS() {
  const { cart, addToCart, updateCartQty, removeFromCart, clearCart } = useApp();
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Tous");
  const [customer, setCustomer] = useState(null);
  const [custQ, setCustQ] = useState("");
  const [custResults, setCustResults] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [method, setMethod] = useState("cash");
  const [cash, setCash] = useState(0);
  const [receipt, setReceipt] = useState(null);

  useEffect(() => { api.get("/products").then(r=>setProducts(r.data)); }, []);
  const cats = useMemo(()=>["Tous", ...Array.from(new Set(products.map(p=>p.category)))], [products]);
  const filtered = useMemo(()=>products.filter(p => (cat==="Tous"||p.category===cat) && (!q||p.name.toLowerCase().includes(q.toLowerCase())||p.sku?.includes(q))), [products, q, cat]);
  const subtotal = cart.reduce((s,x)=>s+x.qty*x.price,0);
  const total = Math.max(0, subtotal - Number(discount||0));
  const change = method === "cash" ? Math.max(0, Number(cash||0) - total) : 0;

  const searchCust = async (v) => { setCustQ(v); if (v.length<2) { setCustResults([]); return; } const r = await api.get(`/customers?q=${encodeURIComponent(v)}`); setCustResults(r.data.slice(0,6)); };
  const createCust = async () => {
    const name = prompt("Nom du client ?"); if (!name) return;
    const phone = prompt("Téléphone ? (+225 XX XX XX XX XX)"); if (!phone) return;
    const { data } = await api.post("/customers", { name, phone });
    setCustomer(data); toast.success("Client créé");
  };

  const pay = async () => {
    if (!cart.length) return toast.error("Panier vide");
    try {
      const { data } = await api.post("/orders", {
        items: cart.map(x=>({ product_id: x.product_id, name: x.name, size: x.size, color: x.color, qty: x.qty, price: x.price, image: x.image })),
        customer, channel: "store", payment_method: method, mode: "store", discount: Number(discount||0),
      });
      setReceipt(data); clearCart(); setDiscount(0); setCash(0); setCustomer(null);
      toast.success(`Vente ${data.code} enregistrée`);
    } catch (e) { toast.error("Erreur lors du paiement"); }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_420px] gap-4 h-[calc(100vh-7rem)]">
      <div className="dina-card-white p-4 flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]"/><input className="dina-input pl-9" placeholder="Rechercher produit ou scanner un code-barres…" value={q} onChange={e=>setQ(e.target.value)} data-testid="pos-search"/></div>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-2 mb-3">
          {cats.map(c=><button key={c} onClick={()=>setCat(c)} className={`px-3 py-1.5 text-xs rounded-full border whitespace-nowrap ${cat===c?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec] text-[#666]"}`} data-testid={`pos-cat-${c}`}>{c}</button>)}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto scrollbar-thin flex-1">
          {filtered.map(p=>(
            <button key={p.id} onClick={()=>addToCart(p,1,p.sizes?.[0],p.colors?.[0])} className="text-left bg-white border border-[#ececec] rounded-xl overflow-hidden hover:border-[#b02a2a] transition" data-testid={`pos-product-${p.id}`}>
              <div className="aspect-square bg-[#f5f5f5]"><img src={p.image} alt="" className="w-full h-full object-cover"/></div>
              <div className="p-2.5">
                <div className="text-xs text-[#666]">{p.category}</div>
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="flex items-center justify-between mt-1"><span className="tabular text-sm font-semibold">{fcfa(p.price)}</span><span className="text-[10px] text-[#666]">Stk {p.stock}</span></div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="dina-card-white p-4 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3"><div className="font-semibold">Panier</div>{cart.length>0 && <button onClick={clearCart} className="text-xs text-[#c62828]" data-testid="pos-clear">Vider</button>}</div>
        <div className="mb-3">
          {customer ? (
            <div className="flex items-center justify-between p-2 bg-[#fff5f5] border border-[#fde8e8] rounded-lg text-sm">
              <div><div className="font-medium">{customer.name}</div><div className="text-xs text-[#666]">{customer.phone} · {customer.loyalty_points||0} pts</div></div>
              <button onClick={()=>setCustomer(null)}><X size={14}/></button>
            </div>
          ) : (
            <div className="relative">
              <input className="dina-input" placeholder="Rattacher un client (nom ou tél)…" value={custQ} onChange={e=>searchCust(e.target.value)} data-testid="pos-customer-search"/>
              {custResults.length>0 && <div className="absolute z-10 bg-white border border-[#ececec] rounded-lg mt-1 w-full max-h-56 overflow-y-auto">{custResults.map(c=><button key={c.id} onClick={()=>{setCustomer(c);setCustQ("");setCustResults([]);}} className="w-full text-left px-3 py-2 text-sm hover:bg-[#f5f5f5]"><div className="font-medium">{c.name}</div><div className="text-xs text-[#666]">{c.phone}</div></button>)}</div>}
              <button onClick={createCust} className="mt-1 text-xs text-[#0021cc] flex items-center gap-1"><UserPlus size={12}/>Nouveau client</button>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin -mx-2 px-2">
          {cart.length===0 ? <div className="text-center text-sm text-[#666] py-10">Aucun article</div> :
            cart.map(it=>(
              <div key={it.key} className="flex items-center gap-2 py-2 border-b border-[#f0f0f0]">
                <div className="w-11 h-11 rounded bg-[#f5f5f5] overflow-hidden"><img src={it.image} alt="" className="w-full h-full object-cover"/></div>
                <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{it.name}</div><div className="text-xs text-[#666]">{[it.size,it.color].filter(Boolean).join(" · ")} · {fcfa(it.price)}</div></div>
                <div className="flex items-center gap-1"><button onClick={()=>updateCartQty(it.key, it.qty-1)} className="w-6 h-6 border rounded"><Minus size={10} className="mx-auto"/></button><span className="w-6 text-center tabular text-sm">{it.qty}</span><button onClick={()=>updateCartQty(it.key, it.qty+1)} className="w-6 h-6 border rounded"><Plus size={10} className="mx-auto"/></button></div>
                <button onClick={()=>removeFromCart(it.key)} className="text-[#c62828]"><Trash2 size={14}/></button>
              </div>
            ))
          }
        </div>
        <div className="border-t border-[#ececec] pt-3 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-[#666]">Sous-total</span><span className="tabular">{fcfa(subtotal)}</span></div>
          <div className="flex justify-between items-center"><span className="text-[#666]">Remise</span><input type="number" className="dina-input w-28 text-right tabular" value={discount} onChange={e=>setDiscount(e.target.value)} data-testid="pos-discount"/></div>
          <div className="flex justify-between font-semibold text-base"><span>Total</span><span className="tabular">{fcfa(total)}</span></div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <button onClick={()=>setMethod("cash")} className={`py-2 text-xs rounded-lg border ${method==="cash"?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec]"}`} data-testid="pay-cash"><Wallet size={14} className="inline mr-1"/>Espèces</button>
          <button onClick={()=>setMethod("wave")} className={`py-2 text-xs rounded-lg border ${method==="wave"?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec]"}`} data-testid="pay-wave"><Smartphone size={14} className="inline mr-1"/>Wave</button>
          <button onClick={()=>setMethod("mixed")} className={`py-2 text-xs rounded-lg border ${method==="mixed"?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec]"}`} data-testid="pay-mixed"><CreditCard size={14} className="inline mr-1"/>Mixte</button>
        </div>
        {method==="cash" && <div className="mt-2 flex items-center gap-2 text-sm"><span className="text-[#666] w-20">Reçu</span><input type="number" className="dina-input tabular" value={cash} onChange={e=>setCash(e.target.value)} data-testid="pos-cash-received"/><span className="text-[#1f8a4c] tabular whitespace-nowrap">Rendu: {fcfa(change)}</span></div>}
        <button onClick={pay} disabled={!cart.length} className="dina-btn-primary w-full mt-3" data-testid="pos-checkout">Encaisser · {fcfa(total)}</button>
      </div>

      {receipt && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50" onClick={()=>setReceipt(null)}>
          <div className="bg-white rounded-xl p-6 w-80 font-mono text-xs" onClick={e=>e.stopPropagation()}>
            <div className="text-center font-serif text-lg">Dina Store</div>
            <div className="text-center text-[10px] text-[#666] mb-3">Cocody · +225 27 22 44 55 66</div>
            <div className="text-center">N° {receipt.code}</div>
            <div className="border-t border-dashed my-2"/>
            {receipt.items.map((it,i)=><div key={i} className="flex justify-between"><span>{it.qty}x {it.name.slice(0,22)}</span><span>{fcfa(it.qty*it.price)}</span></div>)}
            <div className="border-t border-dashed my-2"/>
            <div className="flex justify-between font-bold text-sm"><span>TOTAL</span><span>{fcfa(receipt.total)}</span></div>
            <div className="text-center text-[10px] text-[#666] mt-3">Merci de votre visite !</div>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>window.print()} className="dina-btn-secondary flex-1 !min-h-[36px]"><Printer size={14}/>Imprimer</button>
              <button onClick={()=>setReceipt(null)} className="dina-btn-primary flex-1 !min-h-[36px]">OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
