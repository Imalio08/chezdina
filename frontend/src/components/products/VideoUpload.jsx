import React, { useRef, useState } from "react";
import { toast } from "sonner";
import { Video, X, Upload, Play } from "lucide-react";

/* Up to 2 videos (MP4/MOV) ≤ 60s ≤ 50 MB. Base64 data URL in-memory for mock DB. */
const MAX_VIDEOS = 2;
const MAX_SIZE_MB = 50;
const MAX_DURATION = 60;

export default function VideoUpload({ videos = [], onChange }) {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);

  const probeDuration = (file) => new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration || 0); };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(file);
  });

  const handleFile = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (videos.length >= MAX_VIDEOS) return toast.error(`Maximum ${MAX_VIDEOS} vidéos`);
    const mime = f.type || "";
    if (!/^video\/(mp4|quicktime|mov)/i.test(mime)) return toast.error("Format accepté : MP4 ou MOV");
    const sizeMB = f.size / 1024 / 1024;
    if (sizeMB > MAX_SIZE_MB) return toast.error(`Taille max ${MAX_SIZE_MB} MB (fichier ${sizeMB.toFixed(1)} MB)`);
    setLoading(true);
    try {
      const dur = await probeDuration(f);
      if (dur > MAX_DURATION + 2) return toast.error(`Durée max ${MAX_DURATION} s (vidéo ${dur.toFixed(0)} s)`);
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f);
      });
      onChange([...videos, b64]);
      toast.success(`Vidéo ajoutée (${dur.toFixed(0)}s · ${sizeMB.toFixed(1)} MB)`);
    } catch (e) { toast.error("Erreur chargement vidéo"); }
    finally { setLoading(false); }
  };

  const remove = (i) => onChange(videos.filter((_, idx) => idx !== i));

  return (
    <div data-testid="video-upload">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-[#666]"><b>{videos.length}</b> / {MAX_VIDEOS} vidéos · MP4 ou MOV · ≤ {MAX_DURATION} s · ≤ {MAX_SIZE_MB} MB</div>
        {videos.length < MAX_VIDEOS && (
          <button type="button" onClick={() => inputRef.current?.click()} disabled={loading} className="dina-btn-secondary !min-h-[32px] text-xs" data-testid="video-add"><Upload size={11}/>{loading ? "Analyse…" : "Ajouter une vidéo"}</button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="video/mp4,video/quicktime,.mp4,.mov" onChange={handleFile} className="hidden"/>
      <div className="grid grid-cols-2 gap-2">
        {videos.map((src, i) => (
          <div key={i} className="relative rounded-lg overflow-hidden border border-[#ececec] dark:border-[#2a2a2a]" data-testid={`video-slot-${i}`}>
            <video src={src} controls preload="metadata" className="w-full h-32 object-cover bg-black" playsInline muted/>
            <button type="button" onClick={() => remove(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white grid place-items-center" data-testid={`video-remove-${i}`}><X size={11}/></button>
            <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1"><Video size={9}/>Vidéo {i + 1}</div>
          </div>
        ))}
        {videos.length === 0 && (
          <div className="col-span-2 border-2 border-dashed border-[#ececec] dark:border-[#2a2a2a] rounded-lg py-8 text-center text-xs text-[#999]">
            <Play size={20} className="mx-auto mb-1 opacity-50"/>
            Aucune vidéo · cliquez sur "Ajouter une vidéo" pour commencer
          </div>
        )}
      </div>
      <div className="text-[10px] text-[#999] italic mt-2">
        Astuce : la vidéo ne se lance jamais toute seule sur mobile (économie data clientes). Elle démarre au tap, en muet.
      </div>
    </div>
  );
}
