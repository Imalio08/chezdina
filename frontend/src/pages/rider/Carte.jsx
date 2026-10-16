import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import api from "@/lib/api";
import { fcfa, payInfo } from "@/lib/format";
import { Phone, MessageCircle, Navigation, Package, Shuffle, ExternalLink } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

const CLR = { a_livrer: "#e4991e", en_route: "#5867fd", livree: "#1f8a4c", annulee: "#c62828", echouee: "#c62828", reportee: "#999" };
const statusToKey = (s) => s === "en_livraison" ? "en_route" : s === "livree" ? "livree" : s === "annulee" ? "annulee" : s === "echouee" ? "echouee" : s === "reportee" ? "reportee" : "a_livrer";
const BOX = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linejoin="round"><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8"/></svg>';
const pin = (color, inner) => `<div style="width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:3px solid white;box-shadow:0 3px 8px rgba(0,0,0,.35);display:grid;place-items:center"><div style="transform:rotate(45deg);color:white;font-weight:bold;font-size:12px;display:grid;place-items:center">${inner}</div></div>`;
const makeIcon = (color) => L.divIcon({ className: "", html: pin(color, BOX), iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -30] });
const makeNumIcon = (color, n) => L.divIcon({ className: "", html: pin(color, n), iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -30] });
const riderIcon = L.divIcon({ className: "", html: '<div style="position:relative;width:40px;height:40px"><div style="position:absolute;inset:0;border-radius:50%;background:rgba(88,103,253,.28);animation:ping 1.8s cubic-bezier(0,0,.2,1) infinite"></div><div style="position:absolute;inset:8px;border-radius:50%;background:#5867fd;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);display:grid;place-items:center"><svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 2l7 19-7-4-7 4z"/></svg></div></div>', iconSize: [40, 40], iconAnchor: [20, 20] });

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => { if (points.length) map.fitBounds(L.latLngBounds(points.map(p => [p.lat, p.lng])).pad(0.3)); }, [points, map]);
  return null;
}

// Fake geocode: distribute orders around Abidjan if no explicit coords (demo)
const BASE = { lat: 5.345, lng: -4.024 };
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return h; };
const pseudoCoord = (code) => { const h = hash(code || ""); return { lat: BASE.lat + ((h % 300) - 150) / 2000, lng: BASE.lng + (((h >> 8) % 300) - 150) / 2000 }; };

