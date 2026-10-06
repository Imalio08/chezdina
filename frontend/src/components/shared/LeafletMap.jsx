import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons (webpack can't resolve the paths bundled in leaflet)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Red marker icon for riders
const riderIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet-color-markers@1.0.0/img/marker-icon-red.png",
  iconRetinaUrl: "https://unpkg.com/leaflet-color-markers@1.0.0/img/marker-icon-2x-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions && positions.length) {
      const bounds = L.latLngBounds(positions.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds.pad(0.3), { animate: true });
    }
  }, [positions, map]);
  return null;
}

export default function LeafletMap({ markers = [], center = [5.345317, -4.024429], zoom = 12, height = 480 }) {
  return (
    <div style={{ height, borderRadius: 12, overflow: "hidden" }} data-testid="leaflet-map">
      <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
        />
        {markers.map((m, i) => (
          <Marker key={i} position={[m.lat, m.lng]} icon={riderIcon}>
            <Popup>
              <div style={{ minWidth: 150 }}>
                <div style={{ fontWeight: 600 }}>{m.title || m.rider_name}</div>
                {m.subtitle && <div style={{ fontSize: 12, color: "#666" }}>{m.subtitle}</div>}
                {m.updated_at && (
                  <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
                    MAJ: {new Date(m.updated_at).toLocaleTimeString("fr-FR")}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
        {markers.length > 0 && <FitBounds positions={markers} />}
      </MapContainer>
    </div>
  );
}
