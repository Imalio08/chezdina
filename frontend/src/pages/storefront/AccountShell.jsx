import React, { useEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, Link, NavLink, useNavigate, useParams, Outlet, useLocation } from "react-router-dom";
import api from "@/lib/api";
import { fcfa, dateFmt, statusLabel, statusColor } from "@/lib/format";
import { toast } from "sonner";
import { useCustomer } from "@/context/CustomerContext";
import {
  User, Package, MessageSquare, Star, Ticket, Heart, Eye, Gift, UserPlus, Wallet,
  MapPin, Settings, Shield, LogOut, Camera, Phone, MessageCircle, Download,
  ChevronRight, Pencil, Plus, Check, X, AlertCircle, ArrowLeft, Clock
} from "lucide-react";

const MENU = [
  { to: "", label: "Mon compte", icon: User, end: true },
  { to: "commandes", label: "Mes commandes", icon: Package },
  { to: "messages", label: "Messages", icon: MessageSquare },
  { to: "avis", label: "Avis à donner", icon: Star },
  { to: "bons-achat", label: "Bons d'achat", icon: Ticket },
  { to: "favoris", label: "Favoris", icon: Heart },
  { to: "vus-recemment", label: "Vus récemment", icon: Eye },
  { to: "fidelite", label: "Fidélité", icon: Gift },
  { to: "parrainage", label: "Parrainage", icon: UserPlus },
  { to: "porte-monnaie", label: "Porte-monnaie", icon: Wallet },
  { to: "adresses", label: "Adresses", icon: MapPin },
  { to: "preferences", label: "Préférences", icon: Settings },
  { to: "securite", label: "Sécurité", icon: Shield },
];

