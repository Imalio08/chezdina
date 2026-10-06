import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Save, Trash2, GripVertical, Eye, EyeOff, ExternalLink, Image as ImageIcon, Grid3x3, Shield, Megaphone, Sparkles, FileText, X } from "lucide-react";
import { Link } from "react-router-dom";

const SECTION_TYPES = [
  { v: "hero", label: "Hero (mosaïque)", icon: ImageIcon, defaults: { tagline: "Nouvelle collection", title: "Vos talons,", highlight: "votre allure.", subtitle: "Description…", cta_label: "Découvrir", cta_link: "/boutique/catalog", mosaic: ["https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800", "https://images.unsplash.com/photo-1709809081557-78f803ce93a0?w=800", "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800", "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800"] } },
  { v: "product_grid", label: "Grille produits", icon: Grid3x3, defaults: { title: "Nos coups de cœur", eyebrow: "Nouveautés", limit: 8, source: "featured" } },
  { v: "banner", label: "Bannière image + CTA", icon: Megaphone, defaults: { title: "Soldes d'été", subtitle: "-30% sur la collection", image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1600", cta_label: "Profiter", cta_link: "/boutique/catalog" } },
  { v: "trust_strip", label: "Bandeau confiance", icon: Shield, defaults: { items: [{ icon: "truck", title: "Livraison 24h", text: "Partout à Abidjan." }, { icon: "shield", title: "Paiement à la livraison", text: "Espèces ou Wave." }, { icon: "whatsapp", title: "Conseillère", text: "0777 92 61 79" }] } },
  { v: "text_block", label: "Bloc texte", icon: FileText, defaults: { eyebrow: "À propos", title: "Chez Dina", text: "Boutique femme de Cocody Angré 7e…" } },
  { v: "newsletter", label: "Inscription WhatsApp", icon: Sparkles, defaults: { title: "Restez dans la boucle", subtitle: "Nouveautés & ventes flash sur WhatsApp." } },
];

export default function SectionBuilder() {
  const [sections, setSections] = useState([]);
  const [dragId, setDragId] = useState(null);
  const [editing, setEditing] = useState(null); // section being edited
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    try { const r = await api.get("/storefront/sections"); setSections(r.data || []); }
    catch { toast.error("Erreur chargement"); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch("/storefront/sections", { sections });
      toast.success("Vitrine mise à jour");
    } catch { toast.error("Erreur"); } finally { setSaving(false); }
  };

  const addSection = (type) => {
    const t = SECTION_TYPES.find(x => x.v === type);
    const newSec = { id: `s_${Date.now()}`, type, enabled: true, props: { ...t.defaults } };
    setSections([...sections, newSec]);
    setShowAdd(false);
    toast.success(`${t.label} ajouté`);
  };
  const removeSection = (id) => { if (!confirm("Supprimer cette section ?")) return; setSections(sections.filter(s => s.id !== id)); };
  const toggleEnabled = (id) => setSections(sections.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  const updateProps = (id, patch) => setSections(sections.map(s => s.id === id ? { ...s, props: { ...s.props, ...patch } } : s));

  // Drag & drop reorder
  const onDragStart = (id) => (e) => { setDragId(id); e.dataTransfer.effectAllowed = "move"; };
  const onDragOver = (e) => e.preventDefault();
  const onDrop = (targetId) => (e) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) return;
    const next = [...sections];
    const srcIdx = next.findIndex(s => s.id === dragId);
    const dstIdx = next.findIndex(s => s.id === targetId);
    const [moved] = next.splice(srcIdx, 1);
    next.splice(dstIdx, 0, moved);
    setSections(next); setDragId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Apparence du site</h1><p className="text-sm text-[#666]">Glissez-déposez pour réordonner, cliquez pour éditer, (dés)activez à la volée</p></div>
        <div className="flex gap-2">
          <Link to="/boutique" target="_blank" className="dina-btn-secondary !min-h-[40px]" data-testid="section-preview"><ExternalLink size={13} />Prévisualiser</Link>
          <button onClick={() => setShowAdd(true)} className="dina-btn-secondary !min-h-[40px]" data-testid="section-add"><Plus size={13} />Ajouter</button>
          <button onClick={save} disabled={saving} className="dina-btn-primary !min-h-[40px]" data-testid="section-save"><Save size={14} />{saving ? "Enregistrement…" : "Enregistrer"}</button>
        </div>
      </div>

      <div className="dina-card-white p-4 space-y-2">
        {sections.length === 0 && <div className="text-center text-sm text-[#666] py-10">Aucune section · cliquez sur "Ajouter"</div>}
        {sections.map((s, i) => {
          const t = SECTION_TYPES.find(x => x.v === s.type);
          const Icon = t?.icon || ImageIcon;
          return (
            <div
              key={s.id}
              draggable
              onDragStart={onDragStart(s.id)}
              onDragOver={onDragOver}
              onDrop={onDrop(s.id)}
              className={`flex items-center gap-3 p-3 border rounded-lg cursor-move transition ${dragId === s.id ? "opacity-50 scale-98" : "border-[#ececec] dark:border-[#2a2a2a] hover:border-[#b02a2a]"} ${!s.enabled ? "opacity-60" : ""}`}
              data-testid={`section-row-${s.id}`}
            >
              <GripVertical size={14} className="text-[#999]" />
              <div className="w-9 h-9 rounded-lg bg-[#fff5f5] dark:bg-[#2a1818] text-[#b02a2a] grid place-items-center"><Icon size={16} /></div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[#666] uppercase">{t?.label || s.type}</div>
                <div className="font-medium truncate text-sm">{s.props?.title || s.props?.tagline || s.props?.eyebrow || "(sans titre)"}</div>
              </div>
              <button onClick={() => toggleEnabled(s.id)} className={`p-2 rounded ${s.enabled ? "text-[#1f8a4c]" : "text-[#999]"}`} title={s.enabled ? "Visible" : "Masquée"} data-testid={`section-toggle-${s.id}`}>{s.enabled ? <Eye size={14} /> : <EyeOff size={14} />}</button>
              <button onClick={() => setEditing(s)} className="dina-btn-secondary !min-h-[32px] text-xs" data-testid={`section-edit-${s.id}`}>Éditer</button>
              <button onClick={() => removeSection(s.id)} className="text-[#c62828] p-2"><Trash2 size={14} /></button>
            </div>
          );
        })}
      </div>

      {editing && <PropsEditor section={editing} onChange={(patch) => { updateProps(editing.id, patch); setEditing({ ...editing, props: { ...editing.props, ...patch } }); }} onClose={() => setEditing(null)} />}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-3"><div className="font-serif text-xl">Ajouter une section</div><button onClick={() => setShowAdd(false)}><X size={18} /></button></div>
            <div className="grid grid-cols-2 gap-2">
              {SECTION_TYPES.map(t => (
                <button key={t.v} onClick={() => addSection(t.v)} className="p-4 border border-[#ececec] dark:border-[#2a2a2a] rounded-lg text-left hover:bg-[#fff5f5] dark:hover:bg-[#2a1818]" data-testid={`add-${t.v}`}>
                  <t.icon size={18} className="text-[#b02a2a] mb-2" />
                  <div className="font-medium text-sm">{t.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PropsEditor({ section, onChange, onClose }) {
  const p = section.props || {};
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end lg:items-center lg:justify-center p-0 lg:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-t-2xl lg:rounded-2xl p-6 w-full max-w-xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4"><div><div className="font-serif text-xl">Éditer la section</div><div className="text-xs text-[#666]">{section.type}</div></div><button onClick={onClose}><X size={18} /></button></div>

        {section.type === "hero" && (
          <div className="space-y-2">
            <Field label="Tagline (en haut)"><input className="dina-input" value={p.tagline || ""} onChange={e => onChange({ tagline: e.target.value })} data-testid="hero-tagline" /></Field>
            <Field label="Titre"><input className="dina-input" value={p.title || ""} onChange={e => onChange({ title: e.target.value })} data-testid="hero-title" /></Field>
            <Field label="Partie en rouge"><input className="dina-input" value={p.highlight || ""} onChange={e => onChange({ highlight: e.target.value })} data-testid="hero-highlight" /></Field>
            <Field label="Sous-titre"><textarea rows={2} className="dina-input" value={p.subtitle || ""} onChange={e => onChange({ subtitle: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Libellé bouton"><input className="dina-input" value={p.cta_label || ""} onChange={e => onChange({ cta_label: e.target.value })} /></Field>
              <Field label="Lien"><input className="dina-input" value={p.cta_link || ""} onChange={e => onChange({ cta_link: e.target.value })} /></Field>
            </div>
            <Field label="Mosaïque (4 URLs)">
              {(p.mosaic || ["", "", "", ""]).slice(0, 4).map((u, i) => (
                <input key={i} className="dina-input mb-1 text-xs" placeholder={`Image ${i + 1}`} value={u} onChange={e => { const nm = [...(p.mosaic || ["", "", "", ""])]; nm[i] = e.target.value; onChange({ mosaic: nm }); }} />
              ))}
            </Field>
          </div>
        )}

        {section.type === "product_grid" && (
          <div className="space-y-2">
            <Field label="Eyebrow"><input className="dina-input" value={p.eyebrow || ""} onChange={e => onChange({ eyebrow: e.target.value })} /></Field>
            <Field label="Titre"><input className="dina-input" value={p.title || ""} onChange={e => onChange({ title: e.target.value })} /></Field>
            <Field label="Nombre de produits (limite)"><input type="number" className="dina-input tabular" value={p.limit || 8} onChange={e => onChange({ limit: +e.target.value })} /></Field>
          </div>
        )}

        {section.type === "banner" && (
          <div className="space-y-2">
            <Field label="Titre"><input className="dina-input" value={p.title || ""} onChange={e => onChange({ title: e.target.value })} /></Field>
            <Field label="Sous-titre"><input className="dina-input" value={p.subtitle || ""} onChange={e => onChange({ subtitle: e.target.value })} /></Field>
            <Field label="Image URL"><input className="dina-input" value={p.image || ""} onChange={e => onChange({ image: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Libellé bouton"><input className="dina-input" value={p.cta_label || ""} onChange={e => onChange({ cta_label: e.target.value })} /></Field>
              <Field label="Lien"><input className="dina-input" value={p.cta_link || ""} onChange={e => onChange({ cta_link: e.target.value })} /></Field>
            </div>
          </div>
        )}

        {section.type === "trust_strip" && (
          <div className="space-y-2">
            {(p.items || []).map((it, i) => (
              <div key={i} className="grid grid-cols-[80px_1fr_1fr] gap-2 items-end">
                <Field label="Icône">
                  <select className="dina-input" value={it.icon || "shield"} onChange={e => { const items = [...p.items]; items[i] = { ...it, icon: e.target.value }; onChange({ items }); }}>
                    <option value="truck">Camion</option>
                    <option value="shield">Bouclier</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="gift">Cadeau</option>
                  </select>
                </Field>
                <Field label="Titre"><input className="dina-input" value={it.title} onChange={e => { const items = [...p.items]; items[i] = { ...it, title: e.target.value }; onChange({ items }); }} /></Field>
                <Field label="Texte"><input className="dina-input" value={it.text} onChange={e => { const items = [...p.items]; items[i] = { ...it, text: e.target.value }; onChange({ items }); }} /></Field>
              </div>
            ))}
          </div>
        )}

        {section.type === "text_block" && (
          <div className="space-y-2">
            <Field label="Eyebrow"><input className="dina-input" value={p.eyebrow || ""} onChange={e => onChange({ eyebrow: e.target.value })} /></Field>
            <Field label="Titre"><input className="dina-input" value={p.title || ""} onChange={e => onChange({ title: e.target.value })} /></Field>
            <Field label="Texte"><textarea rows={5} className="dina-input" value={p.text || ""} onChange={e => onChange({ text: e.target.value })} /></Field>
          </div>
        )}

        {section.type === "newsletter" && (
          <div className="space-y-2">
            <Field label="Titre"><input className="dina-input" value={p.title || ""} onChange={e => onChange({ title: e.target.value })} /></Field>
            <Field label="Sous-titre"><input className="dina-input" value={p.subtitle || ""} onChange={e => onChange({ subtitle: e.target.value })} /></Field>
          </div>
        )}

        <div className="text-xs text-[#666] mt-3">Les changements sont visibles après "Enregistrer" sur l'écran précédent.</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div><label className="text-[10px] uppercase font-semibold text-[#999]">{label}</label>{children}</div>
  );
}
