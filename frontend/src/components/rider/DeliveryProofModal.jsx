import React, { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { toast } from "sonner";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { Shield, Camera, X, Check, AlertTriangle } from "lucide-react";
import { compressImage } from "@/lib/imageCompress";
import { editImage } from "@/components/shared/ImageEditor";
import { enqueue, patchCachedOrder, isNetErr } from "@/lib/riderOffline";

export default function DeliveryProofModal({ order, onClose, onDone }) {
  const [tab, setTab] = useState("code"); // code | photo | thirdparty
  const [code, setCode] = useState("");
  const [photo, setPhoto] = useState("");
  const [sigRef, setSigRef] = useState(null);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [pin, setPin] = useState("");
  const [amount, setAmount] = useState(order.amount_due ?? (order.payment_method === "cod" ? Math.max(0, (order.total || 0) - (order.deposit_paid || 0)) : 0));
  const [paymentMethod] = useState(order.payment_method || "cod");
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState(null);
  useEffect(() => { api.get("/delivery-templates").then(r => { setTemplates(r.data); localStorage.setItem("dina_delivery_tpl", JSON.stringify(r.data)); }).catch(() => { try { setTemplates(JSON.parse(localStorage.getItem("dina_delivery_tpl") || "null")); } catch { } }); }, []);
  const threshold = templates?.proof_threshold || 50000;
  const highValue = (order.total || 0) >= threshold;
  const needsPin = tab !== "code" && highValue;

  const onPhoto = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    const c = await compressImage(f, 1600, 0.9); const ed = await editImage(c);
    if (ed) setPhoto(await compressImage(await (await fetch(ed)).blob()));
  };
  const getPos = () => new Promise(res => { if (!navigator.geolocation) return res({}); navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res({}), { timeout: 5000 }); });

  const submit = async () => {
    const pos = await getPos();
    const payload = { method: tab, lat: pos.lat, lng: pos.lng, amount_collected: +amount, payment_method: paymentMethod };
    if (tab === "code") { if (code.length !== 4) return toast.error("Code à 4 chiffres"); payload.code = code; }
    else {
      if (!photo) return toast.error("Photo requise");
      if (!sigRef || sigRef.isEmpty()) return toast.error("Signature requise");
      payload.photo = photo;
      payload.signature = sigRef.toDataURL();
      if (tab === "thirdparty") { if (!name) return toast.error("Nom du tiers requis"); payload.thirdparty_name = name; payload.thirdparty_relation = relation; }
      if (needsPin) { if (pin.length < 4) return toast.error("PIN gérante requis"); payload.manager_pin = pin; }
    }
    setLoading(true);
    const offline = async () => {
      if (tab === "code" && order.delivery_code && order.delivery_code !== code) { toast.error("Code incorrect · vérifiez avec la cliente"); return; }
      await enqueue("deliver", { order_id: order.id, payload });
      await patchCachedOrder(order.id, { status: "livree", proof: { method: tab, amount_collected: +amount, offline: true } });
      toast.success("Livraison enregistrée hors ligne · envoi automatique au retour du réseau"); onDone();
    };
    try { if (!navigator.onLine) await offline(); else { await api.post(`/orders/${order.id}/deliver`, payload); toast.success("Livraison confirmée"); onDone(); } }
    catch (e) { if (isNetErr(e)) await offline(); else toast.error(e.response?.data?.detail || "Erreur"); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[90] flex items-end lg:items-center lg:justify-center p-0 lg:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-t-2xl lg:rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-[#1a1a1a] p-4 border-b border-[#ececec] dark:border-[#2a2a2a] flex justify-between items-center">
          <div><div className="font-serif text-lg">Preuve de remise</div><div className="text-xs text-[#666]">{order.code} · {fcfa(order.total)}</div></div>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-1 bg-[#f5f5f5] dark:bg-[#2a2a2a] p-1 rounded-lg text-xs">
            <button onClick={() => setTab("code")} className={`flex-1 py-1.5 rounded-md ${tab === "code" ? "bg-white dark:bg-[#333] font-semibold" : ""}`} data-testid="proof-tab-code">Code</button>
            <button onClick={() => setTab("photo")} className={`flex-1 py-1.5 rounded-md ${tab === "photo" ? "bg-white dark:bg-[#333] font-semibold" : ""}`} data-testid="proof-tab-photo">Pas de code</button>
            <button onClick={() => setTab("thirdparty")} className={`flex-1 py-1.5 rounded-md ${tab === "thirdparty" ? "bg-white dark:bg-[#333] font-semibold" : ""}`} data-testid="proof-tab-thirdparty">Remis à un tiers</button>
          </div>
          {highValue && tab !== "code" && (
            <div className="p-2.5 bg-[#fff8e8] dark:bg-[#2a2318] rounded-lg text-xs flex gap-2 items-start"><AlertTriangle size={14} className="text-[#e4991e] shrink-0 mt-0.5" /><div>Commande ≥ {fcfa(threshold)} : PIN gérante obligatoire sans code.</div></div>
          )}
          {paymentMethod === "cod" && (
            <div><label className="text-xs uppercase text-[#999]">Montant encaissé (FCFA)</label><input type="number" className="dina-input tabular text-right" value={amount} onChange={e => setAmount(e.target.value)} data-testid="proof-amount" /></div>
          )}
          {tab === "code" && (
            <div>
              <label className="text-xs uppercase text-[#999]">Code 4 chiffres (donné par la cliente)</label>
              <input type="password" inputMode="numeric" maxLength={4} className="dina-input tracking-[0.8em] text-center text-2xl" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} data-testid="proof-code" />
            </div>
          )}
          {tab !== "code" && (
            <>
              <div>
                <label className="text-xs uppercase text-[#999]">Photo du colis remis</label>
                <label className="block mt-1 p-6 border-2 border-dashed border-[#ececec] dark:border-[#2a2a2a] rounded-lg text-center cursor-pointer">
                  <input type="file" accept="image/*" capture="environment" onChange={onPhoto} className="hidden" data-testid="proof-photo" />
                  {photo ? <img src={photo} alt="" className="max-h-32 mx-auto rounded" /> : <><Camera size={28} className="mx-auto text-[#999] mb-1" /><div className="text-xs text-[#666]">Appareil photo</div></>}
                </label>
              </div>
              <div>
                <label className="text-xs uppercase text-[#999]">Signature cliente · signez avec le doigt</label>
                <div className="border-2 border-[#1c1c1c]/30 rounded-lg bg-white" data-testid="proof-signature">
                  <SignatureCanvas ref={ref => setSigRef(ref)} canvasProps={{ className: "w-full h-52 rounded-lg touch-none" }} penColor="#000000" minWidth={2.5} maxWidth={5} backgroundColor="rgb(255,255,255)" />
                </div>
                <button onClick={() => sigRef && sigRef.clear()} className="text-xs font-semibold text-[#b02a2a] mt-1" data-testid="proof-signature-clear">Effacer la signature</button>
              </div>
              {tab === "thirdparty" && (
                <>
                  <div><label className="text-xs uppercase text-[#999]">Nom du tiers</label><input className="dina-input" value={name} onChange={e => setName(e.target.value)} data-testid="proof-tp-name" /></div>
                  <div><label className="text-xs uppercase text-[#999]">Lien avec la cliente</label><input className="dina-input" placeholder="Mère, voisin, gardien…" value={relation} onChange={e => setRelation(e.target.value)} data-testid="proof-tp-relation" /></div>
                </>
              )}
              {needsPin && (
                <div><label className="text-xs uppercase text-[#999] flex items-center gap-1"><Shield size={11} />PIN gérante</label><input type="password" inputMode="numeric" maxLength={6} className="dina-input tracking-[0.5em] text-center" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} data-testid="proof-pin" /></div>
              )}
            </>
          )}
          <button onClick={submit} disabled={loading} className="dina-btn-primary w-full !min-h-[48px]" data-testid="proof-submit"><Check size={14} />{loading ? "Validation…" : "Confirmer la livraison"}</button>
        </div>
      </div>
    </div>
  );
}
