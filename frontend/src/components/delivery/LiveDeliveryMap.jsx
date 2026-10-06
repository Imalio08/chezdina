import React, { useEffect, useRef } from "react";

/* Leaflet live map of riders + order pins colored by status.
   Props:
   - riders: [{ rider_id, rider_name, lat, lng, updated_at }]
   - orders: [{ id, code, status, customer, delivery_zone, lat?, lng? }]
   Points without lat/lng are skipped. Centers on Abidjan by default. */

const ABIDJAN = [5.35, -4.02];

const STATUS_COLORS = {
  prete: "#f4b12c",
  assignee: "#5867fd",
  en_livraison: "#0021cc",
  livree: "#1f8a4c",
  annulee: "#c62828",
  echouee: "#c62828",
};

export default function LiveDeliveryMap({ riders = [], orders = [], height = 420 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const LRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;
      LRef.current = L;
      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, { zoomControl: true, attributionControl: false }).setView(ABIDJAN, 11);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(mapRef.current);
      }
      layerRef.current = L.layerGroup().addTo(mapRef.current);
      draw();
    };
    boot();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  const draw = () => {
    const L = LRef.current; const map = mapRef.current; const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    const bounds = [];
    // Order pins
    orders.forEach(o => {
      const lat = o.lat ?? o.customer?.lat; const lng = o.lng ?? o.customer?.lng;
      if (!lat || !lng) return;
      const color = STATUS_COLORS[o.status] || "#999";
      const icon = L.divIcon({
        className: "",
        html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
        iconSize: [14,14], iconAnchor: [7,7],
      });
      const m = L.marker([lat, lng], { icon }).addTo(layer);
      m.bindPopup(`<strong>${o.code || ""}</strong><br/>${o.customer?.name || ""}<br/><em>${o.delivery_zone || ""}</em><br/>${o.status}`);
      bounds.push([lat, lng]);
    });
    // Rider live positions
    riders.forEach(r => {
      if (!r.lat || !r.lng) return;
      const icon = L.divIcon({
        className: "",
        html: `<div style="background:#b02a2a;color:white;width:30px;height:30px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px">${(r.rider_name||"?").slice(0,2).toUpperCase()}</div>`,
        iconSize: [30,30], iconAnchor: [15,15],
      });
      const m = L.marker([r.lat, r.lng], { icon }).addTo(layer);
      m.bindPopup(`<strong>${r.rider_name}</strong><br/>Position live<br/><em>maj ${new Date(r.updated_at).toLocaleTimeString("fr-FR")}</em>`);
      bounds.push([r.lat, r.lng]);
    });
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [40,40], maxZoom: 14 });
    else if (bounds.length === 1) map.setView(bounds[0], 13);
  };

  useEffect(() => { draw(); }, [JSON.stringify(riders), JSON.stringify(orders)]); // eslint-disable-line

  return (
    <div className="rounded-xl overflow-hidden border border-[#ececec] dark:border-[#2a2a2a]" style={{ height }} data-testid="live-delivery-map">
      <div ref={containerRef} style={{ width: "100%", height: "100%" }}/>
      <div className="flex flex-wrap gap-2 p-2 text-[10px] bg-white dark:bg-[#141414] border-t border-[#ececec] dark:border-[#2a2a2a]">
        {Object.entries(STATUS_COLORS).map(([k, c]) => (
          <span key={k} className="flex items-center gap-1 capitalize"><span className="w-2 h-2 rounded-full" style={{background:c}}/>{k.replace("_"," ")}</span>
        ))}
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#b02a2a] border border-white"/>Livreur</span>
      </div>
    </div>
  );
}
