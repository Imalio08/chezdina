import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  Palette, Layout, FileText, Target, Eye, ExternalLink, Save, Upload, Plus, Trash2,
  Facebook, Instagram, Youtube, Linkedin, Share2, Monitor, Smartphone, Image as ImageIcon,
  Globe, Menu as MenuIcon, GripVertical, X, Check, Hash,
} from "lucide-react";
import SectionBuilder from "./SectionBuilder";
import SaveButton from "@/components/shared/SaveButton";

const TABS = [
  { id: "apparence", label: "Apparence", icon: Palette },
  { id: "accueil", label: "Accueil", icon: Layout },
  { id: "pages", label: "Pages & navigation", icon: FileText },
  { id: "seo", label: "SEO & partage", icon: Target },
  { id: "apercu", label: "Aperçu", icon: Eye },
];

const DEFAULT_THEME = {
  primary: "#b02a2a", secondary: "#e4991e",
  background: "#ffffff", text: "#1c1c1c", button: "#b02a2a",
  dark_background: "#0f0f0f", dark_text: "#f0f0f0",
  font: "Sora", radius: 12, card_style: "soft",
};

const FONTS = ["Sora", "Inter", "Playfair Display", "DM Sans", "Poppins", "Montserrat", "Cormorant Garamond"];
const PRESETS = [
  { name: "Dina classique", primary:"#b02a2a", secondary:"#e4991e", background:"#ffffff", text:"#1c1c1c", button:"#b02a2a" },
  { name: "Nuit urbaine", primary:"#8b5cf6", secondary:"#f59e0b", background:"#0f0f12", text:"#f8f8f8", button:"#8b5cf6" },
  { name: "Minéral", primary:"#0f766e", secondary:"#ca8a04", background:"#fafaf7", text:"#1c1c1c", button:"#0f766e" },
  { name: "Rose poudré", primary:"#be185d", secondary:"#f472b6", background:"#fff5f7", text:"#1c1c1c", button:"#be185d" },
];
const SOCIAL_META = [
  { k: "facebook", label: "Facebook", icon: Facebook, placeholder: "https://facebook.com/votrepage" },
  { k: "instagram", label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/votrecompte" },
  { k: "tiktok", label: "TikTok", icon: Hash, placeholder: "https://tiktok.com/@votre" },
  { k: "whatsapp", label: "WhatsApp", icon: Share2, placeholder: "https://wa.me/22507..." },
  { k: "snapchat", label: "Snapchat", icon: Share2, placeholder: "https://snapchat.com/add/votre" },
  { k: "youtube", label: "YouTube", icon: Youtube, placeholder: "https://youtube.com/@votre" },
  { k: "linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "https://linkedin.com/company/votre" },
];

export default function SiteVitrine() {
  const [sp, setSp] = useSearchParams();
  const [tab, setTab] = useState(sp.get("tab") || "apparence");
  useEffect(() => { setSp({ tab }, { replace: true }); }, [tab]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-serif text-3xl">Site vitrine</h1>
          <p className="text-sm text-[#666]">Apparence, contenu, pages, SEO et aperçu</p>
        </div>
        <a href="/boutique" target="_blank" rel="noreferrer" className="dina-btn-secondary !min-h-[40px]" data-testid="view-site">
          <ExternalLink size={14}/>Voir le site
        </a>
      </div>

      <div className="flex gap-1 border-b border-[#ececec] overflow-x-auto" data-testid="sitevitrine-tabs">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} data-testid={`sv-tab-${t.id}`}
            className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 flex items-center gap-2 ${tab === t.id ? "border-[#b02a2a] text-[#b02a2a] font-semibold" : "border-transparent text-[#666]"}`}>
            <t.icon size={14}/>{t.label}
          </button>
        ))}
      </div>

      {tab === "apparence" && <ApparenceTab/>}
      {tab === "accueil" && <AccueilTab/>}
      {tab === "pages" && <PagesNavTab/>}
      {tab === "seo" && <SeoTab/>}
      {tab === "apercu" && <ApercuTab/>}
    </div>
  );
}

/* ========= Apparence ========= */
function ApparenceTab() {
  const [site, setSite] = useState({});
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/public/site").then(r => { setSite(r.data || {}); setTheme({ ...DEFAULT_THEME, ...(r.data?.theme || {}) }); }).catch(() => {});
  }, []);

  const contrast = useMemo(() => getContrastRatio(theme.text, theme.background), [theme.text, theme.background]);
  const buttonContrast = useMemo(() => getContrastRatio("#fff", theme.button), [theme.button]);

  const save = async () => {
    setSaving(true);
    try { await api.patch("/site", { theme }); toast.success("Apparence enregistrée — rechargez /boutique"); } 
    catch { toast.error("Erreur"); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="dina-card-white p-5">
        <div className="font-serif text-xl mb-3">Logo & identité visuelle</div>
        <p className="text-sm text-[#666]">Le logo est géré depuis <Link to="/console/parametres?tab=identite" className="text-[#b02a2a] underline">Paramètres → Identité</Link>. Il est utilisé partout : console, site, livreur, reçus, factures.</p>
        {site.logo && <img src={site.logo} alt="Logo" className="mt-3 h-16 object-contain"/>}
      </div>

      <div className="dina-card-white p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-serif text-xl">Palette de couleurs</div>
          <select onChange={e => { const p = PRESETS[+e.target.value]; if (p) setTheme({ ...theme, ...p }); }} className="dina-input !w-auto !h-9 text-xs" data-testid="theme-preset">
            <option value="">Appliquer un preset…</option>
            {PRESETS.map((p, i) => <option key={i} value={i}>{p.name}</option>)}
          </select>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <ColorField label="Primaire" value={theme.primary} onChange={v => setTheme({ ...theme, primary: v })} testId="color-primary"/>
          <ColorField label="Secondaire" value={theme.secondary} onChange={v => setTheme({ ...theme, secondary: v })} testId="color-secondary"/>
          <ColorField label="Boutons" value={theme.button} onChange={v => setTheme({ ...theme, button: v })} testId="color-button"/>
          <ColorField label="Fond" value={theme.background} onChange={v => setTheme({ ...theme, background: v })} testId="color-background"/>
          <ColorField label="Texte" value={theme.text} onChange={v => setTheme({ ...theme, text: v })} testId="color-text"/>
          <ColorField label="Fond (sombre)" value={theme.dark_background} onChange={v => setTheme({ ...theme, dark_background: v })} testId="color-dark-background"/>
          <ColorField label="Texte (sombre)" value={theme.dark_text} onChange={v => setTheme({ ...theme, dark_text: v })} testId="color-dark-text"/>
        </div>
        <div className="mt-3 flex gap-3 items-center text-xs">
          <ContrastBadge label="Texte sur fond" ratio={contrast}/>
          <ContrastBadge label="Blanc sur bouton" ratio={buttonContrast}/>
        </div>
      </div>

      <div className="dina-card-white p-5">
        <div className="font-serif text-xl mb-3">Typographie</div>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs uppercase text-[#666]">Police</label>
            <select className="dina-input" value={theme.font} onChange={e => setTheme({ ...theme, font: e.target.value })} data-testid="theme-font">
              {FONTS.map(f => <option key={f} value={f} style={{fontFamily: f}}>{f}</option>)}
            </select>
            <div className="mt-2 p-3 rounded-lg bg-[#fafafa]" style={{ fontFamily: theme.font }}>
              <div className="text-2xl font-bold">La boutique Chez Dina</div>
              <div className="text-sm text-[#666]">Aperçu rapide — abcdefg 1234567890</div>
            </div>
          </div>
          <div>
            <label className="text-xs uppercase text-[#666]">Rayon des coins (px)</label>
            <input type="range" min={0} max={24} value={theme.radius} onChange={e => setTheme({ ...theme, radius: +e.target.value })} className="w-full" data-testid="theme-radius"/>
            <div className="text-xs text-[#666] mt-1">{theme.radius}px</div>
            <div className="mt-2 h-16 bg-[#fff5f5]" style={{ borderRadius: theme.radius, border: `1px solid ${theme.primary}` }}></div>
          </div>
          <div>
            <label className="text-xs uppercase text-[#666]">Style des cartes</label>
            <div className="grid grid-cols-3 gap-1 mt-1">
              {[{v:"flat",l:"Plat"},{v:"soft",l:"Doux"},{v:"shadow",l:"Ombre"}].map(s => (
                <button key={s.v} onClick={() => setTheme({ ...theme, card_style: s.v })}
                  className={`py-2 rounded-lg border text-xs ${theme.card_style === s.v ? "border-[#b02a2a] bg-[#fff5f5] font-semibold" : "border-[#ececec]"}`}
                  data-testid={`theme-card-${s.v}`}>{s.l}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <SaveButton loading={saving} onClick={save} testid="apparence-save">Enregistrer l'apparence</SaveButton>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange, testId }) {
  return (
    <div>
      <label className="text-xs uppercase text-[#666]">{label}</label>
      <div className="flex items-center gap-2 mt-1">
        <input type="color" value={value} onChange={e => onChange(e.target.value)} className="w-10 h-10 rounded cursor-pointer" data-testid={testId}/>
        <input type="text" value={value} onChange={e => onChange(e.target.value)} className="dina-input !h-10 flex-1 font-mono text-xs"/>
      </div>
    </div>
  );
}

function ContrastBadge({ label, ratio }) {
  const ok = ratio >= 4.5;
  const okAA = ratio >= 3 && ratio < 4.5;
  return (
    <div className={`px-2 py-1 rounded ${ok ? "bg-[#e8f6ee] text-[#1f8a4c]" : okAA ? "bg-[#fff5e5] text-[#e4991e]" : "bg-[#fee] text-[#c62828]"}`}>
      {label} : {ratio.toFixed(2)}:1 {ok ? "✓" : okAA ? "⚠" : "✗"}
    </div>
  );
}

function hexToRgb(h) {
  let s = (h || "").replace("#", "");
  if (s.length === 3) s = s.split("").map(c => c + c).join("");
  if (s.length !== 6) return [0, 0, 0];
  const m = s.match(/.{2}/g); if (!m) return [0, 0, 0];
  return m.map(x => parseInt(x, 16));
}
function relLum([r,g,b]) {
  const f = (c) => { c/=255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
  return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b);
}
function getContrastRatio(a, b) {
  const l1 = relLum(hexToRgb(a)); const l2 = relLum(hexToRgb(b));
  const [L1, L2] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (L1 + 0.05) / (L2 + 0.05);
}

/* ========= Accueil (section builder) ========= */
function AccueilTab() {
  return (
    <div>
      <div className="dina-card-white p-4 mb-4">
        <p className="text-sm text-[#666]">Section builder pré-rempli avec le site actuel. Glissez-déposez pour réordonner, cliquez sur <strong>Éditer</strong> pour modifier, téléversez vos images (jamais d'URL).</p>
      </div>
      <SectionBuilder/>
    </div>
  );
}

/* ========= Pages & navigation ========= */
function PagesNavTab() {
  const [sub, setSub] = useState("pages");
  return (
    <div>
      <div className="flex gap-1 mb-4 flex-wrap">
        {[{id:"pages",l:"Pages"},{id:"menu",l:"Menu"},{id:"footer",l:"Pied de page"},{id:"social",l:"Réseaux sociaux"}].map(s => (
          <button key={s.id} onClick={() => setSub(s.id)} data-testid={`pn-sub-${s.id}`}
            className={`px-3 py-1.5 rounded-lg text-sm ${sub === s.id ? "bg-[#b02a2a] text-white" : "bg-[#fafafa] text-[#666]"}`}>{s.l}</button>
        ))}
      </div>
      {sub === "pages" && <PagesSub/>}
      {sub === "menu" && <MenuSub/>}
      {sub === "footer" && <FooterSub/>}
      {sub === "social" && <SocialSub/>}
    </div>
  );
}

function PagesSub() {
  const [pages, setPages] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = async () => { try { const r = await api.get("/pages"); setPages(r.data); } catch { toast.error("Erreur"); } };
  useEffect(() => { load(); }, []);
  const save = async () => {
    if (!editing?.slug) return;
    try { await api.patch(`/pages/${editing.slug}`, editing); toast.success("Enregistrée"); load(); }
    catch { toast.error("Erreur"); }
  };
  const create = async () => {
    const title = prompt("Titre de la page ?"); if (!title) return;
    const slug = prompt("URL (slug) ?", title.toLowerCase().replace(/\s+/g,"-")); if (!slug) return;
    try { await api.post("/pages", { slug, title, content: "", enabled: true }); load(); toast.success("Créée"); }
    catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };
  const del = async (slug) => { if (!window.confirm("Supprimer ?")) return; try { await api.delete(`/pages/${slug}`); setEditing(null); load(); } catch { toast.error("Erreur"); } };
  const toggle = async (p) => { try { await api.patch(`/pages/${p.slug}`, { enabled: !p.enabled }); load(); } catch {} };

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-4">
      <div className="dina-card-white p-3 space-y-1 h-fit">
        <button onClick={create} className="dina-btn-primary w-full !min-h-[36px] mb-2" data-testid="page-new"><Plus size={14}/> Nouvelle page</button>
        {pages.map(p => (
          <div key={p.slug} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer ${editing?.slug === p.slug ? "bg-[#fff5f5]" : "hover:bg-[#fafafa]"}`} onClick={() => setEditing(p)} data-testid={`page-row-${p.slug}`}>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{p.title}</div>
              <div className="text-xs text-[#666]">/{p.slug}</div>
            </div>
            <button onClick={e => { e.stopPropagation(); toggle(p); }} className={`text-xs ${p.enabled ? "text-[#1f8a4c]" : "text-[#999]"}`}>{p.enabled ? "✓" : "○"}</button>
          </div>
        ))}
      </div>
      {editing && (
        <div className="dina-card-white p-5 space-y-3" data-testid="page-editor">
          <input className="dina-input" placeholder="Titre" value={editing.title} onChange={e => setEditing({...editing, title: e.target.value})} data-testid="page-title"/>
          <input className="dina-input font-mono text-xs" placeholder="slug" value={editing.slug} readOnly/>
          <textarea className="dina-input" rows={10} placeholder="Contenu (texte riche)" value={editing.content || ""} onChange={e => setEditing({...editing, content: e.target.value})} data-testid="page-content"/>
          <div className="grid md:grid-cols-2 gap-2">
            <input className="dina-input text-sm" placeholder="Titre SEO" value={editing.seo_title || ""} onChange={e => setEditing({...editing, seo_title: e.target.value})}/>
            <input className="dina-input text-sm" placeholder="Description SEO" value={editing.seo_description || ""} onChange={e => setEditing({...editing, seo_description: e.target.value})}/>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!editing.enabled} onChange={e => setEditing({...editing, enabled: e.target.checked})}/> Activer la page</label>
          <div className="flex gap-2">
            <button onClick={save} className="dina-btn-primary" data-testid="page-save"><Save size={14}/> Enregistrer</button>
            <button onClick={() => del(editing.slug)} className="text-[#c62828] text-sm">Supprimer</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuSub() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/public/site").then(r => setItems(r.data?.menu || DEFAULT_MENU)).catch(() => setItems(DEFAULT_MENU)); }, []);
  const save = async () => { try { await api.patch("/site", { menu: items }); toast.success("Enregistré"); } catch { toast.error("Erreur"); } };
  const update = (i, patch) => { const n = [...items]; n[i] = { ...n[i], ...patch }; setItems(n); };
  const remove = (i) => setItems(items.filter((_, k) => k !== i));
  const add = () => setItems([...items, { label: "Nouveau", link: "/boutique/catalog" }]);
  return (
    <div className="dina-card-white p-5 space-y-2" data-testid="menu-editor">
      <div className="font-serif text-xl mb-2">Menu principal</div>
      {items.map((it, i) => (
        <div key={i} className="flex gap-2 items-center" data-testid={`menu-item-${i}`}>
          <GripVertical size={12} className="text-[#999]"/>
          <input className="dina-input flex-1" placeholder="Libellé" value={it.label} onChange={e => update(i, { label: e.target.value })}/>
          <input className="dina-input flex-1" placeholder="Lien" value={it.link} onChange={e => update(i, { link: e.target.value })}/>
          <button onClick={() => remove(i)} className="text-[#c62828]"><Trash2 size={14}/></button>
        </div>
      ))}
      <div className="flex gap-2 pt-2">
        <button onClick={add} className="dina-btn-secondary !min-h-[36px]" data-testid="menu-add"><Plus size={14}/> Ajouter</button>
        <button onClick={save} className="dina-btn-primary !min-h-[36px] ml-auto" data-testid="menu-save"><Save size={14}/> Enregistrer</button>
      </div>
    </div>
  );
}

