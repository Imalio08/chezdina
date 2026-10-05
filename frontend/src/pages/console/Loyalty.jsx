import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Gift, Star, Users } from "lucide-react";

export default function Loyalty() {
  const [c, setC] = useState([]);
  useEffect(() => { api.get("/customers").then(r=>setC(r.data)).catch(()=>{}); }, []);
  const byTier = c.reduce((a,x)=>{a[x.tier]=(a[x.tier]||0)+1;return a;},{});
  return (
    <div className="space-y-5">
      <div><h1 className="font-serif text-3xl">Fidélité & parrainage</h1><p className="text-sm text-[#666]">1 point pour 500 FCFA dépensés · Niveaux Bronze / Silver / Gold</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {["Bronze","Silver","Gold"].map(t=><div key={t} className="dina-card-white p-5"><div className="text-xs uppercase text-[#666] mb-2 flex items-center gap-2"><Star size={14}/>{t}</div><div className="font-serif text-3xl tabular">{byTier[t]||0}</div><div className="text-xs text-[#666] mt-1">clients</div></div>)}
        <div className="dina-card-white p-5"><div className="text-xs uppercase text-[#666] mb-2 flex items-center gap-2"><Gift size={14}/>Parrainages actifs</div><div className="font-serif text-3xl tabular">47</div></div>
      </div>
      <div className="dina-card-white p-5">
        <div className="font-semibold mb-3 flex items-center gap-2"><Users size={16}/>Top ambassadeurs</div>
        <table className="dina-table"><thead><tr><th>Client</th><th>Code</th><th className="text-right">Points</th><th>Niveau</th></tr></thead>
        <tbody>{c.sort((a,b)=>b.loyalty_points-a.loyalty_points).slice(0,15).map(x=><tr key={x.id}><td className="font-medium">{x.name}</td><td className="font-mono text-xs">{x.referral_code}</td><td className="text-right tabular font-semibold">{x.loyalty_points}</td><td><span className="dina-chip">{x.tier}</span></td></tr>)}</tbody></table>
      </div>
    </div>
  );
}
