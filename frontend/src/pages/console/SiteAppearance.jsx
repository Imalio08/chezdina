import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { ExternalLink, Save, Image as ImageIcon, Megaphone, BookOpen, ShieldCheck, PanelTop, Sparkles } from "lucide-react";
import ImageUpload from "@/components/shared/ImageUpload";
import IconPicker from "@/components/shared/IconPicker";
import SaveButton from "@/components/shared/SaveButton";

const TABS = [
  { id: "hero", label: "Hero", icon: PanelTop },
  { id: "popup", label: "Popup bienvenue", icon: Sparkles },
  { id: "announcement", label: "Bandeau annonce", icon: Megaphone },
  { id: "lookbook", label: "Lookbook", icon: BookOpen },
  { id: "trust", label: "Rassurance", icon: ShieldCheck },
];

export default function SiteAppearance() {
  const [tab, setTab] = useState("hero");
  const [site, setSite] = useState({});
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/public/site").then(r => setSite(r.data || {})).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async (patch) => {
    setSaving(true);
    try {
      await api.patch("/site", patch);
      toast.success("Enregistré"); load();
    } catch { toast.error("Erreur"); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Apparence du site</h1><p className="text-sm text-[#666]">Modifiez les blocs de la page d'accueil</p></div>
        <a href="/" target="_blank" rel="noreferrer" className="dina-btn-secondary !min-h-[40px]" data-testid="view-site"><ExternalLink size={14}/>Voir le site</a>
      </div>

      <div className="flex gap-1 border-b border-[#ececec] dark:border-[#2a2a2a] overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon; const active = tab === t.id;
          return <button key={t.id} onClick={()=>setTab(t.id)} className={`px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap flex items-center gap-1 ${active?"border-[#b02a2a] text-[#b02a2a]":"border-transparent text-[#666]"}`} data-testid={`sa-tab-${t.id}`}><Icon size={12}/>{t.label}</button>;
        })}
      </div>

      {tab === "hero" && <HeroTab site={site} onSave={save} saving={saving}/>}
      {tab === "popup" && <PopupTab site={site} onSave={save} saving={saving}/>}
      {tab === "announcement" && <AnnouncementTab site={site} onSave={save} saving={saving}/>}
      {tab === "lookbook" && <LookbookTab site={site} onSave={save} saving={saving}/>}
      {tab === "trust" && <TrustTab site={site} onSave={save} saving={saving}/>}
    </div>
  );
}

function HeroTab({ site, onSave, saving }) {
  const [h, setH] = useState(site.hero || { tagline:"", title:"", highlight:"", subtitle:"", cta_label:"", cta_link:"", mosaic:["","","",""] });
  useEffect(() => { if (site.hero) setH({...h, ...site.hero}); }, [site]); // eslint-disable-line
  const updImg = (i, imgs) => { const m=[...(h.mosaic||[])]; m[i]=imgs[0]||""; setH({...h, mosaic:m}); };
  return (
    <div className="dina-card-white p-5 space-y-3">
      <div className="font-serif text-xl">Hero mosaïque</div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Input label="Mini-titre" value={h.tagline} onChange={v=>setH({...h,tagline:v})} testid="hero-tagline"/>
          <Input label="Titre" value={h.title} onChange={v=>setH({...h,title:v})} testid="hero-title"/>
          <Input label="Mot mis en avant" value={h.highlight} onChange={v=>setH({...h,highlight:v})} testid="hero-highlight"/>
          <Textarea label="Sous-titre" value={h.subtitle} onChange={v=>setH({...h,subtitle:v})} testid="hero-subtitle"/>
          <Input label="Bouton CTA" value={h.cta_label||""} onChange={v=>setH({...h,cta_label:v})} testid="hero-cta-label"/>
          <Input label="Lien CTA" value={h.cta_link||""} onChange={v=>setH({...h,cta_link:v})} testid="hero-cta-link"/>
        </div>
        <div>
          <label className="text-[10px] uppercase text-[#666] font-semibold">4 images mosaïque</label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {[0,1,2,3].map(i => (
              <ImageUpload key={i} value={h.mosaic?.[i]?[h.mosaic[i]]:[]} onChange={imgs=>updImg(i,imgs)} single max={1} maxKB={300} testid={`hero-mosaic-${i}`}/>
            ))}
          </div>
        </div>
      </div>
      <SaveButton loading={saving} onClick={()=>onSave({ hero: h })} testid="hero-save"/>
    </div>
  );
}

