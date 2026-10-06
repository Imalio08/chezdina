import React, { useMemo, useState } from "react";
import { fcfa } from "@/lib/format";
import { Banknote, Smartphone, Wallet, Star, Shuffle, Truck, X } from "lucide-react";

const METHODS = [
  { id:"cash", label:"Espèces", icon: Banknote, color:"#1f8a4c" },
  { id:"wave", label:"Wave", icon: Smartphone, color:"#2566ff" },
  { id:"orange", label:"Orange Money", icon: Smartphone, color:"#ff7900" },
  { id:"mtn", label:"MTN MoMo", icon: Smartphone, color:"#ffcc00" },
  { id:"moov", label:"Moov Money", icon: Smartphone, color:"#1b5e9c" },
  { id:"wallet", label:"Porte-monnaie", icon: Wallet, color:"#b02a2a" },
  { id:"points", label:"Points fidélité", icon: Star, color:"#f4b12c" },
  { id:"mixed", label:"Paiement mixte", icon: Shuffle, color:"#1c1c1c" },
  { id:"cod", label:"À encaisser à la livraison", icon: Truck, color:"#e4991e" },
];
const QUICK = [10000, 20000, 50000];

export default function PosPayment({ total, mode, customer, onPay, onClose }) {
  const [method, setMethod] = useState(mode === "delivery" ? "cod" : "cash");
  const [cash, setCash] = useState(0);
  const [waveRef, setWaveRef] = useState("");
  const [mix, setMix] = useState({ cash:0, wave:0, wallet:0 });

  const change = useMemo(() => method === "cash" ? Math.max(0, Number(cash||0) - total) : 0, [cash, total, method]);
  const mixTotal = Number(mix.cash||0)+Number(mix.wave||0)+Number(mix.wallet||0);
  const walletMax = Number(customer?.wallet || 0);

  const canPay = () => {
    if (method === "cash") return Number(cash||0) >= total;
    if (method === "mixed") return mixTotal >= total;
    if (method === "wave" || method === "orange" || method === "mtn" || method === "moov") return !!waveRef.trim();
    return true;
  };

  const submit = () => {
    const details = { method, cash_received: Number(cash||0), change, reference: waveRef, mix };
    onPay(method, details);
  };

  const Method = METHODS.find(m=>m.id===method);

  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-end sm:place-items-center z-50 p-0 sm:p-4" onClick={onClose} data-testid="pos-payment-screen">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-[#ececec] dark:border-[#2a2a2a]">
          <div><div className="font-serif text-xl">Encaissement</div><div className="text-xs text-[#666]">Choisissez le mode de paiement</div></div>
          <button onClick={onClose}><X size={18}/></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-[#fff5f5] dark:bg-[#2a1818] rounded-xl p-4 flex items-center justify-between">
            <div className="text-sm text-[#666]">Total à encaisser</div>
            <div className="font-serif text-3xl tabular text-[#b02a2a]">{fcfa(total)}</div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {METHODS.filter(m => mode==="delivery" || m.id !== "cod").map(m => {
              const Icon = m.icon;
              return (
                <button key={m.id} onClick={()=>setMethod(m.id)} className={`py-3 rounded-xl border font-semibold text-sm flex items-center justify-center gap-2 transition ${method===m.id?"text-white border-transparent":"border-[#ececec] dark:border-[#2a2a2a] bg-white dark:bg-[#141414]"}`} style={method===m.id?{background:m.color}:{}} data-testid={`pay-method-${m.id}`}><Icon size={14}/>{m.label}</button>
              );
            })}
          </div>

          {method === "cash" && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase font-semibold text-[#666]">Montant reçu en espèces</div>
              <input type="number" className="dina-input tabular text-xl !py-3" placeholder="0" value={cash||""} onChange={e=>setCash(e.target.value)} data-testid="pay-cash-amount"/>
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={()=>setCash(total)} className="dina-chip" data-testid="pay-cash-exact">Exact · {fcfa(total)}</button>
                {QUICK.filter(v => v >= total).map(v => <button key={v} onClick={()=>setCash(v)} className="dina-chip" data-testid={`pay-cash-${v}`}>{fcfa(v)}</button>)}
              </div>
              <div className="flex justify-between text-sm pt-1 border-t border-[#ececec] dark:border-[#2a2a2a]"><span className="text-[#666]">Rendu à la cliente</span><span className="tabular font-bold text-[#1f8a4c]">{fcfa(change)}</span></div>
            </div>
          )}

          {(method === "wave" || method === "orange" || method === "mtn" || method === "moov") && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase font-semibold text-[#666]">Référence de la transaction</div>
              <input className="dina-input" placeholder="N° de transaction" value={waveRef} onChange={e=>setWaveRef(e.target.value)} data-testid="pay-ref"/>
              {customer && <button onClick={()=>{
                const txt = `Bonjour ${customer.name}, voici le lien pour régler ${fcfa(total)} chez Dina. Merci !`;
                const digits = (customer.phone||"").replace(/\D/g,"");
                window.open(`https://wa.me/${digits}?text=${encodeURIComponent(txt)}`,"_blank");
              }} className="text-xs text-[#1f8a4c] hover:underline" data-testid="pay-send-link">Envoyer le lien {Method.label} par WhatsApp →</button>}
            </div>
          )}

          {method === "wallet" && customer && (
            <div className="bg-[#fff5f5] dark:bg-[#2a1818] rounded-lg p-3 text-sm">
              Solde porte-monnaie : <b>{fcfa(walletMax)}</b> {walletMax < total && <span className="text-[#c62828]">· insuffisant, utilisez un paiement mixte</span>}
            </div>
          )}

          {method === "points" && customer && (
            <div className="bg-[#fff5f5] dark:bg-[#2a1818] rounded-lg p-3 text-sm">
              Points disponibles : <b>{customer.loyalty_points || 0} pts</b> ≈ {fcfa((customer.loyalty_points||0) * 10)}
            </div>
          )}

          {method === "mixed" && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase font-semibold text-[#666]">Répartissez le total ({fcfa(total)})</div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="text-[10px] text-[#999]">Espèces</label><input type="number" className="dina-input tabular" value={mix.cash||""} onChange={e=>setMix({...mix, cash:+e.target.value||0})} data-testid="pay-mix-cash"/></div>
                <div><label className="text-[10px] text-[#999]">Wave</label><input type="number" className="dina-input tabular" value={mix.wave||""} onChange={e=>setMix({...mix, wave:+e.target.value||0})} data-testid="pay-mix-wave"/></div>
                <div><label className="text-[10px] text-[#999]">Porte-monnaie</label><input type="number" className="dina-input tabular" value={mix.wallet||""} onChange={e=>setMix({...mix, wallet:+e.target.value||0})} data-testid="pay-mix-wallet"/></div>
              </div>
              <div className={`text-sm ${mixTotal>=total?"text-[#1f8a4c]":"text-[#c62828]"}`}>Total réparti : <b className="tabular">{fcfa(mixTotal)}</b> {mixTotal<total && `· manque ${fcfa(total-mixTotal)}`}</div>
            </div>
          )}

          {method === "cod" && <div className="bg-[#fff5f5] dark:bg-[#2a1818] rounded-lg p-3 text-sm">La cliente paiera <b>{fcfa(total)}</b> au livreur à la réception. Le livreur reversera les espèces à la clôture de journée.</div>}
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-[#1a1a1a] border-t border-[#ececec] dark:border-[#2a2a2a] p-4 flex gap-2">
          <button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button>
          <button onClick={submit} disabled={!canPay()} className="dina-btn-primary flex-1" data-testid="pay-confirm">Valider · {fcfa(total)}</button>
        </div>
      </div>
    </div>
  );
}
