import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa, dateFmt } from "@/lib/format";
import { toast } from "sonner";
import { Plus } from "lucide-react";

const CATS = ["Loyer","CIE","SODECI","Internet","Salaires","Carburant livreurs","Emballage","Publicité","Autres"];
export default function Expenses() {
  const [e, setE] = useState([]); const [show, setShow] = useState(false); const [f, setF] = useState({category:"Internet",amount:0,note:"",payment_method:"cash"});
  const load = ()=>api.get("/expenses").then(r=>setE(r.data));
  useEffect(load,[]);
  const save = async ()=>{await api.post("/expenses",f);toast.success("Dépense enregistrée");setShow(false);load();};
  const total = e.reduce((s,x)=>s+x.amount,0);
  const byCat = e.reduce((a,x)=>{a[x.category]=(a[x.category]||0)+x.amount;return a;},{});
  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center"><div><h1 className="font-serif text-3xl">Dépenses & finances</h1><p className="text-sm text-[#666]">Suivi des charges · profit & perte</p></div><button onClick={()=>setShow(true)} className="dina-btn-primary !min-h-[40px]" data-testid="expense-new"><Plus size={14}/>Nouvelle dépense</button></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="dina-card-white p-5"><div className="text-xs uppercase text-[#666] mb-2">Total dépenses</div><div className="font-serif text-2xl tabular text-[#c62828]">{fcfa(total)}</div></div>
        {Object.entries(byCat).slice(0,3).map(([k,v])=><div key={k} className="dina-card-white p-5"><div className="text-xs uppercase text-[#666] mb-2">{k}</div><div className="font-serif text-2xl tabular">{fcfa(v)}</div></div>)}
      </div>
      <div className="dina-card-white overflow-hidden"><table className="dina-table"><thead><tr><th>Date</th><th>Catégorie</th><th>Note</th><th>Méthode</th><th className="text-right">Montant</th></tr></thead>
      <tbody>{e.slice(0,80).map(x=><tr key={x.id}><td className="text-[#666]">{dateFmt(x.created_at)}</td><td className="font-medium">{x.category}</td><td className="text-[#666]">{x.note}</td><td className="capitalize">{x.payment_method}</td><td className="text-right tabular font-semibold text-[#c62828]">-{fcfa(x.amount)}</td></tr>)}</tbody></table></div>
      {show && <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={()=>setShow(false)}><div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e=>e.stopPropagation()}>
        <div className="font-serif text-xl mb-4">Nouvelle dépense</div>
        <select className="dina-input mb-2" value={f.category} onChange={e=>setF({...f,category:e.target.value})}>{CATS.map(c=><option key={c}>{c}</option>)}</select>
        <input type="number" className="dina-input mb-2" placeholder="Montant" value={f.amount} onChange={e=>setF({...f,amount:+e.target.value})} data-testid="expense-amount"/>
        <input className="dina-input mb-4" placeholder="Note" value={f.note} onChange={e=>setF({...f,note:e.target.value})}/>
        <div className="flex gap-2"><button onClick={()=>setShow(false)} className="dina-btn-secondary flex-1">Annuler</button><button onClick={save} className="dina-btn-primary flex-1" data-testid="expense-save">Enregistrer</button></div>
      </div></div>}
    </div>
  );
}
