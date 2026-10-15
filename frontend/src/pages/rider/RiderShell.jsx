import React, { useEffect, useState, useRef, useMemo } from "react";
import { toast } from "sonner";
import { playChime, setSoundEnabled } from "@/lib/notifySound";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Package, Map, History, Trophy, User, LogOut, Clock,
  HelpCircle, Phone, MessageCircle, Info, ExternalLink, Megaphone, Star, Heart, Home, Settings as SettingsIcon
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import AttendancePunchModal from "@/components/shared/AttendancePunchModal";
import { Bell } from "lucide-react";
import { enablePush, pushErrorText, pushGranted } from "@/lib/push";
import { NotifItem, useOpenNotif, markAllRead, FilterTabs } from "@/pages/rider/Notifications";
import { CheckCheck } from "lucide-react";

// Icons available for custom rider tabs
const ICONS = {
  Package, Map, History, Trophy, User, HelpCircle, Phone,
  MessageCircle, Info, ExternalLink, Megaphone, Star, Heart, Home, SettingsIcon
};
const resolveIcon = (name) => ICONS[name] || Info;

export default function RiderShell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [theme, setTheme] = useState(() => localStorage.getItem("rider_theme") || "light");
  const [site, setSite] = useState({});
  const [cms, setCms] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [annDismissed, setAnnDismissed] = useState(() => localStorage.getItem("rider_ann_dismissed") || "");
  const seenRef = useRef(null);
  const [msgUnread, setMsgUnread] = useState(0);
  const [feed, setFeed] = useState({ items: [], unread: 0 });
  const [showFeed, setShowFeed] = useState(false);
  const [feedFilter, setFeedFilter] = useState("all");
  const seenNotifs = useRef(null);
  const openNotif = useOpenNotif(() => setShowFeed(false));
  useEffect(() => {
    const poll = async () => {
      try {
        const [c, n] = await Promise.all([api.get("/rider/conversations"), api.get("/me/notifications")]);
        setMsgUnread((c.data || []).reduce((s, x) => s + (x.unread || 0), 0));
        setFeed(n.data);
        const items = n.data.items || [];
        if (seenNotifs.current) {
          const fresh = items.filter(x => !x.read && !seenNotifs.current.has(x.id));
          if (fresh.length) playChime(fresh.some(x => x.type !== "message") ? "order" : "message");
          fresh.slice(0, 3).forEach(x => toast(x.title, { id: x.id, description: x.msg, action: x.link ? { label: "Ouvrir", onClick: () => openNotif(x) } : undefined }));
          if (fresh.length > 3) toast(`${fresh.length - 3} autre(s) notification(s)`, { action: { label: "Voir", onClick: () => nav("/rider/notifications") } });
        }
        seenNotifs.current = new Set([...(seenNotifs.current || []), ...items.map(x => x.id)]);
      } catch { /* offline · rattrapé au prochain passage */ }
    };
    poll(); const iv = setInterval(poll, 15000);
    const onVis = () => { if (document.visibilityState === "visible") poll(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", poll);
    window.addEventListener("rider-notifs-changed", poll);
    if (pushGranted()) enablePush("/push/subscribe", true).catch(() => {});
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("online", poll); window.removeEventListener("rider-notifs-changed", poll); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const openFeed = () => setShowFeed(s => !s);
  const activatePush = async () => { const r = await enablePush("/push/subscribe").catch(() => ({ ok: false })); if (r.ok) toast.success("Notifications activées sur ce téléphone"); else toast.error(pushErrorText(r.reason)); };
  useEffect(() => {
    if (user?.prefs?.sound === "off" && !localStorage.getItem("dina_sound")) setSoundEnabled(false);
    const check = async () => {
      try {
        const [t, u] = await Promise.all([api.get("/riders/me/today"), api.get("/orders-messages/unread")]);
        const ids = new Set((t.data?.orders || []).map(o => o.id));
        const unread = u.data?.count || 0;
        const prev = seenRef.current;
        if (prev) {
          const fresh = [...ids].filter(id => !prev.ids.has(id)).length;
          if (fresh > 0) { /* announced by the notifications feed */ }
          else if (unread > prev.unread) { /* handled by notifications feed */ }
        }
        seenRef.current = { ids, unread };
      } catch { /* offline */ }
    };
    check(); const iv = setInterval(check, 20000); return () => clearInterval(iv);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.get("/public/site").then(r => setSite(r.data || {})).catch(() => {});
    const fetchCms = () => api.get("/public/rider-cms").then(r => setCms(r.data || {})).catch(() => setCms({}));
    fetchCms();
    const onCms = () => fetchCms();
    window.addEventListener("rider-cms-changed", onCms);
    return () => window.removeEventListener("rider-cms-changed", onCms);
  }, []);

  // Build dynamic tab list from CMS config, fallback to defaults
  const tabs = useMemo(() => {
    const defaults = [
      { key: "courses",     to: "/rider",             icon: "Package", label: "Courses",     visible: true, builtin: true },
      { key: "carte",       to: "/rider/carte",       icon: "Map",     label: "Carte",       visible: true, builtin: true },
      { key: "historique",  to: "/rider/historique",  icon: "History", label: "Historique",  visible: true, builtin: true },
      { key: "performance", to: "/rider/performance", icon: "Trophy",  label: "Performance", visible: true, builtin: true },
      { key: "profil",      to: "/rider/profil",      icon: "User",    label: "Profil",      visible: true, builtin: true },
    ];
    const raw = (cms?.tabs && Array.isArray(cms.tabs) && cms.tabs.length) ? cms.tabs : defaults;
    const list = raw.filter(t => t.visible !== false);
    if (!list.some(t => t.key === "messages" || t.to === "/rider/messages")) {
      const i = list.findIndex(t => t.key === "courses");
      list.splice(i + 1, 0, { key: "messages", to: "/rider/messages", icon: "MessageCircle", label: "Messages", visible: true, builtin: true });
    }
    return list;
  }, [cms]);

  // CMS colors — expose as CSS variables
  const primary = cms?.primary_color || "#b02a2a";
  const accent  = cms?.accent_color  || "#fff5f5";
  const logo    = cms?.logo || site.logo;
  const brandName = site.name || "Chez Dina";
  const greetingTpl = cms?.greeting || "Bonjour {name}";
  const subtitleTpl = cms?.subtitle || "{brand} · Livreur";
  const subst = (s) => (s || "")
    .replace("{name}", user?.name?.split(" ")[0] || "Livreur")
    .replace("{brand}", brandName);

  const announcement = cms?.announcement || { enabled: false };
  const annKey = `${announcement.text || ""}|${announcement.variant || ""}`;
  const showAnn = announcement.enabled && announcement.text && annDismissed !== annKey;
  const help = cms?.help || { enabled: true, title: "Besoin d'aide ?", content: "" };

  const [punchStatus, setPunchStatus] = useState(null);
  const [showPunch, setShowPunch] = useState(false);
  const [attendanceCfg, setAttendanceCfg] = useState({ enabled: true, enabled_roles: null });
  const [gpsState, setGpsState] = useState({ live: false, last_sent: null, denied: false, accuracy: null, heading: null, battery_saver: false });
  const tickRef = useRef(null);

  useEffect(() => {
    const root = document.documentElement;
    const t = theme === "auto" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
    root.classList.toggle("dark", t === "dark");
    localStorage.setItem("rider_theme", theme);
  }, [theme]);

  // Manifest is owned by BrandingBootstrapper (route-aware); remember this device runs the rider app.
  useEffect(() => {
    localStorage.setItem("dina_app", "rider");
    const originalTheme = document.querySelector('meta[name="theme-color"]');
    const prevTheme = originalTheme ? originalTheme.getAttribute("content") : null;
    if (originalTheme && cms?.primary_color) originalTheme.setAttribute("content", cms.primary_color);
    return () => {
      if (originalTheme && prevTheme != null) originalTheme.setAttribute("content", prevTheme);
    };
  }, [cms?.updated_at, cms?.primary_color]);

  // Attendance
  useEffect(() => {
    const fetchStatus = () => api.get("/attendance/me").then(r => setPunchStatus(r.data)).catch(() => {});
    const fetchCfg = () => api.get("/business").then(r => {
      setAttendanceCfg(r.data?.attendance_config || { enabled: true, enabled_roles: null });
    }).catch(() => {});
    fetchStatus(); fetchCfg();
    const t = setInterval(fetchStatus, 60000);
    const onCfg = () => fetchCfg();
    window.addEventListener("attendance-config-changed", onCfg);
    return () => { clearInterval(t); window.removeEventListener("attendance-config-changed", onCfg); };
  }, []);

  // Live GPS tracking
  useEffect(() => {
    if (!navigator.geolocation) { setGpsState(s => ({ ...s, denied: true })); return; }
    const latest = { current: null, heading: null };
    const onOrient = (e) => {
      const h = e.webkitCompassHeading != null ? e.webkitCompassHeading : (e.alpha != null ? 360 - e.alpha : null);
      if (h != null && !Number.isNaN(h)) latest.heading = Math.round(h);
    };
    window.addEventListener("deviceorientationabsolute", onOrient, true);
    window.addEventListener("deviceorientation", onOrient, true);
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
      } catch { /* ignore */ }
    };
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
  }, []);

  useEffect(() => {
    import("@/lib/offlineQueue").then(m => { const stop = m.startAutoSync(); return () => stop && stop(); });
  }, []);

  const punchLabel = punchStatus?.departure ? "Terminé" : punchStatus?.checked_in ? "Pointé" : "Pointer";
  const punchColor = punchStatus?.departure ? "text-[#999]" : punchStatus?.checked_in ? "text-[#1f8a4c]" : "text-[color:var(--rider-primary)]";
  const punchAllowed = attendanceCfg.enabled !== false && (!Array.isArray(attendanceCfg.enabled_roles) || attendanceCfg.enabled_roles.includes("rider"));

  const annColors = {
    info:    { bg: "#eef4ff", fg: "#1e3a8a", border: "#b4c7ff" },
    success: { bg: "#eafaf1", fg: "#1f6b3a", border: "#a3dfbc" },
    warning: { bg: "#fff7e6", fg: "#8a5a00", border: "#f5c56b" },
    danger:  { bg: "#fdecec", fg: "#991b1b", border: "#f5b0b0" },
  }[announcement.variant || "info"] || { bg: "#eef4ff", fg: "#1e3a8a", border: "#b4c7ff" };

  const styleVars = {
    "--rider-primary": primary,
    "--rider-accent": accent,
  };

  const gridClass = `grid-cols-${Math.max(1, Math.min(tabs.length, 6))}`;

  return (
    <div
      className="min-h-screen bg-[color:var(--rider-accent)] dark:bg-[#0f0f0f] text-[#1c1c1c] dark:text-white pb-20 font-sora"
      style={styleVars}
      data-testid="rider-shell"
    >
      {/* Topbar */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur border-b border-[#ececec] dark:border-[#2a2a2a] px-4 py-2.5 flex items-center justify-between" data-testid="rider-topbar">
        <div className="flex items-center gap-2 min-w-0">
          {logo
            ? <img src={logo} alt="" className="w-9 h-9 rounded-lg object-cover bg-white" data-testid="rider-logo"/>
            : (user?.photo
                ? <img src={user.photo} alt="" className="w-9 h-9 rounded-full object-cover" />
                : <div className="w-9 h-9 rounded-full grid place-items-center text-sm font-bold text-white" style={{ background: primary }}>{(brandName[0] || "D").toUpperCase()}</div>)
          }
          <div className="min-w-0">
            <div className="font-serif text-sm leading-none truncate" data-testid="rider-greeting">{subst(greetingTpl)}</div>
            <div className="text-[10px] text-[#999] flex items-center gap-1 whitespace-nowrap min-w-0" data-testid="rider-gps-indicator">
              <span className="truncate">{subst(subtitleTpl)}</span>
              {gpsState.denied ? (
                <span className="text-[#c62828]" title="Autorisez la géolocalisation pour un suivi en direct">· ⚠ GPS refusé</span>
              ) : gpsState.live ? (
                <span className="text-[#1f8a4c]" title={gpsState.last_sent ? `Dernière position ${gpsState.last_sent.toLocaleTimeString("fr-FR")}` : ""}>· GPS live{gpsState.battery_saver ? " ⚡" : ""}</span>
              ) : (
                <span className="text-[#e4991e]">· GPS…</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="relative">
            <button onClick={openFeed} className="relative p-1.5 text-[#666] dark:text-[#999]" data-testid="rider-notif-btn" aria-label="Notifications">
              <Bell size={17}/>{feed.unread > 0 && <span className="absolute -top-0.5 -right-0.5 bg-[#b02a2a] text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 grid place-items-center" data-testid="rider-notif-badge">{feed.unread}</span>}
            </button>
            {showFeed && (
              <div className="fixed sm:absolute right-2 sm:right-0 left-2 sm:left-auto top-14 sm:top-9 sm:w-96 bg-white dark:bg-[#1a1a1a] border border-[#ececec] dark:border-[#2a2a2a] rounded-xl shadow-xl p-2 z-50 max-h-[75vh] overflow-y-auto" data-testid="rider-notif-panel">
                <div className="flex items-center justify-between gap-2 px-1 pb-2 pr-2">
                  <div className="font-semibold text-sm">Notifications</div>
                  {feed.unread > 0 && <button onClick={markAllRead} className="text-[11px] flex items-center gap-1 text-[color:var(--rider-primary)] font-semibold" data-testid="rider-notif-read-all"><CheckCheck size={13}/>Tout marquer comme lu</button>}
                </div>
                <div className="px-1 pb-2"><FilterTabs value={feedFilter} onChange={setFeedFilter} unread={feed.unread}/></div>
                {!pushGranted() && <button onClick={activatePush} className="w-full text-xs mb-2 py-2 rounded-lg bg-[color:var(--rider-accent)] text-[color:var(--rider-primary)] font-semibold" data-testid="rider-push-enable">Activer les notifications sur ce téléphone</button>}
                {(() => { const list = feed.items.filter(n => feedFilter === "all" || !n.read).slice(0, 15); return list.length === 0
                  ? <div className="text-xs text-[#666] text-center py-6" data-testid="rider-notif-panel-empty">{feedFilter === "unread" ? "Aucune notification non lue" : "Aucune notification"}</div>
                  : <div className="space-y-1">{list.map(n => <NotifItem key={n.id} n={n} onOpen={openNotif}/>)}</div>; })()}
                <button onClick={() => { setShowFeed(false); nav("/rider/notifications"); }} className="w-full text-xs mt-2 py-2 rounded-lg border border-[#ececec] dark:border-[#2a2a2a]" data-testid="rider-notif-see-all">Voir tout l'historique</button>
              </div>
            )}
          </div>
          {help?.enabled && (
            <button onClick={() => setShowHelp(true)} className="text-[11px] text-[#666] dark:text-[#999] flex items-center gap-1" data-testid="rider-help-btn">
              <HelpCircle size={15}/><span className="hidden sm:inline">Aide</span>
            </button>
          )}
          {punchAllowed && (
            <button
              onClick={() => setShowPunch(true)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-[11px] font-semibold ${punchColor} border-current`}
              data-testid="rider-punch-btn"
            >
              <Clock size={12}/>{punchLabel}
            </button>
          )}
          <button onClick={() => { logout(); nav("/rider/login"); }} className="text-[11px] text-[#666] dark:text-[#999] flex items-center gap-1" data-testid="rider-logout" aria-label="Sortir"><LogOut size={15} /><span className="hidden sm:inline">Sortir</span></button>
        </div>
      </div>

      {/* Announcement banner */}
      {showAnn && (
        <div
          className="px-4 py-2 text-xs font-medium flex items-start justify-between gap-2 border-b"
          style={{ background: annColors.bg, color: annColors.fg, borderColor: annColors.border }}
          data-testid="rider-announcement"
        >
          <div className="flex items-start gap-2 min-w-0">
            <Megaphone size={14} className="shrink-0 mt-0.5"/>
            <div className="min-w-0 whitespace-pre-wrap break-words">{announcement.text}</div>
          </div>
          <button onClick={() => { setAnnDismissed(annKey); localStorage.setItem("rider_ann_dismissed", annKey); }} className="shrink-0 text-xs opacity-70 hover:opacity-100" data-testid="rider-ann-dismiss">✕</button>
        </div>
      )}

      <div className="max-w-md mx-auto p-3"><Outlet /></div>

      {/* Bottom nav */}
      <nav
        className={`fixed bottom-0 inset-x-0 bg-white dark:bg-[#1a1a1a] border-t border-[#ececec] dark:border-[#2a2a2a] grid z-40 ${gridClass}`}
        style={{ gridTemplateColumns: `repeat(${Math.max(1, tabs.length)}, minmax(0, 1fr))` }}
        data-testid="rider-bottom-nav"
      >
        {tabs.map(t => {
          const Icon = resolveIcon(t.icon);
          const label = t.label || t.key;
          const isExternal = /^https?:\/\//i.test(t.to || "");
          if (isExternal) {
            return (
              <a
                key={t.key || t.to}
                href={t.to}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium text-[#666] dark:text-[#999]"
                data-testid={`rider-tab-${(t.key || label).toString().toLowerCase()}`}
              >
                <Icon size={18} /><span>{label}</span>
              </a>
            );
          }
          const to = t.to || `/rider/${t.key || ""}`;
          const end = to === "/rider";
          return (
            <NavLink
              key={t.key || to}
              to={to}
              end={end}
              data-testid={`rider-tab-${(t.key || label).toString().toLowerCase()}`}
              className={({ isActive }) => `relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium ${isActive ? "text-[color:var(--rider-primary)]" : "text-[#666] dark:text-[#999]"}`}
            >
              <Icon size={18} /><span className={`block max-w-full truncate px-0.5 ${tabs.length > 5 ? "text-[9px]" : ""}`}>{label}</span>
              {to === "/rider/messages" && msgUnread > 0 && <span className="absolute top-1 left-1/2 ml-1.5 bg-[#b02a2a] text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 grid place-items-center" data-testid="rider-tab-messages-badge">{msgUnread}</span>}
            </NavLink>
          );
        })}
      </nav>

      <AttendancePunchModal
        open={showPunch}
        onClose={() => setShowPunch(false)}
        onDone={() => { api.get("/attendance/me").then(r => setPunchStatus(r.data)).catch(() => {}); }}
      />

      {/* Help modal */}
      {showHelp && help?.enabled && (
        <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4" onClick={() => setShowHelp(false)} data-testid="rider-help-modal">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2">
              <HelpCircle size={18} className="text-[color:var(--rider-primary)]"/>
              <div className="font-serif text-xl">{help.title || "Besoin d'aide ?"}</div>
            </div>
            <div className="text-sm text-[#444] dark:text-[#ccc] whitespace-pre-wrap break-words leading-relaxed">
              {help.content || "Contactez votre gérante en cas de problème."}
            </div>
            <button onClick={() => setShowHelp(false)} className="mt-4 w-full py-2 rounded-lg text-white text-sm font-semibold" style={{ background: primary }} data-testid="rider-help-close">Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}
