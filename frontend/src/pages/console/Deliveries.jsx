import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa, statusLabel, statusColor, dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";
import { MapPin, Phone, MessageCircle, Truck } from "lucide-react";

export default function Deliveries() {
  const [orders, setOrders] = useState([]);
  const [riders, setRiders] = useState([]);
  const load = async () => {
    const [d, t] = await Promise.all([api.get("/deliveries"), api.get("/team")]);
    setOrders(d.data); setRiders(t.data.filter(u=>u.role==="rider"));
  };
  useEffect(() => { load(); }, []);

  const assign = async (oid, r) => {
    await api.patch(`/deliveries/${oid}/assign`, { rider_id: r.id, rider_name: r.name });
    toast.success(`Assignée à ${r.name}`); load();
  };

  const toShip = orders.filter(o => ["prete","confirmee","nouvelle"].includes(o.status));
  const inRun = orders.filter(o => ["assignee","en_livraison"].includes(o.status));
  const done = orders.filter(o => ["livree","echouee"].includes(o.status));

  return (
    <div className="space-y-5">
      <div><h1 className="font-serif text-3xl">Livraisons</h1><p className="text-sm text-[#666]">Dispatch, suivi en direct, encaissements livreurs</p></div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="dina-card-white p-4">
          <div className="font-semibold mb-3">À assigner ({toShip.length})</div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin">
            {toShip.map(o=>(
              <div key={o.id} className="border border-[#ececec] rounded-lg p-3" data-testid={`dispatch-order-${o.code}`}>
                <div className="flex justify-between items-start mb-1"><div><div className="font-medium text-sm">{o.code}</div><div className="text-xs text-[#666]">{o.customer?.name} · {o.delivery_zone||"—"}</div></div><div className="tabular font-semibold text-sm">{fcfa(o.total)}</div></div>
                <div className="text-xs text-[#666] mb-2">{o.items.length} articles · {o.payment_method==="cod"?"Paiement livraison":o.payment_method}</div>
                <select onChange={e=>{ const r=riders.find(x=>x.id===e.target.value); if (r) assign(o.id, r); }} className="dina-input text-xs" defaultValue="" data-testid={`assign-rider-${o.code}`}>
                  <option value="" disabled>Assigner livreur…</option>
                  {riders.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="dina-card-white p-4">
          <div className="font-semibold mb-3">En cours ({inRun.length})</div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin">
            {inRun.map(o=>(
              <div key={o.id} className="border border-[#ececec] rounded-lg p-3">
                <div className="flex justify-between items-start"><div><div className="font-medium text-sm">{o.code}</div><div className="text-xs text-[#666]">{o.customer?.name}</div></div><span className="dina-chip" style={{color:statusColor[o.status]}}><span className="status-dot" style={{background:statusColor[o.status]}}/>{statusLabel[o.status]}</span></div>
                <div className="text-xs text-[#666] mt-1 flex items-center gap-1"><MapPin size={11}/>{o.delivery_zone} · <Truck size={11}/>{o.rider_name}</div>
                <div className="tabular text-sm font-semibold mt-1">{fcfa(o.total)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="dina-card-white p-4">
          <div className="font-semibold mb-3">Terminées ({done.length})</div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin">
            {done.slice(0,30).map(o=>(
              <div key={o.id} className="border border-[#ececec] rounded-lg p-3 opacity-75">
                <div className="flex justify-between"><div className="text-sm font-medium">{o.code}</div><span className="status-dot" style={{background:statusColor[o.status]}}/></div>
                <div className="text-xs text-[#666]">{o.customer?.name} · {o.delivery_zone}</div>
                <div className="text-xs text-[#666]">Livreur: {o.rider_name||"—"}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dina-card-white p-4">
        <div className="font-semibold mb-3">Performance livreurs</div>
        <table className="dina-table">
          <thead><tr><th>Livreur</th><th>Téléphone</th><th>Courses actives</th><th>Terminées</th><th>Taux à l'heure</th></tr></thead>
          <tbody>{riders.map(r=>{
            const active = orders.filter(o=>o.rider_id===r.id && ["assignee","en_livraison"].includes(o.status)).length;
            const total = orders.filter(o=>o.rider_id===r.id && o.status==="livree").length;
            return <tr key={r.id}><td className="font-medium">{r.name}</td><td className="text-[#666]">{r.phone}</td><td className="tabular">{active}</td><td className="tabular">{total}</td><td className="tabular text-[#1f8a4c]">94%</td></tr>;
          })}</tbody>
        </table>
      </div>
    </div>
  );
}
