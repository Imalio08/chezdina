import React, { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import { X, ZoomIn, RotateCw } from "lucide-react";

const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

async function cropToDataUrl(src, area, rotation) {
  const img = await load(src);
  const c = document.createElement("canvas"); const S = 400;
  c.width = S; c.height = S;
  const ctx = c.getContext("2d");
  if (rotation) {
    const t = document.createElement("canvas"); const r = (rotation * Math.PI) / 180;
    const w = Math.abs(Math.cos(r)) * img.width + Math.abs(Math.sin(r)) * img.height;
    const h = Math.abs(Math.sin(r)) * img.width + Math.abs(Math.cos(r)) * img.height;
    t.width = w; t.height = h; const tc = t.getContext("2d");
    tc.translate(w / 2, h / 2); tc.rotate(r); tc.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.drawImage(t, area.x, area.y, area.width, area.height, 0, 0, S, S);
  } else ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, S, S);
  return c.toDataURL("image/jpeg", 0.85);
}

/** Round crop + zoom + rotation for the customer profile photo. */
export default function PhotoCropModal({ src, onClose, onDone }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [area, setArea] = useState(null);
  const [busy, setBusy] = useState(false);
  const onComplete = useCallback((_, px) => setArea(px), []);
  const save = async () => { if (!area) return; setBusy(true); try { await onDone(await cropToDataUrl(src, area, rotation)); } finally { setBusy(false); } };
  return (
    <div className="fixed inset-0 bg-black/70 z-[80] flex items-end sm:items-center justify-center sm:p-4" data-testid="photo-crop-modal">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-t-2xl sm:rounded-xl w-full sm:max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4"><div className="font-serif text-lg">Ajuster ma photo</div><button onClick={onClose} data-testid="photo-crop-close"><X size={16}/></button></div>
        <div className="relative h-[320px] bg-black">
          <Cropper image={src} crop={crop} zoom={zoom} rotation={rotation} aspect={1} cropShape="round" showGrid={false}
            onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onComplete} />
        </div>
        <div className="p-4 space-y-3">
          <label className="flex items-center gap-2 text-xs text-[#666]"><ZoomIn size={14}/>Zoom
            <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={e => setZoom(Number(e.target.value))} className="flex-1 accent-[#b02a2a]" data-testid="photo-crop-zoom"/></label>
          <button type="button" onClick={() => setRotation(r => (r + 90) % 360)} className="dina-btn-secondary w-full !min-h-[38px] text-sm" data-testid="photo-crop-rotate"><RotateCw size={14}/>Pivoter</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button>
            <button onClick={save} disabled={busy || !area} className="dina-btn-primary flex-1" data-testid="photo-crop-save">{busy ? "Enregistrement…" : "Enregistrer"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
