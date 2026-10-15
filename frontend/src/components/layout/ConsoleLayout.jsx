import React, { useEffect, useState, useRef } from "react";
import { Outlet, NavLink, useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";
import {
  LayoutDashboard, ShoppingCart, Package, Truck, Boxes, Users, Megaphone, FileText, Wallet, BarChart3, UserCog,
  Sparkles, Plug, Settings as Cog, Bell, Moon, Sun, LogOut, Store, Wifi, WifiOff, Search, Receipt, Gift, Star,
  X, ShoppingBag, Globe, MessageSquare, Send, ChevronDown, ChevronRight, ChevronLeft, Plus, Minimize2, Maximize2, Target,
  TrendingUp, Palette, FileCode, Menu, Shield, Database, ClipboardList, MapPin, Tag, Layers, Hourglass, Heart,
  Building2, UserCheck, BookOpen, Calendar, GraduationCap, HelpCircle, CheckCircle2, PanelLeftClose, PanelLeftOpen, Clock
} from "lucide-react";
import ErrorBoundary from "@/components/ErrorBoundary";
import HelpButton from "@/components/console/HelpButton";
import GuidedTour from "@/components/console/GuidedTour";
import AttendancePunchModal from "@/components/shared/AttendancePunchModal";
import { canAccess, landingFor } from "@/lib/rbac";
import { playChime, soundEnabled, setSoundEnabled } from "@/lib/notifySound";
import { enablePush, pushErrorText, pushGranted } from "@/lib/push";
import { toast } from "sonner";
import { Volume2, VolumeX } from "lucide-react";

const SECTIONS = [
  { label: "", items: [
    { to: "/console", icon: LayoutDashboard, label: "Tableau de bord", end: true },
  ]},
  { label: "Ventes", items: [
    { to: "/console/pos", icon: ShoppingCart, label: "Caisse" },
    { to: "/console/commandes", icon: Receipt, label: "Commandes" },
    { to: "/console/preparation", icon: Package, label: "Préparation" },
    { to: "/console/sessions-caisse", icon: ClipboardList, label: "Sessions de caisse" },
    { to: "/console/liste-attente", icon: Hourglass, label: "Liste d'attente" },
    { to: "/console/paniers-abandonnes", icon: ShoppingCart, label: "Paniers abandonnés" },
  ]},
  { label: "Livraison", items: [
    { to: "/console/livraisons", icon: Truck, label: "Journées de livraison" },
    { to: "/console/livreurs", icon: UserCheck, label: "Livreurs" },
    { to: "/console/zones", icon: MapPin, label: "Zones & tarifs" },
  ]},
  { label: "Produits & achats", items: [
    { to: "/console/produits", icon: Package, label: "Produits" },
    { to: "/console/marques", icon: Tag, label: "Marques" },
    { to: "/console/categories", icon: Layers, label: "Catégories & collections" },
    { to: "/console/fournisseurs", icon: Building2, label: "Fournisseurs" },
    { to: "/console/achats", icon: ShoppingBag, label: "Approvisionnements" },
    { to: "/console/stock", icon: Boxes, label: "Stock & inventaires" },
  ]},
  { label: "Clients & marketing", items: [
    { to: "/console/clients", icon: Users, label: "Clients" },
    { to: "/console/messagerie", icon: MessageSquare, label: "Messagerie" },
    { to: "/console/segments", icon: Target, label: "Segments & campagnes" },
    { to: "/console/promotions", icon: Megaphone, label: "Promotions" },
    { to: "/console/fidelite", icon: Gift, label: "Fidélité" },
    { to: "/console/parrainage", icon: Heart, label: "Parrainage" },
    { to: "/console/avis", icon: Star, label: "Avis clients" },
  ]},
  { label: "Équipe", items: [
    { to: "/console/equipe", icon: UserCog, label: "Employés" },
    { to: "/console/roles", icon: Shield, label: "Rôles & permissions", adminOnly: true },
    { to: "/console/approbations", icon: CheckCircle2, label: "À approuver", adminOnly: true },
    { to: "/console/audit", icon: ClipboardList, label: "Journal d'audit", adminOnly: true },
    { to: "/console/pointage", icon: Calendar, label: "Pointage (kiosk)" },
    { to: "/console/presence", icon: UserCheck, label: "Historique pointages" },
  ]},
  { label: "Site vitrine", items: [
    { to: "/console/site?tab=apparence", icon: Palette, label: "Apparence" },
    { to: "/console/site?tab=accueil", icon: LayoutDashboard, label: "Accueil" },
    { to: "/console/site?tab=pages", icon: BookOpen, label: "Pages & navigation" },
    { to: "/console/site?tab=seo", icon: Target, label: "SEO & partage" },
    { to: "/console/site?tab=apercu", icon: Globe, label: "Aperçu" },
  ]},
  { label: "App Livreur", items: [
    { to: "/console/livreur-app?tab=identite", icon: Palette, label: "Identité" },
    { to: "/console/livreur-app?tab=onglets",  icon: LayoutDashboard, label: "Onglets" },
    { to: "/console/livreur-app?tab=annonces", icon: Megaphone, label: "Annonces" },
    { to: "/console/livreur-app?tab=aide",     icon: BookOpen, label: "Aide" },
    { to: "/console/livreur-app?tab=apercu",   icon: Globe, label: "Aperçu" },
  ]},
  { label: "Pilotage", items: [
    { to: "/console/statistiques", icon: BarChart3, label: "Statistiques" },
    { to: "/console/finances", icon: Wallet, label: "Finances" },
  ]},
  { label: "", adminOnly: false, items: [
    { to: "/console/parametres", icon: Cog, label: "Paramètres", adminOnly: true },
    { to: "/console/manuel", icon: GraduationCap, label: "Manuel d'utilisation" },
  ]},
];

const QUICK_ACTIONS = [
  { label: "Nouvelle vente", to: "/console/pos", icon: ShoppingCart },
  { label: "Nouvelle commande", to: "/console/commandes?new=1", icon: Receipt },
  { label: "Nouveau produit", to: "/console/produits?new=1", icon: Package },
  { label: "Nouvel approvisionnement", to: "/console/achats?new=1", icon: ShoppingBag },
  { label: "Nouvelle dépense", to: "/console/depenses?new=1", icon: Wallet },
  { label: "Nouvelle cliente", to: "/console/clients?new=1", icon: Users },
];

const CHIPS_BY_PAGE = {
  "/console": ["CA cette semaine ?", "Résumé du jour", "Clientes inactives ?", "Pointures en rupture ?"],
  "/console/produits": ["Top produits ce mois", "Produits jamais vendus", "Marge moyenne du catalogue"],
  "/console/stock": ["Quelles pointures racheter ?", "Produits en rupture", "Stock dormant"],
  "/console/commandes": ["Taux d'annulation ce mois", "Commandes en retard", "Panier moyen"],
  "/console/livraisons": ["Livreur avec plus d'annulations", "Zones les plus livrées", "Écarts de caisse"],
  "/console/clients": ["Clientes inactives", "Top clientes du mois", "Nouvelles clientes cette semaine"],
  "/console/promotions": ["Promotions les plus utilisées", "CA généré par les codes"],
  "default": ["CA cette semaine ?", "Top 5 produits", "Résumé du jour", "Clientes inactives ?"],
};

export default function ConsoleLayout() {
  const { user, logout } = useAuth();
  const { theme, setTheme, online } = useApp();
  const [site, setSite] = useState({});
  useEffect(() => { api.get("/public/site").then(r => setSite(r.data || {})).catch(() => {}); }, []);
  const logo = site.logo;
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [showNotif, setShowNotif] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [soundOn, setSoundOn] = useState(soundEnabled());
  const prevUnread = useRef(null);
  const seenNotifs = useRef(null);
  const toggleSound = () => { const n = !soundOn; setSoundOn(n); setSoundEnabled(n); if (n) playChime("notif", true); };
  const { pathname: unreadPath } = useLocation();
  useEffect(() => {
    const f = () => api.get("/orders-messages/unread").then(r => {
      const c = r.data?.count || 0;
      if (prevUnread.current !== null && c > prevUnread.current) playChime("message");
      prevUnread.current = c; setUnreadMsgs(c);
    }).catch(() => {});
    f(); const t = setInterval(f, 20000);
    window.addEventListener("dina:unread-refresh", f);
    return () => { clearInterval(t); window.removeEventListener("dina:unread-refresh", f); };
  }, [unreadPath]);
  const [readIds, setReadIds] = useState(() => new Set(JSON.parse(localStorage.getItem("dina_read_notifs") || "[]")));
  const [openSections, setOpenSections] = useState(() => {
    const saved = JSON.parse(localStorage.getItem("dina_sidebar_open") || "null");
    return saved || Object.fromEntries(SECTIONS.map(s => [s.label, true]));
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("dina_sidebar_collapsed") === "1");
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const v = parseInt(localStorage.getItem("dina_sidebar_width") || "260", 10);
    return Number.isFinite(v) && v >= 200 && v <= 400 ? v : 260;
  });
  const resizingRef = useRef(false);
  const [showAi, setShowAi] = useState(false);
  const [aiMinimized, setAiMinimized] = useState(false);
  const [aiMsgs, setAiMsgs] = useState(() => JSON.parse(sessionStorage.getItem("dina_ai_history") || "[]"));
  const [showPunch, setShowPunch] = useState(false);
  const [punchStatus, setPunchStatus] = useState(null);
  const [attendanceCfg, setAttendanceCfg] = useState({ enabled: true, enabled_roles: null });
  const nav = useNavigate();
  const { pathname } = useLocation();
  const unreadCount = notifs.filter(n => !readIds.has(n.id)).length;

  // RBAC — redirect user away from forbidden pages
  useEffect(() => {
    if (!user?.role) return;
    if (!canAccess(user.role, pathname)) {
      const dest = landingFor(user.role);
      if (dest !== pathname) nav(dest, { replace: true });
    }
  }, [pathname, user?.role, nav]);

  // Attendance status + config for topbar badge — refetch on route change so saves in Settings propagate
  useEffect(() => {
    const fetchStatus = () => api.get("/attendance/me").then(r => setPunchStatus(r.data)).catch(() => {});
    const fetchCfg = () => api.get("/business").then(r => {
      const cfg = r.data?.attendance_config || { enabled: true, enabled_roles: null };
      setAttendanceCfg(cfg);
    }).catch(() => {});
    fetchStatus(); fetchCfg();
    const t = setInterval(fetchStatus, 60000);
    const onCfg = () => fetchCfg();
    window.addEventListener("attendance-config-changed", onCfg);
    return () => { clearInterval(t); window.removeEventListener("attendance-config-changed", onCfg); };
  }, [pathname]);

  const punchAllowed = attendanceCfg.enabled !== false && (user?.role === "admin" ? attendanceCfg.enabled !== false : (!Array.isArray(attendanceCfg.enabled_roles) || attendanceCfg.enabled_roles.includes(user?.role)));

  useEffect(() => { localStorage.setItem("dina_sidebar_open", JSON.stringify(openSections)); }, [openSections]);
  useEffect(() => { localStorage.setItem("dina_sidebar_collapsed", collapsed ? "1" : "0"); }, [collapsed]);
  useEffect(() => { localStorage.setItem("dina_sidebar_width", String(sidebarWidth)); }, [sidebarWidth]);
  useEffect(() => {
    const onMove = (e) => {
      if (!resizingRef.current) return;
      const w = Math.min(400, Math.max(200, e.clientX));
      setSidebarWidth(w);
    };
    const onUp = () => { if (resizingRef.current) { resizingRef.current = false; document.body.style.cursor = ""; document.body.style.userSelect = ""; } };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);
  useEffect(() => { sessionStorage.setItem("dina_ai_history", JSON.stringify(aiMsgs.slice(-30))); }, [aiMsgs]);
  useEffect(() => {
    const fetchNotifs = () => api.get("/notifications").then(r => {
      const list = r.data || [];
      const ids = new Set(list.map(n => n.id));
      if (seenNotifs.current) {
        const fresh = list.filter(n => !seenNotifs.current.has(n.id));
        if (fresh.length) playChime(fresh.some(n => n.type === "order_message") ? "message" : fresh.some(n => n.type === "order") ? "order" : "notif");
      }
      seenNotifs.current = ids; setNotifs(list);
    }).catch(()=>{});
    fetchNotifs(); const t = setInterval(fetchNotifs, 30000); return () => clearInterval(t);
  }, []);
  useEffect(() => {
    api.get("/public/site").then(r => setSite(r.data || {})).catch(() => setSite({}));
  }, []);
  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); document.querySelector('[data-testid="global-search"]')?.focus(); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);

  const doSearch = async (v) => {
    setSearch(v);
    if (v.length < 2) { setSearchResults(null); return; }
    try {
      const [p, o, c] = await Promise.all([api.get(`/products?q=${encodeURIComponent(v)}`), api.get(`/orders?q=${encodeURIComponent(v)}`), api.get(`/customers?q=${encodeURIComponent(v)}`)]);
      setSearchResults({ products: p.data.slice(0,4), orders: o.data.slice(0,4), customers: c.data.slice(0,4) });
    } catch { setSearchResults(null); }
  };
  const go = (path) => { setSearchResults(null); setSearch(""); nav(path); };
  const toggleSection = (label) => setOpenSections(s => ({ ...s, [label]: !s[label] }));
  const markAllRead = () => { const all = new Set([...readIds, ...notifs.map(n=>n.id)]); setReadIds(all); localStorage.setItem("dina_read_notifs", JSON.stringify([...all])); };
  const openNotif = (n) => { const next = new Set(readIds); next.add(n.id); setReadIds(next); localStorage.setItem("dina_read_notifs", JSON.stringify([...next])); setShowNotif(false); if (n.link) nav(n.link); };
  const timeAgo = (iso) => { if (!iso) return ""; const d = (new Date()-new Date(iso))/1000; return d<60?"à l'instant":d<3600?`il y a ${Math.floor(d/60)} min`:d<86400?`il y a ${Math.floor(d/3600)} h`:`il y a ${Math.floor(d/86400)} j`; };
  const isAdmin = user?.role === "admin";

  const effectiveWidth = collapsed ? 72 : sidebarWidth;
  const startResize = (e) => { if (collapsed) return; e.preventDefault(); resizingRef.current = true; document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; };
  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  return (
    <div className="min-h-screen flex bg-[#f5f5f5] dark:bg-[#0f0f0f]">
      {/* Mobile drawer overlay */}
      {mobileOpen && <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} data-testid="sidebar-mobile-overlay"/>}
      <aside style={{ width: Math.min(effectiveWidth, typeof window !== "undefined" ? window.innerWidth * 0.85 : effectiveWidth) }} className={`shrink-0 bg-[#1c1c1c] text-white flex flex-col h-screen transition-[width,transform] duration-150 lg:sticky lg:top-0 lg:translate-x-0 fixed inset-y-0 left-0 z-50 ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`} data-testid="console-sidebar" data-collapsed={collapsed ? "1" : "0"}>
        <div className={`${collapsed ? "px-2 py-4" : "px-5 py-5"} border-b border-[#2a2a2a] flex items-center ${collapsed ? "justify-center" : "justify-between gap-2"}`}>
          {!collapsed ? (
            <div className="flex items-center gap-2 min-w-0">
              {logo ? <img src={logo} alt="" className="w-9 h-9 rounded-full object-cover bg-white shrink-0"/> : <div className="w-9 h-9 rounded-full bg-[#fde8e8] grid place-items-center font-serif text-[#b02a2a] font-bold text-sm shrink-0">CD</div>}
              <div className="min-w-0"><div className="font-serif text-xl tracking-tight truncate">{site.name || "Chez Dina"}</div><div className="text-[10px] uppercase tracking-widest text-[#999]">console</div></div>
            </div>
          ) : (
            logo ? <img src={logo} alt="" className="w-9 h-9 rounded-full object-cover bg-white"/> : <div className="w-9 h-9 rounded-full bg-[#fde8e8] grid place-items-center font-serif text-[#b02a2a] font-bold text-sm">CD</div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="text-[#999] hover:text-white p-1 rounded hover:bg-[#2a2a2a] shrink-0"
            title={collapsed ? "Déplier" : "Réduire"}
            data-testid="sidebar-collapse-toggle"
          >
            {collapsed ? <PanelLeftOpen size={16}/> : <PanelLeftClose size={16}/>}
          </button>
        </div>
        {!collapsed && (
          <div className="px-5 pt-3">
            <a href="/boutique" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-[#b02a2a] hover:text-white" data-testid="view-storefront-link"><Store size={12}/>Voir le site vitrine →</a>
          </div>
        )}
        <nav className={`flex-1 overflow-y-auto scrollbar-thin ${collapsed ? "px-1" : "px-2"} py-3`}>
          {SECTIONS.filter(s => !s.adminOnly || isAdmin).map((sec) => {
            const open = openSections[sec.label] !== false;
            const items = sec.items
              .filter(it => !it.adminOnly || isAdmin)
              .filter(it => canAccess(user?.role, it.to));
            if (items.length === 0) return null;
            return (
              <div key={sec.label || `top-${items[0]?.to}`} className="mb-1">
                {sec.label && !collapsed ? (
                  <button onClick={()=>toggleSection(sec.label)} className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold text-[#999] uppercase tracking-wider hover:text-white" data-testid={`sidebar-section-${sec.label}`}>
                    <span>{sec.label}</span>
                    {open ? <ChevronDown size={10}/> : <ChevronRight size={10}/>}
                  </button>
                ) : (sec.label && collapsed ? <div className="h-px bg-[#2a2a2a] my-1 mx-2"/> : null)}
                {(!sec.label || open || collapsed) && items.map(({to, icon:Icon, label, end}) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    title={collapsed ? label : undefined}
                    className={({isActive}) => `dina-sidebar-link ${isActive?"active":""} ${collapsed ? "!justify-center !px-2" : ""}`}
                    data-testid={`nav-${label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/&/g,"et").replace(/\s+/g,"-").replace(/[^\w-]/g,"")}`}
                  >
                    <Icon size={14}/>
                    {!collapsed && <span className="truncate">{label}</span>}
                    {to === "/console/commandes" && unreadMsgs > 0 && <span className={`${collapsed ? "absolute top-1 right-1 w-2 h-2 p-0" : "ml-auto px-1.5 min-w-[18px]"} bg-[#e53935] text-white text-[10px] font-bold rounded-full text-center leading-[18px]`} title={`${unreadMsgs} message(s) non lu(s)`} data-testid="nav-orders-unread">{collapsed ? "" : unreadMsgs}</span>}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        {!collapsed && (
          <div
            onMouseDown={startResize}
            className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-[#b02a2a]/50 active:bg-[#b02a2a] z-10 group"
            title="Redimensionner"
            data-testid="sidebar-resize-handle"
          >
            <div className="h-full w-px bg-[#2a2a2a] group-hover:bg-[#b02a2a] mx-auto"/>
          </div>
        )}
        <div className={`${collapsed ? "px-2" : "px-4"} py-3 border-t border-[#2a2a2a] text-xs`}>
          <button onClick={()=>setShowUserMenu(!showUserMenu)} className={`w-full flex items-center ${collapsed ? "justify-center" : "gap-3"} hover:bg-[#2a2a2a] rounded-lg p-2 transition`} data-testid="user-menu-trigger" title={collapsed ? user?.name : undefined}>
            <div className="w-9 h-9 rounded-full bg-[#b02a2a] text-white font-semibold grid place-items-center shrink-0">{(user?.name||"?").slice(0,1)}</div>
            {!collapsed && <>
              <div className="min-w-0 flex-1 text-left"><div className="truncate text-sm font-medium">{user?.name}</div><div className="text-[#999] capitalize">{user?.role}</div></div>
              <ChevronRight size={12} className="text-[#999]"/>
            </>}
          </button>
          {showUserMenu && (
            <div className="mt-2 bg-[#2a2a2a] rounded-lg p-1 space-y-0.5" data-testid="user-menu">
              <button onClick={()=>{setTheme(theme==="light"?"dark":"light"); setShowUserMenu(false);}} className="w-full text-left px-3 py-2 text-xs rounded hover:bg-[#333] flex items-center gap-2" data-testid="menu-theme">{theme==="light"?<Moon size={12}/>:<Sun size={12}/>}Mode {theme==="light"?"sombre":"clair"}</button>
              <button onClick={()=>{nav("/login"); setShowUserMenu(false);}} className="w-full text-left px-3 py-2 text-xs rounded hover:bg-[#333] flex items-center gap-2" data-testid="menu-switch">↻ Changer d'utilisateur</button>
              <button onClick={async()=>{await logout(); nav("/login");}} className="w-full text-left px-3 py-2 text-xs rounded hover:bg-[#333] flex items-center gap-2 text-[#ff6b6b]" data-testid="logout-button"><LogOut size={12}/>Déconnexion</button>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white dark:bg-[#1a1a1a] border-b border-[#ececec] dark:border-[#2a2a2a] px-3 md:px-5 flex items-center gap-2 md:gap-3 sticky top-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 -ml-1 text-[#1c1c1c] dark:text-white hover:bg-[#fff5f5] dark:hover:bg-[#2a1818] rounded-lg"
            aria-label="Ouvrir le menu"
            data-testid="mobile-menu-toggle"
          >
            <Menu size={20}/>
          </button>
          <div className="flex items-center gap-2 min-w-0">
            {logo ? <img src={logo} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0"/> : <div className="w-9 h-9 rounded-lg bg-[#fde8e8] dark:bg-[#2a1818] grid place-items-center font-serif text-[#b02a2a] font-bold text-sm shrink-0">CD</div>}
            <div className="font-serif text-lg leading-none hidden sm:block"><span className="truncate block max-w-[180px]">{site.name || "Chez Dina"}</span><span className="block text-[10px] text-[#999] tracking-widest uppercase mt-0.5">Console</span></div>
          </div>
          <div className="flex-1 min-w-0 max-w-xl mx-1 md:mx-4 relative">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]"/>
              <input className="dina-input pl-9 pr-16" placeholder="Rechercher produits, variantes, clientes, commandes…" value={search} onChange={(e)=>doSearch(e.target.value)} data-testid="global-search"/>
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center text-[10px] text-[#999] border border-[#ececec] dark:border-[#2a2a2a] rounded px-1.5 py-0.5">Ctrl+K</kbd>
            </div>
            {searchResults && (
              <div className="absolute top-11 left-0 right-0 bg-white dark:bg-[#1a1a1a] border border-[#ececec] dark:border-[#2a2a2a] rounded-xl shadow-lg p-2 max-h-96 overflow-y-auto scrollbar-thin z-40" data-testid="search-results">
                {searchResults.products.length>0 && <><div className="text-[10px] font-semibold uppercase text-[#999] px-2 pt-1">Produits</div>{searchResults.products.map(p=><button key={p.id} onClick={()=>go("/console/produits")} className="w-full text-left px-2 py-1.5 flex items-center gap-2 rounded hover:bg-[#fff5f5] dark:hover:bg-[#2a1818]"><div className="w-8 h-8 rounded bg-[#fff5f5] dark:bg-[#2a1818] overflow-hidden"><img src={p.image} alt="" className="w-full h-full object-cover"/></div><div className="flex-1 text-sm"><div className="font-medium">{p.name}</div><div className="text-[11px] text-[#666]">{p.sku}</div></div></button>)}</>}
                {searchResults.orders.length>0 && <><div className="text-[10px] font-semibold uppercase text-[#999] px-2 pt-2">Commandes</div>{searchResults.orders.map(o=><button key={o.id} onClick={()=>go("/console/commandes")} className="w-full text-left px-2 py-1.5 rounded hover:bg-[#fff5f5] dark:hover:bg-[#2a1818] text-sm"><span className="font-medium">{o.code}</span> · <span className="text-[#666]">{o.customer?.name}</span></button>)}</>}
                {searchResults.customers.length>0 && <><div className="text-[10px] font-semibold uppercase text-[#999] px-2 pt-2">Clientes</div>{searchResults.customers.map(c=><button key={c.id} onClick={()=>go("/console/clients")} className="w-full text-left px-2 py-1.5 rounded hover:bg-[#fff5f5] dark:hover:bg-[#2a1818] text-sm"><span className="font-medium">{c.name}</span> · <span className="text-[#666]">{c.phone}</span></button>)}</>}
                {!searchResults.products.length && !searchResults.orders.length && !searchResults.customers.length && <div className="text-sm text-[#666] px-3 py-2">Aucun résultat</div>}
              </div>
            )}
          </div>

          {/* Quick actions "+" */}
          <div className="relative hidden sm:block">
            <button onClick={()=>setShowQuickActions(!showQuickActions)} className="dina-chip !bg-[#b02a2a] !text-white !border-[#b02a2a]" data-testid="quick-actions-trigger"><Plus size={13}/>Créer</button>
            {showQuickActions && (
              <div className="absolute right-0 top-10 w-56 bg-white dark:bg-[#1a1a1a] border border-[#ececec] dark:border-[#2a2a2a] rounded-xl shadow-xl p-1.5 z-40" data-testid="quick-actions-menu" onMouseLeave={()=>setShowQuickActions(false)}>
                {QUICK_ACTIONS.map(a => (
                  <Link key={a.to} to={a.to} onClick={()=>setShowQuickActions(false)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded hover:bg-[#fff5f5] dark:hover:bg-[#2a1818] text-sm" data-testid={`qa-${a.label.toLowerCase().replace(/\s+/g,"-")}`}>
                    <a.icon size={14} className="text-[#b02a2a]"/>{a.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className={`dina-chip hidden md:inline-flex ${online?"":"!border-[#c62828] !text-[#c62828]"}`} data-testid="sync-indicator">
            {online ? <><Wifi size={12}/>En ligne</> : <><WifiOff size={12}/>Hors ligne</>}
          </div>
          <div className="hidden md:inline-flex"><HelpButton/></div>
          {punchAllowed && (
            <button
              onClick={() => setShowPunch(true)}
              className={`dina-chip ${punchStatus?.checked_in && !punchStatus?.departure ? "!border-[#1f8a4c] !text-[#1f8a4c]" : punchStatus?.departure ? "!border-[#999] !text-[#999]" : "!border-[#b02a2a] !text-[#b02a2a]"}`}
              data-testid="topbar-punch"
              title={punchStatus?.departure ? "Journée terminée" : punchStatus?.checked_in ? "Pointer le départ" : "Pointer l'arrivée"}
            >
              <Clock size={12}/><span className="hidden sm:inline">{punchStatus?.departure ? "Terminé" : punchStatus?.checked_in ? "Pointé" : "Pointer"}</span>
            </button>
          )}
          <button onClick={()=>setTheme(theme==="light"?"dark":"light")} className="dina-chip hidden md:inline-flex" data-testid="theme-toggle" title={theme==="light"?"Mode sombre":"Mode clair"}>{theme==="light"?<Moon size={12}/>:<Sun size={12}/>}</button>
          <button onClick={toggleSound} className="dina-chip hidden md:inline-flex" data-testid="sound-toggle" title={soundOn ? "Couper les sons" : "Activer les sons"}>{soundOn ? <Volume2 size={12}/> : <VolumeX size={12}/>}</button>
          <div className="relative">
            <button onClick={()=>setShowNotif(!showNotif)} className="dina-chip relative" data-testid="notifications-button">
              <Bell size={12}/>{unreadCount>0 && <span className="absolute -top-1 -right-1 bg-[#c62828] text-white text-[9px] rounded-full min-w-[16px] h-4 px-1 grid place-items-center font-bold">{unreadCount}</span>}
            </button>
            {showNotif && (
              <div className="absolute right-0 top-9 w-96 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-[#1a1a1a] border border-[#ececec] dark:border-[#2a2a2a] rounded-xl shadow-xl p-2 z-40 max-h-[70vh] overflow-y-auto scrollbar-thin" data-testid="notifications-panel">
                <div className="flex justify-between items-center px-2 py-1 mb-1 sticky top-0 bg-white dark:bg-[#1a1a1a]">
                  <span className="font-semibold text-sm">Notifications{notifs.length>0 && <span className="text-xs text-[#666] font-normal ml-1">({notifs.length})</span>}</span>
                  <div className="flex items-center gap-2">{unreadCount>0 && <button onClick={markAllRead} className="text-xs text-[#b02a2a] hover:underline" data-testid="notifs-mark-read">Tout lu</button>}<button onClick={()=>setShowNotif(false)}><X size={14}/></button></div>
                </div>
                {!pushGranted() && <button onClick={async () => { const r = await enablePush("/push/subscribe").catch(() => ({ ok: false })); if (r.ok) toast.success("Notifications push activées sur cet appareil"); else toast.error(pushErrorText(r.reason)); }} className="w-full text-xs mb-2 py-2 rounded-lg bg-[#fff5f5] text-[#b02a2a] font-semibold" data-testid="console-push-enable">Activer les notifications push sur cet appareil</button>}
                {notifs.length===0 ? <div className="text-sm text-[#666] text-center py-6">Aucune notification 🎉</div> : notifs.map(n => {
                  const unread = !readIds.has(n.id);
                  return (
                    <button key={n.id} onClick={()=>openNotif(n)} className={`w-full text-left p-2.5 rounded-lg hover:bg-[#fff5f5] dark:hover:bg-[#2a1818] block ${unread?"bg-[#fff5f5]/50 dark:bg-[#141414]":""}`} data-testid={`notif-${n.type}`}>
                      <div className="flex items-start gap-2"><span className="status-dot mt-1.5" style={{background:n.color}}/>
                      <div className="flex-1 min-w-0"><div className="text-sm font-medium flex items-center gap-1">{n.title}{unread && <span className="w-1.5 h-1.5 rounded-full bg-[#b02a2a]"/>}</div><div className="text-xs text-[#666] truncate">{n.msg}</div><div className="text-[10px] text-[#999] mt-0.5">{timeAgo(n.at)}</div></div></div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </header>
        <div className="p-3 sm:p-4 lg:p-6 flex-1 min-w-0"><ErrorBoundary><Outlet /></ErrorBoundary></div>
      </main>
      <GuidedTour/>

      {/* Floating AI assistant — hidden on POS (would cover "Encaisser") */}
      {!showAi && pathname !== "/console/pos" && (
        <button onClick={()=>{setShowAi(true); setAiMinimized(false);}} className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#b02a2a] text-white grid place-items-center shadow-xl hover:bg-[#8e1f1f] transition z-40 group" data-testid="ai-floating-button">
          <Sparkles size={22}/>
          {aiMsgs.length>0 && <span className="absolute -top-1 -right-1 bg-[#f4b12c] text-[#1c1c1c] text-[9px] rounded-full min-w-[16px] h-4 px-1 grid place-items-center font-bold">{aiMsgs.filter(m=>m.role==="bot").length}</span>}
        </button>
      )}
      {showAi && aiMinimized && pathname !== "/console/pos" && (
        <button onClick={()=>setAiMinimized(false)} className="fixed bottom-6 right-6 bg-[#b02a2a] text-white rounded-full px-4 py-2.5 shadow-xl flex items-center gap-2 z-40" data-testid="ai-restore">
          <Sparkles size={14}/><span className="text-sm">Dina IA</span><Maximize2 size={12}/>
        </button>
      )}
      {showAi && !aiMinimized && (
        <AiChat page={pathname} msgs={aiMsgs} setMsgs={setAiMsgs} onMinimize={()=>setAiMinimized(true)} onClose={()=>{setShowAi(false); setAiMinimized(false);}}/>
      )}

      <AttendancePunchModal
        open={showPunch}
        onClose={() => setShowPunch(false)}
        onDone={(data) => { api.get("/attendance/me").then(r => setPunchStatus(r.data)).catch(() => {}); }}
      />
    </div>
  );
}

function AiChat({ page, msgs, setMsgs, onMinimize, onClose }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const chips = CHIPS_BY_PAGE[page] || CHIPS_BY_PAGE.default;
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs, loading]);

  const ask = async (text) => {
    const t = text ?? q; if (!t.trim()) return;
    setMsgs(m=>[...m,{role:"user",text:t,at:Date.now()}]); setQ(""); setLoading(true);
    try { const { data } = await api.post("/ai/ask", { question: t, page }); setMsgs(m=>[...m,{role:"bot",text:data.answer,source:data.source,error:data.error,at:Date.now()}]); }
    catch { setMsgs(m=>[...m,{role:"bot",text:"Je n'arrive pas à répondre maintenant. Réessayez dans un instant.",error:true,at:Date.now()}]); }
    setLoading(false);
  };
  const clear = () => { setMsgs([]); sessionStorage.removeItem("dina_ai_history"); };

  return (
    <div className="fixed bottom-6 right-6 w-[400px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[85vh] bg-white dark:bg-[#1a1a1a] border border-[#ececec] dark:border-[#2a2a2a] rounded-2xl shadow-2xl flex flex-col z-50" data-testid="ai-chat-panel">
      <div className="flex items-center justify-between p-4 border-b border-[#ececec] dark:border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#b02a2a] to-[#e4991e] text-white grid place-items-center"><Sparkles size={15}/></div>
          <div>
            <div className="font-serif text-base">Dina IA</div>
            <div className="text-[10px] text-[#1f8a4c]">● En ligne · contexte : {page.replace("/console","") || "/accueil"}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {msgs.length>0 && <button onClick={clear} title="Nouvelle conversation" className="text-[#999] hover:text-[#1c1c1c] p-1" data-testid="ai-new"><Plus size={14}/></button>}
          <button onClick={onMinimize} title="Réduire" className="text-[#999] hover:text-[#1c1c1c] p-1" data-testid="ai-minimize"><Minimize2 size={14}/></button>
          <button onClick={onClose} title="Fermer" className="text-[#999] hover:text-[#1c1c1c] p-1" data-testid="ai-close"><X size={14}/></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
        {msgs.length === 0 && (
          <div className="text-center py-6 text-sm text-[#666]">
            <Sparkles size={28} className="mx-auto text-[#b02a2a] mb-2"/>
            <div className="font-serif text-lg text-[#1c1c1c] dark:text-white">Bonjour !</div>
            <div className="text-xs mt-1">Je peux consulter vos chiffres en direct, pas d'invention. Essayez une question ↓</div>
          </div>
        )}
        {msgs.map((m,i)=>(
          <div key={i} className={`flex ${m.role==="user"?"justify-end":""}`}>
            <div className={`max-w-[82%] p-2.5 rounded-xl text-sm whitespace-pre-wrap ${m.role==="user"?"bg-[#1c1c1c] dark:bg-[#333] text-white":m.error?"bg-[#fff5f5] dark:bg-[#2a1818] border border-[#c62828]/30":"bg-[#fff5f5] dark:bg-[#2a1818]"}`} data-testid={`ai-msg-${i}`}>
              <div dangerouslySetInnerHTML={{__html: m.text.replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/\n/g,"<br/>")}}/>
              {m.source && <div className="text-[9px] text-[#999] mt-1 uppercase">{m.source}</div>}
            </div>
          </div>
        ))}
        {loading && <div className="text-xs text-[#666] italic">Dina réfléchit…</div>}
        <div ref={bottomRef}/>
      </div>
      <div className="p-3 border-t border-[#ececec] dark:border-[#2a2a2a]">
        <div className="flex flex-wrap gap-1 mb-2">{chips.map(c=><button key={c} onClick={()=>ask(c)} className="text-[10px] px-2 py-1 bg-[#fff5f5] dark:bg-[#2a1818] rounded-full text-[#b02a2a] font-medium hover:bg-[#fde8e8] dark:hover:bg-[#3a1a1a]" data-testid={`ai-chip-${c.slice(0,10)}`}>{c}</button>)}</div>
        <div className="flex gap-1">
          <input className="dina-input text-sm" placeholder="Posez une question…" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!loading&&ask()} data-testid="ai-input"/>
          <button onClick={()=>ask()} disabled={loading||!q.trim()} className="dina-btn-primary !min-h-[40px] !px-3 disabled:opacity-50" data-testid="ai-send"><Send size={14}/></button>
        </div>
      </div>
    </div>
  );
}
