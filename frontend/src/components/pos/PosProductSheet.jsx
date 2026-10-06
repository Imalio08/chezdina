import React, { useMemo, useState } from "react";
import { X, Minus, Plus, ShoppingBag, Bell } from "lucide-react";
import { fcfa } from "@/lib/format";
import api from "@/lib/api";
import { toast } from "sonner";

/** Product tap sheet: shows color swatches + size grid with per-size stock. Sold-out → waitlist. */
export default function PosProductSheet({ product, customer, onAdd, onClose }) {
  const colors = product.colors || [];
  const sizes = product.sizes || [];
  const [color, setColor] = useState(colors[0] || "");
  const [size, setSize] = useState("");
  const [qty, setQty] = useState(1);

  const stockForSize = (s) => Number(product.stock_by_size?.[s] ?? 0);
  const totalStock = useMemo(() => Object.values(product.stock_by_size||{}).reduce((s,v)=>s+Number(v||0),0) || product.stock || 0, [product]);

  const add = () => {
    if (sizes.length && !size) return toast.error("Choisissez une taille");
    if (size && stockForSize(size) <= 0) return toast.error("Rupture — proposez la liste d'attente");
    onAdd(product, qty, size, color);
    onClose();
  };

  const addToWaitlist = async (s) => {
    if (!customer) return toast.error("Rattachez d'abord une cliente");
    try {
      await api.post("/waitlist", { product_id: product.id, size: s || null, phone: customer.phone, name: customer.name });
      toast.success(`${customer.name} ajoutée à la liste d'attente (${s||"toutes tailles"})`);
    } catch { toast.error("Erreur liste d'attente"); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-end sm:place-items-center z-50 p-0 sm:p-4" onClick={onClose} data-testid="pos-product-sheet">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-[#1a1a1a] flex items-center justify-between p-4 border-b border-[#ececec] dark:border-[#2a2a2a] z-10">
          <div className="min-w-0"><div className="text-[10px] uppercase text-[#b02a2a] font-semibold tracking-wide">{product.brand} · {product.category}</div><div className="font-serif text-lg truncate">{product.name}</div></div>
          <button onClick={onClose} className="p-1" data-testid="sheet-close"><X size={20}/></button>
        </div>
        <div className="grid sm:grid-cols-2 gap-0">
          <div className="aspect-square sm:aspect-auto sm:min-h-[380px] bg-[#fff5f5]"><img src={product.image || product.images?.[0]} alt="" className="w-full h-full object-cover" data-testid="sheet-image"/></div>
          <div className="p-4 space-y-4">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-serif text-2xl tabular text-[#b02a2a]">{fcfa(product.price)}</span>
              {product.price_old && product.price_old > product.price && <span className="text-sm text-[#999] line-through tabular">{fcfa(product.price_old)}</span>}
              <span className="text-xs text-[#666]">Stock total : <b>{totalStock}</b></span>
            </div>

            {!!colors.length && (
              <div>
                <div className="text-[10px] uppercase text-[#666] font-semibold mb-1.5">Couleur · <span className="text-[#1c1c1c]">{color || "—"}</span></div>
                <div className="flex gap-1.5 flex-wrap">
                  {colors.map(c => <button key={c} onClick={()=>setColor(c)} className={`px-3 h-9 rounded-lg border text-xs ${color===c?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec] dark:border-[#2a2a2a]"}`} data-testid={`sheet-color-${c}`}>{c}</button>)}
                </div>
              </div>
            )}

            {!!sizes.length && (
              <div>
                <div className="text-[10px] uppercase text-[#666] font-semibold mb-1.5">{product.category?.toLowerCase().includes("chaussure")||product.category?.toLowerCase().includes("mule")||product.category?.toLowerCase().includes("sandale")?"Pointure":"Taille"}</div>
                <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5">
                  {sizes.map(s => {
                    const stk = stockForSize(s); const out = stk <= 0;
                    const active = size === s;
                    return (
                      <button key={s} onClick={()=> out ? addToWaitlist(s) : setSize(s)} className={`relative py-2 rounded-lg border text-sm transition flex flex-col items-center justify-center min-h-[48px] ${active?"bg-[#b02a2a] text-white border-[#b02a2a]":out?"border-[#ececec] dark:border-[#2a2a2a] bg-[#fafafa] dark:bg-[#141414] text-[#999]":"border-[#ececec] dark:border-[#2a2a2a] hover:border-[#b02a2a]"}`} data-testid={`sheet-size-${s}`} title={out?"Rupture — tap pour liste d'attente":`${stk} dispo`}>
                        <span className="font-semibold">{s}</span>
                        <span className={`text-[9px] ${active?"text-[#f0b8b8]":out?"text-[#c62828]":"text-[#999]"}`}>{out?"waitlist":stk<=3?`${stk} rest.`:`${stk} dispo`}</span>
                      </button>
                    );
                  })}
                </div>
                {size && stockForSize(size) > 0 && <div className="text-[11px] text-[#1f8a4c] mt-1.5">✓ {stockForSize(size)} dispo en taille {size}</div>}
              </div>
            )}

            <div>
              <div className="text-[10px] uppercase text-[#666] font-semibold mb-1.5">Quantité</div>
              <div className="flex items-center gap-2 w-fit">
                <button onClick={()=>setQty(Math.max(1,qty-1))} className="w-9 h-9 border rounded-lg" data-testid="sheet-qty-minus"><Minus size={14} className="mx-auto"/></button>
                <span className="w-10 text-center tabular font-semibold">{qty}</span>
                <button onClick={()=>setQty(qty+1)} className="w-9 h-9 border rounded-lg" data-testid="sheet-qty-plus"><Plus size={14} className="mx-auto"/></button>
              </div>
            </div>

            {sizes.length>0 && !size && (
              <button onClick={()=>addToWaitlist(null)} className="w-full text-xs text-[#e4991e] py-1.5 border border-[#e4991e] rounded-lg flex items-center justify-center gap-1" data-testid="sheet-waitlist-all"><Bell size={12}/>Prévenir la cliente dès retour en stock</button>
            )}

            <button onClick={add} disabled={sizes.length>0 && !size} className="dina-btn-primary w-full" data-testid="sheet-add"><ShoppingBag size={14}/>Ajouter au panier · {fcfa(product.price*qty)}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
