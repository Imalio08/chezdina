import React, { useMemo, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Globe, Wand2, Loader2, ImageIcon } from "lucide-react";
import ImageUpload from "@/components/shared/ImageUpload";

function slugify(s) {
  return (s || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

export default function SeoSection({ f, upd }) {
  const [loading, setLoading] = useState(false);
  const [slugEdited, setSlugEdited] = useState(!!f.slug);
  const url = `chezdina.ci/boutique/product/${f.slug || slugify(f.name) || "votre-produit"}`;

  // auto-slug when name changes (if user hasn't manually edited)
  React.useEffect(() => {
    if (!slugEdited) upd("slug", slugify(f.name));
  }, [f.name]); // eslint-disable-line

  const titleLen = (f.seo_title || "").length;
  const descLen = (f.seo_description || "").length;
  const titleColor = titleLen > 60 ? "#c62828" : titleLen > 50 ? "#e4991e" : "#1f8a4c";
  const descColor = descLen > 160 ? "#c62828" : descLen > 140 ? "#e4991e" : "#1f8a4c";

  const generate = async () => {
    if (!f.name) return toast.error("Entrez d'abord un nom");
    setLoading(true);
    try {
      const { data } = await api.post("/ai/product-seo", {
        name: f.name, brand: f.brand || "", category: f.category || "", description: f.description || "", price: f.price || 0,
      });
      upd("seo_title", data.seo_title || "");
      upd("seo_description", data.seo_description || "");
      if (!slugEdited) upd("slug", data.slug || slugify(f.name));
      if (data.fallback) toast.warning("IA indisponible — valeurs de secours");
      else toast.success("SEO généré");
    } catch { toast.error("Erreur IA"); }
    finally { setLoading(false); }
  };

  const previewImg = f.og_image || f.image || f.images?.[0] || "";

  return (
    <div className="space-y-3" data-testid="seo-section">
      <div className="flex items-center justify-between">
        <div className="text-xs text-[#666]">Comment votre produit apparaît sur Google et WhatsApp</div>
        <button onClick={generate} disabled={loading || !f.name} className="text-xs text-[#b02a2a] hover:underline flex items-center gap-1 disabled:opacity-50" data-testid="seo-ai">
          {loading ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
          {loading ? "Génération…" : "Générer avec l'IA"}
        </button>
      </div>

      {/* Titre SEO */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase font-semibold text-[#666]">Titre SEO</label>
          <span className="text-[10px] tabular" style={{ color: titleColor }}>{titleLen} / 60</span>
        </div>
        <input className="dina-input" placeholder="ex: Mules dorées en cuir - Dina Signature" maxLength={70} value={f.seo_title || ""} onChange={e => upd("seo_title", e.target.value)} data-testid="seo-title" />
      </div>

      {/* Meta description */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase font-semibold text-[#666]">Meta description</label>
          <span className="text-[10px] tabular" style={{ color: descColor }}>{descLen} / 160</span>
        </div>
        <textarea className="dina-input" rows={2} maxLength={180} placeholder="Phrase incitative visible dans Google — mentionnez Abidjan et un avantage clé" value={f.seo_description || ""} onChange={e => upd("seo_description", e.target.value)} data-testid="seo-desc" />
      </div>

      {/* URL */}
      <div>
        <label className="text-[10px] uppercase font-semibold text-[#666]">URL du produit</label>
        <div className="flex items-center gap-1 dina-input !p-0 overflow-hidden">
          <span className="pl-3 text-xs text-[#999] font-mono shrink-0">chezdina.ci/boutique/product/</span>
          <input className="flex-1 bg-transparent !border-0 !shadow-none px-1 py-2 text-xs font-mono focus:outline-none" value={f.slug || ""} onChange={e => { setSlugEdited(true); upd("slug", slugify(e.target.value)); }} placeholder="auto-généré" data-testid="seo-slug" />
        </div>
      </div>

      {/* Image partage */}
      <div>
        <label className="text-[10px] uppercase font-semibold text-[#666] mb-1 block">Image de partage (OG — réseaux sociaux)</label>
        <ImageUpload value={f.og_image ? [f.og_image] : []} onChange={imgs => upd("og_image", imgs[0] || "")} single max={1} maxKB={300} testid="seo-og-image" />
        <div className="text-[10px] text-[#999] mt-1">Si vide, la 1ʳᵉ photo du produit sera utilisée</div>
      </div>

      {/* Previews */}
      <div className="grid md:grid-cols-2 gap-3 pt-2 border-t border-[#ececec] dark:border-[#2a2a2a]">
        {/* Google */}
        <div className="dina-card-white p-3 bg-[#fafafa] dark:bg-[#0f0f0f]">
          <div className="text-[10px] uppercase font-semibold text-[#666] mb-2 flex items-center gap-1"><Globe size={10} />Aperçu Google</div>
          <div className="text-[11px] text-[#202124] dark:text-[#9aa0a6] truncate" data-testid="seo-google-url">{url}</div>
          <div className="text-[16px] text-[#1a0dab] dark:text-[#8ab4f8] font-medium leading-snug line-clamp-1 mt-0.5" data-testid="seo-google-title">{f.seo_title || f.name || "Titre de votre produit"}</div>
          <div className="text-[12px] text-[#4d5156] dark:text-[#bdc1c6] leading-snug line-clamp-2 mt-0.5" data-testid="seo-google-desc">{f.seo_description || "La meta description apparaîtra ici. Elle doit donner envie de cliquer."}</div>
        </div>
        {/* WhatsApp */}
        <div className="dina-card-white p-3 bg-[#e5ddd5] dark:bg-[#0f0f0f]">
          <div className="text-[10px] uppercase font-semibold text-[#666] mb-2 flex items-center gap-1"><ImageIcon size={10} />Aperçu WhatsApp</div>
          <div className="bg-white dark:bg-[#1f2c33] rounded-lg overflow-hidden max-w-[260px] mx-auto shadow-sm" data-testid="seo-wa-card">
            <div className="aspect-[1.9/1] bg-[#eee] dark:bg-[#2a2a2a] relative">
              {previewImg ? <img src={previewImg} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-[#999]"><ImageIcon size={24} /></div>}
            </div>
            <div className="p-2">
              <div className="text-[11px] font-semibold line-clamp-2 leading-tight">{f.seo_title || f.name || "Titre"}</div>
              <div className="text-[10px] text-[#8696a0] line-clamp-2 mt-0.5">{f.seo_description || "La description…"}</div>
              <div className="text-[9px] text-[#8696a0] mt-0.5 uppercase">chezdina.ci</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
