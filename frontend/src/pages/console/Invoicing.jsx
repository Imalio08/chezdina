import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa, dateFmt } from "@/lib/format";

export default function Invoicing() {
  const [i, setI] = useState([]);
  useEffect(()=>{api.get("/invoices").then(r=>setI(r.data));},[]);
  return (
    <div className="space-y-5">
      <div><h1 className="font-serif text-3xl">Facturation</h1><p className="text-sm text-[#666]">Factures, devis, avoirs, bons de livraison</p></div>
      <div className="dina-card-white overflow-hidden"><table className="dina-table"><thead><tr><th>N°</th><th>Date</th><th>Client</th><th>Commande</th><th>Statut</th><th className="text-right">Total</th></tr></thead>
      <tbody>{i.map(x=><tr key={x.id} data-testid={`invoice-${x.number}`}><td className="font-mono text-xs">{x.number}</td><td className="text-[#666]">{dateFmt(x.created_at)}</td><td>{x.customer?.name}</td><td>{x.order_code}</td><td><span className="dina-chip" style={{color:"#1f8a4c"}}>Payée</span></td><td className="text-right tabular font-semibold">{fcfa(x.total)}</td></tr>)}</tbody></table></div>
    </div>
  );
}
