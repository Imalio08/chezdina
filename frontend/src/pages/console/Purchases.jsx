import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa, dateFmt } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X } from "lucide-react";

const COUNTRIES = ["CI","TR","CN","AE","FR","MA","GH","SN"];

export default function Purchases() {
  const [sups, setSups] = useState([]);
  const [pos, setPos] = useState([]);
  const [editSup, setEditSup] = useState(null);
  const [editPo, setEditPo] = useState(null);

  const load = () => Promise.all([api.get("/suppliers"), api.get("/purchase-orders")])
    .then(([a,b])=>{ setSups(a.data); setPos(b.data); }).catch(()=>toast.error("Erreur"));
  useEffect(() => { load(); }, []);

  const saveSup = async (f) => {
    try {
      if (editSup?.id) await api.patch(`/suppliers/${editSup.id}`, f);
      else await api.post("/suppliers", f);
      toast.success("Fournisseur enregistré"); setEditSup(null); load();
    } catch { toast.error("Erreur"); }
  };
  const delSup = async (id) => { if (!confirm("Supprimer ce fournisseur ?")) return; await api.delete(`/suppliers/${id}`); toast.success("Supprimé"); load(); };

  const savePo = async (f) => {
    try {
      await api.post("/purchase-orders", f);
      toast.success("Bon de commande créé"); setEditPo(null); load();
    } catch { toast.error("Erreur"); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><div><h1 className="font-serif text-3xl">Achats & fournisseurs</h1><p className="text-sm text-[#666]">Fournisseurs et bons de commande</p></div></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Fournisseurs</div><div className="font-serif text-2xl tabular">{sups.length}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Soldes dus</div><div className="font-serif text-2xl tabular text-[#c62828]">{fcfa(sups.reduce((s,x)=>s+(x.balance||0),0))}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Bons de commande</div><div className="font-serif text-2xl tabular">{pos.length}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Total achats</div><div className="font-serif text-2xl tabular">{fcfa(pos.reduce((s,x)=>s+(x.total||0),0))}</div></div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="dina-card-white p-5">
          <div className="flex justify-between items-center mb-3"><div className="font-semibold">Fournisseurs ({sups.length})</div><button onClick={()=>setEditSup({})} className="dina-btn-primary !min-h-[36px] text-xs" data-testid="supplier-new"><Plus size={12}/>Nouveau</button></div>
          <table className="dina-table"><thead><tr><th>Nom</th><th>Pays</th><th>Téléphone</th><th className="text-right">Solde dû</th><th></th></tr></thead>
            <tbody>{sups.map(s=><tr key={s.id} data-testid={`supplier-${s.id}`}>
              <td className="font-medium">{s.name}</td>
              <td>{s.country}</td>
              <td className="text-[#666] text-xs">{s.phone}</td>
              <td className="text-right tabular">{fcfa(s.balance||0)}</td>
              <td className="text-right whitespace-nowrap"><button onClick={()=>setEditSup(s)} className="text-[#0021cc] mr-2"><Pencil size={13}/></button><button onClick={()=>delSup(s.id)} className="text-[#c62828]"><Trash2 size={13}/></button></td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="dina-card-white p-5">
          <div className="flex justify-between items-center mb-3"><div className="font-semibold">Bons de commande ({pos.length})</div><button onClick={()=>setEditPo({})} className="dina-btn-primary !min-h-[36px] text-xs" data-testid="po-new"><Plus size={12}/>Nouveau</button></div>
          <table className="dina-table"><thead><tr><th>N°</th><th>Fournisseur</th><th>Date</th><th>Statut</th><th className="text-right">Total</th></tr></thead>
            <tbody>{pos.map(p=><tr key={p.id} data-testid={`po-${p.number}`}><td className="font-mono text-xs">{p.number}</td><td>{p.supplier_name}</td><td className="text-[#666]">{dateFmt(p.created_at)}</td><td><span className="dina-chip capitalize">{p.status}</span></td><td className="text-right tabular font-semibold">{fcfa(p.total)}</td></tr>)}</tbody>
          </table>
        </div>
      </div>

      {editSup && <SupplierForm initial={editSup.id?editSup:null} onSave={saveSup} onClose={()=>setEditSup(null)}/>}
      {editPo && <PoForm sups={sups} onSave={savePo} onClose={()=>setEditPo(null)}/>}
    </div>
  );
}

function SupplierForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { name:"", country:"CI", phone:"", email:"", balance:0, notes:"" });
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4"><div className="font-serif text-xl">{initial?"Modifier":"Nouveau"} fournisseur</div><button onClick={onClose}><X size={16}/></button></div>
        <div className="space-y-2.5 text-sm">
          <input className="dina-input" placeholder="Nom *" value={f.name} onChange={e=>setF({...f,name:e.target.value})} data-testid="sup-name"/>
          <div className="grid grid-cols-2 gap-2">
            <select className="dina-input" value={f.country} onChange={e=>setF({...f,country:e.target.value})}>{COUNTRIES.map(c=><option key={c}>{c}</option>)}</select>
            <input className="dina-input" placeholder="Téléphone" value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/>
          </div>
          <input className="dina-input" placeholder="Email" value={f.email||""} onChange={e=>setF({...f,email:e.target.value})}/>
          <input type="number" className="dina-input" placeholder="Solde dû (FCFA)" value={f.balance||0} onChange={e=>setF({...f,balance:+e.target.value})}/>
          <textarea className="dina-input" rows={2} placeholder="Notes" value={f.notes||""} onChange={e=>setF({...f,notes:e.target.value})}/>
        </div>
        <div className="flex gap-2 mt-4"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={()=>onSave(f)} className="dina-btn-primary flex-1" data-testid="sup-save">Enregistrer</button></div>
      </div>
    </div>
  );
}

function PoForm({ sups, onSave, onClose }) {
  const [sid, setSid] = useState(sups[0]?.id || "");
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("en_attente");
  const sup = sups.find(s=>s.id===sid);

  const save = () => {
    if (!sup) return toast.error("Fournisseur requis");
    if (!total) return toast.error("Montant requis");
    onSave({ supplier_id: sid, supplier_name: sup.name, total: +total, status, items: [] });
  };

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4"><div className="font-serif text-xl">Nouveau bon de commande</div><button onClick={onClose}><X size={16}/></button></div>
        <div className="space-y-2.5 text-sm">
          <select className="dina-input" value={sid} onChange={e=>setSid(e.target.value)} data-testid="po-sup">{sups.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <input type="number" className="dina-input" placeholder="Montant total (FCFA) *" value={total} onChange={e=>setTotal(e.target.value)} data-testid="po-total"/>
          <select className="dina-input" value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="en_attente">En attente</option>
            <option value="confirme">Confirmée</option>
            <option value="receptionne">Réceptionnée</option>
            <option value="paye">Payée</option>
          </select>
        </div>
        <div className="flex gap-2 mt-4"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={save} className="dina-btn-primary flex-1" data-testid="po-save">Créer</button></div>
      </div>
    </div>
  );
}
