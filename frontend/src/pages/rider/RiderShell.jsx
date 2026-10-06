import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Package, Map, History, Trophy, User, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import CheckInGate from "@/components/rider/CheckInGate";

const TABS = [
  { to: "/rider", end: true, icon: Package, label: "Courses" },
  { to: "/rider/carte", icon: Map, label: "Carte" },
  { to: "/rider/historique", icon: History, label: "Historique" },
  { to: "/rider/performance", icon: Trophy, label: "Performance" },
  { to: "/rider/profil", icon: User, label: "Profil" },
];

export default function RiderShell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [theme, setTheme] = useState(() => localStorage.getItem("rider_theme") || "light");
  const [site, setSite] = useState({});
  useEffect(() => { api.get("/public/site").then(r => setSite(r.data || {})).catch(() => {}); }, []);
  const logo = site.logo;
  const [checkedIn, setCheckedIn] = useState(null); // null = loading, true/false
  useEffect(() => {
    const root = document.documentElement;
    const t = theme === "auto" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
    root.classList.toggle("dark", t === "dark");
    localStorage.setItem("rider_theme", theme);
  }, [theme]);
  useEffect(() => {
    api.get("/attendance/me").then(r => setCheckedIn(!!r.data.checked_in)).catch(() => setCheckedIn(true)); // on error, don't block
  }, []);
  useEffect(() => {
    if (!checkedIn) return; // Don't track location before check-in
    if (!navigator.geolocation) return;
    let last = 0;
    const push = (p) => { const now = Date.now(); if (now - last < 20000) return; last = now; api.post("/riders/location", { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }).catch(() => { }); };
    const wid = navigator.geolocation.watchPosition(push, () => { }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(wid);
  }, [checkedIn]);
  useEffect(() => {
    import("@/lib/offlineQueue").then(m => { const stop = m.startAutoSync(); return () => stop && stop(); });
  }, []);

  if (checkedIn === null) return <div className="min-h-screen grid place-items-center text-sm text-[#666]">Chargement…</div>;
  if (!checkedIn) return <CheckInGate user={user} onDone={()=>setCheckedIn(true)}/>;

  return (
    <div className="min-h-screen bg-[#fff5f5] dark:bg-[#0f0f0f] text-[#1c1c1c] dark:text-white pb-20 font-sora">
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur border-b border-[#ececec] dark:border-[#2a2a2a] px-4 py-2.5 flex items-center justify-between" data-testid="rider-topbar">
        <div className="flex items-center gap-2">
          {logo ? <img src={logo} alt="" className="w-9 h-9 rounded-lg object-cover bg-white"/> : (user?.photo ? <img src={user.photo} alt="" className="w-9 h-9 rounded-full object-cover" /> : <div className="w-9 h-9 rounded-full bg-[#fde8e8] text-[#b02a2a] grid place-items-center text-sm font-bold">{user?.name?.[0] || "L"}</div>)}
          <div>
            <div className="font-serif text-sm leading-none">Bonjour {user?.name?.split(" ")[0] || "Livreur"}</div>
            <div className="text-[10px] text-[#999]">{site.name || "Chez Dina"} · Livreur · ● Pointé</div>
          </div>
        </div>
        <button onClick={() => { logout(); nav("/login"); }} className="text-[11px] text-[#666] dark:text-[#999] flex items-center gap-1" data-testid="rider-logout"><LogOut size={11} />Sortir</button>
      </div>
      <div className="max-w-md mx-auto p-3"><Outlet /></div>
      <nav className="fixed bottom-0 inset-x-0 bg-white dark:bg-[#1a1a1a] border-t border-[#ececec] dark:border-[#2a2a2a] grid grid-cols-5 z-40" data-testid="rider-bottom-nav">
        {TABS.map(t => (
          <NavLink key={t.to} to={t.to} end={t.end} data-testid={`rider-tab-${t.label.toLowerCase()}`}
            className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium ${isActive ? "text-[#b02a2a]" : "text-[#666] dark:text-[#999]"}`}>
            <t.icon size={18} /><span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
