import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { dateTimeFmt } from "@/lib/format";
import { AlertTriangle, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { URGENCY, REPORT_STATUS } from "@/pages/rider/Signalements";

function ReportRow({ r, onSaved }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState(null);
  useEffect(() => { if (open && r.has_photo && !photo) api.get(`/rider-reports/${r.id}/photo`).then(x => setPhoto(x.data?.photo)).catch(() => {}); }, [open]); // eslint-disable-line
  const [sLabel, sColor] = REPORT_STATUS[r.status] || [r.status, "#666"];
  const u = URGENCY.find(x => x[0] === r.urgency) || ["", r.urgency, "#666"];
  const save = async (status) => {
    setBusy(true);
    try { await api.patch(`/rider-reports/${r.id}`, { status, note }); toast.success("Livreur notifié"); setNote(""); onSaved(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); } finally { setBusy(false); }
  };
  return (
    <div className="border-b border-[#f0f0f0] dark:border-[#2a2a2a] last:border-0" data-testid={`console-report-${r.id}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 p-3 text-left" data-testid={`console-report-toggle-${r.id}`}>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: u[2] }}/>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">{r.kind_label} · {r.rider_name}{r.order_code ? ` · ${r.order_code}` : ""}</div>
          <div className="text-[11px] text-[#666]">{dateTimeFmt(r.created_at)} · urgence <b style={{ color: u[2] }}>{u[1]}</b></div>
        </div>
        <span className="dina-chip text-[10px]" style={{ color: sColor, borderColor: sColor }}>{sLabel}</span>
        {open ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 text-sm">
          <div className="break-words">{r.details}</div>
          {photo && <a href={photo} target="_blank" rel="noreferrer"><img src={photo} alt="" className="max-h-48 rounded-lg" data-testid={`console-report-photo-${r.id}`}/></a>}
          {r.location && <a className="text-xs text-[#b02a2a] inline-flex items-center gap-1 underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${r.location.lat},${r.location.lng}`} data-testid={`console-report-map-${r.id}`}><MapPin size={12}/>Voir la position</a>}
          {r.rider_phone && <div className="text-xs text-[#666]">Tél. livreur : <a href={`tel:${r.rider_phone}`} className="underline">{r.rider_phone}</a></div>}
          <div className="text-[11px] text-[#999] space-y-0.5">{(r.history || []).map((h, i) => <div key={i}>{dateTimeFmt(h.at)} · {(REPORT_STATUS[h.status] || [h.status])[0]} · {h.by}{h.note ? ` — ${h.note}` : ""}</div>)}</div>
          {r.status !== "resolu" && <>
            <input className="dina-input" placeholder="Réponse au livreur (facultatif)" value={note} onChange={e => setNote(e.target.value)} data-testid={`console-report-note-${r.id}`}/>
            <div className="flex gap-2">
              {r.status === "nouveau" && <button disabled={busy} onClick={() => save("pris_en_charge")} className="dina-btn-secondary flex-1" data-testid={`console-report-take-${r.id}`}>Prendre en charge</button>}
              <button disabled={busy} onClick={() => save("resolu")} className="dina-btn-primary flex-1" data-testid={`console-report-resolve-${r.id}`}>Marquer résolu</button>
            </div>
          </>}
        </div>
      )}
    </div>
  );
}

/** Rider incident reports panel for managers (Livreurs page). */
export default function RiderReportsPanel({ autoOpen }) {
  const [rows, setRows] = useState([]);
  const [all, setAll] = useState(false);
  const load = () => api.get("/rider-reports").then(r => setRows(r.data || [])).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);
  const open = rows.filter(r => r.status !== "resolu");
  const shown = all ? rows : open;
  if (!rows.length && !autoOpen) return null;
  return (
    <div className="dina-card-white !p-0 overflow-hidden" data-testid="rider-reports-panel">
      <div className="flex items-center gap-2 p-3 border-b border-[#ececec] dark:border-[#2a2a2a]">
        <AlertTriangle size={16} className="text-[#c62828]"/>
        <div className="font-semibold text-sm flex-1">Signalements livreurs <span className="text-[#c62828]" data-testid="rider-reports-open-count">· {open.length} en cours</span></div>
        <button onClick={() => setAll(!all)} className="text-xs text-[#666] underline" data-testid="rider-reports-toggle-all">{all ? "En cours seulement" : "Voir tout"}</button>
      </div>
      {shown.length === 0 ? <div className="p-4 text-sm text-[#666] text-center">Aucun signalement en cours</div> : shown.map(r => <ReportRow key={r.id} r={r} onSaved={load}/>)}
    </div>
  );
}
