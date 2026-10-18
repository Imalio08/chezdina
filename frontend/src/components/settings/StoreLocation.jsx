import React, { useState } from "react";
import { MapPin, Navigation2 } from "lucide-react";
import { useLocate } from "@/components/storefront/GeoHelp";
import { toast } from "sonner";

/** Store exact GPS position: current position (high accuracy), pin on the map, or typed coordinates. value = {lat,lng}. */
export default function StoreLocation({ value, onChange }) {
  const set = (lat, lng) => onChange({ lat: +(+lat).toFixed(6), lng: +(+lng).toFixed(6) });
  const geo = useLocate((c) => { set(c.lat, c.lng); toast.success("Position de la boutique placée · pensez à enregistrer"); }, value?.lat ? value : null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState({ lat: value?.lat ?? "", lng: value?.lng ?? "" });
  const has = value?.lat && value?.lng;
  const here = () => {
    if (!navigator.geolocation) return geo.locate();
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setBusy(false); set(p.coords.latitude, p.coords.longitude); setManual({ lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) }); toast.success(`Position placée (précision ${Math.round(p.coords.accuracy)} m) · déplacez l'épingle si besoin`); },
      () => { setBusy(false); geo.locate(); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };
  const applyManual = () => {
    const lat = parseFloat(String(manual.lat).replace(",", ".")), lng = parseFloat(String(manual.lng).replace(",", "."));
    if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return toast.error("Coordonnées invalides (ex. 5.359952 et -3.996645)");
    set(lat, lng); toast.success("Coordonnées appliquées · pensez à enregistrer");
  };
  return (
    <div className="rounded-xl border border-[#ececec] dark:border-[#2a2a2a] p-3 space-y-2" data-testid="store-location">
      {geo.ui}
      <div className="text-sm font-semibold flex items-center gap-1.5"><MapPin size={14} className="text-[#b02a2a]"/>Position GPS de la boutique</div>
      <p className="text-xs text-[#666]">Utilisée sur la page Contact du site, dans l'app livreur (point de départ et retour) et partout où l'emplacement de la boutique est nécessaire.</p>
      {has ? (
        <div className="space-y-2">
          <div className="text-xs tabular" data-testid="store-location-coords">{value.lat}, {value.lng}</div>
          <iframe title="Boutique" className="w-full h-48 rounded-lg border-0" src={`https://maps.google.com/maps?q=${value.lat},${value.lng}&z=18&output=embed`} data-testid="store-location-map"/>
        </div>
      ) : <div className="text-xs text-[#e4991e]" data-testid="store-location-empty">Aucune position enregistrée</div>}
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={here} disabled={busy || geo.busy} className="dina-btn-secondary !min-h-[38px] text-sm" data-testid="store-locate"><Navigation2 size={14}/>{busy || geo.busy ? "Localisation…" : "Utiliser ma position actuelle"}</button>
        <button type="button" onClick={geo.openMap} className="dina-btn-secondary !min-h-[38px] text-sm" data-testid="store-map-pick"><MapPin size={14}/>Déplacer l'épingle sur la carte</button>
      </div>
      <div className="flex gap-2 items-center flex-wrap text-xs">
        <input className="dina-input !w-36 tabular" inputMode="decimal" placeholder="Latitude" value={manual.lat} onChange={e => setManual({ ...manual, lat: e.target.value })} data-testid="store-lat"/>
        <input className="dina-input !w-36 tabular" inputMode="decimal" placeholder="Longitude" value={manual.lng} onChange={e => setManual({ ...manual, lng: e.target.value })} data-testid="store-lng"/>
        <button type="button" onClick={applyManual} className="dina-btn-secondary !min-h-[36px] text-xs" data-testid="store-coords-apply">Appliquer</button>
      </div>
    </div>
  );
}
