import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Download } from "lucide-react";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Tous");
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState(null);
  const load = () => api.get("/products").then(r=>setProducts(r.data));
  useEffect(load, []);
  const cats = useMemo(()=>["Tous", ...Array.from(new Set(products.map(p=>p.category)))], [products]);
  const filtered = products.filter(p => (cat==="Tous"||p.category===cat) && (!q||p.name.toLowerCase().includes(q.toLowerCase())||p.sku?.includes(q)));

  const save = async (f) => {
    try {
      if (edit?.id) await api.patch(`/products/${edit.id}`, f);
      else await api.post("/products", f);
      toast.success("Produit enregistré"); setShowForm(false); setEdit(null); load();
    } catch { toast.error("Erreur"); }
  };
  const del = async (id) => { if(!confirm("Supprimer ?"))return; await api.delete(`/products/${id}`); toast.success("Supprimé"); load(); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="font-serif text-3xl">Produits</h1><p className="text-sm text-[#666]">{products.length} références</p></div>
        <div className="flex gap-2">
          <button className="dina-btn-secondary !min-h-[40px]" data-testid="products-export"><Download size={14}/>Exporter</button>
          <button onClick={()=>{setEdit(null);setShowForm(true);}} className="dina-btn-primary !min-h-[40px]" data-testid="products-new"><Plus size={14}/>Nouveau produit</button>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <input className="dina-input max-w-xs" placeholder="Rechercher…" value={q} onChange={e=>setQ(e.target.value)} data-testid="products-search"/>
        <select className="dina-input max-w-xs" value={cat} onChange={e=>setCat(e.target.value)}>{cats.map(c=><option key={c}>{c}</option>)}</select>
      </div>
      <div className="dina-card-white overflow-hidden">
        <div className="overflow-x-auto"><table className="dina-table">
          <thead><tr><th>Produit</th><th>Catégorie</th><th>Marque</th><th>SKU</th><th>Variantes</th><th className="text-right">Prix</th><th className="text-right">Stock</th><th></th></tr></thead>
          <tbody>{filtered.slice(0,100).map(p=>(
            <tr key={p.id} data-testid={`product-row-${p.sku}`}>
              <td><div className="flex items-center gap-2"><div className="w-9 h-9 rounded bg-[#f5f5f5] overflow-hidden"><img src={p.image} alt="" className="w-full h-full object-cover"/></div><span className="font-medium">{p.name}</span></div></td>
              <td>{p.category}</td><td>{p.brand}</td><td className="font-mono text-xs">{p.sku}</td>
              <td className="text-xs text-[#666]">{(p.sizes||[]).join(",")} · {(p.colors||[]).length} couleurs</td>
              <td className="text-right tabular font-semibold">{fcfa(p.price)}</td>
              <td className="text-right tabular"><span className={p.stock<5?"text-[#c62828]":""}>{p.stock}</span></td>
              <td className="text-right"><button onClick={()=>{setEdit(p);setShowForm(true);}} className="text-[#0021cc]" data-testid={`edit-product-${p.sku}`}><Pencil size={14}/></button> <button onClick={()=>del(p.id)} className="text-[#c62828] ml-2"><Trash2 size={14}/></button></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>

      {showForm && <ProductForm initial={edit} onSave={save} onClose={()=>{setShowForm(false);setEdit(null);}}/>}
    </div>
  );
}

function ProductForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { name:"", category:"Robes", brand:"Dina Signature", price:15000, cost:7500, description:"", image:"https://images.unsplash.com/photo-1709809081557-78f803ce93a0?w=600", sizes:["S","M","L"], colors:["Noir","Beige"], stock:10, visibility:"both" });
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="font-serif text-xl mb-4">{initial?"Modifier le produit":"Nouveau produit"}</div>
        <div className="space-y-3 text-sm">
          <input className="dina-input" placeholder="Nom" value={f.name} onChange={e=>setF({...f,name:e.target.value})} data-testid="product-name"/>
          <div className="grid grid-cols-2 gap-2"><input className="dina-input" placeholder="Catégorie" value={f.category} onChange={e=>setF({...f,category:e.target.value})}/><input className="dina-input" placeholder="Marque" value={f.brand} onChange={e=>setF({...f,brand:e.target.value})}/></div>
          <div className="grid grid-cols-3 gap-2"><input type="number" className="dina-input" placeholder="Prix" value={f.price} onChange={e=>setF({...f,price:+e.target.value})}/><input type="number" className="dina-input" placeholder="Coût" value={f.cost} onChange={e=>setF({...f,cost:+e.target.value})}/><input type="number" className="dina-input" placeholder="Stock" value={f.stock} onChange={e=>setF({...f,stock:+e.target.value})}/></div>
          <input className="dina-input" placeholder="URL image" value={f.image} onChange={e=>setF({...f,image:e.target.value})}/>
          <textarea className="dina-input" placeholder="Description" value={f.description} onChange={e=>setF({...f,description:e.target.value})}/>
          <input className="dina-input" placeholder="Tailles (S,M,L)" value={(f.sizes||[]).join(",")} onChange={e=>setF({...f,sizes:e.target.value.split(",").map(x=>x.trim())})}/>
          <input className="dina-input" placeholder="Couleurs" value={(f.colors||[]).join(",")} onChange={e=>setF({...f,colors:e.target.value.split(",").map(x=>x.trim())})}/>
        </div>
        <div className="flex gap-2 mt-4"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={()=>onSave(f)} className="dina-btn-primary flex-1" data-testid="product-save">Enregistrer</button></div>
      </div>
    </div>
  );
}
