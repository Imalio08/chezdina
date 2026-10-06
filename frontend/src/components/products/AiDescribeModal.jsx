import React, { useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Wand2, RefreshCw, Check, X, Loader2 } from "lucide-react";

const TONES = [
  { v: "elegant", label: "Élégant" },
  { v: "chic", label: "Chic" },
  { v: "casual", label: "Décontracté" },
  { v: "luxe", label: "Luxe" },
  { v: "playful", label: "Fun" },
];
const LENGTHS = [
  { v: "short", label: "Court" },
  { v: "medium", label: "Moyen" },
  { v: "long", label: "Long" },
];

export default function AiDescribeModal({ product, onInsert, onClose }) {
  const [tone, setTone] = useState("elegant");
  const [length, setLength] = useState("medium");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/ai/product-description", {
        name: product.name,
        brand: product.brand || "",
        category: product.category || "",
        attributes: {
          material: product.material,
          occasion: product.occasion,
          heel_type: product.heel_type,
          care: product.care,
        },
        colors: product.colors || [],
        sizes: product.sizes || [],
        photos: product.images || [],
        tone, length,
      });
      setText(data.description || "");
      if (data.fallback) toast.warning("IA indisponible — texte de secours affiché");
      else toast.success("Description générée");
    } catch (e) {
      toast.error("Erreur IA");
    } finally { setLoading(false); }
  };

  const insert = () => { onInsert(text); onClose(); };

  return (
    <div className="fixed inset-0 bg-black/60 z-[80] grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="ai-describe-modal">
        <div className="sticky top-0 bg-white dark:bg-[#1a1a1a] p-5 border-b border-[#ececec] dark:border-[#2a2a2a] flex items-start justify-between">
          <div>
            <div className="font-serif text-xl flex items-center gap-2"><Wand2 size={16} className="text-[#b02a2a]" />Rédiger avec l'IA</div>
            <div className="text-xs text-[#666] mt-0.5">Description produit en français — jamais de données commerciales</div>
          </div>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-semibold text-[#666]">Ton</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {TONES.map(t => (
                  <button key={t.v} onClick={() => setTone(t.v)} className={`px-2.5 py-1 rounded-full text-xs border ${tone === t.v ? "bg-[#b02a2a] text-white border-[#b02a2a]" : "border-[#ececec] dark:border-[#2a2a2a]"}`} data-testid={`ai-tone-${t.v}`}>{t.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase font-semibold text-[#666]">Longueur</label>
              <div className="flex gap-1.5 mt-1">
                {LENGTHS.map(l => (
                  <button key={l.v} onClick={() => setLength(l.v)} className={`px-2.5 py-1 rounded-full text-xs border ${length === l.v ? "bg-[#b02a2a] text-white border-[#b02a2a]" : "border-[#ececec] dark:border-[#2a2a2a]"}`} data-testid={`ai-length-${l.v}`}>{l.label}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="dina-card-white p-3 bg-[#fff5f5] dark:bg-[#2a1818] text-xs">
            <b>Contexte envoyé :</b> {product.name} · {product.brand || "Sans marque"} · {product.category || "Sans catégorie"}
            {(product.colors?.length || 0) > 0 && <> · {product.colors.length} couleurs</>}
            {(product.sizes?.length || 0) > 0 && <> · {product.sizes.length} tailles</>}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] uppercase font-semibold text-[#666]">Résultat</label>
              <span className="text-[10px] text-[#999] tabular">{text.length} caractères</span>
            </div>
            <textarea className="dina-input" rows={10} value={text} onChange={e => setText(e.target.value)} placeholder="Cliquez sur 'Générer' pour obtenir une description…" data-testid="ai-desc-result" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={generate} disabled={loading || !product.name} className="dina-btn-primary flex-1 !min-h-[44px]" data-testid="ai-generate">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {loading ? "Génération…" : text ? "Régénérer" : "Générer"}
            </button>
            {text && !loading && (
              <button onClick={generate} className="dina-btn-secondary !min-h-[44px]" data-testid="ai-regenerate" title="Régénérer avec autre essai"><RefreshCw size={14} /></button>
            )}
            <button onClick={insert} disabled={!text.trim()} className="dina-btn-primary !min-h-[44px]" style={{background:"#1f8a4c"}} data-testid="ai-insert"><Check size={14} />Insérer</button>
          </div>
        </div>
      </div>
    </div>
  );
}
