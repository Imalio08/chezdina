import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa, dateFmt, statusLabel, statusColor, dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Check, X, Phone, MessageCircle, MapPin, Pencil, Trash2 } from "lucide-react";

export default function Deliveries() {
  const [tab, setTab] = useState("dispatch");
  const [orders, setOrders] = useState([]);
  const [riders, setRiders] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [zones, setZones] = useState([]);
  const [showZoneForm, setShowZoneForm] = useState(false);

  const load = async () => {
    try {
      const [d, t, s, z] = await Promise.all([api.get("/deliveries"), api.get("/team"), api.get("/delivery-sessions"), api.get("/zones")]);
      setOrders(d.data); setRiders(t.data.filter(u=>u.role==="rider")); setSessions(s.data); setZones(z.data);
    } catch { toast.error("Erreur"); }
  };
  useEffect(() => { load(); }, []);

  const createSession = async (r) => {
    try { await api.post("/delivery-sessions", { rider_id: r.id, rider_name: r.name }); toast.success(`Journée ouverte pour ${r.name}`); load(); }
    catch { toast.error("Erreur"); }
  };
  const addToSession = async (sid, oid) => {
    await api.patch(`/delivery-sessions/${sid}/add-order`, { order_id: oid });
    toast.success("Commande affectée"); load();
  };
  const reconcile = async (sid, oid, collected) => {
    await api.patch(`/delivery-sessions/${sid}/reconcile`, { order_id: oid, collected });
    load();
  };
  const closeSession = async (sid) => {
    if (!confirm("Clôturer la journée ?")) return;
    await api.patch(`/delivery-sessions/${sid}/close`); toast.success("Journée clôturée"); load();
  };

  const toShip = orders.filter(o=>["prete","confirmee","nouvelle"].includes(o.status));
  const openSessions = sessions.filter(s=>!s.closed);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Livraisons</h1><p className="text-sm text-[#666]">Journées livreurs, réconciliation, performance</p></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">À assigner</div><div className="font-serif text-2xl tabular">{toShip.length}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Journées ouvertes</div><div className="font-serif text-2xl tabular text-[#1f8a4c]">{openSessions.length}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Livreurs actifs</div><div className="font-serif text-2xl tabular">{riders.length}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Zones configurées</div><div className="font-serif text-2xl tabular">{zones.length}</div></div>
      </div>

      <div className="flex gap-1 bg-[#f5f5f5] p-1 rounded-lg w-fit">
        <button onClick={()=>setTab("dispatch")} className={`px-4 py-1.5 text-sm rounded-md ${tab==="dispatch"?"bg-white shadow-sm font-semibold":""}`} data-testid="deliv-tab-dispatch">Dispatch</button>
        <button onClick={()=>setTab("sessions")} className={`px-4 py-1.5 text-sm rounded-md ${tab==="sessions"?"bg-white shadow-sm font-semibold":""}`} data-testid="deliv-tab-sessions">Journées livreurs</button>
        <button onClick={()=>setTab("riders")} className={`px-4 py-1.5 text-sm rounded-md ${tab==="riders"?"bg-white shadow-sm font-semibold":""}`} data-testid="deliv-tab-riders">Livreurs</button>
        <button onClick={()=>setTab("zones")} className={`px-4 py-1.5 text-sm rounded-md ${tab==="zones"?"bg-white shadow-sm font-semibold":""}`} data-testid="deliv-tab-zones">Zones</button>
      </div>

      {tab==="dispatch" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="dina-card-white p-4">
            <div className="font-semibold mb-3">À assigner ({toShip.length})</div>
            <div className="space-y-2 max-h-[600px] overflow-y-auto scrollbar-thin">{toShip.map(o=>(
              <div key={o.id} className="border border-[#ececec] rounded-lg p-3" data-testid={`dispatch-order-${o.code}`}>
                <div className="flex justify-between items-start"><div><div className="font-medium text-sm">{o.code}</div><div className="text-xs text-[#666]">{o.customer?.name} · {o.delivery_zone||"—"}</div></div><div className="tabular font-semibold text-sm">{fcfa(o.total)}</div></div>
                <div className="text-xs text-[#666] mt-1 mb-2">{o.items.length} articles · {o.payment_method==="cod"?"Paiement à la livraison":"Déjà payé"}</div>
                <select onChange={e=>{ const sid=e.target.value; if(sid) addToSession(sid, o.id); }} defaultValue="" className="dina-input !py-1.5 text-xs" data-testid={`assign-session-${o.code}`}>
                  <option value="" disabled>Ajouter à une journée…</option>
                  {openSessions.map(s=><option key={s.id} value={s.id}>{s.rider_name} · {s.date}</option>)}
                </select>
              </div>
            ))}</div>
          </div>

          <div className="dina-card-white p-4">
            <div className="flex justify-between items-center mb-3"><div className="font-semibold">Journées ouvertes</div><div className="text-xs text-[#666]">{openSessions.length} livreur·s en course</div></div>
            <div className="space-y-2 max-h-[600px] overflow-y-auto scrollbar-thin">
              {riders.map(r=>{
                const sess = openSessions.find(s=>s.rider_id===r.id);
                return (
                  <div key={r.id} className="border border-[#ececec] rounded-lg p-3">
                    <div className="flex justify-between items-center"><div><div className="font-medium text-sm">{r.name}</div><div className="text-xs text-[#666]">{r.phone}</div></div>
                      {sess ? <span className="dina-chip" style={{color:"#1f8a4c"}}><span className="status-dot" style={{background:"#1f8a4c"}}/>Journée {sess.date}</span>
                            : <button onClick={()=>createSession(r)} className="dina-btn-primary !min-h-[32px] text-xs" data-testid={`open-session-${r.id}`}><Plus size={10}/>Ouvrir journée</button>}
                    </div>
                    {sess && <div className="mt-2 text-xs text-[#666]">📦 {sess.orders.length} commandes · 💰 à collecter {fcfa(sess.total_to_collect||0)}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab==="sessions" && (
        <div className="space-y-4">{openSessions.length===0 ? <div className="text-center text-sm text-[#666] py-10 dina-card">Aucune journée ouverte</div> :
          openSessions.map(s=>(
            <div key={s.id} className="dina-card-white p-5" data-testid={`session-${s.id}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="font-serif text-xl">{s.rider_name}</div>
                  <div className="text-xs text-[#666]">Journée du {s.date} · {s.orders.length} commande{s.orders.length>1?"s":""}</div>
                </div>
                <button onClick={()=>closeSession(s.id)} className="dina-btn-secondary !min-h-[36px] text-xs" data-testid={`close-session-${s.id}`}>Clôturer journée</button>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="p-3 bg-[#fff5f5] rounded-lg"><div className="text-[10px] uppercase text-[#666]">À collecter</div><div className="font-serif text-lg tabular font-semibold">{fcfa(s.total_to_collect||0)}</div></div>
                <div className="p-3 bg-[#fff5f5] rounded-lg"><div className="text-[10px] uppercase text-[#666]">Déjà payées</div><div className="font-serif text-lg tabular">{s.prepaid_count||0}</div></div>
                <div className="p-3 bg-[#fff5f5] rounded-lg"><div className="text-[10px] uppercase text-[#666]">Livrées</div><div className="font-serif text-lg tabular text-[#1f8a4c]">{s.delivered_count||0}</div></div>
                <div className="p-3 bg-[#fff5f5] rounded-lg"><div className="text-[10px] uppercase text-[#666]">Encaissé</div><div className="font-serif text-lg tabular text-[#b02a2a]">{fcfa(s.collected_total||0)}</div></div>
              </div>

              <table className="dina-table">
                <thead><tr><th>Code</th><th>Cliente</th><th>Zone</th><th>Mode</th><th>Statut</th><th className="text-right">Produit</th><th className="text-right">Livraison</th><th className="text-right">À collecter</th><th>Reçu ?</th></tr></thead>
                <tbody>{(s.orders_detail||[]).map(o=>(
                  <tr key={o.id}>
                    <td className="font-medium">{o.code}</td>
                    <td>{o.customer?.name}</td>
                    <td>{o.delivery_zone}</td>
                    <td className="text-xs capitalize">{o.payment_method==="cod"?"Paiement à la livraison":o.payment_method}</td>
                    <td><span className="dina-chip" style={{color:statusColor[o.status]}}>{statusLabel[o.status]}</span></td>
                    <td className="text-right tabular">{fcfa(o.subtotal)}</td>
                    <td className="text-right tabular text-[#666]">{fcfa(o.delivery_fee||0)}</td>
                    <td className="text-right tabular font-semibold">{o.payment_method==="cod" ? fcfa(o.total) : "—"}</td>
                    <td>{o.payment_method==="cod" ? <button onClick={()=>reconcile(s.id,o.id,!s.reconciliations?.[o.id])} className={`dina-chip ${s.reconciliations?.[o.id]?"!text-[#1f8a4c] !border-[#1f8a4c]":"!text-[#c62828] !border-[#c62828]"}`} data-testid={`reconcile-${o.code}`}>{s.reconciliations?.[o.id] ? <><Check size={10}/>Oui</> : <><X size={10}/>Non</>}</button> : <span className="text-xs text-[#666]">—</span>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {tab==="riders" && (
        <div className="grid lg:grid-cols-2 gap-4">{riders.map(r=><RiderCard key={r.id} rider={r}/>)}</div>
      )}

      {tab==="zones" && (
        <ZonesConfig zones={zones} onReload={load} showForm={showZoneForm} setShowForm={setShowZoneForm}/>
      )}
    </div>
  );
}

function RiderCard({ rider }) {
  const [k, setK] = useState(null);
  useEffect(() => { api.get(`/riders/${rider.id}/kpis`).then(r=>setK(r.data)).catch(()=>{}); }, [rider.id]);
  return (
    <div className="dina-card-white p-5" data-testid={`rider-card-${rider.id}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-[#fde8e8] text-[#b02a2a] font-serif text-xl font-bold grid place-items-center">{rider.name[0]}</div>
        <div><div className="font-semibold">{rider.name}</div><div className="text-xs text-[#666]">{rider.phone}</div></div>
      </div>
      {k ? (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-[#fff5f5] rounded"><div className="text-[10px] uppercase text-[#666]">Livraisons</div><div className="font-serif text-lg tabular">{k.delivered}</div></div>
          <div className="p-2 bg-[#fff5f5] rounded"><div className="text-[10px] uppercase text-[#666]">Taux livraison</div><div className="font-serif text-lg tabular text-[#1f8a4c]">{k.delivery_rate}%</div></div>
          <div className="p-2 bg-[#fff5f5] rounded"><div className="text-[10px] uppercase text-[#666]">Satisfaction</div><div className="font-serif text-lg tabular">★{k.satisfaction}</div></div>
          <div className="p-2 bg-[#fff5f5] rounded"><div className="text-[10px] uppercase text-[#666]">Total</div><div className="font-serif text-lg tabular">{k.total}</div></div>
          <div className="p-2 bg-[#fff5f5] rounded"><div className="text-[10px] uppercase text-[#666]">Échecs</div><div className="font-serif text-lg tabular text-[#c62828]">{k.failed}</div></div>
          <div className="p-2 bg-[#fff5f5] rounded"><div className="text-[10px] uppercase text-[#666]">Taux annul.</div><div className="font-serif text-lg tabular text-[#e4991e]">{k.cancel_rate}%</div></div>
        </div>
      ) : <div className="text-xs text-[#666]">Chargement…</div>}
    </div>
  );
}

function ZonesConfig({ zones, onReload, showForm, setShowForm }) {
  const [editing, setEditing] = useState(null);
  const [f, setF] = useState({ name:"", fee:1500 });
  const save = async () => {
    try {
      if (editing) await api.patch(`/zones/${editing.id}`, f);
      else await api.post("/zones", f);
      toast.success("Enregistré"); setShowForm(false); setEditing(null); setF({name:"",fee:1500}); onReload();
    } catch { toast.error("Erreur"); }
  };
  const del = async (id) => { if (!confirm("Supprimer ?")) return; await api.delete(`/zones/${id}`); onReload(); };
  return (
    <div className="dina-card-white p-5">
      <div className="flex justify-between items-center mb-4"><div className="font-semibold">Zones de livraison ({zones.length})</div><button onClick={()=>{setShowForm(true);setEditing(null);setF({name:"",fee:1500});}} className="dina-btn-primary !min-h-[38px]" data-testid="zone-new"><Plus size={14}/>Nouvelle zone</button></div>
      <table className="dina-table">
        <thead><tr><th>Nom</th><th className="text-right">Frais</th><th></th></tr></thead>
        <tbody>{zones.map(z=>(
          <tr key={z.id} data-testid={`zone-row-${z.name}`}>
            <td className="font-medium">{z.name}</td>
            <td className="text-right tabular font-semibold">{fcfa(z.fee)}</td>
            <td className="text-right"><button onClick={()=>{setEditing(z);setF({name:z.name,fee:z.fee});setShowForm(true);}} className="text-[#0021cc] mr-2"><Pencil size={14}/></button><button onClick={()=>del(z.id)} className="text-[#c62828]"><Trash2 size={14}/></button></td>
          </tr>
        ))}</tbody>
      </table>
      {showForm && <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={()=>setShowForm(false)}><div className="bg-white rounded-xl p-6 w-full max-w-sm" onClick={e=>e.stopPropagation()}>
        <div className="font-serif text-xl mb-4">{editing?"Modifier":"Nouvelle"} zone</div>
        <input className="dina-input mb-2" placeholder="Nom (ex: Cocody)" value={f.name} onChange={e=>setF({...f,name:e.target.value})} data-testid="zone-name"/>
        <input type="number" className="dina-input mb-4" placeholder="Frais FCFA" value={f.fee} onChange={e=>setF({...f,fee:+e.target.value})} data-testid="zone-fee"/>
        <div className="flex gap-2"><button onClick={()=>setShowForm(false)} className="dina-btn-secondary flex-1">Annuler</button><button onClick={save} className="dina-btn-primary flex-1" data-testid="zone-save">Enregistrer</button></div>
      </div></div>}
    </div>
  );
}
