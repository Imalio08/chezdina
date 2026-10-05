import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa, dateFmt } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

const CATS = ["Loyer","CIE","SODECI","Internet","Salaires","Carburant livreurs","Emballage","Publicité","Autres"];

export default function Expenses() {
  const [e, setE] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = async () => { try { const r = await api.get("/expenses"); setE(r.data); } catch { toast.error("Erreur"); } };
  useEffect(() => { load(); }, []);

  const save = async (f) => {
    try { await api.post("/expenses", f); toast.success("Enregistré"); setEditing(null); load(); }
    catch { toast.error("Erreur"); }
  };
  const del = async (id) => { if (!confirm("Supprimer ?")) return; await api.delete(`/expenses/${id}`); load(); };

  const total = e.reduce((s,x)=>s+x.amount,0);
  const byCat = e.reduce((a,x)=>{a[x.category]=(a[x.category]||0)+x.amount;return a;},{});

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center"><div><h1 className="font-serif text-3xl">Dépenses & finances</h1><p className="text-sm text-[#666]">Suivi des charges · P&L</p></div><button onClick={()=>setEditing({})} className="dina-btn-primary !min-h-[40px]" data-testid="expense-new"><Plus size={14}/>Nouvelle dépense</button></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Total dépenses</div><div className="font-serif text-2xl tabular text-[#c62828]">{fcfa(total)}</div></div>
        {Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=><div key={k} className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">{k}</div><div className="font-serif text-2xl tabular">{fcfa(v)}</div></div>)}
      </div>

      <div className="dina-card-white overflow-hidden"><table className="dina-table">
        <thead><tr><th>Date</th><th>Catégorie</th><th>Note</th><th>Méthode</th><th className="text-right">Montant</th><th></th></tr></thead>
        <tbody>{e.slice(0,200).map(x=>(
          <tr key={x.id} data-testid={`expense-${x.id}`}>
            <td className="text-[#666]">{dateFmt(x.created_at)}</td>
            <td className="font-medium">{x.category}</td>
            <td className="text-[#666] text-xs">{x.note}</td>
            <td className="capitalize text-xs">{x.payment_method}</td>
            <td className="text-right tabular font-semibold text-[#c62828]">-{fcfa(x.amount)}</td>
            <td className="text-right"><button onClick={()=>del(x.id)} className="text-[#c62828]"><Trash2 size={14}/></button></td>
          </tr>
        ))}</tbody>
      </table></div>

      {editing && <ExpenseForm onSave={save} onClose={()=>setEditing(null)}/>}
    </div>
  );
}

function ExpenseForm({ onSave, onClose }) {
  const [f, setF] = useState({ category:"Internet", amount:0, note:"", payment_method:"cash" });
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e=>e.stopPropagation()}>
        <div className="font-serif text-xl mb-4">Nouvelle dépense</div>
        <select className="dina-input mb-2" value={f.category} onChange={e=>setF({...f,category:e.target.value})}>{CATS.map(c=><option key={c}>{c}</option>)}</select>
        <input type="number" className="dina-input mb-2" placeholder="Montant" value={f.amount} onChange={e=>setF({...f,amount:+e.target.value})} data-testid="expense-amount"/>
        <input className="dina-input mb-2" placeholder="Note" value={f.note} onChange={e=>setF({...f,note:e.target.value})}/>
        <select className="dina-input mb-4" value={f.payment_method} onChange={e=>setF({...f,payment_method:e.target.value})}><option value="cash">Espèces</option><option value="wave">Wave</option><option value="virement">Virement</option></select>
        <div className="flex gap-2"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={()=>onSave(f)} className="dina-btn-primary flex-1" data-testid="expense-save">Enregistrer</button></div>
      </div>
    </div>
  );
}
