import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa, dateFmt } from "@/lib/format";

export default function Purchases() {
  const [sups, setSups] = useState([]); const [pos, setPos] = useState([]);
  useEffect(()=>{Promise.all([api.get("/suppliers"),api.get("/purchase-orders")]).then(([a,b])=>{setSups(a.data);setPos(b.data);});},[]);
  return (
    <div className="space-y-5">
      <div><h1 className="font-serif text-3xl">Achats & fournisseurs</h1></div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Fournisseurs ({sups.length})</div>
          <table className="dina-table"><thead><tr><th>Nom</th><th>Pays</th><th>Téléphone</th><th className="text-right">Solde dû</th></tr></thead>
          <tbody>{sups.map(s=><tr key={s.id} data-testid={`supplier-${s.id}`}><td className="font-medium">{s.name}</td><td>{s.country}</td><td className="text-[#666]">{s.phone}</td><td className="text-right tabular">{fcfa(s.balance||0)}</td></tr>)}</tbody></table>
        </div>
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Bons de commande ({pos.length})</div>
          <table className="dina-table"><thead><tr><th>N°</th><th>Fournisseur</th><th>Date</th><th>Statut</th><th className="text-right">Total</th></tr></thead>
          <tbody>{pos.map(p=><tr key={p.id} data-testid={`po-${p.number}`}><td className="font-mono text-xs">{p.number}</td><td>{p.supplier_name}</td><td className="text-[#666]">{dateFmt(p.created_at)}</td><td><span className="dina-chip capitalize">{p.status}</span></td><td className="text-right tabular font-semibold">{fcfa(p.total)}</td></tr>)}</tbody></table>
        </div>
      </div>
    </div>
  );
}
