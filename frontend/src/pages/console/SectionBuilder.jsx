import React, { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Save, Trash2, GripVertical, Eye, EyeOff, ExternalLink, Image as ImageIcon, Grid3x3, Shield, Megaphone, Sparkles, FileText, X, Upload, Layers } from "lucide-react";
import { Link } from "react-router-dom";
import { toast as toast2 } from "sonner";
import IconPicker from "@/components/shared/IconPicker";
import SaveButton from "@/components/shared/SaveButton";

const SECTION_TYPES = [
  { v: "hero", label: "Hero (mosaïque défilante)", icon: ImageIcon, defaults: { tagline: "Nouvelle collection", title: "Vos talons,", highlight: "votre allure.", subtitle: "Description…", cta_label: "Découvrir", cta_link: "/boutique/catalog", mosaic: [] } },
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
          <SaveButton loading={saving} onClick={save} testid="section-save"/>
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
            <Field label="Mosaïque défilante (sans limite, upload uniquement)">
              <MultiUpload images={p.mosaic || []} onChange={(mosaic) => onChange({ mosaic })} testId="hero-upload" />
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
            <Field label="Image (upload)">
              <SingleUpload image={p.image} onChange={(image) => onChange({ image })} testId="banner-upload" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Libellé bouton"><input className="dina-input" value={p.cta_label || ""} onChange={e => onChange({ cta_label: e.target.value })} /></Field>
              <Field label="Lien"><input className="dina-input" value={p.cta_link || ""} onChange={e => onChange({ cta_link: e.target.value })} /></Field>
            </div>
          </div>
        )}

        {section.type === "trust_strip" && (
          <div className="space-y-2">
            {(p.items || []).map((it, i) => (
              <div key={i} className="grid grid-cols-[160px_1fr_1fr] gap-2 items-end">
                <Field label="Icône">
                  <IconPicker value={it.icon || "shield"} onChange={v => { const items = [...p.items]; items[i] = { ...it, icon: v }; onChange({ items }); }} testid={`sb-trust-icon-${i}`}/>
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

function MosaicEditor({ p, onChange }) {
  // Deprecated after fix 2026-02 — the standalone mosaic section was removed.
  // Kept temporarily as a no-op to avoid import breakage.
  return null;
}

function MultiUpload({ images, onChange, testId }) {
  const fileRef = useRef(null);
  const onFiles = (fileList) => {
    const files = Array.from(fileList || []).filter(f => f.type.startsWith("image/"));
    if (!files.length) return;
    const next = [...(images || [])];
    let loaded = 0;
    files.forEach((f) => {
      if (f.size > 3 * 1024 * 1024) { toast2.error(`${f.name}: max 3 Mo`); loaded++; return; }
      const reader = new FileReader();
      reader.onload = () => {
        next.push(reader.result);
        loaded++;
        if (loaded === files.length) onChange(next);
      };
      reader.readAsDataURL(f);
    });
  };
  const onDrop = (e) => { e.preventDefault(); onFiles(e.dataTransfer.files); };
  const remove = (i) => onChange(images.filter((_, k) => k !== i));

  return (
    <div className="space-y-2">
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-[#ececec] rounded-xl p-5 text-center cursor-pointer hover:border-[#b02a2a]"
        data-testid={`${testId}-dropzone`}
      >
        <Upload size={20} className="mx-auto text-[#999]" />
        <div className="text-sm font-medium mt-1">Glissez vos images (sans limite)</div>
        <div className="text-xs text-[#666]">ou cliquez — max 3 Mo chacune</div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => onFiles(e.target.files)} data-testid={`${testId}-input`} />
      </div>
      <div className="text-xs text-[#666]">{images?.length || 0} image(s)</div>
      {(images || []).length > 0 && (
        <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto">
          {images.map((src, i) => (
            <div key={i} className="relative" data-testid={`${testId}-img-${i}`}>
              <img src={src} alt="" className="w-full aspect-square object-cover rounded" />
              <button onClick={() => remove(i)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5" data-testid={`${testId}-remove-${i}`}><X size={10}/></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SingleUpload({ image, onChange, testId }) {
  const ref = useRef(null);
  const onFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 3 * 1024 * 1024) return toast2.error("Max 3 Mo");
    const r = new FileReader();
    r.onload = () => onChange(r.result);
    r.readAsDataURL(f);
  };
  return (
    <div className="flex gap-2 items-center">
      {image && <img src={image} alt="" className="w-16 h-16 object-cover rounded"/>}
      <label className="dina-btn-secondary cursor-pointer !min-h-[36px]" data-testid={testId}>
        <Upload size={14}/> {image ? "Remplacer" : "Téléverser"}
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={onFile}/>
      </label>
      {image && <button onClick={() => onChange("")} className="text-[#c62828] text-xs">Retirer</button>}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div><label className="text-[10px] uppercase font-semibold text-[#999]">{label}</label>{children}</div>
  );
}
