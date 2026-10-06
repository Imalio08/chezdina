import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Download, X, Sparkles, Wand2 } from "lucide-react";
import ImageUpload from "@/components/shared/ImageUpload";
import CreateOnFlySelect from "@/components/shared/CreateOnFlySelect";

const DEFAULT_SIZES = ["XS","S","M","L","XL","XXL"];
const SHOE_SIZES = ["36","37","38","39","40","41"];
const DEFAULT_COLORS = ["Noir","Beige","Blanc","Rouge","Bleu","Vert"];

export default function Products() {
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Tous");
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState(null);
  const load = async () => { try { const r = await api.get("/products"); setProducts(r.data); } catch { toast.error("Erreur"); } };
  useEffect(() => { load(); }, []);
  const cats = useMemo(()=>["Tous", ...Array.from(new Set(products.map(p=>p.category)))], [products]);
  const brands = useMemo(()=>Array.from(new Set(products.map(p=>p.brand).filter(Boolean))), [products]);
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
          <thead><tr><th>Produit</th><th>Catégorie</th><th>Marque</th><th>SKU</th><th>Variantes</th><th className="text-right">Prix</th><th className="text-right">Marge</th><th className="text-right">Stock</th><th></th></tr></thead>
          <tbody>{filtered.slice(0,100).map(p=>{
            const marge = p.price && p.cost ? Math.round((p.price-p.cost)/p.price*100) : 0;
            return (
              <tr key={p.id} data-testid={`product-row-${p.sku}`}>
                <td><div className="flex items-center gap-2"><div className="w-9 h-9 rounded bg-[#f5f5f5] overflow-hidden"><img src={p.image || p.images?.[0]} alt="" className="w-full h-full object-cover"/></div><span className="font-medium">{p.name}</span></div></td>
                <td>{p.category}</td><td>{p.brand}</td><td className="font-mono text-xs">{p.sku}</td>
                <td className="text-xs text-[#666]">{(p.sizes||[]).join(",")} · {(p.colors||[]).length} couleurs</td>
                <td className="text-right tabular font-semibold">{fcfa(p.price)}</td>
                <td className="text-right tabular"><span className={marge>=40?"text-[#1f8a4c]":marge<20?"text-[#c62828]":""}>{marge}%</span></td>
                <td className="text-right tabular"><span className={p.stock<5?"text-[#c62828]":""}>{p.stock}</span></td>
                <td className="text-right"><button onClick={()=>{setEdit(p);setShowForm(true);}} className="text-[#0021cc]" data-testid={`edit-product-${p.sku}`}><Pencil size={14}/></button> <button onClick={()=>del(p.id)} className="text-[#c62828] ml-2"><Trash2 size={14}/></button></td>
              </tr>
            );
          })}</tbody>
        </table></div>
      </div>

      {showForm && <ProductForm initial={edit} brands={brands} cats={cats.filter(c=>c!=="Tous")} onSave={save} onClose={()=>{setShowForm(false);setEdit(null);}}/>}
    </div>
  );
}

