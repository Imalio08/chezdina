import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { FileText, Save, Plus, Trash2, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import SaveButton from "@/components/shared/SaveButton";

const PRESETS = [
  { slug: "about", title: "À propos" },
  { slug: "delivery", title: "Livraison & retours" },
  { slug: "terms", title: "CGV" },
  { slug: "faq", title: "FAQ" },
];

export default function CmsPages() {
  const [pages, setPages] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => { try { const r = await api.get("/pages"); setPages(r.data); if (!editing && r.data.length) setEditing(r.data[0]); } catch { toast.error("Erreur"); } };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.slug) return;
    setSaving(true);
    try {
      await api.patch(`/pages/${editing.slug}`, { title: editing.title, content: editing.content, enabled: editing.enabled, seo_title: editing.seo_title, seo_description: editing.seo_description });
      toast.success("Page enregistrée"); load();
    } catch { toast.error("Erreur"); } finally { setSaving(false); }
  };

  const addCustom = async () => {
    const slug = prompt("Slug URL (ex: cadeaux) ?");
    if (!slug) return;
    const title = prompt("Titre de la page ?") || slug;
    try { await api.post("/pages", { slug: slug.toLowerCase().replace(/\s+/g, "-"), title, content: "", enabled: true }); toast.success("Créée"); load(); }
    catch { toast.error("Slug déjà utilisé"); }
  };

  const del = async (slug) => {
    if (!confirm("Supprimer cette page ?")) return;
    try { await api.delete(`/pages/${slug}`); toast.success("Supprimée"); setEditing(null); load(); } catch { toast.error("Admin uniquement"); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Pages du site</h1><p className="text-sm text-[#666]">Éditez À propos, Livraison, CGV, FAQ et vos pages personnalisées</p></div>
        <button onClick={addCustom} className="dina-btn-secondary !min-h-[40px]" data-testid="pages-add"><Plus size={13} />Nouvelle page</button>
      </div>
      <div className="grid lg:grid-cols-[260px_1fr] gap-4">
        <div className="dina-card-white p-3">
          <div className="text-xs uppercase font-semibold text-[#666] mb-2">Pages ({pages.length})</div>
          <div className="space-y-1">
            {pages.map(p => (
              <button key={p.slug} onClick={() => setEditing(p)} className={`w-full text-left p-2.5 rounded-lg transition flex items-center gap-2 ${editing?.slug === p.slug ? "bg-[#fff5f5] border border-[#b02a2a] text-[#b02a2a]" : "hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a] border border-transparent"}`} data-testid={`page-${p.slug}`}>
                <FileText size={13} />
                <div className="flex-1 min-w-0 truncate text-sm">{p.title}</div>
                {!p.enabled && <span className="text-[9px] uppercase text-[#999]">off</span>}
              </button>
            ))}
          </div>
        </div>
        {editing && (
          <div className="dina-card-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div><div className="text-xs text-[#666]">/{editing.slug}</div><div className="font-serif text-xl">{editing.title}</div></div>
              <div className="flex gap-2">
                <Link to={`/boutique/page/${editing.slug}`} target="_blank" className="dina-btn-secondary !min-h-[36px] text-xs" data-testid="pages-preview"><Eye size={12} />Voir</Link>
                <button onClick={() => del(editing.slug)} className="text-[#c62828] p-2"><Trash2 size={14} /></button>
                <SaveButton loading={saving} onClick={save} testid="pages-save" size="sm"/>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.enabled !== false} onChange={e => setEditing({ ...editing, enabled: e.target.checked })} className="accent-[#b02a2a]" />Page visible sur la vitrine</label>
            <div>
              <label className="text-xs uppercase text-[#999]">Titre</label>
              <input className="dina-input" value={editing.title || ""} onChange={e => setEditing({ ...editing, title: e.target.value })} data-testid="pages-title" />
            </div>
            <div>
              <label className="text-xs uppercase text-[#999]">Contenu (texte libre, retours à la ligne autorisés)</label>
              <textarea className="dina-input font-mono text-sm" rows={16} value={editing.content || ""} onChange={e => setEditing({ ...editing, content: e.target.value })} data-testid="pages-content" />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div><label className="text-xs uppercase text-[#999]">SEO · title</label><input className="dina-input" value={editing.seo_title || ""} onChange={e => setEditing({ ...editing, seo_title: e.target.value })} /></div>
              <div><label className="text-xs uppercase text-[#999]">SEO · description</label><input className="dina-input" value={editing.seo_description || ""} onChange={e => setEditing({ ...editing, seo_description: e.target.value })} /></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
