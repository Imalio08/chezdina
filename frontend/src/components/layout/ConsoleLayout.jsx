import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";
import { toast } from "sonner";
import { LayoutDashboard, ShoppingCart, Package, Truck, Boxes, Users, Megaphone, FileText, Wallet, BarChart3, UserCog, Sparkles, Plug, Settings as Cog, Bell, Moon, Sun, LogOut, Store, Wifi, WifiOff, Search, Receipt, Gift, Star, X, ShoppingBag, Globe, MessageSquare, Send } from "lucide-react";

const SECTIONS = [
  { label: "Pilotage", items: [
    { to: "/console", icon: LayoutDashboard, label: "Tableau de bord", end: true },
    { to: "/console/statistiques", icon: BarChart3, label: "Statistiques" },
  ]},
  { label: "Ventes", items: [
    { to: "/console/pos", icon: ShoppingCart, label: "Caisse" },
    { to: "/console/commandes", icon: Receipt, label: "Commandes" },
    { to: "/console/livraisons", icon: Truck, label: "Livraisons" },
    { to: "/console/facturation", icon: FileText, label: "Facturation" },
  ]},
  { label: "Catalogue", items: [
    { to: "/console/produits", icon: Package, label: "Produits" },
    { to: "/console/stock", icon: Boxes, label: "Stock" },
    { to: "/console/achats", icon: ShoppingBag, label: "Achats & fournisseurs" },
    { to: "/console/avis", icon: Star, label: "Avis clientes" },
  ]},
  { label: "Clientes", items: [
    { to: "/console/clients", icon: Users, label: "Clientes" },
    { to: "/console/fidelite", icon: Gift, label: "Fidélité" },
    { to: "/console/promotions", icon: Megaphone, label: "Promotions" },
    { to: "/console/alertes", icon: Bell, label: "Alertes & paniers" },
  ]},
  { label: "Gestion", items: [
    { to: "/console/depenses", icon: Wallet, label: "Dépenses" },
    { to: "/console/equipe", icon: UserCog, label: "Équipe" },
  ]},
  { label: "Configuration", items: [
    { to: "/console/site", icon: Globe, label: "Site vitrine" },
    { to: "/console/integrations", icon: Plug, label: "Intégrations" },
    { to: "/console/parametres", icon: Cog, label: "Paramètres" },
  ]},
];

