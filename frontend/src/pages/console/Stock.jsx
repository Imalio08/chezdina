import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Minus, X, Edit } from "lucide-react";

export default function Stock() {
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [adjust, setAdjust] = useState(null);

  const load = () => api.get("/products").then(r=>setProducts(r.data)).catch(()=>{});
  useEffect(() => { load(); }, []);

  const totalValue = products.reduce((s,p)=>s+p.stock*p.cost,0);
  const retailValue = products.reduce((s,p)=>s+p.stock*p.price,0);
  const low = products.filter(p=>p.stock<5);
  const filtered = products.filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.sku?.includes(q));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="font-serif text-3xl">Stock</h1><p className="text-sm text-[#666]">Mouvements, inventaires, alertes</p></div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="dina-card-white p-5"><div className="text-xs uppercase text-[#666] mb-2">Valeur au coût</div><div className="font-serif text-2xl tabular">{fcfa(totalValue)}</div></div>
        <div className="dina-card-white p-5"><div className="text-xs uppercase text-[#666] mb-2">Valeur au prix</div><div className="font-serif text-2xl tabular">{fcfa(retailValue)}</div></div>
        <div className="dina-card-white p-5"><div className="text-xs uppercase text-[#666] mb-2">Références</div><div className="font-serif text-2xl tabular">{products.length}</div></div>
        <div className="dina-card-white p-5"><div className="text-xs uppercase text-[#666] mb-2">Stock faible</div><div className="font-serif text-2xl tabular text-[#c62828]">{low.length}</div></div>
      </div>

      {low.length > 0 && (
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3 text-[#c62828]">⚠ Alertes stock faible ({low.length})</div>
          <table className="dina-table">
            <thead><tr><th>Produit</th><th>Catégorie</th><th>SKU</th><th className="text-right">Stock</th><th className="text-right">Prix</th><th className="text-right">À commander</th><th></th></tr></thead>
            <tbody>{low.map(p=><tr key={p.id} data-testid={`stock-low-${p.sku}`}><td className="font-medium">{p.name}</td><td>{p.category}</td><td className="font-mono text-xs">{p.sku}</td><td className="text-right tabular text-[#c62828] font-semibold">{p.stock}</td><td className="text-right tabular">{fcfa(p.price)}</td><td className="text-right tabular">+{20-p.stock}</td><td className="text-right"><button onClick={()=>setAdjust(p)} className="text-[#0021cc]" data-testid={`stock-adjust-${p.sku}`}><Edit size={13}/></button></td></tr>)}</tbody>
          </table>
        </div>
      )}

      <div className="dina-card-white p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Tous les produits ({filtered.length})</div>
          <input className="dina-input max-w-xs" placeholder="Rechercher…" value={q} onChange={e=>setQ(e.target.value)} data-testid="stock-search"/>
        </div>
        <div className="overflow-x-auto"><table className="dina-table">
          <thead><tr><th>Produit</th><th>SKU</th><th>Tailles · Stock</th><th className="text-right">Stock total</th><th className="text-right">Valeur</th><th></th></tr></thead>
          <tbody>{filtered.slice(0,100).map(p=>(
            <tr key={p.id} data-testid={`stock-row-${p.sku}`}>
              <td><div className="flex items-center gap-2"><div className="w-9 h-9 rounded bg-[#f5f5f5] overflow-hidden"><img src={p.image} alt="" className="w-full h-full object-cover"/></div><div><div className="font-medium">{p.name}</div><div className="text-[10px] text-[#999]">{p.category}</div></div></div></td>
              <td className="font-mono text-xs">{p.sku}</td>
              <td className="text-xs text-[#666]">{Object.entries(p.stock_by_size||{}).map(([s,v])=><span key={s} className="inline-block mr-2">{s}:<b className={v===0?"text-[#c62828]":""}>{v}</b></span>)}</td>
              <td className="text-right tabular"><span className={p.stock<5?"text-[#c62828] font-semibold":""}>{p.stock}</span></td>
              <td className="text-right tabular">{fcfa(p.stock*p.cost)}</td>
              <td className="text-right"><button onClick={()=>setAdjust(p)} className="text-[#0021cc]" data-testid={`stock-adjust-${p.sku}`}><Edit size={13}/>Ajuster</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>

      {adjust && <AdjustStockModal product={adjust} onClose={()=>setAdjust(null)} onSaved={()=>{setAdjust(null); load();}}/>}
    </div>
  );
}

function AdjustStockModal({ product, onClose, onSaved }) {
  const [sbs, setSbs] = useState({...(product.stock_by_size||{})});
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const total = Object.values(sbs).reduce((s,v)=>s+(+v||0),0);
  const sizes = product.sizes?.length ? product.sizes : Object.keys(sbs);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/products/${product.id}`, { stock_by_size: sbs });
      toast.success(`Stock ajusté${note?" · "+note:""}`);
      onSaved();
    } catch { toast.error("Erreur"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4"><div><div className="font-serif text-xl">Ajuster le stock</div><div className="text-xs text-[#666]">{product.name}</div></div><button onClick={onClose}><X size={16}/></button></div>

        {sizes.length === 0 ? (
          <div className="text-sm text-[#666] text-center py-6">Ce produit n'a pas de tailles définies. Modifiez-le dans l'onglet Produits.</div>
        ) : (
          <div className="space-y-2 mb-4">
            <div className="text-xs uppercase text-[#666] mb-2">Stock par taille</div>
            {sizes.map(s=>(
              <div key={s} className="flex items-center gap-2" data-testid={`adjust-size-${s}`}>
                <div className="w-14 font-semibold">{s}</div>
                <button type="button" onClick={()=>setSbs({...sbs,[s]:Math.max(0,(+sbs[s]||0)-1)})} className="w-8 h-8 border border-[#ececec] rounded"><Minus size={12} className="mx-auto"/></button>
                <input type="number" min="0" className="dina-input text-center tabular flex-1" value={sbs[s]||0} onChange={e=>setSbs({...sbs,[s]:Math.max(0,+e.target.value)})}/>
                <button type="button" onClick={()=>setSbs({...sbs,[s]:(+sbs[s]||0)+1})} className="w-8 h-8 border border-[#ececec] rounded"><Plus size={12} className="mx-auto"/></button>
              </div>
            ))}
            <div className="flex justify-between font-semibold pt-2 border-t"><span>Total</span><span className="tabular">{total}</span></div>
          </div>
        )}

        <input className="dina-input mb-4" placeholder="Motif (réception, inventaire, perte…)" value={note} onChange={e=>setNote(e.target.value)} data-testid="adjust-note"/>

        <div className="flex gap-2"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={save} disabled={saving || !sizes.length} className="dina-btn-primary flex-1" data-testid="adjust-save">{saving?"…":"Enregistrer"}</button></div>
      </div>
    </div>
  );
}
