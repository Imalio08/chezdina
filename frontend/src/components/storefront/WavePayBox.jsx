import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, Upload, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";

const compress = (file) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => {
    const k = Math.min(1, 1400 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    resolve(c.toDataURL("image/jpeg", 0.8));
  };
  img.onerror = () => reject(new Error("Image illisible"));
  img.src = URL.createObjectURL(file);
});

export const needsWave = (o) => o && (o.payment_method === "wave" || o.status === "en_attente_acompte") && !["paye", "acompte_recu"].includes(o.payment_status) && !["annulee", "livree"].includes(o.status);

function Copyable({ value, testid }) {
  const copy = () => { navigator.clipboard?.writeText(value); toast.success("Copié"); };
  return <span className="font-mono font-bold text-base inline-flex items-center gap-2">{value}<button type="button" onClick={copy} className="text-[#b02a2a]" data-testid={testid}><Copy size={13}/></button></span>;
}

function Instructions({ cfg, code, amount }) {
  return (
    <div className="bg-[#fff5f5] p-4 rounded-lg space-y-2 text-sm" data-testid="wave-instructions">
      <div className="flex justify-between items-center"><span className="text-[#666]">Montant à envoyer</span><span className="font-serif text-2xl text-[#b02a2a] tabular font-bold" data-testid="wave-amount">{fcfa(amount)}</span></div>
      {cfg.wave_number && <div className="flex justify-between items-center gap-2"><span className="text-[#666]">Numéro Wave{cfg.wave_name ? ` · ${cfg.wave_name}` : ""}</span><Copyable value={cfg.wave_number} testid="wave-copy-number"/></div>}
      <div className="flex justify-between items-center gap-2"><span className="text-[#666]">Référence à indiquer</span><Copyable value={code} testid="wave-copy-ref"/></div>
      {cfg.wave_link && <a href={cfg.wave_link} target="_blank" rel="noreferrer" className="dina-btn-primary w-full justify-center mt-1" data-testid="wave-pay-link"><ExternalLink size={14}/>Payer {fcfa(amount)} avec Wave</a>}
      <div className="text-xs text-[#666]">Après le paiement, faites une capture d'écran de la confirmation Wave et envoyez-la ci-dessous.</div>
    </div>
  );
}

function ProofForm({ code, phone, onDone }) {
  const [img, setImg] = useState("");
  const [tx, setTx] = useState("");
  const [tel, setTel] = useState(phone || "");
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { setImg(await compress(f)); } catch { toast.error("Image illisible · choisissez une autre capture"); }
  };
  const send = async () => {
    if (!img) return toast.error("Ajoutez la capture d'écran du paiement");
    setBusy(true);
    try { await api.post(`/public/orders/${code}/wave-proof`, { image: img, tx_ref: tx, phone: tel }); toast.success("Preuve envoyée · la boutique vérifie votre paiement"); onDone?.(); }
    catch (e) { toast.error(e.response?.data?.detail || "Envoi impossible · réessayez"); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-2" data-testid="wave-proof-form">
      <div className="font-semibold text-sm">Envoyer ma preuve de paiement</div>
      <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-[#e8c4c4] rounded-lg p-4 cursor-pointer text-xs text-[#666] hover:bg-[#fff5f5]" data-testid="wave-proof-drop">
        {img ? <img src={img} alt="Preuve" className="max-h-48 rounded" data-testid="wave-proof-preview"/> : <><Upload size={18} className="text-[#b02a2a]"/>Choisir la capture d'écran Wave</>}
        <input type="file" accept="image/*" className="hidden" onChange={pick} data-testid="wave-proof-file"/>
      </label>
      <input className="dina-input" placeholder="ID de transaction Wave (facultatif)" value={tx} onChange={e => setTx(e.target.value)} data-testid="wave-proof-tx"/>
      {!phone && <input className="dina-input" placeholder="Téléphone utilisé pour la commande" value={tel} onChange={e => setTel(e.target.value)} data-testid="wave-proof-phone"/>}
      <button type="button" onClick={send} disabled={busy} className="dina-btn-primary w-full justify-center" data-testid="wave-proof-submit">{busy ? "Envoi…" : "Soumettre la preuve"}</button>
    </div>
  );
}

export default function WavePayBox({ order, phone, onChange }) {
  const [cfg, setCfg] = useState({});
  useEffect(() => { api.get("/public/payment-config").then(r => setCfg(r.data || {})).catch(() => {}); }, []);
  const deposit = order.status === "en_attente_acompte";
  const amount = deposit ? order.deposit_required : order.total;
  const ps = order.payment_status;
  if (ps === "paye" || ps === "acompte_recu") return <div className="flex items-center gap-2 text-sm text-[#1f8a4c] font-semibold" data-testid="wave-status-paid"><CheckCircle2 size={16}/>Paiement Wave confirmé par la boutique</div>;
  if (ps === "preuve_envoyee") return (
    <div className="flex items-start gap-2 text-sm bg-[#fff7e6] text-[#8a5a00] rounded-lg p-3" data-testid="wave-status-pending">
      <Clock size={16} className="mt-0.5 shrink-0"/><div><b>Preuve envoyée · en attente de vérification</b><div className="text-xs mt-0.5">La boutique vérifie la réception sur Wave. Votre commande sera marquée payée dès validation.</div></div>
    </div>
  );
  return (
    <div className="space-y-3" data-testid="wave-pay-box">
      <div className="font-semibold">{deposit ? "Payer l'acompte avec Wave" : "Payer avec Wave"}</div>
      {ps === "preuve_refusee" && <div className="flex items-start gap-2 text-xs bg-[#fdecec] text-[#991b1b] rounded-lg p-3" data-testid="wave-status-rejected"><AlertTriangle size={14} className="mt-0.5 shrink-0"/><div><b>Paiement non retrouvé</b> · {order.wave_proof?.reject_reason || "la boutique n'a pas retrouvé ce paiement"}. Envoyez une nouvelle preuve.</div></div>}
      <Instructions cfg={cfg} code={order.code} amount={amount}/>
      <ProofForm code={order.code} phone={phone} onDone={onChange}/>
    </div>
  );
}
