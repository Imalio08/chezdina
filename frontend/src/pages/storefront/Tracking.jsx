import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { fcfa, statusLabel, statusColor, dateTimeFmt } from "@/lib/format";

export default function Tracking() {
  const { code } = useParams();
  const [o, setO] = useState(null); const [err, setErr] = useState("");
  useEffect(()=>{api.get(`/orders/track/${code}`).then(r=>setO(r.data)).catch(()=>setErr("Introuvable"));},[code]);
  if (err) return <div className="min-h-screen grid place-items-center text-sm">Commande introuvable. <Link to="/boutique" className="underline ml-1">Boutique</Link></div>;
  if (!o) return <div className="min-h-screen grid place-items-center text-sm">Chargement…</div>;
  const steps = ["nouvelle","confirmee","en_preparation","prete","en_livraison","livree"];
  const current = steps.indexOf(o.status);
  return (
    <div className="min-h-screen bg-[#f5f5f5] py-10 px-4">
      <div className="max-w-xl mx-auto">
        <Link to="/boutique" className="text-xs text-[#666]">← Retour boutique</Link>
        <div className="bg-white rounded-2xl p-6 mt-4 border border-[#ececec]">
          <div className="text-xs uppercase text-[#666] tracking-widest">Suivi de commande</div>
          <div className="font-serif text-2xl mt-1">{o.code}</div>
          <div className="text-sm text-[#666] mb-4">{dateTimeFmt(o.created_at)}</div>
          <div className="flex gap-1 mb-4">{steps.map((s,i)=><div key={s} className="flex-1 h-1.5 rounded-full" style={{background:i<=current?statusColor[s]:"#ececec"}}/>)}</div>
          <div className="dina-chip" style={{color:statusColor[o.status]}}><span className="status-dot" style={{background:statusColor[o.status]}}/>{statusLabel[o.status]}</div>
          {o.rider_name && <div className="text-sm mt-4 p-3 bg-[#fff8e9] rounded-lg">Livreur: <strong>{o.rider_name}</strong></div>}
          <div className="mt-6 space-y-1">{o.items.map((it,i)=><div key={i} className="flex justify-between text-sm"><span>{it.qty}× {it.name}</span><span className="tabular">{fcfa(it.qty*it.price)}</span></div>)}</div>
          <div className="flex justify-between font-semibold mt-4 pt-4 border-t border-[#ececec]"><span>Total</span><span className="tabular">{fcfa(o.total)}</span></div>
          <div className="mt-6"><div className="font-semibold text-sm mb-2">Historique</div>{(o.timeline||[]).map((t,i)=><div key={i} className="text-xs text-[#666]">{dateTimeFmt(t.at)} · {statusLabel[t.status]||t.status}</div>)}</div>
        </div>
      </div>
    </div>
  );
}