export default function AccountShell() {
  const { customer, loading, logout } = useCustomer();
  const location = useLocation();
  if (loading) return <div className="max-w-md mx-auto px-4 py-10 text-center text-sm text-[#666]">Chargement…</div>;
  if (!customer) return <LoginGate />;
  const firstName = (customer.name || "").split(" ")[0];
  const isRoot = location.pathname === "/boutique/compte" || location.pathname === "/boutique/compte/";
  return (
    <div className="max-w-6xl mx-auto px-4 py-6" data-testid="account-shell">
      <div className="font-serif text-2xl mb-5">Bonjour, {firstName} 👋</div>

      {/* Mobile: show menu as list on root, hide on sub-route */}
      <div className="lg:hidden">
        {isRoot ? (
          <MobileMenu onLogout={logout} />
        ) : (
          <Routes>
            <Route index element={<Overview />} />
            <Route path="commandes" element={<OrdersPage />} />
            <Route path="commandes/:code" element={<OrderDetail />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="messages/:id" element={<MessagesPage />} />
            <Route path="avis" element={<ReviewsPending />} />
            <Route path="bons-achat" element={<Vouchers />} />
            <Route path="favoris" element={<Favorites />} />
            <Route path="vus-recemment" element={<RecentlyViewed />} />
            <Route path="fidelite" element={<Loyalty />} />
            <Route path="parrainage" element={<Referral />} />
            <Route path="porte-monnaie" element={<WalletPage />} />
            <Route path="adresses" element={<Addresses />} />
            <Route path="preferences" element={<Preferences />} />
            <Route path="securite" element={<Security />} />
          </Routes>
        )}
      </div>

      {/* Desktop: side menu + content */}
      <div className="hidden lg:grid grid-cols-[260px_1fr] gap-6">
        <aside className="dina-card-white p-3 h-fit sticky top-24" data-testid="account-side-menu">
          <nav className="space-y-0.5">
            {MENU.map(m => (
              <NavLink
                key={m.to}
                to={m.to}
                end={m.end}
                className={({isActive}) => `flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${isActive ? "bg-[#fff5f5] text-[#b02a2a] font-semibold" : "text-[#1c1c1c] hover:bg-[#fafafa]"}`}
                data-testid={`menu-${m.to || "overview"}`}
              >
                <m.icon size={14} /> {m.label}
              </NavLink>
            ))}
            <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#c62828] hover:bg-[#fff5f5]" data-testid="menu-logout">
              <LogOut size={14} /> Déconnexion
            </button>
          </nav>
        </aside>
        <main className="min-w-0">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="commandes" element={<OrdersPage />} />
            <Route path="commandes/:code" element={<OrderDetail />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="messages/:id" element={<MessagesPage />} />
            <Route path="avis" element={<ReviewsPending />} />
            <Route path="bons-achat" element={<Vouchers />} />
            <Route path="favoris" element={<Favorites />} />
            <Route path="vus-recemment" element={<RecentlyViewed />} />
            <Route path="fidelite" element={<Loyalty />} />
            <Route path="parrainage" element={<Referral />} />
            <Route path="porte-monnaie" element={<WalletPage />} />
            <Route path="adresses" element={<Addresses />} />
            <Route path="preferences" element={<Preferences />} />
            <Route path="securite" element={<Security />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

/* -------- MobileMenu -------- */
function MobileMenu({ onLogout }) {
  return (
    <div className="dina-card-white divide-y divide-[#f0f0f0]">
      {MENU.map(m => (
        <Link key={m.to} to={m.to} className="flex items-center gap-3 px-4 py-3 hover:bg-[#fafafa]">
          <m.icon size={16} className="text-[#666]" />
          <span className="flex-1">{m.label}</span>
          <ChevronRight size={14} className="text-[#999]" />
        </Link>
      ))}
      <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 text-[#c62828]"><LogOut size={16} /> Déconnexion</button>
    </div>
  );
}

/* -------- Login gate -------- */
function LoginGate() {
  const nav = useNavigate();
  const { loginDone } = useCustomer();
  const [phone, setPhone] = useState("+225 ");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (code.length !== 6) return toast.error("Code à 6 chiffres");
    setLoading(true);
    try {
      const r = await api.post("/public/customer-login-code", { phone, code });
      loginDone({ token: r.data.token, customer: r.data.customer });
      toast.success(`Bonjour ${r.data.customer.name.split(" ")[0]} 👋`);
      nav("/boutique/compte");
    } catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
    finally { setLoading(false); }
  };
  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <div className="w-16 h-16 rounded-full bg-[#fde8e8] text-[#b02a2a] font-serif text-3xl font-bold grid place-items-center mx-auto mb-3">D</div>
      <h1 className="font-serif text-3xl mb-2 text-center">Mon compte</h1>
      <p className="text-sm text-[#666] text-center mb-5">Entrez votre numéro et votre code secret à 6 chiffres.</p>
      <div className="dina-card-white p-5 space-y-3">
        <input className="dina-input" placeholder="+225 07 XX XX XX XX" value={phone} onChange={e=>setPhone(e.target.value)} data-testid="account-phone"/>
        <input type="password" inputMode="numeric" maxLength={6} className="dina-input tracking-[0.5em] text-center text-xl" placeholder="••••••" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))} data-testid="account-code"/>
        <button onClick={submit} disabled={loading} className="dina-btn-primary w-full" data-testid="account-login">{loading ? "Connexion…" : "Se connecter"}</button>
      </div>
    </div>
  );
}

/* -------- Overview (4 cards) -------- */
function Overview() {
  const { customer, setCustomer } = useCustomer();
  const [showEdit, setShowEdit] = useState(null); // "info" | "address" | "prefs"
  const fileRef = useRef(null);
  const defaultAddr = (customer.addresses || []).find(a => a.default) || (customer.addresses || [])[0];

  const onPhoto = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) return toast.error("Max 2 Mo");
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await api.post("/public/account/photo", { photo: reader.result });
        setCustomer({ ...customer, photo: reader.result });
        toast.success("Photo mise à jour");
      } catch { toast.error("Erreur upload"); }
    };
    reader.readAsDataURL(f);
  };

  return (
    <div className="space-y-4" data-testid="overview">
      {/* Infos personnelles card */}
      <Card title="Informations personnelles" icon={User} onEdit={() => setShowEdit("info")} testId="card-info">
        <div className="flex gap-4 items-start">
          <div className="relative">
            {customer.photo ? (
              <img src={customer.photo} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-[#fde8e8]" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[#fde8e8] text-[#b02a2a] font-serif text-2xl grid place-items-center font-bold">{customer.name?.[0] || "D"}</div>
            )}
            <button onClick={() => fileRef.current?.click()} className="absolute bottom-0 right-0 bg-[#b02a2a] text-white rounded-full p-1.5" data-testid="photo-upload-btn"><Camera size={11}/></button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} data-testid="photo-file-input"/>
          </div>
          <div className="flex-1 text-sm">
            <div className="font-semibold text-base">{customer.name}</div>
            <div className="text-[#666]">{customer.phone}</div>
            {customer.email && <div className="text-[#666]">{customer.email}</div>}
            <div className="mt-2 flex gap-2 text-xs">
              {customer.shoe_size && <span className="dina-chip">Taille {customer.shoe_size}</span>}
              {customer.clothing_size && <span className="dina-chip">{customer.clothing_size}</span>}
            </div>
          </div>
        </div>
      </Card>

      {/* Default address */}
      <Card title="Adresse par défaut" icon={MapPin} onEdit={() => setShowEdit("address")} testId="card-address">
        {defaultAddr ? (
          <div className="text-sm">
            <div className="font-medium">{defaultAddr.label || "Adresse principale"}</div>
            <div className="text-[#666] mt-1">{defaultAddr.address}</div>
            <div className="text-[#666]">{defaultAddr.zone}</div>
          </div>
        ) : (
          <EmptyLine text="Aucune adresse enregistrée" cta={<Link to="../adresses" className="text-[#b02a2a] text-sm underline">Ajouter</Link>}/>
        )}
      </Card>

      {/* Wallet + points */}
      <Card title="Porte-monnaie et points" icon={Wallet} onEdit={() => {}} testId="card-wallet">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-[#fff5f5] rounded-lg">
            <div className="text-[10px] uppercase text-[#666]">Solde</div>
            <div className="font-serif text-2xl text-[#b02a2a] tabular">{fcfa(customer.wallet || 0)}</div>
          </div>
          <div className="p-3 bg-[#fff5f5] rounded-lg">
            <div className="text-[10px] uppercase text-[#666]">Points fidélité ({customer.tier || "Bronze"})</div>
            <div className="font-serif text-2xl tabular">{customer.loyalty_points || 0}</div>
          </div>
        </div>
      </Card>

      {/* Communication prefs */}
      <Card title="Préférences de communication" icon={Settings} onEdit={() => setShowEdit("prefs")} testId="card-prefs">
        <div className="text-sm space-y-1">
          <PrefRow label="WhatsApp" on={customer.communication_prefs?.whatsapp !== false}/>
          <PrefRow label="SMS" on={customer.communication_prefs?.sms !== false}/>
          <PrefRow label="Email" on={!!customer.communication_prefs?.email}/>
          <PrefRow label="Newsletter promotions" on={!!customer.communication_prefs?.newsletter}/>
        </div>
      </Card>

      {showEdit && <EditModal mode={showEdit} customer={customer} onClose={() => setShowEdit(null)} onSaved={(c) => { setCustomer(c); setShowEdit(null); }}/>}
    </div>
  );
}

