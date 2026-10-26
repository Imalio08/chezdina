import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Save, Shield, Plus, Trash2 } from "lucide-react";
import SaveButton from "@/components/shared/SaveButton";
import { SECTIONS as NAV } from "@/components/layout/ConsoleLayout";
import { useRoles } from "@/lib/useRoles";

/* 4 niveaux par cellule : none / read / write / full
   Compat descendante : true → "full", false/absent → "none". */

const LEVELS = [
  { k: "none",  label: "Aucun",       color: "#999",    bg: "#f5f5f5" },
  { k: "read",  label: "Lecture",     color: "#5867fd", bg: "#eceefe" },
  { k: "write", label: "Modif.",      color: "#e4991e", bg: "#fdf2e0" },
  { k: "full",  label: "Complet",     color: "#1f8a4c", bg: "#e8f5ee" },
];

// Every console page becomes a row of the matrix; the server enforces the same keys (backend/permissions.py).
const SENSITIVE = new Set(["/console/stock", "/console/sessions-caisse", "/console/statistiques", "/console/finances", "/console/equipe", "/console/parametres", "/console/audit", "/console/depenses"]);
const EXTRA = [["/console/approbations", "À approuver"], ["/console/audit", "Journal d'audit"], ["/console/depenses", "Dépenses"], ["/console/encaissements", "Encaissements"]];
const buildSections = (modules) => {
  const ok = new Set(modules); const seen = new Set();
  const secs = NAV.map(s => ({ label: s.label || "Général", modules: s.items.map(it => {
    const key = it.to.split("?")[0];
    if (!ok.has(key) || seen.has(key)) return null;
    seen.add(key);
    return { key, label: it.label, sensitive: SENSITIVE.has(key) };
  }).filter(Boolean) })).filter(s => s.modules.length);
  const extra = EXTRA.filter(([k]) => ok.has(k) && !seen.has(k)).map(([key, label]) => { seen.add(key); return { key, label, sensitive: SENSITIVE.has(key) }; });
  const rest = modules.filter(k => !seen.has(k)).map(key => ({ key, label: key.replace("/console/", "").replace("/console", "Tableau de bord"), sensitive: SENSITIVE.has(key) }));
  return [...secs, ...(extra.length || rest.length ? [{ label: "Autres pages", modules: [...extra, ...rest] }] : [])];
};

const normalize = (v) => {
  if (v === true) return "full";
  if (v === false || v == null) return "none";
  if (["none","read","write","full"].includes(v)) return v;
  return "none";
};
const asMap = (r, keys) => Object.fromEntries(keys.map(k => [k, normalize(r?.[k])]));