const DEFAULT_MENU = [
  { label: "Catalogue", link: "/boutique/catalog" },
  { label: "Talons & Chaussures", link: "/boutique/catalog?category=Chaussures" },
  { label: "Robes", link: "/boutique/catalog?category=Robes" },
  { label: "Sacs", link: "/boutique/catalog?category=Sacs" },
  { label: "Accessoires", link: "/boutique/catalog?category=Accessoires" },
];

function FooterSub() {
  const [footer, setFooter] = useState({ tagline: "", columns: [] });
  useEffect(() => { api.get("/public/site").then(r => setFooter(r.data?.footer || { tagline: "Mode féminine · Abidjan.", columns: [] })).catch(() => {}); }, []);
  const save = async () => { try { await api.patch("/site", { footer }); toast.success("Enregistré"); } catch { toast.error("Erreur"); } };
  const addCol = () => setFooter({ ...footer, columns: [...(footer.columns || []), { title: "Section", items: [{label:"Lien",link:"/"}] }] });
  const upCol = (i, patch) => { const n = [...footer.columns]; n[i] = { ...n[i], ...patch }; setFooter({ ...footer, columns: n }); };
  const addItem = (ci) => { const n = [...footer.columns]; n[ci].items = [...(n[ci].items||[]), {label:"",link:""}]; setFooter({...footer, columns: n}); };
  const upItem = (ci, ii, patch) => { const n = [...footer.columns]; n[ci].items[ii] = {...n[ci].items[ii], ...patch}; setFooter({...footer, columns:n}); };
  return (
    <div className="dina-card-white p-5 space-y-3" data-testid="footer-editor">
      <div className="font-serif text-xl">Pied de page</div>
      <input className="dina-input" placeholder="Tagline" value={footer.tagline || ""} onChange={e => setFooter({...footer, tagline: e.target.value})} data-testid="footer-tagline"/>
      <div className="grid md:grid-cols-2 gap-3">
        {(footer.columns || []).map((c, ci) => (
          <div key={ci} className="border border-[#ececec] rounded-lg p-3 space-y-2">
            <input className="dina-input" placeholder="Titre colonne" value={c.title} onChange={e => upCol(ci, { title: e.target.value })}/>
            {(c.items || []).map((it, ii) => (
              <div key={ii} className="flex gap-1">
                <input className="dina-input !h-8 text-xs" placeholder="Libellé" value={it.label} onChange={e => upItem(ci, ii, { label: e.target.value })}/>
                <input className="dina-input !h-8 text-xs" placeholder="Lien" value={it.link} onChange={e => upItem(ci, ii, { link: e.target.value })}/>
              </div>
            ))}
            <button onClick={() => addItem(ci)} className="text-xs text-[#b02a2a]">+ Lien</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={addCol} className="dina-btn-secondary !min-h-[36px]"><Plus size={14}/> Colonne</button>
        <button onClick={save} className="dina-btn-primary !min-h-[36px] ml-auto" data-testid="footer-save"><Save size={14}/> Enregistrer</button>
      </div>
    </div>
  );
}

function SocialSub() {
  const [social, setSocial] = useState({});
  useEffect(() => { api.get("/public/site").then(r => setSocial(r.data?.social || {})).catch(() => {}); }, []);
  const save = async () => { try { await api.patch("/site", { social }); toast.success("Enregistré · seuls les réseaux remplis s'affichent"); } catch { toast.error("Erreur"); } };
  return (
    <div className="dina-card-white p-5 space-y-3" data-testid="social-editor">
      <div className="font-serif text-xl">Réseaux sociaux</div>
      <p className="text-xs text-[#666]">Collez vos liens. Seuls les réseaux renseignés apparaissent dans le pied de page du site.</p>
      {SOCIAL_META.map(s => (
        <div key={s.k} className="flex items-center gap-2">
          <s.icon size={16} className="text-[#b02a2a] shrink-0"/>
          <div className="w-24 text-sm font-medium">{s.label}</div>
          <input className="dina-input flex-1" placeholder={s.placeholder} value={social[s.k] || ""} onChange={e => setSocial({...social, [s.k]: e.target.value})} data-testid={`social-${s.k}`}/>
          {social[s.k] && <Check size={14} className="text-[#1f8a4c]"/>}
        </div>
      ))}
      <button onClick={save} className="dina-btn-primary" data-testid="social-save"><Save size={14}/> Enregistrer</button>
    </div>
  );
}

/* ========= SEO & partage ========= */
function SeoTab() {
  const [seo, setSeo] = useState({ title: "Chez Dina — Mode féminine à Abidjan", description: "", share_image: "", pixel_fb: "", pixel_tiktok: "", pixel_google: "" });
  useEffect(() => { api.get("/public/site").then(r => setSeo(prev => ({...prev, ...(r.data?.seo || {})}))).catch(() => {}); }, []);
  const save = async () => { try { await api.patch("/site", { seo }); toast.success("SEO enregistré"); } catch { toast.error("Erreur"); } };
  const onShareImg = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 2*1024*1024) return toast.error("Max 2 Mo");
    const r = new FileReader(); r.onload = () => setSeo({...seo, share_image: r.result}); r.readAsDataURL(f);
  };
  return (
    <div className="space-y-4">
      <div className="dina-card-white p-5 space-y-3" data-testid="seo-editor">
        <div className="font-serif text-xl">Référencement général</div>
        <div>
          <label className="text-xs uppercase text-[#666]">Titre du site (max 60)</label>
          <input className="dina-input" maxLength={60} value={seo.title || ""} onChange={e => setSeo({...seo, title: e.target.value})} data-testid="seo-title"/>
          <div className="text-xs text-[#999] mt-1">{seo.title?.length || 0}/60</div>
        </div>
        <div>
          <label className="text-xs uppercase text-[#666]">Description (max 160)</label>
          <textarea className="dina-input" maxLength={160} rows={2} value={seo.description || ""} onChange={e => setSeo({...seo, description: e.target.value})} data-testid="seo-description"/>
          <div className="text-xs text-[#999] mt-1">{seo.description?.length || 0}/160</div>
        </div>
        <div>
          <label className="text-xs uppercase text-[#666]">Image de partage (OpenGraph)</label>
          {seo.share_image && <img src={seo.share_image} alt="" className="h-24 rounded-lg mt-1 mb-2"/>}
          <label className="dina-btn-secondary cursor-pointer inline-flex !min-h-[36px]" data-testid="seo-share-upload-btn">
            <Upload size={14}/> Téléverser
            <input type="file" accept="image/*" className="hidden" onChange={onShareImg} data-testid="seo-share-upload"/>
          </label>
        </div>
      </div>

      <div className="dina-card-white p-5 space-y-3">
        <div className="font-serif text-xl">Pixels & analytics</div>
        <input className="dina-input" placeholder="Facebook Pixel ID" value={seo.pixel_fb || ""} onChange={e => setSeo({...seo, pixel_fb: e.target.value})} data-testid="pixel-fb"/>
        <input className="dina-input" placeholder="TikTok Pixel ID" value={seo.pixel_tiktok || ""} onChange={e => setSeo({...seo, pixel_tiktok: e.target.value})} data-testid="pixel-tiktok"/>
        <input className="dina-input" placeholder="Google Analytics (G-...)" value={seo.pixel_google || ""} onChange={e => setSeo({...seo, pixel_google: e.target.value})} data-testid="pixel-google"/>
      </div>

      <div className="dina-card-white p-5 flex items-center gap-3">
        <Globe size={18} className="text-[#b02a2a]"/>
        <div className="flex-1">
          <div className="font-semibold text-sm">Sitemap</div>
          <div className="text-xs text-[#666]">Généré automatiquement — accessible à <code className="text-[#b02a2a]">/sitemap.xml</code></div>
        </div>
        <a href="/sitemap.xml" target="_blank" rel="noreferrer" className="dina-btn-secondary !min-h-[36px] text-xs" data-testid="sitemap-link">Ouvrir</a>
      </div>

      <div className="flex justify-end">
        <button onClick={save} className="dina-btn-primary" data-testid="seo-save"><Save size={14}/> Enregistrer SEO</button>
      </div>
    </div>
  );
}

/* ========= Aperçu ========= */
function ApercuTab() {
  const [mode, setMode] = useState("desktop");
  const url = `${window.location.origin}/boutique`;
  const copy = () => {
    try { navigator.clipboard.writeText(url).then(() => toast.success("Lien copié !")).catch(() => toast.info(url)); }
    catch { toast.info(url); }
  };
  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center flex-wrap">
        <div className="flex gap-1 bg-[#fafafa] p-1 rounded-lg">
          <button onClick={() => setMode("desktop")} className={`px-3 py-1.5 text-xs rounded flex items-center gap-1 ${mode === "desktop" ? "bg-white shadow-sm font-semibold" : ""}`} data-testid="preview-desktop"><Monitor size={12}/> Desktop</button>
          <button onClick={() => setMode("mobile")} className={`px-3 py-1.5 text-xs rounded flex items-center gap-1 ${mode === "mobile" ? "bg-white shadow-sm font-semibold" : ""}`} data-testid="preview-mobile"><Smartphone size={12}/> Mobile</button>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={copy} className="dina-btn-secondary !min-h-[36px]" data-testid="share-link"><Share2 size={14}/> Partager le lien</button>
          <a href={url} target="_blank" rel="noreferrer" className="dina-btn-primary !min-h-[36px]" data-testid="publish"><ExternalLink size={14}/> Ouvrir le site publié</a>
        </div>
      </div>
      <div className="dina-card-white p-4 flex justify-center bg-[#fafafa]">
        <div className="bg-white rounded-lg overflow-hidden shadow-lg" style={{ width: mode === "mobile" ? 375 : "100%", maxWidth: mode === "mobile" ? 375 : 1280, height: 720 }}>
          <iframe src={url} title="Aperçu" className="w-full h-full border-0" data-testid="preview-iframe"/>
        </div>
      </div>
    </div>
  );
}
