import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { User, X } from "lucide-react";
import { DAYS } from "@/components/shared/WeekGrid";

const DEF = { open: "08:00", close: "19:00", tolerance_min: 10, days: ["mon", "tue", "wed", "thu", "fri", "sat"] };

/** open/close/tolerance + working days. */
export function HoursFields({ h, set, testid }) {
  const days = h.days || DEF.days;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-[#666]">Arrivée<input type="time" className="dina-input" value={h.open || DEF.open} onChange={e => set({ open: e.target.value })} data-testid={`${testid}-open`}/></label>
        <label className="text-xs text-[#666]">Départ<input type="time" className="dina-input" value={h.close || DEF.close} onChange={e => set({ close: e.target.value })} data-testid={`${testid}-close`}/></label>
        <label className="text-xs text-[#666]">Tolérance (min)<input type="number" min="0" max="240" className="dina-input tabular" value={h.tolerance_min ?? 10} onChange={e => set({ tolerance_min: +e.target.value || 0 })} data-testid={`${testid}-tol`}/></label>
      </div>
      <div className="flex flex-wrap gap-1" data-testid={`${testid}-days`}>
        {DAYS.map(d => {
          const on = days.includes(d.k);
          return <button type="button" key={d.k} onClick={() => set({ days: on ? days.filter(x => x !== d.k) : [...days, d.k] })} className={`px-2 py-1 rounded-full text-[11px] border ${on ? "bg-[#1f8a4c] text-white border-[#1f8a4c]" : "border-[#ececec] dark:border-[#2a2a2a] text-[#666]"}`} data-testid={`${testid}-day-${d.k}`}>{d.label.slice(0, 3)}</button>;
        })}
      </div>
    </div>
  );
}

/** Personal hours overriding the role hours, per employee. */
export function EmployeeHours({ employees, roleHours, roleLabel, onSaved }) {
  const [edit, setEdit] = useState(null);
  const save = async (u, wh) => {
    try { await api.patch(`/users/${u.id}/working-hours`, { working_hours: wh }); toast.success(wh ? "Horaires personnels enregistrés" : "Horaires du rôle rétablis"); setEdit(null); onSaved(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
  };
  return (
    <div className="dina-card-white p-5 space-y-3" data-testid="employee-hours">
      <div className="font-serif text-xl">Horaires spécifiques par employé</div>
      <p className="text-xs text-[#666]">Remplacent les horaires du rôle pour cette personne uniquement.</p>
      <div className="divide-y divide-[#f0f0f0] dark:divide-[#2a2a2a]">
        {employees.map(u => {
          const own = u.working_hours;
          const h = own || roleHours[u.role] || DEF;
          return (
            <div key={u.id} className="py-2" data-testid={`emp-hours-${u.id}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <User size={14} className="text-[#999]"/>
                <div className="flex-1 min-w-[140px]"><div className="text-sm font-medium">{u.name}</div><div className="text-[11px] text-[#666]">{roleLabel(u.role)} · {h.open || DEF.open}–{h.close || DEF.close} {own ? <b className="text-[#5867fd]">· personnel</b> : "· horaires du rôle"}</div></div>
                {edit?.id !== u.id && <button onClick={() => setEdit({ id: u.id, h: { ...DEF, ...h } })} className="dina-chip text-xs" data-testid={`emp-hours-edit-${u.id}`}>{own ? "Modifier" : "Définir des horaires"}</button>}
                {own && edit?.id !== u.id && <button onClick={() => save(u, null)} className="text-xs text-[#c62828] underline" data-testid={`emp-hours-reset-${u.id}`}>Revenir au rôle</button>}
              </div>
              {edit?.id === u.id && (
                <div className="mt-2 p-3 rounded-lg bg-[#f7f7f7] dark:bg-[#141414] space-y-2">
                  <HoursFields h={edit.h} set={(p) => setEdit(e => ({ ...e, h: { ...e.h, ...p } }))} testid={`emp-${u.id}`}/>
                  <div className="flex gap-2">
                    <button onClick={() => save(u, edit.h)} className="dina-btn-primary !min-h-[34px] text-xs" data-testid={`emp-hours-save-${u.id}`}>Enregistrer</button>
                    <button onClick={() => setEdit(null)} className="dina-btn-secondary !min-h-[34px] text-xs"><X size={12}/>Annuler</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Loads all roles (incl. created later) + employees for attendance hours. */
export function useHoursConfig() {
  const [cfg, setCfg] = useState({ roles: [], employees: [] });
  const load = () => api.get("/attendance/hours-config").then(r => setCfg(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  return { ...cfg, reload: load };
}