export default function RolesPermissions() {
  const [matrix, setMatrix] = useState({});
  const [mods, setMods] = useState([]);
  const SECTIONS = useMemo(() => buildSections(mods), [mods]);
  const [allRoles, reloadRoles] = useRoles();
  const [roles, setRoles] = useState([]);
  useEffect(() => { if (allRoles.length) setRoles(rs => [...allRoles, ...rs.filter(r => !allRoles.find(a => a.key === r.key))]); }, [allRoles]);
  const rename = async (r) => { const l = window.prompt("Nouveau nom du rôle", r.label); if (!l?.trim()) return; try { await api.patch(`/roles/meta/${r.key}`, { label: l.trim() }); toast.success("Rôle renommé"); reloadRoles(); } catch (e) { toast.error(e.response?.data?.detail || "Erreur"); } };
  const toggle = async (r) => { if (!window.confirm(r.active === false ? `Réactiver le rôle « ${r.label} » ?` : `Désactiver le rôle « ${r.label} » ? Ses employés ne pourront plus se connecter.`)) return; try { await api.patch(`/roles/meta/${r.key}`, { active: r.active === false }); toast.success(r.active === false ? "Rôle réactivé" : "Rôle désactivé"); reloadRoles(); } catch (e) { toast.error(e.response?.data?.detail || "Erreur"); } };
  const [saving, setSaving] = useState(false);
  const [showNewRole, setShowNewRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");

  const load = async () => {
    try {
      const r = await api.get("/roles-permissions");
      const raw = r.data.matrix || {};
      const keys = r.data.modules || [];
      const normalized = {};
      Object.entries(raw).forEach(([role, perms]) => { normalized[role] = asMap(perms, keys); });
      setMods(keys);
      setMatrix(normalized);
    } catch { toast.error("Erreur de chargement"); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const setCell = (role, perm, level) => {
    if (role === "admin") return;
    setMatrix(m => ({ ...m, [role]: { ...(m[role] || {}), [perm]: level } }));
  };
  const applyToSection = (role, modules, level) => {
    if (role === "admin") return;
    setMatrix(m => {
      const next = { ...(m[role] || {}) };
      modules.forEach(mod => { next[mod.key] = level; });
      return { ...m, [role]: next };
    });
  };
  const save = async () => {
    setSaving(true);
    try {
      await api.patch("/roles-permissions", { matrix });
      toast.success("Matrice enregistrée · appliquée à la prochaine page ouverte par chaque employé");
    } catch (e) { toast.error(e?.response?.status === 403 ? "Droits admin requis" : (typeof e?.response?.data?.detail === "string" ? e.response.data.detail : "Enregistrement impossible · réessayez")); }
    finally { setSaving(false); }
  };

  const addRole = () => {
    if (!newRoleName.trim()) return;
    const key = newRoleName.toLowerCase().replace(/\s+/g, "_").replace(/[^\w-]/g,"");
    if (roles.find(r => r.key === key)) { toast.error("Clé déjà utilisée"); return; }
    setRoles(rs => [...rs, { key, label: newRoleName, builtin: false }]);
    setMatrix(m => ({ ...m, [key]: Object.fromEntries(mods.map(k => [k, "none"])) }));
    setNewRoleName(""); setShowNewRole(false);
    toast.success("Nouveau rôle · n'oubliez pas d'enregistrer");
  };
  const removeRole = (key) => {
    if (!confirm(`Supprimer le rôle "${key}" ?`)) return;
    setRoles(rs => rs.filter(r => r.key !== key));
    setMatrix(m => { const n = {...m}; delete n[key]; return n; });
  };

  const Cell = ({ role, perm, sensitive }) => {
    const level = normalize(matrix[role]?.[perm]);
    if (role === "admin") {
      return <div className="w-full h-10 rounded-lg bg-[#1f8a4c] text-white grid place-items-center text-xs font-semibold">Complet</div>;
    }
    return (
      <select
        value={level}
        onChange={(e) => setCell(role, perm, e.target.value)}
        className="w-full h-10 rounded-lg border text-xs font-semibold text-center cursor-pointer transition"
        style={{
          background: LEVELS.find(l => l.k === level)?.bg,
          color: LEVELS.find(l => l.k === level)?.color,
          borderColor: sensitive && level === "full" ? "#c62828" : "transparent",
          borderWidth: sensitive && level === "full" ? 2 : 1,
        }}
        data-testid={`perm-${role}-${perm}`}
        title={sensitive && level === "full" ? "⚠️ Droit sensible" : LEVELS.find(l => l.k === level)?.label}
      >
        {LEVELS.map(l => <option key={l.k} value={l.k}>{l.label}</option>)}
      </select>
    );
  };

  return (
    <div className="space-y-5" data-testid="roles-permissions-page">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-serif text-3xl">Rôles & permissions</h1>
          <p className="text-sm text-[#666]">Aucun = page masquée et interdite · Lecture = consulter seulement · Modif. = créer et modifier · Complet = tout, y compris supprimer. Appliqué aussi par le serveur. Le propriétaire a tout.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowNewRole(true)} className="dina-btn-secondary !min-h-[40px]" data-testid="roles-add"><Plus size={14}/>Nouveau rôle</button>
          <SaveButton loading={saving} onClick={save} testid="roles-save" className="!min-h-[40px]"/>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px]">
        {LEVELS.map(l => (
          <div key={l.k} className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{background: l.bg, color: l.color}}>
            <span className="w-2 h-2 rounded-full" style={{background: l.color}}/>{l.label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border-2 border-[#c62828] text-[#c62828]">⚠ Droit sensible</div>
      </div>

      <div className="dina-card-white p-5 overflow-x-auto">
        <table className="w-full text-sm" data-testid="roles-matrix">
          <thead>
            <tr>
              <th className="text-left pb-3 pr-4 min-w-[220px]"><Shield size={14} className="inline mr-1"/>Module</th>
              {roles.map(r => (
                <th key={r.key} className={`pb-3 px-2 min-w-[140px] ${r.active === false ? "opacity-50" : ""}`}>
                  <div className="text-center font-semibold text-xs uppercase text-[#666]" data-testid={`role-label-${r.key}`}>{r.label}{r.active === false && <div className="normal-case text-[10px] text-[#c62828]">désactivé</div>}</div>
                  {r.key !== "admin" && <div className="flex justify-center gap-2 mt-1 text-[10px]"><button onClick={() => rename(r)} className="text-[#5867fd]" data-testid={`role-rename-${r.key}`}>Renommer</button><button onClick={() => toggle(r)} className={r.active === false ? "text-[#1f8a4c]" : "text-[#c62828]"} data-testid={`role-toggle-${r.key}`}>{r.active === false ? "Réactiver" : "Désactiver"}</button></div>}
                  {!r.builtin && <button onClick={() => removeRole(r.key)} className="text-[10px] text-[#c62828] mt-1" title="Supprimer rôle"><Trash2 size={10} className="inline"/></button>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SECTIONS.map(sec => (
              <React.Fragment key={sec.label}>
                <tr className="bg-[#fafafa] dark:bg-[#141414]">
                  <td className="pt-4 pb-2 pr-4 font-serif text-sm font-semibold" colSpan={roles.length + 1}>
                    <div className="flex items-center justify-between">
                      <span>{sec.label}</span>
                      <div className="flex gap-1 flex-wrap">
                        {roles.filter(r => r.key !== "admin").map(r => (
                          <select key={r.key} onChange={(e) => { if (e.target.value) applyToSection(r.key, sec.modules, e.target.value); e.target.value = ""; }}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-[#ddd] bg-white dark:bg-[#1a1a1a]"
                            data-testid={`section-bulk-${sec.label}-${r.key}`} defaultValue="">
                            <option value="">{r.label} · bulk</option>
                            {LEVELS.map(l => <option key={l.k} value={l.k}>Tout · {l.label}</option>)}
                          </select>
                        ))}
                      </div>
                    </div>
                  </td>
                </tr>
                {sec.modules.map(m => (
                  <tr key={m.key} className="border-t border-[#ececec] dark:border-[#2a2a2a]">
                    <td className="py-2 pr-4 font-medium">
                      {m.label}
                      {m.sensitive && <span className="ml-1.5 text-[9px] text-[#c62828] font-bold">SENSIBLE</span>}
                    </td>
                    {roles.map(r => (
                      <td key={r.key} className="py-1.5 px-1.5"><Cell role={r.key} perm={m.key} sensitive={m.sensitive}/></td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {showNewRole && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={() => setShowNewRole(false)}>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()} data-testid="new-role-modal">
            <div className="font-serif text-xl mb-4">Nouveau rôle (vierge)</div>
            <label className="text-xs uppercase text-[#666]">Nom du rôle</label>
            <input className="dina-input mt-1 mb-4" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} placeholder="ex. Caissière senior" data-testid="new-role-name" autoFocus/>
            <div className="flex gap-2">
              <button onClick={() => { setShowNewRole(false); setNewRoleName(""); }} className="dina-btn-secondary flex-1">Annuler</button>
              <button onClick={addRole} className="dina-btn-primary flex-1" data-testid="new-role-create">Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
