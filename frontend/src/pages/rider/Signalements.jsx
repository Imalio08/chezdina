import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { dateTimeFmt } from "@/lib/format";
import { Camera, MapPin, Loader2, Send, X, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import SubPage from "@/components/rider/SubPage";

export const KINDS = [["panne_moto", "Panne moto"], ["accident", "Accident"], ["client_injoignable", "Client injoignable"], ["client_agressif", "Client agressif"], ["colis_endommage", "Colis endommagé"], ["autre", "Autre"]];
export const URGENCY = [["faible", "Faible", "#1f8a4c"], ["moyenne", "Moyenne", "#e4991e"], ["haute", "Haute", "#c62828"], ["critique", "Critique", "#7a0f0f"]];
export const REPORT_STATUS = { nouveau: ["Envoyé", "#e4991e"], pris_en_charge: ["Pris en charge", "#5867fd"], resolu: ["Résolu", "#1f8a4c"] };

const compress = (file) => new Promise((res, rej) => {
  const img = new Image();
  img.onload = () => {
    const r = Math.min(1, 1280 / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = img.width * r; c.height = img.height * r;
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(img.src); res(c.toDataURL("image/jpeg", 0.7));
  };
  img.onerror = rej; img.src = URL.createObjectURL(file);
});

function Chips({ options, value, onChange, testid }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, label, color]) => (
        <button type="button" key={v} onClick={() => onChange(v)} data-testid={`${testid}-${v}`}
          className={`px-3 py-1.5 rounded-full text-xs border ${value === v ? "text-white border-transparent" : "border-[#ececec] dark:border-[#2a2a2a]"}`}
          style={value === v ? { background: color || "#b02a2a" } : undefined}>{label}</button>
      ))}
    </div>
  );
}

