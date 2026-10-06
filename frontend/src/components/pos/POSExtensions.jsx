import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { toast } from "sonner";
import { X, ArrowUpCircle, ArrowDownCircle, Shield, PauseCircle, Play, Trash2 } from "lucide-react";

/** PIN authorization modal — asks a manager/admin to type their PIN to approve a sensitive action. */
export function PinAuthModal({ action, actionLabel, amount, onApprove, onCancel }) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (pin.length < 4) return setErr("Le PIN doit faire 4 chiffres");
    setLoading(true); setErr("");
    try {
      const { data } = await api.post("/pos/pin-authorize", { pin, action, amount });
      toast.success(`Autorisé par ${data.approver}`);
      onApprove(data);
    } catch (e) {
      setErr(e.response?.data?.detail || "PIN invalide");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-[60] p-4" onClick={onCancel}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-sm" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-lg bg-[#fff5f5] dark:bg-[#2a1818] grid place-items-center text-[#b02a2a]"><Shield size={16}/></div>
          <div>
            <div className="font-serif text-lg">Autorisation requise</div>
            <div className="text-xs text-[#666]">{actionLabel}{amount?` · ${fcfa(amount)}`:""}</div>
          </div>
        </div>
        <div className="text-xs text-[#666] mb-3">Demandez à la gérante ou un admin de taper son PIN à 4 chiffres pour valider.</div>
        <input autoFocus type="password" inputMode="numeric" maxLength={6} className="dina-input text-center tracking-[12px] font-serif text-2xl" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="••••" data-testid="pin-input"/>
        {err && <div className="text-xs text-[#c62828] mt-2">{err}</div>}
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="dina-btn-secondary flex-1">Annuler</button>
          <button onClick={submit} disabled={loading||pin.length<4} className="dina-btn-primary flex-1" data-testid="pin-approve">{loading?"…":"Valider"}</button>
        </div>
      </div>
    </div>
  );
}

const REASONS_IN = ["Fond de caisse","Versement livreur","Monnaie apportée","Autre"];
const REASONS_OUT = ["Dépôt en banque","Achat sachets","Petits achats","Remboursement cash","Autre"];

