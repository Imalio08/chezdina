import React, { useEffect, useMemo, useRef, useState } from "react";
import { reveal } from "@/lib/reveal";
import { Link, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { SlidersHorizontal, X, Search as SearchIcon, Send } from "lucide-react";
import { track } from "@/lib/analytics";
import { toast } from "sonner";
import FiltersSheet from "@/components/storefront/FiltersSheet";
import ProductCardV2 from "@/components/storefront/ProductCardV2";

export default function Catalog() {
  const [sp, setSp] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [q, setQ] = useState(sp.get("q") || "");
  const [sort, setSort] = useState("new");
  const [filters, setFilters] = useState({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [oocPhone, setOocPhone] = useState("");
  const [oocSent, setOocSent] = useState(false);
  const [oocSending, setOocSending] = useState(false);
  const cat = sp.get("category") || "all";
  const gridRef = useRef(null);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (gridRef.current) reveal(gridRef.current, { flash: false, block: "start" });
  }, [filters, sort]);

  useEffect(() => { setQ(sp.get("q") || ""); setOocSent(false); }, [sp]);
  useEffect(() => {
    track("page_view", { page_type: "catalog", category: cat, q: sp.get("q") || "" });
    api.get(`/public/products?category=${cat}`).then(r => setProducts(r.data));
    api.get("/brands").then(r => setBrands(r.data || [])).catch(() => {});
  }, [cat]); // eslint-disable-line

  const cats = useMemo(() => ["all", ...Array.from(new Set(products.map(p => p.category)))], [products]);

  const filtered = useMemo(() => {
    const nq = q.trim().toLowerCase();
    let list = products.filter(p => {
      if (nq && !(p.name?.toLowerCase().includes(nq) || p.brand?.toLowerCase().includes(nq))) return false;
      if ((filters.size || []).length && !((filters.size||[]).some(s => (p.sizes||[]).includes(s)))) return false;
      if ((filters.color || []).length && !((filters.color||[]).some(c => (p.colors||[]).includes(c)))) return false;
      if ((filters.brand || []).length && !((filters.brand||[]).includes(p.brand))) return false;
      if (filters.price_min && p.price < filters.price_min) return false;
      if (filters.price_max && p.price > filters.price_max) return false;
      if ((filters.heel||[]).length && !((filters.heel||[]).some(h => (p.heel_type||"").toLowerCase().includes(h.toLowerCase())))) return false;
      return true;
    });
    if (sort === "price_asc") list.sort((a,b)=>a.price-b.price);
    else if (sort === "price_desc") list.sort((a,b)=>b.price-a.price);
    else if (sort === "rating") list.sort((a,b)=>(b.rating_avg||0)-(a.rating_avg||0));
    else list.sort((a,b)=>(b.created_at||"").localeCompare(a.created_at||""));
    return list;
  }, [products, q, filters, sort]);

  const activeCount = Object.values(filters).filter(v => Array.isArray(v) ? v.length>0 : (v !== undefined && v !== "" && v !== null)).length;
  const removeChip = (k, v) => {
    if (Array.isArray(filters[k])) setFilters({...filters, [k]: filters[k].filter(x=>x!==v)});
    else { const n={...filters}; delete n[k]; setFilters(n); }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="font-serif text-3xl mb-4">Catalogue</h1>

      <div className="flex gap-2 mb-3 items-center flex-wrap">
        <input className="dina-input max-w-xs flex-1" placeholder="Rechercher…" value={q} onChange={e=>setQ(e.target.value)} data-testid="catalog-search"/>
        <select className="dina-input max-w-[180px]" value={sort} onChange={e=>setSort(e.target.value)} data-testid="catalog-sort">
          <option value="new">Nouveautés</option>
          <option value="price_asc">Prix croissant</option>
          <option value="price_desc">Prix décroissant</option>
          <option value="rating">Meilleures notes</option>
        </select>
        <button onClick={()=>setSheetOpen(true)} className="dina-btn-secondary !min-h-[40px] text-sm relative" data-testid="catalog-filters-open">
          <SlidersHorizontal size={14}/>Filtres{activeCount>0 && <span className="bg-[#b02a2a] text-white rounded-full min-w-[18px] h-[18px] px-1 text-[10px] grid place-items-center ml-1">{activeCount}</span>}
        </button>
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        {cats.map(c => <button key={c} onClick={()=>setSp(c==="all"?{}:{category:c})} className={`dina-chip ${cat===c?"!bg-[#1c1c1c] !text-white":""}`} data-testid={`catalog-cat-${c}`}>{c==="all"?"Tout":c}</button>)}
      </div>

      {activeCount > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-3">
          {Object.entries(filters).flatMap(([k,v]) => Array.isArray(v) ? v.map(x=>({k,x})) : [{k,x:v}]).map(({k,x},i)=>(
            <span key={i} className="dina-chip !py-1 text-[11px]" data-testid={`chip-${k}-${x}`}>{k}: <b>{String(x)}</b><button onClick={()=>removeChip(k,x)} className="ml-1 text-[#999] hover:text-[#c62828]"><X size={10}/></button></span>
          ))}
        </div>
      )}

      <div className="text-xs text-[#666] mb-3">{filtered.length} produit{filtered.length>1?"s":""}</div>
      <div ref={gridRef} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 scroll-mt-24" data-testid="catalog-grid">
        {filtered.map(p => <ProductCardV2 key={p.id} product={p}/>)}
      </div>

      {filtered.length === 0 && q.trim().length >= 2 && (
        <div className="mt-6 border-2 border-dashed border-[#ececec] dark:border-[#2a2a2a] rounded-xl p-6 text-center bg-[#fafafa] dark:bg-[#141414]" data-testid="catalog-no-results">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#fff5f5] grid place-items-center text-[#b02a2a] mb-3"><SearchIcon size={22}/></div>
          <div className="font-serif text-xl mb-1">« {q} » n'est pas dans notre catalogue</div>
          <div className="text-sm text-[#666] mb-4">Dites-nous ce que vous cherchez : si beaucoup de clientes le demandent, nous le proposerons bientôt.</div>
          {oocSent ? (
            <div className="text-sm text-[#1f8a4c] font-semibold">✓ Merci, votre demande a été transmise à l'équipe Chez Dina !</div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
              <input className="dina-input flex-1" placeholder="Votre numéro (facultatif pour être prévenue)" value={oocPhone} onChange={e=>setOocPhone(e.target.value)} data-testid="catalog-ooc-phone"/>
              <button disabled={oocSending} onClick={async () => {
                setOocSending(true);
                try {
                  await api.post("/public/out-of-catalog", { keyword: q.trim(), customer_phone: oocPhone || null, channel: "search" });
                  setOocSent(true); toast.success("Demande envoyée");
                } catch { toast.error("Erreur, réessayez"); } finally { setOocSending(false); }
              }} className="dina-btn-primary" data-testid="catalog-ooc-send"><Send size={14}/>{oocSending ? "Envoi…" : "Envoyer ma demande"}</button>
            </div>
          )}
        </div>
      )}

      <FiltersSheet open={sheetOpen} onClose={()=>setSheetOpen(false)} value={filters} onChange={setFilters} brands={brands}/>
    </div>
  );
}
