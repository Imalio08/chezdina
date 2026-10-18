import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { X, FileText, Upload, Bell, Download } from "lucide-react";
import { dateTimeFmt } from "@/lib/format";
import SignaturePad from "@/components/shared/SignaturePad";

const ST = { signed: ["Signé", "#1f8a4c"], pending: ["En attente", "#b26a00"], expired: ["Expiré", "#c62828"], superseded: ["Remplacé", "#999"] };

export const openFile = async (fid) => {
  try { const r = await api.get(`/onboarding/files/${fid}`, { responseType: "blob" }); window.open(URL.createObjectURL(r.data), "_blank"); }
  catch { toast.error("Fichier indisponible"); }
};
const toDataUrl = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });

// Owner-only employee file: Onboarding documents + departure checklist.
export default function EmployeeFile({ emp, onClose, onChanged }) {
  const [tab, setTab] = useState("onboarding");
  const [file, setFile] = useState(null);
  const load = () => api.get(`/onboarding/employees/${emp.id}`).then(r => setFile(r.data)).catch(() => toast.error("Dossier indisponible"));
  useEffect(() => { load(); }, [emp.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="employee-file">
        <div className="sticky top-0 bg-white dark:bg-[#1a1a1a] p-4 border-b flex justify-between items-center">
          <div><div className="font-serif text-xl">{emp.name}</div><div className="text-xs text-[#666]">Dossier employé · visible par vous seul(e) et par l'employé(e) pour ses documents</div></div>
          <button onClick={onClose} data-testid="employee-file-close"><X size={18} /></button>
        </div>
        <div className="flex gap-1 p-3 pb-0">
          {[["onboarding", "Onboarding"], ["depart", "Départ"]].map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`px-4 py-1.5 text-sm rounded-md ${tab === k ? "bg-[#fff5f5] text-[#b02a2a] font-semibold" : ""}`} data-testid={`employee-file-tab-${k}`}>{l}</button>)}
        </div>
        <div className="p-4">
          {!file ? <div className="text-sm text-[#666]">Chargement…</div> : tab === "onboarding"
            ? <OnboardingTab emp={emp} file={file} reload={() => { load(); onChanged(); }} />
            : <DepartureTab emp={emp} file={file} reload={() => { load(); onChanged(); }} />}
        </div>
      </div>
    </div>
  );
}

function OnboardingTab({ emp, file, reload }) {
  const [tpls, setTpls] = useState([]);
  const [pick, setPick] = useState([]);
  useEffect(() => { api.get("/onboarding/templates").then(r => setTpls(r.data.filter(t => t.active))).catch(() => {}); }, []);
  const assign = async () => {
    try { const r = await api.post(`/onboarding/employees/${emp.id}/assign`, { template_ids: pick }); toast.success(`${r.data.assigned} document(s) à signer`); setPick([]); reload(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
  };
  const remind = () => api.post(`/onboarding/employees/${emp.id}/remind`).then(() => toast.success("Rappel envoyé")).catch(e => toast.error(e?.response?.data?.detail || "Erreur"));
  const docs = file.docs.filter(d => d.status !== "superseded");
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><div className="font-semibold text-sm">Documents ({docs.length})</div>
        <button onClick={remind} className="dina-btn-secondary !min-h-[34px] text-xs" data-testid="onb-remind"><Bell size={12} />Relancer</button></div>
      <div className="space-y-2">
        {docs.map(d => <div key={d.id} className="flex items-center gap-2 p-2.5 border border-[#ececec] rounded-lg text-sm" data-testid={`onb-doc-${d.kind}`}>
          <FileText size={14} className="text-[#666]" />
          <div className="flex-1 min-w-0"><div className="font-medium truncate">{d.title} <span className="text-xs text-[#999]">v{d.version}</span></div>
            <div className="text-[11px] text-[#666]">{d.signed_at ? `Signé le ${dateTimeFmt(d.signed_at)} · ${d.method === "papier" ? "version papier" : `IP ${d.ip || "—"}`}` : `Demandé le ${dateTimeFmt(d.assigned_at)}`}{d.expires_at ? ` · expire le ${dateTimeFmt(d.expires_at)}` : ""}</div></div>
          <span className="dina-chip" style={{ color: ST[d.status]?.[1] }} data-testid={`onb-status-${d.kind}`}>{ST[d.status]?.[0]}</span>
          {d.pdf_file_id && <button onClick={() => openFile(d.pdf_file_id)} className="text-[#5867fd]" title="PDF signé" data-testid={`onb-pdf-${d.kind}`}><Download size={14} /></button>}
          {d.status === "pending" && <ScanButton emp={emp} docId={d.id} title={d.title} onDone={reload} testid={`onb-scan-${d.kind}`} />}
        </div>)}
        {!docs.length && <div className="text-xs text-[#666]">Aucun document demandé.</div>}
      </div>
      <div className="dina-card-white p-3 space-y-2">
        <div className="text-xs font-semibold uppercase text-[#666]">Demander une signature</div>
        {tpls.map(t => <label key={t.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pick.includes(t.id)} onChange={e => setPick(p => e.target.checked ? [...p, t.id] : p.filter(x => x !== t.id))} data-testid={`onb-pick-${t.kind}`} />{t.title} <span className="text-xs text-[#999]">v{t.current}</span></label>)}
        <button onClick={assign} disabled={!pick.length} className="dina-btn-primary !min-h-[36px] text-sm disabled:opacity-40" data-testid="onb-assign">Envoyer à signer</button>
      </div>
      <div className="flex justify-between items-center"><div className="font-semibold text-sm">Fichiers ({file.files.length})</div><ScanButton emp={emp} title="Document papier signé" onDone={reload} label="Ajouter un scan" testid="onb-scan-free" /></div>
      {file.files.map(f => <button key={f.id} onClick={() => openFile(f.id)} className="w-full text-left text-xs flex justify-between p-2 border-b border-[#f0f0f0]" data-testid={`onb-file-${f.id}`}><span>{f.name}</span><span className="text-[#666]">{f.kind === "scan" ? "Scan" : f.kind === "exit" ? "PV de départ" : "PDF signé"} · {dateTimeFmt(f.at)}</span></button>)}
    </div>
  );
}

function ScanButton({ emp, docId, title, onDone, label, testid }) {
  const up = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) return toast.error("Fichier trop lourd (max 8 Mo)");
    try { await api.post(`/onboarding/employees/${emp.id}/scan`, { file: await toDataUrl(f), name: f.name, title, doc_id: docId }); toast.success("Scan enregistré"); onDone(); }
    catch (ex) { toast.error(ex?.response?.data?.detail || "Envoi impossible"); }
  };
  return <label className="text-[#b02a2a] text-xs inline-flex items-center gap-1 cursor-pointer" title="Version papier signée" data-testid={testid}><Upload size={13} />{label || ""}<input type="file" accept="application/pdf,image/*" className="hidden" onChange={up} /></label>;
}

