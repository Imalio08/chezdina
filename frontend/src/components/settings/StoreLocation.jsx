import React from "react";
import { MapPin, Navigation2 } from "lucide-react";
import { useLocate } from "@/components/storefront/GeoHelp";
import { toast } from "sonner";

/** Store exact GPS position: current position or pin on map. value = {lat,lng}. */
export default function StoreLocation({ value, onChange }) {
  const geo = useLocate((c) => { onChange({ lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6) }); toast.success("Position de la boutique captée · pensez à enregistrer"); }, value?.lat ? value : null);
  const has = value?.lat && value?.lng;
  return (
    <div className="rounded-xl border border-[#ececec] dark:border-[#2a2a2a] p-3 space-y-2" data-testid="store-location">
      {geo.ui}
      <div className="text-sm font-semibold flex items-center gap-1.5"><MapPin size={14} className="text-[#b02a2a]"/>Position GPS de la boutique</div>
      <p className="text-xs text-[#666]">Utilisée sur la page Contact du site, dans l'app livreur (point de départ et retour) et partout où l'emplacement de la boutique est nécessaire.</p>
      {has ? (
        <div className="space-y-2">
          <div className="text-xs tabular" data-testid="store-location-coords">{value.lat}, {value.lng}</div>
          <iframe title="Boutique" className="w-full h-40 rounded-lg border-0" src={`https://www.openstreetmap.org/export/embed.html?bbox=${value.lng - 0.004}%2C${value.lat - 0.003}%2C${value.lng + 0.004}%2C${value.lat + 0.003}&layer=mapnik&marker=${value.lat}%2C${value.lng}`}/>
        </div>
      ) : <div className="text-xs text-[#e4991e]" data-testid="store-location-empty">Aucune position enregistrée</div>}
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={geo.locate} disabled={geo.busy} className="dina-btn-secondary !min-h-[38px] text-sm" data-testid="store-locate"><Navigation2 size={14}/>{geo.busy ? "Localisation…" : "Utiliser ma position actuelle"}</button>
        <button type="button" onClick={geo.openMap} className="dina-btn-secondary !min-h-[38px] text-sm" data-testid="store-map-pick"><MapPin size={14}/>Placer sur la carte</button>
      </div>
    </div>
  );
}
