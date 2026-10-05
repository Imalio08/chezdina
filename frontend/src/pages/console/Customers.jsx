import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa, dateFmt, dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Upload, X, Mail, Phone, MapPin, Gift, Wallet, ShoppingBag, Ban, Check } from "lucide-react";

const SEGMENTS = [
  { v:"all", label:"Toutes" }, { v:"active", label:"Actives" }, { v:"inactive", label:"Inactives (30j+)" },
  { v:"vip", label:"VIP" }, { v:"blacklist", label:"Liste noire" },
];

export default function Customers() {
  const [c, setC] = useState([]);
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState("all");
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    try { const r = await api.get(`/customers${q||seg!=="all"?`?${q?`q=${encodeURIComponent(q)}&`:""}${seg!=="all"&&seg!=="active"&&seg!=="inactive"?`status=${seg}`:""}`:""}`); setC(r.data); }
    catch { toast.error("Erreur chargement"); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, seg]);

  const filtered = c.filter(x => {
    if (seg === "inactive") return x.derived_status === "inactive";
    if (seg === "active") return x.derived_status === "active";
    if (seg === "vip") return (x.loyalty_points||0) > 500;
    if (seg === "blacklist") return x.status === "blacklist";
    return true;
  });

  const save = async (data) => {
    try {
      if (editing?.id) await api.patch(`/customers/${editing.id}`, data);
      else await api.post("/customers", data);
      toast.success("Enregistré"); setEditing(null); load();
    } catch { toast.error("Erreur"); }
  };

  const uploadCsv = async (file) => {
    const text = await file.text();
    const lines = text.split("\n").filter(l=>l.trim()).slice(1);
    const rows = lines.map(l => {
      const [name, phone, email, address] = l.split(",").map(x=>x?.trim());
      return { name, phone, email: email||null, address: address||null };
    }).filter(r => r.name && r.phone);
    if (!rows.length) return toast.error("Fichier vide ou format invalide");
    try { const r = await api.post("/customers/bulk", rows); toast.success(`${r.data.inserted} clientes importées`); load(); }
    catch { toast.error("Erreur import"); }
  };

  const toggleBlacklist = async (c) => {
    const next = c.status === "blacklist" ? "active" : "blacklist";
    await api.patch(`/customers/${c.id}`, { status: next });
    toast.success(next === "blacklist" ? "Mise en liste noire" : "Réactivée");
    load();
  };

  const stats = {
    total: c.length,
    active: c.filter(x=>x.derived_status==="active").length,
    inactive: c.filter(x=>x.derived_status==="inactive").length,
    vip: c.filter(x=>(x.loyalty_points||0)>500).length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Clientes</h1><p className="text-sm text-[#666]">{filtered.length} / {c.length} profils</p></div>
        <div className="flex gap-2">
          <label className="dina-btn-secondary !min-h-[40px] cursor-pointer" data-testid="customers-upload"><Upload size={14}/>Importer CSV<input type="file" accept=".csv" className="hidden" onChange={e=>e.target.files[0]&&uploadCsv(e.target.files[0])}/></label>
          <button onClick={()=>setEditing({})} className="dina-btn-primary !min-h-[40px]" data-testid="customers-new"><Plus size={14}/>Nouvelle cliente</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Total</div><div className="font-serif text-2xl tabular mt-1">{stats.total}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Actives</div><div className="font-serif text-2xl tabular mt-1 text-[#1f8a4c]">{stats.active}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Inactives (30j+)</div><div className="font-serif text-2xl tabular mt-1 text-[#c62828]">{stats.inactive}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">VIP (500+ pts)</div><div className="font-serif text-2xl tabular mt-1 text-[#f4b12c]">{stats.vip}</div></div>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <input className="dina-input max-w-xs" placeholder="Rechercher nom ou tél…" value={q} onChange={e=>setQ(e.target.value)} data-testid="customers-search"/>
        <div className="flex gap-1">{SEGMENTS.map(s=><button key={s.v} onClick={()=>setSeg(s.v)} className={`px-3 py-1.5 text-xs rounded-full border ${seg===s.v?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec] text-[#666]"}`} data-testid={`cust-seg-${s.v}`}>{s.label}</button>)}</div>
      </div>

      <div className="dina-card-white overflow-hidden">
        <div className="overflow-x-auto"><table className="dina-table">
          <thead><tr><th>Nom</th><th>Téléphone</th><th>Email</th><th>Tailles</th><th>Niveau</th><th className="text-right">Points</th><th className="text-right">Porte-monnaie</th><th>Statut</th><th>Dernière cmd</th><th></th></tr></thead>
          <tbody>{filtered.slice(0,200).map(x=>(
            <tr key={x.id} onClick={()=>setSelected(x)} className="cursor-pointer" data-testid={`customer-row-${x.phone}`}>
              <td className="font-medium">{x.name}</td>
              <td className="text-[#666]">{x.phone}</td>
              <td className="text-[#666] text-xs">{x.email || "—"}</td>
              <td className="text-xs text-[#666]">P.{x.shoe_size} · T.{x.clothing_size}</td>
              <td><span className="dina-chip">{x.tier||"Bronze"}</span></td>
              <td className="text-right tabular">{x.loyalty_points||0}</td>
              <td className="text-right tabular font-semibold">{fcfa(x.wallet||0)}</td>
              <td>{x.status==="blacklist" ? <span className="dina-chip" style={{color:"#c62828"}}><Ban size={10}/>Noire</span> : x.derived_status==="inactive" ? <span className="dina-chip" style={{color:"#e4991e"}}>Inactive</span> : <span className="dina-chip" style={{color:"#1f8a4c"}}>Active</span>}</td>
              <td className="text-xs text-[#666]">{x.last_order_at ? dateFmt(x.last_order_at) : "—"}</td>
              <td className="text-right"><button onClick={(e)=>{e.stopPropagation();setEditing(x);}} className="text-[#0021cc]"><Pencil size={14}/></button></td>
            </tr>))}</tbody>
        </table></div>
      </div>

      {editing && <CustomerForm initial={editing.id?editing:null} onSave={save} onClose={()=>setEditing(null)}/>}
      {selected && <CustomerDetail cid={selected.id} onClose={()=>setSelected(null)} onEdit={()=>{setEditing(selected);setSelected(null);}} onToggleBl={()=>toggleBlacklist(selected)}/>}
    </div>
  );
}

function CustomerForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { name:"", phone:"+225 ", email:"", address:"", shoe_size:"", clothing_size:"", notes:"", status:"active", photo:"" });
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="font-serif text-xl mb-4">{initial?"Modifier":"Nouvelle"} cliente</div>
        <div className="space-y-2.5 text-sm">
          <input className="dina-input" placeholder="Nom *" value={f.name} onChange={e=>setF({...f,name:e.target.value})} data-testid="cust-form-name"/>
          <input className="dina-input" placeholder="Téléphone *" value={f.phone} onChange={e=>setF({...f,phone:e.target.value})} data-testid="cust-form-phone"/>
          <input className="dina-input" placeholder="Email" value={f.email||""} onChange={e=>setF({...f,email:e.target.value})}/>
          <input className="dina-input" placeholder="Adresse" value={f.address||""} onChange={e=>setF({...f,address:e.target.value})}/>
          <input className="dina-input" placeholder="URL photo (optionnel)" value={f.photo||""} onChange={e=>setF({...f,photo:e.target.value})}/>
          <div className="grid grid-cols-2 gap-2"><input className="dina-input" placeholder="Pointure" value={f.shoe_size||""} onChange={e=>setF({...f,shoe_size:e.target.value})}/><input className="dina-input" placeholder="Taille" value={f.clothing_size||""} onChange={e=>setF({...f,clothing_size:e.target.value})}/></div>
          <textarea className="dina-input" rows={2} placeholder="Notes" value={f.notes||""} onChange={e=>setF({...f,notes:e.target.value})}/>
        </div>
        <div className="flex gap-2 mt-4"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={()=>onSave(f)} className="dina-btn-primary flex-1" data-testid="cust-form-save">Enregistrer</button></div>
      </div>
    </div>
  );
}

