import React, { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  Save, Upload, Store, Phone, ShoppingCart, Truck, CreditCard, FileText,
  Bell, Plug, Users, Shield, Database, Trash2, Image as ImageIcon, Clock,
  Smartphone, GripVertical, Plus, X, RotateCcw,
} from "lucide-react";
import SaveButton from "@/components/shared/SaveButton";
import WeekGrid from "@/components/shared/WeekGrid";
import { ExceptionsEditor } from "@/components/storefront/OpeningHoursEditor";
import StoreLocation from "@/components/settings/StoreLocation";
import { HoursFields, EmployeeHours, useHoursConfig } from "@/components/settings/AttendanceHours";
import Audit from "@/pages/console/Audit";
import DocTemplates from "@/components/settings/DocTemplates";

const SAVED_MSG = "Modifications enregistrées";
const ERROR_MSG = "Erreur · modifications non enregistrées";

const TABS = [
  { id: "identite", label: "Identité", icon: Store },
  { id: "coordonnees", label: "Coordonnées", icon: Phone },
  { id: "ventes", label: "Ventes & caisse", icon: ShoppingCart },
  { id: "livraison", label: "Livraison", icon: Truck },
  { id: "paiements", label: "Paiements", icon: CreditCard },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "documents-rh", label: "Documents RH", icon: FileText },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "integrations", label: "Intégrations", icon: Plug },
  { id: "equipe", label: "Équipe & horaires", icon: Users },
  { id: "pointage", label: "Pointage", icon: Clock },
  { id: "securite", label: "Sécurité & audit", icon: Shield },
  { id: "donnees", label: "Données", icon: Database },
];

