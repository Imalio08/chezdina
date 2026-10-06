import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, MapPin, DollarSign, Flag, Package, X } from "lucide-react";
import KPICard from "@/components/shared/KPICard";

export default function Zones() {
  const [zones, setZones] = useState([]);
  const [orders, setOrders] = useState([]);
  const [edit, setEdit] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const [z, o] = await Promise.all([api.get("/zones"), api.get("/orders").catch(()=>({data:[]}))]);
    setZones(z.data || []); setOrders(o.data || []);
  };
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const since = Date.now() - 30*24*3600*1000;
    const recent = orders.filter(o => new Date(o.created_at||0).getTime() > since && o.delivery_zone);
    const byZone = {};
    recent.forEach(o => { byZone[o.delivery_zone] = (byZone[o.delivery_zone]||0) + 1; });
    const top = Object.entries(byZone).sort((a,b)=>b[1]-a[1])[0];
    const totalFee = recent.reduce((s,o)=>s+(o.delivery_fee||0), 0);
    const active = zones.filter(z => z.active !== false).length;
    const avgFee = active ? Math.round(zones.reduce((s,z)=>s+(z.fee||0),0)/active) : 0;
    return { byZone, top, totalFee, active, avgFee };
  }, [zones, orders]);

  const save = async (f) => {
    try {
      if (f.id) await api.patch(`/zones/${f.id}`, f);
      else await api.post("/zones", f);
      toast.success("Enregistré"); setShowForm(false); setEdit(null); load();
    } catch { toast.error("Erreur"); }
  };
  const del = async (z) => {
    if (!confirm(`Supprimer la zone "${z.name}" ?`)) return;
    try { await api.delete(`/zones/${z.id}`); toast.success("Supprimé"); load(); }
    catch { toast.error("Erreur"); }
  };

  return (
    <div className="space-y-5" data-testid="zones-page">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Zones & tarifs</h1><p className="text-sm text-[#666]">Communes, tarifs de livraison et délais</p></div>
        <button onClick={()=>{setEdit(null); setShowForm(true);}} className="dina-btn-primary !min-h-[40px]" data-testid="zones-new"><Plus size={14}/>Nouvelle zone</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard testid="z-active" label="Zones actives" value={stats.active} icon={MapPin} color="#1f8a4c"/>
        <KPICard testid="z-avg" label="Tarif moyen" value={fcfa(stats.avgFee)} icon={DollarSign} color="#5867fd"/>
        <KPICard testid="z-top" label="Zone la plus commandée" value={stats.top?.[0] || "—"} info={stats.top?`${stats.top[1]} cmd/30j`:""} icon={Flag} color="#b02a2a"/>
        <KPICard testid="z-fees" label="Frais encaissés 30j" value={fcfa(stats.totalFee)} icon={Package} color="#e4991e"/>
      </div>

      <div className="dina-card-white overflow-hidden">
        <table className="dina-table" data-testid="zones-table">
          <thead><tr><th>Zone</th><th>Communes / quartiers</th><th className="text-right">Tarif</th><th className="text-right">Seuil offert</th><th>Délai estimé</th><th>Statut</th><th className="text-right">Cmd 30j</th><th></th></tr></thead>
          <tbody>{zones.length === 0 ? <tr><td colSpan={8} className="text-center text-sm text-[#666] py-8">Aucune zone</td></tr> :
            zones.map(z => (
              <tr key={z.id} data-testid={`zone-${z.name}`}>
                <td className="font-medium flex items-center gap-2">{z.color && <span className="w-3 h-3 rounded-full" style={{background:z.color}}/>}{z.name}</td>
                <td className="text-xs text-[#666]">{z.areas || "—"}</td>
                <td className="text-right tabular font-semibold">{fcfa(z.fee)}</td>
                <td className="text-right tabular text-xs text-[#666]">{z.free_from?fcfa(z.free_from):"—"}</td>
                <td className="text-xs">{z.delay || "24h"}</td>
                <td><span className={`dina-chip !py-0.5 text-[10px] ${z.active===false?"!text-[#999]":"!text-[#1f8a4c] !border-[#1f8a4c]"}`}>{z.active===false?"Désactivée":"Active"}</span></td>
                <td className="text-right tabular text-[#666]">{stats.byZone[z.name]||0}</td>
                <td className="text-right whitespace-nowrap">
                  <button onClick={()=>{setEdit(z); setShowForm(true);}} className="text-[#0021cc] mr-2" data-testid={`zone-edit-${z.name}`}><Pencil size={14}/></button>
                  <button onClick={()=>del(z)} className="text-[#c62828]"><Trash2 size={14}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && <ZoneForm initial={edit} onSave={save} onClose={()=>{setShowForm(false); setEdit(null);}}/>}
    </div>
  );
}

function ZoneForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { name:"", areas:"", fee:1500, free_from:0, delay:"24h", color:"#5867fd", active:true });
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()} data-testid="zone-form">
        <div className="flex items-center justify-between mb-3"><div className="font-serif text-xl">{initial?"Modifier":"Nouvelle"} zone</div><button onClick={onClose}><X size={18}/></button></div>
        <div className="space-y-3">
          <input className="dina-input" placeholder="Nom (ex: Cocody)" value={f.name} onChange={e=>setF({...f,name:e.target.value})} data-testid="zf-name"/>
          <textarea rows={2} className="dina-input" placeholder="Communes / quartiers couverts (ex: Angré 7e-8e-9e, Riviera 2-3)" value={f.areas||""} onChange={e=>setF({...f,areas:e.target.value})} data-testid="zf-areas"/>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] uppercase text-[#666]">Tarif FCFA</label><input type="number" className="dina-input tabular" value={f.fee||0} onChange={e=>setF({...f,fee:+e.target.value||0})} data-testid="zf-fee"/></div>
            <div><label className="text-[10px] uppercase text-[#666]">Offert à partir de</label><input type="number" className="dina-input tabular" value={f.free_from||0} onChange={e=>setF({...f,free_from:+e.target.value||0})} data-testid="zf-free"/></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] uppercase text-[#666]">Délai</label><input className="dina-input" value={f.delay||""} onChange={e=>setF({...f,delay:e.target.value})} data-testid="zf-delay"/></div>
            <div><label className="text-[10px] uppercase text-[#666]">Couleur</label><input type="color" className="dina-input h-10" value={f.color||"#5867fd"} onChange={e=>setF({...f,color:e.target.value})}/></div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={f.active!==false} onChange={e=>setF({...f,active:e.target.checked})} className="accent-[#b02a2a]"/>Active</label>
        </div>
        <div className="flex gap-2 mt-5"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={()=>onSave(f)} disabled={!f.name} className="dina-btn-primary flex-1" data-testid="zf-save">Enregistrer</button></div>
      </div>
    </div>
  );
}
