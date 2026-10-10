import React, { useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import { X, RotateCw, RotateCcw, FlipHorizontal, Check, SlidersHorizontal, Sparkles } from "lucide-react";

let openFn = null;
// Opens the editor and resolves with the edited data URL (null if cancelled).
export function editImage(src, opts = {}) {
  if (!openFn) return Promise.resolve(src);
  return new Promise(resolve => openFn({ src, opts, resolve }));
}
export async function editImageFile(file, opts) {
  if (!file?.type?.startsWith("image/")) return file;
  const src = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  const out = await editImage(src, opts);
  if (!out) return null;
  const blob = await (await fetch(out)).blob();
  return new File([blob], (file.name || "image").replace(/\.\w+$/, "") + ".jpg", { type: blob.type || "image/jpeg" });
}

const BASE = { b: 100, c: 100, s: 100, w: 0, g: 0, sep: 0 };
const PRESETS = {
  Naturel: BASE, Lumineux: { ...BASE, b: 118, c: 105, s: 110 }, Chaud: { ...BASE, b: 104, s: 112, w: 25 },
  Froid: { ...BASE, b: 102, c: 104, s: 95, w: -25 }, "Noir & blanc": { ...BASE, c: 115, s: 0, g: 100 }, Vintage: { ...BASE, b: 105, c: 90, s: 80, sep: 45 },
};
const ASPECTS = [["Original", null], ["Carré", 1], ["4:5", 4 / 5], ["16:9", 16 / 9]];
const cssFilter = f => `brightness(${f.b}%) contrast(${f.c}%) saturate(${f.s}%) grayscale(${f.g}%) sepia(${f.sep}%)${f.w ? ` hue-rotate(${-f.w / 5}deg)` : ""}`;
const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

async function flipSrc(src) {
  const img = await load(src); const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const ctx = c.getContext("2d"); ctx.translate(img.width, 0); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0);
  return c.toDataURL("image/jpeg", 0.95);
}

function adjust(d, f) {
  const B = f.b / 100, C = f.c / 100, S = f.s / 100, G = f.g / 100, P = f.sep / 100, W = f.w * 0.6;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] * B, g = d[i + 1] * B, b = d[i + 2] * B;
    r = (r - 128) * C + 128; g = (g - 128) * C + 128; b = (b - 128) * C + 128;
    let l = 0.299 * r + 0.587 * g + 0.114 * b;
    r = l + (r - l) * S; g = l + (g - l) * S; b = l + (b - l) * S;
    if (G) { l = 0.299 * r + 0.587 * g + 0.114 * b; r += (l - r) * G; g += (l - g) * G; b += (l - b) * G; }
    if (P) { const sr = 0.393 * r + 0.769 * g + 0.189 * b, sg = 0.349 * r + 0.686 * g + 0.168 * b, sb = 0.272 * r + 0.534 * g + 0.131 * b; r += (sr - r) * P; g += (sg - g) * P; b += (sb - b) * P; }
    d[i] = r + W; d[i + 1] = g; d[i + 2] = b - W;
  }
}

function sharpen(id, a) {
  const { width: w, height: h, data: d } = id; const src = new Uint8ClampedArray(d);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) for (let k = 0; k < 3; k++) {
    const i = (y * w + x) * 4 + k;
    d[i] = src[i] * (1 + 4 * a) - a * (src[i - 4] + src[i + 4] + src[i - w * 4] + src[i + w * 4]);
  }
}

async function render(src, area, rotation, f, sharp) {
  const img = await load(src);
  const rad = rotation * Math.PI / 180, sin = Math.abs(Math.sin(rad)), cos = Math.abs(Math.cos(rad));
  const bw = img.width * cos + img.height * sin, bh = img.width * sin + img.height * cos;
  const c = document.createElement("canvas"); c.width = bw; c.height = bh;
  const ctx = c.getContext("2d"); ctx.translate(bw / 2, bh / 2); ctx.rotate(rad); ctx.drawImage(img, -img.width / 2, -img.height / 2);
  const s = Math.min(1, 1600 / Math.max(area.width, area.height));
  const out = document.createElement("canvas"); out.width = Math.round(area.width * s); out.height = Math.round(area.height * s);
  const o = out.getContext("2d"); o.drawImage(c, area.x, area.y, area.width, area.height, 0, 0, out.width, out.height);
  const id = o.getImageData(0, 0, out.width, out.height); adjust(id.data, f); if (sharp > 0) sharpen(id, sharp / 100); o.putImageData(id, 0, 0);
  return out.toDataURL("image/jpeg", 0.9);
}

function Slider({ label, value, min, max, onChange, testid }) {
  return <label className="block text-[11px] text-white/80">{label} <span className="tabular text-white/50">{value}</span>
    <input type="range" min={min} max={max} value={value} onChange={e => onChange(+e.target.value)} className="w-full accent-[#b02a2a]" data-testid={testid}/></label>;
}

