import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export default function Promotions() {
  const [p, setP] = useState([]); const [show, setShow] = useState(false); const [f, setF] = useState({code:"",type:"percent",value:10,active:true});
  const load = ()=>api.get("/promotions").then(r=>setP(r.data));
  useEffect(load,[]);
  const save = async ()=>{await api.post("/promotions",f);toast.success("Promo créée");setShow(false);load();};
  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center"><div><h1 className="font-serif text-3xl">Promotions</h1><p className="text-sm text-[#666]">Codes promo, réductions automatiques, ventes flash</p></div><button onClick={()=>setShow(true)} className="dina-btn-primary !min-h-[40px]" data-testid="promo-new"><Plus size={14}/>Nouvelle promo</button></div>
      <div className="dina-card-white overflow-hidden"><table className="dina-table"><thead><tr><th>Code</th><th>Type</th><th className="text-right">Valeur</th><th className="text-right">Utilisations</th><th>Statut</th></tr></thead>
      <tbody>{p.map(x=><tr key={x.id} data-testid={`promo-row-${x.code}`}><td className="font-mono font-semibold">{x.code}</td><td className="capitalize">{x.type}</td><td className="text-right tabular">{x.type==="percent"?`${x.value}%`:x.value}</td><td className="text-right tabular">{x.uses}</td><td><span className="dina-chip" style={{color:x.active?"#1f8a4c":"#c62828"}}>{x.active?"Active":"Inactive"}</span></td></tr>)}</tbody></table></div>
      {show && <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={()=>setShow(false)}><div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e=>e.stopPropagation()}>
        <div className="font-serif text-xl mb-4">Nouvelle promo</div>
        <input className="dina-input mb-2" placeholder="Code (ex: FLASH25)" value={f.code} onChange={e=>setF({...f,code:e.target.value.toUpperCase()})} data-testid="promo-code"/>
        <select className="dina-input mb-2" value={f.type} onChange={e=>setF({...f,type:e.target.value})}><option value="percent">Pourcentage</option><option value="fixed">Montant fixe</option></select>
        <input type="number" className="dina-input mb-4" placeholder="Valeur" value={f.value} onChange={e=>setF({...f,value:+e.target.value})}/>
        <div className="flex gap-2"><button onClick={()=>setShow(false)} className="dina-btn-secondary flex-1">Annuler</button><button onClick={save} className="dina-btn-primary flex-1" data-testid="promo-save">Enregistrer</button></div>
      </div></div>}
    </div>
  );
}
