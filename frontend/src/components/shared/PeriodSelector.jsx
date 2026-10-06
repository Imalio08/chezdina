import React, { useState, useRef, useEffect } from "react";
import { Calendar, ChevronDown, X } from "lucide-react";

export const PRESETS = [
  { k: "today", label: "Aujourd'hui" },
  { k: "yesterday", label: "Hier" },
  { k: "this_week", label: "Cette semaine" },
  { k: "last_week", label: "Semaine dernière" },
  { k: "last7", label: "7 derniers jours" },
  { k: "last30", label: "30 derniers jours" },
  { k: "this_month", label: "Ce mois" },
  { k: "last_month", label: "Mois dernier" },
  { k: "this_quarter", label: "Ce trimestre" },
  { k: "last_quarter", label: "Trimestre dernier" },
  { k: "this_year", label: "Cette année" },
  { k: "last_year", label: "Année dernière" },
  { k: "all", label: "Depuis le début" },
  { k: "custom", label: "Période personnalisée…" },
];

export const COMPARISONS = [
  { k: "prev", label: "Période précédente" },
  { k: "year_ago", label: "Même période l'an dernier" },
  { k: "none", label: "Aucune comparaison" },
];

export function resolvePeriod(preset, customFrom, customTo) {
  const now = new Date();
  const d = (x) => new Date(x.setHours(0,0,0,0));
  const endOfDay = (x) => new Date(x.setHours(23,59,59,999));
  let from, to = endOfDay(new Date(now));
  switch (preset) {
    case "today": from = d(new Date(now)); break;
    case "yesterday": { const y = new Date(now); y.setDate(y.getDate()-1); from = d(new Date(y)); to = endOfDay(new Date(y)); break; }
    case "this_week": { const s = new Date(now); const day = (s.getDay()+6)%7; s.setDate(s.getDate()-day); from = d(s); break; }
    case "last_week": { const s = new Date(now); const day = (s.getDay()+6)%7; s.setDate(s.getDate()-day-7); from = d(new Date(s)); const e = new Date(s); e.setDate(e.getDate()+6); to = endOfDay(e); break; }
    case "last7": { const s = new Date(now); s.setDate(s.getDate()-6); from = d(s); break; }
    case "last30": { const s = new Date(now); s.setDate(s.getDate()-29); from = d(s); break; }
    case "this_month": from = d(new Date(now.getFullYear(), now.getMonth(), 1)); break;
    case "last_month": { const s = new Date(now.getFullYear(), now.getMonth()-1, 1); from = d(s); to = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)); break; }
    case "this_quarter": { const q = Math.floor(now.getMonth()/3); from = d(new Date(now.getFullYear(), q*3, 1)); break; }
    case "last_quarter": { const q = Math.floor(now.getMonth()/3)-1; const yr = q<0?now.getFullYear()-1:now.getFullYear(); const qq = (q+4)%4; from = d(new Date(yr, qq*3, 1)); to = endOfDay(new Date(yr, qq*3+3, 0)); break; }
    case "this_year": from = d(new Date(now.getFullYear(), 0, 1)); break;
    case "last_year": { from = d(new Date(now.getFullYear()-1, 0, 1)); to = endOfDay(new Date(now.getFullYear()-1, 11, 31)); break; }
    case "all": from = new Date(2000,0,1); break;
    case "custom": from = customFrom ? new Date(customFrom) : d(new Date(now)); to = customTo ? endOfDay(new Date(customTo)) : to; break;
    default: from = d(new Date(now));
  }
  return { from, to };
}

export function previousPeriod(from, to, mode = "prev") {
  const span = to - from;
  if (mode === "year_ago") {
    const pf = new Date(from); pf.setFullYear(pf.getFullYear()-1);
    const pt = new Date(to); pt.setFullYear(pt.getFullYear()-1);
    return { from: pf, to: pt };
  }
  return { from: new Date(from.getTime() - span - 1), to: new Date(from.getTime() - 1) };
}

export default function PeriodSelector({ value = "last30", onChange, comparison = "prev", onComparisonChange, customFrom, customTo, onCustomChange }) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(value === "custom");
  const ref = useRef(null);
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  const current = PRESETS.find(p => p.k === value) || PRESETS[5];

  const pick = (k) => {
    if (k === "custom") { setShowCustom(true); onChange?.(k); return; }
    setShowCustom(false); onChange?.(k); setOpen(false);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div ref={ref} className="relative">
        <button onClick={() => setOpen(!open)} className="dina-chip !py-2 !px-3" data-testid="period-selector">
          <Calendar size={13}/>{current.label}<ChevronDown size={12}/>
        </button>
        {open && (
          <div className="absolute top-11 left-0 bg-white dark:bg-[#1a1a1a] border border-[#ececec] dark:border-[#2a2a2a] rounded-xl shadow-xl p-2 z-40 w-64 max-h-[70vh] overflow-y-auto scrollbar-thin" data-testid="period-menu">
            {PRESETS.map(p => (
              <button key={p.k} onClick={() => pick(p.k)} className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-[#fff5f5] dark:hover:bg-[#2a1818] ${value===p.k?"bg-[#fff5f5] dark:bg-[#2a1818] font-semibold":""}`} data-testid={`period-${p.k}`}>{p.label}</button>
            ))}
            {showCustom && (
              <div className="p-2 border-t border-[#ececec] dark:border-[#2a2a2a] mt-2 space-y-2">
                <div><label className="text-[10px] text-[#999] uppercase">Du</label><input type="date" className="dina-input" value={customFrom||""} onChange={e=>onCustomChange?.({ from: e.target.value, to: customTo })} data-testid="period-from"/></div>
                <div><label className="text-[10px] text-[#999] uppercase">Au</label><input type="date" className="dina-input" value={customTo||""} onChange={e=>onCustomChange?.({ from: customFrom, to: e.target.value })} data-testid="period-to"/></div>
                <button onClick={()=>setOpen(false)} className="dina-btn-primary w-full !min-h-[36px] text-sm">Appliquer</button>
              </div>
            )}
          </div>
        )}
      </div>
      <select value={comparison} onChange={e=>onComparisonChange?.(e.target.value)} className="dina-chip !py-2 !px-3 !cursor-pointer" data-testid="comparison-selector">
        {COMPARISONS.map(c=><option key={c.k} value={c.k}>vs {c.label}</option>)}
      </select>
    </div>
  );
}
