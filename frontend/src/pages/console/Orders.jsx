import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa, dateTimeFmt, statusLabel, statusColor } from "@/lib/format";
import { toast } from "sonner";

const STATUSES = ["nouvelle","confirmee","en_preparation","prete","assignee","en_livraison","livree","retournee","annulee"];

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [view, setView] = useState("table");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const load = () => api.get("/orders").then(r=>setOrders(r.data));
  useEffect(load, []);

  const changeStatus = async (id, status) => {
    await api.patch(`/orders/${id}/status`, { status });
    toast.success("Statut mis à jour"); load(); if (selected) setSelected({...selected, status});
  };

  const filtered = orders.filter(o => !filter || o.status===filter);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="font-serif text-3xl">Commandes</h1><p className="text-sm text-[#666]">Tous canaux · boutique, storefront, WhatsApp, Instagram, TikTok, manuel</p></div>
        <div className="flex gap-2">
          <button onClick={()=>setView("table")} className={`px-3 py-2 text-xs rounded-md border ${view==="table"?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec]"}`} data-testid="orders-view-table">Table</button>
          <button onClick={()=>setView("kanban")} className={`px-3 py-2 text-xs rounded-md border ${view==="kanban"?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec]"}`} data-testid="orders-view-kanban">Kanban</button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={()=>setFilter("")} className={`dina-chip ${!filter?"!bg-[#1c1c1c] !text-white":""}`}>Tout ({orders.length})</button>
        {STATUSES.map(s=><button key={s} onClick={()=>setFilter(s)} className={`dina-chip ${filter===s?"!bg-[#1c1c1c] !text-white":""}`} data-testid={`orders-filter-${s}`}><span className="status-dot" style={{background:statusColor[s]}}/>{statusLabel[s]}</button>)}
      </div>

      {view === "table" ? (
        <div className="dina-card-white overflow-hidden">
          <div className="overflow-x-auto"><table className="dina-table">
            <thead><tr><th>Commande</th><th>Date</th><th>Client</th><th>Canal</th><th>Statut</th><th className="text-right">Total</th><th></th></tr></thead>
            <tbody>{filtered.slice(0,100).map(o=>(
              <tr key={o.id} onClick={()=>setSelected(o)} className="cursor-pointer" data-testid={`order-row-${o.code}`}>
                <td className="font-medium">{o.code}</td>
                <td className="text-[#666]">{dateTimeFmt(o.created_at)}</td>
                <td>{o.customer?.name||"—"}</td>
                <td className="capitalize">{o.channel}</td>
                <td><span className="dina-chip" style={{color:statusColor[o.status]}}><span className="status-dot" style={{background:statusColor[o.status]}}/>{statusLabel[o.status]}</span></td>
                <td className="text-right tabular font-semibold">{fcfa(o.total)}</td>
                <td className="text-right text-[#666]">›</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 overflow-x-auto">
          {STATUSES.slice(0,8).map(s=>(
            <div key={s} className="dina-card p-3 min-h-[200px]">
              <div className="font-semibold text-xs uppercase mb-2" style={{color:statusColor[s]}}>{statusLabel[s]} ({orders.filter(o=>o.status===s).length})</div>
              <div className="space-y-2">
                {orders.filter(o=>o.status===s).slice(0,8).map(o=>(
                  <div key={o.id} onClick={()=>setSelected(o)} className="bg-white rounded-lg border border-[#ececec] p-2 cursor-pointer hover:border-[#b02a2a]" data-testid={`kanban-card-${o.code}`}>
                    <div className="text-xs font-medium">{o.code}</div><div className="text-xs text-[#666]">{o.customer?.name||"—"}</div><div className="tabular text-sm font-semibold">{fcfa(o.total)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 grid place-items-end lg:place-items-center p-4" onClick={()=>setSelected(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-xl max-h-[85vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><div><div className="font-serif text-xl">{selected.code}</div><div className="text-xs text-[#666]">{dateTimeFmt(selected.created_at)} · {selected.channel}</div></div><button onClick={()=>setSelected(null)}>✕</button></div>
            <div className="space-y-2 mb-4">{selected.items.map((it,i)=><div key={i} className="flex items-center gap-3 text-sm border-b border-[#ececec] pb-2"><div className="w-10 h-10 bg-[#f5f5f5] rounded overflow-hidden"><img src={it.image} alt="" className="w-full h-full object-cover"/></div><div className="flex-1"><div className="font-medium">{it.name}</div><div className="text-xs text-[#666]">{[it.size,it.color].filter(Boolean).join(" · ")} · x{it.qty}</div></div><div className="tabular">{fcfa(it.qty*it.price)}</div></div>)}</div>
            <div className="text-sm space-y-1 mb-4"><div className="flex justify-between"><span className="text-[#666]">Sous-total</span><span className="tabular">{fcfa(selected.subtotal)}</span></div><div className="flex justify-between"><span className="text-[#666]">Livraison</span><span className="tabular">{fcfa(selected.delivery_fee)}</span></div><div className="flex justify-between font-semibold"><span>Total</span><span className="tabular">{fcfa(selected.total)}</span></div></div>
            <div className="mb-4"><div className="text-xs text-[#666] mb-2">Changer le statut</div><div className="flex gap-1 flex-wrap">{STATUSES.map(s=><button key={s} onClick={()=>changeStatus(selected.id,s)} className={`px-2 py-1 text-xs rounded border ${selected.status===s?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec]"}`} data-testid={`change-status-${s}`}>{statusLabel[s]}</button>)}</div></div>
            <div className="text-xs text-[#666]"><div className="font-semibold text-[#1c1c1c] mb-1">Historique</div>{(selected.timeline||[]).map((t,i)=><div key={i}>{dateTimeFmt(t.at)} · {statusLabel[t.status]||t.status} · {t.by}</div>)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