export function CashDrawer({ onClose }) {
  const [data, setData] = useState(null);
  const [type, setType] = useState("in");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState(REASONS_IN[0]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/cash-movements").then(r=>setData(r.data)).catch(()=>{});
  useEffect(() => { load(); }, []);
  useEffect(() => { setReason(type==="in"?REASONS_IN[0]:REASONS_OUT[0]); }, [type]);

  const save = async () => {
    if (!amount || +amount <= 0) return toast.error("Montant invalide");
    setSaving(true);
    try {
      await api.post("/cash-movements", { type, amount: +amount, reason, note });
      setAmount(""); setNote(""); toast.success("Mouvement enregistré"); load();
    } catch { toast.error("Erreur"); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-end md:items-center z-50 p-0 md:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-t-2xl md:rounded-2xl p-5 w-full md:max-w-xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()} data-testid="cash-drawer">
        <div className="flex items-center justify-between mb-4">
          <div><div className="font-serif text-xl">Mouvements de caisse</div><div className="text-xs text-[#666]">Du jour</div></div>
          <button onClick={onClose}><X size={18}/></button>
        </div>

        {data && (
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="dina-card-white p-3"><div className="text-[9px] uppercase text-[#666]">Ventes espèces</div><div className="font-serif text-lg tabular">{fcfa(data.cash_sales)}</div></div>
            <div className="dina-card-white p-3"><div className="text-[9px] uppercase text-[#666]">Entrées</div><div className="font-serif text-lg tabular text-[#1f8a4c]">+{fcfa(data.ins)}</div></div>
            <div className="dina-card-white p-3"><div className="text-[9px] uppercase text-[#666]">Sorties</div><div className="font-serif text-lg tabular text-[#c62828]">-{fcfa(data.outs)}</div></div>
            <div className="dina-card-white p-3" style={{borderColor:"#b02a2a"}}><div className="text-[9px] uppercase text-[#666]">Attendu en caisse</div><div className="font-serif text-lg tabular text-[#b02a2a]">{fcfa(data.expected)}</div></div>
          </div>
        )}

        <div className="dina-card-white p-4 space-y-2.5">
          <div className="text-xs uppercase font-semibold text-[#666]">Nouveau mouvement</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={()=>setType("in")} className={`py-2.5 rounded-lg border font-semibold text-sm flex items-center justify-center gap-2 ${type==="in"?"bg-[#1f8a4c] text-white border-[#1f8a4c]":"border-[#ececec] dark:border-[#2a2a2a]"}`} data-testid="cash-type-in"><ArrowUpCircle size={14}/>Entrée</button>
            <button onClick={()=>setType("out")} className={`py-2.5 rounded-lg border font-semibold text-sm flex items-center justify-center gap-2 ${type==="out"?"bg-[#c62828] text-white border-[#c62828]":"border-[#ececec] dark:border-[#2a2a2a]"}`} data-testid="cash-type-out"><ArrowDownCircle size={14}/>Sortie</button>
          </div>
          <input type="number" className="dina-input tabular" placeholder="Montant FCFA" value={amount} onChange={e=>setAmount(e.target.value)} data-testid="cash-amount"/>
          <select className="dina-input" value={reason} onChange={e=>setReason(e.target.value)}>{(type==="in"?REASONS_IN:REASONS_OUT).map(r=><option key={r}>{r}</option>)}</select>
          <input className="dina-input" placeholder="Note (optionnel)" value={note} onChange={e=>setNote(e.target.value)}/>
          <button onClick={save} disabled={saving} className="dina-btn-primary w-full" data-testid="cash-save">{saving?"…":"Enregistrer"}</button>
        </div>

        {data?.movements?.length>0 && (
          <div className="mt-4">
            <div className="text-xs uppercase font-semibold text-[#666] mb-2">Historique du jour · {data.movements.length}</div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin">
              {data.movements.map(m => (
                <div key={m.id} className="flex items-center gap-2 p-2 border border-[#ececec] dark:border-[#2a2a2a] rounded-lg text-sm">
                  {m.type==="in" ? <ArrowUpCircle size={14} className="text-[#1f8a4c] shrink-0"/> : <ArrowDownCircle size={14} className="text-[#c62828] shrink-0"/>}
                  <div className="flex-1 min-w-0"><div className="truncate">{m.reason}{m.note?` · ${m.note}`:""}</div><div className="text-[10px] text-[#999]">{m.user_name} · {new Date(m.created_at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</div></div>
                  <div className={`tabular font-semibold ${m.type==="in"?"text-[#1f8a4c]":"text-[#c62828]"}`}>{m.type==="in"?"+":"-"}{fcfa(m.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function HoldsPanel({ onResume, onClose }) {
  const [list, setList] = useState([]);
  const load = () => api.get("/pos/holds").then(r=>setList(r.data));
  useEffect(() => { load(); }, []);
  const resume = async (h) => { onResume(h); await api.delete(`/pos/holds/${h.id}`); };
  const del = async (hid) => { await api.delete(`/pos/holds/${hid}`); toast.success("Panier supprimé"); load(); };

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-end md:items-center z-50 p-0 md:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-t-2xl md:rounded-2xl p-5 w-full md:max-w-md max-h-[80vh] overflow-y-auto" onClick={e=>e.stopPropagation()} data-testid="holds-panel">
        <div className="flex items-center justify-between mb-4"><div><div className="font-serif text-xl">Commandes ouvertes</div><div className="text-xs text-[#666]">{list.length} en attente</div></div><button onClick={onClose}><X size={18}/></button></div>
        {list.length === 0 ? <div className="text-sm text-[#666] text-center py-6">Aucune commande ouverte</div> : list.map(h => {
          const t = h.items.reduce((s,x)=>s+(x.qty||0)*(x.price||0),0);
          return (
            <div key={h.id} className="dina-card-white p-3 mb-2" data-testid={`hold-${h.id}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="min-w-0"><div className="text-sm font-semibold truncate">{h.customer?.name || "Sans cliente"}</div><div className="text-[10px] text-[#999]">{new Date(h.created_at).toLocaleString("fr-FR",{dateStyle:"short",timeStyle:"short"})} · {h.user_name}</div></div>
                <div className="tabular font-semibold text-sm">{fcfa(t)}</div>
              </div>
              <div className="text-xs text-[#666] truncate">{h.items.map(x=>`${x.qty}× ${x.name}`).join(" · ")}</div>
              {h.note && <div className="text-[10px] text-[#999] italic mt-1">« {h.note} »</div>}
              <div className="flex gap-1 mt-2">
                <button onClick={()=>resume(h)} className="dina-btn-primary !min-h-[32px] text-xs flex-1" data-testid={`hold-resume-${h.id}`}><Play size={12}/>Reprendre</button>
                <button onClick={()=>del(h.id)} className="dina-btn-secondary !min-h-[32px] !px-2" title="Supprimer"><Trash2 size={12}/></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