function PopupTab({ site, onSave, saving }) {
  const [p, setP] = useState(site.welcome_popup || { enabled:false, image:"", title:"", offer:"", code:"", delay_s:8 });
  useEffect(() => { if (site.welcome_popup) setP({...p, ...site.welcome_popup}); }, [site]); // eslint-disable-line
  return (
    <div className="dina-card-white p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-serif text-xl">Popup de bienvenue</div>
        <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={!!p.enabled} onChange={e=>setP({...p,enabled:e.target.checked})} className="accent-[#b02a2a]" data-testid="popup-enabled"/>Activé</label>
      </div>
      <p className="text-xs text-[#666]">Apparaît une seule fois par visite, après le délai choisi.</p>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Input label="Titre" value={p.title} onChange={v=>setP({...p,title:v})} testid="popup-title"/>
          <Input label="Offre (ex: -10% sur la première commande)" value={p.offer} onChange={v=>setP({...p,offer:v})} testid="popup-offer"/>
          <Input label="Code promo (ex: BIENVENUE)" value={p.code} onChange={v=>setP({...p,code:v})} testid="popup-code"/>
          <Input label="Délai avant affichage (secondes)" type="number" value={p.delay_s||8} onChange={v=>setP({...p,delay_s:+v||0})} testid="popup-delay"/>
        </div>
        <div>
          <label className="text-[10px] uppercase text-[#666] font-semibold">Image</label>
          <ImageUpload value={p.image?[p.image]:[]} onChange={imgs=>setP({...p,image:imgs[0]||""})} single max={1} maxKB={300} testid="popup-image"/>
        </div>
      </div>
      <SaveButton loading={saving} onClick={()=>onSave({ welcome_popup: p })} testid="popup-save"/>
    </div>
  );
}

