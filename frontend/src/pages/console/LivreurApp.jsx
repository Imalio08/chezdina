/**
 * LivreurApp — CMS complet de personnalisation de l'app Livreur.
 * Structure miroir de SiteVitrine (sous-onglets Identité / Onglets / Annonces / Aide / Aperçu).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  Palette, Smartphone, Megaphone, HelpCircle, Eye, Save, Upload, Plus, X,
  GripVertical, RotateCcw, Package, Map as MapIcon, History, Trophy, User,
  Phone, MessageCircle, Info, ExternalLink, Star, Heart, Home, Settings as SettingsIcon,
} from "lucide-react";
import SaveButton from "@/components/shared/SaveButton";

const TABS = [
  { id: "identite", label: "Identité",   icon: Palette },
  { id: "onglets",  label: "Onglets",    icon: Smartphone },
  { id: "annonces", label: "Annonces",   icon: Megaphone },
  { id: "aide",     label: "Aide",       icon: HelpCircle },
  { id: "apercu",   label: "Aperçu",     icon: Eye },
];

const RIDER_ICONS = {
  Package, Map: MapIcon, History, Trophy, User, HelpCircle, Phone,
  MessageCircle, Info, ExternalLink, Megaphone, Star, Heart, Home, SettingsIcon,
};
const ICON_NAMES = Object.keys(RIDER_ICONS);

const DEFAULT_TABS = [
  { key: "courses",     to: "/rider",             icon: "Package", label: "Courses",     visible: true, builtin: true },
  { key: "carte",       to: "/rider/carte",       icon: "Map",     label: "Carte",       visible: true, builtin: true },
  { key: "historique",  to: "/rider/historique",  icon: "History", label: "Historique",  visible: true, builtin: true },
  { key: "performance", to: "/rider/performance", icon: "Trophy",  label: "Performance", visible: true, builtin: true },
  { key: "profil",      to: "/rider/profil",      icon: "User",    label: "Profil",      visible: true, builtin: true },
];
const DEFAULTS = {
  logo: "",
  primary_color: "#b02a2a",
  accent_color: "#fff5f5",
  greeting: "Bonjour {name}",
  subtitle: "{brand} · Livreur",
  announcement: { enabled: false, text: "", variant: "info" },
  help: { enabled: true, title: "Besoin d'aide ?", content: "Appelez votre gérante · +225 07 77 92 61 79" },
  tabs: DEFAULT_TABS,
};

/* ============================ Shared hook ============================ */
function useRiderCms() {
  const [cms, setCms] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const r = await api.get("/rider-cms");
      const d = r.data || {};
      setCms({
        ...DEFAULTS, ...d,
        announcement: { ...DEFAULTS.announcement, ...(d.announcement || {}) },
        help: { ...DEFAULTS.help, ...(d.help || {}) },
        tabs: (d.tabs && d.tabs.length) ? d.tabs : DEFAULT_TABS,
      });
    } catch { /* keep defaults */ }
    setLoaded(true);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await api.patch("/rider-cms", cms);
      window.dispatchEvent(new Event("rider-cms-changed"));
      toast.success("App Livreur mise à jour · déployée en temps réel");
    } catch { toast.error("Erreur · essayez à nouveau"); }
    finally { setSaving(false); }
  };

  const reset = async () => {
    if (!window.confirm("Réinitialiser l'App Livreur aux valeurs par défaut ?")) return;
    try {
      await api.post("/rider-cms/reset");
      setCms(DEFAULTS);
      window.dispatchEvent(new Event("rider-cms-changed"));
      toast.success("App Livreur réinitialisée");
    } catch { toast.error("Réservé Super admin"); }
  };

  const upd = (k, v) => setCms(c => ({ ...c, [k]: v }));
  return { cms, setCms, loaded, saving, save, reset, upd };
}

/* ============================ Root ============================ */
const RESERVED = ["rider", "boutique", "console", "login", "scan", "suivi", "api"];

