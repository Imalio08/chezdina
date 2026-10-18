import React, { useState, useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { toast } from "sonner";
import { reveal } from "@/lib/reveal";
import { Trash2, MapPin, Navigation2, ChevronLeft, ChevronRight, Copy, ExternalLink, X } from "lucide-react";
import CouponPicker from "@/components/shared/CouponPicker";
import { track } from "@/lib/analytics";
import { useCustomer } from "@/context/CustomerContext";
import WavePayBox from "@/components/storefront/WavePayBox";
import { colorCss } from "@/lib/colors";
import { DELIVERY_ZONES as ZONES, AddressFields, emptyAddress, validAddress, toPayload, addressLine } from "@/components/storefront/AddressForm";
import { useLocate } from "@/components/storefront/GeoHelp";

function AddressChooser({ addresses, choice, setChoice, draft, setDraft, saveNew, setSaveNew }) {
  return (
    <div className="space-y-2" data-testid="checkout-address-chooser">
      {addresses.map(a => (
        <label key={a.id} className={`flex gap-3 p-3 rounded-lg border cursor-pointer ${choice === a.id ? "border-[#b02a2a] bg-[#fff5f5]" : "border-[#ececec]"}`} data-testid={`checkout-addr-${a.id}`}>
          <input type="radio" checked={choice === a.id} onChange={() => setChoice(a.id)} className="mt-1"/>
          <div className="min-w-0 text-sm"><div className="font-medium">{a.label || "Adresse"}{a.default ? " · par défaut" : ""}{a.lat ? <span className="ml-1 text-[10px] text-[#1f8a4c]">● GPS</span> : null}</div><div className="text-[#666] break-words">{a.zone} · {addressLine(a)}</div></div>
        </label>
      ))}
      <label className={`flex gap-3 p-3 rounded-lg border cursor-pointer ${choice === "new" ? "border-[#b02a2a] bg-[#fff5f5]" : "border-[#ececec]"}`} data-testid="checkout-addr-new">
        <input type="radio" checked={choice === "new"} onChange={() => setChoice("new")}/><span className="text-sm font-medium">{addresses.length ? "Ajouter une nouvelle adresse" : "Adresse de livraison"}</span>
      </label>
      {choice === "new" && (
        <div className="p-3 border border-[#ececec] rounded-lg">
          <AddressFields v={draft} setV={setDraft} showDefault={false}/>
          <label className="flex items-center gap-2 text-sm mt-2"><input type="checkbox" checked={saveNew} onChange={e => setSaveNew(e.target.checked)} data-testid="checkout-save-address"/>Enregistrer cette adresse dans mon compte</label>
        </div>
      )}
    </div>
  );
}
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
  const { customer, refresh } = useCustomer();
  const addresses = customer?.addresses || [];
  const [choice, setChoice] = useState("new");
  const [draft, setDraft] = useState(emptyAddress());
  const [saveNew, setSaveNew] = useState(true);
  useEffect(() => {
    if (!customer) return;
    setName(n => n || customer.name || ""); setPhone(p => p || customer.phone || "");
    const def = addresses.find(a => a.default) || addresses[0];
    if (def) setChoice(c => c === "new" ? def.id : c);
  }, [customer?.id]); // eslint-disable-line
  const picked = customer && choice !== "new" ? addresses.find(a => a.id === choice) : null;
  useEffect(() => {
    const a = picked || (customer ? draft : null);
    if (!a) return;
    if (a.zone && ZONES[a.zone] !== undefined) setZone(a.zone);
    setAddr(addressLine(a)); setCoords(a.lat ? { lat: a.lat, lng: a.lng } : null);
  }, [choice, draft, customer?.id]); // eslint-disable-line

  useEffect(() => { api.get("/public/payment-config").then(r => setPaymentConfig(r.data)).catch(() => {}); track("checkout_started", { value: 0 }); }, []);
  useEffect(() => {
    const uniq = [...new Set(cart.map(x=>x.product_id))];
    uniq.forEach(pid => { if (!cartImages[pid]) api.get(`/public/product/${pid}`).then(r=>setCartImages(prev=>({...prev,[pid]:(r.data.images||[r.data.image]).filter(Boolean)}))).catch(()=>{}); });
    // eslint-disable-next-line
  }, [cart.length]);

  const sub = cart.reduce((s,x)=>s+x.qty*x.price,0);
  const fee = ZONES[zone] || 0;
  const [walletBal, setWalletBal] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  const [walletAmt, setWalletAmt] = useState(0);
  const [coupon, setCoupon] = useState(null);
  const [checkoutKey] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  useEffect(() => { if (customer) api.get("/public/account/wallet").then(r => { setWalletBal(r.data.balance); }).catch(() => {}); }, [customer?.id]); // eslint-disable-line
  const walletMax = Math.min(walletBal, Math.max(0, sub - (coupon?.discount || 0)));
  const walletUsed = useWallet ? Math.max(0, Math.min(Number(walletAmt) || 0, walletMax)) : 0;
  useEffect(() => { if (useWallet && !walletAmt) setWalletAmt(walletMax); }, [useWallet]); // eslint-disable-line
  const total = Math.max(0, sub + fee - (coupon?.discount || 0) - walletUsed);

  // Compute expected deposit for COD based on payment config
  const pol = paymentConfig.deposit_policy || { mode: "none" };
  const threshold = Number(pol.threshold || 0);
  let expectedDeposit = 0;
  if (method === "cod" && total >= threshold) {
    if (pol.mode === "pct") expectedDeposit = Math.round(total * (Number(pol.value || 0) / 100));
    else if (pol.mode === "fixed") expectedDeposit = Math.min(total, Number(pol.value || 0));
  }
  const remaining = total - expectedDeposit;

  const geo = useLocate((c) => { setCoords(c); toast.success("Position enregistrée"); }, coords);
  const locate = geo.locate;

  const openMap = () => {
    const c = coords || ABIDJAN;
    window.open(`https://www.google.com/maps/@${c.lat},${c.lng},16z`, "_blank");
  };

  const checkout = async () => {
    if (!cart.length) return toast.error("Panier vide");
    if (!name || !phone) { reveal(`[data-testid="checkout-${!name ? "name" : "phone"}"]`); return toast.error("Nom et téléphone requis"); }
    if (customer && choice === "new" && !validAddress(draft)) { reveal('[data-testid="address-fields"]'); return toast.error("Indiquez la zone et au moins un détail d'adresse (quartier, rue, repère ou GPS)"); }
    if (submitting) return;
    setSubmitting(true);
    try {
      if (customer && choice === "new" && saveNew) { await api.post("/public/account/addresses", toPayload(draft)).catch(() => {}); refresh(); }
      const { data } = await api.post("/public/orders", {
        items: cart.map(x=>({product_id:x.product_id,name:x.name,size:x.size,color:x.color,qty:x.qty,price:x.price,image:x.image})),
        customer: { ...(customer ? { id: customer.id } : {}), name, phone, address: addr, lat: coords?.lat, lng: coords?.lng },
        channel: "boutique", payment_method: method, delivery_zone: zone, delivery_fee: fee, mode: "delivery",
        wallet_use: walletUsed, checkout_key: checkoutKey, coupon_code: coupon?.code || null,
      });
      if (walletUsed && data.wallet_used !== walletUsed) toast.warning(`Porte-monnaie appliqué : ${fcfa(data.wallet_used || 0)}`);
      toast.success("Commande créée !");
      track("order_placed", { order_code: data.code, value: total });
      if ((data.status === "en_attente_acompte" && data.deposit_required > 0) || method === "wave") {
        clearCart();
        setConfirmedOrder({ code: data.code, status: data.status, deposit_required: data.deposit_required, total: data.total, payment_method: method, payment_status: "en_attente" });
      } else {
        clearCart(); nav(`/suivi/${data.code}`);
      }
    } catch (e) { const d = e.response?.data?.detail; toast.error(typeof d === "string" ? d : "La commande n'a pas pu être envoyée · vérifiez votre connexion et réessayez"); } finally { setSubmitting(false); }
  };

  const copyRef = (text) => { navigator.clipboard?.writeText(text); toast.success("Copié"); };

  const nextImg = (pid, len) => setImgIdx(p=>({...p, [pid]: ((p[pid]||0)+1) % len}));
  const prevImg = (pid, len) => setImgIdx(p=>({...p, [pid]: ((p[pid]||0)-1+len) % len}));

  return (
    <>
    <div className="max-w-5xl mx-auto px-4 py-8 grid md:grid-cols-[1fr_340px] lg:grid-cols-[1fr_380px] gap-6 lg:gap-8">
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
                <div className="flex-1 min-w-0 overflow-hidden"><div className="font-medium leading-tight break-words">{it.name}</div><div className="text-xs text-[#666] truncate flex items-center gap-1.5">{it.size && it.size !== "Unique" && <span>{it.size}</span>}{it.color && <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full border border-[#ddd] inline-block" style={{ background: colorCss(it.color) }}/>{it.color}</span>}</div><div className="tabular text-sm font-semibold mt-1">{fcfa(it.price)}</div></div>
                <div className="flex items-center gap-2 shrink-0">
                  <input type="number" min="1" className="dina-input !w-14 text-center tabular !px-1" value={it.qty} onChange={e=>updateCartQty(it.key, +e.target.value)}/>
                  <button onClick={()=>removeFromCart(it.key)} className="text-[#c62828]" data-testid={`cart-remove-${it.key}`}><Trash2 size={16}/></button>
                </div>
              </div>
            );
          })}</div>
        )}

        <div className="dina-card p-5 space-y-3">
          <div className="font-semibold">Informations de livraison</div>
          {customer ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#fff5f5] text-sm" data-testid="checkout-customer-card">
              <div className="w-9 h-9 rounded-full bg-[#fde8e8] text-[#b02a2a] font-semibold grid place-items-center shrink-0">{(customer.name || "?")[0]}</div>
              <div className="min-w-0"><div className="font-medium truncate">{name}</div><div className="text-[#666] text-xs">{phone}</div></div>
            </div>
          ) : (<>
          <div className="text-xs text-[#666]">Déjà cliente ? <a href="/compte" className="text-[#b02a2a] underline" data-testid="checkout-login-link">Connectez-vous</a> pour ne rien ressaisir.</div>
          <input className="dina-input" placeholder="Nom complet" value={name} onChange={e=>setName(e.target.value)} data-testid="checkout-name"/>
          <input className="dina-input" placeholder="+225 XX XX XX XX XX" value={phone} onChange={e=>setPhone(e.target.value)} data-testid="checkout-phone"/>
          </>)}
          {customer ? <AddressChooser addresses={addresses} choice={choice} setChoice={setChoice} draft={draft} setDraft={setDraft} saveNew={saveNew} setSaveNew={setSaveNew}/> : <>
          <select className="dina-input" value={zone} onChange={e=>setZone(e.target.value)} data-testid="checkout-zone">{Object.keys(ZONES).map(z=><option key={z}>{z}</option>)}</select>
          <textarea className="dina-input" placeholder="Adresse ou point de repère (ex: en face de la pharmacie Bellecôte)" value={addr} onChange={e=>setAddr(e.target.value)} data-testid="checkout-address"/>

          <div>
            <div className="text-xs uppercase text-[#666] mb-2 flex items-center gap-1"><MapPin size={12}/>Position GPS (recommandé pour une livraison précise)</div>
            <div className="flex gap-2">
              <button type="button" onClick={locate} disabled={geo.busy} className="dina-btn-secondary flex-1 !min-h-[40px] text-sm" data-testid="checkout-locate"><Navigation2 size={14}/>{geo.busy?"Localisation…":coords?"Repositionner":"Utiliser ma position actuelle"}</button>
              <button type="button" onClick={geo.openMap} className="dina-btn-secondary !min-h-[40px] text-sm" data-testid="checkout-map-pick">Carte</button>{geo.ui}
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
          </>}

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
          <div className="my-2"><CouponPicker subtotal={sub} fee={fee} value={coupon} onChange={setCoupon} testid="checkout-coupon"/></div>
          {coupon?.discount > 0 && <div className="flex justify-between text-[#1f8a4c]" data-testid="checkout-coupon-line"><span>Réduction · {coupon.code}</span><span className="tabular">−{fcfa(coupon.discount)}</span></div>}
          {customer && walletBal > 0 && (
            <div className="my-2 p-3 rounded-lg border border-[#ececec] bg-white space-y-2" data-testid="checkout-wallet">
              <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={useWallet} onChange={e => setUseWallet(e.target.checked)} data-testid="checkout-wallet-toggle"/>Utiliser mon porte-monnaie</label>
              <div className="text-xs text-[#666]">Disponible : <b data-testid="checkout-wallet-balance">{fcfa(walletBal)}</b> · utilisable jusqu'à {fcfa(walletMax)} (articles)</div>
              {useWallet && <div className="flex gap-2 items-center"><input type="number" min={0} max={walletMax} className="dina-input !min-h-[36px] flex-1" value={walletAmt} onChange={e => setWalletAmt(e.target.value === "" ? "" : Math.max(0, Math.min(Number(e.target.value), walletMax)))} data-testid="checkout-wallet-amount"/><button type="button" onClick={() => setWalletAmt(walletMax)} className="dina-chip" data-testid="checkout-wallet-max">Max</button></div>}
            </div>
          )}
          {walletUsed > 0 && <div className="flex justify-between text-[#1f8a4c]"><span>Porte-monnaie</span><span className="tabular" data-testid="checkout-wallet-used">−{fcfa(walletUsed)}</span></div>}
          <div className="flex justify-between font-semibold text-base pt-2 border-t border-[#ececec]"><span>{walletUsed > 0 ? "Reste à payer" : "Total"}</span><span className="tabular" data-testid="checkout-total">{fcfa(total)}</span></div>
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
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[92vh] overflow-y-auto relative">
            <button onClick={() => nav(`/suivi/${confirmedOrder.code}`)} className="absolute top-3 right-3 p-1 text-[#666] hover:text-[#1c1c1c]" aria-label="Fermer" data-testid="deposit-modal-close"><X size={18}/></button>
            <div className="text-center mb-4">
              <div className="font-serif text-xl">Commande {confirmedOrder.code} créée</div>
              <div className="text-xs text-[#666]">{confirmedOrder.status === "en_attente_acompte" ? "Elle sera confirmée dès que la boutique aura vérifié votre acompte Wave." : "Elle sera marquée payée dès que la boutique aura vérifié votre paiement Wave."}</div>
            </div>
            <WavePayBox order={confirmedOrder} phone={phone} onChange={() => nav(`/suivi/${confirmedOrder.code}`)}/>
            <button onClick={() => nav(`/suivi/${confirmedOrder.code}`)} className="dina-btn-secondary w-full mt-2 text-xs" data-testid="later-link">J'enverrai la preuve plus tard — voir ma commande</button>
          </div>
        </div>
      )}
    </>
  );
}