export default function ConsoleLayout() {
  const { user, logout } = useAuth();
  const { theme, setTheme, online, t } = useApp();
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [showNotif, setShowNotif] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [readIds, setReadIds] = useState(() => new Set(JSON.parse(localStorage.getItem("dina_read_notifs") || "[]")));
  const unreadCount = notifs.filter(n => !readIds.has(n.id)).length;
  useEffect(() => {
    const fetchNotifs = () => api.get("/notifications").then(r => setNotifs(r.data || [])).catch(()=>{});
    fetchNotifs();
    const t = setInterval(fetchNotifs, 30000);
    return () => clearInterval(t);
  }, []);
  const markAllRead = () => {
    const all = new Set([...readIds, ...notifs.map(n=>n.id)]);
    setReadIds(all);
    localStorage.setItem("dina_read_notifs", JSON.stringify([...all]));
  };
  const openNotif = (n) => {
    const next = new Set(readIds); next.add(n.id); setReadIds(next);
    localStorage.setItem("dina_read_notifs", JSON.stringify([...next]));
    setShowNotif(false);
    if (n.link) nav(n.link);
  };
  const timeAgo = (iso) => {
    if (!iso) return "";
    const diff = (new Date() - new Date(iso)) / 1000;
    if (diff < 60) return "à l'instant";
    if (diff < 3600) return `il y a ${Math.floor(diff/60)} min`;
    if (diff < 86400) return `il y a ${Math.floor(diff/3600)} h`;
    return `il y a ${Math.floor(diff/86400)} j`;
  };
  const [showAi, setShowAi] = useState(false);
  const nav = useNavigate();

  useEffect(() => { 
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.querySelector('[data-testid="global-search"]')?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const doSearch = async (v) => {
    setSearch(v);
    if (v.length < 2) { setSearchResults(null); return; }
    try {
      const [products, orders, customers] = await Promise.all([
        api.get(`/products?q=${encodeURIComponent(v)}`),
        api.get(`/orders?q=${encodeURIComponent(v)}`),
        api.get(`/customers?q=${encodeURIComponent(v)}`),
      ]);
      setSearchResults({
        products: products.data.slice(0, 4),
        orders: orders.data.slice(0, 4),
        customers: customers.data.slice(0, 4),
      });
    } catch { setSearchResults(null); }
  };

  const go = (path) => { setSearchResults(null); setSearch(""); nav(path); };

  return (
    <div className="min-h-screen flex bg-[#f5f5f5] dark:bg-[#0f0f0f]">
      <aside className="w-[260px] shrink-0 bg-[#1c1c1c] text-white flex flex-col sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-2"><div className="w-9 h-9 rounded-full bg-[#fde8e8] grid place-items-center font-serif text-[#b02a2a] font-bold text-sm">CD</div><div><div className="font-serif text-xl tracking-tight">Chez Dina</div><div className="text-[10px] uppercase tracking-widest text-[#999]">boutique</div></div></div>
          <a href="/boutique" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#b02a2a] hover:text-white" data-testid="view-storefront-link">
            <Store size={12}/>Voir le site vitrine →
          </a>
        </div>
        <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-1">
          {SECTIONS.map((sec) => (
            <div key={sec.label}>
              <div className="dina-sidebar-section">{sec.label}</div>
              {sec.items.map(({to, icon:Icon, label, end}) => (
                <NavLink key={to} to={to} end={end} className={({isActive}) => `dina-sidebar-link ${isActive?"active":""}`} data-testid={`nav-${label.toLowerCase().replace(/\s+/g,"-").replace(/é/g,"e").replace(/è/g,"e").replace(/&/g,"et")}`}>
                  <Icon size={15}/><span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-[#2a2a2a] text-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#b02a2a] text-white font-semibold grid place-items-center">{(user?.name||"?").slice(0,1)}</div>
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{user?.name}</div><div className="text-[#999] capitalize">{user?.role}</div></div>
            <button onClick={async()=>{await logout();nav("/login");}} className="text-[#999] hover:text-white" data-testid="logout-button"><LogOut size={16}/></button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white dark:bg-[#1a1a1a] border-b border-[#ececec] dark:border-[#2a2a2a] px-5 flex items-center gap-3 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-[#fde8e8] dark:bg-[#2a1818] grid place-items-center font-serif text-[#b02a2a] font-bold text-sm">CD</div>
            <div className="font-serif text-lg leading-none">Chez Dina<span className="block text-[10px] text-[#999] tracking-widest uppercase mt-0.5">Console</span></div>
          </div>
          <div className="flex-1 max-w-xl mx-4 relative">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]"/>
              <input className="dina-input pl-9 pr-16" placeholder="Rechercher produits, variantes, clientes, commandes…" value={search} onChange={(e)=>doSearch(e.target.value)} data-testid="global-search"/>
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center text-[10px] text-[#999] border border-[#ececec] dark:border-[#2a2a2a] rounded px-1.5 py-0.5">Ctrl+K</kbd>
            </div>
            {searchResults && (
              <div className="absolute top-11 left-0 right-0 bg-white dark:bg-[#1a1a1a] border border-[#ececec] dark:border-[#2a2a2a] rounded-xl shadow-lg p-2 max-h-96 overflow-y-auto scrollbar-thin z-40" data-testid="search-results">
                {searchResults.products.length>0 && <><div className="text-[10px] font-semibold uppercase text-[#999] px-2 pt-1">Produits</div>{searchResults.products.map(p=><button key={p.id} onClick={()=>go("/console/produits")} className="w-full text-left px-2 py-1.5 flex items-center gap-2 rounded hover:bg-[#fff5f5]"><div className="w-8 h-8 rounded bg-[#fff5f5] overflow-hidden"><img src={p.image} alt="" className="w-full h-full object-cover"/></div><div className="flex-1 text-sm"><div className="font-medium">{p.name}</div><div className="text-[11px] text-[#666]">{p.sku}</div></div></button>)}</>}
                {searchResults.orders.length>0 && <><div className="text-[10px] font-semibold uppercase text-[#999] px-2 pt-2">Commandes</div>{searchResults.orders.map(o=><button key={o.id} onClick={()=>go("/console/commandes")} className="w-full text-left px-2 py-1.5 rounded hover:bg-[#fff5f5] text-sm"><span className="font-medium">{o.code}</span> · <span className="text-[#666]">{o.customer?.name}</span></button>)}</>}
                {searchResults.customers.length>0 && <><div className="text-[10px] font-semibold uppercase text-[#999] px-2 pt-2">Clientes</div>{searchResults.customers.map(c=><button key={c.id} onClick={()=>go("/console/clients")} className="w-full text-left px-2 py-1.5 rounded hover:bg-[#fff5f5] text-sm"><span className="font-medium">{c.name}</span> · <span className="text-[#666]">{c.phone}</span></button>)}</>}
                {!searchResults.products.length && !searchResults.orders.length && !searchResults.customers.length && <div className="text-sm text-[#666] px-3 py-2">Aucun résultat</div>}
              </div>
            )}
          </div>
          <div className={`dina-chip ${online?"":"!border-[#c62828] !text-[#c62828]"}`} data-testid="sync-indicator">
            {online ? <><Wifi size={12}/>En ligne</> : <><WifiOff size={12}/>Hors ligne</>}
          </div>
          <button onClick={()=>setTheme(theme==="light"?"dark":"light")} className="dina-chip" data-testid="theme-toggle" title={theme==="light"?"Mode sombre":"Mode clair"}>{theme==="light"?<Moon size={12}/>:<Sun size={12}/>}</button>
          <div className="relative">
            <button onClick={()=>setShowNotif(!showNotif)} className="dina-chip relative" data-testid="notifications-button">
              <Bell size={12}/>{unreadCount>0 && <span className="absolute -top-1 -right-1 bg-[#c62828] text-white text-[9px] rounded-full min-w-[16px] h-4 px-1 grid place-items-center font-bold">{unreadCount}</span>}
            </button>
            {showNotif && (
              <div className="absolute right-0 top-9 w-96 bg-white dark:bg-[#1a1a1a] border border-[#ececec] dark:border-[#2a2a2a] rounded-xl shadow-xl p-2 z-40 max-h-[70vh] overflow-y-auto scrollbar-thin" data-testid="notifications-panel">
                <div className="flex justify-between items-center px-2 py-1 mb-1 sticky top-0 bg-white dark:bg-[#1a1a1a]">
                  <span className="font-semibold text-sm">Notifications{notifs.length>0 && <span className="text-xs text-[#666] font-normal ml-1">({notifs.length})</span>}</span>
                  <div className="flex items-center gap-2">
                    {unreadCount>0 && <button onClick={markAllRead} className="text-xs text-[#b02a2a] hover:underline" data-testid="notifs-mark-read">Tout lu</button>}
                    <button onClick={()=>setShowNotif(false)}><X size={14}/></button>
                  </div>
                </div>
                {notifs.length===0 ? (
                  <div className="text-sm text-[#666] text-center py-6">Aucune notification 🎉</div>
                ) : notifs.map(n => {
                  const unread = !readIds.has(n.id);
                  return (
                    <button key={n.id} onClick={()=>openNotif(n)} className={`w-full text-left p-2.5 rounded-lg hover:bg-[#fff5f5] dark:hover:bg-[#2a1818] block ${unread?"bg-[#fff5f5]/50 dark:bg-[#141414]":""}`} data-testid={`notif-${n.type}`}>
                      <div className="flex items-start gap-2">
                        <span className="status-dot mt-1.5" style={{background:n.color}}/>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium flex items-center gap-1">{n.title}{unread && <span className="w-1.5 h-1.5 rounded-full bg-[#b02a2a]"/>}</div>
                          <div className="text-xs text-[#666] truncate">{n.msg}</div>
                          <div className="text-[10px] text-[#999] mt-0.5">{timeAgo(n.at)}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </header>
        <div className="p-6 flex-1"><Outlet /></div>
      </main>

      {/* Floating AI assistant */}
      <button onClick={()=>setShowAi(true)} className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#b02a2a] text-white grid place-items-center shadow-xl hover:bg-[#8e1f1f] transition z-40" data-testid="ai-floating-button">
        <Sparkles size={22}/>
      </button>
      {showAi && <AiChat onClose={()=>setShowAi(false)}/>}
    </div>
  );
}

function AiChat({ onClose }) {
  const [msgs, setMsgs] = useState([{role:"bot", text:"Bonjour ! Posez-moi une question sur votre activité."}]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const CHIPS = ["Produit le plus rentable ce mois ?","Pointures à recommander ?","Clientes inactives ?","Résumé de la semaine"];
  const ask = async (text) => {
    const t = text ?? q; if (!t.trim()) return;
    setMsgs(m=>[...m,{role:"user",text:t}]); setQ(""); setLoading(true);
    try { const { data } = await api.post("/ai/ask",{question:t}); setMsgs(m=>[...m,{role:"bot",text:data.answer}]); }
    catch { setMsgs(m=>[...m,{role:"bot",text:"Impossible pour le moment."}]); }
    setLoading(false);
  };
  return (
    <div className="fixed bottom-6 right-6 w-[400px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[80vh] bg-white dark:bg-[#1a1a1a] border border-[#ececec] rounded-2xl shadow-2xl flex flex-col z-50" data-testid="ai-chat-panel">
      <div className="flex items-center justify-between p-4 border-b border-[#ececec]">
        <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-[#b02a2a] text-white grid place-items-center"><Sparkles size={14}/></div><div><div className="font-serif text-base">Dina Assistant</div><div className="text-[10px] text-[#1f8a4c]">● En ligne</div></div></div>
        <button onClick={onClose}><X size={16}/></button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
        {msgs.map((m,i)=><div key={i} className={`flex ${m.role==="user"?"justify-end":""}`}><div className={`max-w-[82%] p-2.5 rounded-xl text-sm whitespace-pre-wrap ${m.role==="user"?"bg-[#1c1c1c] text-white":"bg-[#fff5f5]"}`} data-testid={`ai-msg-${i}`}>{m.text}</div></div>)}
        {loading && <div className="text-xs text-[#666]">Dina réfléchit…</div>}
      </div>
      <div className="p-3 border-t border-[#ececec]">
        <div className="flex flex-wrap gap-1 mb-2">{CHIPS.map(c=><button key={c} onClick={()=>ask(c)} className="text-[10px] px-2 py-1 bg-[#fff5f5] rounded-full text-[#b02a2a] font-medium">{c}</button>)}</div>
        <div className="flex gap-1"><input className="dina-input text-sm" placeholder="Posez une question…" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&ask()} data-testid="ai-input"/><button onClick={()=>ask()} className="dina-btn-primary !min-h-[40px] !px-3" data-testid="ai-send"><Send size={14}/></button></div>
      </div>
    </div>
  );
}