export default function Settings() {
  const [sp, setSp] = useSearchParams();
  const [tab, setTab] = useState(sp.get("tab") || "identite");
  useEffect(() => { setSp({ tab }, { replace: true }); }, [tab]);

  // Paiements tab state
  const [site, setSiteSettings] = useState({ wave_payment_link: "", deposit_policy: { mode: "none", value: 0, threshold: 0 }, social: {} });
  const [savingPay, setSavingPay] = useState(false);
  useEffect(() => { if (tab === "paiements" || tab === "coordonnees") api.get("/public/site").then(r => setSiteSettings(prev => ({ ...prev, ...(r.data || {}) }))).catch(() => {}); }, [tab]);
  const savePay = async () => {
    if (savingPay) return;
    setSavingPay(true);
    try {
      await api.patch("/site", { wave_payment_link: site.wave_payment_link, deposit_policy: site.deposit_policy, social: site.social });
      toast.success("Modifications enregistrées · appliquées sur la vitrine");
    } catch { toast.error("Erreur enregistrement"); } finally { setSavingPay(false); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-3xl">Paramètres</h1>
        <p className="text-sm text-[#666]">Configuration de votre boutique Chez Dina</p>
      </div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-5">
        <aside className="dina-card-white p-2 h-fit sticky top-24" data-testid="settings-menu">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left ${tab === t.id ? "bg-[#fff5f5] text-[#b02a2a] font-semibold" : "hover:bg-[#fafafa]"}`}
              data-testid={`settings-tab-${t.id}`}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </aside>

        <main className="min-w-0">
          {tab === "identite" && <IdentiteTab />}
          {tab === "coordonnees" && <CoordonneesTab />}
          {tab === "ventes" && <VentesTab />}
          {tab === "livraison" && <LivraisonTab />}
          {tab === "paiements" && <PaiementsTab />}
          {tab === "documents" && <DocumentsTab />}
          {tab === "documents-rh" && <DocTemplates />}
          {tab === "notifications" && <NotificationsTab />}
          {tab === "integrations" && <IntegrationsTab />}
          {tab === "equipe" && <EquipeTab />}
          {tab === "pointage" && <PointageTab />}
          {tab === "securite" && <><SecuriteTab /><div className="mt-6"><Audit /></div></>}
          {tab === "donnees" && <DonneesTab />}
        </main>
      </div>
    </div>
  );
}

/* -------- Identité boutique (logo centralisé) -------- */
function IdentiteTab() {
  const [b, setB] = useState({});
  const [site, setSite] = useState({});
  const logoRef = useRef(null);
  const favRef = useRef(null);

  useEffect(() => {
    api.get("/business").then(r => setB(r.data || {})).catch(() => {});
    api.get("/public/site").then(r => setSite(r.data || {})).catch(() => {});
  }, []);

  const upload = (file, cb) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Max 2 Mo");
    const r = new FileReader();
    r.onload = () => cb(r.result);
    r.readAsDataURL(file);
  };

  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await api.patch("/business", b);
      await api.patch("/site", { logo: site.logo, favicon: site.favicon });
      window.dispatchEvent(new Event("branding-changed"));
      toast.success("Identité enregistrée · logo propagé partout (PWA incluse)");
    } catch { toast.error(ERROR_MSG); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4" data-testid="tab-identite">
      <div className="dina-card-white p-5">
        <div className="font-serif text-xl mb-3">Logo</div>
        <p className="text-xs text-[#666] mb-3">Utilisé automatiquement sur la console, l'espace livreur, le site, les reçus, factures et fiches colis.</p>
        <div className="flex items-center gap-4">
          {site.logo ? <img src={site.logo} alt="Logo" className="h-20 object-contain border rounded-lg p-2 bg-white" data-testid="logo-preview"/> : <div className="h-20 w-20 rounded-lg bg-[#fff5f5] grid place-items-center text-[#b02a2a] font-serif text-2xl font-bold">CD</div>}
          <label className="dina-btn-secondary cursor-pointer !min-h-[36px]" data-testid="logo-upload-btn">
            <Upload size={14}/> Téléverser
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => upload(e.target.files[0], v => setSite({...site, logo: v}))} data-testid="logo-upload"/>
          </label>
          {site.logo && <button onClick={() => setSite({...site, logo: ""})} className="text-[#c62828] text-xs">Retirer</button>}
        </div>
      </div>

      <div className="dina-card-white p-5 space-y-3">
        <div className="font-serif text-xl">Nom & identité</div>
        <input className="dina-input" placeholder="Nom de la boutique" value={b.name || ""} onChange={e => setB({...b, name: e.target.value})} data-testid="biz-name"/>
        <input className="dina-input" placeholder="Slogan / tagline" value={b.tagline || ""} onChange={e => setB({...b, tagline: e.target.value})} data-testid="biz-tagline"/>
        <textarea className="dina-input" rows={3} placeholder="Description courte" value={b.description || ""} onChange={e => setB({...b, description: e.target.value})} data-testid="biz-description"/>
      </div>

      <div className="dina-card-white p-5">
        <div className="font-serif text-xl mb-3">Favicon</div>
        <div className="flex items-center gap-4">
          {site.favicon ? <img src={site.favicon} alt="Favicon" className="h-10 w-10 object-contain border rounded"/> : <div className="h-10 w-10 rounded bg-[#fff5f5] grid place-items-center text-[#b02a2a] text-sm font-bold">CD</div>}
          <label className="dina-btn-secondary cursor-pointer !min-h-[36px]">
            <Upload size={14}/> Téléverser
            <input ref={favRef} type="file" accept="image/*" className="hidden" onChange={e => upload(e.target.files[0], v => setSite({...site, favicon: v}))}/>
          </label>
        </div>
      </div>

      <SaveButton loading={saving} onClick={save} testid="identite-save">Enregistrer l'identité</SaveButton>
    </div>
  );
}

/* -------- Coordonnées -------- */
function CoordonneesTab() {
  const [b, setB] = useState({});
  const [oh, setOh] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.get("/business").then(r => setB(r.data || {})).catch(() => {});
    api.get("/public/site").then(r => setOh(r.data?.opening_hours || {})).catch(() => {});
  }, []);
  const save = async () => {
    if (saving) return; setSaving(true);
    try { await Promise.all([api.patch("/business", b), api.patch("/site", { opening_hours: oh })]); toast.success(SAVED_MSG); }
    catch { toast.error(ERROR_MSG); } finally { setSaving(false); }
  };
  const upd = (k, v) => setB({...b, [k]: v});
  return (
    <div className="dina-card-white p-5 space-y-3" data-testid="tab-coordonnees">
      <div className="font-serif text-xl">Coordonnées</div>
      <textarea className="dina-input" rows={2} placeholder="Adresse complète" value={b.address || ""} onChange={e => upd("address", e.target.value)} data-testid="biz-address"/>
      <StoreLocation value={{ lat: b.lat, lng: b.lng }} onChange={(c) => setB(x => ({ ...x, ...c }))}/>
      <div className="grid grid-cols-2 gap-2">
        <input className="dina-input" placeholder="Téléphone" value={b.phone || ""} onChange={e => upd("phone", e.target.value)} data-testid="biz-phone"/>
        <input className="dina-input" placeholder="WhatsApp" value={b.whatsapp || ""} onChange={e => upd("whatsapp", e.target.value)}/>
        <input className="dina-input" placeholder="Email" value={b.email || ""} onChange={e => upd("email", e.target.value)}/>
        <input className="dina-input" placeholder="RCCM" value={b.rccm || ""} onChange={e => upd("rccm", e.target.value)}/>
        <input className="dina-input" placeholder="NCC" value={b.ncc || ""} onChange={e => upd("ncc", e.target.value)}/>
      </div>
      <div className="text-sm font-semibold pt-2">Horaires d'ouverture</div>
      <WeekGrid value={oh} onChange={setOh} testid="opening"/>
      <ExceptionsEditor value={oh.exceptions || []} onChange={ex => setOh({ ...oh, exceptions: ex })}/>
      <SaveButton loading={saving} onClick={save} testid="coordonnees-save"/>
    </div>
  );
}

/* -------- Ventes & caisse -------- */
function VentesTab() {
  const [s, setS] = useState({ discount_max: 20, out_of_stock_rule: "block", exchange_policy: "48h non portés", float_default: 10000, cancel_reasons: ["Rupture","Changement d'avis","Prix élevé"] });
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get("/public/site").then(r => setS({...s, ...(r.data?.sales || {})})).catch(() => {}); /* eslint-disable-next-line */ }, []);
  const save = async () => { if (saving) return; setSaving(true); try { await api.patch("/site", { sales: s }); toast.success(SAVED_MSG); } catch { toast.error(ERROR_MSG); } finally { setSaving(false); } };
  return (
    <div className="dina-card-white p-5 space-y-3" data-testid="tab-ventes">
      <div className="font-serif text-xl">Ventes & caisse</div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-[#666]">Remise max (%)
          <input type="number" className="dina-input" value={s.discount_max} onChange={e => setS({...s, discount_max: +e.target.value})} data-testid="discount-max"/>
        </label>
        <label className="text-xs text-[#666]">Fond de caisse par défaut (FCFA)
          <input type="number" className="dina-input" value={s.float_default} onChange={e => setS({...s, float_default: +e.target.value})}/>
        </label>
        <label className="text-xs text-[#666]">Règle de rupture
          <select className="dina-input" value={s.out_of_stock_rule} onChange={e => setS({...s, out_of_stock_rule: e.target.value})}>
            <option value="block">Bloquer la vente</option>
            <option value="warn">Avertir mais autoriser</option>
            <option value="backorder">Accepter en précommande</option>
          </select>
        </label>
        <label className="text-xs text-[#666]">Politique d'échange
          <input className="dina-input" value={s.exchange_policy} onChange={e => setS({...s, exchange_policy: e.target.value})}/>
        </label>
      </div>
      <div>
        <div className="text-xs text-[#666] mb-1">Motifs d'annulation</div>
        <input className="dina-input" placeholder="Rupture, Changement d'avis, …" value={(s.cancel_reasons || []).join(", ")} onChange={e => setS({...s, cancel_reasons: e.target.value.split(",").map(x => x.trim()).filter(Boolean)})}/>
      </div>
      <SaveButton loading={saving} onClick={save} testid="ventes-save"/>
    </div>
  );
}

/* -------- Livraison -------- */
function LivraisonTab() {
  const [s, setS] = useState({ score_weights: { on_time: 40, no_cancel: 30, rating: 20, proof: 10 }, proof_threshold: 50000, slots: ["Matin 9h-12h","Après-midi 14h-18h","Soir 18h-21h"] });
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get("/public/site").then(r => setS({...s, ...(r.data?.delivery || {})})).catch(() => {}); /* eslint-disable-next-line */ }, []);
  const save = async () => {
    if (saving) return; setSaving(true);
    const ws = s.week_slots || {};
    const labels = [...new Set(Object.values(ws).filter(d => !d.closed).flatMap(d => (d.slots || []).map(x => `${x.label ? x.label + " " : ""}${x.start}-${x.end}`)))];
    try { await api.patch("/site", { delivery: { ...s, slots: labels.length ? labels : s.slots } }); toast.success(SAVED_MSG); } catch { toast.error(ERROR_MSG); } finally { setSaving(false); }
  };
  const w = s.score_weights || { on_time:40, no_cancel:30, rating:20, proof:10 };
  const total = Object.values(w).reduce((a,b)=>a+b,0);
  return (
    <div className="space-y-4" data-testid="tab-livraison">
      <div className="dina-card-white p-5 flex items-center justify-between">
        <div>
          <div className="font-serif text-xl">Zones & tarifs</div>
          <p className="text-xs text-[#666]">Gérez vos zones de livraison et frais associés.</p>
        </div>
        <Link to="/console/zones" className="dina-btn-secondary !min-h-[36px]">Gérer les zones</Link>
      </div>

      <div className="dina-card-white p-5 space-y-3">
        <div className="font-serif text-xl">Créneaux de livraison</div>
        <p className="text-xs text-[#666]">Pour chaque jour : ouvert ou fermé et un ou plusieurs créneaux (nom facultatif, heure de début et de fin).</p>
        <WeekGrid value={s.week_slots || {}} onChange={(v) => setS({ ...s, week_slots: v })} testid="dslots" slotLabel defaultSlot={{ label: "Matin", start: "09:00", end: "12:00" }}/>
      </div>

      <div className="dina-card-white p-5 space-y-3">
        <div className="font-serif text-xl">Preuve de livraison</div>
        <label className="text-xs text-[#666]">Seuil (FCFA) au-dessus duquel la preuve + PIN gérante sont requis
          <input type="number" className="dina-input" value={s.proof_threshold} onChange={e => setS({...s, proof_threshold: +e.target.value})} data-testid="proof-threshold"/>
        </label>
      </div>

      <div className="dina-card-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-serif text-xl">Score du livreur · pondération</div>
          <span className={`text-xs ${total === 100 ? "text-[#1f8a4c]" : "text-[#c62828]"}`}>Total : {total}%</span>
        </div>
        {["on_time","no_cancel","rating","proof"].map(k => (
          <div key={k} className="flex items-center gap-2">
            <div className="w-32 text-xs text-[#666]">{{on_time:"Ponctualité",no_cancel:"Zéro annulation",rating:"Note cliente",proof:"Preuve livraison"}[k]}</div>
            <input type="range" min={0} max={100} value={w[k]} onChange={e => setS({...s, score_weights: {...w, [k]: +e.target.value}})} className="flex-1" data-testid={`weight-${k}`}/>
            <div className="w-10 text-sm tabular text-right">{w[k]}%</div>
          </div>
        ))}
      </div>

      <SaveButton loading={saving} onClick={save} testid="livraison-save"/>
    </div>
  );
}

/* -------- Paiements -------- */
function PaiementsTab() {
  const [s, setS] = useState({ methods: { cash: true, wave: true, orange: true, mtn: false, moov: false, card: false, cod: true }, wave_business: "", orange_money: "", mtn_money: "" });
  const [extra, setExtra] = useState({ wave_payment_link: "", wave_number: "", wave_name: "", deposit_policy: { mode: "none", value: 0, threshold: 0 }, social: {} });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get("/public/site").then(r => {
      const d = r.data || {};
      setS(prev => ({ ...prev, ...(d.payments || {}) }));
      setExtra({ wave_payment_link: d.wave_payment_link || "", wave_number: d.wave_number || "", wave_name: d.wave_name || "", deposit_policy: d.deposit_policy || { mode: "none", value: 0, threshold: 0 }, social: d.social || {} });
    }).catch(() => {});
  }, []);
  const save = async () => {
    if (busy) return;
    setBusy(true);
    try { await api.patch("/site", { payments: s, wave_payment_link: extra.wave_payment_link, wave_number: extra.wave_number, wave_name: extra.wave_name, deposit_policy: extra.deposit_policy, social: extra.social }); toast.success("Modifications enregistrées · propagées sur la vitrine"); }
    catch { toast.error("Erreur enregistrement"); } finally { setBusy(false); }
  };
  const methods = s.methods || {};
  const pol = extra.deposit_policy || { mode: "none", value: 0, threshold: 0 };
  return (
    <div className="space-y-4" data-testid="tab-paiements">
      <div className="dina-card-white p-5 space-y-2">
        <div className="font-serif text-xl mb-2">Modes de paiement activés</div>
        {[["cash","Espèces"],["wave","Wave"],["orange","Orange Money"],["mtn","MTN Money"],["moov","Moov Money"],["card","Carte bancaire"],["cod","Paiement à la livraison"]].map(([k,l]) => (
          <label key={k} className="flex items-center justify-between py-1 text-sm">
            <span>{l}</span>
            <input type="checkbox" checked={!!methods[k]} onChange={e => setS({...s, methods: {...methods, [k]: e.target.checked}})} data-testid={`pay-${k}`}/>
          </label>
        ))}
      </div>

      <div className="dina-card-white p-5 space-y-3">
        <div className="font-serif text-xl">Lien de paiement Wave</div>
        <div className="text-xs text-[#666]">Ce lien sert à chaque paiement Wave : sur le site, en caisse, dans les commandes et chez le livreur. La cliente tape elle-même le montant.</div>
        <input className="dina-input" placeholder="https://pay.wave.com/m/..." value={extra.wave_payment_link} onChange={e => setExtra({...extra, wave_payment_link: e.target.value})} data-testid="wave-payment-link"/>
        <div className="text-[11px] text-[#5867fd]">💡 Affiché avec le montant exact + référence commande à chaque envoi.</div>
        <div className="grid sm:grid-cols-2 gap-2">
          <input className="dina-input" placeholder="Numéro Wave de la boutique (ex : +225 07 …)" value={extra.wave_number} onChange={e => setExtra({...extra, wave_number: e.target.value})} data-testid="wave-number"/>
          <input className="dina-input" placeholder="Nom affiché sur Wave (facultatif)" value={extra.wave_name} onChange={e => setExtra({...extra, wave_name: e.target.value})} data-testid="wave-name"/>
        </div>
        <div className="text-[11px] text-[#666]">La cliente voit ce numéro, paie, puis envoie sa capture d'écran. La commande n'est marquée payée qu'après votre vérification (Commandes › Paiements Wave à vérifier).</div>
      </div>

      <div className="dina-card-white p-5 space-y-3">
        <div className="font-serif text-xl">Acompte « Paiement à la livraison »</div>
        <div className="text-xs text-[#666]">La cliente paie une partie en Wave avant livraison, le reste en cash au livreur.</div>
        <select className="dina-input" value={pol.mode} onChange={e => setExtra({...extra, deposit_policy: {...pol, mode: e.target.value}})} data-testid="deposit-mode">
          <option value="none">Aucun acompte — tout à la livraison</option>
          <option value="pct">Acompte en pourcentage</option>
          <option value="fixed">Acompte montant fixe</option>
        </select>
        {pol.mode !== "none" && (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-[#666]">{pol.mode === "pct" ? "Pourcentage (%)" : "Montant FCFA"}
              <input type="number" className="dina-input tabular" value={pol.value || 0} onChange={e => setExtra({...extra, deposit_policy: {...pol, value: +e.target.value}})} data-testid="deposit-value"/>
            </label>
            <label className="text-xs text-[#666]">Seuil minimum commande (0 = tous)
              <input type="number" className="dina-input tabular" value={pol.threshold || 0} onChange={e => setExtra({...extra, deposit_policy: {...pol, threshold: +e.target.value}})} data-testid="deposit-threshold"/>
            </label>
          </div>
        )}
      </div>

      <div className="dina-card-white p-5 space-y-3">
        <div className="font-serif text-xl">Réseaux sociaux (footer vitrine)</div>
        <div className="text-xs text-[#666]">💡 Affichés sur le site : pied de page. Icônes officielles, ouvrent dans un nouvel onglet.</div>
        {[["whatsapp","WhatsApp","https://wa.me/message/VCECHRXKVQGTG1"],["tiktok","TikTok","https://www.tiktok.com/@dinoush04"],["facebook","Facebook","https://www.facebook.com/share/..."],["instagram","Instagram","https://www.instagram.com/dinoush_shop"]].map(([k, l, ph]) => (
          <label key={k} className="block">
            <div className="text-xs text-[#666] mb-1">{l}</div>
            <input className="dina-input" placeholder={ph} value={extra.social?.[k] || ""} onChange={e => setExtra({...extra, social: {...extra.social, [k]: e.target.value}})} data-testid={`social-${k}`}/>
          </label>
        ))}
      </div>

      <div className="dina-card-white p-5 space-y-2">
        <div className="font-serif text-xl mb-2">Numéros Mobile Money</div>
        <input className="dina-input" placeholder="Lien Wave Business (ancien)" value={s.wave_business} onChange={e => setS({...s, wave_business: e.target.value})} data-testid="wave-link"/>
        <input className="dina-input" placeholder="Numéro Orange Money" value={s.orange_money} onChange={e => setS({...s, orange_money: e.target.value})}/>
        <input className="dina-input" placeholder="Numéro MTN Money" value={s.mtn_money} onChange={e => setS({...s, mtn_money: e.target.value})}/>
      </div>

      <SaveButton loading={busy} onClick={save} testid="paiements-save"/>
    </div>
  );
}

/* -------- Documents -------- */
function DocumentsTab() {
  const [s, setS] = useState({ receipt_footer: "Merci pour votre achat !", invoice_footer: "RCCM: xxx · NCC: xxx", show_qr: true, show_barcode: false });
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get("/public/site").then(r => setS({...s, ...(r.data?.documents || {})})).catch(() => {}); /* eslint-disable-next-line */ }, []);
  const save = async () => { if (saving) return; setSaving(true); try { await api.patch("/site", { documents: s }); toast.success(SAVED_MSG); } catch { toast.error(ERROR_MSG); } finally { setSaving(false); } };
  return (
    <div className="dina-card-white p-5 space-y-3" data-testid="tab-documents">
      <div className="font-serif text-xl">Documents imprimables</div>
      <label className="text-xs text-[#666]">Mentions pied de reçu
        <textarea className="dina-input" rows={2} value={s.receipt_footer} onChange={e => setS({...s, receipt_footer: e.target.value})} data-testid="receipt-footer"/>
      </label>
      <label className="text-xs text-[#666]">Mentions pied de facture
        <textarea className="dina-input" rows={2} value={s.invoice_footer} onChange={e => setS({...s, invoice_footer: e.target.value})}/>
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.show_qr} onChange={e => setS({...s, show_qr: e.target.checked})}/> Afficher QR de suivi sur fiche colis</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.show_barcode} onChange={e => setS({...s, show_barcode: e.target.checked})}/> Afficher code-barres sur étiquette</label>
      <SaveButton loading={saving} onClick={save} testid="documents-save"/>
    </div>
  );
}

/* -------- Notifications -------- */
function NotificationsTab() {
  const [s, setS] = useState({ wa_order_confirm: true, wa_delivery_code: true, wa_delivery_update: true, wa_abandoned_cart: false, email_daily_summary: false });
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get("/public/site").then(r => setS({...s, ...(r.data?.notifications || {})})).catch(() => {}); /* eslint-disable-next-line */ }, []);
  const save = async () => { if (saving) return; setSaving(true); try { await api.patch("/site", { notifications: s }); toast.success(SAVED_MSG); } catch { toast.error(ERROR_MSG); } finally { setSaving(false); } };
  return (
    <div className="dina-card-white p-5 space-y-2" data-testid="tab-notifications">
      <div className="font-serif text-xl mb-2">Notifications</div>
      {[["wa_order_confirm","WhatsApp — confirmation de commande"],["wa_delivery_code","WhatsApp — code de livraison"],["wa_delivery_update","WhatsApp — mise à jour livraison"],["wa_abandoned_cart","WhatsApp — panier abandonné"],["email_daily_summary","Email — résumé quotidien gérante"]].map(([k,l]) => (
        <label key={k} className="flex items-center justify-between py-1 text-sm">
          <span>{l}</span>
          <input type="checkbox" checked={!!s[k]} onChange={e => setS({...s, [k]: e.target.checked})} data-testid={`notif-${k}`}/>
        </label>
      ))}
      <SaveButton loading={saving} onClick={save} testid="notifications-save" className="mt-2"/>
    </div>
  );
}

/* -------- Intégrations -------- */
function IntegrationsTab() {
  return (
    <div className="space-y-3" data-testid="tab-integrations">
      <div className="dina-card-white p-5">
        <div className="font-serif text-xl mb-2">Intégrations tierces</div>
        <p className="text-sm text-[#666]">WhatsApp Business, réseaux sociaux, imprimante — gérés depuis la page dédiée.</p>
        <Link to="/console/integrations" className="dina-btn-primary inline-flex mt-3">Ouvrir Intégrations</Link>
      </div>
    </div>
  );
}

/* -------- Équipe -------- */
function EquipeTab() {
  return (
    <div className="dina-card-white p-5" data-testid="tab-equipe">
      <div className="font-serif text-xl mb-2">Équipe & horaires</div>
      <p className="text-sm text-[#666]">Gérez vos employés, rôles et pointage dans leurs pages dédiées.</p>
      <div className="flex gap-2 mt-3">
        <Link to="/console/equipe" className="dina-btn-primary">Employés</Link>
        <Link to="/console/roles" className="dina-btn-secondary">Rôles & permissions</Link>
        <Link to="/console/pointage" className="dina-btn-secondary">Pointage</Link>
      </div>
    </div>
  );
}

/* -------- Pointage (nouveau) -------- */
const ROLE_OPTS = [
  { key: "manager", label: "Gérante" },
  { key: "sales", label: "Vendeuse" },
  { key: "stock_keeper", label: "Stock" },
  { key: "community_manager", label: "Community Manager" },
  { key: "rider", label: "Livreur" },
];

function PointageTab() {
  const hc = useHoursConfig();
  const roleList = hc.roles.length ? hc.roles : ROLE_OPTS;
  const roleLabel = (k) => (roleList.find(r => r.key === k) || {}).label || k;
  const [cfg, setCfg] = useState({ enabled: true, enabled_roles: ROLE_OPTS.map(r => r.key) });
  const [hours, setHours] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/business").then(r => {
      const b = r.data || {};
      setCfg({ enabled: b.attendance_config?.enabled ?? true, enabled_roles: b.attendance_config?.enabled_roles || ROLE_OPTS.map(x => x.key) });
      setHours(b.working_hours || {});
    }).catch(() => {});
  }, []);

  const toggleRole = (key) => {
    setCfg(c => ({
      ...c,
      enabled_roles: c.enabled_roles.includes(key)
        ? c.enabled_roles.filter(x => x !== key)
        : [...c.enabled_roles, key],
    }));
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await Promise.all([
        api.patch("/business/attendance-config", cfg),
        api.patch("/business/working-hours", { working_hours: hours }),
      ]);
      // Notify ConsoleLayout + RiderShell to refetch config
      window.dispatchEvent(new Event("attendance-config-changed"));
      toast.success(SAVED_MSG);
    } catch { toast.error(ERROR_MSG); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4" data-testid="tab-pointage">
      <div className="dina-card-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-serif text-xl">Activation du pointage</div>
            <p className="text-xs text-[#666] mt-1">Si désactivé, le bouton « Pointer » disparaît pour tout le monde.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={cfg.enabled} onChange={e => setCfg({ ...cfg, enabled: e.target.checked })} className="sr-only peer" data-testid="attendance-enabled"/>
            <div className="w-11 h-6 bg-[#ddd] rounded-full peer peer-checked:bg-[#1f8a4c] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition peer-checked:after:translate-x-5"/>
          </label>
        </div>
      </div>

      <div className="dina-card-white p-5 space-y-3">
        <div className="font-serif text-xl">Qui peut pointer et horaires de travail</div>
        <p className="text-xs text-[#666]">Activez les rôles autorisés et définissez leurs horaires, jours travaillés et tolérance de retard. Les rôles créés plus tard apparaissent ici automatiquement.</p>

        <div className="space-y-2 mt-3">
          {roleList.map(r => {
            const on = cfg.enabled_roles.includes(r.key);
            const h = hours[r.key] || { open: "08:00", close: "19:00", tolerance_min: 10 };
            return (
              <div key={r.key} className={`border rounded-xl p-3 ${on ? "border-[#1f8a4c]/40 bg-[#f0f9f4]/30 dark:bg-[#1a2a1f]/30" : "border-[#ececec] dark:border-[#2a2a2a] opacity-60"}`} data-testid={`role-row-${r.key}`}>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={on} onChange={() => toggleRole(r.key)} className="accent-[#1f8a4c] w-4 h-4" data-testid={`role-toggle-${r.key}`}/>
                    <span className="font-semibold text-sm">{r.label}</span>
                  </label>
                  {on && <span className="text-[10px] text-[#1f8a4c] uppercase font-semibold">Autorisé</span>}
                </div>
                {on && <HoursFields h={h} set={(p) => setHours(x => ({ ...x, [r.key]: { ...(x[r.key] || {}), ...h, ...p } }))} testid={`role-${r.key}`}/>}
              </div>
            );
          })}
        </div>
      </div>

      <SaveButton loading={saving} onClick={save} testid="pointage-save">Enregistrer la configuration</SaveButton>
      <EmployeeHours employees={hc.employees} roleHours={hours} roleLabel={roleLabel} onSaved={hc.reload}/>
    </div>
  );
}

/* -------- App Livreur (CMS complet) -------- */
const RIDER_ICONS = [
  "Package", "Map", "History", "Trophy", "User", "HelpCircle",
  "Phone", "MessageCircle", "Info", "ExternalLink", "Megaphone",
  "Star", "Heart", "Home", "SettingsIcon",
];
const DEFAULT_RIDER_TABS = [
  { key: "courses",     to: "/riders",             icon: "Package", label: "Courses",     visible: true, builtin: true },
  { key: "carte",       to: "/riders/carte",       icon: "Map",     label: "Carte",       visible: true, builtin: true },
  { key: "historique",  to: "/riders/historique",  icon: "History", label: "Historique",  visible: true, builtin: true },
  { key: "performance", to: "/riders/performance", icon: "Trophy",  label: "Performance", visible: true, builtin: true },
  { key: "profil",      to: "/riders/profil",      icon: "User",    label: "Profil",      visible: true, builtin: true },
];
const DEFAULT_RIDER_CMS = {
  logo: "",
  primary_color: "#b02a2a",
  accent_color: "#fff5f5",
  greeting: "Bonjour {name}",
  subtitle: "{brand} · Livreur",
  announcement: { enabled: false, text: "", variant: "info" },
  help: { enabled: true, title: "Besoin d'aide ?", content: "Appelez votre gérante · +225 07 77 92 61 79" },
  tabs: DEFAULT_RIDER_TABS,
};

function RiderAppTab() {
  const [cms, setCms] = useState(DEFAULT_RIDER_CMS);
  const [saving, setSaving] = useState(false);
  const logoRef = useRef(null);

  useEffect(() => {
    api.get("/rider-cms").then(r => {
      const d = r.data || {};
      setCms({
        ...DEFAULT_RIDER_CMS,
        ...d,
        announcement: { ...DEFAULT_RIDER_CMS.announcement, ...(d.announcement || {}) },
        help: { ...DEFAULT_RIDER_CMS.help, ...(d.help || {}) },
        tabs: (d.tabs && d.tabs.length) ? d.tabs : DEFAULT_RIDER_TABS,
      });
    }).catch(() => {});
  }, []);

  const upd = (k, v) => setCms(c => ({ ...c, [k]: v }));
  const updAnn = (k, v) => setCms(c => ({ ...c, announcement: { ...c.announcement, [k]: v } }));
  const updHelp = (k, v) => setCms(c => ({ ...c, help: { ...c.help, [k]: v } }));

  const uploadLogo = (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Max 2 Mo");
    const r = new FileReader();
    r.onload = () => upd("logo", r.result);
    r.readAsDataURL(file);
  };

  const moveTab = (idx, delta) => {
    const next = [...cms.tabs];
    const j = idx + delta;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    upd("tabs", next);
  };
  const toggleTab = (idx) => {
    const next = cms.tabs.map((t, i) => i === idx ? { ...t, visible: !t.visible } : t);
    upd("tabs", next);
  };
  const renameTab = (idx, label) => {
    const next = cms.tabs.map((t, i) => i === idx ? { ...t, label } : t);
    upd("tabs", next);
  };
  const changeTabIcon = (idx, icon) => {
    const next = cms.tabs.map((t, i) => i === idx ? { ...t, icon } : t);
    upd("tabs", next);
  };
  const changeTabTo = (idx, to) => {
    const next = cms.tabs.map((t, i) => i === idx ? { ...t, to } : t);
    upd("tabs", next);
  };
  const removeTab = (idx) => {
    if (cms.tabs[idx]?.builtin) return toast.error("Onglet intégré · masquer plutôt que supprimer");
    const next = cms.tabs.filter((_, i) => i !== idx);
    upd("tabs", next);
  };
  const addCustomTab = () => {
    const n = cms.tabs.length + 1;
    const next = [...cms.tabs, {
      key: `custom-${Date.now()}`, label: `Onglet ${n}`, icon: "Info",
      to: "https://", visible: true, builtin: false,
    }];
    upd("tabs", next);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await api.patch("/rider-cms", cms);
      window.dispatchEvent(new Event("rider-cms-changed"));
      toast.success("App Livreur mise à jour · déployée en temps réel");
    } catch { toast.error(ERROR_MSG); } finally { setSaving(false); }
  };

  const reset = async () => {
    if (!window.confirm("Réinitialiser l'App Livreur aux valeurs par défaut ?")) return;
    try {
      await api.post("/rider-cms/reset");
      setCms(DEFAULT_RIDER_CMS);
      window.dispatchEvent(new Event("rider-cms-changed"));
      toast.success("App Livreur réinitialisée");
    } catch { toast.error("Réservé Super admin"); }
  };

  return (
    <div className="space-y-4" data-testid="tab-rider-app">
      {/* Logo + couleurs */}
      <div className="dina-card-white p-5 space-y-3">
        <div className="font-serif text-xl">Identité visuelle</div>
        <p className="text-xs text-[#666]">Logo, couleur primaire et couleur de fond affichés dans l'app des livreurs.</p>
        <div className="flex items-center gap-4">
          {cms.logo ? <img src={cms.logo} alt="Logo rider" className="h-16 w-16 object-cover border rounded-lg bg-white" data-testid="rider-logo-preview"/> : <div className="h-16 w-16 rounded-lg bg-[#fff5f5] grid place-items-center text-[#b02a2a] font-serif text-xl font-bold">LV</div>}
          <label className="dina-btn-secondary cursor-pointer !min-h-[36px]" data-testid="rider-logo-upload-btn">
            <Upload size={14}/> Téléverser
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => uploadLogo(e.target.files[0])}/>
          </label>
          {cms.logo && <button onClick={() => upd("logo", "")} className="text-[#c62828] text-xs" data-testid="rider-logo-clear">Retirer</button>}
          <div className="text-[11px] text-[#999] ml-auto">Sans image ici, le logo de la boutique est utilisé</div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <label className="text-xs text-[#666]">Couleur primaire
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

      {/* Textes d'accueil */}
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

      {/* Annonce */}
      <div className="dina-card-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-serif text-xl">Annonce (bannière)</div>
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
          </>
        )}
      </div>

      {/* Aide */}
      <div className="dina-card-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-serif text-xl">Aide intégrée</div>
            <p className="text-xs text-[#666]">Modal affichée quand le livreur clique sur « Aide ».</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={cms.help.enabled} onChange={e => updHelp("enabled", e.target.checked)} className="sr-only peer" data-testid="rider-help-enabled"/>
            <div className="w-11 h-6 bg-[#ddd] rounded-full peer peer-checked:bg-[#1f8a4c] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition peer-checked:after:translate-x-5"/>
          </label>
        </div>
        {cms.help.enabled && (
          <>
            <input className="dina-input" value={cms.help.title} onChange={e => updHelp("title", e.target.value)} placeholder="Titre" data-testid="rider-help-title"/>
            <textarea className="dina-input" rows={4} value={cms.help.content} onChange={e => updHelp("content", e.target.value)} placeholder="Contenu de l'aide…" data-testid="rider-help-content"/>
          </>
        )}
      </div>

      {/* Onglets */}
      <div className="dina-card-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-serif text-xl">Onglets de la barre basse</div>
            <p className="text-xs text-[#666]">Réorganiser, renommer, masquer ou ajouter des onglets personnalisés (lien externe autorisé).</p>
          </div>
          <button onClick={addCustomTab} className="dina-btn-secondary !min-h-[32px] text-xs" data-testid="rider-tab-add"><Plus size={12}/> Ajouter</button>
        </div>
        <div className="space-y-2">
          {cms.tabs.map((t, idx) => (
            <div key={t.key || idx} className="border rounded-xl p-3 flex items-start gap-2" data-testid={`rider-tab-row-${idx}`}>
              <div className="flex flex-col items-center gap-1 pt-1 text-[#999]">
                <button onClick={() => moveTab(idx, -1)} className="text-xs hover:text-[#b02a2a]" title="Monter" data-testid={`rider-tab-up-${idx}`}>▲</button>
                <GripVertical size={12}/>
                <button onClick={() => moveTab(idx, 1)} className="text-xs hover:text-[#b02a2a]" title="Descendre" data-testid={`rider-tab-down-${idx}`}>▼</button>
              </div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr] gap-2">
                <label className="text-[10px] text-[#666]">Libellé
                  <input className="dina-input" value={t.label || ""} onChange={e => renameTab(idx, e.target.value)} data-testid={`rider-tab-label-${idx}`}/>
                </label>
                <label className="text-[10px] text-[#666]">Icône
                  <select className="dina-input" value={t.icon || "Info"} onChange={e => changeTabIcon(idx, e.target.value)} data-testid={`rider-tab-icon-${idx}`}>
                    {RIDER_ICONS.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </label>
                <label className="text-[10px] text-[#666]">
                  {t.builtin ? "Route (lecture seule)" : "Lien (URL ou /chemin)"}
                  <input className="dina-input" value={t.to || ""} onChange={e => changeTabTo(idx, e.target.value)} disabled={t.builtin} data-testid={`rider-tab-to-${idx}`}/>
                </label>
              </div>
              <div className="flex flex-col items-end gap-1 pt-1">
                <label className="flex items-center gap-1 text-[10px] text-[#666]">
                  <input type="checkbox" checked={t.visible !== false} onChange={() => toggleTab(idx)} data-testid={`rider-tab-visible-${idx}`}/>
                  Visible
                </label>
                {!t.builtin && (
                  <button onClick={() => removeTab(idx)} className="text-[#c62828] text-xs flex items-center gap-1" title="Supprimer" data-testid={`rider-tab-remove-${idx}`}><X size={12}/></button>
                )}
                {t.builtin && <span className="text-[9px] text-[#999]">intégré</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <SaveButton loading={saving} onClick={save} testid="rider-cms-save">Enregistrer l'App Livreur</SaveButton>
        <button onClick={reset} className="dina-btn-secondary !min-h-[36px] text-xs" data-testid="rider-cms-reset"><RotateCcw size={12}/> Réinitialiser</button>
      </div>
    </div>
  );
}

/* -------- Sécurité -------- */
function SecuriteTab() {
  const [s, setS] = useState({ require_pin_discounts: true, require_pin_refunds: true, session_timeout_min: 30, two_factor: false });
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get("/public/site").then(r => setS({...s, ...(r.data?.security || {})})).catch(() => {}); /* eslint-disable-next-line */ }, []);
  const save = async () => { if (saving) return; setSaving(true); try { await api.patch("/site", { security: s }); toast.success(SAVED_MSG); } catch { toast.error(ERROR_MSG); } finally { setSaving(false); } };
  return (
    <div className="dina-card-white p-5 space-y-2" data-testid="tab-securite">
      <div className="font-serif text-xl">Sécurité</div>
      <label className="flex items-center justify-between text-sm py-1"><span>PIN gérante requis pour remises</span><input type="checkbox" checked={s.require_pin_discounts} onChange={e => setS({...s, require_pin_discounts: e.target.checked})} data-testid="sec-pin-discounts"/></label>
      <label className="flex items-center justify-between text-sm py-1"><span>PIN gérante requis pour remboursements</span><input type="checkbox" checked={s.require_pin_refunds} onChange={e => setS({...s, require_pin_refunds: e.target.checked})}/></label>
      <label className="text-xs text-[#666] block">Déconnexion auto (minutes)
        <input type="number" className="dina-input" value={s.session_timeout_min} onChange={e => setS({...s, session_timeout_min: +e.target.value})}/>
      </label>
      <label className="flex items-center justify-between text-sm py-1"><span>Double authentification admin</span><input type="checkbox" checked={s.two_factor} onChange={e => setS({...s, two_factor: e.target.checked})}/></label>
      <SaveButton loading={saving} onClick={save} testid="securite-save" className="mt-2"/>
    </div>
  );
}

/* -------- Données -------- */
function SyncCard() {
  const [token, setToken] = useState(null);
  const [src, setSrc] = useState("");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const me = process.env.REACT_APP_BACKEND_URL;
  const gen = async () => {
    try { const r = await api.post("/admin/sync/export-token"); setToken(r.data); }
    catch (e) { toast.error(e.response?.data?.detail || "Réservé Super admin"); }
  };
  const copy = (t) => navigator.clipboard?.writeText(t).then(() => toast.success("Copié"));
  const run = async () => {
    if (!window.confirm("Remplacer TOUTES les données de ce site (produits, réglages, comptes, commandes…) par celles de la source ? Action irréversible.")) return;
    setBusy(true); setResult(null);
    try {
      const r = await api.post("/admin/sync/import", { source_url: src, token: code, pin });
      setResult(r.data); toast.success("Synchronisation terminée · reconnexion…");
      setTimeout(() => { localStorage.removeItem("dina_token"); window.location.href = "/console/connexion"; }, 3000);
    } catch (e) { toast.error(e.response?.data?.detail || "Erreur de synchronisation"); }
    finally { setBusy(false); }
  };
  return (
    <div className="dina-card-white p-5 space-y-3" data-testid="sync-card">
      <div className="font-serif text-xl">Synchroniser avec une autre version</div>
      <p className="text-sm text-[#666]">Copiez toute la base (catalogue, réglages, comptes, manuel…) d'une version vers une autre, par exemple de la prévisualisation vers le site en ligne.</p>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-[#fafafa] dark:bg-[#141414] space-y-2">
          <div className="text-xs uppercase font-semibold text-[#666]">1 · Sur la source : générer un code</div>
          <button onClick={gen} className="dina-btn-secondary !min-h-[34px] text-xs" data-testid="sync-gen-token">Générer un code d'export (2 h)</button>
          {token && <div className="text-xs space-y-1" data-testid="sync-token-box">
            <div>Adresse source : <button onClick={() => copy(me)} className="font-mono underline break-all">{me}</button></div>
            <div>Code : <button onClick={() => copy(token.token)} className="font-mono underline break-all" data-testid="sync-token">{token.token}</button></div>
          </div>}
        </div>
        <div className="p-3 rounded-lg bg-[#fff5f5] dark:bg-[#2a1818] space-y-2">
          <div className="text-xs uppercase font-semibold text-[#c62828]">2 · Sur la destination : importer</div>
          <input className="dina-input !min-h-[34px] text-xs" placeholder="Adresse source (https://…)" value={src} onChange={e => setSrc(e.target.value)} data-testid="sync-src"/>
          <input className="dina-input !min-h-[34px] text-xs font-mono" placeholder="Code d'export" value={code} onChange={e => setCode(e.target.value)} data-testid="sync-code"/>
          <input type="password" inputMode="numeric" className="dina-input !min-h-[34px] text-xs" placeholder="Votre PIN admin" value={pin} onChange={e => setPin(e.target.value)} data-testid="sync-pin"/>
          <button onClick={run} disabled={busy || !src || !code || !pin} className="dina-btn-danger !min-h-[34px] text-xs" data-testid="sync-import">{busy ? "Synchronisation…" : "Remplacer les données de ce site"}</button>
          {result && <div className="text-xs text-[#1f8a4c]" data-testid="sync-result">{result.collections} collections copiées · {result.counts?.products} produits. Déconnectez-vous puis reconnectez-vous.</div>}
        </div>
      </div>
    </div>
  );
}

function DonneesTab() {
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeInput, setWipeInput] = useState("");
  const [wiping, setWiping] = useState(false);
  const [wipeResult, setWipeResult] = useState(null);

  const exportAll = async () => {
    try {
      const r = await api.get("/export/all");
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" });
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = u; a.download = `chez-dina-export-${new Date().toISOString().slice(0,10)}.json`; a.click();
      URL.revokeObjectURL(u);
      toast.success("Export téléchargé");
    } catch { toast.error("Export indisponible — contactez le support"); }
  };
  const seedDemo = async () => {
    try { await api.post("/admin/seed-demo"); toast.success("Démo ajoutée"); setTimeout(() => window.location.reload(), 1500); }
    catch { toast.error("Réservé Super admin"); }
  };
  const deleteDemo = async () => {
    if (!window.confirm("Supprimer définitivement toutes les données de démonstration ?")) return;
    try { await api.delete("/admin/demo-data"); toast.success("Supprimé"); setTimeout(() => window.location.reload(), 1500); }
    catch { toast.error("Réservé Super admin"); }
  };
  const wipeForProd = async () => {
    if (wipeInput !== "VIDER" || wiping) return;
    setWiping(true);
    try {
      const r = await api.post("/admin/wipe-for-production", { confirm: "VIDER" });
      setWipeResult(r.data);
      toast.success("Base nettoyée · prête pour la production");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Réservé Super admin");
    } finally { setWiping(false); }
  };

  return (
    <div className="space-y-3" data-testid="tab-donnees">
      <div className="dina-card-white p-5 space-y-2">
        <div className="font-serif text-xl">Export</div>
        <p className="text-sm text-[#666]">Téléchargez une copie de toutes vos données (produits, clientes, commandes, dépenses…).</p>
        <button onClick={exportAll} className="dina-btn-primary" data-testid="export-all"><Database size={14}/> Exporter mes données</button>
      </div>

      <SyncCard/>

      <div className="dina-card-white p-5 space-y-2">
        <div className="font-serif text-xl">Données de démonstration</div>
        <p className="text-sm text-[#666]">Ajouter ou retirer un jeu de démonstration (tag DEMO_PACK1).</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={seedDemo} className="dina-btn-secondary !min-h-[36px]" data-testid="seed-demo-button">Ajouter démo</button>
          <button onClick={deleteDemo} className="dina-btn-danger !min-h-[36px]" data-testid="delete-demo-button"><Trash2 size={14}/> Supprimer démo</button>
        </div>
      </div>

      <div className="dina-card-white p-5 space-y-2 border-2 border-[#c62828]/30">
        <div className="font-serif text-xl text-[#c62828] flex items-center gap-2"><Shield size={18}/>Préparer pour la production</div>
        <p className="text-sm text-[#666]">Efface en un clic <strong>toutes les ventes et données d'essai</strong> (produits, commandes, clientes, livraisons, promotions, messages…).<br/>Restent en place : <strong>les comptes de l'équipe, les réglages de la boutique et du site, les boutiques et les zones</strong>.</p>
        <div className="text-xs text-[#c62828] bg-[#fff5f5] p-2 rounded">⚠ Action irréversible · à n'exécuter qu'avant le lancement officiel.</div>
        <button onClick={() => { setWipeOpen(true); setWipeInput(""); setWipeResult(null); }} className="dina-btn-danger !min-h-[36px]" data-testid="wipe-for-prod-button"><Trash2 size={14}/> Vider la base avant mise en prod</button>
      </div>

      {wipeOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4" onClick={() => !wiping && setWipeOpen(false)}>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()} data-testid="wipe-modal">
            {!wipeResult ? (
              <>
                <div className="font-serif text-xl mb-2 flex items-center gap-2 text-[#c62828]"><Shield size={20}/>Confirmer la mise en production</div>
                <p className="text-sm text-[#666] mb-3">Cette action supprime toutes les commandes, clientes, produits, livraisons, promotions, messages et événements. Elle ne peut pas être annulée.</p>
                <div className="text-xs mb-1 text-[#1c1c1c] dark:text-[#f0f0f0]">Tapez <code className="bg-[#fff5f5] text-[#b02a2a] px-2 py-0.5 rounded font-bold">VIDER</code> pour confirmer :</div>
                <input autoFocus className="dina-input mb-3" value={wipeInput} onChange={e => setWipeInput(e.target.value)} data-testid="wipe-confirm-input"/>
                <div className="flex gap-2">
                  <button onClick={() => setWipeOpen(false)} disabled={wiping} className="dina-btn-secondary flex-1" data-testid="wipe-cancel">Annuler</button>
                  <button onClick={wipeForProd} disabled={wipeInput !== "VIDER" || wiping} className="dina-btn-danger flex-1" data-testid="wipe-confirm">
                    {wiping ? "Nettoyage…" : "Confirmer"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="font-serif text-xl mb-2 flex items-center gap-2 text-[#1f8a4c]">✓ Base nettoyée</div>
                <p className="text-sm text-[#666] mb-3">Votre installation est prête pour le lancement. Résumé des collections vidées :</p>
                <div className="max-h-56 overflow-y-auto scrollbar-thin text-xs bg-[#fafafa] dark:bg-[#141414] rounded p-3 mb-3 font-mono">
                  {Object.entries(wipeResult.wiped || {}).filter(([,n]) => n > 0).map(([k,n]) => <div key={k} className="flex justify-between"><span>{k}</span><span className="tabular text-[#c62828]">-{n}</span></div>)}
                  {Object.values(wipeResult.wiped || {}).every(n => n === 0) && <div className="text-[#666]">Rien à vider · base déjà propre.</div>}
                </div>
                <div className="text-xs text-[#666] mb-3">Conservés : {(wipeResult.kept || []).join(", ")}</div>
                <button onClick={() => { setWipeOpen(false); window.location.reload(); }} className="dina-btn-primary w-full" data-testid="wipe-done">Recharger la console</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
