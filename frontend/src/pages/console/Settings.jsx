import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";

export default function Settings() {
  const [stores, setStores] = useState([]);
  useEffect(()=>{api.get("/stores").then(r=>setStores(r.data));},[]);
  const reseed = async ()=>{try{await api.post("/seed");toast.success("Données réensemencées");}catch{toast.error("Réservé admin");}};
  return (
    <div className="space-y-5">
      <div><h1 className="font-serif text-3xl">Paramètres</h1><p className="text-sm text-[#666]">Boutique, taxes, impression, numérotation…</p></div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Boutiques</div>
          {stores.map(s=><div key={s.id} className="border border-[#ececec] rounded-lg p-3 mb-2"><div className="font-medium">{s.name}{s.main && <span className="dina-chip ml-2 text-xs">Principale</span>}</div><div className="text-xs text-[#666]">{s.address} · {s.phone}</div></div>)}
        </div>
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Paiements</div>
          <label className="flex items-center justify-between py-2 text-sm"><span>Espèces</span><input type="checkbox" defaultChecked/></label>
          <label className="flex items-center justify-between py-2 text-sm"><span>Wave Business</span><input type="checkbox" defaultChecked/></label>
          <label className="flex items-center justify-between py-2 text-sm"><span>Paiement à la livraison</span><input type="checkbox" defaultChecked/></label>
          <label className="flex items-center justify-between py-2 text-sm"><span>Porte-monnaie client</span><input type="checkbox" defaultChecked/></label>
        </div>
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Zones de livraison Abidjan</div>
          <div className="flex flex-wrap gap-1 text-xs">{["Cocody","Riviera","Angré","Plateau","Marcory","Zone 4","Treichville","Koumassi","Yopougon","Abobo","Adjamé","Port-Bouët","Bingerville","Songon","Grand-Bassam"].map(z=><span key={z} className="dina-chip">{z} · 1500 FCFA</span>)}</div>
        </div>
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Données de démonstration</div>
          <p className="text-xs text-[#666] mb-3">Réensemencer les données de démo (produits, clients, commandes…).</p>
          <button onClick={reseed} className="dina-btn-secondary" data-testid="reseed-button">Réensemencer</button>
        </div>
      </div>
    </div>
  );
}
