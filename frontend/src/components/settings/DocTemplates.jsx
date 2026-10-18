import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, RefreshCw, Bell } from "lucide-react";
import { dateTimeFmt } from "@/lib/format";

// Paramètres › Documents RH: versioned templates employees sign at onboarding.
export default function DocTemplates() {
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = () => api.get("/onboarding/templates").then(r => setRows(r.data)).catch(() => toast.error("Erreur de chargement"));
  useEffect(() => { load(); }, []);
  const save = async () => {
    try {
      if (edit.id) await api.patch(`/onboarding/templates/${edit.id}`, { title: edit.title, body: edit.body, validity_months: edit.validity_months, active: edit.active, note: edit.note });
      else await api.post("/onboarding/templates", edit);
      toast.success(edit.id && edit.body !== edit._orig ? "Nouvelle version enregistrée" : "Modèle enregistré"); setEdit(null); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
  };
  const resign = async (t) => {
    if (!window.confirm(`Demander à tous les employés concernés de signer la version ${t.current} de « ${t.title} » ?`)) return;
    try { const r = await api.post(`/onboarding/templates/${t.id}/request-resign`); toast.success(`${r.data.requested} employé(s) invité(s) à signer`); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
  };
  const remindAll = () => api.post("/onboarding/remind-all").then(r => toast.success(`${r.data.reminded} employé(s) relancé(s)`)).catch(() => toast.error("Erreur"));
  return (
    <div className="dina-card-white p-5 space-y-4" data-testid="doc-templates">
      <div className="flex justify-between items-start gap-2 flex-wrap">
        <div><div className="font-semibold">Documents RH</div><p className="text-xs text-[#666]">Modèles signés par les employés avant d'accéder à la console ou à l'app livreur. Chaque modification crée une nouvelle version.</p></div>
        <div className="flex gap-2"><button onClick={remindAll} className="dina-btn-secondary !min-h-[36px] text-xs" data-testid="doc-remind-all"><Bell size={12} />Relancer les retards</button>
          <button onClick={() => setEdit({ title: "", body: "", validity_months: 0, kind: "autre" })} className="dina-btn-primary !min-h-[36px] text-xs" data-testid="doc-new"><Plus size={12} />Nouveau modèle</button></div>
      </div>
      {rows.map(t => (
        <div key={t.id} className="flex items-center gap-3 p-3 border border-[#ececec] rounded-lg" data-testid={`doc-tpl-${t.kind}`}>
          <div className="flex-1 min-w-0"><div className="font-medium text-sm">{t.title} {!t.active && <span className="text-xs text-[#999]">(inactif)</span>}</div>
            <div className="text-[11px] text-[#666]">Version {t.current} · {t.versions.at(-1)?.at ? dateTimeFmt(t.versions.at(-1).at) : ""} · {t.signed_count} signature(s) à jour{t.validity_months ? ` · valable ${t.validity_months} mois` : ""}</div></div>
          {t.outdated_count > 0 && <button onClick={() => resign(t)} className="dina-btn-secondary !min-h-[32px] text-xs" data-testid={`doc-resign-${t.kind}`}><RefreshCw size={11} />Faire signer v{t.current} ({t.outdated_count})</button>}
          <button onClick={() => setEdit({ ...t, _orig: t.body })} className="text-[#0021cc] text-xs" data-testid={`doc-edit-${t.kind}`}>Modifier</button>
        </div>
      ))}
      {edit && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={() => setEdit(null)}>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-5 w-full max-w-2xl space-y-2.5" onClick={e => e.stopPropagation()} data-testid="doc-editor">
            <div className="font-serif text-xl">{edit.id ? `Modifier · version ${edit.current}` : "Nouveau modèle"}</div>
            <input className="dina-input" placeholder="Titre *" value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })} data-testid="doc-title" />
            <textarea className="dina-input font-mono text-xs" rows={14} value={edit.body} onChange={e => setEdit({ ...edit, body: e.target.value })} data-testid="doc-body" />
            <div className="flex gap-3 items-center text-sm flex-wrap">
              <label className="flex items-center gap-2">Validité (mois, 0 = sans expiration)<input type="number" min={0} className="dina-input w-20" value={edit.validity_months} onChange={e => setEdit({ ...edit, validity_months: +e.target.value })} data-testid="doc-validity" /></label>
              {edit.id && <label className="flex items-center gap-2"><input type="checkbox" checked={edit.active} onChange={e => setEdit({ ...edit, active: e.target.checked })} data-testid="doc-active" />Actif</label>}
            </div>
            {edit.id && edit.body !== edit._orig && <input className="dina-input" placeholder="Motif de la nouvelle version (facultatif)" value={edit.note || ""} onChange={e => setEdit({ ...edit, note: e.target.value })} data-testid="doc-note" />}
            {edit.id && edit.versions?.length > 1 && <div className="text-[11px] text-[#666]">Versions : {edit.versions.map(v => `v${v.v} (${dateTimeFmt(v.at)})`).join(" · ")}</div>}
            <div className="flex gap-2"><button onClick={() => setEdit(null)} className="dina-btn-secondary flex-1">Annuler</button><button onClick={save} className="dina-btn-primary flex-1" data-testid="doc-save">Enregistrer</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
