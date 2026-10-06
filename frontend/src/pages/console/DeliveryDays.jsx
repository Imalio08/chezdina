import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { fcfa, statusLabel, statusColor } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Calendar, Package, DollarSign, AlertTriangle, CheckCircle2, Users, X, Printer, Map } from "lucide-react";
import KPICard from "@/components/shared/KPICard";

export default function DeliveryDays() {
  const [sessions, setSessions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [riders, setRiders] = useState([]);
  const [open, setOpen] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));

  const load = async () => {
    const [s, o, t] = await Promise.all([api.get("/delivery-sessions"), api.get("/orders"), api.get("/team")]);
    setSessions(s.data || []); setOrders(o.data || []); setRiders((t.data||[]).filter(u => u.role === "rider"));
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      const r = riders[0];
      if (!r) return toast.error("Aucun livreur actif");
      await api.post("/delivery-sessions", { rider_id: r.id, rider_name: r.name, date });
      toast.success(`Journée créée pour le ${date}`); load();
    } catch { toast.error("Erreur"); }
  };

  const kpi = useMemo(() => {
    const open = sessions.filter(s => !s.closed).length;
    const closed = sessions.filter(s => s.closed).length;
    const toCollect = sessions.reduce((s,sess) => s + ((sess.orders||[]).reduce((a,o)=>a+(o.to_collect||0),0)), 0);
    return { open, closed, toCollect };
  }, [sessions]);

  if (open) return <DayDetail session={open} orders={orders} riders={riders} onBack={()=>{setOpen(null); load();}} onReload={load}/>;

  return (
    <div className="space-y-5" data-testid="delivery-days-page">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Journées de livraison</h1><p className="text-sm text-[#666]">Planification quotidienne, affectation, réconciliation</p></div>
        <div className="flex gap-2 items-end">
          <input type="date" className="dina-input" value={date} onChange={e=>setDate(e.target.value)} data-testid="dd-date"/>
          <button onClick={create} className="dina-btn-primary !min-h-[40px]" data-testid="dd-create"><Plus size={14}/>Créer une journée</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard testid="dd-open" label="Journées ouvertes" value={kpi.open} icon={Calendar} color="#5867fd"/>
        <KPICard testid="dd-closed" label="Clôturées" value={kpi.closed} icon={CheckCircle2} color="#1f8a4c"/>
        <KPICard testid="dd-tocollect" label="À encaisser" value={fcfa(kpi.toCollect)} icon={DollarSign} color="#b02a2a"/>
        <KPICard testid="dd-ecarts" label="Écarts" value={fcfa(0)} icon={AlertTriangle} color="#c62828"/>
      </div>

      <div className="dina-card-white overflow-hidden">
        <table className="dina-table" data-testid="dd-table">
          <thead><tr><th>Date</th><th>Statut</th><th>Livreur</th><th className="text-right">Cmd</th><th className="text-right">Livrées</th><th className="text-right">À encaisser</th><th></th></tr></thead>
          <tbody>{sessions.length === 0 ? <tr><td colSpan={7} className="text-center text-sm text-[#666] py-10">Aucune journée · créez-en une pour commencer</td></tr> :
            sessions.map(s => (
              <tr key={s.id} data-testid={`dd-row-${s.id}`}>
                <td className="font-medium">{s.date || s.created_at?.slice(0,10)}</td>
                <td><span className="dina-chip !py-0.5 text-[10px]" style={{color:s.closed?"#1f8a4c":"#5867fd",borderColor:s.closed?"#1f8a4c":"#5867fd"}}>{s.closed?"Clôturée":"Ouverte"}</span></td>
                <td>{s.rider_name}</td>
                <td className="text-right tabular">{(s.orders||[]).length}</td>
                <td className="text-right tabular text-[#1f8a4c]">{(s.orders||[]).filter(o=>o.status==="livree").length}</td>
                <td className="text-right tabular font-semibold">{fcfa((s.orders||[]).reduce((a,o)=>a+(o.to_collect||0),0))}</td>
                <td className="text-right"><button onClick={()=>setOpen(s)} className="text-[#5867fd] text-xs hover:underline">Ouvrir →</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DayDetail({ session, orders, riders, onBack, onReload }) {
  const [tab, setTab] = useState("affectation");
  const [selected, setSelected] = useState([]);
  const [assignTo, setAssignTo] = useState(null);
  const sid = session.id;
  const ready = orders.filter(o => (o.status === "prete" || o.status === "confirmee") && !o.rider_id);
  const assigned = session.orders || [];

  const assign = async () => {
    if (!selected.length) return toast.error("Sélectionnez des commandes");
    if (!assignTo) return toast.error("Choisissez un livreur");
    try {
      for (const oid of selected) await api.patch(`/delivery-sessions/${sid}/add-order`, { order_id: oid });
      toast.success(`${selected.length} commande(s) affectée(s) à ${assignTo.name}`);
      setSelected([]); setAssignTo(null); onReload();
    } catch { toast.error("Erreur affectation"); }
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
        <div><h1 className="font-serif text-2xl">Journée · {session.date || session.created_at?.slice(0,10)}</h1><div className="text-sm text-[#666]">Livreur : {session.rider_name} · {assigned.length} commandes</div></div>
        {!session.closed && <button onClick={close} className="dina-btn-primary !min-h-[40px]" data-testid="dd-close">Clôturer la journée</button>}
      </div>

      <div className="flex gap-1 border-b border-[#ececec] dark:border-[#2a2a2a] overflow-x-auto">
        {[["affectation","Affectation"],["suivi","Suivi"],["reconciliation","Réconciliation"],["fiches","Fiches & feuilles de route"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} className={`px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap ${tab===k?"border-[#b02a2a] text-[#b02a2a]":"border-transparent text-[#666]"}`} data-testid={`day-tab-${k}`}>{l}</button>
        ))}
      </div>

      {tab === "affectation" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="dina-card-white p-4">
            <div className="flex items-center justify-between mb-3"><div className="font-serif text-lg">Commandes prêtes ({ready.length})</div>{selected.length > 0 && <button onClick={()=>setAssignTo({mode:"pick"})} className="dina-btn-primary !min-h-[32px] text-xs" data-testid="dd-affect">Affecter {selected.length} à…</button>}</div>
            {ready.length === 0 && <div className="text-sm text-[#666] text-center py-6">Aucune commande prête</div>}
            {ready.slice(0,30).map(o => (
              <label key={o.id} className="flex items-center gap-2 p-2 border border-[#ececec] dark:border-[#2a2a2a] rounded-lg mb-1.5 cursor-pointer hover:bg-[#fff5f5] dark:hover:bg-[#2a1818]" data-testid={`ready-${o.id}`}>
                <input type="checkbox" checked={selected.includes(o.id)} onChange={()=>setSelected(s => s.includes(o.id)?s.filter(x=>x!==o.id):[...s,o.id])} className="accent-[#b02a2a]"/>
                <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{o.code} · {o.customer?.name}</div><div className="text-xs text-[#666] truncate">{o.delivery_zone} · {fcfa(o.total)}</div></div>
              </label>
            ))}
          </div>
          <div className="dina-card-white p-4">
            <div className="font-serif text-lg mb-3">Livreurs</div>
            {riders.map(r => {
              const my = assigned.filter(o => o.rider_id === r.id || session.rider_id === r.id);
              const toCollect = my.reduce((s,o)=>s+(o.to_collect||0),0);
              return (
                <div key={r.id} className="flex items-center gap-3 p-2.5 border border-[#ececec] dark:border-[#2a2a2a] rounded-lg mb-2" data-testid={`rider-slot-${r.id}`}>
                  <div className="w-10 h-10 rounded-full bg-[#fde8e8] grid place-items-center font-bold text-[#b02a2a]">{r.name?.[0]}</div>
                  <div className="flex-1 min-w-0"><div className="font-medium text-sm truncate">{r.name}</div><div className="text-xs text-[#666]">{my.length} commandes · {fcfa(toCollect)}</div></div>
                  <button onClick={()=>setAssignTo(r)} disabled={!selected.length} className="dina-chip text-[11px]" data-testid={`assign-to-${r.id}`}>Affecter ici</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "suivi" && (
        <div className="dina-card-white p-4">
          <div className="font-serif text-lg mb-3 flex items-center gap-2"><Map size={16}/>Suivi en direct</div>
          {assigned.length === 0 ? <div className="text-sm text-[#666] text-center py-6">Aucune commande encore affectée</div> :
            assigned.map(o => (
              <div key={o.id} className="flex items-center gap-2 py-2 border-b border-[#f0f0f0] last:border-0">
                <span className="dina-chip !py-0.5 text-[10px]" style={{color:statusColor(o.status),borderColor:statusColor(o.status)}}>{statusLabel(o.status)}</span>
                <span className="text-sm flex-1 truncate">{o.code} · {o.customer?.name}</span>
                <span className="text-xs tabular font-semibold">{fcfa(o.to_collect||0)}</span>
              </div>
            ))
          }
        </div>
      )}

      {tab === "reconciliation" && (
        <div className="dina-card-white p-4">
          <div className="font-serif text-lg mb-3">Réconciliation</div>
          {!session.closed && assigned.length > 0 && <div className="text-xs text-[#666] mb-2">L'argent reçu alimente automatiquement la session de caisse en cours.</div>}
          <table className="dina-table">
            <thead><tr><th>Commande</th><th>Statut</th><th className="text-right">Articles</th><th className="text-right">Livraison</th><th className="text-right">Déjà payé</th><th className="text-right">À encaisser</th><th className="text-right">Déclaré</th><th>Écart</th></tr></thead>
            <tbody>{assigned.length === 0 ? <tr><td colSpan={8} className="text-center text-sm text-[#666] py-6">Aucune donnée</td></tr> :
              assigned.map(o => (
                <tr key={o.id}>
                  <td className="font-medium">{o.code}</td>
                  <td><span className="dina-chip !py-0.5 text-[10px]">{statusLabel(o.status)}</span></td>
                  <td className="text-right tabular">{fcfa(o.subtotal||0)}</td>
                  <td className="text-right tabular">{fcfa(o.delivery_fee||0)}</td>
                  <td className="text-right tabular text-[#1f8a4c]">{o.payment_status==="paye"?fcfa(o.total||0):"—"}</td>
                  <td className="text-right tabular">{fcfa(o.to_collect||0)}</td>
                  <td className="text-right tabular">{fcfa(o.declared||0)}</td>
                  <td className="text-right tabular text-[#c62828]">{(o.declared||0)-(o.to_collect||0)!==0?fcfa((o.declared||0)-(o.to_collect||0)):"—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "fiches" && (
        <div className="dina-card-white p-4">
          <div className="font-serif text-lg mb-3">Fiches colis & feuilles de route</div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={()=>window.print()} className="dina-btn-secondary"><Printer size={14}/>Imprimer toutes les fiches colis</button>
            <button onClick={()=>window.print()} className="dina-btn-secondary"><Printer size={14}/>Feuille de route livreur</button>
          </div>
          <div className="mt-4 text-xs text-[#666]">À imprimer sur imprimante thermique 80 mm ou A4.</div>
        </div>
      )}

      {assignTo && assignTo.id && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={()=>setAssignTo(null)}>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-5 w-full max-w-sm" onClick={e=>e.stopPropagation()} data-testid="confirm-assign">
            <div className="font-serif text-lg mb-2">Confirmer l'affectation</div>
            <p className="text-sm text-[#666]">{selected.length} commande(s) → <b>{assignTo.name}</b></p>
            <div className="flex gap-2 mt-4"><button onClick={()=>setAssignTo(null)} className="dina-btn-secondary flex-1">Annuler</button><button onClick={assign} className="dina-btn-primary flex-1" data-testid="confirm-assign-yes">Confirmer</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
