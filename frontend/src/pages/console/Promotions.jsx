import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa, dateFmt, dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Copy, Zap } from "lucide-react";

const TYPES = [
  { v:"percent", label:"Pourcentage (%)" },
  { v:"fixed", label:"Montant fixe (FCFA)" },
  { v:"free_delivery", label:"Livraison gratuite" },
  { v:"bogo", label:"2 pour 1 (BOGO)" },
];
const CHANNELS = ["all","boutique","store","whatsapp","instagram","tiktok"];
const FLASH_PRESETS = [
  { label:"1 heure", h:1 }, { label:"6 heures", h:6 }, { label:"24 heures", h:24 },
  { label:"48 heures", h:48 }, { label:"7 jours", h:168 },
];

export default function Promotions() {
  const [p, setP] = useState([]);
  const [editing, setEditing] = useState(null);
  const [flashOpen, setFlashOpen] = useState(false);
  const load = async () => { try { const r = await api.get("/promotions"); setP(r.data); } catch { toast.error("Erreur"); } };
  useEffect(() => { load(); }, []);
  const save = async (f) => {
    try {
      if (editing?.id) await api.patch(`/promotions/${editing.id}`, f);
      else await api.post("/promotions", f);
      toast.success("Enregistré"); setEditing(null); load();
    } catch { toast.error("Erreur"); }
  };
  const launchFlash = async (f) => {
    try {
      await api.post("/promotions", f);
      toast.success(`⚡ Vente flash ${f.code} lancée !`); setFlashOpen(false); load();
    } catch { toast.error("Erreur"); }
  };
  const del = async (id) => { if (!confirm("Supprimer ?")) return; await api.delete(`/promotions/${id}`); toast.success("Supprimé"); load(); };
  const toggle = async (promo) => { await api.patch(`/promotions/${promo.id}`, { active: !promo.active }); load(); };

  const flashActive = p.filter(x=>x.flash && x.active);
  const nowIso = new Date().toISOString();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="font-serif text-3xl">Promotions</h1><p className="text-sm text-[#666]">Codes promo, ventes flash, livraison gratuite</p></div>
        <div className="flex gap-2">
          <button onClick={()=>setFlashOpen(true)} className="dina-btn-primary !min-h-[40px]" style={{background:"linear-gradient(90deg,#b02a2a,#e4991e)"}} data-testid="flash-launcher"><Zap size={14}/>Vente flash</button>
          <button onClick={()=>setEditing({})} className="dina-btn-secondary !min-h-[40px]" data-testid="promo-new"><Plus size={14}/>Nouvelle promo</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Total</div><div className="font-serif text-2xl tabular">{p.length}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Actives</div><div className="font-serif text-2xl tabular text-[#1f8a4c]">{p.filter(x=>x.active).length}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Flash en cours</div><div className="font-serif text-2xl tabular text-[#b02a2a]">{flashActive.length}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Utilisations</div><div className="font-serif text-2xl tabular">{p.reduce((s,x)=>s+(x.uses||0),0)}</div></div>
      </div>

      <div className="dina-card-white overflow-hidden"><table className="dina-table">
        <thead><tr><th>Code</th><th>Type</th><th className="text-right">Valeur</th><th>Période</th><th>Canal</th><th>Flash</th><th className="text-right">Util.</th><th>Statut</th><th></th></tr></thead>
        <tbody>{p.map(x=>{
          const expired = x.ends_at && x.ends_at < nowIso;
          return (
            <tr key={x.id} data-testid={`promo-row-${x.code}`}>
              <td><button onClick={()=>{navigator.clipboard.writeText(x.code);toast.success("Code copié");}} className="font-mono font-semibold text-[#b02a2a] inline-flex items-center gap-1 hover:underline"><Copy size={10}/>{x.code}</button></td>
              <td>{TYPES.find(t=>t.v===x.type)?.label || x.type}</td>
              <td className="text-right tabular">{x.type==="percent"?`${x.value}%`:x.type==="fixed"?fcfa(x.value):x.type==="free_delivery"?"—":`${x.value}`}</td>
              <td className="text-xs text-[#666]">{x.starts_at?dateFmt(x.starts_at):"—"} → {x.ends_at?dateFmt(x.ends_at):"∞"}</td>
              <td className="text-xs capitalize">{x.channel||"all"}</td>
              <td>{x.flash && <span className="dina-chip" style={{color:"#b02a2a"}}>⚡ Flash</span>}</td>
              <td className="text-right tabular">{x.uses||0}{x.usage_limit>0 && `/${x.usage_limit}`}</td>
              <td><button onClick={()=>toggle(x)} className="dina-chip" style={{color:expired?"#c62828":x.active?"#1f8a4c":"#666"}} data-testid={`promo-toggle-${x.code}`}>{expired?"Expirée":x.active?"Active":"Inactive"}</button></td>
              <td className="text-right"><button onClick={()=>setEditing(x)} className="text-[#0021cc] mr-2"><Pencil size={14}/></button><button onClick={()=>del(x.id)} className="text-[#c62828]"><Trash2 size={14}/></button></td>
            </tr>
          );
        })}</tbody>
      </table></div>

      {editing && <PromoForm initial={editing.id?editing:null} onSave={save} onClose={()=>setEditing(null)}/>}
      {flashOpen && <FlashLauncher onLaunch={launchFlash} onClose={()=>setFlashOpen(false)}/>}
    </div>
  );
}