function AccessCard({ ctx }) {
  const [slug, setSlug] = useState(ctx.cms.access_slug || "");
  const clean = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const url = `${window.location.origin}/${ctx.cms.access_slug || "rider"}`;
  const save = async () => {
    if (clean && RESERVED.includes(clean)) return toast.error("Ce mot est réservé, choisissez-en un autre");
    try { await api.patch("/rider-cms", { access_slug: clean }); ctx.setCms(c => ({ ...c, access_slug: clean })); setSlug(clean); toast.success("Adresse enregistrée"); }
    catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };
  const copy = () => navigator.clipboard?.writeText(url).then(() => toast.success("Lien copié"));
  const share = () => window.open(`https://wa.me/?text=${encodeURIComponent(`Bonjour, voici l'accès à l'app livreur Chez Dina : ${url}\nOuvrez-le dans Safari/Chrome puis « Ajouter à l'écran d'accueil ».`)}`, "_blank");
  return (
    <div className="dina-card-white p-4 flex gap-4 flex-wrap items-center" data-testid="rider-access-card">
      <div className="bg-white p-2 rounded-lg border border-[#ececec]"><QRCodeSVG value={url} size={96} data-testid="rider-access-qr"/></div>
      <div className="flex-1 min-w-0 sm:min-w-[240px] space-y-2">
        <div className="font-semibold text-sm">Adresse d'accès à l'app livreur</div>
        <div className="flex items-center gap-1 text-sm flex-wrap"><span className="text-[#666] break-all">{window.location.host}/</span>
          <input className="dina-input !min-h-[34px] text-sm flex-1 min-w-[100px] max-w-[180px]" placeholder="livreur" value={slug} onChange={e => setSlug(e.target.value)} data-testid="rider-access-slug"/>
          <button onClick={save} className="dina-btn-primary !min-h-[34px] text-xs" data-testid="rider-access-save">Enregistrer</button></div>
        <div className="text-xs font-mono break-all" data-testid="rider-access-url">{url}</div>
        <div className="flex gap-2 flex-wrap"><button onClick={copy} className="dina-btn-secondary !min-h-[32px] text-xs" data-testid="rider-access-copy">Copier</button><button onClick={share} className="dina-btn-secondary !min-h-[32px] text-xs !text-[#1f8a4c]" data-testid="rider-access-wa">Envoyer par WhatsApp</button></div>
        <div className="text-[11px] text-[#999]">/rider reste toujours valable. Les livreurs se connectent sur {window.location.host}/rider/login.</div>
      </div>
    </div>
  );
}

