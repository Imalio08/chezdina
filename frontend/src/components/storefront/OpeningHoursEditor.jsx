import React, { useState } from "react";
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
      <ExceptionsEditor value={value.exceptions || []} onChange={ex => onChange({ ...value, exceptions: ex })}/>
    </div>
  );
}

// Exceptional closures or special hours for given dates, with an optional storefront message
function ExceptionsEditor({ value, onChange }) {
  const [d, setD] = useState({ dates: "", closed: true, open: "", close: "", reason: "", show_message: true, message: "" });
  const [pick, setPick] = useState("");
  const dates = d.dates ? d.dates.split(",") : [];
  const add = () => {
    if (!dates.length) return;
    const rows = dates.map(date => ({ date, closed: d.closed, open: d.closed ? "" : d.open, close: d.closed ? "" : d.close, reason: d.reason, show_message: d.show_message, message: d.message || (d.closed ? `Boutique exceptionnellement fermée${d.reason ? ` · ${d.reason}` : ""}` : `Horaires exceptionnels : ${d.open}–${d.close}`) }));
    onChange([...value.filter(v => !dates.includes(v.date)), ...rows].sort((a, b) => a.date.localeCompare(b.date)));
    setD({ ...d, dates: "", reason: "", message: "" });
  };
  const fmt = (x) => new Date(`${x}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" });
  return (
    <div className="mt-3 rounded-lg border border-[#ececec] dark:border-[#2a2a2a] p-3 space-y-2" data-testid="hours-exceptions">
      <div className="text-sm font-semibold">Fermetures et horaires exceptionnels</div>
      <div className="flex gap-2 flex-wrap items-center">
        <input type="date" className="dina-input !w-auto" value={pick} onChange={e => setPick(e.target.value)} data-testid="exc-date"/>
        <button type="button" onClick={() => { if (pick && !dates.includes(pick)) setD({ ...d, dates: [...dates, pick].join(",") }); setPick(""); }} className="dina-btn-secondary !min-h-[36px] text-xs" data-testid="exc-add-date">Ajouter la date</button>
        {dates.map(x => <span key={x} className="dina-chip text-[11px]">{fmt(x)}<button type="button" onClick={() => setD({ ...d, dates: dates.filter(y => y !== x).join(",") })} className="ml-1">×</button></span>)}
      </div>
      <div className="flex gap-2 text-xs">
        <button type="button" onClick={() => setD({ ...d, closed: true })} className={`px-3 py-1 rounded-full border ${d.closed ? "bg-[#b02a2a] text-white border-[#b02a2a]" : ""}`} data-testid="exc-closed">Fermée</button>
        <button type="button" onClick={() => setD({ ...d, closed: false })} className={`px-3 py-1 rounded-full border ${!d.closed ? "bg-[#b02a2a] text-white border-[#b02a2a]" : ""}`} data-testid="exc-special">Ouverte avec d'autres horaires</button>
      </div>
      {!d.closed && <div className="flex gap-2 items-center"><input type="time" className="dina-input !w-auto" value={d.open} onChange={e => setD({ ...d, open: e.target.value })} data-testid="exc-open"/>–<input type="time" className="dina-input !w-auto" value={d.close} onChange={e => setD({ ...d, close: e.target.value })} data-testid="exc-close"/></div>}
      <input className="dina-input" placeholder="Motif (ex. inventaire, jour férié)" value={d.reason} onChange={e => setD({ ...d, reason: e.target.value })} data-testid="exc-reason"/>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={d.show_message} onChange={e => setD({ ...d, show_message: e.target.checked })} className="accent-[#b02a2a]" data-testid="exc-show"/>Afficher un message sur le site</label>
      {d.show_message && <input className="dina-input" placeholder="Texte du message (ex. Fermé le 25/12 pour Noël)" value={d.message} onChange={e => setD({ ...d, message: e.target.value })} data-testid="exc-message"/>}
      <button type="button" onClick={add} disabled={!dates.length || (!d.closed && (!d.open || !d.close))} className="dina-btn-primary !min-h-[36px] text-xs disabled:opacity-50" data-testid="exc-save">Ajouter</button>
      {value.length > 0 && <div className="divide-y divide-[#f0f0f0] text-xs">{value.map(v => (
        <div key={v.date} className="flex justify-between items-center py-1.5" data-testid={`exc-row-${v.date}`}>
          <span><b>{fmt(v.date)}</b> · {v.closed ? "Fermée" : `${v.open}–${v.close}`}{v.reason ? ` · ${v.reason}` : ""}{v.show_message ? ` · message : « ${v.message} »` : ""}</span>
          <button type="button" onClick={() => onChange(value.filter(x => x.date !== v.date))} className="text-[#c62828]" data-testid={`exc-remove-${v.date}`}>Retirer</button>
        </div>
      ))}</div>}
    </div>
  );
}