function FlashLauncher({ onLaunch, onClose }) {
  const [discount, setDiscount] = useState(20);
  const [hours, setHours] = useState(24);
  const [customDate, setCustomDate] = useState("");
  const [code, setCode] = useState(() => `FLASH${Math.floor(Math.random()*900+100)}`);
  const [channel, setChannel] = useState("all");
  const [minOrder, setMinOrder] = useState(0);

  const endsAt = customDate ? new Date(customDate).toISOString() : new Date(Date.now() + hours*3600*1000).toISOString();
  const endsLabel = new Date(endsAt).toLocaleString("fr-FR", { dateStyle:"short", timeStyle:"short" });

  const submit = () => {
    if (!code || discount <= 0) return toast.error("Code et % obligatoires");
    onLaunch({
      code: code.toUpperCase(),
      type: "percent",
      value: discount,
      starts_at: new Date().toISOString(),
      ends_at: endsAt,
      usage_limit: 0,
      min_order: +minOrder || 0,
      channel,
      active: true,
      flash: true,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md" onClick={e=>e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#b02a2a] to-[#e4991e] grid place-items-center text-white">⚡</div>
            <div>
              <div className="font-serif text-xl">Lancer une vente flash</div>
              <div className="text-xs text-[#666]">Un countdown live apparaîtra sur la vitrine</div>
            </div>
          </div>
        </div>

        <div className="space-y-4 mt-5">
          <div>
            <label className="text-xs uppercase text-[#666] font-semibold">Réduction</label>
            <div className="flex items-center gap-2 mt-1">
              <input type="range" min="5" max="70" step="5" value={discount} onChange={e=>setDiscount(+e.target.value)} className="flex-1 accent-[#b02a2a]" data-testid="flash-discount-range"/>
              <div className="text-right w-16"><span className="font-serif text-2xl text-[#b02a2a] tabular">-{discount}</span><span className="text-sm">%</span></div>
            </div>
          </div>

          <div>
            <label className="text-xs uppercase text-[#666] font-semibold">Durée</label>
            <div className="grid grid-cols-5 gap-1.5 mt-1">
              {FLASH_PRESETS.map(p=><button key={p.h} onClick={()=>{setHours(p.h); setCustomDate("");}} className={`px-2 py-2 rounded-lg text-xs font-semibold border transition ${!customDate && hours===p.h?"bg-[#b02a2a] text-white border-[#b02a2a]":"border-[#ececec] dark:border-[#2a2a2a] hover:bg-[#fff5f5] dark:hover:bg-[#2a1818]"}`} data-testid={`flash-preset-${p.h}`}>{p.label}</button>)}
            </div>
            <div className="mt-2">
              <label className="text-[10px] text-[#999] uppercase">Ou date/heure précise</label>
              <input type="datetime-local" className="dina-input mt-1" value={customDate} onChange={e=>setCustomDate(e.target.value)} data-testid="flash-custom-date"/>
            </div>
            <div className="mt-2 text-xs bg-[#fff5f5] dark:bg-[#2a1818] text-[#b02a2a] px-3 py-2 rounded-lg">Se termine le <b>{endsLabel}</b></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase text-[#666] font-semibold">Code</label>
              <input className="dina-input mt-1 font-mono uppercase" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} data-testid="flash-code"/>
            </div>
            <div>
              <label className="text-xs uppercase text-[#666] font-semibold">Canal</label>
              <select className="dina-input mt-1" value={channel} onChange={e=>setChannel(e.target.value)} data-testid="flash-channel">
                {CHANNELS.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs uppercase text-[#666] font-semibold">Panier min. (FCFA, 0 = aucun)</label>
            <input type="number" className="dina-input mt-1" value={minOrder} onChange={e=>setMinOrder(e.target.value)} data-testid="flash-min"/>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button>
          <button onClick={submit} className="dina-btn-primary flex-1" style={{background:"linear-gradient(90deg,#b02a2a,#e4991e)"}} data-testid="flash-launch"><Zap size={14}/>Lancer maintenant</button>
        </div>
      </div>
    </div>
  );
}

function PromoForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { code:"", type:"percent", value:10, starts_at:"", ends_at:"", usage_limit:0, min_order:0, channel:"all", active:true, flash:false });
  const toLocal = (iso) => iso ? iso.slice(0,16) : "";
  const toIso = (local) => local ? new Date(local).toISOString() : null;
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="font-serif text-xl mb-4">{initial?"Modifier":"Nouvelle"} promotion</div>
        <div className="space-y-3 text-sm">
          <input className="dina-input" placeholder="Code (ex: FLASH25)" value={f.code} onChange={e=>setF({...f,code:e.target.value.toUpperCase()})} data-testid="promo-code"/>
          <div className="grid grid-cols-2 gap-2">
            <select className="dina-input" value={f.type} onChange={e=>setF({...f,type:e.target.value})}>{TYPES.map(t=><option key={t.v} value={t.v}>{t.label}</option>)}</select>
            <input type="number" className="dina-input" placeholder="Valeur" value={f.value} onChange={e=>setF({...f,value:+e.target.value})} disabled={f.type==="free_delivery"}/>
          </div>
          <div>
            <label className="text-xs text-[#666] uppercase">Période de validité</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <input type="datetime-local" className="dina-input" value={toLocal(f.starts_at)} onChange={e=>setF({...f,starts_at:toIso(e.target.value)})} data-testid="promo-starts"/>
              <input type="datetime-local" className="dina-input" value={toLocal(f.ends_at)} onChange={e=>setF({...f,ends_at:toIso(e.target.value)})} data-testid="promo-ends"/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-[#666] uppercase">Limite d'utilisation (0 = ∞)</label><input type="number" className="dina-input mt-1" value={f.usage_limit} onChange={e=>setF({...f,usage_limit:+e.target.value})}/></div>
            <div><label className="text-xs text-[#666] uppercase">Montant min. commande</label><input type="number" className="dina-input mt-1" value={f.min_order} onChange={e=>setF({...f,min_order:+e.target.value})}/></div>
          </div>
          <select className="dina-input" value={f.channel} onChange={e=>setF({...f,channel:e.target.value})}>{CHANNELS.map(c=><option key={c} value={c}>Canal: {c}</option>)}</select>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={e=>setF({...f,active:e.target.checked})}/>Active</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.flash} onChange={e=>setF({...f,flash:e.target.checked})} data-testid="promo-flash"/>⚡ Vente flash (countdown sur site)</label>
          </div>
        </div>
        <div className="flex gap-2 mt-5"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={()=>onSave(f)} className="dina-btn-primary flex-1" data-testid="promo-save">Enregistrer</button></div>
      </div>
    </div>
  );
}
