import React, { useEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, Link, NavLink, useNavigate, useParams, Outlet, useLocation } from "react-router-dom";
import api from "@/lib/api";
import { fcfa, dateFmt, statusLabel, statusColor } from "@/lib/format";
import { toast } from "sonner";
import { useCustomer } from "@/context/CustomerContext";
import { MessagePhotos, PhotoLightbox } from "@/components/shared/OrderThread";
import { RichComposer, RichText } from "@/components/shared/RichComposer";
import { AddressModal, addressLine } from "@/components/storefront/AddressForm";
import { enablePush, pushErrorText, pushGranted } from "@/lib/push";
import { playChime } from "@/lib/notifySound";
import { getVisitorId } from "@/lib/analytics";
import { REF_KEY } from "@/pages/storefront/Invitation";
import { WalletLedger, SOURCE_LABEL } from "@/components/shared/WalletLedger";
import {
  User, Package, MessageSquare, Star, Ticket, Heart, Eye, Gift, UserPlus, Wallet,
  MapPin, Settings, Shield, LogOut, Camera, Phone, MessageCircle, Download,
  ChevronRight, Pencil, Plus, Check, X, AlertCircle, ArrowLeft, Clock, Bell
} from "lucide-react";

const MENU = [
  { to: "", label: "Mon compte", icon: User, end: true },
  { to: "commandes", label: "Mes commandes", icon: Package },
  { to: "messages", label: "Messages", icon: MessageSquare },
  { to: "notifications", label: "Notifications", icon: Bell },
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
      <NotifWatcher/>
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
            <Route path="notifications" element={<NotificationsPage />} />
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
                to={`/boutique/compte${m.to ? `/${m.to}` : ""}`}
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
            <Route path="notifications" element={<NotificationsPage />} />
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
        <Link key={m.to} to={`/boutique/compte${m.to ? `/${m.to}` : ""}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[#fafafa]">
          <m.icon size={16} className="text-[#666]" />
          <span className="flex-1">{m.label}</span>
          <ChevronRight size={14} className="text-[#999]" />
        </Link>
      ))}
      <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 text-[#c62828]"><LogOut size={16} /> Déconnexion</button>
    </div>
  );
}

/* -------- Login / signup gate -------- */
function LoginGate() {
  const location = useLocation();
  const modeOf = () => new URLSearchParams(location.search).get("mode") === "inscription" ? "signup" : "login";
  const [mode, setMode] = useState(modeOf);
  useEffect(() => { setMode(modeOf()); }, [location.search]); // eslint-disable-line
  return (
    <div className="max-w-md mx-auto px-4 py-8 sm:py-10" data-testid="account-gate">
      <div className="w-16 h-16 rounded-full bg-[#fde8e8] text-[#b02a2a] font-serif text-3xl font-bold grid place-items-center mx-auto mb-3">D</div>
      <h1 className="font-serif text-3xl mb-4 text-center">Mon compte</h1>
      <div className="grid grid-cols-2 gap-1 p-1 bg-[#f5f5f5] rounded-xl mb-4">
        <button onClick={() => setMode("login")} className={`py-2 rounded-lg text-sm ${mode === "login" ? "bg-white shadow font-semibold" : "text-[#666]"}`} data-testid="gate-tab-login">Se connecter</button>
        <button onClick={() => setMode("signup")} className={`py-2 rounded-lg text-sm ${mode === "signup" ? "bg-white shadow font-semibold" : "text-[#666]"}`} data-testid="gate-tab-signup">Créer un compte</button>
      </div>
      {mode === "login" ? <LoginForm onSwitch={() => setMode("signup")}/> : <SignupForm onSwitch={() => setMode("login")}/>}
    </div>
  );
}

const errText = (e) => { const d = e.response?.data?.detail; return typeof d === "string" ? d : Array.isArray(d) ? d.map(x => x.msg).join(" ") : "Erreur"; };

function LoginForm({ onSwitch }) {
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
    } catch (e) { toast.error(errText(e)); }
    finally { setLoading(false); }
  };
  return (
    <div className="dina-card-white p-5 space-y-3">
      <p className="text-sm text-[#666]">Entrez votre numéro et votre code PIN à 6 chiffres.</p>
      <input className="dina-input" inputMode="tel" placeholder="+225 07 XX XX XX XX" value={phone} onChange={e=>setPhone(e.target.value)} data-testid="account-phone"/>
      <input type="password" inputMode="numeric" maxLength={6} className="dina-input tracking-[0.5em] text-center text-xl" placeholder="••••••" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))} onKeyDown={e => e.key === "Enter" && submit()} data-testid="account-code"/>
      <button onClick={submit} disabled={loading} className="dina-btn-primary w-full" data-testid="account-login">{loading ? "Connexion…" : "Se connecter"}</button>
      <div className="text-xs text-center text-[#666]">Nouvelle cliente ? <button onClick={onSwitch} className="text-[#b02a2a] underline" data-testid="gate-go-signup">Créer mon compte</button></div>
      <div className="text-[11px] text-center text-[#999]">Code oublié ? Écrivez-nous sur WhatsApp, l'équipe vous en génère un nouveau.</div>
    </div>
  );
}

function SignupForm({ onSwitch }) {
  const nav = useNavigate();
  const { loginDone } = useCustomer();
  const [f, setF] = useState({ name: "", phone: "+225 ", email: "", pin: "", pin2: "", referral_code: new URLSearchParams(window.location.search).get("ref") || localStorage.getItem(REF_KEY) || "" });
  const [invited, setInvited] = useState(() => !!(new URLSearchParams(window.location.search).get("ref") || localStorage.getItem(REF_KEY)));
  const [refInfo, setRefInfo] = useState(null);
  useEffect(() => {
    const code = f.referral_code.trim();
    if (!invited || code.length < 4) { setRefInfo(null); return; }
    const t = setTimeout(() => api.get(`/public/referral/${encodeURIComponent(code)}`).then(r => setRefInfo(r.data)).catch(() => setRefInfo({ valid: false })), 400);
    return () => clearTimeout(t);
  }, [f.referral_code, invited]);
  const [loading, setLoading] = useState(false);
  const set = (k, fn = (x) => x) => (e) => setF({ ...f, [k]: fn(e.target.value) });
  const digits = (x) => x.replace(/\D/g, "").slice(0, 6);
  const submit = async () => {
    if (f.name.trim().length < 2) return toast.error("Indiquez votre nom");
    if (f.phone.replace(/\D/g, "").length < 10) return toast.error("Numéro de téléphone invalide");
    if (f.pin.length !== 6) return toast.error("Code PIN à 6 chiffres");
    if (f.pin !== f.pin2) return toast.error("Les deux codes PIN ne correspondent pas");
    if (invited && f.referral_code.trim() && refInfo && !refInfo.valid) return toast.error("Code de parrainage introuvable · corrigez-le ou répondez Non");
    setLoading(true);
    try {
      const r = await api.post("/public/customer-signup", { name: f.name, phone: f.phone, email: f.email || null, pin: f.pin, referral_code: invited ? (f.referral_code || null) : null, visitor_id: getVisitorId() });
      localStorage.removeItem(REF_KEY);
      loginDone({ token: r.data.token, customer: r.data.customer });
      toast.success(`Bienvenue ${r.data.customer.name.split(" ")[0]} 🎉 Votre compte est créé`);
      nav("/boutique/compte");
    } catch (e) { toast.error(errText(e)); }
    finally { setLoading(false); }
  };
  return (
    <div className="dina-card-white p-5 space-y-3" data-testid="signup-form">
      <input className="dina-input" placeholder="Nom et prénom" value={f.name} onChange={set("name")} data-testid="signup-name"/>
      <input className="dina-input" inputMode="tel" placeholder="+225 07 XX XX XX XX" value={f.phone} onChange={set("phone")} data-testid="signup-phone"/>
      <input className="dina-input" type="email" placeholder="E-mail (facultatif)" value={f.email} onChange={set("email")} data-testid="signup-email"/>
      <div className="grid grid-cols-2 gap-2">
        <input type="password" inputMode="numeric" className="dina-input tracking-[0.3em] text-center" placeholder="Code PIN" value={f.pin} onChange={set("pin", digits)} data-testid="signup-pin"/>
        <input type="password" inputMode="numeric" className="dina-input tracking-[0.3em] text-center" placeholder="Confirmer" value={f.pin2} onChange={set("pin2", digits)} data-testid="signup-pin2"/>
      </div>
      <p className="text-[11px] text-[#666] -mt-1">6 chiffres, à garder secret. Évitez 123456 ou 000000.</p>
      <div className="rounded-lg border border-[#ececec] p-3 space-y-2" data-testid="signup-invited-block">
        <div className="text-sm font-medium">Avez-vous été invitée par une autre cliente ?</div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setInvited(true)} className={`flex-1 py-1.5 rounded-lg text-sm border ${invited ? "bg-[#1c1c1c] text-white border-[#1c1c1c]" : "border-[#ececec]"}`} data-testid="signup-invited-yes">Oui</button>
          <button type="button" onClick={() => setInvited(false)} className={`flex-1 py-1.5 rounded-lg text-sm border ${!invited ? "bg-[#1c1c1c] text-white border-[#1c1c1c]" : "border-[#ececec]"}`} data-testid="signup-invited-no">Non</button>
        </div>
        {invited && <>
          <input className="dina-input uppercase" placeholder="Code de votre marraine (ex : DINA-1234)" value={f.referral_code} onChange={set("referral_code", x => x.toUpperCase())} data-testid="signup-referral"/>
          {refInfo?.valid && <p className="text-[11px] text-[#1f8a4c]" data-testid="signup-referral-ok">✓ Code de {refInfo.first_name} · {fcfa(refInfo.bonus_filleul)} offerts à l'inscription</p>}
          {refInfo && !refInfo.valid && <p className="text-[11px] text-[#c62828]" data-testid="signup-referral-ko">Code introuvable</p>}
        </>}
      </div>
      <button onClick={submit} disabled={loading} className="dina-btn-primary w-full" data-testid="signup-submit">{loading ? "Création…" : "Créer mon compte"}</button>
      <div className="text-xs text-center text-[#666]">Déjà cliente ? <button onClick={onSwitch} className="text-[#b02a2a] underline" data-testid="gate-go-login">Se connecter</button></div>
    </div>
  );
}

/* -------- Overview (4 cards) -------- */
function Overview() {
  const { customer, setCustomer, refresh } = useCustomer();
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
            <div className="font-medium">{defaultAddr.label || "Adresse principale"}{defaultAddr.lat ? <span className="ml-2 text-[10px] text-[#1f8a4c]">● GPS</span> : null}</div>
            <div className="text-[#666] mt-1">{addressLine(defaultAddr)}</div>
            <div className="text-[#666]">{defaultAddr.zone}</div>
            <Link to="/boutique/compte/adresses" className="text-xs text-[#b02a2a] underline mt-2 inline-block" data-testid="card-address-all">Gérer mes adresses</Link>
          </div>
        ) : (
          <EmptyLine text="Aucune adresse enregistrée" cta={<button onClick={() => setShowEdit("address")} className="text-[#b02a2a] text-sm underline" data-testid="card-address-add">Ajouter</button>}/>
        )}
      </Card>

      {/* Wallet + points */}
      <Card title="Porte-monnaie et points" icon={Wallet} testId="card-wallet">
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

      {showEdit === "address" && <AddressModal initial={defaultAddr || { default: true }} onClose={() => setShowEdit(null)} onSave={async (v) => {
        try {
          if (v.id) await api.patch(`/public/account/addresses/${v.id}`, { ...v, default: true }); else await api.post("/public/account/addresses", { ...v, default: true });
          await refresh(); setShowEdit(null); toast.success("Adresse enregistrée");
        } catch { toast.error("Erreur"); }
      }}/>}
      {showEdit && showEdit !== "address" && <EditModal mode={showEdit} customer={customer} onClose={() => setShowEdit(null)} onSaved={(c) => { setCustomer(c); setShowEdit(null); }}/>}
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
    name: customer.name, email: customer.email || "", birthday: customer.birthday || "",
    shoe_size: customer.shoe_size || "", clothing_size: customer.clothing_size || "",
    communication_prefs: customer.communication_prefs || { whatsapp: true, sms: true, email: false, newsletter: false },
  });
  const save = async () => {
    if (mode === "info" && (f.name || "").trim().length < 2) return toast.error("Nom requis");
    try {
      const patch = mode === "prefs" ? { communication_prefs: f.communication_prefs } : { name: f.name.trim(), email: f.email, birthday: f.birthday, shoe_size: f.shoe_size, clothing_size: f.clothing_size };
      const r = await api.patch("/public/account/update", patch);
      onSaved(r.data); toast.success("Enregistré");
    } catch { toast.error("Erreur"); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4" onClick={onClose} data-testid="edit-modal">
      <div className="bg-white rounded-t-2xl sm:rounded-xl p-5 w-full sm:max-w-md" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between mb-4"><div className="font-serif text-xl">{mode === "prefs" ? "Préférences" : "Mes informations"}</div><button onClick={onClose}><X size={16}/></button></div>
        {mode === "info" && (
          <div className="space-y-2">
            <label className="text-[11px] uppercase text-[#666] font-semibold">Nom et prénom</label>
            <input className="dina-input" value={f.name} onChange={e=>setF({...f,name:e.target.value})} data-testid="edit-name"/>
            <label className="text-[11px] uppercase text-[#666] font-semibold">E-mail</label>
            <input className="dina-input" type="email" placeholder="facultatif" value={f.email} onChange={e=>setF({...f,email:e.target.value})} data-testid="edit-email"/>
            <label className="text-[11px] uppercase text-[#666] font-semibold">Date d'anniversaire</label>
            <input className="dina-input" type="date" value={f.birthday} onChange={e=>setF({...f,birthday:e.target.value})} data-testid="edit-birthday"/>
            <div className="grid grid-cols-2 gap-2">
              <input className="dina-input" placeholder="Pointure" value={f.shoe_size} onChange={e=>setF({...f,shoe_size:e.target.value})} data-testid="edit-shoe"/>
              <input className="dina-input" placeholder="Taille vêtement" value={f.clothing_size} onChange={e=>setF({...f,clothing_size:e.target.value})} data-testid="edit-clothing"/>
            </div>
            <p className="text-[11px] text-[#999]">Votre numéro ({customer.phone}) sert d'identifiant · pour le changer, contactez la boutique.</p>
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
  const [checked, setChecked] = useState(false);
  const nav = useNavigate();
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const leafletRef = useRef(null);

  const fetchPos = async () => {
    try {
      const r = await api.get(`/public/order/${order.code}/rider-position`);
      if (r.data.position) { setPos(r.data.position); setEta(r.data.eta_minutes); }
    } catch {}
    finally { setChecked(true); }
  };

  useEffect(() => {
    fetchPos();
    const t = setInterval(fetchPos, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.code]);

  // Init map once when we have a first position
  useEffect(() => {
    if (!pos || !mapRef.current || leafletRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !mapRef.current || leafletRef.current) return;
      const map = L.map(mapRef.current, { zoomControl: false }).setView([pos.lat, pos.lng], 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OSM", maxZoom: 19 }).addTo(map);
      const icon = L.divIcon({ className: "", html: `<div style="background:#b02a2a;color:#fff;border-radius:9999px;width:34px;height:34px;display:grid;place-items:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,.3)">🏍️</div>` });
      markerRef.current = L.marker([pos.lat, pos.lng], { icon }).addTo(map);
      leafletRef.current = map;
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos ? "ready" : "pending"]);

  // Pan the marker on each position update
  useEffect(() => {
    if (pos && markerRef.current && leafletRef.current) {
      markerRef.current.setLatLng([pos.lat, pos.lng]);
      leafletRef.current.panTo([pos.lat, pos.lng]);
    }
  }, [pos]);

  // Clean up on unmount
  useEffect(() => {
    return () => { if (leafletRef.current) { leafletRef.current.remove(); leafletRef.current = null; } };
  }, []);

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
      <div className="relative w-full h-64 rounded-lg bg-[#f5f5f5] overflow-hidden" data-testid="rider-map-wrap">
        <div ref={mapRef} className="w-full h-full" data-testid="rider-map"></div>
        {!pos && (
          <div className="absolute inset-0 grid place-items-center bg-[#fafafa]/90 text-sm text-[#666]" data-testid="rider-map-placeholder">
            <div className="flex flex-col items-center gap-2">
              <Clock size={28} className="text-[#b02a2a]"/>
              <span>{checked ? "En attente de la position du livreur…" : "Chargement de la carte…"}</span>
            </div>
          </div>
        )}
      </div>
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
  const [photo, setPhoto] = useState(null);
  const [zoom, setZoom] = useState(null);
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
    if ((!text.trim() && !photo) || !id) return;
    try { await api.post("/public/account/messages/send", { conversation_id: id, text, attachments: photo ? [{ type: "image", url: photo, name: "photo.jpg", mime: "image/jpeg" }] : [] }); setText(""); setPhoto(null); loadActive(); }
    catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };

  if (!threads.length && !id) {
    return <EmptyState icon={MessageSquare} title="Aucun message" subtitle="Les messages de la boutique et du livreur apparaîtront ici"/>;
  }

  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-4 md:min-h-[70vh]" data-testid="messages-page">
      <div className={`dina-card-white p-2 overflow-y-auto ${id ? "hidden md:block" : ""}`}>
        {threads.map(t => {
          const other = t.with || (t.participants || []).find(p => p.id !== customer.id) || {};
          const last = t.last_message || (t.messages || [])[t.messages?.length - 1];
          const unread = t.unread ?? (t.messages || []).filter(m => !(m.read_by || []).includes(customer.id)).length;
          return (
            <button key={t.id} onClick={() => nav(`/boutique/compte/messages/${t.id}`)} className={`w-full text-left p-2.5 rounded-lg hover:bg-[#fff5f5] ${id === t.id ? "bg-[#fff5f5]" : ""}`} data-testid={`thread-${t.id}`}>
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
      <div className={`dina-card-white p-3 flex flex-col ${id ? "" : "hidden md:flex"}`}>
        {id && <button onClick={() => nav("/boutique/compte/messages")} className="md:hidden text-xs text-[#666] flex items-center gap-1 mb-2" data-testid="msg-back"><ArrowLeft size={12}/>Conversations</button>}
        {!active ? <div className="m-auto text-sm text-[#666]">Sélectionnez une conversation</div> : (
          <>
            <div className="flex-1 overflow-y-auto space-y-2 py-2 max-h-[60vh]">
              {(active.messages || []).map((m, i) => {
                const mine = m.from_id === customer.id;
                return <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`${mine ? "bg-[#b02a2a] text-white" : "bg-[#f5f5f5]"} rounded-xl px-3 py-2 max-w-[80%]`}><MessagePhotos m={m} onOpen={setZoom}/>{m.text && <RichText text={m.text} className="text-sm"/>}<div className={`text-[10px] mt-1 ${mine ? "text-white/70" : "text-[#999]"}`}>{m.from_name && !mine ? `${m.from_name} · ` : ""}{dateFmt(m.at)}</div></div></div>;
              })}
            </div>
            <PhotoLightbox src={zoom} onClose={() => setZoom(null)}/>
            {photo && <div className="relative inline-block mb-2 self-start" data-testid="msg-photo-preview"><img src={photo} alt="Aperçu" className="h-20 rounded-lg"/><button onClick={() => setPhoto(null)} className="absolute -top-2 -right-2 bg-[#1c1c1c] text-white rounded-full px-1.5 text-xs">×</button></div>}
            {active.closed ? <div className="text-xs text-[#999] text-center border-t border-[#ececec] pt-2">Conversation fermée après la livraison</div> : (
              <div className="border-t border-[#ececec] pt-2">
                <RichComposer value={text} onChange={setText} onSend={send} onPhoto={setPhoto} canSend={!!(text.trim() || photo)} testid="msg"/>
              </div>
            )}
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

function useWallet() {
  const [w, setW] = useState(null);
  const load = () => api.get("/public/account/wallet").then(r => setW(r.data)).catch(() => setW({ error: true }));
  useEffect(() => { load(); }, []);
  return [w, setW, load];
}

const LoadError = ({ retry }) => <div className="dina-card-white p-6 text-center text-sm text-[#666]" data-testid="account-load-error">Impossible de charger vos données. <button onClick={retry} className="text-[#b02a2a] underline">Réessayer</button> ou reconnectez-vous.</div>;

function Loyalty() {
  const { customer, refresh } = useCustomer();
  const [w, setW, reloadW] = useWallet();
  const [pts, setPts] = useState("");
  const [busy, setBusy] = useState(false);
  if (!w) return <div className="dina-card-white p-6 text-sm text-[#666]">Chargement…</div>;
  if (w.error) return <LoadError retry={reloadW}/>;
  const convertible = w.points >= w.min_points;
  const convert = async () => {
    const n = Number(pts || w.points);
    if (n < w.min_points || n > w.points) return toast.error(`Entre ${w.min_points} et ${w.points} points`);
    setBusy(true);
    try { const r = await api.post("/public/account/wallet/convert", { points: n, key: `${Date.now()}-${n}` }); setW(r.data); setPts(""); refresh(); toast.success(`${n} points convertis en ${fcfa(n * w.point_value)}`); }
    catch (e) { toast.error(e.response?.data?.detail || "Erreur"); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3" data-testid="loyalty">
      <div className="dina-card-white p-6 text-center">
        <Gift size={40} className="mx-auto text-[#b02a2a] mb-2"/>
        <div className="font-serif text-3xl" data-testid="loyalty-points">{w.points} points</div>
        <div className="text-sm text-[#666]">Niveau {customer.tier || "Bronze"} · valeur {fcfa(w.points * w.point_value)}</div>
      </div>
      <div className="dina-card-white p-5 space-y-3">
        <div className="font-semibold">Convertir mes points en argent</div>
        <p className="text-sm text-[#666]">1 point = {fcfa(w.point_value)} · conversion à partir de {w.min_points} points. L'argent arrive tout de suite dans votre porte-monnaie.</p>
        <div className="flex gap-2 flex-wrap">
          <input className="dina-input flex-1 min-w-[140px]" type="number" min={w.min_points} max={w.points} placeholder={`${w.points} points`} value={pts} onChange={e => setPts(e.target.value)} disabled={!convertible} data-testid="loyalty-convert-input"/>
          <button onClick={convert} disabled={!convertible || busy} className="dina-btn-primary" data-testid="loyalty-convert">{busy ? "…" : `Convertir${pts ? ` · ${fcfa(Number(pts) * w.point_value)}` : ""}`}</button>
        </div>
        {!convertible && <p className="text-xs text-[#999]">Encore {w.min_points - w.points} points avant votre première conversion.</p>}
      </div>
      <div className="dina-card-white p-5 text-sm text-[#666] space-y-1">
        <div className="font-semibold text-[#1c1c1c]">Comment gagner des points ?</div>
        <div>• 1 point par tranche de {fcfa(w.points_per_fcfa)} d'articles achetés.</div>
        <div>• Les points sont ajoutés quand votre commande est livrée (pas pour une commande annulée).</div>
      </div>
    </div>
  );
}

const REF_STATUS = { inscrite: ["Inscrite", "#5867fd"], premiere_commande: ["1re commande en cours", "#e4991e"], recompensee: ["Récompense versée", "#1f8a4c"] };

function Referral() {
  const [d, setD] = useState(null);
  const loadRef = () => api.get("/public/account/referral").then(r => setD(r.data)).catch(() => setD({ error: true }));
  useEffect(() => { loadRef(); }, []); // eslint-disable-line
  if (!d) return <div className="dina-card-white p-6 text-sm text-[#666]">Chargement…</div>;
  if (d.error) return <LoadError retry={loadRef}/>;
  const link = `${window.location.origin}/boutique/invitation/${d.code}`;
  const msg = `Je t'invite chez Chez Dina 👗 Crée ton compte avec mon lien et reçois ${fcfa(d.rules.filleul)} sur ta première commande : ${link}`;
  const copy = (t) => { navigator.clipboard?.writeText(t); toast.success("Copié !"); };
  const share = async () => { if (navigator.share) { try { await navigator.share({ title: "Chez Dina", text: msg }); } catch {} } else window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank"); };
  const S = d.stats;
  return (
    <div className="space-y-3" data-testid="referral">
      <div className="dina-card-white p-5 bg-[#fff5f5]">
        <div className="font-serif text-xl mb-1">Invitez une amie, gagnez chacune {d.rules.parrain === d.rules.filleul ? fcfa(d.rules.parrain) : `${fcfa(d.rules.parrain)} / ${fcfa(d.rules.filleul)}`}</div>
        <p className="text-sm text-[#666]" data-testid="referral-rules">Votre amie reçoit <b>{fcfa(d.rules.filleul)}</b> dès son inscription avec votre lien ou votre code, utilisables dès sa première commande. Vous recevez <b>{fcfa(d.rules.parrain)}</b> quand sa première commande est livrée. Les montants sont crédités dans le porte-monnaie, utilisables sur les articles de vos prochaines commandes (hors frais de livraison), sans date limite, cumulables avec les promotions, non retirables en argent.</p>
      </div>
      <div className="dina-card-white p-5 space-y-3">
        <div className="text-xs uppercase text-[#666] font-semibold">Mon code</div>
        <div className="flex items-center gap-3"><div className="font-mono text-2xl text-[#b02a2a] font-bold" data-testid="referral-code">{d.code}</div><button onClick={() => copy(d.code)} className="ml-auto dina-btn-secondary !min-h-[34px] text-xs" data-testid="referral-copy-code">Copier</button></div>
        <div className="text-xs uppercase text-[#666] font-semibold">Mon lien d'invitation</div>
        <div className="flex gap-2 flex-wrap"><input readOnly className="dina-input flex-1 min-w-[200px] text-xs" value={link} data-testid="referral-link"/><button onClick={() => copy(link)} className="dina-btn-secondary !min-h-[40px] text-xs" data-testid="referral-copy-link">Copier le lien</button><button onClick={share} className="dina-btn-primary !min-h-[40px] text-xs" data-testid="referral-share">Partager</button></div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="referral-stats">
        {[["Liens ouverts", S.opened, "opened"], ["Inscrites", S.signed_up, "signed"], ["1er achat", S.first_purchase, "purchase"], ["Récompenses", S.rewarded, "rewarded"]].map(([l, v, k]) => (
          <div key={k} className="dina-card-white p-3"><div className="text-[11px] uppercase text-[#666]">{l}</div><div className="font-serif text-2xl" data-testid={`referral-stat-${k}`}>{v}</div></div>
        ))}
      </div>
      <div className="dina-card-white p-4 text-sm flex flex-wrap gap-4"><div>Gagné : <b className="text-[#1f8a4c]" data-testid="referral-earned">{fcfa(S.earned)}</b></div><div>En attente : <b className="text-[#e4991e]" data-testid="referral-pending">{fcfa(S.pending)}</b></div></div>
      <div className="dina-card-white p-4">
        <div className="font-semibold mb-2">Mes invitations</div>
        {d.items.length === 0 ? <div className="text-sm text-[#666] text-center py-4">Personne n'a encore utilisé votre code.</div> : d.items.map(i => {
          const [l, c] = REF_STATUS[i.status] || [i.status, "#666"];
          return <div key={i.id} className="flex items-center justify-between py-2 border-b border-[#f5f5f5] last:border-0 text-sm" data-testid={`referral-item-${i.id}`}><div className="min-w-0"><div className="font-medium truncate">{i.name}</div><div className="text-[11px] text-[#999]">Inscrite le {dateFmt(i.created_at)}</div></div><span className="text-[11px] font-semibold shrink-0" style={{ color: c }}>{l}{i.status === "recompensee" ? ` · +${fcfa(i.reward)}` : ""}</span></div>;
        })}
      </div>
    </div>
  );
}

function WalletPage() {
  const [w, , reloadW] = useWallet();
  if (!w) return <div className="dina-card-white p-6 text-sm text-[#666]">Chargement…</div>;
  if (w.error) return <LoadError retry={reloadW}/>;
  return (
    <div className="space-y-3" data-testid="wallet-page">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="dina-card-white p-4 col-span-2 sm:col-span-1"><div className="text-[11px] uppercase text-[#666]">Disponible</div><div className="font-serif text-2xl sm:text-3xl text-[#b02a2a] whitespace-nowrap" data-testid="wallet-balance">{fcfa(w.balance)}</div></div>
        <div className="dina-card-white p-4"><div className="text-[11px] uppercase text-[#666]">En attente</div><div className="font-serif text-xl text-[#e4991e]" data-testid="wallet-pending">{fcfa(w.pending)}</div></div>
        <div className="dina-card-white p-4"><div className="text-[11px] uppercase text-[#666]">Total gagné</div><div className="font-serif text-xl text-[#1f8a4c]" data-testid="wallet-earned">{fcfa(w.earned_total)}</div></div>
        <div className="dina-card-white p-4"><div className="text-[11px] uppercase text-[#666]">Utilisé</div><div className="font-serif text-xl" data-testid="wallet-used">{fcfa(w.used_total)}</div></div>
      </div>
      {Object.keys(w.by_source).length > 0 && <div className="dina-card-white p-4 flex flex-wrap gap-2 text-xs">{Object.entries(w.by_source).map(([k, v]) => <span key={k} className="dina-chip">{SOURCE_LABEL[k] || k} · {fcfa(v)}</span>)}</div>}
      <div className="dina-card-white p-4 text-xs text-[#666]">Utilisable sur les articles de vos commandes (hors frais de livraison), tout ou partie, sans date limite. Cumulable avec les promotions. Crédit interne non retirable en argent. Si une commande est annulée, le montant utilisé vous est rendu. <Link to="/boutique/compte/fidelite" className="text-[#b02a2a] underline">Convertir mes points</Link> · <Link to="/boutique/compte/parrainage" className="text-[#b02a2a] underline">Inviter une amie</Link></div>
      <div className="dina-card-white p-4"><div className="font-semibold mb-1">Historique</div><WalletLedger rows={w.history}/></div>
    </div>
  );
}

function Addresses() {
  const { refresh } = useCustomer();
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = async () => { try { const r = await api.get("/public/account/addresses"); setList(r.data || []); } catch {} };
  useEffect(() => { load(); }, []);
  const save = async (f) => {
    try { if (f.id) await api.patch(`/public/account/addresses/${f.id}`, f); else await api.post("/public/account/addresses", f); toast.success("Adresse enregistrée"); setEditing(null); load(); refresh(); }
    catch { toast.error("Erreur"); }
  };
  const makeDefault = async (a) => { try { await api.patch(`/public/account/addresses/${a.id}`, { default: true }); load(); refresh(); toast.success("Adresse par défaut mise à jour"); } catch { toast.error("Erreur"); } };
  const del = async (id) => { if (!window.confirm("Supprimer cette adresse ?")) return; try { await api.delete(`/public/account/addresses/${id}`); load(); refresh(); } catch {} };

  return (
    <div className="space-y-3" data-testid="addresses">
      <button onClick={()=>setEditing({})} className="dina-btn-primary !min-h-[36px]" data-testid="address-new"><Plus size={14}/> Nouvelle adresse</button>
      {list.length === 0 && <div className="dina-card-white p-8 text-center text-sm text-[#666]" data-testid="addresses-empty"><MapPin size={36} className="mx-auto text-[#ccc] mb-2"/>Ajoutez votre domicile, votre bureau ou toute autre adresse de livraison.</div>}
      {list.map(a => (
        <div key={a.id} className="dina-card-white p-4 flex gap-3 items-start" data-testid={`addr-${a.id}`}>
          <MapPin size={16} className="text-[#b02a2a] mt-0.5 shrink-0"/>
          <div className="flex-1 min-w-0">
            <div className="font-medium flex items-center gap-2 flex-wrap">{a.label || "Adresse"} {a.default && <span className="text-[10px] uppercase bg-[#1f8a4c] text-white px-1.5 py-0.5 rounded">Par défaut</span>}{a.lat ? <span className="text-[10px] text-[#1f8a4c]">● GPS</span> : null}</div>
            <div className="text-sm text-[#666] break-words">{addressLine(a)}</div>
            <div className="text-xs text-[#999]">{a.zone}</div>
            {!a.default && <button onClick={() => makeDefault(a)} className="text-xs text-[#b02a2a] underline mt-1" data-testid={`addr-make-default-${a.id}`}>Définir par défaut</button>}
          </div>
          <button onClick={()=>setEditing(a)} className="text-[#666] p-1" data-testid={`addr-edit-${a.id}`}><Pencil size={14}/></button>
          <button onClick={()=>del(a.id)} className="text-[#c62828] p-1" data-testid={`addr-delete-${a.id}`}><X size={14}/></button>
        </div>
      ))}
      {editing && <AddressModal initial={editing} onClose={()=>setEditing(null)} onSave={save}/>}
    </div>
  );
}

/* -------- Notifications (in-app feed + push opt-in) -------- */
function NotifWatcher() {
  const last = useRef(null);
  useEffect(() => {
    const tick = () => api.get("/public/account/notifications").then(r => {
      const top = r.data.items?.[0];
      if (last.current && top && top.id !== last.current && !top.read) { playChime(top.type === "message" ? "message" : "notif"); toast(top.title, { description: top.msg }); }
      last.current = top?.id || "none";
    }).catch(() => {});
    tick(); const t = setInterval(tick, 20000);
    if (pushGranted()) enablePush("/public/account/push/subscribe", true).catch(() => {});
    return () => clearInterval(t);
  }, []);
  return null;
}

function NotificationsPage() {
  const nav = useNavigate();
  const [d, setD] = useState({ items: [], unread: 0 });
  const [pushOn, setPushOn] = useState(pushGranted());
  useEffect(() => { api.get("/public/account/notifications").then(r => { setD(r.data); if (r.data.unread) api.post("/public/account/notifications/read").catch(() => {}); }).catch(() => {}); }, []);
  const activate = async () => { const r = await enablePush("/public/account/push/subscribe").catch(() => ({ ok: false })); if (r.ok) { setPushOn(true); toast.success("Notifications activées sur cet appareil"); } else toast.error(pushErrorText(r.reason)); };
  return (
    <div className="space-y-3" data-testid="notifications-page">
      <div className="dina-card-white p-4 flex items-center gap-3 flex-wrap">
        <Bell size={18} className="text-[#b02a2a]"/>
        <div className="flex-1 min-w-[180px] text-sm">{pushOn ? "Notifications activées sur cet appareil." : "Recevez une alerte sur votre téléphone : réponse du livreur ou de la boutique, avancement de votre commande."}</div>
        {!pushOn && <button onClick={activate} className="dina-btn-primary !min-h-[36px] text-xs" data-testid="push-enable">Activer</button>}
      </div>
      {d.items.length === 0 ? <div className="dina-card-white p-8 text-center text-sm text-[#666]" data-testid="notifications-empty">Aucune notification pour le moment</div> : d.items.map(n => (
        <button key={n.id} onClick={() => n.link && nav(n.link)} className={`dina-card-white p-4 w-full text-left flex gap-3 ${n.read ? "" : "border-l-4 !border-l-[#b02a2a]"}`} data-testid={`notification-${n.id}`}>
          <div className="flex-1 min-w-0"><div className="font-semibold text-sm">{n.title}</div><div className="text-sm text-[#666] break-words">{n.msg}</div></div>
          <div className="text-[10px] text-[#999] shrink-0">{dateFmt(n.at)}</div>
        </button>
      ))}
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
