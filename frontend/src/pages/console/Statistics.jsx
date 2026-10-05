import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function Statistics() {
  const [k, setK] = useState(null);
  useEffect(()=>{api.get("/dashboard/kpis").then(r=>setK(r.data));},[]);
  if (!k) return <div className="text-sm text-[#666]">Chargement…</div>;
  return (
    <div className="space-y-5">
      <div><h1 className="font-serif text-3xl">Statistiques</h1><p className="text-sm text-[#666]">Rapports multi-dimensions · exportables</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="dina-card-white p-5"><div className="text-xs uppercase text-[#666] mb-2">CA (30j)</div><div className="font-serif text-2xl tabular">{fcfa(k.rev_month)}</div></div>
        <div className="dina-card-white p-5"><div className="text-xs uppercase text-[#666] mb-2">Commandes</div><div className="font-serif text-2xl tabular">{k.orders_count}</div></div>
        <div className="dina-card-white p-5"><div className="text-xs uppercase text-[#666] mb-2">Panier moyen</div><div className="font-serif text-2xl tabular">{fcfa(k.avg_basket)}</div></div>
        <div className="dina-card-white p-5"><div className="text-xs uppercase text-[#666] mb-2">Articles vendus</div><div className="font-serif text-2xl tabular">{k.items_sold}</div></div>
      </div>
      <div className="dina-card-white p-5"><div className="font-semibold mb-4">CA par jour (14j)</div>
        <ResponsiveContainer width="100%" height={300}><BarChart data={k.sales_series}><CartesianGrid stroke="#f0f0f0" vertical={false}/><XAxis dataKey="date" fontSize={11} stroke="#999"/><YAxis fontSize={11} stroke="#999" tickFormatter={(v)=>`${(v/1000).toFixed(0)}k`}/><Tooltip formatter={(v)=>fcfa(v)}/><Bar dataKey="value" fill="#b02a2a" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>
      </div>
      <div className="dina-card-white p-5">
        <div className="font-semibold mb-3">Top produits (quantité)</div>
        <table className="dina-table"><thead><tr><th>Produit</th><th className="text-right">Quantité</th><th className="text-right">CA</th></tr></thead>
        <tbody>{k.top_products.map((p,i)=><tr key={i}><td className="font-medium">{p.name}</td><td className="text-right tabular">{p.qty}</td><td className="text-right tabular font-semibold">{fcfa(p.revenue)}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}
