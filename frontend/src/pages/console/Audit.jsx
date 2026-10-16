import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";
import { Download, Filter, FileSpreadsheet, AlertTriangle, Search } from "lucide-react";
import * as XLSX from "xlsx";

const COLOR_BY_PREFIX = {
  "cash":"#1f8a4c", "stock":"#5867fd", "order":"#0021cc", "role":"#b02a2a",
  "approval":"#e4991e", "expense_request":"#5867fd", "user":"#5867fd",
  "login":"#999", "auth":"#999", "pos":"#b02a2a",
};
function colorFor(action) {
  const prefix = (action || "").split(".")[0];
  return COLOR_BY_PREFIX[prefix] || "#666";
}

export default function Audit() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [q, setQ] = useState("");
  const [daysBack, setDaysBack] = useState(7);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (userId) params.set("user_id", userId);
      if (actionFilter) params.set("action", actionFilter);
      params.set("limit", "1000");
      const [r, t] = await Promise.all([
        api.get(`/audit-logs?${params.toString()}`),
        users.length ? Promise.resolve({ data: users }) : api.get("/team").catch(() => ({data:[]})),
      ]);
      setRows(r.data || []);
      if (!users.length) setUsers(t.data || []);
    } catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [userId, actionFilter]); // eslint-disable-line

  const filtered = useMemo(() => {
    const cutoff = daysBack === 0 ? null : new Date(Date.now() - daysBack * 86400000);
    const nq = q.toLowerCase().trim();
    return rows.filter(r => {
      if (cutoff && new Date(r.at) < cutoff) return false;
      if (nq && !(`${r.action} ${r.user_name} ${r.entity_id}`.toLowerCase().includes(nq))) return false;
      return true;
    });
  }, [rows, q, daysBack]);

  const uniqueActions = useMemo(() => Array.from(new Set(rows.map(r => r.action))).sort(), [rows]);

  const exportXlsx = () => {
    const data = filtered.map(r => ({
      Date: r.at,
      Utilisateur: r.user_name,
      Action: r.action,
      Entité: r.entity_id,
      Avant: JSON.stringify(r.before || {}),
      Après: JSON.stringify(r.after || {}),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Audit");
    XLSX.writeFile(wb, `audit-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  if (user?.role !== "admin") {
    return (
      <div className="dina-card-white p-8 text-center" data-testid="audit-no-access">
        <AlertTriangle size={32} className="text-[#e4991e] mx-auto mb-3"/>
        <div className="font-serif text-xl mb-1">Accès réservé</div>
        <div className="text-sm text-[#666]">Journal d'audit visible par le propriétaire uniquement.</div>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="audit-page">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-serif text-2xl">Journal d'audit</h2>
          <p className="text-sm text-[#666]">Toutes les actions sensibles · modifications des rôles, caisse, stock, approbations</p>
        </div>
        <button onClick={exportXlsx} className="dina-btn-secondary !min-h-[40px]" data-testid="audit-export"><FileSpreadsheet size={14}/>Export Excel</button>
      </div>

      <div className="dina-card-white p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="text-[10px] uppercase text-[#666] font-semibold">Utilisateur</label>
          <select className="dina-input mt-1" value={userId} onChange={e => setUserId(e.target.value)} data-testid="audit-user-filter">
            <option value="">Tous les utilisateurs</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase text-[#666] font-semibold">Action</label>
          <select className="dina-input mt-1" value={actionFilter} onChange={e => setActionFilter(e.target.value)} data-testid="audit-action-filter">
            <option value="">Toutes les actions</option>
            {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase text-[#666] font-semibold">Période</label>
          <select className="dina-input mt-1" value={daysBack} onChange={e => setDaysBack(+e.target.value)} data-testid="audit-days-filter">
            <option value={1}>Dernières 24h</option>
            <option value={7}>7 derniers jours</option>
            <option value={30}>30 derniers jours</option>
            <option value={90}>90 derniers jours</option>
            <option value={0}>Tout</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase text-[#666] font-semibold">Recherche libre</label>
          <div className="relative mt-1"><Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#999]"/><input className="dina-input pl-7" placeholder="action, user, id…" value={q} onChange={e => setQ(e.target.value)} data-testid="audit-search"/></div>
        </div>
      </div>

      <div className="dina-card-white overflow-x-auto">
        <table className="dina-table">
          <thead><tr>
            <th>Horodatage</th>
            <th>Utilisateur</th>
            <th>Action</th>
            <th>Entité</th>
            <th>Avant → Après</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="text-sm text-[#666] text-center py-8">Chargement…</td></tr>
            : filtered.length === 0 ? <tr><td colSpan={5} className="text-sm text-[#666] text-center py-8">Aucune action pour ces filtres</td></tr>
            : filtered.map(r => (
              <tr key={r.id} data-testid={`audit-row-${r.id}`}>
                <td className="text-xs text-[#666] whitespace-nowrap">{dateTimeFmt(r.at)}</td>
                <td className="text-sm font-medium">{r.user_name || "—"}</td>
                <td><span className="dina-chip text-[10px]" style={{color: colorFor(r.action)}}>{r.action}</span></td>
                <td className="font-mono text-[10px] text-[#999]">{(r.entity_id || "").slice(0, 12)}{r.entity_id?.length > 12 && "…"}</td>
                <td className="text-xs max-w-md">
                  {r.before && Object.keys(r.before).length > 0 ? (
                    <details className="cursor-pointer"><summary className="text-[#666]">Diff ({Object.keys(r.before).length} champs)</summary>
                      <pre className="bg-[#fafafa] dark:bg-[#141414] rounded p-2 mt-1 overflow-x-auto text-[10px] max-w-md">{JSON.stringify({ before: r.before, after: r.after }, null, 2)}</pre>
                    </details>
                  ) : r.after ? (
                    <details className="cursor-pointer"><summary className="text-[#666]">Détails</summary>
                      <pre className="bg-[#fafafa] dark:bg-[#141414] rounded p-2 mt-1 overflow-x-auto text-[10px] max-w-md">{JSON.stringify(r.after, null, 2)}</pre>
                    </details>
                  ) : <span className="text-[#999]">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-[#666]">{filtered.length} action(s) affichée(s) · total {rows.length}</div>
    </div>
  );
}