export default function Carte() {
  const [orders, setOrders] = useState([]);
  const [myPos, setMyPos] = useState(null);
  const [showOnlyTodo, setShowOnlyTodo] = useState(false);
  const [optimized, setOptimized] = useState(null);
  const [selected, setSelected] = useState(null);
  const [sp] = useSearchParams();
  const [route, setRoute] = useState(null);
  const [routeTo, setRouteTo] = useState(sp.get("route"));

  useEffect(() => {
    api.get("/riders/me/today").then(r => setOrders(r.data.orders || [])).catch(() => { });
    if (!navigator.geolocation) return;
    // Live GPS watch for rider: shows own position on map
    const wid = navigator.geolocation.watchPosition(
      p => setMyPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => { },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(wid);
  }, []);

  const enriched = useMemo(() => orders.map(o => ({ ...o, _pos: o.geo || pseudoCoord(o.code), _k: statusToKey(o.status) })), [orders]);
  const visible = showOnlyTodo ? enriched.filter(o => o._k === "a_livrer" || o._k === "en_route") : enriched;
  const noPos = []; // all have pseudo pos
  const markers = optimized ? optimized.map((o, i) => ({ ...o, _n: i + 1 })) : visible;
  const target = routeTo ? enriched.find(o => o.id === routeTo) : null;
  const origin = myPos || BASE;
  useEffect(() => {
    if (!target) { setRoute(null); return; }
    const ctrl = new AbortController();
    const fallback = () => {
      const R = 6371, dLat = (target._pos.lat - origin.lat) * Math.PI / 180, dLng = (target._pos.lng - origin.lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(origin.lat * Math.PI / 180) * Math.cos(target._pos.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      const km = 2 * R * Math.asin(Math.sqrt(a));
      setRoute({ line: [[origin.lat, origin.lng], [target._pos.lat, target._pos.lng]], km, min: km / 0.4, approx: true });
    };
    fetch(`https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${target._pos.lng},${target._pos.lat}?overview=full&geometries=geojson`, { signal: ctrl.signal })
      .then(r => r.json()).then(d => {
        const rt = d.routes?.[0]; if (!rt) return fallback();
        setRoute({ line: rt.geometry.coordinates.map(([lng, lat]) => [lat, lng]), km: rt.distance / 1000, min: rt.duration / 60 });
      }).catch(e => { if (e.name !== "AbortError") fallback(); });
    return () => ctrl.abort();
  }, [target?.id, Math.round(origin.lat * 1000), Math.round(origin.lng * 1000)]); // eslint-disable-line react-hooks/exhaustive-deps

  const optimize = () => {
    if (!myPos) return;
    // Nearest-neighbor from myPos
    const todo = enriched.filter(o => o._k === "a_livrer" || o._k === "en_route");
    const remaining = [...todo];
    const path = [];
    let cur = myPos;
    while (remaining.length) {
      let bestIdx = 0, bestD = Infinity;
      remaining.forEach((o, i) => { const d = (o._pos.lat - cur.lat) ** 2 + (o._pos.lng - cur.lng) ** 2; if (d < bestD) { bestD = d; bestIdx = i; } });
      const next = remaining.splice(bestIdx, 1)[0]; path.push(next); cur = next._pos;
    }
    setOptimized(path);
  };

  const pathLine = optimized && myPos ? [[myPos.lat, myPos.lng], ...optimized.map(o => [o._pos.lat, o._pos.lng])] : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setShowOnlyTodo(!showOnlyTodo)} className={`text-xs px-3 py-1.5 rounded-full border ${showOnlyTodo ? "bg-[#b02a2a] text-white border-[#b02a2a]" : "border-[#ececec]"}`} data-testid="map-filter-todo">{showOnlyTodo ? "Toutes" : "À livrer seulement"}</button>
        <button onClick={optimize} disabled={!myPos} className="dina-btn-primary !min-h-[36px] text-xs ml-auto" data-testid="map-optimize"><Shuffle size={12} />Optimiser ma tournée</button>
        {optimized && <button onClick={() => setOptimized(null)} className="text-xs text-[#666]">Annuler</button>}
      </div>
      <div className="rounded-xl overflow-hidden border border-[#ececec] dark:border-[#2a2a2a]" data-testid="rider-map">
        <MapContainer center={myPos ? [myPos.lat, myPos.lng] : [BASE.lat, BASE.lng]} zoom={13} style={{ height: 420, width: "100%" }} scrollWheelZoom>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
          {myPos && <Marker position={[myPos.lat, myPos.lng]} icon={riderIcon}><Popup>Vous êtes ici</Popup></Marker>}
          {markers.map((o, i) => (
            <Marker key={o.id} position={[o._pos.lat, o._pos.lng]} icon={optimized ? makeNumIcon(CLR[o._k], o._n) : makeIcon(CLR[o._k] || "#999")} eventHandlers={{ click: () => setSelected(o) }}>
              <Popup><div className="text-xs"><div className="font-semibold">{o.code}</div><div>{(o.customer?.name || "").split(" ")[0]} · {o.delivery_zone}</div></div></Popup>
            </Marker>
          ))}
          {pathLine && <Polyline positions={pathLine} color="#b02a2a" dashArray="6 6" />}
          {route && <Polyline positions={route.line} color="#5867fd" weight={5} opacity={0.85} dashArray={route.approx ? "8 8" : undefined} />}
          {route && <FitBounds points={route.line.map(([lat, lng]) => ({ lat, lng }))} />}
          {!route && markers.length > 0 && <FitBounds points={markers.map(o => o._pos).concat(myPos ? [myPos] : [])} />}
        </MapContainer>
      </div>
      {route && target && (
        <div className="dina-card-white p-3 flex items-center gap-3 flex-wrap" data-testid="map-route-panel">
          <div className="flex-1 min-w-0"><div className="text-sm font-semibold">Itinéraire → {target.code} · {(target.customer?.name || "").split(" ")[0]}</div>
            <div className="text-xs text-[#666] tabular" data-testid="map-route-stats">{route.km.toFixed(1)} km · ~{Math.max(1, Math.round(route.min))} min{route.approx ? " (estimation)" : ""}{!myPos ? " · activez la localisation" : ""}</div></div>
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${target._pos.lat},${target._pos.lng}`} target="_blank" rel="noreferrer" className="text-[11px] text-[#666] underline inline-flex items-center gap-1" data-testid="map-route-google"><ExternalLink size={11}/>Ouvrir dans Google Maps</a>
          <button onClick={() => setRouteTo(null)} className="text-xs text-[#b02a2a] font-semibold" data-testid="map-route-close">Fermer</button>
        </div>
      )}
      {selected && (
        <div className="fixed bottom-16 left-0 right-0 bg-white dark:bg-[#1a1a1a] border-t border-[#ececec] dark:border-[#2a2a2a] p-3 z-30 shadow-xl" data-testid="map-selected">
          <div className="max-w-md mx-auto">
            <div className="flex justify-between items-start mb-2"><div><div className="font-semibold">{selected.code} · {(selected.customer?.name || "").split(" ")[0]}</div><div className="text-xs text-[#666]">{selected.customer?.quartier || selected.delivery_zone}</div><div className="text-xs mt-0.5">{selected.payment_method === "cod" ? <span className="text-[#c62828] font-semibold">COD {fcfa(selected.total)}</span> : <span style={{ color: payInfo(selected).color }}>{payInfo(selected).label}</span>}</div></div><button onClick={() => setSelected(null)} className="text-[#999]">✕</button></div>
            <div className="grid grid-cols-4 gap-1.5">
              <a href={`tel:${selected.customer?.phone?.replace(/\D/g, "")}`} className="dina-btn-secondary !min-h-[40px] text-[10px] flex-col gap-0"><Phone size={12} />Appel</a>
              <a href={`https://wa.me/${selected.customer?.phone?.replace(/\D/g, "") || ""}`} target="_blank" rel="noreferrer" className="dina-btn-secondary !min-h-[40px] text-[10px] flex-col gap-0"><MessageCircle size={12} />WA</a>
              <button onClick={() => { setRouteTo(selected.id); setSelected(null); }} className="dina-btn-secondary !min-h-[40px] text-[10px] flex-col gap-0" data-testid="map-selected-route"><Navigation size={12} />Itinéraire</button>
              <Link to="/riders" className="dina-btn-primary !min-h-[40px] text-[10px] flex-col gap-0"><Package size={12} />Ouvrir</Link>
            </div>
          </div>
        </div>
      )}
      {noPos.length > 0 && (
        <div className="dina-card-white p-3"><div className="font-semibold text-sm mb-2">Sans position ({noPos.length})</div>{noPos.map(o => <div key={o.id} className="text-xs text-[#666] py-1">{o.code} · {o.customer?.address || o.delivery_zone}</div>)}</div>
      )}
    </div>
  );
}