function AnnouncementTab({ site, onSave, saving }) {
  const [a, setA] = useState(site.announcement || { enabled:false, text:"", link:"", bg_color:"#b02a2a", text_color:"#ffffff" });
  useEffect(() => { if (site.announcement) setA({...a, ...site.announcement}); }, [site]); // eslint-disable-line
  return (
    <div className="dina-card-white p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-serif text-xl">Bandeau annonce</div>
        <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={!!a.enabled} onChange={e=>setA({...a,enabled:e.target.checked})} className="accent-[#b02a2a]" data-testid="ann-enabled"/>Activé</label>
      </div>
      <p className="text-xs text-[#666]">Bandeau en haut de toutes les pages du site.</p>
      <Input label="Texte du bandeau" value={a.text} onChange={v=>setA({...a,text:v})} testid="ann-text"/>
      <Input label="Lien (optionnel)" value={a.link||""} onChange={v=>setA({...a,link:v})} testid="ann-link"/>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-[10px] uppercase text-[#666] font-semibold">Fond</label><input type="color" className="dina-input h-10" value={a.bg_color||"#b02a2a"} onChange={e=>setA({...a,bg_color:e.target.value})} data-testid="ann-bg"/></div>
        <div><label className="text-[10px] uppercase text-[#666] font-semibold">Texte</label><input type="color" className="dina-input h-10" value={a.text_color||"#ffffff"} onChange={e=>setA({...a,text_color:e.target.value})} data-testid="ann-fg"/></div>
      </div>
      <div className="rounded-lg py-2 px-3 text-center text-sm font-medium" style={{background:a.bg_color,color:a.text_color}}>{a.text || "Aperçu du bandeau…"}</div>
      <SaveButton loading={saving} onClick={()=>onSave({ announcement: a })} testid="ann-save"/>
    </div>
  );
}

function LookbookTab({ site, onSave, saving }) {
  const [books, setBooks] = useState(site.lookbook || []);
  useEffect(() => { setBooks(site.lookbook || []); }, [site.lookbook]);
  const add = () => setBooks([...books, { title: "Nouveau look", image: "", product_ids: [] }]);
  const upd = (i, k, v) => { const n = [...books]; n[i] = { ...n[i], [k]: v }; setBooks(n); };
  const rm = (i) => setBooks(books.filter((_,idx) => idx !== i));
  return (
    <div className="dina-card-white p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div><div className="font-serif text-xl">Lookbook éditorial</div><p className="text-xs text-[#666]">Chaque look = image + produits associés</p></div>
        <button onClick={add} className="dina-btn-secondary !min-h-[36px] text-xs" data-testid="lb-add">+ Nouveau look</button>
      </div>
      {books.length === 0 && <div className="text-sm text-[#666] text-center py-6">Aucun look pour le moment</div>}
      {books.map((b, i) => (
        <div key={i} className="dina-card-white p-4 border border-[#ececec] dark:border-[#2a2a2a]" data-testid={`lb-item-${i}`}>
          <div className="grid md:grid-cols-[200px_1fr] gap-3">
            <ImageUpload value={b.image?[b.image]:[]} onChange={imgs=>upd(i,"image",imgs[0]||"")} single max={1} maxKB={400} testid={`lb-img-${i}`}/>
            <div className="space-y-2">
              <Input label="Titre" value={b.title} onChange={v=>upd(i,"title",v)} testid={`lb-title-${i}`}/>
              <Input label="IDs produits (séparés par virgule)" value={(b.product_ids||[]).join(", ")} onChange={v=>upd(i,"product_ids",v.split(",").map(s=>s.trim()).filter(Boolean))} testid={`lb-pids-${i}`}/>
              <button onClick={()=>rm(i)} className="text-xs text-[#c62828] hover:underline">Supprimer ce look</button>
            </div>
          </div>
        </div>
      ))}
      <SaveButton loading={saving} onClick={()=>onSave({ lookbook: books })} testid="lb-save"/>
    </div>
  );
}

function TrustTab({ site, onSave, saving }) {
  const [t, setT] = useState(site.trust_band || { items: [
    { icon:"truck", title:"Livraison 24h", text:"Partout à Abidjan." },
    { icon:"shield", title:"Paiement livraison", text:"Espèces ou Wave à la réception." },
    { icon:"whatsapp", title:"Conseillère WhatsApp", text:"0777 92 61 79 — 7j/7." },
  ]});
  useEffect(() => { if (site.trust_band) setT({...t, ...site.trust_band}); }, [site]); // eslint-disable-line
  const upd = (i, k, v) => { const items = [...t.items]; items[i] = { ...items[i], [k]: v }; setT({...t, items}); };
  const add = () => setT({...t, items: [...t.items, {icon:"shield",title:"",text:""}]});
  const rm = (i) => setT({...t, items: t.items.filter((_,idx)=>idx!==i)});
  return (
    <div className="dina-card-white p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-serif text-xl">Bandeau rassurance</div>
        <button onClick={add} className="dina-btn-secondary !min-h-[36px] text-xs">+ Ajouter</button>
      </div>
      {t.items.map((it,i)=>(
        <div key={i} className="grid md:grid-cols-[160px_1fr_1fr_auto] gap-2 items-end border border-[#ececec] dark:border-[#2a2a2a] rounded-lg p-3" data-testid={`trust-item-${i}`}>
          <div><label className="text-[10px] uppercase text-[#666]">Icône</label>
            <IconPicker value={it.icon} onChange={v=>upd(i,"icon",v)} testid={`trust-icon-${i}`}/>
          </div>
          <Input label="Titre" value={it.title} onChange={v=>upd(i,"title",v)} testid={`trust-title-${i}`}/>
          <Input label="Texte" value={it.text} onChange={v=>upd(i,"text",v)} testid={`trust-text-${i}`}/>
          <button onClick={()=>rm(i)} className="text-[#c62828] text-sm">Retirer</button>
        </div>
      ))}
      <SaveButton loading={saving} onClick={()=>onSave({ trust_band: t })} testid="trust-save"/>
    </div>
  );
}

function Input({ label, value, onChange, type="text", testid }) {
  return <div><label className="text-[10px] uppercase text-[#666] font-semibold">{label}</label><input type={type} className="dina-input mt-1" value={value||""} onChange={e=>onChange(e.target.value)} data-testid={testid}/></div>;
}
function Textarea({ label, value, onChange, testid }) {
  return <div><label className="text-[10px] uppercase text-[#666] font-semibold">{label}</label><textarea rows={3} className="dina-input mt-1" value={value||""} onChange={e=>onChange(e.target.value)} data-testid={testid}/></div>;
}
