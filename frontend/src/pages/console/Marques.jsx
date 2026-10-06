import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Package, Layers, X } from "lucide-react";
import ImageUpload from "@/components/shared/ImageUpload";

export default function Marques() {
  const [tab, setTab] = useState("brands");
  const [brands, setBrands] = useState([]);
  const [cats, setCats] = useState([]);
  const [edit, setEdit] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const [b, c] = await Promise.all([api.get("/brands"), api.get("/categories")]);
    setBrands(b.data || []); setCats(c.data || []);
  };
  useEffect(() => { load(); }, []);

  const save = async (f) => {
    try {
      const path = tab === "brands" ? "brands" : "categories";
      if (f.id) await api.patch(`/${path}/${f.id}`, f);
      else await api.post(`/${path}`, f);
      toast.success("Enregistré"); setShowForm(false); setEdit(null); load();
    } catch { toast.error("Erreur"); }
  };
  const del = async (id, name) => {
    if (!confirm(`Supprimer "${name}" ?`)) return;
    const path = tab === "brands" ? "brands" : "categories";
    try { await api.delete(`/${path}/${id}`); toast.success("Supprimé"); load(); }
    catch { toast.error("Erreur"); }
  };

  const list = tab === "brands" ? brands : cats;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Marques & catégories</h1><p className="text-sm text-[#666]">Référentiel partagé par le catalogue</p></div>
        <button onClick={()=>{setEdit(null); setShowForm(true);}} className="dina-btn-primary !min-h-[40px]" data-testid="marques-add"><Plus size={14}/>Ajouter</button>
      </div>
      <div className="flex gap-1 bg-[#f5f5f5] dark:bg-[#1a1a1a] p-1 rounded-lg w-fit">
        <button onClick={()=>setTab("brands")} className={`px-4 py-1.5 text-sm rounded-md flex items-center gap-1 ${tab==="brands"?"bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold":""}`} data-testid="tab-brands"><Package size={11}/>Marques ({brands.length})</button>
        <button onClick={()=>setTab("categories")} className={`px-4 py-1.5 text-sm rounded-md flex items-center gap-1 ${tab==="categories"?"bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold":""}`} data-testid="tab-cats"><Layers size={11}/>Catégories ({cats.length})</button>
      </div>

      {tab === "brands" ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {brands.length === 0 ? <div className="col-span-full dina-card-white py-12 text-center text-sm text-[#666]">Aucune marque</div> :
            brands.map(b => (
              <div key={b.id} className="dina-card-white p-4 flex items-center gap-3" data-testid={`brand-${b.name}`}>
                <div className="w-14 h-14 rounded-lg bg-[#fff5f5] overflow-hidden grid place-items-center shrink-0">
                  {b.logo ? <img src={b.logo} alt="" className="w-full h-full object-contain"/> : <span className="font-serif text-xl text-[#b02a2a] font-bold">{(b.name||"?")[0]}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{b.name}</div>
                  <div className="text-xs text-[#666]">{b.product_count || 0} produits</div>
                  {b.note && <div className="text-[11px] text-[#999] mt-0.5 truncate italic">« {b.note} »</div>}
                </div>
                <div className="flex gap-1">
                  <button onClick={()=>{setEdit(b); setShowForm(true);}} className="text-[#0021cc]"><Pencil size={14}/></button>
                  <button onClick={()=>del(b.id, b.name)} className="text-[#c62828]"><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="dina-card-white overflow-hidden">
          <table className="dina-table">
            <thead><tr><th>Catégorie</th><th className="text-right">Produits</th><th>Note</th><th></th></tr></thead>
            <tbody>{cats.length === 0 ? <tr><td colSpan={4} className="text-center text-sm text-[#666] py-8">Aucune catégorie</td></tr> :
              cats.map(c => (
                <tr key={c.id} data-testid={`cat-${c.name}`}>
                  <td className="font-medium">{c.name}</td>
                  <td className="text-right tabular">{c.product_count}</td>
                  <td className="text-xs text-[#666]">{c.note || "—"}</td>
                  <td className="text-right">
                    <button onClick={()=>{setEdit(c); setShowForm(true);}} className="text-[#0021cc] mr-2"><Pencil size={14}/></button>
                    <button onClick={()=>del(c.id, c.name)} className="text-[#c62828]"><Trash2 size={14}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <ItemForm initial={edit} isBrand={tab==="brands"} onSave={save} onClose={()=>{setShowForm(false); setEdit(null);}}/>}
    </div>
  );
}

function ItemForm({ initial, isBrand, onSave, onClose }) {
  const [f, setF] = useState(initial || { name:"", note:"", logo:"", status:"active" });
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()} data-testid="item-form">
        <div className="flex items-center justify-between mb-4">
          <div className="font-serif text-xl">{initial?"Modifier":"Ajouter"} {isBrand?"une marque":"une catégorie"}</div>
          <button onClick={onClose}><X size={18}/></button>
        </div>
        <div className="space-y-3">
          <input className="dina-input" placeholder={isBrand?"Nom de la marque":"Nom de la catégorie"} value={f.name} onChange={e=>setF({...f,name:e.target.value})} data-testid="item-name"/>
          {isBrand && (
            <div>
              <div className="text-[10px] uppercase font-semibold text-[#666] mb-1.5">Logo</div>
              <ImageUpload value={f.logo?[f.logo]:[]} onChange={imgs=>setF({...f, logo: imgs[0]||""})} single max={1} maxKB={200} testid="item-logo"/>
            </div>
          )}
          <textarea className="dina-input" rows={3} placeholder="Note / description interne" value={f.note||""} onChange={e=>setF({...f,note:e.target.value})} data-testid="item-note"/>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button>
          <button onClick={()=>onSave(f)} disabled={!f.name} className="dina-btn-primary flex-1" data-testid="item-save">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
