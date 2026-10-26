import React, { useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { X, MapPin, Check } from "lucide-react";
import { getPosition } from "@/lib/permissions";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const ABIDJAN = { lat: 5.345317, lng: -4.024429 };
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function ClickPick({ onPick }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/** Map where the customer taps (or drags the pin) to set her delivery position. */
export function MapPicker({ initial, onClose, onPick }) {
  const [pos, setPos] = useState(initial?.lat ? initial : null);
  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-end sm:items-center justify-center sm:p-4" onClick={onClose} data-testid="map-picker">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-t-2xl sm:rounded-xl w-full sm:max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4"><div className="font-serif text-lg">Placer ma position</div><button onClick={onClose} data-testid="map-picker-close"><X size={16}/></button></div>
        <div className="px-4 pb-2 text-xs text-[#666]">Touchez la carte à l'endroit exact de livraison, puis déplacez l'épingle si besoin.</div>
        <div className="h-[55vh]">
          <MapContainer center={pos || ABIDJAN} zoom={pos ? 16 : 12} style={{ height: "100%", width: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
            <ClickPick onPick={setPos} />
            {pos && <Marker position={pos} draggable eventHandlers={{ dragend: (e) => { const l = e.target.getLatLng(); setPos({ lat: l.lat, lng: l.lng }); } }} />}
          </MapContainer>
        </div>
        <div className="p-4 flex gap-2">
          <button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button>
          <button disabled={!pos} onClick={() => onPick(pos)} className="dina-btn-primary flex-1" data-testid="map-picker-confirm"><Check size={14}/>Valider cette position</button>
        </div>
      </div>
    </div>
  );
}

/** Explains how to allow location on iPhone / Android, with a manual-map alternative. */
export function GeoHelpModal({ onClose, onRetry, onManual }) {
  const ios = isIOS();
  const Steps = ({ title, items, testid }) => (
    <div className="rounded-lg border border-[#ececec] dark:border-[#2a2a2a] p-3" data-testid={testid}>
      <div className="text-sm font-semibold mb-1">{title}</div>
      <ol className="list-decimal pl-4 text-xs text-[#666] space-y-0.5">{items.map(s => <li key={s}>{s}</li>)}</ol>
    </div>
  );
  const iphone = <Steps key="i" testid="geo-help-iphone" title="Sur iPhone" items={["Ouvrez Réglages › Confidentialité et sécurité › Service de localisation : activez-le", "Descendez jusqu'à Safari (ou votre navigateur) › choisissez « Lorsque l'app est active »", "Revenez ici et touchez « Réessayer »"]} />;
  const android = <Steps key="a" testid="geo-help-android" title="Sur Android" items={["Activez la Localisation (glissez le haut de l'écran › icône Position)", "Dans Chrome, touchez le cadenas à gauche de l'adresse › Autorisations › Position › Autoriser", "Revenez ici et touchez « Réessayer »"]} />;
  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-end sm:items-center justify-center sm:p-4" onClick={onClose} data-testid="geo-help">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-t-2xl sm:rounded-xl p-5 w-full sm:max-w-md max-h-[90vh] overflow-y-auto space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <div><div className="font-serif text-xl">Position non autorisée</div><div className="text-xs text-[#666]">Autorisez la localisation pour que le livreur vous trouve facilement.</div></div>
          <button onClick={onClose} data-testid="geo-help-close"><X size={16}/></button>
        </div>
        {ios ? [iphone, android] : [android, iphone]}
        <button onClick={onRetry} className="dina-btn-secondary w-full" data-testid="geo-help-retry">Réessayer</button>
        <button onClick={onManual} className="dina-btn-primary w-full" data-testid="geo-help-manual"><MapPin size={14}/>Placer ma position sur la carte</button>
      </div>
    </div>
  );
}

/** Hook: GPS with help modal + manual map fallback. Render `ui` somewhere in the component. */
export function useLocate(onOk, current) {
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const [picker, setPicker] = useState(false);
  const locate = async () => {
    if (!navigator.geolocation) { setHelp(true); return; }
    setBusy(true);
    const c = await getPosition({ timeout: 12000, maximumAge: 0 });
    setBusy(false);
    if (c) { setHelp(false); onOk({ lat: c.latitude, lng: c.longitude }); } else setHelp(true);
  };
  const ui = <>
    {help && <GeoHelpModal onClose={() => setHelp(false)} onRetry={locate} onManual={() => { setHelp(false); setPicker(true); }} />}
    {picker && <MapPicker initial={current} onClose={() => setPicker(false)} onPick={(c) => { setPicker(false); onOk(c); }} />}
  </>;
  return { locate, busy, openMap: () => setPicker(true), ui };
}
