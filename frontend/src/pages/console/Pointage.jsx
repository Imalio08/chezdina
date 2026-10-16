import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { openPdf } from "@/components/shared/PdfPreview";
import { Users, Clock, AlertTriangle, Download, FileText, Target, Save } from "lucide-react";
import KPICard from "@/components/shared/KPICard";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";

const ROLE_LABELS = { manager: "Gérante", sales: "Vendeuse", stock_keeper: "Magasinier", community_manager: "Community manager" };

function PresenceAccess() {
  const { user } = useAuth();
  const [roles, setRoles] = useState(null);
  useEffect(() => { if (user?.role === "admin") api.get("/attendance/access").then(r => setRoles(r.data?.roles || [])).catch(() => {}); }, [user?.role]);
  if (user?.role !== "admin" || !roles) return null;
  const toggle = async (r) => {
    const next = roles.includes(r) ? roles.filter(x => x !== r) : [...roles, r];
    try { await api.patch("/attendance/access", { roles: next }); setRoles(next); toast.success("Accès aux Présences mis à jour"); }
    catch { toast.error("Modification impossible"); }
  };
  return (
    <div className="dina-card-white p-3 flex items-center gap-2 flex-wrap text-xs" data-testid="presence-access">
      <span className="font-semibold">Qui peut voir les Présences :</span><span className="dina-chip">Propriétaire</span>
      {Object.entries(ROLE_LABELS).map(([k, l]) => (
        <label key={k} className="inline-flex items-center gap-1 cursor-pointer"><input type="checkbox" className="accent-[#b02a2a]" checked={roles.includes(k)} onChange={() => toggle(k)} data-testid={`presence-role-${k}`}/>{l}</label>
      ))}
      <Link to="/console/pointage" className="ml-auto text-[#b02a2a] hover:underline" data-testid="presence-kiosk-link">Ouvrir le kiosque de pointage →</Link>
    </div>
  );
}

