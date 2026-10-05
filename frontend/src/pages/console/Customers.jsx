import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa, dateFmt } from "@/lib/format";

export default function Customers() {
  const [c, setC] = useState([]); const [q, setQ] = useState("");
  useEffect(()=>{api.get(`/customers${q?`?q=${encodeURIComponent(q)}`:""}`).then(r=>setC(r.data));},[q]);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><div><h1 className="font-serif text-3xl">Clients</h1><p className="text-sm text-[#666]">{c.length} profils</p></div></div>
      <input className="dina-input max-w-md" placeholder="Rechercher par nom ou téléphone…" value={q} onChange={e=>setQ(e.target.value)} data-testid="customers-search"/>
      <div className="dina-card-white overflow-hidden"><div className="overflow-x-auto"><table className="dina-table">
        <thead><tr><th>Nom</th><th>Téléphone</th><th>Tailles</th><th>Niveau</th><th className="text-right">Points</th><th className="text-right">Porte-monnaie</th><th>Inscrit·e</th></tr></thead>
        <tbody>{c.slice(0,100).map(x=>(
          <tr key={x.id} data-testid={`customer-row-${x.phone}`}>
            <td className="font-medium">{x.name}</td><td className="text-[#666]">{x.phone}</td>
            <td className="text-xs text-[#666]">Pointure {x.shoe_size} · Taille {x.clothing_size}</td>
            <td><span className="dina-chip">{x.tier}</span></td>
            <td className="text-right tabular">{x.loyalty_points||0}</td>
            <td className="text-right tabular font-semibold">{fcfa(x.wallet||0)}</td>
            <td className="text-[#666]">{dateFmt(x.created_at)}</td>
          </tr>))}</tbody>
      </table></div></div>
    </div>
  );
}
