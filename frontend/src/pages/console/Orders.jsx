import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa, dateTimeFmt, statusLabel, statusColor } from "@/lib/format";
import { toast } from "sonner";
import { X, Pencil, Printer } from "lucide-react";

const STATUSES = ["nouvelle","confirmee","en_preparation","prete","assignee","en_livraison","livree","retournee","annulee","echouee"];

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [view, setView] = useState("table");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState(null);

  const load = async () => { try { const r = await api.get("/orders"); setOrders(r.data); } catch { toast.error("Erreur"); } };
  useEffect(() => { load(); }, []);

  const changeStatus = async (id, status) => {
    let payload = { status };
    if (status === "annulee" || status === "echouee") {
      const reason = prompt("Motif de l'annulation / échec ?");
      if (reason === null) return;
      payload.reason = reason;
    }
    if (status === "retournee") {
      const reason = prompt("Motif du retour ?");
      if (reason === null) return;
      payload.reason = reason;
    }
    // "Reportée" is modeled as confirmee + rescheduled_for
    if (status === "reportee") {
      const next = prompt("Date de report (YYYY-MM-DD) ?");
      if (!next) return;
      payload = { status: "confirmee", reason: "Reportée", next_date: next };
    }
    await api.patch(`/orders/${id}/status`, payload);
    toast.success("Statut mis à jour"); load();
    if (selected) setSelected({...selected, status: payload.status});
  };

  const filtered = orders.filter(o => !filter || o.status===filter);
  const totals = {
    rev: orders.reduce((s,o)=>s+(o.total||0),0),
    delivered: orders.filter(o=>o.status==="livree").length,
    pending: orders.filter(o=>!["livree","annulee","retournee","echouee"].includes(o.status)).length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Commandes</h1><p className="text-sm text-[#666]">Tous canaux · {orders.length} commandes</p></div>
        <div className="flex gap-2">
          <button onClick={()=>setView("table")} className={`px-3 py-2 text-xs rounded-md border ${view==="table"?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec]"}`} data-testid="orders-view-table">Table</button>
          <button onClick={()=>setView("kanban")} className={`px-3 py-2 text-xs rounded-md border ${view==="kanban"?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec]"}`} data-testid="orders-view-kanban">Kanban</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">CA total</div><div className="font-serif text-2xl tabular">{fcfa(totals.rev)}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Livrées</div><div className="font-serif text-2xl tabular text-[#1f8a4c]">{totals.delivered}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">En cours</div><div className="font-serif text-2xl tabular text-[#e4991e]">{totals.pending}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Panier moyen</div><div className="font-serif text-2xl tabular">{fcfa(orders.length?Math.round(totals.rev/orders.length):0)}</div></div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={()=>setFilter("")} className={`dina-chip ${!filter?"!bg-[#1c1c1c] !text-white":""}`}>Tout ({orders.length})</button>
        {STATUSES.map(s=><button key={s} onClick={()=>setFilter(s)} className={`dina-chip ${filter===s?"!bg-[#1c1c1c] !text-white":""}`} data-testid={`orders-filter-${s}`}><span className="status-dot" style={{background:statusColor[s]}}/>{statusLabel[s]} ({orders.filter(o=>o.status===s).length})</button>)}
      </div>

      {view === "table" ? (
        <div className="dina-card-white overflow-hidden"><div className="overflow-x-auto"><table className="dina-table">
          <thead><tr><th>Commande</th><th>Date</th><th>Cliente</th><th>Canal</th><th>Mode</th><th>Statut</th><th className="text-right">Total</th></tr></thead>
          <tbody>{filtered.slice(0,200).map(o=>(
            <tr key={o.id} onClick={()=>setSelected(o)} className="cursor-pointer" data-testid={`order-row-${o.code}`}>
              <td className="font-medium">{o.code}</td>
              <td className="text-[#666]">{dateTimeFmt(o.created_at)}</td>
              <td>{o.customer?.name||"—"}</td>
              <td className="capitalize">{o.channel}</td>
              <td className="capitalize text-xs">{o.mode}</td>
              <td><span className="dina-chip" style={{color:statusColor[o.status]}}><span className="status-dot" style={{background:statusColor[o.status]}}/>{statusLabel[o.status]}</span></td>
              <td className="text-right tabular font-semibold">{fcfa(o.total)}</td>
            </tr>
          ))}</tbody>
        </table></div></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 overflow-x-auto">
          {STATUSES.slice(0,8).map(s=>(
            <div key={s} className="dina-card p-3 min-h-[200px]">
              <div className="font-semibold text-xs uppercase mb-2" style={{color:statusColor[s]}}>{statusLabel[s]} ({orders.filter(o=>o.status===s).length})</div>
              <div className="space-y-2">{orders.filter(o=>o.status===s).slice(0,10).map(o=>(
                <div key={o.id} onClick={()=>setSelected(o)} className="bg-white rounded-lg border border-[#ececec] p-2 cursor-pointer hover:border-[#b02a2a]">
                  <div className="text-xs font-medium">{o.code}</div>
                  <div className="text-xs text-[#666]">{o.customer?.name||"—"}</div>
                  <div className="tabular text-sm font-semibold">{fcfa(o.total)}</div>
                </div>
              ))}</div>
            </div>
          ))}
        </div>
      )}

      {selected && <OrderDrawer order={selected} onClose={()=>setSelected(null)} onStatus={changeStatus} onReload={load}/>}
    </div>
  );
}

