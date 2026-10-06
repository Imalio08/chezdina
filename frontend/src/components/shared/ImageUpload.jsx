import React, { useRef, useState } from "react";
import { Upload, X, Camera, GripVertical, Star } from "lucide-react";
import { toast } from "sonner";

/**
 * ImageUpload — drag & drop + camera, multi, auto resize to WebP under maxKB.
 * value: array of data URLs (strings). onChange(nextArray).
 * The first image is the "main" image.
 */
export default function ImageUpload({ value = [], onChange, max = 10, maxKB = 500, aspect, testid = "image-upload", single = false }) {
  const inp = useRef(null);
  const cam = useRef(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const list = Array.isArray(value) ? value : (value ? [value] : []);

  const compress = async (file) => {
    if (!file.type.startsWith("image/")) throw new Error("Fichier non-image");
    if (file.size > 10 * 1024 * 1024) throw new Error("Image > 10 Mo");
    const img = await new Promise((res, rej) => {
      const i = new Image();
      const r = new FileReader();
      r.onload = () => { i.onload = () => res(i); i.onerror = rej; i.src = r.result; };
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    // Resize to max 1200px long edge
    const MAX = 1200;
    const ratio = Math.min(1, MAX / Math.max(img.width, img.height));
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    // Try WebP at decreasing quality until under maxKB
    let quality = 0.85, data;
    for (let i = 0; i < 6; i++) {
      data = canvas.toDataURL("image/webp", quality);
      if (data.length * 0.75 / 1024 <= maxKB) break;
      quality -= 0.12;
    }
    return data;
  };

  const addFiles = async (files) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const compressed = [];
      for (const f of files) {
        try { compressed.push(await compress(f)); }
        catch (e) { toast.error(`${f.name} : ${e.message}`); }
      }
      const next = single ? compressed.slice(0,1) : [...list, ...compressed].slice(0, max);
      onChange?.(single ? (next[0]||"") : next);
    } finally { setBusy(false); }
  };

  const onDrop = (e) => { e.preventDefault(); setDrag(false); addFiles(Array.from(e.dataTransfer.files||[])); };
  const remove = (i) => { const next = list.filter((_,idx)=>idx!==i); onChange?.(single ? "" : next); };
  const setMain = (i) => { if (i===0 || single) return; const next = [...list]; const [picked] = next.splice(i,1); next.unshift(picked); onChange?.(next); };

  return (
    <div data-testid={testid}>
      <div onDragOver={e=>{e.preventDefault(); setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={onDrop}
           className={`border-2 border-dashed rounded-xl p-4 text-center transition ${drag?"border-[#b02a2a] bg-[#fff5f5] dark:bg-[#2a1818]":"border-[#ececec] dark:border-[#2a2a2a]"}`}>
        <input ref={inp} type="file" accept="image/*" multiple={!single} className="hidden" onChange={e=>addFiles(Array.from(e.target.files||[]))}/>
        <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>addFiles(Array.from(e.target.files||[]))}/>
        <Upload size={22} className="mx-auto text-[#999] mb-2"/>
        <div className="text-sm">
          {busy ? "Compression en cours…" : (
            <>Glissez-déposez ou <button onClick={()=>inp.current?.click()} className="text-[#b02a2a] hover:underline font-semibold" data-testid={`${testid}-browse`}>parcourir</button>
            <button onClick={()=>cam.current?.click()} className="ml-2 inline-flex items-center gap-1 text-[#b02a2a] hover:underline font-semibold md:hidden" data-testid={`${testid}-camera`}><Camera size={13}/>appareil photo</button></>
          )}
        </div>
        <div className="text-[11px] text-[#999] mt-1">WebP optimisé · {single?"1 image":`${max} max`} · 10 Mo max par fichier</div>
      </div>

      {list.length > 0 && (
        <div className={`grid gap-2 mt-3 ${single?"grid-cols-1":"grid-cols-2 md:grid-cols-4"}`}>
          {list.map((src, i) => (
            <div key={i} className="relative group aspect-square rounded-lg overflow-hidden bg-[#fafafa] dark:bg-[#141414] border border-[#ececec] dark:border-[#2a2a2a]" style={aspect?{aspectRatio:aspect}:undefined} data-testid={`${testid}-item-${i}`}>
              <img src={src} alt="" className="w-full h-full object-cover"/>
              {i===0 && !single && <span className="absolute top-1 left-1 bg-[#b02a2a] text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5"><Star size={9}/>Principale</span>}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center opacity-0 group-hover:opacity-100 gap-1">
                {i>0 && !single && <button onClick={()=>setMain(i)} className="bg-white text-[#1c1c1c] text-[10px] px-2 py-1 rounded font-semibold" data-testid={`${testid}-main-${i}`}>Principale</button>}
                <button onClick={()=>remove(i)} className="bg-[#c62828] text-white rounded-full p-1" data-testid={`${testid}-remove-${i}`}><X size={12}/></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