function Editor({ job, onClose }) {
  const [src, setSrc] = useState(job.src);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [natural, setNatural] = useState(1);
  const [aspect, setAspect] = useState(job.opts.aspect || null);
  const [area, setArea] = useState(null);
  const [f, setF] = useState(BASE);
  const [sharp, setSharp] = useState(0);
  const [tab, setTab] = useState("adjust");
  const [busy, setBusy] = useState(false);
  const done = async () => {
    if (!area) return;
    setBusy(true);
    try { job.resolve(await render(src, area, rotation, f, sharp)); } catch { job.resolve(job.src); }
    onClose();
  };
  const cancel = () => { job.resolve(null); onClose(); };
  return (
    <div className="fixed inset-0 z-[120] bg-[#0f0f0f] flex flex-col" data-testid="image-editor">
      <div className="flex items-center justify-between p-3 text-white">
        <button onClick={cancel} className="p-2" data-testid="image-editor-cancel"><X size={20}/></button>
        <div className="font-serif text-lg">Modifier l'image</div>
        <button onClick={done} disabled={busy} className="dina-btn-primary !min-h-[36px] text-xs" data-testid="image-editor-apply"><Check size={14}/>{busy ? "…" : "Valider"}</button>
      </div>
      <div className="relative flex-1 min-h-[45vh]">
        <Cropper image={src} crop={crop} zoom={zoom} rotation={rotation} aspect={aspect || natural} onCropChange={setCrop} onZoomChange={setZoom}
          onRotationChange={setRotation} onCropComplete={(_, px) => setArea(px)} onMediaLoaded={m => setNatural(m.naturalWidth / m.naturalHeight)}
          style={{ mediaStyle: { filter: cssFilter(f) } }} showGrid/>
      </div>
      <div className="p-3 space-y-3 bg-[#161616] max-h-[42vh] overflow-y-auto">
        <div className="flex gap-1.5 overflow-x-auto">
          {ASPECTS.map(([l, v]) => <button key={l} onClick={() => setAspect(v)} className={`shrink-0 px-3 py-1 rounded-full text-xs ${aspect === v ? "bg-white text-black font-semibold" : "bg-white/10 text-white"}`} data-testid={`image-editor-aspect-${l}`}>{l}</button>)}
          <button onClick={() => setRotation(r => (r - 90) % 360)} className="shrink-0 px-2 rounded-full bg-white/10 text-white" title="Pivoter à gauche" data-testid="image-editor-rotate-left"><RotateCcw size={14}/></button>
          <button onClick={() => setRotation(r => (r + 90) % 360)} className="shrink-0 px-2 rounded-full bg-white/10 text-white" title="Pivoter à droite" data-testid="image-editor-rotate-right"><RotateCw size={14}/></button>
          <button onClick={async () => setSrc(await flipSrc(src))} className="shrink-0 px-2 rounded-full bg-white/10 text-white" title="Retourner" data-testid="image-editor-flip"><FlipHorizontal size={14}/></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Slider label="Zoom" value={Math.round(zoom * 100)} min={100} max={400} onChange={v => setZoom(v / 100)} testid="image-editor-zoom"/>
          <Slider label="Rotation" value={rotation} min={-180} max={180} onChange={setRotation} testid="image-editor-rotation"/>
        </div>
        <div className="flex gap-1 text-xs">
          <button onClick={() => setTab("adjust")} className={`px-3 py-1 rounded-md inline-flex items-center gap-1 ${tab === "adjust" ? "bg-white/15 text-white" : "text-white/60"}`} data-testid="image-editor-tab-adjust"><SlidersHorizontal size={12}/>Réglages</button>
          <button onClick={() => setTab("filters")} className={`px-3 py-1 rounded-md inline-flex items-center gap-1 ${tab === "filters" ? "bg-white/15 text-white" : "text-white/60"}`} data-testid="image-editor-tab-filters"><Sparkles size={12}/>Filtres</button>
        </div>
        {tab === "adjust" ? (
          <div className="grid grid-cols-2 gap-3">
            <Slider label="Luminosité" value={f.b} min={50} max={150} onChange={v => setF({ ...f, b: v })} testid="image-editor-brightness"/>
            <Slider label="Contraste" value={f.c} min={50} max={150} onChange={v => setF({ ...f, c: v })} testid="image-editor-contrast"/>
            <Slider label="Saturation" value={f.s} min={0} max={200} onChange={v => setF({ ...f, s: v })} testid="image-editor-saturation"/>
            <Slider label="Netteté" value={sharp} min={0} max={100} onChange={setSharp} testid="image-editor-sharpness"/>
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {Object.entries(PRESETS).map(([name, p]) => (
              <button key={name} onClick={() => setF(p)} className="shrink-0 text-center" data-testid={`image-editor-filter-${name}`}>
                <img src={job.src} alt={name} className={`w-16 h-16 object-cover rounded-lg ${JSON.stringify(f) === JSON.stringify(p) ? "ring-2 ring-[#b02a2a]" : ""}`} style={{ filter: cssFilter(p) }}/>
                <div className="text-[10px] text-white/80 mt-1">{name}</div>
              </button>
            ))}
          </div>
        )}
        <button onClick={() => { job.resolve(job.src); onClose(); }} className="text-[11px] text-white/50 underline" data-testid="image-editor-original">Utiliser l'image d'origine</button>
      </div>
    </div>
  );
}

export function ImageEditorHost() {
  const [job, setJob] = useState(null);
  useEffect(() => { openFn = setJob; return () => { openFn = null; }; }, []);
  return job ? <Editor key={job.src.length + job.src.slice(-20)} job={job} onClose={() => setJob(null)}/> : null;
}
