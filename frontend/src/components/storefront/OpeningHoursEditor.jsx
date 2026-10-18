import React from "react";
import { Clock, Copy } from "lucide-react";

const DAYS = [
  { k: "mon", label: "Lundi" },
  { k: "tue", label: "Mardi" },
  { k: "wed", label: "Mercredi" },
  { k: "thu", label: "Jeudi" },
  { k: "fri", label: "Vendredi" },
  { k: "sat", label: "Samedi" },
  { k: "sun", label: "Dimanche" },
];

/**
 * Visual opening hours editor. Value shape:
 * { mon:{open:"09:00",close:"18:30"}, ..., sun:{closed:true} }
 */
export default function OpeningHoursEditor({ value = {}, onChange }) {
  const get = (k) => value[k] || { open: "", close: "", closed: false };
  const set = (k, patch) => onChange({ ...value, [k]: { ...get(k), ...patch } });
  const copyFromAbove = (k, idx) => {
    if (idx === 0) return;
    const src = DAYS[idx - 1].k;
    onChange({ ...value, [k]: { ...(value[src] || {}) } });
  };
  const applyToAllWeekdays = () => {
    const src = get("mon");
    const next = { ...value };
    ["tue","wed","thu","fri"].forEach(k => { next[k] = { ...src }; });
    onChange(next);
  };

  return (
    <div className="space-y-2" data-testid="hours-editor">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-[#666] flex items-center gap-1"><Clock size={12}/>Horaires d'ouverture (laissez vide pour "sur demande")</div>
        <button type="button" onClick={applyToAllWeekdays} className="text-[11px] text-[#5867fd] hover:underline" data-testid="hours-apply-weekdays">Appliquer lundi à toute la semaine</button>
      </div>
      <div className="divide-y divide-[#ececec] dark:divide-[#2a2a2a] rounded-lg border border-[#ececec] dark:border-[#2a2a2a]">
        {DAYS.map((d, idx) => {
          const row = get(d.k);
          return (
            <div key={d.k} className="grid grid-cols-[90px_1fr_auto_auto_auto] gap-2 items-center px-3 py-2 bg-white dark:bg-[#1a1a1a]" data-testid={`hours-row-${d.k}`}>
              <div className="text-sm font-medium">{d.label}</div>
              {row.closed ? (
                <div className="text-xs text-[#c62828] italic">Fermé</div>
              ) : (
                <div className="flex items-center gap-1.5 text-sm">
                  <input type="time" className="dina-input !py-1 tabular text-sm" value={row.open || ""} onChange={e => set(d.k, { open: e.target.value, closed: false })} data-testid={`hours-open-${d.k}`}/>
                  <span className="text-[#999]">–</span>
                  <input type="time" className="dina-input !py-1 tabular text-sm" value={row.close || ""} onChange={e => set(d.k, { close: e.target.value, closed: false })} data-testid={`hours-close-${d.k}`}/>
                </div>
              )}
              <label className="flex items-center gap-1 text-[11px] text-[#666] cursor-pointer">
                <input type="checkbox" checked={!!row.closed} onChange={e => set(d.k, { closed: e.target.checked })} className="accent-[#b02a2a]" data-testid={`hours-closed-${d.k}`}/>
                Fermé
              </label>
              <button type="button" onClick={() => copyFromAbove(d.k, idx)} disabled={idx === 0} className="text-[11px] text-[#5867fd] disabled:text-[#ccc]" data-testid={`hours-copy-${d.k}`} title="Copier depuis le jour au-dessus"><Copy size={12}/></button>
              <div className="text-[10px] text-[#999] w-20 text-right truncate">{row.closed ? "—" : (row.open && row.close ? `${row.close < row.open ? "+1 jour" : ""}` : "non défini")}</div>
            </div>
          );
        })}
      </div>
      <div className="text-[11px] text-[#999] italic">En dehors de ces horaires, le site affiche « Boutique fermée ».</div>
    </div>
  );
}
