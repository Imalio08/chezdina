import React, { useState } from "react";
import { X, Filter, SlidersHorizontal, Ruler } from "lucide-react";

/** Mobile-first bottom-sheet filters for Catalog. Pointure/couleur/talon/prix + size guide. */
export default function FiltersSheet({ open, onClose, value, onChange, categories = [], brands = [] }) {
  const [draft, setDraft] = useState(value || {});
  const [showGuide, setShowGuide] = useState(false);
  if (!open) return null;

  const apply = () => { onChange?.(draft); onClose(); };
  const clear = () => { setDraft({}); onChange?.({}); };
  const toggle = (k, v) => {
    const cur = draft[k] || [];
    setDraft({...draft, [k]: cur.includes(v) ? cur.filter(x=>x!==v) : [...cur, v]});
  };
  const activeCount = Object.values(draft).filter(v => Array.isArray(v) ? v.length>0 : (v !== undefined && v !== "" && v !== null)).length;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-end sm:place-items-center" onClick={onClose} data-testid="filters-sheet">
      <div className="bg-white dark:bg-[#1a1a1a] w-full sm:max-w-md max-h-[92vh] rounded-t-2xl sm:rounded-2xl overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-[#1a1a1a] flex items-center justify-between p-4 border-b border-[#ececec] dark:border-[#2a2a2a] z-10">
          <div className="flex items-center gap-2"><SlidersHorizontal size={16}/><div className="font-serif text-lg">Filtres</div>{activeCount>0 && <span className="bg-[#b02a2a] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{activeCount}</span>}</div>
          <button onClick={onClose}><X size={18}/></button>
        </div>

        <div className="p-4 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2"><label className="text-[10px] uppercase text-[#666] font-semibold">Pointure / Taille</label><button onClick={()=>setShowGuide(!showGuide)} className="text-xs text-[#b02a2a] hover:underline flex items-center gap-1" data-testid="size-guide-toggle"><Ruler size={11}/>Guide</button></div>
            {showGuide && (
              <div className="text-xs text-[#666] bg-[#fff5f5] dark:bg-[#2a1818] rounded-lg p-3 mb-2" data-testid="size-guide">
                <div className="font-semibold mb-1 text-[#1c1c1c] dark:text-white">Guide des tailles</div>
                <div className="grid grid-cols-2 gap-1 tabular text-[11px]">
                  <div><b>Pointures FR</b></div><div><b>EU</b></div>
                  <div>36</div><div>36 (23 cm)</div>
                  <div>38</div><div>38 (24 cm)</div>
                  <div>40</div><div>40 (25,5 cm)</div>
                  <div className="mt-1"><b>Taille vêtement</b></div><div className="mt-1"><b>FR</b></div>
                  <div>S</div><div>36-38</div>
                  <div>M</div><div>38-40</div>
                  <div>L</div><div>40-42</div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-6 gap-1.5">
              {["36","37","38","39","40","41","XS","S","M","L","XL","XXL"].map(s=>{
                const on = (draft.size||[]).includes(s);
                return <button key={s} onClick={()=>toggle("size",s)} className={`py-2 rounded-lg border text-sm ${on?"bg-[#b02a2a] text-white border-[#b02a2a]":"border-[#ececec] dark:border-[#2a2a2a]"}`} data-testid={`fs-size-${s}`}>{s}</button>;
              })}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase text-[#666] font-semibold">Couleur</label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {["Noir","Blanc","Rouge","Beige","Doré","Marine","Rose poudré","Camel","Nude","Vert émeraude"].map(c=>{
                const on = (draft.color||[]).includes(c);
                return <button key={c} onClick={()=>toggle("color",c)} className={`px-3 py-1.5 rounded-full border text-xs ${on?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec] dark:border-[#2a2a2a]"}`} data-testid={`fs-color-${c}`}>{c}</button>;
              })}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase text-[#666] font-semibold">Type de talon</label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {["Plat","Petit talon","Talon haut","Compensé","Mule","Sandale"].map(h=>{
                const on = (draft.heel||[]).includes(h);
                return <button key={h} onClick={()=>toggle("heel",h)} className={`px-3 py-1.5 rounded-full border text-xs ${on?"bg-[#b02a2a] text-white border-[#b02a2a]":"border-[#ececec] dark:border-[#2a2a2a]"}`} data-testid={`fs-heel-${h}`}>{h}</button>;
              })}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase text-[#666] font-semibold">Prix (FCFA)</label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <input type="number" className="dina-input tabular" placeholder="Min" value={draft.price_min||""} onChange={e=>setDraft({...draft, price_min: e.target.value?+e.target.value:undefined})} data-testid="fs-price-min"/>
              <input type="number" className="dina-input tabular" placeholder="Max" value={draft.price_max||""} onChange={e=>setDraft({...draft, price_max: e.target.value?+e.target.value:undefined})} data-testid="fs-price-max"/>
            </div>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {[5000,10000,20000,50000].map(v=><button key={v} onClick={()=>setDraft({...draft,price_max:v})} className="dina-chip text-[11px]">&lt; {v.toLocaleString("fr-FR")}</button>)}
            </div>
          </div>

          {brands.length > 0 && (
            <div>
              <label className="text-[10px] uppercase text-[#666] font-semibold">Marque</label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {brands.slice(0,12).map(b=>{
                  const on = (draft.brand||[]).includes(b.name);
                  return <button key={b.name} onClick={()=>toggle("brand",b.name)} className={`px-3 py-1.5 rounded-full border text-xs ${on?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec] dark:border-[#2a2a2a]"}`} data-testid={`fs-brand-${b.name}`}>{b.name}</button>;
                })}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-[#1a1a1a] border-t border-[#ececec] dark:border-[#2a2a2a] p-3 flex gap-2">
          <button onClick={clear} className="dina-btn-secondary flex-1" data-testid="fs-clear">Effacer</button>
          <button onClick={apply} className="dina-btn-primary flex-1" data-testid="fs-apply">Voir les résultats</button>
        </div>
      </div>
    </div>
  );
}