function ReportForm({ orders, onSent }) {
  const [f, setF] = useState({ kind: "", urgency: "moyenne", order_id: "", details: "", photo: null });
  const [pos, setPos] = useState(null);
  const [geo, setGeo] = useState("pending");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!navigator.geolocation) { setGeo("off"); return; }
    navigator.geolocation.getCurrentPosition(p => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }); setGeo("ok"); }, () => setGeo("off"), { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  }, []);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const pickPhoto = async (e) => { const file = e.target.files?.[0]; if (file) { try { set("photo", await compress(file)); } catch { toast.error("Photo illisible"); } } };
  const submit = async () => {
    if (!f.kind) return toast.error("Choisissez le type de problème");
    if (!f.details.trim()) return toast.error("Décrivez le problème");
    setBusy(true);
    try { await api.post("/rider/report", { ...f, order_id: f.order_id || null, ...(pos || {}) }); toast.success("Gérante alertée"); onSent(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Signalement non envoyé · réessayez"); }
    finally { setBusy(false); }
  };
  return (
    <div className="dina-card-white p-4 space-y-3" data-testid="report-form">
      <div><div className="text-xs font-semibold mb-1.5">Type de problème</div><Chips options={KINDS} value={f.kind} onChange={v => set("kind", v)} testid="report-kind"/></div>
      <div><div className="text-xs font-semibold mb-1.5">Urgence</div><Chips options={URGENCY} value={f.urgency} onChange={v => set("urgency", v)} testid="report-urgency"/></div>
      <div><div className="text-xs font-semibold mb-1.5">Commande concernée (facultatif)</div>
        <select className="dina-input !opacity-100" value={f.order_id} onChange={e => set("order_id", e.target.value)} data-testid="report-order">
          <option value="">Aucune</option>
          {orders.map(o => <option key={o.id} value={o.id}>{o.code} · {o.customer?.name || ""}</option>)}
        </select></div>
      <div><div className="text-xs font-semibold mb-1.5">Description</div>
        <textarea className="dina-input" rows={4} maxLength={1000} value={f.details} onChange={e => set("details", e.target.value)} placeholder="Que s'est-il passé ? Où êtes-vous ?" data-testid="report-details"/></div>
      <div>
        {f.photo ? (
          <div className="relative inline-block"><img src={f.photo} alt="" className="h-28 rounded-lg" data-testid="report-photo-preview"/>
            <button onClick={() => set("photo", null)} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black text-white grid place-items-center" data-testid="report-photo-remove"><X size={12}/></button></div>
        ) : (
          <label className="dina-btn-secondary w-full !min-h-[44px] cursor-pointer" data-testid="report-photo-btn"><Camera size={15}/>Ajouter une photo
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pickPhoto} data-testid="report-photo-input"/></label>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-[#666] bg-[#fff5f5] dark:bg-[#2a1818] rounded-lg p-2.5" data-testid="report-location">
        <MapPin size={13} className={geo === "ok" ? "text-[#1f8a4c]" : "text-[#c62828]"}/>
        {geo === "ok" ? `Position jointe automatiquement · précision ${pos.acc} m` : geo === "pending" ? "Récupération de votre position…" : "Position indisponible · le signalement sera envoyé sans position"}
      </div>
      <button onClick={submit} disabled={busy} className="dina-btn-primary w-full !min-h-[48px]" data-testid="report-submit">{busy ? <Loader2 size={16} className="animate-spin"/> : <Send size={15}/>}{busy ? "Envoi…" : "Envoyer à la gérante"}</button>
    </div>
  );
}

function ReportItem({ r }) {
  const [label, color] = REPORT_STATUS[r.status] || [r.status, "#666"];
  const last = [...(r.history || [])].reverse().find(h => h.note);
  const Icon = r.status === "resolu" ? CheckCircle2 : r.status === "pris_en_charge" ? Clock : AlertTriangle;
  return (
    <div className="dina-card-white p-3" data-testid={`report-item-${r.id}`}>
      <div className="flex items-start gap-2">
        <Icon size={16} style={{ color }} className="shrink-0 mt-0.5"/>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">{r.kind_label}{r.order_code ? ` · ${r.order_code}` : ""}</div>
          <div className="text-[11px] text-[#999]">{dateTimeFmt(r.created_at)} · urgence {(URGENCY.find(u => u[0] === r.urgency) || [])[1]}</div>
          <div className="text-xs mt-1 break-words">{r.details}</div>
          {last && <div className="text-xs mt-1.5 bg-[#f5f7ff] dark:bg-[#1c1f33] rounded p-2"><b>Gérante :</b> {last.note}</div>}
        </div>
        <span className="dina-chip text-[10px] shrink-0" style={{ color, borderColor: color }} data-testid={`report-status-${r.id}`}>{label}</span>
      </div>
    </div>
  );
}

export default function Signalements() {
  const [reports, setReports] = useState([]);
  const [orders, setOrders] = useState([]);
  const [showForm, setShowForm] = useState(null);
  const load = () => api.get("/rider/reports").then(r => { setReports(r.data || []); setShowForm(v => v ?? !(r.data || []).length); }).catch(() => setShowForm(v => v ?? true));
  useEffect(() => { load(); api.get("/riders/me/history?days=2").then(r => setOrders((r.data || []).flatMap(d => d.orders_detail || []))).catch(() => {}); }, []);
  return (
    <SubPage title="Signaler un problème" testid="rider-signalements-page">
      {showForm === null ? null : showForm ? <ReportForm orders={orders} onSent={() => { setShowForm(false); load(); }}/> :
        <button onClick={() => setShowForm(true)} className="dina-btn-primary w-full !min-h-[46px]" data-testid="report-new"><AlertTriangle size={15}/>Nouveau signalement</button>}
      <div className="text-[10px] uppercase font-semibold text-[#999] px-1 pt-2">Mes signalements</div>
      {reports.length === 0 ? <div className="text-center text-sm text-[#666] py-6" data-testid="report-empty">Aucun signalement</div> :
        <div className="space-y-2" data-testid="report-list">{reports.map(r => <ReportItem key={r.id} r={r}/>)}</div>}
    </SubPage>
  );
}
