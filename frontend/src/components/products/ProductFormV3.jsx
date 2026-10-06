import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { toast } from "sonner";
import { ChevronLeft, Save, Wand2, Sparkles, Image as ImageIcon, Grid, DollarSign, Package, Eye, Globe } from "lucide-react";
import ImageUpload from "@/components/shared/ImageUpload";
import CreateOnFlySelect from "@/components/shared/CreateOnFlySelect";
import AiDescribeModal from "./AiDescribeModal";
import SeoSection from "./SeoSection";
import VariantsGrid from "./VariantsGrid";
import VideoUpload from "./VideoUpload";

const SHOE_SIZES = ["36","37","38","39","40","41","42"];
const CLOTH_SIZES = ["XS","S","M","L","XL","XXL"];
const DEFAULT_COLORS = ["Noir","Blanc","Rouge","Beige","Doré","Marine","Rose poudré","Camel","Vert émeraude","Nude"];
const STATUS = [["actif","Actif"],["brouillon","Brouillon"],["liste_attente","Liste d'attente"],["inactif","Inactif"]];

export default function ProductFormV3({ productId, brands:brandsProp, cats:catsProp, onClose }) {
  const [f, setF] = useState({
    name:"", category:"", brand:"", collections:"", tags:"", material:"", occasion:"",
    heel_type:"", care:"", supplier:"",
    description:"", images:[], image:"", videos:[],
    price:0, cost:0, price_old:0,
    sizes:[], colors:[], stock_by_size:{}, stock:0, variants:[],
    alert_threshold:3,
    status:"actif", visibility:"both", featured:false, is_new:false,
    seo_title:"", seo_description:"",
  });
  const [brands, setBrands] = useState(brandsProp || []);
  const [cats, setCats] = useState(catsProp || []);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (productId) api.get(`/public/product/${productId}`).then(r => setF(prev => ({...prev, ...r.data})));
  }, [productId]);

  const upd = (k,v) => setF(p => ({...p, [k]:v}));
  const totalStock = useMemo(() => Object.values(f.stock_by_size||{}).reduce((s,v)=>s+Number(v||0),0), [f.stock_by_size]);
  const margePct = f.price && f.cost ? Math.round((f.price-f.cost)/f.price*100) : 0;
  const margeAbs = (f.price||0) - (f.cost||0);
  const belowCost = f.price > 0 && f.cost > 0 && f.price < f.cost;
  const isShoe = (f.category||"").toLowerCase().includes("chaussure") || (f.category||"").toLowerCase().includes("mule") || (f.category||"").toLowerCase().includes("sandale");
  const sizeOptions = isShoe ? SHOE_SIZES : CLOTH_SIZES;

  const genVariants = () => {
    const matrix = {};
    (f.sizes||[]).forEach(s => { matrix[s] = f.stock_by_size?.[s] ?? 2; });
    upd("stock_by_size", matrix);
    toast.success(`${(f.sizes||[]).length} tailles × ${(f.colors||[]).length} couleurs générées`);
  };
  const applyAll = (val) => {
    const matrix = {};
    (f.sizes||[]).forEach(s => matrix[s] = Number(val));
    upd("stock_by_size", matrix);
  };

  const aiDescribe = () => {
    if (!f.name) return toast.error("Entrez d'abord un nom");
    setAiOpen(true);
  };

  const save = async (keepOpen=false) => {
    if (!f.name) return toast.error("Nom requis");
    if (!f.price) return toast.error("Prix requis");
    if (belowCost && !confirm("Le prix de vente est inférieur au coût. Confirmer ?")) return;
    setLoading(true);
    try {
      const payload = { ...f, stock: totalStock || f.stock || 0 };
      if (f.images?.[0]) payload.image = f.images[0];
      if (productId) await api.patch(`/products/${productId}`, payload);
      else await api.post("/products", payload);
      toast.success(productId?"Produit mis à jour":"Produit créé");
      if (keepOpen) {
        setF(p => ({...p, name:"", description:"", images:[], image:"", stock_by_size:{}}));
        toast.info("Prêt pour la suivante");
      } else { onClose(true); }
    } catch { toast.error("Erreur"); } finally { setLoading(false); }
  };

  const addBrand = async (name) => {
    const r = await api.post("/brands", { name }); setBrands([...brands, { name, id: r.data?.id }]);
  };
  const addCat = async (name) => {
    const r = await api.post("/categories", { name }); setCats([...cats, { name, id: r.data?.id }]);
  };

  const previewPrice = f.price > 0 && f.price_old > f.price ? Math.round((f.price_old-f.price)/f.price_old*100) : 0;

  return (
    <div className="space-y-5" data-testid="product-form-v3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button onClick={()=>onClose(false)} className="text-sm text-[#666] inline-flex items-center gap-1 hover:text-[#b02a2a]" data-testid="pfv-back"><ChevronLeft size={13}/>Retour</button>
        <div className="flex gap-2">
          <button onClick={()=>onClose(false)} className="dina-btn-secondary !min-h-[40px]" data-testid="pfv-cancel">Annuler</button>
          <button onClick={()=>save(true)} disabled={loading} className="dina-btn-secondary !min-h-[40px]" data-testid="pfv-save-new">Enregistrer et créer un autre</button>
          <button onClick={()=>save(false)} disabled={loading} className="dina-btn-primary !min-h-[40px]" data-testid="pfv-save"><Save size={13}/>{loading?"Enregistrement…":"Enregistrer"}</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-5">
        <div className="space-y-5">
          <h1 className="font-serif text-3xl">{productId?"Modifier le produit":"Nouveau produit"}</h1>

          {/* 1. Informations */}
          <Section title="1. Informations" icon={Package}>
            <input className="dina-input" placeholder="Nom du produit *" value={f.name} onChange={e=>upd("name",e.target.value)} data-testid="pfv-name"/>
            <div className="grid md:grid-cols-2 gap-3 mt-3">
              <CreateOnFlySelect label="Catégorie *" value={f.category} onChange={v=>upd("category",v)} options={cats.map(c=>c.name)} onCreate={addCat} testid="pfv-category"/>
              <CreateOnFlySelect label="Marque *" value={f.brand} onChange={v=>upd("brand",v)} options={brands.map(b=>b.name)} onCreate={addBrand} testid="pfv-brand"/>
            </div>
            <div className="grid md:grid-cols-2 gap-3 mt-3">
              <input className="dina-input" placeholder="Collections (séparées par ,)" value={f.collections||""} onChange={e=>upd("collections",e.target.value)} data-testid="pfv-collections"/>
              <input className="dina-input" placeholder="Tags (confort, tendance, soirée…)" value={f.tags||""} onChange={e=>upd("tags",e.target.value)} data-testid="pfv-tags"/>
            </div>
            <div className="grid md:grid-cols-3 gap-3 mt-3">
              <input className="dina-input" placeholder="Matière" value={f.material||""} onChange={e=>upd("material",e.target.value)} data-testid="pfv-material"/>
              <input className="dina-input" placeholder="Occasion" value={f.occasion||""} onChange={e=>upd("occasion",e.target.value)} data-testid="pfv-occasion"/>
              <input className="dina-input" placeholder={isShoe?"Type de talon":"Coupe"} value={f.heel_type||""} onChange={e=>upd("heel_type",e.target.value)} data-testid="pfv-cut"/>
            </div>
            <div className="grid md:grid-cols-2 gap-3 mt-3">
              <input className="dina-input" placeholder="Entretien" value={f.care||""} onChange={e=>upd("care",e.target.value)} data-testid="pfv-care"/>
              <input className="dina-input" placeholder="Fournisseur principal" value={f.supplier||""} onChange={e=>upd("supplier",e.target.value)} data-testid="pfv-supplier"/>
            </div>
          </Section>

          {/* 2. Description */}
          <Section title="2. Description" icon={Sparkles} action={<button onClick={aiDescribe} disabled={!f.name} className="text-xs text-[#b02a2a] hover:underline flex items-center gap-1 disabled:opacity-50" data-testid="pfv-ai"><Wand2 size={11}/>Rédiger avec l'IA</button>}>
            <textarea className="dina-input" rows={5} placeholder="Description vendeuse en français…" value={f.description} onChange={e=>upd("description",e.target.value)} data-testid="pfv-desc"/>
          </Section>

          {/* 3. Photos */}
          <Section title="3. Photos" icon={ImageIcon}>
            <ImageUpload value={f.images||(f.image?[f.image]:[])} onChange={imgs=>setF({...f,images:imgs,image:imgs[0]||""})} max={8} maxKB={400} testid="pfv-images"/>
          </Section>

          {/* 3b. Vidéos */}
          <Section title="3b. Vidéos (facultatif, 2 max)" icon={ImageIcon}>
            <VideoUpload videos={f.videos || []} onChange={vs => upd("videos", vs)}/>
          </Section>

          {/* 4. Prix */}
          <Section title="4. Prix & marge" icon={DollarSign}>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-[10px] text-[#999] uppercase font-semibold">Prix de vente *</label><input type="number" className="dina-input tabular" value={f.price||""} onChange={e=>upd("price",+e.target.value||0)} data-testid="pfv-price"/></div>
              <div><label className="text-[10px] text-[#999] uppercase font-semibold">Prix d'achat</label><input type="number" className="dina-input tabular" value={f.cost||""} onChange={e=>upd("cost",+e.target.value||0)} data-testid="pfv-cost"/></div>
              <div><label className="text-[10px] text-[#999] uppercase font-semibold">Prix barré (promo)</label><input type="number" className="dina-input tabular" value={f.price_old||""} onChange={e=>upd("price_old",+e.target.value||0)} data-testid="pfv-price-old"/></div>
            </div>
            <div className={`mt-3 p-3 rounded-lg ${belowCost?"bg-[#fff5f5] text-[#c62828]":margePct>=40?"bg-[#f0f9f4] text-[#1f8a4c]":margePct<20?"bg-[#fff5f5] text-[#e4991e]":"bg-[#fff5f5] text-[#e4991e]"}`}>
              {belowCost ? <>⚠ Le prix de vente ({fcfa(f.price)}) est <b>inférieur</b> au coût ({fcfa(f.cost)}).</> :
                <><b>Marge :</b> {fcfa(margeAbs)} · <b>{margePct}%</b>{previewPrice>0 && <> · <b>-{previewPrice}%</b> affiché en vitrine</>}</>}
            </div>
          </Section>

          {/* 5. Variantes */}
          <Section title="5. Variantes" icon={Grid} highlight>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-[#999] uppercase font-semibold">{isShoe?"Pointures":"Tailles"}</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {sizeOptions.map(s=>{
                    const on = (f.sizes||[]).includes(s);
                    return <button key={s} onClick={()=>upd("sizes", on ? f.sizes.filter(x=>x!==s) : [...(f.sizes||[]),s])} className={`px-2.5 py-1 rounded-full text-xs border ${on?"bg-[#b02a2a] text-white border-[#b02a2a]":"border-[#ececec] dark:border-[#2a2a2a]"}`} data-testid={`pfv-size-${s}`}>{s}</button>;
                  })}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-[#999] uppercase font-semibold">Couleurs</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {DEFAULT_COLORS.map(c=>{
                    const on = (f.colors||[]).includes(c);
                    return <button key={c} onClick={()=>upd("colors", on ? f.colors.filter(x=>x!==c) : [...(f.colors||[]),c])} className={`px-2.5 py-1 rounded-full text-xs border ${on?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec] dark:border-[#2a2a2a]"}`} data-testid={`pfv-color-${c}`}>{c}</button>;
                  })}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button onClick={genVariants} disabled={!(f.sizes||[]).length} className="dina-btn-secondary !min-h-[32px] text-xs" data-testid="pfv-gen-variants"><Sparkles size={12}/>Générer la matrice</button>
              <input type="number" className="dina-input w-24 !py-1 tabular" placeholder="Qté" id="apply-all-input"/>
              <button onClick={()=>{const v=document.getElementById('apply-all-input').value; applyAll(v);}} className="dina-chip text-xs">Appliquer à toutes</button>
            </div>

            {(f.sizes||[]).length>0 && Object.keys(f.stock_by_size||{}).length>0 && (
              <div className="overflow-x-auto mt-4">
                <table className="dina-table">
                  <thead><tr><th>Taille</th><th>SKU auto</th><th className="text-right">Stock initial</th><th className="text-right">Alerte</th><th className="text-right">Valeur coût</th></tr></thead>
                  <tbody>
                    {(f.sizes||[]).map(s=>(
                      <tr key={s}><td className="font-semibold">{s}</td>
                        <td className="font-mono text-xs text-[#666]">{(f.sku||"DN-NEW")}-{s}</td>
                        <td className="text-right"><input type="number" className="dina-input tabular w-24 text-right !py-1" value={f.stock_by_size?.[s]||0} onChange={e=>upd("stock_by_size", {...f.stock_by_size, [s]: +e.target.value||0})} data-testid={`pfv-stock-${s}`}/></td>
                        <td className="text-right tabular text-[#666]">{f.alert_threshold}</td>
                        <td className="text-right tabular text-[#666]">{fcfa((f.stock_by_size?.[s]||0)*(f.cost||0))}</td></tr>
                    ))}
                    <tr className="font-semibold bg-[#fafafa] dark:bg-[#141414]"><td>Total</td><td/><td className="text-right tabular">{totalStock}</td><td/><td className="text-right tabular">{fcfa(totalStock*(f.cost||0))}</td></tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* 5b. Grille réelle taille × couleur */}
            <div className="mt-5 pt-4 border-t border-[#ececec] dark:border-[#2a2a2a]">
              <div className="text-xs font-semibold uppercase text-[#666] mb-2">Combinaisons réelles taille × couleur</div>
              <p className="text-[11px] text-[#999] mb-2 italic">Seules les combinaisons activées sont affichées en vitrine et dans la caisse. Si vous n'avez pas de pointure 43 en Rouge, désactivez cette cellule.</p>
              <VariantsGrid sizes={f.sizes||[]} colors={f.colors||[]} variants={f.variants||[]} onChange={vs => upd("variants", vs)}/>
            </div>
          </Section>

          {/* 6. Stock */}
          <Section title="6. Stock" icon={Package}>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] text-[#999] uppercase font-semibold">Seuil d'alerte</label><input type="number" className="dina-input tabular" value={f.alert_threshold||3} onChange={e=>upd("alert_threshold",+e.target.value||0)} data-testid="pfv-alert"/></div>
              <div><label className="text-[10px] text-[#999] uppercase font-semibold">Emplacement</label><input className="dina-input" placeholder="Ex. Rayon A - Étagère 3" value={f.location||""} onChange={e=>upd("location",e.target.value)}/></div>
            </div>
          </Section>

          {/* 7. Visibilité */}
          <Section title="7. Visibilité" icon={Eye}>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-[#999] uppercase font-semibold">Statut</label>
                <select className="dina-input mt-1" value={f.status} onChange={e=>upd("status",e.target.value)} data-testid="pfv-status">
                  {STATUS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[#999] uppercase font-semibold">Visibilité canaux</label>
                <select className="dina-input mt-1" value={f.visibility} onChange={e=>upd("visibility",e.target.value)} data-testid="pfv-visibility">
                  <option value="both">Caisse + Site</option>
                  <option value="store">Caisse uniquement</option>
                  <option value="online">Site uniquement</option>
                </select>
              </div>
            </div>
            <div className="flex gap-4 mt-3 text-sm">
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={f.featured||false} onChange={e=>upd("featured",e.target.checked)} className="accent-[#b02a2a]" data-testid="pfv-featured"/>Mis en avant</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={f.is_new||false} onChange={e=>upd("is_new",e.target.checked)} className="accent-[#b02a2a]" data-testid="pfv-new"/>Nouveauté</label>
            </div>
          </Section>

          {/* 8. SEO */}
          <Section title="8. SEO" icon={Globe} collapsed>
            <SeoSection f={f} upd={upd}/>
          </Section>
        </div>

        {/* Live preview */}
        <aside className="hidden lg:block sticky top-5 self-start">
          <div className="dina-card-white overflow-hidden">
            <div className="text-[10px] uppercase font-semibold text-[#666] p-3 border-b border-[#ececec] dark:border-[#2a2a2a]">Aperçu vitrine</div>
            <div className="aspect-square bg-[#fff5f5] relative">
              {f.image || f.images?.[0] ? <img src={f.image || f.images[0]} alt="" className="w-full h-full object-cover"/> : <div className="w-full h-full grid place-items-center text-[#ccc]"><ImageIcon size={32}/></div>}
              {previewPrice>0 && <span className="absolute top-2 right-2 bg-[#b02a2a] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">-{previewPrice}%</span>}
            </div>
            <div className="p-3">
              <div className="text-[10px] text-[#999] uppercase font-semibold">{f.brand || "Marque"}</div>
              <div className="text-sm font-medium leading-tight">{f.name || "Nom du produit"}</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="tabular font-bold text-[#b02a2a]">{fcfa(f.price||0)}</span>
                {f.price_old > f.price && <span className="text-[10px] text-[#999] line-through tabular">{fcfa(f.price_old)}</span>}
              </div>
              <div className="text-[10px] text-[#999] mt-1">{(f.sizes||[]).length} tailles · {(f.colors||[]).length} couleurs · Stock {totalStock}</div>
            </div>
          </div>
        </aside>
      </div>
      {aiOpen && <AiDescribeModal product={f} onInsert={(t)=>upd("description", t)} onClose={()=>setAiOpen(false)}/>}
    </div>
  );
}

function Section({ title, icon: Icon, highlight, collapsed, action, children }) {
  const [open, setOpen] = useState(!collapsed);
  return (
    <div className={`dina-card-white p-5 ${highlight?"ring-1 ring-[#fde8e8] dark:ring-[#2a1818]":""}`}>
      <div className="flex items-center justify-between mb-3">
        <button onClick={()=>setOpen(!open)} className="flex items-center gap-2 text-sm font-semibold">
          <div className="w-7 h-7 rounded-lg bg-[#fff5f5] dark:bg-[#2a1818] text-[#b02a2a] grid place-items-center"><Icon size={13}/></div>
          <span>{title}</span>
        </button>
        {action}
      </div>
      {open && <div>{children}</div>}
    </div>
  );
}
