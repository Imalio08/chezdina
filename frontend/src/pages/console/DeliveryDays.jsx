import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { fcfa, statusLabel, statusColor, dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Calendar, Package, DollarSign, AlertTriangle, CheckCircle2, Users, X, Printer, Map, Sparkles, UserPlus, FileText } from "lucide-react";
import KPICard from "@/components/shared/KPICard";
import LiveDeliveryMap from "@/components/delivery/LiveDeliveryMap";
import jsPDF from "jspdf";

/** Build a printable route-sheet PDF for a rider's day: list of orders with addresses, phones, amounts. */
function printRouteSheetPDF(session, assigned, brand = {}) {
  const doc = new jsPDF();
  const pad = 15;
  // Header: logo + brand
  let hy = 18;
  if (brand.logo) {
    try { doc.addImage(brand.logo, "PNG", pad, 10, 14, 14); } catch { /* ignore malformed logo */ }
    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text(brand.name || "Chez Dina", pad + 18, 18);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text("Feuille de route livreur", pad + 18, 24);
    hy = 30;
  } else {
    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text(`${brand.name || "Chez Dina"} — Feuille de route livreur`, pad, 18);
    hy = 24;
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(`Livreur : ${session.rider_name || "—"}`, pad, hy + 2);
  doc.text(`Journée : ${session.date || (session.created_at || "").slice(0,10)}`, pad, hy + 8);
  doc.text(`Commandes affectées : ${assigned.length}`, pad, hy + 14);
  const totalToCollect = assigned.reduce((s,o) => s + (o.payment_method === "cod" ? (o.total || 0) : 0), 0);
  doc.text(`Total à encaisser (COD) : ${fcfa(totalToCollect)}`, pad, hy + 20);
  let y = hy + 32;
  doc.setFont("helvetica", "bold");
  doc.text("#", pad, y);
  doc.text("Code", pad + 10, y);
  doc.text("Cliente / Téléphone", pad + 40, y);
  doc.text("Adresse", pad + 95, y);
  doc.text("À encaisser", 195, y, { align: "right" });
  y += 2; doc.line(pad, y, 195, y); y += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  assigned.forEach((o, i) => {
    if (y > 275) { doc.addPage(); y = 20; }
    const toCollect = o.payment_method === "cod" ? (o.total || 0) : 0;
    doc.text(String(i + 1), pad, y);
    doc.text((o.code || "").slice(0, 14), pad + 10, y);
    doc.text(((o.customer?.name || "—") + " · " + (o.customer?.phone || "")).slice(0, 36), pad + 40, y);
    const addr = ((o.delivery_zone || "") + " · " + (o.delivery_address || o.customer?.address || "")).slice(0, 50);
    doc.text(addr, pad + 95, y);
    doc.text(toCollect > 0 ? fcfa(toCollect) : "Payé", 195, y, { align: "right" });
    y += 5;
    if (o.notes) {
      doc.setTextColor(120); doc.text(("Note : " + o.notes).slice(0, 90), pad + 10, y); doc.setTextColor(0); y += 5;
    }
    doc.setDrawColor(220); doc.line(pad, y - 1, 195, y - 1); doc.setDrawColor(0);
  });
  doc.setFont("helvetica", "italic"); doc.setFontSize(8);
  doc.text("Signature livreur : _______________________    Signature bureau : _______________________", pad, 285);
  doc.save(`feuille-route-${(session.rider_name || "livreur").replace(/\s+/g, "-")}-${session.date || "jour"}.pdf`);
}

export default function DeliveryDays() {
  const [sessions, setSessions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [riders, setRiders] = useState([]);
  const [open, setOpen] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = async () => {
    const [s, o, t] = await Promise.all([api.get("/delivery-sessions"), api.get("/orders"), api.get("/team")]);
    setSessions(s.data || []); setOrders(o.data || []); setRiders((t.data||[]).filter(u => u.role === "rider"));
  };
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  const kpi = useMemo(() => {
    const open = sessions.filter(s => !s.closed).length;
    const closed = sessions.filter(s => s.closed).length;
    const toCollect = sessions.reduce((s,sess) => s + ((sess.orders_detail||sess.orders||[]).reduce((a,o)=>a+(o.to_collect||o.total||0),0)), 0);
    return { open, closed, toCollect };
  }, [sessions]);

  if (open) {
    const session = sessions.find(s => s.id === open.id) || open;
    return <DayDetail session={session} orders={orders} riders={riders} onBack={()=>{setOpen(null); load();}} onReload={load}/>;
  }

  return (
    <div className="space-y-5" data-testid="delivery-days-page">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Journées de livraison</h1><p className="text-sm text-[#666]">Planification quotidienne, affectation, suivi, réconciliation</p></div>
        <button onClick={()=>setCreateOpen(true)} className="dina-btn-primary !min-h-[40px]" data-testid="dd-create-open"><Plus size={14}/>Créer une journée</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard testid="dd-open" label="Journées ouvertes" value={kpi.open} icon={Calendar} color="#5867fd"/>
        <KPICard testid="dd-closed" label="Clôturées" value={kpi.closed} icon={CheckCircle2} color="#1f8a4c"/>
        <KPICard testid="dd-tocollect" label="À encaisser" value={fcfa(kpi.toCollect)} icon={DollarSign} color="#b02a2a"/>
        <KPICard testid="dd-riders" label="Livreurs actifs" value={riders.length} icon={Users} color="#f4b12c"/>
      </div>

      <div className="dina-card-white overflow-hidden">
        <table className="dina-table" data-testid="dd-table">
          <thead><tr><th>Date</th><th>Statut</th><th>Livreur</th><th className="text-right">Cmd</th><th className="text-right">Livrées</th><th className="text-right">À encaisser</th><th></th></tr></thead>
          <tbody>{sessions.length === 0 ? <tr><td colSpan={7} className="text-center text-sm text-[#666] py-10">Aucune journée · créez-en une pour commencer</td></tr> :
            sessions.map(s => (
              <tr key={s.id} className="cursor-pointer hover:bg-[#fafafa] dark:hover:bg-[#141414]" onClick={()=>setOpen(s)} data-testid={`dd-row-${s.id}`}>
                <td className="font-medium">{s.date || s.created_at?.slice(0,10)}</td>
                <td><span className="dina-chip !py-0.5 text-[10px]" style={{color:s.closed?"#1f8a4c":"#5867fd",borderColor:s.closed?"#1f8a4c":"#5867fd"}}>{s.closed?"Clôturée":"Ouverte"}</span></td>
                <td>{s.rider_name}</td>
                <td className="text-right tabular">{(s.orders_detail||s.orders||[]).length}</td>
                <td className="text-right tabular text-[#1f8a4c]">{s.delivered_count ?? (s.orders_detail||[]).filter(o=>o.status==="livree").length}</td>
                <td className="text-right tabular font-semibold">{fcfa(s.total_to_collect || (s.orders_detail||[]).reduce((a,o)=>a+(o.total||0),0))}</td>
                <td className="text-right"><span className="text-[#5867fd] text-xs">Ouvrir →</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {createOpen && <CreateDayModal riders={riders} onClose={()=>setCreateOpen(false)} onDone={()=>{setCreateOpen(false); load();}}/>}
    </div>
  );
}

function CreateDayModal({ riders, onClose, onDone }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [riderId, setRiderId] = useState(riders[0]?.id || "");
  const [submitting, setSubmitting] = useState(false);
  const rider = riders.find(r => r.id === riderId);
  const submit = async () => {
    if (!riderId || !rider) return toast.error("Choisissez un livreur");
    setSubmitting(true);
    try {
      await api.post("/delivery-sessions", { rider_id: rider.id, rider_name: rider.name, date });
      toast.success(`Journée créée · ${rider.name} · ${date}`);
      onDone();
    } catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
    finally { setSubmitting(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md" onClick={e=>e.stopPropagation()} data-testid="create-day-modal">
        <div className="flex items-center justify-between mb-4"><div className="font-serif text-xl">Créer une journée</div><button onClick={onClose}><X size={18}/></button></div>
        <label className="text-xs uppercase text-[#666] font-semibold">Date</label>
        <input type="date" className="dina-input mt-1 mb-3" value={date} onChange={e=>setDate(e.target.value)} data-testid="create-day-date"/>
        <label className="text-xs uppercase text-[#666] font-semibold">Livreur</label>
        <select className="dina-input mt-1 mb-4" value={riderId} onChange={e=>setRiderId(e.target.value)} data-testid="create-day-rider">
          <option value="">Choisir un livreur…</option>
          {riders.map(r => <option key={r.id} value={r.id}>{r.name}{r.active===false?" (inactif)":""}</option>)}
        </select>
        {!riders.length && <div className="text-xs text-[#c62828] mb-3">Aucun livreur · créez-en un depuis la page Équipe</div>}
        <div className="flex gap-2">
          <button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button>
          <button onClick={submit} disabled={submitting || !riderId} className="dina-btn-primary flex-1" data-testid="create-day-confirm">Créer</button>
        </div>
      </div>
    </div>
  );
}

function DayDetail({ session, orders, riders, onBack, onReload }) {
  const [brand, setBrand] = useState({ logo: "", name: "Chez Dina" });
  useEffect(() => { api.get("/public/site").then(r => setBrand({ logo: r.data?.logo || "", name: r.data?.name || "Chez Dina" })).catch(() => {}); }, []);
  const nav = useNavigate();
  const [tab, setTab] = useState("affectation");
  const [selected, setSelected] = useState([]);
  const [assignTo, setAssignTo] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [locations, setLocations] = useState([]);
  const sid = session.id;
  const ready = orders.filter(o => o.mode === "delivery" && (o.status === "prete" || o.status === "confirmee") && !o.rider_id);
  const assigned = session.orders_detail || orders.filter(o => (session.orders||[]).includes(o.id));

  useEffect(() => {
    if (tab !== "suivi") return;
    const load = () => api.get("/riders/locations").then(r => setLocations(r.data || [])).catch(()=>{});
    load(); const t = setInterval(load, 15000); return () => clearInterval(t);
  }, [tab]);

  const addSelectedToSession = async () => {
    if (!selected.length) return toast.error("Sélectionnez des commandes");
    try {
      for (const oid of selected) await api.patch(`/delivery-sessions/${sid}/add-order`, { order_id: oid });
      toast.success(`${selected.length} commande(s) affectée(s) à ${session.rider_name}`);
      setSelected([]); setAssignTo(null); onReload();
    } catch { toast.error("Erreur affectation"); }
  };

  const askSuggestion = async () => {
    try {
      const r = await api.post("/deliveries/suggest-split", { order_ids: ready.map(o=>o.id) });
      setSuggestions(r.data);
      toast.success(`Suggestion générée · ${(r.data.suggestions||[]).length} livreur(s)`);
    } catch (e) { toast.error("Erreur suggestion"); }
  };

  const applySuggestion = async (sug) => {
    try {
      // Only orders for THIS session's rider — ask user before cross-rider assign
      const mine = sug.find(s => s.rider_id === session.rider_id);
      if (!mine) return toast.error(`Aucune proposition pour ${session.rider_name}`);
      if (!confirm(`Affecter ${mine.orders.length} commande(s) à ${session.rider_name} selon la suggestion ?`)) return;
      for (const oid of mine.orders) await api.patch(`/delivery-sessions/${sid}/add-order`, { order_id: oid });
      toast.success(`${mine.orders.length} commande(s) affectée(s)`);
      setSuggestions(null); setSelected([]); onReload();
    } catch { toast.error("Erreur"); }
  };

  const close = async () => {
    if (!confirm("Clôturer définitivement la journée ?")) return;
    try { await api.patch(`/delivery-sessions/${sid}/close`); toast.success("Journée clôturée"); onBack(); }
    catch { toast.error("Erreur"); }
  };

  return (
    <div className="space-y-4" data-testid="day-detail">
      <button onClick={onBack} className="text-sm text-[#666] hover:text-[#b02a2a]">← Retour aux journées</button>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-2xl">Journée · {session.date || session.created_at?.slice(0,10)}</h1><div className="text-sm text-[#666]">Livreur : <b>{session.rider_name}</b> · {assigned.length} commandes</div></div>
        {!session.closed && <button onClick={close} className="dina-btn-primary !min-h-[40px]" data-testid="dd-close">Clôturer la journée</button>}
      </div>

      <div className="flex gap-1 border-b border-[#ececec] dark:border-[#2a2a2a] overflow-x-auto">
        {[["affectation","Affectation"],["suivi","Suivi"],["reconciliation","Réconciliation"],["fiches","Fiches & feuilles"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} className={`px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap ${tab===k?"border-[#b02a2a] text-[#b02a2a]":"border-transparent text-[#666]"}`} data-testid={`day-tab-${k}`}>{l}</button>
        ))}
      </div>

      {tab === "affectation" && (
        <>
          <div className="dina-card-white p-3 flex flex-wrap items-center gap-2 justify-between">
            <div className="text-xs text-[#666]"><b className="text-[#1c1c1c] dark:text-white">{selected.length}</b> sélectionnée(s) · <b>{ready.length}</b> commandes prêtes à affecter</div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={askSuggestion} disabled={!ready.length} className="dina-btn-secondary !min-h-[36px] text-xs !text-[#5867fd]" data-testid="dd-suggest"><Sparkles size={12}/>Suggérer une répartition</button>
              {selected.length > 0 && (
                <>
                  <button onClick={addSelectedToSession} className="dina-btn-primary !min-h-[36px] text-xs" data-testid="dd-affect-current"><UserPlus size={12}/>Affecter à {session.rider_name}</button>
                  <button onClick={()=>setAssignTo({mode:"pick"})} className="dina-btn-secondary !min-h-[36px] text-xs" data-testid="dd-affect-other">Affecter à un autre livreur…</button>
                </>
              )}
            </div>
          </div>

          {suggestions && (
            <div className="dina-card-white p-4 bg-[#eef0ff]/40 dark:bg-[#141633]/30 border-l-4 border-[#5867fd]" data-testid="dd-suggestions">
              <div className="flex items-center justify-between mb-3"><div className="font-serif text-lg flex items-center gap-2"><Sparkles size={16} className="text-[#5867fd]"/>Répartition proposée</div><button onClick={()=>setSuggestions(null)} className="text-[#666]"><X size={14}/></button></div>
              <div className="space-y-2">
                {(suggestions.suggestions||[]).map(s => (
                  <div key={s.rider_id} className="flex items-center gap-3 bg-white dark:bg-[#1a1a1a] p-2.5 rounded-lg" data-testid={`sug-${s.rider_id}`}>
                    <div className="flex-1 min-w-0"><div className="font-semibold text-sm">{s.rider_name}</div><div className="text-xs text-[#666] truncate">{s.orders.length} cmd · zones : {s.zones.join(", ") || "—"} · charge totale {s.total_load}</div></div>
                    {s.rider_id === session.rider_id ? <button onClick={()=>applySuggestion(suggestions.suggestions)} className="dina-btn-primary !min-h-[32px] text-xs" data-testid={`sug-apply-${s.rider_id}`}>Appliquer</button>
                     : <span className="text-[10px] text-[#999]">Autre livreur</span>}
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-[#666] mt-3 italic">La suggestion groupe par zone et équilibre la charge entre livreurs actifs. Vous validez ou modifiez avant d'affecter.</div>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="dina-card-white p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-serif text-lg">Commandes prêtes ({ready.length})</div>
                {ready.length > 0 && <button onClick={()=>setSelected(selected.length===ready.length?[]:ready.map(o=>o.id))} className="text-xs text-[#5867fd] hover:underline" data-testid="dd-select-all">{selected.length===ready.length?"Tout désélectionner":"Tout sélectionner"}</button>}
              </div>
              {ready.length === 0 && <div className="text-sm text-[#666] text-center py-6">Aucune commande prête à affecter</div>}
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                {ready.map(o => (
                  <label key={o.id} className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition ${selected.includes(o.id)?"border-[#b02a2a] bg-[#fff5f5] dark:bg-[#2a1818]":"border-[#ececec] dark:border-[#2a2a2a] hover:bg-[#fafafa] dark:hover:bg-[#141414]"}`} data-testid={`ready-${o.id}`}>
                    <input type="checkbox" checked={selected.includes(o.id)} onChange={()=>setSelected(s => s.includes(o.id)?s.filter(x=>x!==o.id):[...s,o.id])} className="accent-[#b02a2a] w-4 h-4"/>
                    <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{o.code} · {o.customer?.name}</div><div className="text-xs text-[#666] truncate">{o.delivery_zone || "—"} · {fcfa(o.total)}</div></div>
                  </label>
                ))}
              </div>
            </div>
            <div className="dina-card-white p-4">
              <div className="font-serif text-lg mb-3">Commandes de la journée ({assigned.length})</div>
              {assigned.length === 0 ? <div className="text-sm text-[#666] text-center py-6">Aucune commande encore affectée · utilisez les cases à cocher à gauche</div> :
                <div className="space-y-1.5 max-h-[500px] overflow-y-auto">{assigned.map(o => (
                  <div key={o.id} className="flex items-center gap-2 p-2 border border-[#ececec] dark:border-[#2a2a2a] rounded-lg" data-testid={`assigned-${o.id}`}>
                    <span className="dina-chip !py-0.5 text-[9px]" style={{color:statusColor[o.status]||"#999",borderColor:statusColor[o.status]||"#999"}}>{statusLabel[o.status]||o.status}</span>
                    <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{o.code} · {o.customer?.name}</div><div className="text-xs text-[#666] truncate">{o.delivery_zone} · {fcfa(o.total)}</div></div>
                  </div>
                ))}</div>
              }
            </div>
          </div>
        </>
      )}

      {tab === "suivi" && (
        <div className="space-y-3">
          <div className="dina-card-white p-3 flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm font-semibold flex items-center gap-2"><Map size={14}/>Suivi en direct · {assigned.length} commande(s) · {locations.length} livreur(s) en ligne</div>
            <div className="text-xs text-[#666]">Actualisation auto toutes les 15 s</div>
          </div>
          <LiveDeliveryMap riders={locations} orders={assigned}/>
          <div className="dina-card-white p-4 max-h-80 overflow-y-auto">
            {assigned.length === 0 ? <div className="text-sm text-[#666] text-center py-6">Aucune commande affectée</div> :
              assigned.map(o => (
                <div key={o.id} className="flex items-center gap-2 py-2 border-b border-[#f0f0f0] last:border-0 dark:border-[#2a2a2a]">
                  <span className="dina-chip !py-0.5 text-[10px]" style={{color:statusColor[o.status]||"#999",borderColor:statusColor[o.status]||"#999"}}>{statusLabel[o.status]||o.status}</span>
                  <span className="text-sm flex-1 truncate">{o.code} · {o.customer?.name}{o.delivery_zone && ` · ${o.delivery_zone}`}</span>
                  <span className="text-xs tabular font-semibold">{fcfa(o.total||0)}</span>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {tab === "reconciliation" && (
        <div className="dina-card-white p-4">
          <div className="font-serif text-lg mb-3">Réconciliation</div>
          <table className="dina-table">
            <thead><tr><th>Commande</th><th>Statut</th><th className="text-right">Articles</th><th className="text-right">Livraison</th><th className="text-right">Déjà payé</th><th className="text-right">À encaisser</th></tr></thead>
            <tbody>{assigned.length === 0 ? <tr><td colSpan={6} className="text-center text-sm text-[#666] py-6">Aucune donnée</td></tr> :
              assigned.map(o => (
                <tr key={o.id}>
                  <td className="font-medium">{o.code}</td>
                  <td><span className="dina-chip !py-0.5 text-[10px]">{statusLabel[o.status]||o.status}</span></td>
                  <td className="text-right tabular">{fcfa(o.subtotal||0)}</td>
                  <td className="text-right tabular">{fcfa(o.delivery_fee||0)}</td>
                  <td className="text-right tabular text-[#1f8a4c]">{o.payment_status==="paye"?fcfa(o.total||0):"—"}</td>
                  <td className="text-right tabular">{fcfa(o.payment_method==="cod"?(o.total||0):0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "fiches" && (
        <div className="dina-card-white p-4" data-testid="dd-fiches-tab">
          <div className="font-serif text-lg mb-1">Fiches colis & feuille de route</div>
          <div className="text-xs text-[#666] mb-3">{assigned.length} commande(s) affectée(s) à {session.rider_name || "ce livreur"}</div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => {
                if (!assigned.length) return toast.error("Aucune commande affectée");
                const ids = assigned.map(o => o.id).join(",");
                nav(`/console/fiches-colis?ids=${encodeURIComponent(ids)}`);
              }}
              className="dina-btn-secondary" data-testid="dd-print-fiches"
            ><Printer size={14}/>Imprimer les fiches colis</button>
            <button
              onClick={() => {
                if (!assigned.length) return toast.error("Aucune commande affectée");
                printRouteSheetPDF(session, assigned, brand);
                toast.success("Feuille de route générée");
              }}
              className="dina-btn-primary" data-testid="dd-print-routesheet"
            ><FileText size={14}/>Feuille de route livreur (PDF)</button>
          </div>
          <div className="mt-4 text-xs text-[#666]">La feuille de route liste cliente, téléphone, adresse et montant à encaisser pour chaque commande.<br/>Les fiches colis génèrent une étiquette imprimable par commande (format A4, A6 ou thermique 80 mm).</div>
        </div>
      )}

      {assignTo?.mode === "pick" && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={()=>setAssignTo(null)}>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-5 w-full max-w-md" onClick={e=>e.stopPropagation()} data-testid="pick-rider-modal">
            <div className="flex items-center justify-between mb-3"><div className="font-serif text-lg">Affecter à un autre livreur</div><button onClick={()=>setAssignTo(null)}><X size={14}/></button></div>
            <div className="text-xs text-[#666] mb-3">{selected.length} commande(s) à affecter · elles rejoindront la journée de ce livreur</div>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {riders.map(r => (
                <button key={r.id} onClick={async () => {
                  try {
                    for (const oid of selected) await api.patch(`/deliveries/${oid}/assign`, { rider_id: r.id, rider_name: r.name });
                    toast.success(`${selected.length} commande(s) affectée(s) à ${r.name}`);
                    setSelected([]); setAssignTo(null); onReload();
                  } catch { toast.error("Erreur"); }
                }} className="flex items-center gap-3 p-2.5 border border-[#ececec] dark:border-[#2a2a2a] rounded-lg w-full text-left hover:border-[#b02a2a]" data-testid={`pick-rider-${r.id}`}>
                  <div className="w-10 h-10 rounded-full bg-[#fde8e8] grid place-items-center font-bold text-[#b02a2a]">{r.name?.[0]}</div>
                  <div className="flex-1 min-w-0"><div className="font-medium text-sm truncate">{r.name}</div><div className="text-xs text-[#666]">{r.phone || "—"}</div></div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
