import React, { useEffect, useState, useRef } from "react";
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
  const [gpsState, setGpsState] = useState({ live: false, last_sent: null, denied: false, accuracy: null, heading: null, battery_saver: false });
  const tickRef = useRef(null);
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
    if (!navigator.geolocation) { setGpsState(s => ({ ...s, denied: true })); return; }
    const latest = { current: null, heading: null };
    // Compass heading from device orientation (if available & permission granted)
    const onOrient = (e) => {
      // alpha = compass heading, 0 = north, iOS uses webkitCompassHeading
      const h = e.webkitCompassHeading != null ? e.webkitCompassHeading : (e.alpha != null ? 360 - e.alpha : null);
      if (h != null && !Number.isNaN(h)) latest.heading = Math.round(h);
    };
    window.addEventListener("deviceorientationabsolute", onOrient, true);
    window.addEventListener("deviceorientation", onOrient, true);
    // Battery awareness: slow to 60s pings when < 20% (and not charging)
    let interval = 30000;
    let battery = null;
    const applyInterval = () => {
      const next = (battery && battery.level < 0.2 && !battery.charging) ? 60000 : 30000;
      if (next !== interval) {
        interval = next;
        setGpsState(s => ({ ...s, battery_saver: next === 60000 }));
        if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = setInterval(doTick, interval); }
      }
    };
    if (navigator.getBattery) {
      navigator.getBattery().then(b => {
        battery = b;
        b.addEventListener("levelchange", applyInterval);
        b.addEventListener("chargingchange", applyInterval);
        applyInterval();
      }).catch(() => {});
    }
    const push = async (coords) => {
      try {
        await api.post("/riders/location", {
          lat: coords.latitude, lng: coords.longitude,
          accuracy: coords.accuracy,
          heading: latest.heading != null ? latest.heading : (coords.heading != null && !Number.isNaN(coords.heading) ? coords.heading : null),
          speed: coords.speed != null && !Number.isNaN(coords.speed) ? coords.speed : null,
          battery_level: battery ? Math.round(battery.level * 100) : null,
          battery_charging: battery ? battery.charging : null,
        });
        setGpsState(s => ({ ...s, live: true, last_sent: new Date(), denied: false, accuracy: coords.accuracy, heading: latest.heading }));
      } catch { /* ignore transient errors */ }
    };
    // Live watch: keep latest position in memory as it changes
    const wid = navigator.geolocation.watchPosition(
      p => { latest.current = p.coords; push(p.coords); },
      e => { if (e.code === e.PERMISSION_DENIED) setGpsState(s => ({ ...s, denied: true })); },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
    const doTick = () => {
      if (latest.current) { push(latest.current); return; }
      navigator.geolocation.getCurrentPosition(
        p => { latest.current = p.coords; push(p.coords); },
        () => {},
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
      );
    };
    tickRef.current = setInterval(doTick, interval);
    return () => {
      navigator.geolocation.clearWatch(wid);
      if (tickRef.current) clearInterval(tickRef.current);
      window.removeEventListener("deviceorientationabsolute", onOrient, true);
      window.removeEventListener("deviceorientation", onOrient, true);
    };
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
            <div className="text-[10px] text-[#999] flex items-center gap-1" data-testid="rider-gps-indicator">
              {site.name || "Chez Dina"} · Livreur · ● Pointé
              {gpsState.denied ? (
                <span className="text-[#c62828]" title="Autorisez la géolocalisation pour un suivi en direct">· ⚠ GPS refusé</span>
              ) : gpsState.live ? (
                <span className="text-[#1f8a4c]" title={gpsState.last_sent ? `Dernière position envoyée à ${gpsState.last_sent.toLocaleTimeString("fr-FR")}${gpsState.heading != null ? ` · cap ${gpsState.heading}°` : ""}` : ""}>· GPS live{gpsState.battery_saver ? " ⚡" : ""}</span>
              ) : (
                <span className="text-[#e4991e]">· GPS en attente…</span>
              )}
            </div>
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