function DepartureTab({ emp, file, reload }) {
  const [f, setF] = useState({ equipment_returned: false, access_deactivated: false, data_deleted: false, equipment: "", notes: "", date: new Date().toISOString().slice(0, 10) });
  const [osig, setOsig] = useState(null);
  const [esig, setEsig] = useState(null);
  const [busy, setBusy] = useState(false);
  if (file.departure) return (
    <div className="space-y-2 text-sm" data-testid="departure-done">
      <div className="font-semibold">Départ enregistré le {file.departure.date}</div>
      <div className="text-xs text-[#666]">Par {file.departure.by} · accès désactivés · {file.departure.employee_signed ? "signé par les deux parties" : "signé par le propriétaire"}</div>
      <button onClick={() => openFile(file.departure.pdf_file_id)} className="dina-btn-secondary !min-h-[36px] text-xs" data-testid="departure-pdf"><Download size={12} />PV de départ (PDF)</button>
    </div>
  );
  const submit = async () => {
    if (!window.confirm(`Clôturer le départ de ${emp.name} ? Ses accès seront désactivés immédiatement sur tous ses appareils.`)) return;
    setBusy(true);
    try { await api.post(`/onboarding/employees/${emp.id}/departure`, { ...f, owner_signature: osig, employee_signature: esig }); toast.success("Départ enregistré · PV stocké dans le dossier"); reload(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); } finally { setBusy(false); }
  };
  const CK = [["equipment_returned", "Matériel restitué"], ["access_deactivated", "Accès désactivés (console, app livreur)"], ["data_deleted", "Données clientes supprimées des appareils personnels"]];
  return (
    <div className="space-y-3 text-sm" data-testid="departure-form">
      <input type="date" className="dina-input max-w-[200px]" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} data-testid="departure-date" />
      {CK.map(([k, l]) => <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={f[k]} onChange={e => setF({ ...f, [k]: e.target.checked })} data-testid={`departure-${k}`} />{l}</label>)}
      <input className="dina-input" placeholder="Matériel restitué (détail)" value={f.equipment} onChange={e => setF({ ...f, equipment: e.target.value })} data-testid="departure-equipment" />
      <textarea className="dina-input" rows={2} placeholder="Observations" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} data-testid="departure-notes" />
      <div><div className="text-xs font-semibold mb-1">Signature du propriétaire *</div><SignaturePad onChange={setOsig} testid="departure-owner-sig" height={120} /></div>
      <div><div className="text-xs font-semibold mb-1">Signature de l'employé(e) (si présent(e))</div><SignaturePad onChange={setEsig} testid="departure-emp-sig" height={120} /></div>
      <button onClick={submit} disabled={busy} className="dina-btn-primary w-full !min-h-[44px]" data-testid="departure-submit">Enregistrer le départ et générer le PV</button>
    </div>
  );
}