export default function Pointage() {
  const [today, setToday] = useState(null);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [stats, setStats] = useState(null);
  const [allStats, setAllStats] = useState(null);
  const [periodDays, setPeriodDays] = useState(30);
  const [site, setSite] = useState({});

  const load = async () => {
    const [t, s, b] = await Promise.all([
      api.get("/attendance/today").catch(() => ({ data: null })),
      api.get(`/attendance/all-stats?days=${periodDays}`).catch(() => ({ data: null })),
      api.get("/public/site").catch(() => ({ data: null })),
    ]);
    setToday(t.data);
    setAllStats(s.data);
    setSite(b.data || {});
  };
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [periodDays]); // eslint-disable-line

  const openEmployee = async (eid) => {
    setSelectedEmp(eid);
    const month = new Date().toISOString().slice(0, 7);
    const [c, s] = await Promise.all([
      api.get(`/attendance/calendar/${eid}?month=${month}`),
      api.get(`/attendance/stats/${eid}?days=${periodDays}`),
    ]);
    setCalendar(c.data); setStats(s.data);
  };

  const timeOf = (iso) => iso ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—";

  const exportCSV = () => {
    if (!allStats?.rows?.length) return toast.error("Aucune donnée à exporter");
    const header = ["Nom", "Rôle", "Jours travaillés", "Absences", "Retards (count)", "Minutes retard", "Heure moyenne arrivée", "Ponctualité (%)"];
    const lines = [header.join(";")];
    allStats.rows.forEach(r => {
      lines.push([
        `"${(r.name || "").replace(/"/g, '""')}"`,
        r.role || "",
        r.worked_days ?? 0,
        r.absences ?? 0,
        r.late_count ?? 0,
        r.late_min_total ?? 0,
        r.avg_arrival || "",
        r.punctuality_pct ?? 0,
      ].join(";"));
    });
    const bom = "\uFEFF"; // Excel-friendly UTF-8
    const blob = new Blob([bom + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pointages-${periodDays}j-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exporté");
  };

  const exportPDF = () => {
    if (!allStats?.rows?.length) return toast.error("Aucune donnée à exporter");
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
    const W = doc.internal.pageSize.getWidth();
    let y = 15;

    // Header
    if (site.logo) {
      try { doc.addImage(site.logo, "PNG", 10, 8, 15, 15); } catch { /* ignore */ }
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text(site.name || "Chez Dina", 28, 15);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(`Historique pointages · ${periodDays} derniers jours`, 28, 20);
    doc.text(`Généré le ${new Date().toLocaleString("fr-FR")}`, 28, 24);
    y = 32;

    // Table
    const cols = [
      { k: "name", t: "Employé", w: 55 },
      { k: "role", t: "Rôle", w: 32 },
      { k: "worked_days", t: "Jours", w: 20, right: true },
      { k: "absences", t: "Absences", w: 22, right: true },
      { k: "late_count", t: "Retards", w: 22, right: true },
      { k: "late_min_total", t: "Minutes de retard", w: 24, right: true },
      { k: "avg_arrival", t: "Arrivée moyenne", w: 28 },
      { k: "punctuality_pct", t: "Ponctualité", w: 25, right: true },
    ];
    let x = 10;
    doc.setFillColor(176, 42, 42);
    doc.rect(10, y, W - 20, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    cols.forEach(c => { doc.text(c.t, c.right ? x + c.w - 2 : x + 2, y + 5, { align: c.right ? "right" : "left" }); x += c.w; });
    y += 7;
    doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal");

    allStats.rows.forEach((r, i) => {
      if (y > 190) { doc.addPage(); y = 15; }
      if (i % 2 === 0) { doc.setFillColor(249, 245, 245); doc.rect(10, y, W - 20, 6.5, "F"); }
      x = 10;
      cols.forEach(c => {
        const v = r[c.k];
        let txt = v == null ? "—" : String(v);
        if (c.k === "punctuality_pct" && v != null) txt = `${v}%`;
        doc.text(txt, c.right ? x + c.w - 2 : x + 2, y + 4.5, { align: c.right ? "right" : "left" });
        x += c.w;
      });
      y += 6.5;
    });

    // Totals
    y += 4;
    const totWorked = allStats.rows.reduce((s, r) => s + (r.worked_days || 0), 0);
    const totAbs = allStats.rows.reduce((s, r) => s + (r.absences || 0), 0);
    const totLate = allStats.rows.reduce((s, r) => s + (r.late_count || 0), 0);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text(`Total · ${allStats.rows.length} employés · ${totWorked} jours travaillés · ${totAbs} absences · ${totLate} retards`, 10, y);

    openPdf(doc, `pointages-${periodDays}j-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF généré");
  };

  if (!today) return <div className="text-sm text-[#666] text-center py-10">Chargement…</div>;

  return (
    <div className="space-y-5" data-testid="pointage-page">
      <PresenceAccess/>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-3xl">Présences</h1>
          <p className="text-sm text-[#666]">Historique, retards, absences, heures travaillées et statistiques par employé · le pointage se fait depuis le bouton de la barre du haut</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={periodDays} onChange={e => setPeriodDays(+e.target.value)} className="dina-input !h-9 text-sm" data-testid="period-days">
            <option value={7}>7 jours</option>
            <option value={30}>30 jours</option>
            <option value={60}>60 jours</option>
            <option value={90}>90 jours</option>
          </select>
          <button onClick={exportCSV} className="dina-btn-secondary !min-h-[36px] text-sm" data-testid="export-csv">
            <Download size={13}/>CSV
          </button>
          <button onClick={exportPDF} className="dina-btn-primary !min-h-[36px] text-sm" data-testid="export-pdf">
            <FileText size={13}/>PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard testid="kpi-present" label="Présents aujourd'hui" value={today.present_count} icon={Users} color="#1f8a4c"/>
        <KPICard testid="kpi-absents" label="Non pointés" value={today.not_checked_in.length} icon={AlertTriangle} color="#c62828"/>
        <KPICard testid="kpi-late" label="Retards aujourd'hui" value={today.today.filter(a => a.late).length} icon={Clock} color="#e4991e"/>
        <KPICard testid="kpi-employees" label="Employés actifs" value={today.total_employees} icon={Users} color="#5867fd"/>
      </div>

      {allStats?.rows && (
        <div className="dina-card-white p-5" data-testid="stats-table">
          <div className="font-serif text-xl mb-3">Statistiques sur {periodDays} jours</div>
          <div className="overflow-x-auto">
            <table className="dina-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Employé</th>
                  <th className="text-left">Rôle</th>
                  <th className="text-right">Jours travaillés</th>
                  <th className="text-right">Absences</th>
                  <th className="text-right">Retards</th>
                  <th className="text-right">Minutes de retard</th>
                  <th>Arrivée moyenne</th>
                  <th className="text-right">Ponctualité</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {allStats.rows.map(r => (
                  <tr key={r.user_id} className="hover:bg-[#fff5f5] dark:hover:bg-[#2a1818]" data-testid={`stat-row-${r.user_id}`}>
                    <td className="font-medium">{r.name}</td>
                    <td className="text-[#666]">{ROLE_LABELS[r.role] || (r.role === "admin" ? "Propriétaire" : r.role === "rider" ? "Livreur" : r.role)}</td>
                    <td className="text-right tabular">{r.worked_days}</td>
                    <td className={`text-right tabular ${r.absences > 5 ? "text-[#c62828] font-semibold" : ""}`}>{r.absences}</td>
                    <td className={`text-right tabular ${r.late_count > 3 ? "text-[#e4991e] font-semibold" : ""}`}>{r.late_count}</td>
                    <td className="text-right tabular text-[#666]">{r.late_min_total}</td>
                    <td className="tabular text-[#666]">{r.avg_arrival || "—"}</td>
                    <td className="text-right">
                      <span className={`font-semibold tabular ${r.punctuality_pct >= 90 ? "text-[#1f8a4c]" : r.punctuality_pct >= 70 ? "text-[#e4991e]" : "text-[#c62828]"}`}>{r.punctuality_pct}%</span>
                    </td>
                    <td className="text-right">
                      <button onClick={() => openEmployee(r.user_id)} className="text-[#5867fd] text-xs hover:underline" data-testid={`detail-${r.user_id}`}>Détail</button>
                    </td>
                  </tr>
                ))}
                {allStats.rows.length === 0 && (
                  <tr><td colSpan={9} className="text-center text-[#666] py-6">Aucun employé actif</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="dina-card-white p-5">
        <div className="font-serif text-xl mb-3">Pointages d'aujourd'hui ({today.today.length})</div>
        {today.today.length === 0 && <div className="text-sm text-[#666] text-center py-6">Aucun pointage encore</div>}
        <div className="space-y-2">
          {today.today.map(a => (
            <button key={a.id} onClick={() => openEmployee(a.user_id)} className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#fff5f5] dark:hover:bg-[#2a1818] text-left" data-testid={`punch-${a.id}`}>
              {a.selfie ? <img src={a.selfie} alt="" className="w-10 h-10 rounded-full object-cover scale-x-[-1]"/> : <div className="w-10 h-10 rounded-full bg-[#fde8e8] grid place-items-center font-bold text-[#b02a2a]">{a.user_name?.[0]}</div>}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{a.user_name} · <span className="text-[#666] text-xs">{ROLE_LABELS[a.user_role] || (a.user_role === "admin" ? "Propriétaire" : a.user_role === "rider" ? "Livreur" : a.user_role)}</span></div>
                <div className="text-xs text-[#666]">{timeOf(a.at)} · {a.method === "tablet" ? "tablette" : "téléphone"}{a.late ? ` · retard ${a.late_min} min` : ""}</div>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                {a.kind === "arrival" ? <span className="text-[10px] text-[#1f8a4c] font-semibold uppercase">Arrivée</span> : <span className="text-[10px] text-[#5867fd] font-semibold uppercase">Départ</span>}
                {(a.flags || []).map(f => <span key={f} className="text-[9px] text-[#c62828]">{f.replace(/_/g, " ")}</span>)}
              </div>
            </button>
          ))}
        </div>
        {today.not_checked_in.length > 0 && (
          <>
            <div className="font-semibold text-sm mt-4 mb-2 text-[#c62828]">Non pointés ({today.not_checked_in.length})</div>
            <div className="flex flex-wrap gap-1.5">
              {today.not_checked_in.map(e => <button key={e.id} onClick={() => openEmployee(e.id)} className="dina-chip !border-[#c62828] !text-[#c62828]">{e.name}</button>)}
            </div>
          </>
        )}
      </div>

      {selectedEmp && stats && calendar && (
        <div className="dina-card-white p-5" data-testid="employee-detail">
          <div className="flex items-center justify-between mb-3">
            <div className="font-serif text-xl">Détail employé</div>
            <button onClick={() => { setSelectedEmp(null); setCalendar(null); setStats(null); }} className="text-sm text-[#666]">Fermer</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <KPICard label="Ponctualité" value={`${stats.punctuality_pct}%`} color="#1f8a4c"/>
            <KPICard label="Jours travaillés" value={stats.worked_days} color="#5867fd"/>
            <KPICard label="Retards" value={stats.late_count} color="#e4991e"/>
            <KPICard label="Minutes retard" value={stats.late_min_total} color="#c62828"/>
            <KPICard label="Hors boutique" value={stats.outside_count} color="#999"/>
          </div>
          <div className="text-xs text-[#666] mb-2">Calendrier {calendar.month} · heure moyenne d'arrivée : <b>{stats.avg_arrival || "—"}</b></div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => {
              const key = `${calendar.month}-${String(d).padStart(2, "0")}`;
              const day = calendar.days[key];
              const color = !day ? "bg-[#f5f5f5] dark:bg-[#141414] text-[#999]" : day.late ? "bg-[#e4991e]/20 text-[#e4991e]" : "bg-[#1f8a4c]/15 text-[#1f8a4c]";
              return <div key={d} className={`h-14 rounded-md p-1 ${color} text-[10px]`} title={day ? `Arr: ${day.arrival?.slice(11, 16) || "-"} · Dép: ${day.departure?.slice(11, 16) || "-"}${day.late ? ` · +${day.late_min}min` : ""}` : "Absent"}>
                <div className="font-bold text-xs">{d}</div>
                {day?.arrival && <div>{day.arrival.slice(11, 16)}</div>}
              </div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
