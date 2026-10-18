import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";

import { useRoles } from "@/lib/useRoles";

export default function Team() {
  const [t, setT] = useState([]);
  const [ROLES_ALL] = useRoles();
  const ROLES = ROLES_ALL.map(r => ({ v: r.key, label: r.label }));
  const [att, setAtt] = useState([]);
  const [code, setCode] = useState("");
  const [editing, setEditing] = useState(null);

  const load = async () => {
    try { const [a, b] = await Promise.all([api.get("/team"), api.get("/attendance")]); setT(a.data); setAtt(b.data); }
    catch { toast.error("Erreur"); }
  };
  useEffect(() => { load(); }, []);

  const punch = async () => { try { const r = await api.post("/attendance/punch",{code}); toast.success(`Pointé: ${r.data.user}`); setCode(""); load(); } catch { toast.error("Code inconnu"); } };

  const save = async (f) => {
    try {
      if (editing?.id) await api.patch(`/users/${editing.id}`, f);
      else await api.post("/users", f);
      toast.success("Enregistré"); setEditing(null); load();
    } catch (ex) { toast.error(ex?.response?.data?.detail || "Erreur"); }
  };
  const del = async (id) => { if (!confirm("Supprimer ?")) return; await api.delete(`/users/${id}`); toast.success("Supprimé"); load(); };

  const today = new Date().toISOString().slice(0,10);
  const present = new Set(att.filter(x=>x.at.slice(0,10)===today).map(x=>x.user_id));

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center"><div><h1 className="font-serif text-3xl">Équipe</h1><p className="text-sm text-[#666]">Pointage, utilisateurs, rôles</p></div><button onClick={()=>setEditing({})} className="dina-btn-primary !min-h-[40px]" data-testid="team-new"><Plus size={14}/>Nouvel employé</button></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Total équipe</div><div className="font-serif text-2xl tabular">{t.length}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Présents aujourd'hui</div><div className="font-serif text-2xl tabular text-[#1f8a4c]">{present.size}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Livreurs</div><div className="font-serif text-2xl tabular">{t.filter(u=>u.role==="rider").length}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Vendeuses</div><div className="font-serif text-2xl tabular">{t.filter(u=>u.role==="sales").length}</div></div>
      </div>

      <div className="dina-card-white p-5">
        <div className="font-semibold mb-2">Borne de pointage</div>
        <div className="flex gap-2 items-center">
          <input className="dina-input max-w-xs text-center text-2xl tracking-widest font-serif" inputMode="numeric" maxLength={4} placeholder="Code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))} data-testid="attendance-code"/>
          <button onClick={punch} className="dina-btn-primary !min-h-[48px]" data-testid="attendance-punch">Pointer</button>
          <div className="text-xs text-[#666] ml-2">Codes démo: 1234 (admin), 2222 (manager), 3333, 4444, 5555…</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Membres ({t.length})</div>
          <table className="dina-table">
            <thead><tr><th>Nom</th><th>Rôle</th><th>Téléphone</th><th>Présent</th><th></th></tr></thead>
            <tbody>{t.map(u=>(
              <tr key={u.id} data-testid={`team-row-${u.email}`}>
                <td className="font-medium">{u.name}</td>
                <td className="capitalize">{ROLES.find(r=>r.v===u.role)?.label || u.role}</td>
                <td className="text-[#666] text-xs">{u.phone}</td>
                <td>{present.has(u.id)?<span className="dina-chip" style={{color:"#1f8a4c"}}><span className="status-dot" style={{background:"#1f8a4c"}}/>Présent</span>:<span className="dina-chip" style={{color:"#666"}}>—</span>}</td>
                <td className="text-right"><button onClick={()=>setEditing(u)} className="text-[#0021cc] mr-2"><Pencil size={14}/></button><button onClick={()=>del(u.id)} className="text-[#c62828]"><Trash2 size={14}/></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>

        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Pointages récents</div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">{att.slice(0,30).map(x=><div key={x.id} className="flex justify-between text-sm py-1.5 border-b border-[#f0f0f0]"><div><div className="font-medium">{x.user_name}</div><div className="text-xs text-[#666] capitalize">{x.role}</div></div><div className="text-xs text-[#666] text-right"><div>{dateTimeFmt(x.at)}</div></div></div>)}</div>
        </div>
      </div>

      {editing && <UserForm initial={editing.id?editing:null} onSave={save} onClose={()=>setEditing(null)}/>}
    </div>
  );
}

function UserForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { name:"", email:"", phone:"+225 ", role:"sales", password:"", pin:"" });
  const [all] = useRoles();
  const ROLES = all.filter(r => r.active || r.key === f.role).map(r => ({ v: r.key, label: r.label }));
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e=>e.stopPropagation()}>
        <div className="font-serif text-xl mb-4">{initial?"Modifier":"Nouvel"} employé</div>
        <div className="space-y-2.5 text-sm">
          <input className="dina-input" placeholder="Nom *" value={f.name} onChange={e=>setF({...f,name:e.target.value})} data-testid="user-name"/>
          <input className="dina-input" placeholder="Email *" value={f.email} onChange={e=>setF({...f,email:e.target.value})} data-testid="user-email"/>
          <input className="dina-input" placeholder="Téléphone" value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/>
          <select className="dina-input" value={f.role} onChange={e=>setF({...f,role:e.target.value})} data-testid="user-role">{ROLES.map(r=><option key={r.v} value={r.v}>{r.label}</option>)}</select>
          <input className="dina-input" placeholder={initial?"Nouveau mot de passe (laisser vide = inchangé)":"Mot de passe *"} value={f.password} onChange={e=>setF({...f,password:e.target.value})} data-testid="user-password"/>
          <input className="dina-input" placeholder="Code PIN (4 chiffres)" maxLength={4} value={f.pin} onChange={e=>setF({...f,pin:e.target.value.replace(/\D/g,"")})} data-testid="user-pin"/>
        </div>
        <div className="flex gap-2 mt-4"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={()=>onSave(f)} className="dina-btn-primary flex-1" data-testid="user-save">Enregistrer</button></div>
      </div>
    </div>
  );
}