export default function LivreurApp() {
  const [sp, setSp] = useSearchParams();
  const [tab, setTab] = useState(sp.get("tab") || "identite");
  useEffect(() => { setSp({ tab }, { replace: true }); /* eslint-disable-next-line */ }, [tab]);
  const ctx = useRiderCms();

  return (
    <div className="space-y-5" data-testid="livreur-app">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-serif text-3xl">App Livreur</h1>
          <p className="text-sm text-[#666]">Identité, onglets, annonces, aide et aperçu de l'espace livreur</p>
        </div>
        <a href="/rider" target="_blank" rel="noreferrer" className="dina-btn-secondary !min-h-[40px]" data-testid="view-rider">
          <ExternalLink size={14}/> Voir l'app livreur
        </a>
      </div>

      {ctx.loaded && <AccessCard ctx={ctx}/>}

      <div className="flex gap-1 border-b border-[#ececec] overflow-x-auto" data-testid="livreur-app-tabs">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} data-testid={`la-tab-${t.id}`}
            className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 flex items-center gap-2 ${tab === t.id ? "border-[#b02a2a] text-[#b02a2a] font-semibold" : "border-transparent text-[#666]"}`}>
            <t.icon size={14}/>{t.label}
          </button>
        ))}
      </div>

      {!ctx.loaded ? (
        <div className="dina-card-white p-6 text-sm text-[#666]">Chargement…</div>
      ) : (
        <>
          {tab === "identite" && <IdentiteTab ctx={ctx} />}
          {tab === "onglets"  && <OngletsTab ctx={ctx} />}
          {tab === "annonces" && <AnnoncesTab ctx={ctx} />}
          {tab === "aide"     && <AideTab ctx={ctx} />}
          {tab === "apercu"   && <ApercuTab ctx={ctx} />}
        </>
      )}

      {tab !== "apercu" && (
        <div className="flex items-center gap-2 sticky bottom-2 z-10 bg-white/85 backdrop-blur p-2 rounded-xl border border-[#ececec]">
          <SaveButton loading={ctx.saving} onClick={ctx.save} testid="livreur-save">Enregistrer</SaveButton>
          <button onClick={ctx.reset} className="dina-btn-secondary !min-h-[36px] text-xs" data-testid="livreur-reset"><RotateCcw size={12}/> Réinitialiser</button>
        </div>
      )}
    </div>
  );
}

/* ============================ Identité ============================ */
function IdentiteTab({ ctx }) {
  const { cms, upd } = ctx;
  const uploadLogo = (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Max 2 Mo");
    const r = new FileReader();
    r.onload = () => upd("logo", r.result);
    r.readAsDataURL(file);
  };
  return (
    <div className="space-y-4" data-testid="la-identite">
      <div className="dina-card-white p-5 space-y-3">
        <div className="font-serif text-xl">Logo livreur</div>
        <p className="text-xs text-[#666]">Affiché dans l'app livreur, le manifest PWA et l'icône d'installation sur l'écran d'accueil du téléphone. Vide = reprend le logo principal de la boutique.</p>
        <div className="flex items-center gap-4 flex-wrap">
          {cms.logo ? (
            <img src={cms.logo} alt="Logo livreur" className="h-20 w-20 object-cover border rounded-xl bg-white" data-testid="rider-logo-preview"/>
          ) : (
            <div className="h-20 w-20 rounded-xl grid place-items-center text-white font-serif text-2xl font-bold" style={{ background: cms.primary_color }}>LV</div>
          )}
          <label className="dina-btn-secondary cursor-pointer !min-h-[36px]" data-testid="rider-logo-upload-btn">
            <Upload size={14}/> Téléverser
            <input type="file" accept="image/*" className="hidden" onChange={e => uploadLogo(e.target.files[0])}/>
          </label>
          {cms.logo && <button onClick={() => upd("logo", "")} className="text-[#c62828] text-xs font-semibold" data-testid="rider-logo-clear">Retirer le logo livreur</button>}
        </div>
      </div>

      <div className="dina-card-white p-5 space-y-3">
        <div className="font-serif text-xl">Couleurs</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-[#666]">Couleur primaire (boutons, actif, GPS)
            <div className="flex items-center gap-2 mt-1">
              <input type="color" value={cms.primary_color} onChange={e => upd("primary_color", e.target.value)} className="w-10 h-9 rounded border" data-testid="rider-primary-color"/>
              <input className="dina-input tabular" value={cms.primary_color} onChange={e => upd("primary_color", e.target.value)}/>
            </div>
          </label>
          <label className="text-xs text-[#666]">Couleur de fond
            <div className="flex items-center gap-2 mt-1">
              <input type="color" value={cms.accent_color} onChange={e => upd("accent_color", e.target.value)} className="w-10 h-9 rounded border" data-testid="rider-accent-color"/>
              <input className="dina-input tabular" value={cms.accent_color} onChange={e => upd("accent_color", e.target.value)}/>
            </div>
          </label>
        </div>
      </div>

      <div className="dina-card-white p-5 space-y-3">
        <div className="font-serif text-xl">Message d'accueil</div>
        <p className="text-[11px] text-[#999]">Variables disponibles : <code className="bg-[#fff5f5] px-1 rounded text-[#b02a2a]">{"{name}"}</code> (prénom du livreur) · <code className="bg-[#fff5f5] px-1 rounded text-[#b02a2a]">{"{brand}"}</code> (nom boutique)</p>
        <label className="text-xs text-[#666] block">Salutation (titre)
          <input className="dina-input mt-1" value={cms.greeting} onChange={e => upd("greeting", e.target.value)} placeholder="Bonjour {name}" data-testid="rider-greeting"/>
        </label>
        <label className="text-xs text-[#666] block">Sous-titre
          <input className="dina-input mt-1" value={cms.subtitle} onChange={e => upd("subtitle", e.target.value)} placeholder="{brand} · Livreur" data-testid="rider-subtitle"/>
        </label>
      </div>
    </div>
  );
}

/* ============================ Onglets ============================ */
function OngletsTab({ ctx }) {
  const { cms, upd } = ctx;
  const move = (idx, delta) => {
    const next = [...cms.tabs];
    const j = idx + delta;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    upd("tabs", next);
  };
  const patch = (idx, patchObj) => upd("tabs", cms.tabs.map((t, i) => i === idx ? { ...t, ...patchObj } : t));
  const remove = (idx) => {
    if (cms.tabs[idx]?.builtin) return toast.error("Onglet intégré · masquer plutôt que supprimer");
    upd("tabs", cms.tabs.filter((_, i) => i !== idx));
  };
  const add = () => {
    upd("tabs", [...cms.tabs, {
      key: `custom-${Date.now()}`, label: `Onglet ${cms.tabs.length + 1}`,
      icon: "Info", to: "https://", visible: true, builtin: false,
    }]);
  };
  return (
    <div className="space-y-4" data-testid="la-onglets">
      <div className="dina-card-white p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="font-serif text-xl">Barre basse (5 onglets maximum visibles conseillé)</div>
            <p className="text-xs text-[#666]">Réorganiser, renommer, masquer ou ajouter des onglets personnalisés (lien externe autorisé).</p>
          </div>
          <button onClick={add} className="dina-btn-secondary !min-h-[32px] text-xs" data-testid="rider-tab-add"><Plus size={12}/> Ajouter un onglet</button>
        </div>

        <div className="space-y-2">
          {cms.tabs.map((t, idx) => (
            <div key={t.key || idx} className="border rounded-xl p-3 flex items-start gap-3" data-testid={`rider-tab-row-${idx}`}>
              <div className="flex flex-col items-center gap-1 pt-1 text-[#999] shrink-0">
                <button onClick={() => move(idx, -1)} className="text-xs hover:text-[#b02a2a]" title="Monter" data-testid={`rider-tab-up-${idx}`}>▲</button>
                <GripVertical size={12}/>
                <button onClick={() => move(idx, 1)} className="text-xs hover:text-[#b02a2a]" title="Descendre" data-testid={`rider-tab-down-${idx}`}>▼</button>
              </div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 min-w-0">
                <label className="text-[10px] text-[#666]">Libellé
                  <input className="dina-input" value={t.label || ""} onChange={e => patch(idx, { label: e.target.value })} data-testid={`rider-tab-label-${idx}`}/>
                </label>
                <label className="text-[10px] text-[#666]">Icône
                  <select className="dina-input" value={t.icon || "Info"} onChange={e => patch(idx, { icon: e.target.value })} data-testid={`rider-tab-icon-${idx}`}>
                    {ICON_NAMES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </label>
                <label className="text-[10px] text-[#666]">
                  {t.builtin ? "Route (lecture seule)" : "Lien (URL ou /chemin)"}
                  <input className="dina-input" value={t.to || ""} onChange={e => patch(idx, { to: e.target.value })} disabled={t.builtin} data-testid={`rider-tab-to-${idx}`}/>
                </label>
              </div>
              <div className="flex flex-col items-end gap-2 pt-1 shrink-0">
                <label className="flex items-center gap-1 text-[10px] text-[#666]">
                  <input type="checkbox" checked={t.visible !== false} onChange={() => patch(idx, { visible: !(t.visible !== false) })} data-testid={`rider-tab-visible-${idx}`}/>
                  Visible
                </label>
                {!t.builtin
                  ? <button onClick={() => remove(idx)} className="text-[#c62828] text-xs flex items-center gap-1" title="Supprimer" data-testid={`rider-tab-remove-${idx}`}><X size={12}/></button>
                  : <span className="text-[9px] text-[#999]">intégré</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================ Annonces ============================ */
function AnnoncesTab({ ctx }) {
  const { cms, setCms } = ctx;
  const updAnn = (k, v) => setCms(c => ({ ...c, announcement: { ...c.announcement, [k]: v } }));
  return (
    <div className="space-y-4" data-testid="la-annonces">
      <div className="dina-card-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-serif text-xl">Bannière d'annonce</div>
            <p className="text-xs text-[#666]">Affichée en haut de l'app livreur. Chaque livreur peut la masquer une fois lue.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={cms.announcement.enabled} onChange={e => updAnn("enabled", e.target.checked)} className="sr-only peer" data-testid="rider-ann-enabled"/>
            <div className="w-11 h-6 bg-[#ddd] rounded-full peer peer-checked:bg-[#1f8a4c] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition peer-checked:after:translate-x-5"/>
          </label>
        </div>
        {cms.announcement.enabled && (
          <>
            <textarea className="dina-input" rows={3} value={cms.announcement.text} onChange={e => updAnn("text", e.target.value)} placeholder="Ex : Pluie ce matin · roulez prudemment !" data-testid="rider-ann-text"/>
            <label className="text-xs text-[#666] block">Style
              <select className="dina-input mt-1" value={cms.announcement.variant} onChange={e => updAnn("variant", e.target.value)} data-testid="rider-ann-variant">
                <option value="info">Information (bleu)</option>
                <option value="success">Succès (vert)</option>
                <option value="warning">Attention (orange)</option>
                <option value="danger">Urgent (rouge)</option>
              </select>
            </label>
            <AnnouncementPreview text={cms.announcement.text} variant={cms.announcement.variant}/>
          </>
        )}
      </div>
    </div>
  );
}
function AnnouncementPreview({ text, variant }) {
  const palette = {
    info:    { bg: "#eef4ff", fg: "#1e3a8a", border: "#b4c7ff" },
    success: { bg: "#eafaf1", fg: "#1f6b3a", border: "#a3dfbc" },
    warning: { bg: "#fff7e6", fg: "#8a5a00", border: "#f5c56b" },
    danger:  { bg: "#fdecec", fg: "#991b1b", border: "#f5b0b0" },
  }[variant || "info"];
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[#999] mb-1">Aperçu</div>
      <div className="px-4 py-2 text-xs font-medium flex items-start gap-2 border rounded-lg" style={{ background: palette.bg, color: palette.fg, borderColor: palette.border }}>
        <Megaphone size={14} className="shrink-0 mt-0.5"/>
        <div className="whitespace-pre-wrap break-words">{text || "Votre annonce apparaîtra ici…"}</div>
      </div>
    </div>
  );
}

/* ============================ Aide ============================ */
function AideTab({ ctx }) {
  const { cms, setCms } = ctx;
  const updHelp = (k, v) => setCms(c => ({ ...c, help: { ...c.help, [k]: v } }));
  return (
    <div className="space-y-4" data-testid="la-aide">
      <div className="dina-card-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-serif text-xl">Aide intégrée</div>
            <p className="text-xs text-[#666]">Modal affichée quand le livreur clique sur « Aide » dans sa topbar.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={cms.help.enabled} onChange={e => updHelp("enabled", e.target.checked)} className="sr-only peer" data-testid="rider-help-enabled"/>
            <div className="w-11 h-6 bg-[#ddd] rounded-full peer peer-checked:bg-[#1f8a4c] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition peer-checked:after:translate-x-5"/>
          </label>
        </div>
        {cms.help.enabled && (
          <>
            <input className="dina-input" value={cms.help.title} onChange={e => updHelp("title", e.target.value)} placeholder="Titre" data-testid="rider-help-title"/>
            <textarea className="dina-input" rows={5} value={cms.help.content} onChange={e => updHelp("content", e.target.value)} placeholder="Contenu de l'aide…" data-testid="rider-help-content"/>
            <p className="text-[11px] text-[#999]">💡 Astuce : ajoutez un numéro WhatsApp cliquable (ex : « Appelez votre gérante · <strong>+225 07 77 92 61 79</strong> »).</p>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================ Aperçu ============================ */
function ApercuTab({ ctx }) {
  const { cms } = ctx;
  const [iframeKey, setIframeKey] = useState(0);
  const refresh = () => setIframeKey(k => k + 1);
  const visibleTabs = useMemo(() => (cms.tabs || []).filter(t => t.visible !== false), [cms.tabs]);
  return (
    <div className="space-y-4" data-testid="la-apercu">
      <div className="dina-card-white p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="font-serif text-xl">Aperçu en direct</div>
            <p className="text-xs text-[#666]">Rendu « téléphone » : enregistrez d'abord vos modifications pour les voir ici.</p>
          </div>
          <button onClick={refresh} className="dina-btn-secondary !min-h-[32px] text-xs" data-testid="rider-preview-refresh"><RotateCcw size={12}/> Rafraîchir l'aperçu</button>
        </div>

        <div className="flex gap-6 items-start flex-wrap">
          {/* Static preview card */}
          <div className="rounded-[32px] border-8 border-[#1a1a1a] shadow-xl w-[280px] overflow-hidden bg-white" style={{ "--rider-primary": cms.primary_color, "--rider-accent": cms.accent_color }}>
            <div className="bg-white px-3 py-2.5 flex items-center justify-between border-b">
              <div className="flex items-center gap-2">
                {cms.logo ? <img src={cms.logo} alt="" className="w-8 h-8 rounded-lg object-cover bg-white"/> : <div className="w-8 h-8 rounded-full grid place-items-center text-xs font-bold text-white" style={{ background: cms.primary_color }}>D</div>}
                <div className="leading-none">
                  <div className="font-serif text-xs">{(cms.greeting || "Bonjour {name}").replace("{name}", "Kouamé")}</div>
                  <div className="text-[9px] text-[#999]">{(cms.subtitle || "{brand} · Livreur").replace("{brand}", "Chez Dina")}</div>
                </div>
              </div>
            </div>
            {cms.announcement.enabled && cms.announcement.text && (
              <AnnouncementPreview text={cms.announcement.text} variant={cms.announcement.variant}/>
            )}
            <div style={{ background: cms.accent_color }} className="min-h-[280px] p-3">
              <div className="text-xs text-[#666] text-center mt-20">Zone des courses</div>
            </div>
            <div className="grid border-t" style={{ gridTemplateColumns: `repeat(${Math.max(1, visibleTabs.length)}, minmax(0, 1fr))` }}>
              {visibleTabs.map((t) => {
                const Icon = RIDER_ICONS[t.icon] || Info;
                return (
                  <div key={t.key} className="flex flex-col items-center gap-0.5 py-2 text-[9px] font-medium text-[#666]">
                    <Icon size={14}/><span className="truncate max-w-full">{t.label || t.key}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live iframe */}
          <div className="rounded-[32px] border-8 border-[#1a1a1a] shadow-xl w-[320px] overflow-hidden bg-white">
            <div className="text-[10px] uppercase tracking-wider text-[#999] px-2 py-1 bg-[#fafafa] border-b">Live · /rider</div>
            <iframe
              key={iframeKey}
              src="/rider"
              title="Aperçu livreur"
              className="w-full h-[520px] bg-white"
              data-testid="rider-preview-iframe"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
