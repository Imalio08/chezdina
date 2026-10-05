import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";
import { LayoutDashboard, ShoppingCart, Package, Truck, Boxes, Users, Megaphone, FileText, Wallet, BarChart3, UserCog, Sparkles, Plug, Settings as Cog, Bell, Moon, Sun, LogOut, Store, Wifi, WifiOff, Search, Receipt, Gift } from "lucide-react";

const MENU = [
  { to: "/console", icon: LayoutDashboard, label: "Tableau de bord", end: true },
  { to: "/console/pos", icon: ShoppingCart, label: "Caisse" },
  { to: "/console/commandes", icon: Receipt, label: "Commandes" },
  { to: "/console/livraisons", icon: Truck, label: "Livraisons" },
  { to: "/console/produits", icon: Package, label: "Produits" },
  { to: "/console/stock", icon: Boxes, label: "Stock" },
  { to: "/console/achats", icon: Boxes, label: "Achats & fournisseurs" },
  { to: "/console/clients", icon: Users, label: "Clients" },
  { to: "/console/fidelite", icon: Gift, label: "Fidélité & parrainage" },
  { to: "/console/promotions", icon: Megaphone, label: "Promotions" },
  { to: "/console/facturation", icon: FileText, label: "Facturation" },
  { to: "/console/depenses", icon: Wallet, label: "Dépenses & finances" },
  { to: "/console/statistiques", icon: BarChart3, label: "Statistiques" },
  { to: "/console/equipe", icon: UserCog, label: "Équipe" },
  { to: "/console/assistant", icon: Sparkles, label: "Assistant IA" },
  { to: "/console/integrations", icon: Plug, label: "Canaux & intégrations" },
  { to: "/console/parametres", icon: Cog, label: "Paramètres" },
];

export default function ConsoleLayout() {
  const { user, logout } = useAuth();
  const { storeId, setStoreId, theme, setTheme, lang, setLang, online } = useApp();
  const [stores, setStores] = useState([]);
  const nav = useNavigate();
  useEffect(() => { api.get("/stores").then((r) => setStores(r.data)).catch(()=>{}); }, []);

  return (
    <div className="min-h-screen flex bg-[#f5f5f5]">
      <aside className="w-[260px] shrink-0 bg-[#1c1c1c] text-white flex flex-col sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-[#2a2a2a]">
          <div className="font-serif text-2xl tracking-tight">Dina Store</div>
          <div className="text-xs text-[#999] mt-0.5">Console back-office</div>
        </div>
        <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-0.5">
          {MENU.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end} className={({isActive}) => `dina-sidebar-link ${isActive ? "active" : ""}`} data-testid={`nav-${label.toLowerCase().replace(/\s/g,"-").replace(/é/g,"e").replace(/è/g,"e").replace(/&/g,"et")}`}>
              <Icon size={16} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-[#2a2a2a] text-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#f4b12c] text-[#1c1c1c] font-semibold grid place-items-center">{(user?.name||"?").slice(0,1)}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{user?.name}</div>
              <div className="text-[#999] capitalize">{user?.role}</div>
            </div>
            <button onClick={async()=>{await logout(); nav("/login");}} className="text-[#999] hover:text-white" data-testid="logout-button"><LogOut size={16}/></button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-[#ececec] px-5 flex items-center gap-3 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <Store size={16} className="text-[#666]"/>
            <select value={storeId} onChange={(e)=>setStoreId(e.target.value)} className="text-sm font-medium bg-transparent focus:outline-none" data-testid="store-selector">
              <option value="all">Toutes les boutiques</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex-1 max-w-xl mx-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]"/>
              <input className="dina-input pl-9" placeholder="Rechercher produit, SKU, client, commande…" data-testid="global-search"/>
            </div>
          </div>
          <div className={`dina-chip ${online?"":"!border-[#c62828] !text-[#c62828]"}`} data-testid="sync-indicator">
            {online ? <><Wifi size={12}/> En ligne</> : <><WifiOff size={12}/> Hors ligne</>}
          </div>
          <button onClick={()=>setLang(lang==="fr"?"en":"fr")} className="dina-chip" data-testid="lang-toggle">{lang.toUpperCase()}</button>
          <button onClick={()=>setTheme(theme==="light"?"dark":"light")} className="dina-chip" data-testid="theme-toggle">{theme==="light"?<Moon size={12}/>:<Sun size={12}/>}</button>
          <button className="dina-chip" data-testid="notifications-button"><Bell size={12}/>3</button>
        </header>
        <div className="p-6 flex-1"><Outlet /></div>
      </main>
    </div>
  );
}
