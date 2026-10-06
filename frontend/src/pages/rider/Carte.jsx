import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { Phone, MessageCircle, Navigation, Package, Shuffle } from "lucide-react";
import { Link } from "react-router-dom";

const CLR = { a_livrer: "#e4991e", en_route: "#5867fd", livree: "#1f8a4c", annulee: "#c62828", echouee: "#c62828", reportee: "#999" };
const statusToKey = (s) => s === "en_livraison" ? "en_route" : s === "livree" ? "livree" : s === "annulee" ? "annulee" : s === "echouee" ? "echouee" : s === "reportee" ? "reportee" : "a_livrer";
const makeIcon = (color) => L.divIcon({ className: "", html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:grid;place-items:center;color:white;font-weight:bold;font-size:11px"></div>`, iconSize: [28, 28], iconAnchor: [14, 14] });
const makeNumIcon = (color, n) => L.divIcon({ className: "", html: `<div style="width:32px;height:32px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:grid;place-items:center;color:white;font-weight:bold;font-size:13px">${n}</div>`, iconSize: [32, 32], iconAnchor: [16, 16] });

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

  useEffect(() => {
    api.get("/riders/me/today").then(r => setOrders(r.data.orders || [])).catch(() => { });
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => setMyPos({ lat: p.coords.latitude, lng: p.coords.longitude }), () => { }, { timeout: 5000 });
  }, []);

  const enriched = useMemo(() => orders.map(o => ({ ...o, _pos: o.geo || pseudoCoord(o.code), _k: statusToKey(o.status) })), [orders]);
  const visible = showOnlyTodo ? enriched.filter(o => o._k === "a_livrer" || o._k === "en_route") : enriched;
  const noPos = []; // all have pseudo pos
  const markers = optimized ? optimized.map((o, i) => ({ ...o, _n: i + 1 })) : visible;

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
          {myPos && <Marker position={[myPos.lat, myPos.lng]} icon={makeIcon("#b02a2a")}><Popup>Vous êtes ici</Popup></Marker>}
          {markers.map((o, i) => (
            <Marker key={o.id} position={[o._pos.lat, o._pos.lng]} icon={optimized ? makeNumIcon(CLR[o._k], o._n) : makeIcon(CLR[o._k] || "#999")} eventHandlers={{ click: () => setSelected(o) }}>
              <Popup><div className="text-xs"><div className="font-semibold">{o.code}</div><div>{(o.customer?.name || "").split(" ")[0]} · {o.delivery_zone}</div></div></Popup>
            </Marker>
          ))}
          {pathLine && <Polyline positions={pathLine} color="#b02a2a" dashArray="6 6" />}
          {markers.length > 0 && <FitBounds points={markers.map(o => o._pos).concat(myPos ? [myPos] : [])} />}
        </MapContainer>
      </div>
      {selected && (
        <div className="fixed bottom-16 left-0 right-0 bg-white dark:bg-[#1a1a1a] border-t border-[#ececec] dark:border-[#2a2a2a] p-3 z-30 shadow-xl" data-testid="map-selected">
          <div className="max-w-md mx-auto">
            <div className="flex justify-between items-start mb-2"><div><div className="font-semibold">{selected.code} · {(selected.customer?.name || "").split(" ")[0]}</div><div className="text-xs text-[#666]">{selected.customer?.quartier || selected.delivery_zone}</div><div className="text-xs mt-0.5">{selected.payment_method === "cod" ? <span className="text-[#c62828] font-semibold">COD {fcfa(selected.total)}</span> : <span className="text-[#1f8a4c]">Payé</span>}</div></div><button onClick={() => setSelected(null)} className="text-[#999]">✕</button></div>
            <div className="grid grid-cols-4 gap-1.5">
              <a href={`tel:${selected.customer?.phone?.replace(/\D/g, "")}`} className="dina-btn-secondary !min-h-[40px] text-[10px] flex-col gap-0"><Phone size={12} />Appel</a>
              <a href={`https://wa.me/${selected.customer?.phone?.replace(/\D/g, "") || ""}`} target="_blank" rel="noreferrer" className="dina-btn-secondary !min-h-[40px] text-[10px] flex-col gap-0"><MessageCircle size={12} />WA</a>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${selected._pos.lat},${selected._pos.lng}`} target="_blank" rel="noreferrer" className="dina-btn-secondary !min-h-[40px] text-[10px] flex-col gap-0"><Navigation size={12} />GPS</a>
              <Link to="/rider" className="dina-btn-primary !min-h-[40px] text-[10px] flex-col gap-0"><Package size={12} />Ouvrir</Link>
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
