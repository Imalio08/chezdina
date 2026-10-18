import React, { useState } from "react";
import { toast } from "sonner";
import { Wand2, X, Sparkles, Plus, Loader2 } from "lucide-react";
import api from "@/lib/api";

// AI magic wand: proposes backgrounds/visuals from the real photo; results are added only as extra "IA" visuals
export function AiVisualsSection({ photos = [], value = [], onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3" data-testid="ai-visuals">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-[#666]">La photo principale reste toujours une vraie photo du produit.</div>
        <button type="button" onClick={() => photos.length ? setOpen(true) : toast.error("Ajoutez d'abord une vraie photo du produit")} className="dina-btn-secondary !min-h-[34px] text-xs" data-testid="ai-wand-btn"><Wand2 size={13}/>Baguette magique IA</button>
      </div>
      {value.length > 0 && (
        <div className="mt-2">
          <div className="text-[10px] uppercase font-semibold text-[#7c3aed] mb-1">Visuels IA · images complémentaires</div>
          <div className="flex flex-wrap gap-2">
            {value.map((u, i) => (
              <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-[#7c3aed]" data-testid={`ai-visual-${i}`}>
                <img src={u} alt="Visuel IA" className="w-full h-full object-cover"/>
                <span className="absolute bottom-0 left-0 right-0 bg-[#7c3aed] text-white text-[9px] font-bold text-center">IA</span>
                <button type="button" onClick={() => onChange(value.filter((_, k) => k !== i))} className="absolute top-0.5 right-0.5 bg-white/90 rounded-full p-0.5" aria-label="Retirer" data-testid={`ai-visual-remove-${i}`}><X size={10}/></button>
              </div>
            ))}
          </div>
        </div>
      )}
      {open && <AiWandModal photos={photos} onAdd={u => onChange([...value, u])} onClose={() => setOpen(false)}/>}
    </div>
  );
}

function AiWandModal({ photos, onAdd, onClose }) {
  const [src, setSrc] = useState(photos[0]);
  const [ideas, setIdeas] = useState(null);
  const [busy, setBusy] = useState("");
  const [results, setResults] = useState([]);
  const analyze = async () => {
    setBusy("analyze");
    try { const r = await api.post("/products/ai/analyze", { image: src }); setIdeas(r.data.ideas || []); }
    catch (e) { toast.error(e.response?.data?.detail || "Analyse impossible"); }
    finally { setBusy(""); }
  };
  const generate = async (idea) => {
    setBusy(idea.title);
    try { const r = await api.post("/products/ai/generate", { image: src, prompt: idea.prompt }, { timeout: 130000 }); setResults(x => [{ title: idea.title, url: r.data.image }, ...x]); }
    catch (e) { toast.error(e.response?.data?.detail || "Visuel non créé"); }
    finally { setBusy(""); }
  };
  return (
    <div className="fixed inset-0 bg-black/60 z-[70] grid place-items-center p-4" onClick={e => e.target === e.currentTarget && onClose()} data-testid="ai-wand-modal">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3"><div className="font-serif text-xl flex items-center gap-2"><Wand2 size={18} className="text-[#7c3aed]"/>Baguette magique</div><button onClick={onClose} aria-label="Fermer" data-testid="ai-wand-close"><X size={18}/></button></div>
        <div className="text-xs text-[#666] mb-2">Photo de départ</div>
        <div className="flex gap-2 flex-wrap mb-4">{photos.map((p, i) => <button key={i} type="button" onClick={() => { setSrc(p); setIdeas(null); }} className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${src === p ? "border-[#7c3aed]" : "border-transparent"}`} data-testid={`ai-src-${i}`}><img src={p} alt="" className="w-full h-full object-cover"/></button>)}</div>
        {!ideas ? (
          <button onClick={analyze} disabled={!!busy} className="dina-btn-primary w-full !bg-[#7c3aed]" data-testid="ai-analyze">{busy ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}{busy ? "Analyse de la photo…" : "Analyser la photo et proposer des fonds"}</button>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="ai-ideas">
            {ideas.map((i, k) => <button key={k} type="button" onClick={() => generate(i)} disabled={!!busy} className="text-left p-3 rounded-lg border border-[#ececec] hover:border-[#7c3aed] disabled:opacity-50" data-testid={`ai-idea-${k}`}><div className="font-semibold text-sm flex items-center gap-1">{busy === i.title ? <Loader2 size={12} className="animate-spin"/> : <Wand2 size={12} className="text-[#7c3aed]"/>}{i.title}</div><div className="text-[11px] text-[#666] line-clamp-2">{busy === i.title ? "Création du visuel (20 à 60 s)…" : "Créer ce visuel"}</div></button>)}
          </div>
        )}
        {results.length > 0 && <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3" data-testid="ai-results">
          {results.map((r, k) => (
            <div key={k} className="rounded-lg overflow-hidden border border-[#ececec]">
              <div className="relative"><img src={r.url} alt={r.title} className="w-full aspect-square object-cover"/><span className="absolute top-1 left-1 bg-[#7c3aed] text-white text-[9px] font-bold px-1.5 rounded">IA</span></div>
              <button type="button" onClick={() => { onAdd(r.url); toast.success("Visuel IA ajouté (image complémentaire)"); setResults(x => x.filter((_, j) => j !== k)); }} className="w-full text-xs py-2 text-[#7c3aed] font-semibold flex items-center justify-center gap-1" data-testid={`ai-add-${k}`}><Plus size={12}/>Ajouter</button>
            </div>
          ))}
        </div>}
      </div>
    </div>
  );
}
