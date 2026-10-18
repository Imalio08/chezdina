import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, FolderOpen, Power } from "lucide-react";
import EmployeeFile from "@/components/team/EmployeeFile";
import { useAuth } from "@/context/AuthContext";

import { useRoles } from "@/lib/useRoles";

export default function Team() {
  const [t, setT] = useState([]);
  const [ROLES_ALL] = useRoles();
  const ROLES = ROLES_ALL.map(r => ({ v: r.key, label: r.label }));
  const [att, setAtt] = useState([]);
  const [code, setCode] = useState("");
  const [editing, setEditing] = useState(null);
  const [fileOf, setFileOf] = useState(null);
  const [onb, setOnb] = useState({});
  const { user: me } = useAuth();
  const owner = me?.role === "admin";

  const load = async () => {
    try { const [a, b] = await Promise.all([api.get("/team"), api.get("/attendance")]); setT(a.data); setAtt(b.data); }
    catch { toast.error("Erreur"); }
    if (owner) api.get("/onboarding/overview").then(r => setOnb(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const punch = async () => { try { const r = await api.post("/attendance/punch",{code}); toast.success(`Pointé: ${r.data.user}`); setCode(""); load(); } catch { toast.error("Code inconnu"); } };

  const save = async (f) => {
    const { doc_ids, ...body } = f;
    try {
      if (editing?.id) await api.patch(`/users/${editing.id}`, body);
      else {
        const r = await api.post("/users", body);
        if (doc_ids?.length) await api.post(`/onboarding/employees/${r.data.id}/assign`, { template_ids: doc_ids });
      }
      toast.success(doc_ids?.length ? "Employé créé · documents envoyés à signer" : "Enregistré"); setEditing(null); load();
    } catch (ex) { toast.error(ex?.response?.data?.detail || "Erreur"); }
  };
  const toggleAccess = async (u) => {
    const off = u.active !== false;
    if (off && !window.confirm(`Désactiver l'accès de ${u.name} ? Toutes ses sessions seront fermées immédiatement sur tous ses appareils.`)) return;
    try { await api.post(`/privacy/users/${u.id}/${off ? "deactivate" : "reactivate"}`); toast.success(off ? "Accès désactivé · sessions fermées" : "Accès réactivé"); load(); }
    catch (ex) { toast.error(ex?.response?.data?.detail || "Erreur"); }
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
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Membres ({t.length})</div>
          <div className="overflow-x-auto"><table className="dina-table">
            <thead><tr><th>Nom</th><th>Rôle</th><th>Téléphone</th><th>Présent</th>{owner && <th>Documents</th>}<th></th></tr></thead>
            <tbody>{t.map(u=>(
              <tr key={u.id} data-testid={`team-row-${u.email}`} className={u.active === false ? "opacity-50" : ""}>
                <td className="font-medium">{u.name}{u.active === false && <span className="text-[10px] text-[#c62828] ml-1" data-testid={`team-inactive-${u.email}`}>désactivé</span>}</td>
                <td className="capitalize">{ROLES.find(r=>r.v===u.role)?.label || u.role}</td>
                <td className="text-[#666] text-xs">{u.phone}</td>
                <td>{present.has(u.id)?<span className="dina-chip" style={{color:"#1f8a4c"}}><span className="status-dot" style={{background:"#1f8a4c"}}/>Présent</span>:<span className="dina-chip" style={{color:"#666"}}>—</span>}</td>
                {owner && <td><OnbChip s={onb[u.id]} /></td>}
                <td className="text-right whitespace-nowrap">{owner && u.role !== "admin" && <><button onClick={()=>setFileOf(u)} className="text-[#5867fd] mr-2" title="Dossier · Onboarding" data-testid={`team-file-${u.email}`}><FolderOpen size={14}/></button><button onClick={()=>toggleAccess(u)} className={`mr-2 ${u.active === false ? "text-[#1f8a4c]" : "text-[#b26a00]"}`} title={u.active === false ? "Réactiver l'accès" : "Désactiver l'accès (1 clic)"} data-testid={`team-access-${u.email}`}><Power size={14}/></button></>}<button onClick={()=>setEditing(u)} className="text-[#0021cc] mr-2"><Pencil size={14}/></button><button onClick={()=>del(u.id)} className="text-[#c62828]"><Trash2 size={14}/></button></td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>

        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Pointages récents</div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">{att.slice(0,30).map(x=><div key={x.id} className="flex justify-between text-sm py-1.5 border-b border-[#f0f0f0]"><div><div className="font-medium">{x.user_name}</div><div className="text-xs text-[#666] capitalize">{x.role}</div></div><div className="text-xs text-[#666] text-right"><div>{dateTimeFmt(x.at)}</div></div></div>)}</div>
        </div>
      </div>

      {editing && <UserForm initial={editing.id?editing:null} onSave={save} onClose={()=>setEditing(null)} owner={owner}/>}
      {fileOf && <EmployeeFile emp={fileOf} onClose={()=>setFileOf(null)} onChanged={load}/>}
    </div>
  );
}

function OnbChip({ s }) {
  if (!s) return <span className="text-xs text-[#999]">—</span>;
  return <span className="text-[11px] whitespace-nowrap" data-testid="onb-chip"><span className="text-[#1f8a4c]">{s.signed} signé{s.signed > 1 ? "s" : ""}</span>{s.pending > 0 && <span className="text-[#b26a00]"> · {s.pending} en attente</span>}{s.expired > 0 && <span className="text-[#c62828]"> · {s.expired} expiré{s.expired > 1 ? "s" : ""}</span>}</span>;
}

function DocPicker({ value, onChange }) {
  const [tpls, setTpls] = useState([]);
  useEffect(() => { api.get("/onboarding/templates").then(r => { const a = r.data.filter(x => x.active); setTpls(a); onChange(a.map(x => x.id)); }).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!tpls.length) return null;
  return (
    <div className="border-t pt-2" data-testid="user-doc-picker">
      <div className="text-xs font-semibold mb-1">Documents à signer avant le premier accès</div>
      {tpls.map(t => <label key={t.id} className="flex items-center gap-2 text-xs py-0.5"><input type="checkbox" checked={value.includes(t.id)} onChange={e => onChange(e.target.checked ? [...value, t.id] : value.filter(x => x !== t.id))} data-testid={`user-doc-${t.kind}`} />{t.title}</label>)}
    </div>
  );
}

function UserForm({ initial, onSave, onClose, owner }) {
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
          {!initial && owner && <DocPicker value={f.doc_ids || []} onChange={ids => setF(p => ({ ...p, doc_ids: ids }))} />}
        </div>
        <div className="flex gap-2 mt-4"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={()=>onSave(f)} className="dina-btn-primary flex-1" data-testid="user-save">Enregistrer</button></div>
      </div>
    </div>
  );
}
