import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Package, Layers } from "lucide-react";

export default function BrandsCategories() {
  const [tab, setTab] = useState("brands");
  const [brands, setBrands] = useState([]);
  const [cats, setCats] = useState([]);
  const load = () => Promise.all([api.get("/brands"), api.get("/categories")]).then(([a, b]) => { setBrands(a.data); setCats(b.data); }).catch(() => { });
  useEffect(() => { load(); }, []);
  const addItem = async () => {
    const name = prompt(tab === "brands" ? "Nom de la marque ?" : "Nom de la catégorie ?");
    if (!name) return;
    try { await api.post(`/${tab}`, { name }); toast.success("Ajouté"); load(); }
    catch { toast.error("Erreur"); }
  };
  const del = async (id, name) => {
    if (!confirm(`Supprimer "${name}" ? Les produits conservent leur ${tab === "brands" ? "marque" : "catégorie"}.`)) return;
    try { await api.delete(`/${tab}/${id}`); toast.success("Supprimé"); load(); }
    catch { toast.error("Erreur"); }
  };
  const list = tab === "brands" ? brands : cats;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Marques & catégories</h1><p className="text-sm text-[#666]">Référentiel partagé par le catalogue</p></div>
        <button onClick={addItem} className="dina-btn-primary !min-h-[40px]" data-testid="bc-add"><Plus size={14} />Ajouter</button>
      </div>
      <div className="flex gap-1 bg-[#f5f5f5] dark:bg-[#1a1a1a] p-1 rounded-lg w-fit">
        <button onClick={() => setTab("brands")} className={`px-4 py-1.5 text-sm rounded-md ${tab === "brands" ? "bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold" : ""}`} data-testid="bc-tab-brands"><Package size={11} className="inline mr-1" />Marques ({brands.length})</button>
        <button onClick={() => setTab("categories")} className={`px-4 py-1.5 text-sm rounded-md ${tab === "categories" ? "bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold" : ""}`} data-testid="bc-tab-categories"><Layers size={11} className="inline mr-1" />Catégories ({cats.length})</button>
      </div>
      <div className="dina-card-white overflow-hidden">
        <table className="dina-table">
          <thead><tr><th>Nom</th><th className="text-right">Produits</th><th>Note</th><th></th></tr></thead>
          <tbody>{list.length === 0 ? <tr><td colSpan={4} className="text-center text-sm text-[#666] py-6">Aucun élément</td></tr> :
            list.map(x => (
              <tr key={x.id} data-testid={`bc-row-${x.name}`}>
                <td className="font-medium">{x.name}</td>
                <td className="text-right tabular">{x.product_count}</td>
                <td className="text-xs text-[#666]">{x.note || "—"}</td>
                <td className="text-right"><button onClick={() => del(x.id, x.name)} className="text-[#c62828]"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