function OrderDrawer({ order, onClose, onStatus, onReload }) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState(order.items);
  const [discount, setDiscount] = useState(order.discount||0);
  const [fee, setFee] = useState(order.delivery_fee||0);
  const canEdit = order.status !== "livree";

  const save = async () => {
    try { await api.patch(`/orders/${order.id}`, { items, discount:+discount, delivery_fee:+fee }); toast.success("Enregistré"); setEditing(false); onReload(); onClose(); }
    catch { toast.error("Erreur"); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-end lg:place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div><div className="font-serif text-xl">{order.code}</div><div className="text-xs text-[#666]">{dateTimeFmt(order.created_at)} · {order.channel} · {order.mode}</div></div>
          <button onClick={onClose}><X size={16}/></button>
        </div>

        <div className="mb-4 p-3 bg-[#fff5f5] rounded-lg">
          <div className="text-xs text-[#666] uppercase">Cliente</div>
          <div className="font-medium">{order.customer?.name}</div>
          <div className="text-sm text-[#666]">{order.customer?.phone}</div>
          {order.delivery_zone && <div className="text-xs text-[#666] mt-1">📍 {order.delivery_zone} · {order.note}</div>}
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <div className="font-semibold text-sm">Articles</div>
            {canEdit && !editing && <button onClick={()=>setEditing(true)} className="text-xs text-[#0021cc] flex items-center gap-1" data-testid="order-edit"><Pencil size={11}/>Modifier</button>}
          </div>
          <div className="space-y-2">{items.map((it,i)=>(
            <div key={i} className="flex items-center gap-3 text-sm border-b border-[#ececec] pb-2">
              <div className="w-10 h-10 bg-[#fff5f5] rounded overflow-hidden"><img src={it.image} alt="" className="w-full h-full object-cover"/></div>
              <div className="flex-1"><div className="font-medium">{it.name}</div><div className="text-xs text-[#666]">{[it.size,it.color].filter(Boolean).join(" · ")}</div></div>
              {editing ? <input type="number" min="1" className="dina-input w-16 tabular !py-1 text-center" value={it.qty} onChange={e=>{const n=[...items];n[i]={...n[i],qty:+e.target.value};setItems(n);}}/> : <span className="text-xs">×{it.qty}</span>}
              <div className="tabular w-20 text-right">{fcfa(it.qty*it.price)}</div>
            </div>
          ))}</div>
        </div>

        <div className="text-sm space-y-1 mb-4">
          <div className="flex justify-between"><span className="text-[#666]">Sous-total</span><span className="tabular">{fcfa(items.reduce((s,i)=>s+i.qty*i.price,0))}</span></div>
          <div className="flex justify-between items-center"><span className="text-[#666]">Livraison</span>{editing ? <input type="number" className="dina-input w-24 !py-1 tabular text-right" value={fee} onChange={e=>setFee(e.target.value)}/> : <span className="tabular">{fcfa(fee)}</span>}</div>
          <div className="flex justify-between items-center"><span className="text-[#666]">Remise</span>{editing ? <input type="number" className="dina-input w-24 !py-1 tabular text-right" value={discount} onChange={e=>setDiscount(e.target.value)}/> : <span className="tabular text-[#1f8a4c]">-{fcfa(discount)}</span>}</div>
          <div className="flex justify-between font-semibold text-base pt-1 border-t"><span>Total</span><span className="tabular text-[#b02a2a]">{fcfa(items.reduce((s,i)=>s+i.qty*i.price,0)+(+fee)-(+discount))}</span></div>
        </div>

        {editing ? (
          <div className="flex gap-2 mb-4"><button onClick={()=>{setEditing(false);setItems(order.items);setDiscount(order.discount||0);setFee(order.delivery_fee||0);}} className="dina-btn-secondary flex-1">Annuler</button><button onClick={save} className="dina-btn-primary flex-1" data-testid="order-save">Enregistrer</button></div>
        ) : canEdit && (
          <div className="mb-4">
            <div className="text-xs text-[#666] mb-2">Changer le statut</div>
            <div className="flex gap-1 flex-wrap">{STATUSES.map(s=><button key={s} onClick={()=>onStatus(order.id,s)} className={`px-2 py-1 text-xs rounded border ${order.status===s?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec]"}`} data-testid={`change-status-${s}`}>{statusLabel[s]}</button>)}
              <button onClick={()=>onStatus(order.id,"reportee")} className="px-2 py-1 text-xs rounded border border-[#e4991e] text-[#e4991e]" data-testid="change-status-reportee">⏱ Reporter</button>
            </div>
          </div>
        )}

        <div className="text-xs text-[#666]">
          <div className="font-semibold text-[#1c1c1c] mb-1">Historique</div>
          {(order.timeline||[]).map((t,i)=><div key={i}>{dateTimeFmt(t.at)} · {statusLabel[t.status]||t.status} · {t.by}{t.reason?` — ${t.reason}`:""}</div>)}
        </div>
      </div>
    </div>
  );
}
