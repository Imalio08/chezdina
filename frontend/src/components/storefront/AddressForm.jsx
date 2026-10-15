import React, { useState } from "react";
import { toast } from "sonner";
import { MapPin, Navigation2, X } from "lucide-react";

export const DELIVERY_ZONES = {"Cocody":1500,"Riviera":2000,"Angré":2000,"Plateau":1000,"Marcory":1500,"Zone 4":1500,"Treichville":1500,"Koumassi":2000,"Yopougon":2500,"Abobo":3000,"Adjamé":1500,"Port-Bouët":2500,"Bingerville":3000,"Songon":3500,"Grand-Bassam":5000};
export const LABELS = ["Maison", "Bureau", "Famille", "Autre"];

export const addressLine = (a) => [a.quartier, a.rue, a.reperes].filter(Boolean).join(" · ") || a.address || "";

export function locateMe(onOk, setBusy) {
  if (!navigator.geolocation) return toast.error("Géolocalisation non disponible");
  setBusy(true);
  navigator.geolocation.getCurrentPosition(
    (p) => { onOk({ lat: p.coords.latitude, lng: p.coords.longitude }); toast.success("Position captée"); setBusy(false); },
    () => { toast.error("Impossible de vous localiser · autorisez la géolocalisation ou saisissez l'adresse"); setBusy(false); },
    { enableHighAccuracy: true, timeout: 12000 }
  );
}

export function MiniMap({ lat, lng, height = 160 }) {
  return (
    <div className="rounded-lg overflow-hidden border border-[#ececec]">
      <iframe title="Carte" width="100%" height={height} frameBorder="0" style={{ border: 0 }}
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.003}%2C${lat - 0.002}%2C${lng + 0.003}%2C${lat + 0.002}&layer=mapnik&marker=${lat}%2C${lng}`} data-testid="address-map"/>
      <div className="bg-[#fff5f5] text-[11px] text-[#666] px-3 py-1.5 tabular">{lat.toFixed(5)}, {lng.toFixed(5)} · partagée avec le livreur</div>
    </div>
  );
}

// Address fields (label, zone, quartier, rue, repères, GPS). Used inline at checkout and in the modal.
export function AddressFields({ v, setV, showDefault = true }) {
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  return (
    <div className="space-y-2" data-testid="address-fields">
      <div className="flex gap-1.5 flex-wrap">
        {LABELS.map(l => <button key={l} type="button" onClick={() => setV({ ...v, label: l })} className={`px-3 py-1.5 rounded-full text-xs border ${v.label === l ? "bg-[#1c1c1c] text-white border-[#1c1c1c]" : "border-[#ececec]"}`} data-testid={`addr-label-${l}`}>{l}</button>)}
      </div>
      <button type="button" onClick={() => locateMe(c => setV({ ...v, ...c }), setBusy)} disabled={busy} className="dina-btn-secondary w-full !min-h-[40px] text-sm" data-testid="addr-locate">
        <Navigation2 size={14}/>{busy ? "Localisation…" : v.lat ? "Repositionner ma position GPS" : "Utiliser ma position GPS"}
      </button>
      {v.lat ? <MiniMap lat={v.lat} lng={v.lng}/> : <div className="text-[11px] text-[#666] bg-[#fff5f5] rounded-lg p-2.5 flex gap-2"><MapPin size={12} className="mt-0.5 text-[#b02a2a] shrink-0"/>Facultatif mais recommandé : le livreur vous trouve plus vite.</div>}
      <select className="dina-input" value={v.zone} onChange={set("zone")} data-testid="addr-zone">
        <option value="">Commune / zone…</option>
        {Object.keys(DELIVERY_ZONES).map(z => <option key={z}>{z}</option>)}
      </select>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input className="dina-input" placeholder="Quartier (ex : Angré 8e tranche)" value={v.quartier} onChange={set("quartier")} data-testid="addr-quartier"/>
        <input className="dina-input" placeholder="Rue, résidence, immeuble" value={v.rue} onChange={set("rue")} data-testid="addr-rue"/>
      </div>
      <textarea className="dina-input" rows={2} placeholder="Repères et précisions (ex : en face de la pharmacie, portail bleu)" value={v.reperes} onChange={set("reperes")} data-testid="addr-reperes"/>
      {showDefault && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!v.default} onChange={e => setV({ ...v, default: e.target.checked })} data-testid="addr-default"/>Adresse par défaut</label>}
    </div>
  );
}

export const emptyAddress = (a = {}) => ({ id: a.id, label: a.label || "Maison", zone: a.zone || "", quartier: a.quartier || "", rue: a.rue || "", reperes: a.reperes || (a.quartier ? "" : a.address || ""), lat: a.lat || null, lng: a.lng || null, default: !!a.default });
export const validAddress = (v) => v.zone && (v.quartier || v.rue || v.reperes || v.lat);
export const toPayload = (v) => ({ ...v, address: addressLine(v) });

export function AddressModal({ initial, onClose, onSave }) {
  const [v, setV] = useState(emptyAddress(initial));
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!validAddress(v)) return toast.error("Indiquez la zone et au moins un détail (quartier, rue, repère ou GPS)");
    setSaving(true); try { await onSave(toPayload(v)); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4" onClick={onClose} data-testid="address-modal">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-t-2xl sm:rounded-xl p-5 w-full sm:max-w-lg max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between mb-4"><div className="font-serif text-xl">{initial?.id ? "Modifier l'adresse" : "Nouvelle adresse"}</div><button onClick={onClose} data-testid="address-modal-close"><X size={16}/></button></div>
        <AddressFields v={v} setV={setV}/>
        <div className="flex gap-2 mt-4"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={save} disabled={saving} className="dina-btn-primary flex-1" data-testid="addr-save">{saving ? "…" : "Enregistrer"}</button></div>
      </div>
    </div>
  );
}