function PrefRow({ label, on }) {
  return <div className="flex justify-between"><span>{label}</span><span className={on ? "text-[#1f8a4c]" : "text-[#999]"}>{on ? "Activé" : "Désactivé"}</span></div>;
}

function Card({ title, icon: Icon, onEdit, children, testId }) {
  return (
    <div className="dina-card-white p-5" data-testid={testId}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 font-serif text-lg"><Icon size={16} className="text-[#b02a2a]"/>{title}</div>
        {onEdit && <button onClick={onEdit} className="text-[#666] hover:text-[#b02a2a]" data-testid={`${testId}-edit`}><Pencil size={14}/></button>}
      </div>
      {children}
    </div>
  );
}

function EditModal({ mode, customer, onClose, onSaved }) {
  const [f, setF] = useState({
    name: customer.name, email: customer.email || "",
    shoe_size: customer.shoe_size || "", clothing_size: customer.clothing_size || "",
    communication_prefs: customer.communication_prefs || { whatsapp: true, sms: true, email: false, newsletter: false },
  });
  const save = async () => {
    try {
      const patch = mode === "prefs" ? { communication_prefs: f.communication_prefs } : { name: f.name, email: f.email, shoe_size: f.shoe_size, clothing_size: f.clothing_size };
      const r = await api.patch("/public/account/update", patch);
      onSaved(r.data); toast.success("Enregistré");
    } catch { toast.error("Erreur"); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-5 w-full max-w-md" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between mb-4"><div className="font-serif text-xl">Modifier</div><button onClick={onClose}><X size={16}/></button></div>
        {(mode === "info" || mode === "address") && (
          <div className="space-y-2">
            <input className="dina-input" placeholder="Nom" value={f.name} onChange={e=>setF({...f,name:e.target.value})} data-testid="edit-name"/>
            <input className="dina-input" placeholder="Email" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/>
            <div className="grid grid-cols-2 gap-2">
              <input className="dina-input" placeholder="Pointure" value={f.shoe_size} onChange={e=>setF({...f,shoe_size:e.target.value})}/>
              <input className="dina-input" placeholder="Taille vêtement" value={f.clothing_size} onChange={e=>setF({...f,clothing_size:e.target.value})}/>
            </div>
          </div>
        )}
        {mode === "prefs" && (
          <div className="space-y-2 text-sm">
            {["whatsapp","sms","email","newsletter"].map(k => (
              <label key={k} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!f.communication_prefs[k]} onChange={e=>setF({...f, communication_prefs: {...f.communication_prefs, [k]: e.target.checked}})} data-testid={`pref-${k}`}/>
                <span className="capitalize">{k === "whatsapp" ? "WhatsApp" : k}</span>
              </label>
            ))}
          </div>
        )}
        <div className="flex gap-2 mt-5"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={save} className="dina-btn-primary flex-1" data-testid="edit-save">Enregistrer</button></div>
      </div>
    </div>
  );
}

/* -------- Orders tabs -------- */
function OrdersPage() {
  const [tab, setTab] = useState("current");
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/public/account/orders-split").then(r=>setData(r.data)).catch(()=>toast.error("Erreur")); }, []);
  if (!data) return <div className="text-sm text-[#666]">Chargement…</div>;
  const current = [...data.in_progress, ...data.delivered];
  const list = tab === "current" ? current : data.cancelled;
  return (
    <div className="space-y-4" data-testid="orders-page">
      <div className="flex gap-1 border-b border-[#ececec]">
        <TabBtn active={tab==="current"} onClick={()=>setTab("current")} testId="tab-current">En cours / Livrées ({current.length})</TabBtn>
        <TabBtn active={tab==="cancelled"} onClick={()=>setTab("cancelled")} testId="tab-cancelled">Annulées / Retournées ({data.cancelled.length})</TabBtn>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={Package} title="Aucune commande" subtitle={tab==="current" ? "Commencez vos achats dès maintenant" : "Vous n'avez pas d'annulation"} />
      ) : (
        <div className="space-y-3">{list.map(o => <OrderCard key={o.id} order={o}/>)}</div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children, testId }) {
  return <button onClick={onClick} className={`px-4 py-2 text-sm border-b-2 ${active ? "border-[#b02a2a] text-[#b02a2a] font-semibold" : "border-transparent text-[#666]"}`} data-testid={testId}>{children}</button>;
}

function OrderCard({ order }) {
  const img = order.items?.[0]?.image;
  const names = (order.items || []).map(i => i.name).join(", ").slice(0, 60);
  return (
    <Link to={`${order.code}`} className="dina-card-white p-4 flex gap-3 items-center hover:border-[#b02a2a]" data-testid={`order-card-${order.code}`}>
      {img && <img src={img} alt="" className="w-14 h-14 rounded object-cover"/>}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{names || order.code}</div>
        <div className="text-xs text-[#666]">N° {order.code} · {dateFmt(order.created_at)}</div>
      </div>
      <div className="text-right">
        <span className="dina-chip text-xs" style={{color: statusColor[order.status]}}>{statusLabel[order.status]}</span>
        <div className="font-serif tabular font-semibold mt-1 text-sm">{fcfa(order.total)}</div>
      </div>
      <ChevronRight size={14} className="text-[#999]"/>
    </Link>
  );
}

/* -------- Order detail + live map -------- */
function OrderDetail() {
  const { code } = useParams();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  useEffect(() => { api.get(`/public/account/order/${code}`).then(r=>setD(r.data)).catch(()=>{toast.error("Introuvable"); nav("..");}); }, [code]);
  if (!d) return <div className="text-sm text-[#666]">Chargement…</div>;
  const { order: o, rider } = d;
  const isDelivering = o.status === "en_livraison";
  const paid = o.payment_status === "paye";
  return (
    <div className="space-y-4" data-testid={`order-detail-${code}`}>
      <button onClick={()=>nav("..")} className="text-sm text-[#666] flex items-center gap-1"><ArrowLeft size={14}/> Retour</button>

      <div className="dina-card-white p-5">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="font-serif text-xl">Commande {o.code}</div>
            <div className="text-xs text-[#666]">{dateFmt(o.created_at)}</div>
          </div>
          <span className="dina-chip" style={{color: statusColor[o.status]}}>{statusLabel[o.status]}</span>
        </div>
        <Timeline tl={o.timeline || []}/>
      </div>

      {isDelivering && <LiveDelivery order={o} rider={rider}/>}

      <div className="dina-card-white p-5">
        <div className="font-serif text-lg mb-3">Articles</div>
        <div className="space-y-2">
          {(o.items || []).map((it, i) => (
            <div key={i} className="flex gap-3 items-center" data-testid={`item-${i}`}>
              {it.image && <img src={it.image} alt="" className="w-14 h-14 rounded object-cover"/>}
              <div className="flex-1">
                <div className="text-sm font-medium">{it.name}</div>
                <div className="text-xs text-[#666]">×{it.qty} {it.size && `· T. ${it.size}`} {it.color && `· ${it.color}`}</div>
              </div>
              <div className="text-right">
                {it.compare_at > it.price && <div className="text-xs text-[#999] line-through tabular">{fcfa(it.compare_at)}</div>}
                <div className="font-semibold tabular text-sm">{fcfa(it.price * it.qty)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="dina-card-white p-5">
          <div className="font-serif text-lg mb-3">Paiement</div>
          <KV label="Mode" value={o.payment_method === "cod" ? "Paiement à la livraison" : (o.payment_method || "—")}/>
          <KV label="Sous-total" value={fcfa(o.subtotal || 0)}/>
          <KV label="Livraison" value={fcfa(o.delivery_fee || 0)}/>
          {o.discount ? <KV label="Remise" value={`-${fcfa(o.discount)}`}/> : null}
          <div className="border-t border-[#ececec] mt-2 pt-2 flex justify-between font-semibold">
            <span>Total</span><span className="tabular text-[#b02a2a]">{fcfa(o.total)}</span>
          </div>
          <div className="mt-2 text-xs">{paid ? <span className="text-[#1f8a4c]">✓ Payé</span> : <span className="text-[#e4991e]">En attente de paiement</span>}</div>
        </div>
        <div className="dina-card-white p-5">
          <div className="font-serif text-lg mb-3">Livraison</div>
          <KV label="Adresse" value={(o.delivery_address || o.customer?.address) || "—"}/>
          <KV label="Zone" value={o.delivery_zone || "—"}/>
          <KV label="Méthode" value={o.mode === "pickup" ? "Retrait boutique" : "Livraison à domicile"}/>
          {o.delivery_code && <KV label="Code livraison" value={<span className="font-mono text-base tracking-wider text-[#b02a2a]">{o.delivery_code}</span>}/>}
        </div>
      </div>

      <div className="flex gap-2">
        <a href={`${process.env.REACT_APP_BACKEND_URL}/api/orders/${o.id}/invoice`} target="_blank" rel="noreferrer" className="dina-btn-secondary flex-1" data-testid="download-invoice"><Download size={14}/> Télécharger la facture</a>
      </div>
    </div>
  );
}

function KV({ label, value }) {
  return <div className="flex justify-between py-1 text-sm"><span className="text-[#666]">{label}</span><span className="font-medium">{value}</span></div>;
}

function Timeline({ tl }) {
  if (!tl.length) return <div className="text-xs text-[#999]">Aucun événement</div>;
  return (
    <div className="relative pl-5 space-y-2" data-testid="timeline">
      {tl.map((t, i) => (
        <div key={i} className="relative text-sm">
          <div className="absolute left-[-20px] top-1.5 w-2 h-2 rounded-full bg-[#b02a2a]"></div>
          <div className="font-medium">{statusLabel[t.status] || t.status}</div>
          <div className="text-xs text-[#666]">{dateFmt(t.at)} {t.by && `· ${t.by}`}{t.reason && ` · ${t.reason}`}</div>
        </div>
      ))}
    </div>
  );
}

function LiveDelivery({ order, rider }) {
  const [pos, setPos] = useState(null);
  const [eta, setEta] = useState(null);
  const nav = useNavigate();
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const leafletRef = useRef(null);

  const fetchPos = async () => {
    try {
      const r = await api.get(`/public/order/${order.code}/rider-position`);
      if (r.data.position) { setPos(r.data.position); setEta(r.data.eta_minutes); }
    } catch {}
  };

  useEffect(() => {
    fetchPos();
    const t = setInterval(fetchPos, 30000);
    return () => clearInterval(t);
  }, [order.code]);

  useEffect(() => {
    if (!pos || !mapRef.current || leafletRef.current) return;
    const run = async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      const map = L.map(mapRef.current, { zoomControl: false }).setView([pos.lat, pos.lng], 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OSM", maxZoom: 19 }).addTo(map);
      const icon = L.divIcon({ className: "", html: `<div style="background:#b02a2a;color:#fff;border-radius:9999px;width:34px;height:34px;display:grid;place-items:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,.3)">🏍️</div>` });
      markerRef.current = L.marker([pos.lat, pos.lng], { icon }).addTo(map);
      leafletRef.current = map;
    };
    run();
    return () => { if (leafletRef.current) { leafletRef.current.remove(); leafletRef.current = null; } };
  }, [pos]);

  useEffect(() => {
    if (pos && markerRef.current && leafletRef.current) {
      markerRef.current.setLatLng([pos.lat, pos.lng]);
      leafletRef.current.panTo([pos.lat, pos.lng]);
    }
  }, [pos]);

  const openChat = async () => {
    try {
      const r = await api.post(`/public/account/thread/rider/${order.code}`);
      nav(`../messages/${r.data.id}`);
    } catch { toast.error("Impossible d'ouvrir le chat"); }
  };

  return (
    <div className="dina-card-white p-5" data-testid="live-delivery">
      <div className="flex items-center gap-3 mb-3">
        {rider?.photo ? <img src={rider.photo} alt="" className="w-12 h-12 rounded-full object-cover"/> : <div className="w-12 h-12 rounded-full bg-[#fde8e8] text-[#b02a2a] font-semibold grid place-items-center">{rider?.first_name?.[0] || "L"}</div>}
        <div className="flex-1">
          <div className="font-semibold">{rider?.first_name || "Votre livreur"}</div>
          <div className="text-xs text-[#666]">
            {eta ? <span>Arrivée estimée dans ~{eta} min</span> : <span>En route vers vous</span>}
            {pos?.simulated && <span className="ml-1 text-[10px] uppercase text-[#999]">· démo</span>}
          </div>
        </div>
      </div>
      <div ref={mapRef} className="w-full h-64 rounded-lg bg-[#f5f5f5] overflow-hidden" data-testid="rider-map"></div>
      <div className="flex gap-2 mt-3">
        {rider?.phone && <a href={`tel:${rider.phone}`} className="dina-btn-secondary flex-1" data-testid="btn-call"><Phone size={14}/> Appeler</a>}
        {rider?.phone && <a href={`https://wa.me/${rider.phone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" className="dina-btn-secondary flex-1" data-testid="btn-whatsapp"><MessageCircle size={14}/> WhatsApp</a>}
        <button onClick={openChat} className="dina-btn-primary flex-1" data-testid="btn-chat"><MessageSquare size={14}/> Message</button>
      </div>
    </div>
  );
}

/* -------- Messages -------- */
function MessagesPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [text, setText] = useState("");
  const { customer } = useCustomer();

  const loadThreads = async () => { try { const r = await api.get("/public/account/threads"); setThreads(r.data); } catch {} };
  const loadActive = async () => {
    if (!id) { setActive(null); return; }
    try {
      // Reuse messaging — fetch via account/messages (returns all conversations). Find by id.
      const r = await api.get("/public/account/messages");
      const found = (r.data || []).find(c => c.id === id);
      setActive(found || null);
    } catch {}
  };
  useEffect(() => { loadThreads(); const t = setInterval(loadThreads, 10000); return () => clearInterval(t); }, []);
  useEffect(() => { loadActive(); const t = setInterval(loadActive, 5000); return () => clearInterval(t); }, [id]);

  const send = async () => {
    if (!text.trim() || !id) return;
    try { await api.post("/public/account/messages/send", { conversation_id: id, text }); setText(""); loadActive(); }
    catch { toast.error("Erreur"); }
  };

  if (!threads.length && !id) {
    return <EmptyState icon={MessageSquare} title="Aucun message" subtitle="Les messages de la boutique et du livreur apparaîtront ici"/>;
  }

  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-4 min-h-[70vh]" data-testid="messages-page">
      <div className="dina-card-white p-2 overflow-y-auto">
        {threads.map(t => {
          const other = (t.participants || []).find(p => p.id !== customer.id) || {};
          const last = (t.messages || [])[t.messages?.length - 1];
          const unread = (t.messages || []).filter(m => !(m.read_by || []).includes(customer.id)).length;
          return (
            <button key={t.id} onClick={() => nav(t.id)} className={`w-full text-left p-2.5 rounded-lg hover:bg-[#fff5f5] ${id === t.id ? "bg-[#fff5f5]" : ""}`} data-testid={`thread-${t.id}`}>
              <div className="flex gap-2 items-start">
                <div className="w-8 h-8 rounded-full bg-[#fde8e8] text-[#b02a2a] font-semibold text-xs grid place-items-center shrink-0">{other.name?.[0] || "?"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm truncate">{other.name || "—"}</div>
                    {unread > 0 && <span className="bg-[#b02a2a] text-white text-[9px] rounded-full px-1.5 py-0.5">{unread}</span>}
                  </div>
                  <div className="text-xs text-[#666] truncate">{last?.text || "Nouvelle conversation"}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="dina-card-white p-3 flex flex-col">
        {!active ? <div className="m-auto text-sm text-[#666]">Sélectionnez une conversation</div> : (
          <>
            <div className="flex-1 overflow-y-auto space-y-2 py-2">
              {(active.messages || []).map((m, i) => {
                const mine = m.from_id === customer.id;
                return <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`${mine ? "bg-[#b02a2a] text-white" : "bg-[#f5f5f5]"} rounded-xl px-3 py-2 max-w-[70%]`}><div className="text-sm">{m.text}</div><div className={`text-[10px] mt-1 ${mine ? "text-white/70" : "text-[#999]"}`}>{dateFmt(m.at)}</div></div></div>;
              })}
            </div>
            <div className="flex gap-2 border-t border-[#ececec] pt-2">
              <input className="dina-input flex-1" placeholder="Votre message…" value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} data-testid="msg-input"/>
              <button onClick={send} className="dina-btn-primary !min-h-[40px]" data-testid="msg-send">Envoyer</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* -------- Reviews pending -------- */
function ReviewsPending() {
  const [list, setList] = useState([]);
  const [rating, setRating] = useState({});
  const [comment, setComment] = useState({});
  const load = async () => { try { const r = await api.get("/public/account/reviews-pending"); setList(r.data); } catch {} };
  useEffect(() => { load(); }, []);
  const submit = async (p) => {
    const r = rating[p.product_id] || 5;
    try { await api.post("/public/account/reviews", { product_id: p.product_id, rating: r, comment: comment[p.product_id] || "" }); toast.success("Avis envoyé"); load(); }
    catch { toast.error("Erreur"); }
  };
  if (!list.length) return <EmptyState icon={Star} title="Aucun avis à donner" subtitle="Les produits livrés apparaîtront ici après livraison"/>;
  return (
    <div className="space-y-3" data-testid="reviews-pending">
      {list.map(p => (
        <div key={p.product_id} className="dina-card-white p-4" data-testid={`review-${p.product_id}`}>
          <div className="flex gap-3">
            {p.image && <img src={p.image} alt="" className="w-16 h-16 rounded object-cover"/>}
            <div className="flex-1">
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-[#666]">N° {p.order_code} · Livré {dateFmt(p.delivered_at)}</div>
              <div className="flex gap-1 mt-2">
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={()=>setRating({...rating,[p.product_id]:n})} data-testid={`rate-${p.product_id}-${n}`}>
                    <Star size={18} className={n <= (rating[p.product_id]||0) ? "fill-[#e4991e] text-[#e4991e]" : "text-[#ccc]"}/>
                  </button>
                ))}
              </div>
              <textarea className="dina-input mt-2" rows={2} placeholder="Un petit mot (optionnel)…" value={comment[p.product_id]||""} onChange={e=>setComment({...comment,[p.product_id]:e.target.value})}/>
              <button onClick={()=>submit(p)} className="dina-btn-primary mt-2 !min-h-[36px]" data-testid={`submit-${p.product_id}`}>Évaluer</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------- Simple pages -------- */
function Vouchers() {
  const [list, setList] = useState([]);
  useEffect(() => { api.get("/public/account/vouchers").then(r=>setList(r.data)).catch(()=>setList([])); }, []);
  if (!list.length) return <EmptyState icon={Ticket} title="Aucun bon d'achat" subtitle="Vos bons d'achat gagnés apparaîtront ici"/>;
  return <div className="space-y-2">{list.map(v => <div key={v.id} className="dina-card-white p-4 flex justify-between"><div><div className="font-serif text-lg">{v.code}</div><div className="text-xs text-[#666]">Valide jusqu'au {dateFmt(v.ends_at)}</div></div><div className="font-semibold tabular text-[#b02a2a]">{fcfa(v.amount)}</div></div>)}</div>;
}

function Favorites() {
  const [list, setList] = useState([]);
  useEffect(() => { api.get("/public/account/favorites").then(r=>setList(r.data || [])).catch(()=>setList([])); }, []);
  if (!list.length) return <EmptyState icon={Heart} title="Aucun favori" subtitle="Cliquez sur le cœur pour ajouter"/>;
  return <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{list.map(p => <Link key={p.id} to={`/boutique/product/${p.id}`} className="dina-card-white p-3"><img src={p.image} alt={p.name} className="w-full aspect-square object-cover rounded mb-2"/><div className="text-sm font-medium truncate">{p.name}</div><div className="text-xs text-[#b02a2a] font-semibold">{fcfa(p.price)}</div></Link>)}</div>;
}

function RecentlyViewed() {
  const [list, setList] = useState([]);
  useEffect(() => { api.get("/public/account/recently-viewed").then(r=>setList(r.data || [])).catch(()=>setList([])); }, []);
  if (!list.length) return <EmptyState icon={Eye} title="Aucun produit vu" subtitle="Les produits consultés apparaîtront ici"/>;
  return <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{list.map(p => <Link key={p.id} to={`/boutique/product/${p.id}`} className="dina-card-white p-3"><img src={p.image} alt={p.name} className="w-full aspect-square object-cover rounded mb-2"/><div className="text-sm font-medium truncate">{p.name}</div><div className="text-xs text-[#b02a2a] font-semibold">{fcfa(p.price)}</div></Link>)}</div>;
}

function Loyalty() {
  const { customer } = useCustomer();
  return (
    <div className="dina-card-white p-6 text-center" data-testid="loyalty">
      <Gift size={48} className="mx-auto text-[#b02a2a] mb-3"/>
      <div className="font-serif text-2xl mb-1">{customer.loyalty_points || 0} points</div>
      <div className="text-sm text-[#666] mb-4">Niveau {customer.tier || "Bronze"}</div>
      <Link to="/boutique/catalog" className="dina-btn-primary inline-flex">Continuer mes achats</Link>
    </div>
  );
}

function Referral() {
  const { customer } = useCustomer();
  const copy = () => { navigator.clipboard.writeText(customer.referral_code || ""); toast.success("Copié !"); };
  return (
    <div className="dina-card-white p-6" data-testid="referral">
      <div className="font-serif text-xl mb-3">Mon code de parrainage</div>
      <div className="flex items-center gap-3 p-4 bg-[#fff5f5] rounded-lg">
        <div className="font-mono text-2xl text-[#b02a2a] font-bold">{customer.referral_code}</div>
        <button onClick={copy} className="ml-auto dina-btn-secondary !min-h-[36px] text-xs">Copier</button>
      </div>
      <p className="text-sm text-[#666] mt-3">Partagez votre code — vous et votre amie recevez un bonus à chaque commande.</p>
    </div>
  );
}

function WalletPage() {
  const { customer } = useCustomer();
  return (
    <div className="dina-card-white p-6 text-center" data-testid="wallet-page">
      <Wallet size={48} className="mx-auto text-[#b02a2a] mb-3"/>
      <div className="font-serif text-3xl mb-1 text-[#b02a2a]">{fcfa(customer.wallet || 0)}</div>
      <div className="text-sm text-[#666] mb-4">Solde porte-monnaie</div>
      <Link to="/boutique/catalog" className="dina-btn-primary inline-flex">Continuer mes achats</Link>
    </div>
  );
}

function Addresses() {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = async () => { try { const r = await api.get("/public/account/addresses"); setList(r.data || []); } catch {} };
  useEffect(() => { load(); }, []);
  const save = async (f) => {
    try { if (f.id) await api.patch(`/public/account/addresses/${f.id}`, f); else await api.post("/public/account/addresses", f); toast.success("Enregistré"); setEditing(null); load(); }
    catch { toast.error("Erreur"); }
  };
  const del = async (id) => { if (!window.confirm("Supprimer ?")) return; try { await api.delete(`/public/account/addresses/${id}`); load(); } catch {} };

  return (
    <div className="space-y-3" data-testid="addresses">
      <button onClick={()=>setEditing({})} className="dina-btn-primary !min-h-[36px]" data-testid="address-new"><Plus size={14}/> Nouvelle adresse</button>
      {list.length === 0 && <EmptyState icon={MapPin} title="Aucune adresse" subtitle="Ajoutez vos adresses de livraison"/>}
      {list.map(a => (
        <div key={a.id} className="dina-card-white p-4 flex gap-3 items-start" data-testid={`addr-${a.id}`}>
          <div className="flex-1">
            <div className="font-medium flex items-center gap-2">{a.label || "Adresse"} {a.default && <span className="text-[10px] uppercase bg-[#1f8a4c] text-white px-1.5 py-0.5 rounded">Par défaut</span>}</div>
            <div className="text-sm text-[#666]">{a.address}</div>
            <div className="text-xs text-[#999]">{a.zone}</div>
          </div>
          <button onClick={()=>setEditing(a)} className="text-[#666]"><Pencil size={14}/></button>
          <button onClick={()=>del(a.id)} className="text-[#c62828]"><X size={14}/></button>
        </div>
      ))}
      {editing && <AddressForm f={editing} onClose={()=>setEditing(null)} onSave={save}/>}
    </div>
  );
}

function AddressForm({ f, onClose, onSave }) {
  const [v, setV] = useState({ label: f.label || "", address: f.address || "", zone: f.zone || "", default: f.default || false, id: f.id });
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-5 w-full max-w-md" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between mb-4"><div className="font-serif text-xl">Adresse</div><button onClick={onClose}><X size={16}/></button></div>
        <div className="space-y-2">
          <input className="dina-input" placeholder="Libellé (Maison, Bureau…)" value={v.label} onChange={e=>setV({...v,label:e.target.value})} data-testid="addr-label"/>
          <textarea className="dina-input" rows={2} placeholder="Adresse complète" value={v.address} onChange={e=>setV({...v,address:e.target.value})} data-testid="addr-address"/>
          <input className="dina-input" placeholder="Zone (Cocody, Yopougon…)" value={v.zone} onChange={e=>setV({...v,zone:e.target.value})} data-testid="addr-zone"/>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.default} onChange={e=>setV({...v,default:e.target.checked})}/> Définir par défaut</label>
        </div>
        <div className="flex gap-2 mt-4"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={()=>onSave(v)} className="dina-btn-primary flex-1" data-testid="addr-save">Enregistrer</button></div>
      </div>
    </div>
  );
}

function Preferences() {
  const { customer, setCustomer } = useCustomer();
  const [v, setV] = useState(customer.communication_prefs || { whatsapp: true, sms: true, email: false, newsletter: false });
  const save = async () => { try { const r = await api.patch("/public/account/update", { communication_prefs: v }); setCustomer(r.data); toast.success("Enregistré"); } catch { toast.error("Erreur"); } };
  return (
    <div className="dina-card-white p-5 space-y-3" data-testid="preferences">
      <div className="font-serif text-xl">Préférences de communication</div>
      {["whatsapp","sms","email","newsletter"].map(k => (
        <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={!!v[k]} onChange={e=>setV({...v, [k]: e.target.checked})}/> {k === "whatsapp" ? "WhatsApp" : k === "newsletter" ? "Newsletter promotions" : k.toUpperCase()}</label>
      ))}
      <button onClick={save} className="dina-btn-primary">Enregistrer</button>
    </div>
  );
}

function Security() {
  const [old_code, setOld] = useState("");
  const [n1, setN1] = useState("");
  const [n2, setN2] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (n1 !== n2) return toast.error("Les codes ne correspondent pas");
    if (n1.length !== 6) return toast.error("6 chiffres");
    setLoading(true);
    try { await api.post("/public/account/change-code", { old_code, new_code: n1 }); toast.success("Code changé"); setOld(""); setN1(""); setN2(""); }
    catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
    finally { setLoading(false); }
  };
  return (
    <div className="dina-card-white p-5 space-y-3 max-w-md" data-testid="security">
      <div className="font-serif text-xl flex items-center gap-2"><Shield size={16}/> Changer mon code</div>
      <p className="text-xs text-[#666]">Code secret à 6 chiffres pour accéder à votre compte.</p>
      <input type="password" inputMode="numeric" maxLength={6} className="dina-input tracking-widest text-center text-lg" placeholder="Code actuel" value={old_code} onChange={e=>setOld(e.target.value.replace(/\D/g,""))} data-testid="old-pin"/>
      <input type="password" inputMode="numeric" maxLength={6} className="dina-input tracking-widest text-center text-lg" placeholder="Nouveau code" value={n1} onChange={e=>setN1(e.target.value.replace(/\D/g,""))} data-testid="new-pin-1"/>
      <input type="password" inputMode="numeric" maxLength={6} className="dina-input tracking-widest text-center text-lg" placeholder="Confirmer nouveau code" value={n2} onChange={e=>setN2(e.target.value.replace(/\D/g,""))} data-testid="new-pin-2"/>
      <button onClick={submit} disabled={loading} className="dina-btn-primary w-full" data-testid="change-pin">{loading ? "Changement…" : "Changer le code"}</button>
    </div>
  );
}

/* -------- Shared empty state -------- */
function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="dina-card-white p-10 text-center" data-testid="empty-state">
      <Icon size={48} className="mx-auto text-[#ccc] mb-3"/>
      <div className="font-serif text-xl mb-1">{title}</div>
      <div className="text-sm text-[#666] mb-4">{subtitle}</div>
      <Link to="/boutique/catalog" className="dina-btn-primary inline-flex" data-testid="empty-continue">Continuer mes achats</Link>
    </div>
  );
}

function EmptyLine({ text, cta }) {
  return <div className="flex items-center justify-between text-sm text-[#999]"><span>{text}</span>{cta}</div>;
}
