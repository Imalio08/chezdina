import React, { useState, useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { toast } from "sonner";
import { Trash2, MapPin, Navigation2, ChevronLeft, ChevronRight, Copy, ExternalLink } from "lucide-react";
import { track } from "@/lib/analytics";

const ZONES = {"Cocody":1500,"Riviera":2000,"Angré":2000,"Plateau":1000,"Marcory":1500,"Zone 4":1500,"Treichville":1500,"Koumassi":2000,"Yopougon":2500,"Abobo":3000,"Adjamé":1500,"Port-Bouët":2500,"Bingerville":3000,"Songon":3500,"Grand-Bassam":5000};
const ABIDJAN = { lat: 5.3600, lng: -4.0083 };

export default function Checkout() {
  const { cart, updateCartQty, removeFromCart, clearCart } = useApp();
  const [imgIdx, setImgIdx] = useState({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [zone, setZone] = useState("Cocody");
  const [addr, setAddr] = useState("");
  const [method, setMethod] = useState("cod");
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [cartImages, setCartImages] = useState({});
  const [paymentConfig, setPaymentConfig] = useState({ wave_link: "", deposit_policy: { mode: "none", value: 0, threshold: 0 } });
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const nav = useNavigate();

  useEffect(() => { api.get("/public/payment-config").then(r => setPaymentConfig(r.data)).catch(() => {}); track("checkout_started", { value: 0 }); }, []);
  useEffect(() => {
    const uniq = [...new Set(cart.map(x=>x.product_id))];
    uniq.forEach(pid => { if (!cartImages[pid]) api.get(`/public/product/${pid}`).then(r=>setCartImages(prev=>({...prev,[pid]:(r.data.images||[r.data.image]).filter(Boolean)}))).catch(()=>{}); });
    // eslint-disable-next-line
  }, [cart.length]);

  const sub = cart.reduce((s,x)=>s+x.qty*x.price,0);
  const fee = ZONES[zone] || 0;
  const total = sub + fee;

  // Compute expected deposit for COD based on payment config
  const pol = paymentConfig.deposit_policy || { mode: "none" };
  const threshold = Number(pol.threshold || 0);
  let expectedDeposit = 0;
  if (method === "cod" && total >= threshold) {
    if (pol.mode === "pct") expectedDeposit = Math.round(total * (Number(pol.value || 0) / 100));
    else if (pol.mode === "fixed") expectedDeposit = Math.min(total, Number(pol.value || 0));
  }
  const remaining = total - expectedDeposit;

  const locate = () => {
    if (!navigator.geolocation) return toast.error("Géolocalisation non disponible");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); toast.success("Position captée"); setLocating(false); },
      () => { toast.error("Impossible de localiser — autorisez la géolocalisation"); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const openMap = () => {
    const c = coords || ABIDJAN;
    window.open(`https://www.google.com/maps/@${c.lat},${c.lng},16z`, "_blank");
  };

  const checkout = async () => {
    if (!cart.length) return toast.error("Panier vide");
    if (!name || !phone) return toast.error("Nom et téléphone requis");
    if (submitting) return;
    setSubmitting(true);
    try {
      const { data } = await api.post("/public/orders", {
        items: cart.map(x=>({product_id:x.product_id,name:x.name,size:x.size,color:x.color,qty:x.qty,price:x.price,image:x.image})),
        customer: { name, phone, address: addr, lat: coords?.lat, lng: coords?.lng },
        channel: "boutique", payment_method: method, delivery_zone: zone, delivery_fee: fee, mode: "delivery",
      });
      toast.success("Commande créée !");
      track("order_placed", { order_code: data.code, value: total });
      if (data.status === "en_attente_acompte" && data.deposit_required > 0) {
        setConfirmedOrder({ code: data.code, deposit: data.deposit_required, total });
      } else {
        clearCart(); nav(`/suivi/${data.code}`);
      }
    } catch { toast.error("Erreur commande"); } finally { setSubmitting(false); }
  };

  const copyRef = (text) => { navigator.clipboard?.writeText(text); toast.success("Copié"); };

  const nextImg = (pid, len) => setImgIdx(p=>({...p, [pid]: ((p[pid]||0)+1) % len}));
  const prevImg = (pid, len) => setImgIdx(p=>({...p, [pid]: ((p[pid]||0)-1+len) % len}));

  return (
    <>
    <div className="max-w-5xl mx-auto px-4 py-8 grid md:grid-cols-[1fr_380px] gap-8">
      <div>
        <h1 className="font-serif text-3xl mb-5">Panier & Livraison</h1>
        {cart.length === 0 ? <div className="text-sm text-[#666] py-10 text-center dina-card">Votre panier est vide.</div> : (
          <div className="space-y-3 mb-6">{cart.map(it => {
            const imgs = cartImages[it.product_id] || [it.image];
            const idx = imgIdx[it.product_id] || 0;
            const curr = imgs[idx] || it.image;
            return (
              <div key={it.key} className="flex items-center gap-3 border-b border-[#ececec] pb-3" data-testid={`cart-item-${it.key}`}>
                <div className="relative w-20 h-20 bg-[#fff5f5] rounded-lg overflow-hidden shrink-0 group">
                  <img src={curr} alt="" className="w-full h-full object-cover"/>
                  {imgs.length > 1 && (
                    <>
                      <button onClick={()=>prevImg(it.product_id, imgs.length)} className="absolute left-0.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/90 grid place-items-center opacity-0 group-hover:opacity-100 transition" data-testid={`cart-prev-${it.key}`}><ChevronLeft size={10}/></button>
                      <button onClick={()=>nextImg(it.product_id, imgs.length)} className="absolute right-0.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/90 grid place-items-center opacity-0 group-hover:opacity-100 transition" data-testid={`cart-next-${it.key}`}><ChevronRight size={10}/></button>
                      <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">{imgs.map((_,i)=><span key={i} className={`w-1 h-1 rounded-full ${i===idx?"bg-[#b02a2a]":"bg-white/70"}`}/>)}</div>
                    </>
                  )}
                </div>
                <div className="flex-1 min-w-0 overflow-hidden"><div className="font-medium truncate">{it.name}</div><div className="text-xs text-[#666] truncate">{[it.size, it.color].filter(Boolean).join(" · ")}</div><div className="tabular text-sm font-semibold mt-1">{fcfa(it.price)}</div></div>
                <div className="flex items-center gap-2 shrink-0">
                  <input type="number" min="1" className="dina-input w-14 text-center tabular !px-1" value={it.qty} onChange={e=>updateCartQty(it.key, +e.target.value)}/>
                  <button onClick={()=>removeFromCart(it.key)} className="text-[#c62828]" data-testid={`cart-remove-${it.key}`}><Trash2 size={16}/></button>
                </div>
              </div>
            );
          })}</div>
        )}

        <div className="dina-card p-5 space-y-3">
          <div className="font-semibold">Informations de livraison</div>
          <input className="dina-input" placeholder="Nom complet" value={name} onChange={e=>setName(e.target.value)} data-testid="checkout-name"/>
          <input className="dina-input" placeholder="+225 XX XX XX XX XX" value={phone} onChange={e=>setPhone(e.target.value)} data-testid="checkout-phone"/>
          <select className="dina-input" value={zone} onChange={e=>setZone(e.target.value)} data-testid="checkout-zone">{Object.keys(ZONES).map(z=><option key={z}>{z}</option>)}</select>
          <textarea className="dina-input" placeholder="Adresse ou point de repère (ex: en face de la pharmacie Bellecôte)" value={addr} onChange={e=>setAddr(e.target.value)} data-testid="checkout-address"/>

          <div>
            <div className="text-xs uppercase text-[#666] mb-2 flex items-center gap-1"><MapPin size={12}/>Position GPS (recommandé pour une livraison précise)</div>
            <div className="flex gap-2">
              <button type="button" onClick={locate} disabled={locating} className="dina-btn-secondary flex-1 !min-h-[40px] text-sm" data-testid="checkout-locate"><Navigation2 size={14}/>{locating?"Localisation…":coords?"Repositionner":"Utiliser ma position actuelle"}</button>
              {coords && <button type="button" onClick={openMap} className="dina-btn-secondary !min-h-[40px] text-sm" data-testid="checkout-map-view">Voir sur Maps</button>}
            </div>
            {coords ? (
              <div className="mt-2 rounded-lg overflow-hidden border border-[#ececec]">
                <iframe
                  title="Carte livraison"
                  width="100%" height="180" frameBorder="0" style={{border:0}}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${coords.lng-0.003}%2C${coords.lat-0.002}%2C${coords.lng+0.003}%2C${coords.lat+0.002}&layer=mapnik&marker=${coords.lat}%2C${coords.lng}`}
                  data-testid="checkout-map-iframe"
                />
                <div className="bg-[#fff5f5] text-[11px] text-[#666] px-3 py-1.5 tabular">📍 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} · Partagée avec le livreur</div>
              </div>
            ) : (
              <div className="mt-2 text-[11px] text-[#666] bg-[#fff5f5] rounded-lg p-2.5 flex items-start gap-2"><MapPin size={12} className="mt-0.5 text-[#b02a2a]"/>Autorisez la géolocalisation pour que notre livreur vous trouve en 2 minutes.</div>
            )}
          </div>

          <div className="font-semibold pt-2">Paiement</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={()=>setMethod("cod")} className={`py-3 text-sm rounded-lg border ${method==="cod"?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec]"}`} data-testid="checkout-cod">Paiement à la livraison</button>
            <button onClick={()=>setMethod("wave")} className={`py-3 text-sm rounded-lg border ${method==="wave"?"bg-[#1c1c1c] text-white border-[#ececec]":"border-[#ececec]"}`} data-testid="checkout-wave">Wave</button>
          </div>
        </div>
      </div>

      <aside className="dina-card p-5 h-fit sticky top-24">
        <div className="font-semibold mb-3">Résumé</div>
        <div className="text-sm space-y-1">
          <div className="flex justify-between"><span className="text-[#666]">Sous-total</span><span className="tabular">{fcfa(sub)}</span></div>
          <div className="flex justify-between"><span className="text-[#666]">Livraison · {zone}</span><span className="tabular">{fcfa(fee)}</span></div>
          <div className="flex justify-between font-semibold text-base pt-2 border-t border-[#ececec]"><span>Total</span><span className="tabular">{fcfa(total)}</span></div>
          {method === "cod" && expectedDeposit > 0 && (
            <div className="mt-3 bg-[#fff5f5] p-3 rounded-lg text-xs" data-testid="checkout-deposit-info">
              <div className="font-semibold text-[#b02a2a] mb-1">⚡ Acompte requis pour cette commande</div>
              <div className="flex justify-between"><span>À payer maintenant (Wave)</span><span className="tabular font-bold">{fcfa(expectedDeposit)}</span></div>
              <div className="flex justify-between"><span>À régler à la livraison</span><span className="tabular font-bold">{fcfa(remaining)}</span></div>
              <div className="text-[10px] text-[#666] mt-1">{pol.mode === "pct" ? `${pol.value}% du total` : `Acompte fixe de ${fcfa(pol.value)}`}</div>
            </div>
          )}
        </div>
        <button onClick={checkout} disabled={!cart.length || submitting} className="dina-btn-primary w-full mt-4" data-testid="checkout-submit">{submitting ? "Envoi…" : expectedDeposit > 0 ? "Confirmer et payer l'acompte" : "Confirmer la commande"}</button>
      </aside>
      </div>

      {confirmedOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4" data-testid="deposit-modal">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="text-center mb-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-[#fff5f5] grid place-items-center text-[#b02a2a] mb-2"><ExternalLink size={22}/></div>
              <div className="font-serif text-xl">Commande {confirmedOrder.code} créée</div>
              <div className="text-xs text-[#666]">Elle sera confirmée dès réception de votre acompte Wave.</div>
            </div>
            <div className="bg-[#fff5f5] p-4 rounded-lg mb-4">
              <div className="flex items-center justify-between text-sm mb-2"><span className="text-[#666]">Montant acompte</span><span className="font-serif text-2xl text-[#b02a2a] tabular font-bold">{fcfa(confirmedOrder.deposit)}</span></div>
              <div className="text-xs mb-2"><span className="text-[#666]">Référence à indiquer dans la note Wave</span><div className="font-mono font-bold text-[#1c1c1c] text-base flex items-center gap-2 mt-0.5">{confirmedOrder.code}<button onClick={() => copyRef(confirmedOrder.code)} className="text-[#5867fd]" data-testid="copy-ref"><Copy size={12}/></button></div></div>
              <div className="text-xs text-[#c62828] italic">⚠️ N'oubliez pas de taper le montant exact et d'indiquer la référence dans la note du paiement Wave.</div>
            </div>
            <a href={paymentConfig.wave_link} target="_blank" rel="noreferrer" onClick={() => { setTimeout(() => { clearCart(); nav(`/suivi/${confirmedOrder.code}`); }, 500); }} className="dina-btn-primary w-full justify-center" data-testid="wave-pay-link"><ExternalLink size={14}/>Payer {fcfa(confirmedOrder.deposit)} avec Wave</a>
            <button onClick={() => { clearCart(); nav(`/suivi/${confirmedOrder.code}`); }} className="dina-btn-secondary w-full mt-2 text-xs" data-testid="later-link">Je paierai plus tard — voir ma commande</button>
          </div>
        </div>
      )}
    </>
  );
}
