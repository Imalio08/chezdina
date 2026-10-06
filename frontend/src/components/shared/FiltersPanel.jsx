import React, { useState } from "react";
import { Filter, X, Bookmark, Trash2 } from "lucide-react";

export default function FiltersPanel({ fields = [], value = {}, onChange, tabKey }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [showSaved, setShowSaved] = useState(false);
  const [savedViews, setSavedViews] = useState(() => JSON.parse(localStorage.getItem(`dina_views_${tabKey}`) || "[]"));
  const activeCount = Object.values(value).filter(v => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length)).length;

  const apply = () => { onChange?.(draft); setOpen(false); };
  const clear = () => { setDraft({}); onChange?.({}); };
  const removeChip = (k) => { const next = { ...value }; delete next[k]; onChange?.(next); };
  const saveView = () => {
    const name = prompt("Nom de la vue ?");
    if (!name) return;
    const next = [...savedViews, { name, filters: value, saved_at: new Date().toISOString() }];
    setSavedViews(next);
    localStorage.setItem(`dina_views_${tabKey}`, JSON.stringify(next));
  };
  const loadView = (v) => { onChange?.(v.filters); setDraft(v.filters); setShowSaved(false); };
  const delView = (idx) => {
    const next = savedViews.filter((_,i)=>i!==idx);
    setSavedViews(next);
    localStorage.setItem(`dina_views_${tabKey}`, JSON.stringify(next));
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={()=>{setDraft(value); setOpen(true);}} className="dina-chip !py-2 !px-3 relative" data-testid="filters-open">
          <Filter size={12}/>Filtres{activeCount>0 && <span className="bg-[#b02a2a] text-white rounded-full min-w-[16px] h-4 px-1 text-[10px] grid place-items-center">{activeCount}</span>}
        </button>
        {tabKey && (
          <div className="relative">
            <button onClick={()=>setShowSaved(!showSaved)} className="dina-chip !py-2 !px-3" data-testid="views-saved"><Bookmark size={12}/>Vues</button>
            {showSaved && (
              <div className="absolute top-11 left-0 bg-white dark:bg-[#1a1a1a] border border-[#ececec] dark:border-[#2a2a2a] rounded-xl shadow-xl p-2 z-40 w-64">
                <div className="text-[10px] uppercase text-[#999] px-2 py-1">Vues enregistrées</div>
                {savedViews.length === 0 ? <div className="text-xs text-[#666] p-2">Aucune vue</div> : savedViews.map((v,i)=>(
                  <div key={i} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[#fff5f5] dark:hover:bg-[#2a1818]">
                    <button onClick={()=>loadView(v)} className="flex-1 text-left text-sm">{v.name}</button>
                    <button onClick={()=>delView(i)} className="text-[#c62828]"><Trash2 size={11}/></button>
                  </div>
                ))}
                <button onClick={saveView} className="w-full text-left text-xs text-[#b02a2a] px-2 py-1.5 hover:underline">+ Enregistrer la vue actuelle</button>
              </div>
            )}
          </div>
        )}
        {Object.entries(value).filter(([,v])=>v!==undefined && v!=="" && !(Array.isArray(v) && !v.length)).map(([k,v])=>{
          const f = fields.find(x=>x.key===k);
          return <span key={k} className="dina-chip !py-1 !px-2 text-[11px]" data-testid={`chip-${k}`}>{f?.label||k}: <b>{Array.isArray(v)?v.join(", "):String(v)}</b><button onClick={()=>removeChip(k)} className="ml-1 text-[#999] hover:text-[#c62828]"><X size={10}/></button></span>;
        })}
        {activeCount>0 && <button onClick={clear} className="text-xs text-[#b02a2a] hover:underline" data-testid="filters-clear">Tout effacer</button>}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={()=>setOpen(false)}>
          <div className="bg-white dark:bg-[#1a1a1a] w-full max-w-md h-full overflow-y-auto p-5" onClick={e=>e.stopPropagation()} data-testid="filters-panel">
            <div className="flex items-center justify-between mb-5">
              <div className="font-serif text-xl">Filtres</div>
              <button onClick={()=>setOpen(false)}><X size={18}/></button>
            </div>
            <div className="space-y-4">
              {fields.map(f=>(
                <div key={f.key}>
                  <label className="text-xs uppercase text-[#666] font-semibold">{f.label}</label>
                  {f.type==="select" && (
                    <select className="dina-input mt-1" value={draft[f.key]||""} onChange={e=>setDraft({...draft,[f.key]:e.target.value||undefined})} data-testid={`filter-${f.key}`}>
                      <option value="">— Tous —</option>
                      {f.options.map(o=><option key={o.value||o} value={o.value||o}>{o.label||o}</option>)}
                    </select>
                  )}
                  {f.type==="text" && <input className="dina-input mt-1" value={draft[f.key]||""} onChange={e=>setDraft({...draft,[f.key]:e.target.value||undefined})} placeholder={f.placeholder} data-testid={`filter-${f.key}`}/>}
                  {f.type==="number" && <input type="number" className="dina-input mt-1" value={draft[f.key]||""} onChange={e=>setDraft({...draft,[f.key]:e.target.value?+e.target.value:undefined})} placeholder={f.placeholder} data-testid={`filter-${f.key}`}/>}
                  {f.type==="range" && (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <input type="number" className="dina-input" placeholder="Min" value={draft[f.key+"_min"]||""} onChange={e=>setDraft({...draft,[f.key+"_min"]:e.target.value?+e.target.value:undefined})}/>
                      <input type="number" className="dina-input" placeholder="Max" value={draft[f.key+"_max"]||""} onChange={e=>setDraft({...draft,[f.key+"_max"]:e.target.value?+e.target.value:undefined})}/>
                    </div>
                  )}
                  {f.type==="multi" && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {f.options.map(o=>{
                        const v = o.value||o; const label = o.label||o;
                        const list = draft[f.key]||[]; const on = list.includes(v);
                        return <button key={v} onClick={()=>setDraft({...draft,[f.key]: on ? list.filter(x=>x!==v) : [...list,v]})} className={`px-2.5 py-1 rounded-full text-xs border ${on?"bg-[#b02a2a] text-white border-[#b02a2a]":"border-[#ececec] dark:border-[#2a2a2a]"}`} data-testid={`filter-${f.key}-${v}`}>{label}</button>;
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-6 sticky bottom-0 bg-white dark:bg-[#1a1a1a] py-3">
              <button onClick={clear} className="dina-btn-secondary flex-1">Annuler</button>
              <button onClick={apply} className="dina-btn-primary flex-1" data-testid="filters-apply">Appliquer</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
