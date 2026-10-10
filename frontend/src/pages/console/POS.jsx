import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";
import { Search, Trash2, Plus, Minus, UserPlus, Printer, X, Store, Truck, Home as HomeIcon, Share2, MessageCircle, PauseCircle, Banknote, Sparkles, Flame, ScanLine, Clock, Zap, Copy, CreditCard } from "lucide-react";
import { PinAuthModal, CashDrawer, HoldsPanel } from "@/components/pos/POSExtensions";
import PosProductSheet from "@/components/pos/PosProductSheet";
import PosNewCustomer from "@/components/pos/PosNewCustomer";
import PosPasteWA from "@/components/pos/PosPasteWA";
import PosPayment from "@/components/pos/PosPayment";
import PosScanner from "@/components/pos/PosScanner";
import POSSessionGuard from "@/components/pos/POSSessionGuard";
import { downloadReceiptPDF } from "@/lib/pdfReceipt";

function POSInner() {
  const { cart, addToCart, updateCartQty, removeFromCart, clearCart } = useApp();
  const [products, setProducts] = useState([]);
  const [shortcuts, setShortcuts] = useState([]);
  const [zones, setZones] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Tous");
  const [showCash, setShowCash] = useState(false);
  const [showHolds, setShowHolds] = useState(false);
  const [pinAuth, setPinAuth] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [custQ, setCustQ] = useState("");
  const [custResults, setCustResults] = useState([]);
  const [showNewCust, setShowNewCust] = useState(false);
  const [showPasteWA, setShowPasteWA] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [sheetProduct, setSheetProduct] = useState(null);
  const [mode, setMode] = useState("store");
  const [zone, setZone] = useState("Cocody");
  const [address, setAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliverySlot, setDeliverySlot] = useState("");
  const [riderInstructions, setRiderInstructions] = useState("");
  const [discount, setDiscount] = useState(0);
  const [receipt, setReceipt] = useState(null);
  const [shareUrl, setShareUrl] = useState(null);
  const [viewMobileCart, setViewMobileCart] = useState(false);
  const [vListe, setVListe] = useState(() => localStorage.getItem("pos_view") !== "grid");
  const [showTop, setShowTop] = useState(false);
  const [sort, setSort] = useState("name");
  const [stockFilter, setStockFilter] = useState("all");
  const colorMap = { "Noir":"#111","Blanc":"#f5f5f5","Rouge":"#b02a2a","Beige":"#d7bfa6","Doré":"#d4af37","Marine":"#1b2b5c","Rose poudré":"#e8b7b3","Camel":"#b08b5a","Nude":"#dcc5b3","Vert émeraude":"#1f6b4a" };

  useEffect(()=>{ localStorage.setItem("pos_view", vListe?"list":"grid"); }, [vListe]);

  // Persist cart draft so the sale resumes when the Gérante leaves and comes back
  useEffect(() => { try { localStorage.setItem("pos_cart_draft", JSON.stringify(cart)); } catch {} }, [cart]);
  useEffect(() => { try { if (customer) localStorage.setItem("pos_customer_draft", JSON.stringify(customer)); else localStorage.removeItem("pos_customer_draft"); } catch {} }, [customer]);
  useEffect(() => { try { localStorage.setItem("pos_mode_draft", mode); } catch {} }, [mode]);

  useEffect(() => {
    api.get("/products").then(r=>setProducts(r.data)).catch(()=>{});
    api.get("/zones").then(r=>setZones(r.data)).catch(()=>{});
    api.get("/pos/shortcuts?limit=8").then(r=>setShortcuts(r.data||[])).catch(()=>{});
  }, []);

  const cats = useMemo(()=>{
    const uniq = Array.from(new Set(products.map(p=>p.category).filter(Boolean))).sort();
    return ["Tous", ...uniq];
  }, [products]);
  const catCount = useMemo(()=>products.reduce((m,p)=>{m[p.category]=(m[p.category]||0)+1;return m;},{}), [products]);
  const isWaitlist = (p) => p.status === "liste_attente";
  const isInactive = (p) => ["inactif","archive","brouillon"].includes(p.status);
  const filtered = useMemo(()=>{
    const nq = q.toLowerCase().trim();
    return products.filter(p => {
      if (isInactive(p)) return false;
      if (cat !== "Tous" && p.category !== cat) return false;
      if (stockFilter === "in_stock") {
        const totalStk = Object.values(p.stock_by_size||{}).reduce((s,v)=>s+Number(v||0),0) || p.stock || 0;
        if (totalStk <= 0) return false;
      }
      if (!nq) return true;
      // Search by name, brand, SKU, barcode; typing a number also matches products with that size
      if (p.name?.toLowerCase().includes(nq)) return true;
      if (p.brand?.toLowerCase().includes(nq)) return true;
      if (p.sku?.toLowerCase().includes(nq)) return true;
      if (p.barcode?.includes(nq)) return true;
      if (/^\d+$/.test(nq) && (p.sizes||[]).includes(nq)) return true;
      return false;
    });
  }, [products, q, cat, stockFilter]);

  const sortedFiltered = useMemo(() => {
    let list = [...filtered];
    if (showTop && shortcuts.length) {
      const topIds = new Set(shortcuts.map(s => s.id));
      list = list.filter(p => topIds.has(p.id));
    }
    if (sort === "price") list.sort((a,b) => a.price - b.price);
    else if (sort === "stock") list.sort((a,b) => (b.stock||0) - (a.stock||0));
    else list.sort((a,b) => (a.name||"").localeCompare(b.name||""));
    return list;
  }, [filtered, sort, showTop, shortcuts]);

  const subtotal = cart.reduce((s,x)=>s+x.qty*x.price,0);
  const zoneFee = zones.find(z=>z.name===zone)?.fee || 0;
  const fee = mode === "delivery" ? zoneFee : 0;
  const total = Math.max(0, subtotal + fee - Number(discount||0));

  const searchCust = async (v) => {
    setCustQ(v);
    if (v.length<2) { setCustResults([]); return; }
    const r = await api.get(`/customers?q=${encodeURIComponent(v)}`);
    setCustResults(r.data.slice(0,6));
  };

  const refreshProducts = () => api.get("/products").then(r=>setProducts(r.data)).catch(()=>{});

  const confirmPayment = async (method, details) => {
    if (!cart.length) return toast.error("Panier vide");
    if (mode==="delivery" && (!customer || !address)) return toast.error("Cliente et adresse requises pour la livraison");
    try {
      const { data } = await api.post("/orders", {
        items: cart.map(x=>({product_id:x.product_id,name:x.name,size:x.size,color:x.color,qty:x.qty,price:x.price,image:x.image})),
        customer, channel: "store", payment_method: method, mode, discount: Number(discount||0),
        delivery_zone: mode==="delivery" ? zone : null, delivery_fee: fee,
        note: [address, riderInstructions && `Instructions: ${riderInstructions}`, deliveryDate && `Créneau: ${deliveryDate} ${deliverySlot}`].filter(Boolean).join(" · "),
      });
      setReceipt({ ...data, _details: details });
      clearCart(); setDiscount(0); setShowPayment(false);
      if (mode==="store") setCustomer(null);
      toast.success(`Vente ${data.code} enregistrée`);
      refreshProducts();
    } catch { toast.error("Erreur lors du paiement"); }
  };

  const shareCart = async () => {
    if (!cart.length) return toast.error("Panier vide");
    try {
      const { data } = await api.post("/pos/shared-cart", {
        items: cart.map(x=>({product_id:x.product_id,name:x.name,size:x.size,color:x.color,qty:x.qty,price:x.price,image:x.image})),
        customer, mode, zone: mode==="delivery"?zone:null, delivery_fee: fee, discount: Number(discount||0),
        address, note: riderInstructions,
      });
      const link = `${window.location.origin}${data.link}`;
      setShareUrl(link);
      if (customer?.phone) {
        const digits = customer.phone.replace(/\D/g,"");
        const txt = `Bonjour ${customer.name}, voici votre panier Chez Dina (${fcfa(total)}) : ${link} — Confirmez pour commander 💕`;
        window.open(`https://wa.me/${digits}?text=${encodeURIComponent(txt)}`, "_blank");
      } else {
        navigator.clipboard?.writeText(link);
        toast.success("Lien copié dans le presse-papier");
      }
    } catch { toast.error("Erreur partage"); }
  };

  const shareProduct = (p) => {
    const link = `${window.location.origin}/boutique/product/${p.id}`;
    if (customer?.phone) {
      const digits = customer.phone.replace(/\D/g,"");
      const txt = `Bonjour ${customer.name}, voilà le produit : ${p.name} à ${fcfa(p.price)}\n${link}`;
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(txt)}`, "_blank");
    } else {
      navigator.clipboard?.writeText(link);
      toast.success("Lien produit copié");
    }
  };

  const applyParsed = ({ items, customer_hint }) => {
    clearCart();
    items.forEach(it => addToCart({id:it.product_id, name:it.name, image:it.image, price:it.price, sizes: it.size?[it.size]:[], colors: it.color?[it.color]:[]}, it.qty, it.size, it.color));
    if (customer_hint?.phone) { searchCust(customer_hint.phone); setCustQ(customer_hint.phone); }
    if (customer_hint?.zone) { setMode("delivery"); setZone(customer_hint.zone); }
    if (customer_hint?.address) setAddress(customer_hint.address);
    toast.success(`${items.length} article(s) importé(s)`);
  };

  // --- UI ---
  return (
    <div className="grid md:grid-cols-[1fr_320px] lg:grid-cols-[1fr_360px] gap-3 md:h-[calc(100vh-7rem)] md:overflow-hidden">
      {/* LEFT: Product area */}
      <div className="dina-card-white p-4 flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]"/><input className="dina-input pl-9" placeholder="Nom, marque, SKU, taille (ex: 39)…" value={q} onChange={e=>setQ(e.target.value)} data-testid="pos-search"/></div>
          <button onClick={()=>setShowScanner(true)} className="dina-chip" title="Scanner QR/code-barres" data-testid="pos-scan"><ScanLine size={13}/>Scanner</button>
          <button onClick={()=>setShowPasteWA(true)} className="dina-chip" title="Coller un message WhatsApp" data-testid="pos-paste-wa"><Sparkles size={13}/>Coller WA</button>
          <button onClick={()=>setShowHolds(true)} className="dina-chip" title="Commandes ouvertes" data-testid="pos-holds-open"><PauseCircle size={13}/>Ouvertes</button>
          <button onClick={()=>setShowCash(true)} className="dina-chip" title="Mouvements de caisse" data-testid="pos-cash-open"><Banknote size={13}/>Caisse</button>
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-2 mb-3">
          {cats.map(c=><button key={c} onClick={()=>setCat(c)} className={`px-3 py-1.5 text-xs rounded-full border whitespace-nowrap flex items-center gap-1.5 ${cat===c?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec] text-[#666] bg-white dark:bg-[#141414] dark:border-[#2a2a2a]"}`} data-testid={`pos-cat-${c}`}>
            <span>{c}</span>
            <span className={`text-[9px] ${cat===c?"text-[#f0b8b8]":"text-[#999]"}`}>{c==="Tous"?products.filter(p=>!isInactive(p)).length:(catCount[c]||0)}</span>
          </button>)}
        </div>

        {/* Shortcuts: top 8 best-sellers */}
        {shortcuts.length>0 && !q && cat==="Tous" && (
          <div className="mb-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase font-semibold text-[#666] mb-1.5"><Zap size={10} className="text-[#f4b12c]"/>Raccourcis · 8 meilleurs ventes 7j</div>
            <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-2">
              {shortcuts.map(p => (
                <button key={p.id} onClick={()=>setSheetProduct(p)} className="shrink-0 w-32 bg-white dark:bg-[#141414] border border-[#ececec] dark:border-[#2a2a2a] rounded-xl overflow-hidden hover:border-[#b02a2a] text-left" data-testid={`shortcut-${p.id}`}>
                  <div className="aspect-square bg-[#fff5f5]"><img src={p.image} alt="" className="w-full h-full object-cover"/></div>
                  <div className="p-1.5"><div className="text-[11px] font-medium line-clamp-1">{p.name}</div><div className="flex justify-between items-center mt-0.5"><span className="tabular text-xs font-bold text-[#b02a2a]">{fcfa(p.price)}</span><span className="text-[9px] text-[#1f8a4c]"><Flame size={8} className="inline"/>{p.sold_count}</span></div></div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Product list — table view by default (Fix pack 3) */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <div className="flex gap-0.5 bg-[#f5f5f5] dark:bg-[#141414] rounded-lg p-0.5 text-xs">
            <button onClick={()=>setVListe(true)} className={`px-2.5 py-1 rounded-md ${vListe?"bg-white dark:bg-[#2a2a2a] font-semibold":""}`} data-testid="pos-view-list">Liste</button>
            <button onClick={()=>setVListe(false)} className={`px-2.5 py-1 rounded-md ${!vListe?"bg-white dark:bg-[#2a2a2a] font-semibold":""}`} data-testid="pos-view-grid">Grille</button>
          </div>
          <button onClick={()=>setShowTop(!showTop)} className={`dina-chip text-[11px] ${showTop?"!bg-[#1c1c1c] !text-white":""}`} data-testid="pos-top8"><Flame size={11}/>Meilleures ventes</button>
          <div className="flex gap-0.5 bg-[#f5f5f5] dark:bg-[#141414] rounded-lg p-0.5 text-[11px]">
            <button onClick={()=>setStockFilter("all")} className={`px-2 py-1 rounded-md ${stockFilter==="all"?"bg-white dark:bg-[#2a2a2a] font-semibold":""}`} data-testid="pos-filter-all">Tous</button>
            <button onClick={()=>setStockFilter("in_stock")} className={`px-2 py-1 rounded-md ${stockFilter==="in_stock"?"bg-white dark:bg-[#2a2a2a] font-semibold":""}`} data-testid="pos-filter-stock">En stock</button>
          </div>
          <div className="sm:ml-auto flex gap-0.5 bg-[#f5f5f5] dark:bg-[#141414] rounded-lg p-0.5 text-[11px]">
            {[["name","A-Z"],["price","Prix"],["stock","Stock"]].map(([k,l])=>(<button key={k} onClick={()=>setSort(k)} className={`px-2 py-1 rounded-md ${sort===k?"bg-white dark:bg-[#2a2a2a] font-semibold":""}`} data-testid={`pos-sort-${k}`}>{l}</button>))}
          </div>
        </div>

        {vListe ? (
          <div className="md:flex-1 md:min-h-0 md:overflow-y-auto overflow-x-auto scrollbar-thin border border-[#ececec] dark:border-[#2a2a2a] rounded-xl bg-white dark:bg-[#141414]" data-testid="pos-products-table">
            {sortedFiltered.length === 0 ? <div className="text-center text-sm text-[#666] py-10">Aucun produit</div> :
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#fafafa] dark:bg-[#141414] text-[10px] uppercase text-[#666] font-semibold border-b border-[#ececec] dark:border-[#2a2a2a]">
                <tr><th className="px-2 py-2 text-left"></th><th className="px-2 py-2 text-left">Produit</th><th className="px-2 py-2 text-left">Tailles disponibles</th><th className="px-2 py-2 text-right">Stock</th><th className="px-2 py-2 text-right">Prix</th><th></th></tr>
              </thead>
              <tbody>
                {sortedFiltered.map(p => {
                  const waitlist = isWaitlist(p);
                  const totalStk = Object.values(p.stock_by_size||{}).reduce((s,v)=>s+Number(v||0),0) || p.stock || 0;
                  const promo = p.price_old && p.price_old > p.price;
                  return (
                    <tr key={p.id} className={`border-b border-[#f0f0f0] dark:border-[#2a2a2a] hover:bg-[#fff5f5] dark:hover:bg-[#2a1818] ${waitlist?"opacity-50":""}`} data-testid={`pos-row-${p.id}`}>
                      <td className="px-2 py-1.5"><div className="w-10 h-10 rounded bg-[#fff5f5] overflow-hidden"><img src={p.image || p.images?.[0]} alt="" className="w-full h-full object-cover" loading="lazy"/></div></td>
                      <td className="px-2 py-1.5"><div className="font-medium leading-tight line-clamp-2">{p.name}</div><div className="text-[10px] text-[#999]">{p.brand} · {p.category} · <code>{p.sku}</code></div></td>
                      <td className="px-2 py-1.5">
                        <div className="flex flex-wrap gap-0.5">{(p.sizes||[]).slice(0,8).map(s => {
                          const stk = Number(p.stock_by_size?.[s] ?? 0);
                          return <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded border ${stk===0?"border-[#ececec] text-[#999]":stk<3?"border-[#e4991e] text-[#e4991e]":"border-[#1f8a4c] text-[#1f8a4c]"}`}>{s}({stk})</span>;
                        })}</div>
                        <div className="flex gap-0.5 mt-0.5">{(p.colors||[]).slice(0,5).map(c => <span key={c} className="w-2.5 h-2.5 rounded-full border border-[#ececec]" style={{background: colorMap[c] || "#ccc"}} title={c}/>)}</div>
                      </td>
                      <td className="px-2 py-1.5 text-right tabular"><span className={totalStk===0?"text-[#c62828] font-semibold":totalStk<5?"text-[#e4991e] font-semibold":""}>{totalStk}</span></td>
                      <td className="px-2 py-1.5 text-right tabular"><div className="font-bold text-[#b02a2a]">{fcfa(p.price)}</div>{promo && <div className="text-[9px] text-[#999] line-through">{fcfa(p.price_old)}</div>}</td>
                      <td className="px-2 py-1.5 text-right">
                        {waitlist ? <span className="text-[10px] text-[#e4991e]">Waitlist</span> :
                        <button onClick={()=>{
                          if ((p.sizes||[]).length===0 && (p.colors||[]).length<=1) addToCart(p, 1, "", p.colors?.[0]||"");
                          else setSheetProduct(p);
                        }} className="dina-btn-primary !min-h-[30px] !px-2.5 text-[11px]" data-testid={`pos-add-${p.id}`}><Plus size={11}/>Ajouter</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>}
          </div>
        ) : (
          <div className="grid grid-cols-2 auto-rows-max content-start gap-2.5 md:flex-1 md:min-h-0 md:overflow-y-auto scrollbar-thin pr-1 pb-2" data-testid="pos-products-grid">
          {sortedFiltered.length === 0 ? <div className="col-span-full text-center text-sm text-[#666] py-10">Aucun produit</div> :
          sortedFiltered.map(p=>{
            const waitlist = isWaitlist(p);
            const totalStk = Object.values(p.stock_by_size||{}).reduce((s,v)=>s+Number(v||0),0) || p.stock || 0;
            const promo = p.price_old && p.price_old > p.price;
            const promoPct = promo ? Math.round((p.price_old - p.price)/p.price_old*100) : 0;
            return (
              <div key={p.id} role="button" tabIndex={0} onClick={()=>!waitlist && setSheetProduct(p)} className={`cursor-pointer text-left bg-white dark:bg-[#141414] border border-[#ececec] dark:border-[#2a2a2a] rounded-xl overflow-hidden hover:border-[#b02a2a] hover:shadow-md transition group ${waitlist?"opacity-60":""}`} data-testid={`pos-product-${p.id}`}>
                <div className="h-28 bg-[#fff5f5] dark:bg-[#2a1818] overflow-hidden relative">
                  <img src={p.image || p.images?.[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" loading="lazy"/>
                  {promo && <span className="absolute top-1.5 left-1.5 bg-[#b02a2a] text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">-{promoPct}%</span>}
                  {waitlist && <span className="absolute inset-0 bg-black/40 grid place-items-center text-white text-[11px] font-bold text-center px-2">Liste<br/>d'attente</span>}
                  {!waitlist && totalStk === 0 && <span className="absolute inset-0 bg-black/40 grid place-items-center text-white text-xs font-bold">RUPTURE</span>}
                  {!waitlist && totalStk > 0 && totalStk < 5 && <span className="absolute top-1.5 right-1.5 bg-[#e4991e] text-white text-[9px] px-1.5 py-0.5 rounded-full font-semibold">Plus que {totalStk}</span>}
                  {!waitlist && totalStk > 0 && <button type="button" aria-label="Ajouter au panier" onClick={e=>{
                    e.stopPropagation();
                    if ((p.sizes||[]).length===0 && (p.colors||[]).length<=1) { addToCart(p, 1, "", p.colors?.[0]||""); toast.success("Ajouté au panier"); }
                    else setSheetProduct(p);
                  }} className="absolute bottom-1.5 right-1.5 w-8 h-8 rounded-full bg-[#b02a2a] text-white grid place-items-center shadow-md hover:bg-[#8f1f1f] hover:scale-110 active:scale-95 transition-transform" data-testid={`pos-grid-add-${p.id}`}><Plus size={16}/></button>}
                </div>
                <div className="p-2">
                  <div className="text-[9px] text-[#999] font-semibold truncate">{p.brand}</div>
                  <div className="text-xs font-medium leading-tight line-clamp-2 min-h-[2.1em]">{p.name}</div>
                  <div className="flex items-center justify-between mt-1">
                    <div><span className="tabular text-xs font-bold text-[#b02a2a]">{fcfa(p.price)}</span>{promo && <span className="text-[9px] text-[#999] line-through tabular ml-1">{fcfa(p.price_old)}</span>}</div>
                    <span className={`text-[9px] tabular ${totalStk<5?"text-[#c62828]":"text-[#1f8a4c]"}`}>{totalStk===0?"Rupture":totalStk<=3?`${totalStk}`:`✓`}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* RIGHT: Cart (desktop) + mobile bottom sheet */}
      <div className={`dina-card-white p-3 flex flex-col min-h-0 ${viewMobileCart?"fixed inset-x-0 bottom-0 top-14 z-40 md:static":"flex"}`} data-testid="pos-cart-panel">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold text-sm">Panier · <span className="text-[#666] text-xs">{cart.length} article{cart.length>1?"s":""}</span></div>
          <div className="flex items-center gap-2">
            <button onClick={()=>setViewMobileCart(false)} className="md:hidden text-[#666]"><X size={16}/></button>
            {cart.length>0 && <button onClick={shareCart} className="text-[10px] text-[#1f8a4c] flex items-center gap-1 hover:underline" data-testid="pos-share-cart"><Share2 size={10}/>Partager</button>}
            {cart.length>0 && <button onClick={async()=>{
              const note = prompt("Note pour cette commande ouverte ? (optionnel)") || "";
              try { await api.post("/pos/holds", { items: cart, customer, note, expires_in_hours: 24 }); toast.success("Panier mis en attente"); clearCart(); }
              catch { toast.error("Erreur"); }
            }} className="text-[10px] text-[#5867fd] flex items-center gap-1" data-testid="pos-hold"><PauseCircle size={10}/>Attente</button>}
            {cart.length>0 && <button onClick={clearCart} className="text-[10px] text-[#c62828]" data-testid="pos-clear">Vider</button>}
          </div>
        </div>

        {/* Totals block — displayed at the TOP, grows live as items are added */}
        <div className="mb-3 p-3 bg-gradient-to-br from-[#fff5f5] to-white dark:from-[#2a1818] dark:to-[#1a1a1a] rounded-xl border border-[#fde8e8] dark:border-[#3a2222]" data-testid="pos-cart-totals-top">
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] uppercase tracking-wider text-[#666] font-semibold">Total à encaisser</span>
            <span className="font-serif tabular text-2xl font-bold text-[#b02a2a]">{fcfa(total)}</span>
          </div>
          <div className="mt-1.5 space-y-0.5 text-[11px] text-[#666]">
            <div className="flex justify-between"><span>Sous-total ({cart.length})</span><span className="tabular">{fcfa(subtotal)}</span></div>
            {mode==="delivery" && <div className="flex justify-between"><span>Livraison · {zone}</span><span className="tabular">{fcfa(fee)}</span></div>}
            <div className="flex justify-between items-center">
              <span>Remise</span>
              <input type="number" className="dina-input w-20 text-right tabular !py-0.5 !h-6 !text-[11px]" value={discount||""} onChange={e=>{
                const v = Number(e.target.value||0);
                const limit = subtotal * 0.20;
                if (v > limit && v > Number(discount||0)) {
                  setPinAuth({ action:"discount_over_limit", actionLabel:`Remise > 20% (limite ${fcfa(limit)})`, amount: v, onApprove: () => { setDiscount(v); setPinAuth(null); } });
                  return;
                }
                setDiscount(e.target.value);
              }} data-testid="pos-discount"/>
            </div>
          </div>
          <button onClick={()=>setShowPayment(true)} disabled={!cart.length} className="dina-btn-primary w-full mt-2 !min-h-[40px] !text-sm" data-testid="pos-checkout"><CreditCard size={14}/>{mode==="delivery"?"Commander":"Encaisser"}</button>
        </div>

        {/* Scrollable area with mode / customer / items */}
        <div className="flex-1 overflow-y-auto scrollbar-thin -mx-1 px-1 min-h-0">

        {/* Mode selector */}
        <div className="grid grid-cols-3 gap-1 mb-3 bg-[#f5f5f5] dark:bg-[#141414] rounded-lg p-1">
          <button onClick={()=>setMode("store")} className={`py-1.5 text-xs rounded-md flex items-center justify-center gap-1 ${mode==="store"?"bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold":""}`} data-testid="pos-mode-store"><Store size={12}/>À emporter</button>
          <button onClick={()=>setMode("delivery")} className={`py-1.5 text-xs rounded-md flex items-center justify-center gap-1 ${mode==="delivery"?"bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold":""}`} data-testid="pos-mode-delivery"><Truck size={12}/>Livraison</button>
          <button onClick={()=>setMode("pickup")} className={`py-1.5 text-xs rounded-md flex items-center justify-center gap-1 ${mode==="pickup"?"bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold":""}`} data-testid="pos-mode-pickup"><HomeIcon size={12}/>Retrait</button>
        </div>

        {/* Customer */}
        <div className="mb-3">
          {customer ? (
            <div className="p-2.5 bg-[#fff5f5] dark:bg-[#2a1818] border border-[#fde8e8] dark:border-[#3a2222] rounded-lg text-sm">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1"><div className="font-medium truncate">{customer.name}</div><div className="text-xs text-[#666] truncate">{customer.phone}</div></div>
                <button onClick={()=>setCustomer(null)}><X size={14}/></button>
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[#666]">
                <span className="px-1.5 py-0.5 rounded-full bg-white dark:bg-[#141414]">{customer.tier||"Bronze"}</span>
                <span>· {customer.loyalty_points||0} pts</span>
                <span>· 💰 {fcfa(customer.wallet||0)}</span>
                {customer.shoe_size && <span>· P{customer.shoe_size}</span>}
                {customer.clothing_size && <span>· T{customer.clothing_size}</span>}
              </div>
              {customer.status === "blacklisted" && <div className="mt-1 text-[11px] text-[#c62828] font-semibold">⚠ Cliente blacklistée</div>}
            </div>
          ) : (
            <div className="relative">
              <input className="dina-input" placeholder="Rattacher une cliente (nom ou tél)…" value={custQ} onChange={e=>searchCust(e.target.value)} data-testid="pos-customer-search"/>
              {custResults.length>0 && <div className="absolute z-10 bg-white dark:bg-[#1a1a1a] border border-[#ececec] dark:border-[#2a2a2a] rounded-lg mt-1 w-full max-h-56 overflow-y-auto shadow">{custResults.map(c=><button key={c.id} onClick={()=>{setCustomer(c);setCustQ("");setCustResults([]);}} className="w-full text-left px-3 py-2 text-sm hover:bg-[#fff5f5] dark:hover:bg-[#2a1818]"><div className="font-medium">{c.name}</div><div className="text-xs text-[#666]">{c.phone} · {c.loyalty_points||0} pts</div></button>)}</div>}
              <button onClick={()=>setShowNewCust(true)} className="mt-1 text-xs text-[#b02a2a] flex items-center gap-1" data-testid="pos-new-customer"><UserPlus size={12}/>+ Nouvelle cliente</button>
            </div>
          )}
        </div>

        {/* Delivery details */}
        {mode==="delivery" && (
          <div className="space-y-2 mb-3 p-3 bg-[#fff5f5] dark:bg-[#2a1818] rounded-lg">
            <select className="dina-input" value={zone} onChange={e=>setZone(e.target.value)} data-testid="pos-zone">
              <option value="">Zone de livraison…</option>
              {zones.map(z=><option key={z.name} value={z.name}>{z.name} — {fcfa(z.fee)}</option>)}
            </select>
            <input className="dina-input" placeholder="Adresse (commune, quartier, repère)" value={address} onChange={e=>setAddress(e.target.value)} data-testid="pos-address"/>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className="dina-input" value={deliveryDate} onChange={e=>setDeliveryDate(e.target.value)} data-testid="pos-date"/>
              <select className="dina-input" value={deliverySlot} onChange={e=>setDeliverySlot(e.target.value)} data-testid="pos-slot">
                <option value="">Créneau…</option>
                <option>Matin (9h-12h)</option><option>Après-midi (12h-16h)</option><option>Soir (16h-20h)</option>
              </select>
            </div>
            <input className="dina-input" placeholder="Instructions pour le livreur (optionnel)" value={riderInstructions} onChange={e=>setRiderInstructions(e.target.value)} data-testid="pos-rider-instr"/>
          </div>
        )}

        {/* Items */}
        <div className="-mx-2 px-2 min-h-[80px]">
          {cart.length===0 ? <div className="text-center text-sm text-[#666] py-10">Aucun article · Tapez un produit pour l'ajouter</div> :
            cart.map(it=>{
              const prod = products.find(p => p.id === it.product_id);
              const stockLeft = prod ? ((it.size ? Number(prod.stock_by_size?.[it.size] ?? prod.stock ?? 0) : Number(prod.stock ?? 0)) - it.qty) : null;
              const over = stockLeft !== null && stockLeft < 0;
              return (
                <div key={it.key} className={`flex items-center gap-2 py-2 border-b border-[#f0f0f0] dark:border-[#2a2a2a] ${over?"bg-[#fff5f5] dark:bg-[#2a1818]":""}`}>
                  <div className="w-11 h-11 rounded bg-[#fff5f5] dark:bg-[#2a1818] overflow-hidden shrink-0"><img src={it.image} alt="" className="w-full h-full object-cover"/></div>
                  <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{it.name}</div><div className="text-xs text-[#666] truncate">{[it.size,it.color].filter(Boolean).join(" · ")} · {fcfa(it.price)}</div><div className={`text-[10px] ${over?"text-[#c62828] font-bold":stockLeft<=2?"text-[#e4991e]":"text-[#1f8a4c]"}`}>{over ? `⚠ Dépasse le stock (${stockLeft})` : stockLeft !== null ? `Reste ${stockLeft} en stock` : ""}</div></div>
                  <div className="flex items-center gap-1"><button onClick={()=>updateCartQty(it.key,it.qty-1)} className="w-6 h-6 border rounded"><Minus size={10} className="mx-auto"/></button><span className="w-6 text-center tabular text-sm">{it.qty}</span><button onClick={()=>updateCartQty(it.key,it.qty+1)} className="w-6 h-6 border rounded"><Plus size={10} className="mx-auto"/></button></div>
                  <button onClick={()=>removeFromCart(it.key)} className="text-[#c62828]"><Trash2 size={14}/></button>
                </div>
              );
            })}
        </div>

        {/* Totals block moved to TOP — removed from here (bottom checkout button deleted) */}
        </div> {/* /scrollable area */}
      </div>

      {/* Mobile floating cart button */}
      {!viewMobileCart && cart.length > 0 && (
        <button onClick={()=>setViewMobileCart(true)} className="md:hidden fixed bottom-4 right-4 z-30 bg-[#b02a2a] text-white rounded-full shadow-2xl pl-5 pr-6 py-3 flex items-center gap-2" data-testid="pos-mobile-cart-fab">
          <div className="relative"><div className="w-6 h-6 grid place-items-center font-bold">{cart.length}</div></div>
          <div className="text-sm font-semibold tabular">{fcfa(total)}</div>
        </button>
      )}

      {/* Modals */}
      {sheetProduct && <PosProductSheet product={sheetProduct} customer={customer} onAdd={addToCart} onClose={()=>setSheetProduct(null)}/>}
      {showScanner && <PosScanner onScan={(code)=>{
        const match = products.find(p => p.sku === code || p.barcode === code || p.id === code);
        if (match) {
          addToCart(match, 1, match.sizes?.[0], match.colors?.[0]);
          toast.success(`✓ ${match.name} ajouté`);
        } else {
          toast.error(`Code "${code}" inconnu`);
        }
      }} onClose={()=>setShowScanner(false)}/>}
      {showNewCust && <PosNewCustomer onClose={()=>setShowNewCust(false)} onCreated={(c)=>{setCustomer(c);setShowNewCust(false);}}/>}
      {showPasteWA && <PosPasteWA onApply={applyParsed} onClose={()=>setShowPasteWA(false)}/>}
      {showPayment && <PosPayment total={total} mode={mode} customer={customer} onPay={confirmPayment} onClose={()=>setShowPayment(false)}/>}
      {receipt && <Receipt data={receipt} onClose={()=>setReceipt(null)}/>}
      {showCash && <CashDrawer onClose={()=>setShowCash(false)}/>}
      {showHolds && <HoldsPanel onClose={()=>setShowHolds(false)} onResume={(h)=>{
        clearCart();
        (h.items||[]).forEach(it => addToCart({id:it.product_id,name:it.name,image:it.image,price:it.price,sizes:[it.size],colors:[it.color]}, it.qty, it.size, it.color));
        if (h.customer) setCustomer(h.customer);
        setShowHolds(false);
      }}/>}
      {pinAuth && <PinAuthModal {...pinAuth} onCancel={()=>setPinAuth(null)}/>}
      {shareUrl && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={()=>setShareUrl(null)}>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-5 w-full max-w-md" onClick={e=>e.stopPropagation()}>
            <div className="font-serif text-lg mb-3">Lien du panier partagé</div>
            <input readOnly className="dina-input text-xs" value={shareUrl}/>
            <div className="flex gap-2 mt-3">
              <button onClick={()=>{navigator.clipboard?.writeText(shareUrl); toast.success("Copié");}} className="dina-btn-secondary flex-1"><Copy size={14}/>Copier</button>
              <button onClick={()=>setShareUrl(null)} className="dina-btn-primary flex-1">OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Receipt({ data, onClose }) {
  const [bizRef, setBizRef] = useState({ tiktok:"@dinoush04", phone:"+225 07 77 92 61 79", address:"Cocody Angré 7e, Abidjan" });
  useEffect(() => { api.get("/public/site").then(r => { const s = r.data || {}; setBizRef(b => ({ ...b, name: s.name || "Chez Dina", logo: s.logo || null, phone: s.phone || b.phone, address: s.address || b.address, tiktok: s.tiktok || b.tiktok })); }).catch(() => {}); }, []);
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-6 w-80 font-sora" onClick={e=>e.stopPropagation()}>
        <div className="text-center mb-3">
          {bizRef.logo ? <img src={bizRef.logo} alt="" className="w-12 h-12 mx-auto rounded-full object-cover bg-[#fde8e8]"/> : <div className="w-12 h-12 mx-auto rounded-full bg-[#fde8e8] grid place-items-center font-serif text-[#b02a2a] font-bold">{(bizRef.name || "CD").split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase() || "CD"}</div>}
          <div className="font-serif text-lg mt-2">{bizRef.name || "Chez Dina"}</div>
          <div className="text-[10px] text-[#666]">{bizRef.address} · {bizRef.phone}</div>
          <div className="text-[10px] text-[#666]">TikTok {bizRef.tiktok}</div>
        </div>
        <div className="border-t-2 border-dashed border-[#ececec] my-2"/>
        <div className="text-xs text-center text-[#666]">Reçu N° {data.code}</div>
        <div className="text-xs text-center text-[#666]">{new Date(data.created_at).toLocaleString("fr-FR")}</div>
        <div className="border-t border-dashed my-2"/>
        {data.items.map((it,i)=><div key={i} className="text-xs flex justify-between py-0.5"><span className="flex-1 pr-2">{it.qty}× {it.name}{it.size?` (${it.size})`:""}</span><span className="tabular font-medium">{fcfa(it.qty*it.price)}</span></div>)}
        <div className="border-t border-dashed my-2"/>
        <div className="text-xs flex justify-between"><span className="text-[#666]">Sous-total</span><span className="tabular">{fcfa(data.subtotal)}</span></div>
        {data.delivery_fee>0 && <div className="text-xs flex justify-between"><span className="text-[#666]">Livraison</span><span className="tabular">{fcfa(data.delivery_fee)}</span></div>}
        {data.discount>0 && <div className="text-xs flex justify-between"><span className="text-[#666]">Remise</span><span className="tabular text-[#1f8a4c]">-{fcfa(data.discount)}</span></div>}
        <div className="flex justify-between font-bold text-sm mt-1 pt-1 border-t"><span>TOTAL</span><span className="tabular text-[#b02a2a]">{fcfa(data.total)}</span></div>
        <div className="text-[10px] text-center text-[#666] mt-3">Paiement : {data.payment_method?.toUpperCase()}</div>
        {data.customer && <div className="text-[10px] text-center text-[#666] mt-1">Cliente : {data.customer.name}</div>}
        <div className="text-center mt-4 text-xs text-[#b02a2a] font-serif italic">Merci de votre visite 💕</div>
        <div className="flex gap-2 mt-4">
          <button onClick={()=>downloadReceiptPDF(data, bizRef)} className="dina-btn-secondary flex-1 !min-h-[36px]" data-testid="receipt-pdf"><Printer size={14}/>PDF</button>
          <button onClick={()=>{
            const phone = (data.customer?.phone||"").replace(/\D/g,"");
            if(!phone) return toast.error("Numéro cliente manquant");
            const txt = `Bonjour ${data.customer.name}, voici votre reçu Chez Dina (N° ${data.code}) — Total : ${fcfa(data.total)}. Merci de votre visite 💕`;
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(txt)}`,"_blank");
          }} className="dina-btn-secondary flex-1 !min-h-[36px]"><MessageCircle size={14}/>WA</button>
          <button onClick={onClose} className="dina-btn-primary flex-1 !min-h-[36px]">OK</button>
        </div>
      </div>
    </div>
  );
}

export default function POS() {
  return <POSSessionGuard><POSInner/></POSSessionGuard>;
}