function CustomerDetail({ cid, onClose, onEdit, onToggleBl }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.get(`/customers/${cid}`).then(r=>setData(r.data)); }, [cid]);
  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-end lg:place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        {!data ? <div className="text-sm text-[#666]">Chargement…</div> : (
          <>
            <div className="flex items-start gap-4 mb-5">
              <div className="w-20 h-20 rounded-full bg-[#fde8e8] grid place-items-center overflow-hidden">
                {data.customer.photo ? <img src={data.customer.photo} alt="" className="w-full h-full object-cover"/> : <span className="font-serif text-2xl text-[#b02a2a] font-bold">{data.customer.name[0]}</span>}
              </div>
              <div className="flex-1">
                <div className="font-serif text-2xl">{data.customer.name}</div>
                <div className="text-sm text-[#666] flex items-center gap-3 mt-1"><span className="flex items-center gap-1"><Phone size={11}/>{data.customer.phone}</span>{data.customer.email && <span className="flex items-center gap-1"><Mail size={11}/>{data.customer.email}</span>}</div>
                {data.customer.address && <div className="text-xs text-[#666] mt-1 flex items-center gap-1"><MapPin size={11}/>{data.customer.address}</div>}
                <div className="flex gap-2 mt-2">
                  <span className="dina-chip">{data.customer.tier||"Bronze"}</span>
                  <span className="dina-chip"><Gift size={10}/>{data.customer.loyalty_points||0} pts</span>
                  <span className="dina-chip"><Wallet size={10}/>{fcfa(data.customer.wallet||0)}</span>
                </div>
              </div>
              <button onClick={onClose}><X size={16}/></button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="dina-card p-3"><div className="text-[10px] uppercase text-[#666]">Commandes</div><div className="font-serif text-xl tabular">{data.metrics.total_orders}</div></div>
              <div className="dina-card p-3"><div className="text-[10px] uppercase text-[#666]">CA cumulé</div><div className="font-serif text-xl tabular">{fcfa(data.metrics.total_spent)}</div></div>
              <div className="dina-card p-3"><div className="text-[10px] uppercase text-[#666]">Dernière</div><div className="font-serif text-sm tabular pt-1">{data.metrics.last_order_at ? dateFmt(data.metrics.last_order_at) : "—"}</div></div>
            </div>

            {data.metrics.top_products.length>0 && (
              <div className="mb-5">
                <div className="font-semibold text-sm mb-2">Top produits achetés</div>
                <div className="space-y-2">{data.metrics.top_products.map((p,i)=><div key={i} className="flex items-center gap-3 p-2 bg-[#fff5f5] rounded-lg"><div className="w-9 h-9 rounded bg-white overflow-hidden">{p.image && <img src={p.image} alt="" className="w-full h-full object-cover"/>}</div><div className="flex-1 text-sm">{p.name}</div><div className="text-xs text-[#666]">×{p.qty}</div><div className="tabular text-sm font-semibold">{fcfa(p.spent)}</div></div>)}</div>
              </div>
            )}

            <div className="mb-5">
              <div className="font-semibold text-sm mb-2">Historique commandes</div>
              <div className="space-y-1 max-h-56 overflow-y-auto scrollbar-thin">{data.orders.map(o=><div key={o.id} className="flex items-center justify-between p-2 border-b border-[#f0f0f0] text-sm"><div><div className="font-medium">{o.code}</div><div className="text-xs text-[#666]">{dateFmt(o.created_at)} · {o.channel}</div></div><div><span className="dina-chip text-xs">{o.status}</span></div><div className="tabular font-semibold">{fcfa(o.total)}</div></div>)}</div>
            </div>

            <div className="flex gap-2">
              <button onClick={onEdit} className="dina-btn-secondary flex-1" data-testid="cust-detail-edit"><Pencil size={14}/>Modifier</button>
              <button onClick={onToggleBl} className="dina-btn-danger flex-1" data-testid="cust-detail-blacklist">{data.customer.status==="blacklist"?<><Check size={14}/>Réactiver</>:<><Ban size={14}/>Liste noire</>}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
