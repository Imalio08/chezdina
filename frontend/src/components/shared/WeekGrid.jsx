import React from "react";
import { Plus, X, Copy } from "lucide-react";

export const DAYS = [
  { k: "mon", label: "Lundi" }, { k: "tue", label: "Mardi" }, { k: "wed", label: "Mercredi" }, { k: "thu", label: "Jeudi" },
  { k: "fri", label: "Vendredi" }, { k: "sat", label: "Samedi" }, { k: "sun", label: "Dimanche" },
];

/** Normalise a day (legacy {open,close} or {slots}) into {closed, slots:[{start,end}]}. */
export const dayOf = (v) => {
  if (!v) return { closed: true, slots: [] };
  const slots = v.slots?.length ? v.slots : (v.open && v.close ? [{ start: v.open, end: v.close }] : []);
  return { closed: !!v.closed || !slots.length, slots };
};

/** Serialise back, keeping legacy open/close (first start, last end) for existing readers. */
const pack = (d) => ({ closed: d.closed, slots: d.slots, open: d.closed ? "" : d.slots[0]?.start || "", close: d.closed ? "" : d.slots[d.slots.length - 1]?.end || "" });

/** Monday→Sunday grid: open/closed toggle + one or several time ranges per day. */
export default function WeekGrid({ value = {}, onChange, testid = "week", defaultSlot = { start: "09:00", end: "19:00" }, slotLabel }) {
  const set = (k, d) => onChange({ ...value, [k]: pack(d) });
  const toggle = (k) => { const d = dayOf(value[k]); set(k, d.closed ? { closed: false, slots: d.slots.length ? d.slots : [{ ...defaultSlot }] } : { ...d, closed: true }); };
  const upd = (k, i, patch) => { const d = dayOf(value[k]); set(k, { ...d, slots: d.slots.map((s, j) => j === i ? { ...s, ...patch } : s) }); };
  const add = (k) => { const d = dayOf(value[k]); const last = d.slots[d.slots.length - 1]; set(k, { closed: false, slots: [...d.slots, last ? { start: last.end, end: last.end } : { ...defaultSlot }] }); };
  const rm = (k, i) => { const d = dayOf(value[k]); const slots = d.slots.filter((_, j) => j !== i); set(k, { closed: !slots.length, slots }); };
  const copyAll = (k) => { const src = pack(dayOf(value[k])); onChange(Object.fromEntries(DAYS.map(d => [d.k, d.k === "sun" && k !== "sun" ? (value.sun || src) : src]))); };
  return (
    <div className="rounded-lg border border-[#ececec] dark:border-[#2a2a2a] divide-y divide-[#ececec] dark:divide-[#2a2a2a]" data-testid={`${testid}-grid`}>
      {DAYS.map(({ k, label }) => {
        const d = dayOf(value[k]);
        return (
          <div key={k} className="px-3 py-2 flex flex-wrap items-start gap-2" data-testid={`${testid}-row-${k}`}>
            <div className="w-24 shrink-0 pt-1.5 text-sm font-medium">{label}</div>
            <label className="flex items-center gap-1.5 text-xs pt-1.5 cursor-pointer w-20 shrink-0">
              <input type="checkbox" checked={!d.closed} onChange={() => toggle(k)} className="accent-[#1f8a4c] w-4 h-4" data-testid={`${testid}-open-${k}`}/>
              {d.closed ? <span className="text-[#c62828]">Fermé</span> : <span className="text-[#1f8a4c]">Ouvert</span>}
            </label>
            {!d.closed && (
              <div className="flex-1 min-w-[220px] space-y-1.5">
                {d.slots.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5 flex-wrap" data-testid={`${testid}-slot-${k}-${i}`}>
                    {slotLabel && <input className="dina-input !py-1 text-sm !w-32" placeholder="Nom (ex : Matin)" value={s.label || ""} onChange={e => upd(k, i, { label: e.target.value })} data-testid={`${testid}-label-${k}-${i}`}/>}
                    <input type="time" className="dina-input !py-1 tabular text-sm !w-28" value={s.start || ""} onChange={e => upd(k, i, { start: e.target.value })} data-testid={`${testid}-start-${k}-${i}`}/>
                    <span className="text-[#999]">→</span>
                    <input type="time" className="dina-input !py-1 tabular text-sm !w-28" value={s.end || ""} onChange={e => upd(k, i, { end: e.target.value })} data-testid={`${testid}-end-${k}-${i}`}/>
                    {s.start && s.end && s.end <= s.start && <span className="text-[10px] text-[#c62828]">fin avant début</span>}
                    <button type="button" onClick={() => rm(k, i)} className="w-7 h-7 grid place-items-center rounded text-[#999] hover:text-[#c62828]" title="Retirer" data-testid={`${testid}-rm-${k}-${i}`}><X size={14}/></button>
                  </div>
                ))}
                <button type="button" onClick={() => add(k)} className="text-xs text-[#5867fd] inline-flex items-center gap-1 hover:underline" data-testid={`${testid}-add-${k}`}><Plus size={12}/>Ajouter une plage</button>
              </div>
            )}
            <button type="button" onClick={() => copyAll(k)} className="ml-auto text-[11px] text-[#666] inline-flex items-center gap-1 hover:text-[#5867fd] pt-1.5" title="Appliquer ce jour à toute la semaine (sauf dimanche)" data-testid={`${testid}-copy-${k}`}><Copy size={12}/>Copier partout</button>
          </div>
        );
      })}
    </div>
  );
}
