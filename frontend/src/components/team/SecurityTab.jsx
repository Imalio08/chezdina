import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { ShieldCheck, Tablet, Check, Ban, Trash2 } from "lucide-react";
import { dateTimeFmt } from "@/lib/format";
import { useRoles } from "@/lib/useRoles";

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// Équipe › Sécurité: device + hours restrictions, customer-record alert threshold, access log.
export default function SecurityTab() {
  const [cfg, setCfg] = useState(null);
  const [dev, setDev] = useState({ devices: [], current_device: "" });
  const [log, setLog] = useState({ rows: [], alerts: [] });
  const [roles] = useRoles();
  const loadDev = () => api.get("/privacy/devices").then(r => setDev(r.data)).catch(() => {});
  useEffect(() => {
    api.get("/privacy/settings").then(r => setCfg(r.data)).catch(() => toast.error("Erreur"));
    loadDev(); api.get("/privacy/access-log").then(r => setLog(r.data)).catch(() => {});
  }, []);
  if (!cfg) return <div className="text-sm text-[#666]">Chargement…</div>;
  const save = () => api.put("/privacy/settings", cfg).then(r => { setCfg(r.data); toast.success("Règles d'accès enregistrées"); }).catch(e => toast.error(e?.response?.data?.detail || "Erreur"));
  const h = cfg.hours || {};
  const setH = (p) => setCfg({ ...cfg, hours: { ...h, ...p } });
  const thisOne = dev.devices.find(d => d.device_id === dev.current_device);
  const approveHere = () => api.post("/privacy/devices/current", { label: window.prompt("Nom de cet appareil", "Tablette boutique") || "Tablette boutique" }).then(() => { toast.success("Cet appareil est autorisé"); loadDev(); }).catch(() => toast.error("Erreur"));
  const setStatus = (d, status) => api.patch(`/privacy/devices/${d.id}`, { status }).then(loadDev);
  const del = (d) => api.delete(`/privacy/devices/${d.id}`).then(loadDev);
  return (
    <div className="grid lg:grid-cols-2 gap-4" data-testid="security-tab">
      <div className="dina-card-white p-5 space-y-3">
        <div className="font-semibold flex items-center gap-2"><ShieldCheck size={16} />Accès à la console</div>
        <div className="text-xs text-[#666]">Rôles concernés par les restrictions ci-dessous :</div>
        <div className="flex flex-wrap gap-2">{roles.filter(r => r.key !== "admin" && r.key !== "rider").map(r => <label key={r.key} className="text-sm flex items-center gap-1.5"><input type="checkbox" checked={(cfg.restricted_roles || []).includes(r.key)} onChange={e => setCfg({ ...cfg, restricted_roles: e.target.checked ? [...(cfg.restricted_roles || []), r.key] : cfg.restricted_roles.filter(x => x !== r.key) })} data-testid={`sec-role-${r.key}`} />{r.label}</label>)}</div>
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={!!cfg.enforce_devices} onChange={e => setCfg({ ...cfg, enforce_devices: e.target.checked })} data-testid="sec-enforce-devices" />Uniquement sur les appareils autorisés</label>
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={!!cfg.enforce_hours} onChange={e => setCfg({ ...cfg, enforce_hours: e.target.checked })} data-testid="sec-enforce-hours" />Uniquement pendant les horaires de travail</label>
        <div className="flex flex-wrap gap-1">{DAYS.map((d, i) => <button key={d} onClick={() => setH({ days: (h.days || []).includes(i) ? h.days.filter(x => x !== i) : [...(h.days || []), i] })} className={`px-2 py-1 text-xs rounded ${(h.days || []).includes(i) ? "bg-[#b02a2a] text-white" : "bg-[#f2f2f2]"}`} data-testid={`sec-day-${i}`}>{d}</button>)}</div>
        <div className="flex gap-2 items-center text-sm"><input type="time" className="dina-input w-32" value={h.start || ""} onChange={e => setH({ start: e.target.value })} data-testid="sec-start" />à<input type="time" className="dina-input w-32" value={h.end || ""} onChange={e => setH({ end: e.target.value })} data-testid="sec-end" /><span className="text-xs text-[#666]">heure d'Abidjan</span></div>
        <div className="border-t pt-3 text-sm space-y-1">
          <div className="font-medium">Alerte consultation de fiches clientes</div>
          <div className="flex gap-2 items-center flex-wrap text-xs">Alerter si un employé ouvre plus de<input type="number" min={1} className="dina-input w-20" value={cfg.alert_threshold} onChange={e => setCfg({ ...cfg, alert_threshold: +e.target.value })} data-testid="sec-threshold" />fiches en<input type="number" min={1} className="dina-input w-20" value={cfg.alert_window_min} onChange={e => setCfg({ ...cfg, alert_window_min: +e.target.value })} data-testid="sec-window" />minutes</div>
        </div>
        <button onClick={save} className="dina-btn-primary !min-h-[40px]" data-testid="sec-save">Enregistrer</button>
      </div>
      <div className="dina-card-white p-5 space-y-3">
        <div className="flex justify-between items-center"><div className="font-semibold flex items-center gap-2"><Tablet size={16} />Appareils</div>
          {thisOne?.status !== "approved" && <button onClick={approveHere} className="dina-btn-secondary !min-h-[34px] text-xs" data-testid="sec-approve-here">Autoriser cet appareil</button>}</div>
        {dev.devices.map(d => <div key={d.id} className="flex items-center gap-2 text-sm border-b border-[#f0f0f0] py-2" data-testid={`sec-device-${d.id}`}>
          <div className="flex-1 min-w-0"><div className="font-medium truncate">{d.label || d.requested_by ? (d.label || `Demande de ${d.requested_by}`) : "Appareil"}{d.device_id === dev.current_device ? " · cet appareil" : ""}</div><div className="text-[11px] text-[#666] truncate">{d.ua?.slice(0, 70)} · {dateTimeFmt(d.approved_at || d.at)}</div></div>
          <span className="dina-chip" style={{ color: d.status === "approved" ? "#1f8a4c" : d.status === "pending" ? "#b26a00" : "#c62828" }}>{d.status === "approved" ? "Autorisé" : d.status === "pending" ? "En attente" : "Refusé"}</span>
          {d.status !== "approved" && <button onClick={() => setStatus(d, "approved")} className="text-[#1f8a4c]" title="Autoriser" data-testid={`sec-device-approve-${d.id}`}><Check size={14} /></button>}
          {d.status === "approved" && <button onClick={() => setStatus(d, "revoked")} className="text-[#c62828]" title="Retirer" data-testid={`sec-device-revoke-${d.id}`}><Ban size={14} /></button>}
          <button onClick={() => del(d)} className="text-[#999]" title="Supprimer"><Trash2 size={13} /></button>
        </div>)}
        {!dev.devices.length && <div className="text-xs text-[#666]">Aucun appareil. Ouvrez la console sur la tablette de la boutique avec votre compte puis cliquez « Autoriser cet appareil ».</div>}
      </div>
      <div className="dina-card-white p-5 lg:col-span-2" data-testid="sec-access-log">
        <div className="font-semibold mb-2">Fiches clientes ouvertes</div>
        {log.alerts.map(a => <div key={a.id} className="text-xs text-[#c62828] mb-1" data-testid="sec-alert">Alerte · {a.user_name} : {a.count} fiches en {a.window_min} min · {dateTimeFmt(a.at)}</div>)}
        <div className="max-h-72 overflow-y-auto">{log.rows.map(r => <div key={r.id} className="flex justify-between text-xs py-1 border-b border-[#f5f5f5]"><span>{r.user_name} → {r.customer_name}</span><span className="text-[#666]">{dateTimeFmt(r.at)}</span></div>)}
          {!log.rows.length && <div className="text-xs text-[#666]">Aucune consultation enregistrée.</div>}</div>
      </div>
    </div>
  );
}
