import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useKeptState } from "@/lib/keptState";
import { fcfa, statusLabel, statusColor, dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Calendar, Package, DollarSign, AlertTriangle, CheckCircle2, Users, X, Printer, Map, Sparkles, UserPlus, FileText } from "lucide-react";
import KPICard from "@/components/shared/KPICard";
import LiveDeliveryMap from "@/components/delivery/LiveDeliveryMap";
import { VersementCell, missingVersements, OrderDayStatus } from "@/components/delivery/VersementCell";
import { SlotPickerModal, SlotBadge } from "@/components/delivery/SlotPicker";
import { ReconcileLineModal } from "@/pages/console/Deliveries";
import { downloadAllRiderRoutesPDF, downloadRiderRoutePDF, fetchBusinessForPdf } from "@/lib/pdfInvoice";

export default function DeliveryDays() {
  const [sessions, setSessions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [riders, setRiders] = useState([]);
  const [open, setOpen] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [sf, setSf] = useState({ date: "", rider: "", state: "" });
  const shownSessions = sessions.filter(s => (!sf.date || (s.date || s.created_at?.slice(0,10)) === sf.date) && (!sf.rider || s.rider_id === sf.rider) && (!sf.state || (sf.state === "closed") === !!s.closed));

  const load = async () => {
    const [s, o, t] = await Promise.all([api.get("/delivery-sessions"), api.get("/orders"), api.get("/team")]);
    setSessions(s.data || []); setOrders(o.data || []); setRiders((t.data||[]).filter(u => u.role === "rider"));
  };
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  const kpi = useMemo(() => {
    const open = sessions.filter(s => !s.closed).length;
    const closed = sessions.filter(s => s.closed).length;
    const toCollect = sessions.reduce((s,sess) => s + (sess.total_to_collect || 0), 0);
    return { open, closed, toCollect };
  }, [sessions]);

  const printAll = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const byRider = {};
    sessions.filter(s => s.date === today).forEach(s => {
      const g = byRider[s.rider_id] || (byRider[s.rider_id] = { rider: { name: s.rider_name, zone: riders.find(r => r.id === s.rider_id)?.zone }, orders: [] });
      g.orders.push(...(s.orders_detail || []).filter(o => !o.postponed_to && o.status !== "annulee"));
    });
    const groups = Object.values(byRider).filter(g => g.orders.length);
    if (!groups.length) return toast.error("Aucun livreur avec des courses aujourd'hui");
    downloadAllRiderRoutesPDF(groups, await fetchBusinessForPdf(api));
    toast.success(`${groups.length} feuille(s) de route générée(s)`);
  };

  if (open) {
    const session = sessions.find(s => s.id === open.id) || open;
    return <DayDetail session={session} orders={orders} riders={riders} onBack={()=>{setOpen(null); load();}} onReload={load}/>;
  }

  return (
    <div className="space-y-5" data-testid="delivery-days-page">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Journées de livraison</h1><p className="text-sm text-[#666]">Planification quotidienne, affectation, suivi, réconciliation</p></div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={printAll} className="dina-btn-secondary !min-h-[40px]" data-testid="dd-print-all"><Printer size={14}/>Imprimer toutes les feuilles</button>
          <button onClick={()=>setCreateOpen(true)} className="dina-btn-primary !min-h-[40px]" data-testid="dd-create-open"><Plus size={14}/>Créer une journée</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard testid="dd-open" label="Journées ouvertes" value={kpi.open} icon={Calendar} color="#5867fd"/>
        <KPICard testid="dd-closed" label="Clôturées" value={kpi.closed} icon={CheckCircle2} color="#1f8a4c"/>
        <KPICard testid="dd-tocollect" label="À encaisser" value={fcfa(kpi.toCollect)} icon={DollarSign} color="#b02a2a"/>
        <KPICard testid="dd-riders" label="Livreurs actifs" value={riders.length} icon={Users} color="#f4b12c"/>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="dd-filters">
        <input type="date" className="dina-input !min-h-[38px] text-xs" value={sf.date} onChange={e=>setSf({...sf, date: e.target.value})} data-testid="dd-filter-date"/>
        <select className="dina-input !min-h-[38px] text-xs" value={sf.rider} onChange={e=>setSf({...sf, rider: e.target.value})} data-testid="dd-filter-rider">
          <option value="">Tous livreurs</option>{riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select className="dina-input !min-h-[38px] text-xs" value={sf.state} onChange={e=>setSf({...sf, state: e.target.value})} data-testid="dd-filter-state">
          <option value="">Ouvertes et clôturées</option><option value="open">Ouvertes</option><option value="closed">Clôturées</option>
        </select>
        {(sf.date || sf.rider || sf.state) ? <button onClick={()=>setSf({ date: "", rider: "", state: "" })} className="dina-chip justify-center" data-testid="dd-filter-reset"><X size={12}/>Effacer</button> : <div/>}
      </div>

      <div className="dina-card-white overflow-hidden"><div className="overflow-x-auto">
        <table className="dina-table" data-testid="dd-table">
          <thead><tr><th>Date</th><th>Statut</th><th>Livreur</th><th className="text-right">Cmd</th><th className="text-right">Livrées</th><th className="text-right">À encaisser</th><th></th></tr></thead>
          <tbody>{shownSessions.length === 0 ? <tr><td colSpan={7} className="text-center text-sm text-[#666] py-10">{sessions.length ? "Aucune journée pour ces filtres" : "Aucune journée · créez-en une pour commencer"}</td></tr> :
            shownSessions.map(s => (
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
      </div></div>

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
  const [tab, setTab] = useKeptState("delivery-days-tab", "affectation");
  const [selected, setSelected] = useState([]);
  const [assignTo, setAssignTo] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [locations, setLocations] = useState([]);
  const [reconcileOrder, setReconcileOrder] = useState(null);
  const [pickSlot, setPickSlot] = useState(false);
  const sid = session.id;
  const dayDate = session.date || new Date().toISOString().slice(0, 10);
  const ready = orders.filter(o => o.mode === "delivery" && ["prete", "confirmee", "reportee"].includes(o.status) && !o.rider_id && (!o.rescheduled_for || o.rescheduled_for <= dayDate));
  const assigned = session.orders_detail || orders.filter(o => (session.orders||[]).includes(o.id));

  useEffect(() => {
    if (tab !== "suivi") return;
    const load = () => api.get("/riders/locations").then(r => setLocations(r.data || [])).catch(()=>{});
    load(); const t = setInterval(load, 15000); return () => clearInterval(t);
  }, [tab]);

  const addSelectedToSession = () => {
    if (!selected.length) return toast.error("Sélectionnez des commandes");
    setPickSlot(true);
  };
  const doAddSelected = async (slotId) => {
    setPickSlot(false);
    try {
      let warning = null;
      for (const oid of selected) { const r = await api.patch(`/delivery-sessions/${sid}/add-order`, { order_id: oid, slot_id: slotId }); warning = r.data?.warning || warning; }
      toast.success(`${selected.length} commande(s) affectée(s) à ${session.rider_name}`);
      if (warning) toast.warning(warning);
      setSelected([]); setAssignTo(null); onReload();
    } catch (e) { toast.error(e.response?.data?.detail || "Erreur affectation"); }
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

  const missing = missingVersements(session);
  const close = async () => {
    if (missing.length) return toast.error(`Versements manquants : ${missing.map(o => o.code).join(", ")}`);
    if (!confirm("Clôturer définitivement la journée ?")) return;
    try { await api.patch(`/delivery-sessions/${sid}/close`); toast.success("Journée clôturée"); onBack(); }
    catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };

  return (
    <div className="space-y-4" data-testid="day-detail">
      <button onClick={onBack} className="text-sm text-[#666] hover:text-[#b02a2a]">← Retour aux journées</button>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-2xl">Journée · {session.date || session.created_at?.slice(0,10)}</h1><div className="text-sm text-[#666]">Livreur : <b>{session.rider_name}</b> · {assigned.length} commandes</div></div>
        {!session.closed && <button onClick={close} disabled={missing.length > 0} title={missing.length ? "Toutes les livraisons payées à la livraison doivent être « Versé »" : ""} className="dina-btn-primary !min-h-[40px] disabled:opacity-50 disabled:cursor-not-allowed" data-testid="dd-close">Clôturer la journée</button>}
      </div>
      {!session.closed && missing.length > 0 && (
        <button onClick={() => setTab("reconciliation")} className="w-full text-left p-3 rounded-lg bg-[#fff5f5] dark:bg-[#2a1818] border-l-4 border-[#c62828] text-sm text-[#c62828]" data-testid="dd-versements-missing">
          <b>{missing.length} livraison(s) non versée(s)</b> : {missing.map(o => o.code).join(", ")} — marquez-les « Versé » dans Réconciliation pour pouvoir clôturer.
        </button>
      )}
      {pickSlot && <SlotPickerModal riderId={session.rider_id} riderName={session.rider_name} count={selected.length} onCancel={() => setPickSlot(false)} onConfirm={doAddSelected}/>}
      {reconcileOrder && <ReconcileLineModal session={session} order={reconcileOrder} onClose={() => setReconcileOrder(null)} onDone={() => { setReconcileOrder(null); onReload(); }}/>}

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
                    <OrderDayStatus order={o} small/>
                    <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{o.code} · {o.customer?.name}</div><div className="text-xs text-[#666] truncate">{o.delivery_zone} · {fcfa(o.total)}</div><SlotBadge order={o}/></div>
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
                  <OrderDayStatus order={o}/>
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
            <thead><tr><th>Commande</th><th>Statut</th><th className="text-right">Articles</th><th className="text-right">Livraison</th><th className="text-right">Déjà payé</th><th className="text-right">À encaisser</th><th>Versement</th></tr></thead>
            <tbody>{assigned.length === 0 ? <tr><td colSpan={7} className="text-center text-sm text-[#666] py-6">Aucune donnée</td></tr> :
              assigned.map(o => (
                <tr key={o.id}>
                  <td className="font-medium">{o.code}</td>
                  <td><OrderDayStatus order={o}/></td>
                  <td className="text-right tabular">{fcfa(o.subtotal||0)}</td>
                  <td className="text-right tabular">{fcfa(o.delivery_fee||0)}</td>
                  <td className="text-right tabular text-[#1f8a4c]">{o.payment_status==="paye"?fcfa(o.total||0):"—"}</td>
                  <td className={`text-right tabular ${o.postponed_to ? "line-through text-[#999]" : ""}`}>{fcfa(o.payment_method==="cod"?(o.total||0):0)}</td>
                  <td>{o.postponed_to || o.status === "livree" || o.payment_method !== "cod" ? <VersementCell session={session} order={o} onVerse={setReconcileOrder} onReload={onReload}/> : <span className="text-[10px] text-[#999]">Pas encore livrée</span>}</td>
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
              onClick={async () => {
                if (!assigned.length) return toast.error("Aucune commande affectée");
                downloadRiderRoutePDF({ name: session.rider_name, date: session.date, zone: riders.find(r => r.id === session.rider_id)?.zone }, assigned, await fetchBusinessForPdf(api));
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