function ProductForm({ initial, brands, cats, onSave, onClose }) {
  const [f, setF] = useState(initial || {
    name:"", category:"Robes", brand:"Dina Signature", price:15000, cost:7500, description:"",
    image:"", images:[], sizes:["S","M","L"], colors:["Noir","Beige"], stock:0, stock_by_size:{},
    visibility:"both", material:"", season:""
  });
  const [localBrands, setLocalBrands] = useState(brands || []);
  const [localCats, setLocalCats] = useState(cats || []);
  const [aiLoading, setAiLoading] = useState(false);

  const margePct = f.price && f.cost ? Math.round((f.price - f.cost)/f.price * 100) : 0;
  const margeAbs = (f.price || 0) - (f.cost || 0);

  // Variant matrix: when sizes/colors change, ensure stock_by_size has entries
  const updateVariant = (size, qty) => setF(p => ({ ...p, stock_by_size: { ...(p.stock_by_size||{}), [size]: Math.max(0, +qty || 0) } }));
  const totalStock = Object.values(f.stock_by_size || {}).reduce((s,v)=>s+(+v||0), 0);
  const generateVariants = () => {
    const matrix = {};
    (f.sizes || []).forEach(s => { matrix[s] = f.stock_by_size?.[s] ?? 2; });
    setF({...f, stock_by_size: matrix, stock: Object.values(matrix).reduce((s,v)=>s+v,0)});
    toast.success(`${f.sizes.length} variantes générées (2 unités par défaut)`);
  };

  const aiDescribe = async () => {
    setAiLoading(true);
    try {
      const { data } = await api.post("/ai/ask", { question: `Rédige une description de produit en français pour une boutique de mode féminine à Abidjan : nom "${f.name}", catégorie "${f.category}", marque "${f.brand}", matière "${f.material||'—'}", prix ${f.price} FCFA. 3 phrases vendeuses + 4 bullet points (matière, confort, occasion, conseil de taille).` });
      setF({...f, description: data.answer || f.description});
      toast.success("Description générée !");
    } catch { toast.error("IA indisponible"); } finally { setAiLoading(false); }
  };

  const save = () => {
    const payload = { ...f };
    if (f.images?.[0]) payload.image = f.images[0];
    payload.stock = totalStock || f.stock || 0;
    onSave(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div><div className="font-serif text-xl">{initial?"Modifier le produit":"Nouveau produit"}</div><div className="text-xs text-[#666]">Variantes · images · marge calculée en direct</div></div>
          <button onClick={onClose}><X size={18}/></button>
        </div>

        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="text-xs uppercase font-semibold text-[#666]">Informations générales</div>
              <input className="dina-input" placeholder="Nom du produit *" value={f.name} onChange={e=>setF({...f,name:e.target.value})} data-testid="product-name"/>
              <div className="grid grid-cols-2 gap-2">
                <CreateOnFlySelect label="Catégorie" value={f.category} onChange={v=>setF({...f,category:v})} options={localCats} onCreate={v=>setLocalCats([...localCats,v])} testid="product-category"/>
                <CreateOnFlySelect label="Marque" value={f.brand} onChange={v=>setF({...f,brand:v})} options={localBrands} onCreate={v=>setLocalBrands([...localBrands,v])} testid="product-brand"/>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input className="dina-input" placeholder="Matière" value={f.material||""} onChange={e=>setF({...f,material:e.target.value})}/>
                <input className="dina-input" placeholder="Saison" value={f.season||""} onChange={e=>setF({...f,season:e.target.value})}/>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase font-semibold text-[#666]">Prix &amp; marge</div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[10px] text-[#999] uppercase">Prix de vente</label><input type="number" className="dina-input tabular" value={f.price} onChange={e=>setF({...f,price:+e.target.value})} data-testid="product-price"/></div>
                <div><label className="text-[10px] text-[#999] uppercase">Coût d'achat</label><input type="number" className="dina-input tabular" value={f.cost} onChange={e=>setF({...f,cost:+e.target.value})} data-testid="product-cost"/></div>
              </div>
              <div className={`p-3 rounded-lg ${margePct>=40?"bg-[#f0f9f4] dark:bg-[#1a2a1a] text-[#1f8a4c]":margePct<20?"bg-[#fff5f5] dark:bg-[#2a1818] text-[#c62828]":"bg-[#fff5f5] dark:bg-[#2a1818] text-[#e4991e]"}`}>
                <div className="text-[10px] uppercase font-semibold">Marge</div>
                <div className="font-serif text-xl tabular">{fcfa(margeAbs)} · {margePct}%</div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase font-semibold text-[#666]">Images produit</div>
              <div className="text-[10px] text-[#999]">La première image sera utilisée en vitrine</div>
            </div>
            <ImageUpload value={f.images || (f.image?[f.image]:[])} onChange={imgs=>setF({...f,images:imgs,image:imgs[0]||""})} max={6} maxKB={400} testid="product-images"/>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase font-semibold text-[#666]">Description</div>
              <button onClick={aiDescribe} disabled={aiLoading||!f.name} className="text-xs text-[#b02a2a] flex items-center gap-1 hover:underline disabled:opacity-50" data-testid="product-ai-desc"><Wand2 size={12}/>{aiLoading?"Génération…":"Rédiger avec l'IA"}</button>
            </div>
            <textarea className="dina-input" rows={4} placeholder="Description vendeuse en français…" value={f.description} onChange={e=>setF({...f,description:e.target.value})} data-testid="product-description"/>
          </div>

          <div>
            <div className="text-xs uppercase font-semibold text-[#666] mb-2">Variantes</div>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-[#999] uppercase">Tailles</label>
                <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
                  {(f.category?.toLowerCase().includes("chaussure")||f.category?.toLowerCase().includes("mule")||f.category?.toLowerCase().includes("sandale") ? SHOE_SIZES : DEFAULT_SIZES).map(s => {
                    const on = (f.sizes||[]).includes(s);
                    return <button key={s} onClick={()=>setF({...f, sizes: on ? f.sizes.filter(x=>x!==s) : [...(f.sizes||[]),s]})} className={`px-2.5 py-1 rounded-full text-xs border ${on?"bg-[#b02a2a] text-white border-[#b02a2a]":"border-[#ececec] dark:border-[#2a2a2a]"}`} data-testid={`size-${s}`}>{s}</button>;
                  })}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-[#999] uppercase">Couleurs</label>
                <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
                  {DEFAULT_COLORS.map(c => {
                    const on = (f.colors||[]).includes(c);
                    return <button key={c} onClick={()=>setF({...f, colors: on ? f.colors.filter(x=>x!==c) : [...(f.colors||[]),c]})} className={`px-2.5 py-1 rounded-full text-xs border ${on?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec] dark:border-[#2a2a2a]"}`} data-testid={`color-${c}`}>{c}</button>;
                  })}
                </div>
              </div>
            </div>
            <button onClick={generateVariants} disabled={!(f.sizes||[]).length} className="dina-btn-secondary text-xs !min-h-[32px] mb-2" data-testid="generate-variants"><Sparkles size={12}/>Générer la matrice de variantes</button>
            {(f.sizes||[]).length>0 && Object.keys(f.stock_by_size||{}).length>0 && (
              <div className="overflow-x-auto"><table className="dina-table"><thead><tr><th>Taille</th><th className="text-right">Stock initial</th><th className="text-right">Valeur au coût</th></tr></thead><tbody>
                {(f.sizes||[]).map(s => (
                  <tr key={s}><td className="font-semibold">{s}</td><td className="text-right"><input type="number" className="dina-input tabular w-24 text-right !py-1" value={f.stock_by_size?.[s]||0} onChange={e=>updateVariant(s,e.target.value)} data-testid={`stock-${s}`}/></td><td className="text-right tabular text-[#666]">{fcfa((f.stock_by_size?.[s]||0)*f.cost)}</td></tr>
                ))}
                <tr className="font-semibold"><td>Total</td><td className="text-right tabular">{totalStock}</td><td className="text-right tabular">{fcfa(totalStock*f.cost)}</td></tr>
              </tbody></table></div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs"><input type="radio" checked={f.visibility==="both"} onChange={()=>setF({...f,visibility:"both"})} className="accent-[#b02a2a] mr-1"/>Boutique + site</label>
            <label className="text-xs"><input type="radio" checked={f.visibility==="store"} onChange={()=>setF({...f,visibility:"store"})} className="accent-[#b02a2a] mr-1"/>Boutique uniquement</label>
            <label className="text-xs"><input type="radio" checked={f.visibility==="online"} onChange={()=>setF({...f,visibility:"online"})} className="accent-[#b02a2a] mr-1"/>Site uniquement</label>
          </div>
        </div>

        <div className="flex gap-2 mt-5 sticky bottom-0 bg-white dark:bg-[#1a1a1a] pt-3">
          <button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button>
          <button onClick={save} disabled={!f.name} className="dina-btn-primary flex-1" data-testid="product-save">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
