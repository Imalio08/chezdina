import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import api from "@/lib/api";
import { fcfa, payInfo } from "@/lib/format";
import { Phone, MessageCircle, Navigation, Package, Shuffle, ExternalLink, Volume2, VolumeX, LocateFixed } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { callCustomer } from "@/lib/riderCall";
import { getPosition, watchIfGranted } from "@/lib/permissions";
import { fetchRoute, speak, distM, fmtDist, offRoute } from "@/lib/voiceNav";

const CLR = { a_livrer: "#e4991e", en_route: "#5867fd", livree: "#1f8a4c", annulee: "#c62828", echouee: "#c62828", reportee: "#999" };
const statusToKey = (s) => s === "en_livraison" ? "en_route" : s === "livree" ? "livree" : s === "annulee" ? "annulee" : s === "echouee" ? "echouee" : s === "reportee" ? "reportee" : "a_livrer";
const BOX = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linejoin="round"><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8"/></svg>';
const pin = (color, inner) => `<div style="width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:3px solid white;box-shadow:0 3px 8px rgba(0,0,0,.35);display:grid;place-items:center"><div style="transform:rotate(45deg);color:white;font-weight:bold;font-size:12px;display:grid;place-items:center">${inner}</div></div>`;
const makeIcon = (color) => L.divIcon({ className: "", html: pin(color, BOX), iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -30] });
const makeNumIcon = (color, n) => L.divIcon({ className: "", html: pin(color, n), iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -30] });
const riderIcon = L.divIcon({ className: "", html: '<div style="position:relative;width:40px;height:40px"><div style="position:absolute;inset:0;border-radius:50%;background:rgba(88,103,253,.28);animation:ping 1.8s cubic-bezier(0,0,.2,1) infinite"></div><div style="position:absolute;inset:8px;border-radius:50%;background:#5867fd;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);display:grid;place-items:center"><svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 2l7 19-7-4-7 4z"/></svg></div></div>', iconSize: [40, 40], iconAnchor: [20, 20] });

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => { if (points.length) map.fitBounds(L.latLngBounds(points.map(p => [p.lat, p.lng])).pad(0.3)); }, [points.length, map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function Follow({ pos, on }) {
  const map = useMap();
  useEffect(() => { if (on && pos) map.setView([pos.lat, pos.lng], Math.max(map.getZoom(), 16), { animate: true }); }, [on, pos?.lat, pos?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

let BASE = { lat: 5.345, lng: -4.024 };
api.get("/public/business").then(r => { if (r.data?.lat && r.data?.lng) BASE = { lat: r.data.lat, lng: r.data.lng }; }).catch(() => {});
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return h; };
const pseudoCoord = (code) => { const h = hash(code || ""); return { lat: BASE.lat + ((h % 300) - 150) / 2000, lng: BASE.lng + (((h >> 8) % 300) - 150) / 2000 }; };
const posOf = (o) => (o.customer?.lat && o.customer?.lng) ? { lat: +o.customer.lat, lng: +o.customer.lng } : (o.geo || pseudoCoord(o.code));

export default function Carte() {
  const [orders, setOrders] = useState([]);
  const [myPos, setMyPos] = useState(null);
  const [showOnlyTodo, setShowOnlyTodo] = useState(false);
  const [optimized, setOptimized] = useState(null);
  const [selected, setSelected] = useState(null);
  const [sp, setSp] = useSearchParams();
  const routeTo = sp.get("route");
  const stopWatch = useRef(null);

  const startWatch = async () => {
    if (stopWatch.current) return true;
    stopWatch.current = await watchIfGranted(c => setMyPos({ lat: c.latitude, lng: c.longitude }));
    return !!stopWatch.current;
  };
  const askPosition = async () => {
    const c = await getPosition();
    if (c) { setMyPos({ lat: c.latitude, lng: c.longitude }); startWatch(); }
    return c;
  };

  useEffect(() => {
    api.get("/riders/me/today").then(r => setOrders(r.data.orders || [])).catch(() => { import("@/lib/riderOffline").then(m => m.kvGet("today")).then(d => d && setOrders(d.orders || [])).catch(() => {}); });
    startWatch();
    return () => { stopWatch.current?.(); stopWatch.current = null; window.speechSynthesis?.cancel(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const enriched = useMemo(() => orders.map(o => ({ ...o, _pos: posOf(o), _k: statusToKey(o.status) })), [orders]);
  const target = routeTo ? enriched.find(o => o.id === routeTo) : null;
  useEffect(() => { if (routeTo && !myPos) askPosition(); }, [routeTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = showOnlyTodo ? enriched.filter(o => o._k === "a_livrer" || o._k === "en_route") : enriched;
  const markers = target ? [target] : optimized ? optimized.map((o, i) => ({ ...o, _n: i + 1 })) : visible;

  const optimize = async () => {
    const start = myPos || (await askPosition().then(c => c && { lat: c.latitude, lng: c.longitude }));
    if (!start) return;
    const remaining = enriched.filter(o => o._k === "a_livrer" || o._k === "en_route");
    const path = []; let cur = start;
    while (remaining.length) {
      let bestIdx = 0, bestD = Infinity;
      remaining.forEach((o, i) => { const d = (o._pos.lat - cur.lat) ** 2 + (o._pos.lng - cur.lng) ** 2; if (d < bestD) { bestD = d; bestIdx = i; } });
      const next = remaining.splice(bestIdx, 1)[0]; path.push(next); cur = next._pos;
    }
    setOptimized(path);
  };
  const pathLine = !target && optimized && myPos ? [[myPos.lat, myPos.lng], ...optimized.map(o => [o._pos.lat, o._pos.lng])] : null;
  const closeRoute = () => { sp.delete("route"); sp.delete("nav"); setSp(sp, { replace: true }); };

  return (
    <div className="space-y-2">
      {!target && (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowOnlyTodo(!showOnlyTodo)} className={`text-xs px-3 py-1.5 rounded-full border ${showOnlyTodo ? "bg-[#b02a2a] text-white border-[#b02a2a]" : "border-[#ececec]"}`} data-testid="map-filter-todo">{showOnlyTodo ? "Toutes" : "À livrer seulement"}</button>
          {!myPos && <button onClick={askPosition} className="text-xs px-3 py-1.5 rounded-full border border-[#ececec] inline-flex items-center gap-1" data-testid="map-locate"><LocateFixed size={12} />Ma position</button>}
          <button onClick={optimize} className="dina-btn-primary !min-h-[36px] text-xs ml-auto" data-testid="map-optimize"><Shuffle size={12} />Optimiser ma tournée</button>
          {optimized && <button onClick={() => setOptimized(null)} className="text-xs text-[#666]">Annuler</button>}
        </div>
      )}
      {target && <NavPanel target={target} myPos={myPos} autoVoice={sp.get("nav") === "1"} onClose={closeRoute} askPosition={askPosition} />}
      <div className="rounded-xl overflow-hidden border border-[#ececec] dark:border-[#2a2a2a]" data-testid="rider-map">
        <MapContainer center={myPos ? [myPos.lat, myPos.lng] : [BASE.lat, BASE.lng]} zoom={13} style={{ height: target ? 460 : 420, width: "100%" }} scrollWheelZoom>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
          {myPos && <Marker position={[myPos.lat, myPos.lng]} icon={riderIcon}><Popup>Vous êtes ici</Popup></Marker>}
          {!target && <Marker position={[BASE.lat, BASE.lng]} icon={makeIcon("#1c1c1c")}><Popup><div className="text-xs font-semibold">Boutique Chez Dina</div></Popup></Marker>}
          {markers.map(o => (
            <Marker key={o.id} position={[o._pos.lat, o._pos.lng]} icon={!target && optimized ? makeNumIcon(CLR[o._k], o._n) : makeIcon(CLR[o._k] || "#999")} eventHandlers={{ click: () => !target && setSelected(o) }}>
              <Popup><div className="text-xs"><div className="font-semibold">{o.code}</div><div>{o.customer?.name} · {o.customer?.landmark || o.customer?.quartier || o.delivery_zone}</div></div></Popup>
            </Marker>
          ))}
          {pathLine && <Polyline positions={pathLine} color="#b02a2a" dashArray="6 6" />}
          {target && <RouteLayer target={target} myPos={myPos} />}
          {!target && markers.length > 0 && <FitBounds points={markers.map(o => o._pos).concat(myPos ? [myPos] : [])} />}
        </MapContainer>
      </div>
      {!target && selected && (
        <div className="fixed bottom-16 left-0 right-0 bg-white dark:bg-[#1a1a1a] border-t border-[#ececec] dark:border-[#2a2a2a] p-3 z-30 shadow-xl" data-testid="map-selected">
          <div className="max-w-md mx-auto">
            <div className="flex justify-between items-start mb-2"><div><div className="font-semibold">{selected.code} · {selected.customer?.name}</div><div className="text-xs text-[#666]">{selected.customer?.quartier || selected.delivery_zone}</div><div className="text-xs mt-0.5">{selected.payment_method === "cod" ? <span className="text-[#c62828] font-semibold">COD {fcfa(selected.total)}</span> : <span style={{ color: payInfo(selected).color }}>{payInfo(selected).label}</span>}</div></div><button onClick={() => setSelected(null)} className="text-[#999]">✕</button></div>
            <div className="grid grid-cols-4 gap-1.5">
              <button onClick={() => callCustomer(selected)} disabled={selected.status !== "en_livraison"} className="dina-btn-secondary !min-h-[40px] text-[10px] flex-col gap-0 disabled:opacity-40" data-testid="map-selected-call"><Phone size={12} />Appeler</button>
              <Link to={`/riders?course=${selected.code}`} className="dina-btn-secondary !min-h-[40px] text-[10px] flex-col gap-0" data-testid="map-selected-message"><MessageCircle size={12} />Message</Link>
              <button onClick={() => { sp.set("route", selected.id); setSp(sp); setSelected(null); }} className="dina-btn-secondary !min-h-[40px] text-[10px] flex-col gap-0" data-testid="map-selected-route"><Navigation size={12} />Itinéraire</button>
              <Link to="/riders" className="dina-btn-primary !min-h-[40px] text-[10px] flex-col gap-0"><Package size={12} />Ouvrir</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Shared route state between the map layer and the guidance panel.
const routeBus = { route: null, subs: new Set(), set(r) { this.route = r; this.subs.forEach(f => f(r)); } };
const useRoute = () => { const [r, setR] = useState(routeBus.route); useEffect(() => { routeBus.subs.add(setR); return () => routeBus.subs.delete(setR); }, []); return r; };

function RouteLayer({ target, myPos }) {
  const route = useRoute();
  const lastFetch = useRef(0);
  useEffect(() => () => routeBus.set(null), [target.id]);
  useEffect(() => {
    if (!myPos) return;
    const r = routeBus.route;
    const needs = !r || r.for !== target.id || (offRoute(myPos, r.line) && Date.now() - lastFetch.current > 20000);
    if (!needs) return;
    lastFetch.current = Date.now();
    const ctrl = new AbortController();
    fetchRoute(myPos, target._pos, ctrl.signal).then(rt => {
      if (rt) routeBus.set({ ...rt, for: target.id, rerouted: !!r });
      else routeBus.set({ for: target.id, line: [[myPos.lat, myPos.lng], [target._pos.lat, target._pos.lng]], km: distM(myPos, target._pos) / 1000, min: distM(myPos, target._pos) / 400, steps: [], approx: true });
    }).catch(e => { if (e.name !== "AbortError") routeBus.set({ for: target.id, line: [[myPos.lat, myPos.lng], [target._pos.lat, target._pos.lng]], km: distM(myPos, target._pos) / 1000, min: distM(myPos, target._pos) / 400, steps: [], approx: true }); });
    return () => ctrl.abort();
  }, [target.id, myPos?.lat, myPos?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  const pts = route?.line?.map(([lat, lng]) => ({ lat, lng })) || [target._pos];
  return <>
    {route && <Polyline positions={route.line} color="#5867fd" weight={6} opacity={0.85} dashArray={route.approx ? "8 8" : undefined} />}
    <FitBounds points={pts} />
    <Follow pos={myPos} on={!!route && !route.approx && route.steps?.length > 0} />
  </>;
}

function NavPanel({ target, myPos, autoVoice, onClose, askPosition }) {
  const route = useRoute();
  const [voice, setVoice] = useState(() => localStorage.getItem("dina_voice_nav") !== "off");
  const [idx, setIdx] = useState(1);
  const said = useRef({});
  const toggleVoice = () => { const v = !voice; setVoice(v); localStorage.setItem("dina_voice_nav", v ? "on" : "off"); if (v) speak("Guidage vocal activé"); else window.speechSynthesis?.cancel(); };
  useEffect(() => { said.current = {}; setIdx(1); if (route?.steps?.length && voice && (autoVoice || route.rerouted)) speak(`${route.rerouted ? "Nouvel itinéraire. " : ""}${route.steps[0].text}. Puis ${route.steps[1]?.text || ""}`); }, [route?.line?.length, route?.for]); // eslint-disable-line react-hooks/exhaustive-deps
  const step = route?.steps?.[idx];
  const toStep = step && myPos ? distM(myPos, step.at) : null;
  useEffect(() => {
    if (!step || toStep == null) return;
    if (toStep < 30) {
      if (!said.current[`now${idx}`]) { said.current[`now${idx}`] = 1; speak(step.text, voice); }
      if (idx < route.steps.length - 1) setIdx(idx + 1);
    } else if (toStep < 160 && !said.current[`pre${idx}`]) { said.current[`pre${idx}`] = 1; speak(`Dans ${fmtDist(toStep)}, ${step.text.charAt(0).toLowerCase()}${step.text.slice(1)}`, voice); }
  }, [toStep == null ? null : Math.round(toStep / 10), idx]); // eslint-disable-line react-hooks/exhaustive-deps
  const left = myPos ? distM(myPos, target._pos) : null;
  return (
    <div className="dina-card-white p-3 space-y-2" data-testid="map-route-panel">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#5867fd] text-white grid place-items-center shrink-0"><Navigation size={18} /></div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold leading-tight" data-testid="nav-instruction">{!myPos ? "Activez votre position pour l'itinéraire" : step ? step.text : route ? (route.approx ? "Itinéraire approximatif · suivez la ligne" : "Suivez l'itinéraire") : "Calcul de l'itinéraire…"}</div>
          {toStep != null && <div className="text-xs text-[#5867fd] font-semibold" data-testid="nav-step-distance">dans {fmtDist(toStep)}</div>}
          <div className="text-xs text-[#666] tabular" data-testid="map-route-stats">{target.code} · {target.customer?.name} · {target.customer?.landmark || target.customer?.quartier || ""}{route ? ` · ${route.km.toFixed(1)} km · ~${Math.max(1, Math.round(route.min))} min` : ""}{left != null && left < 60 ? " · vous êtes arrivé" : ""}</div>
        </div>
        <button onClick={toggleVoice} className={`p-2 rounded-lg ${voice ? "bg-[#eef0ff] text-[#5867fd]" : "bg-[#f2f2f2] text-[#999]"}`} title={voice ? "Couper la voix" : "Activer la voix"} data-testid="nav-voice-toggle">{voice ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {!myPos && <button onClick={askPosition} className="dina-btn-primary !min-h-[36px] text-xs" data-testid="nav-enable-gps"><LocateFixed size={12} />Activer ma position</button>}
        {route?.steps?.length > 0 && <button onClick={() => speak(step?.text || route.steps[0].text, true)} className="dina-btn-secondary !min-h-[34px] text-xs" data-testid="nav-repeat"><Volume2 size={12} />Répéter</button>}
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${target._pos.lat},${target._pos.lng}`} target="_blank" rel="noreferrer" className="text-[11px] text-[#666] underline inline-flex items-center gap-1" data-testid="map-route-google"><ExternalLink size={11} />Google Maps</a>
        <button onClick={onClose} className="text-xs text-[#b02a2a] font-semibold ml-auto" data-testid="map-route-close">Voir toutes les courses</button>
      </div>
    </div>
  );
}
