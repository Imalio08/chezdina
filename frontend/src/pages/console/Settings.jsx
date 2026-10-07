import React, { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  Save, Upload, Store, Phone, ShoppingCart, Truck, CreditCard, FileText,
  Bell, Plug, Users, Shield, Database, Trash2, Image as ImageIcon,
} from "lucide-react";
import SaveButton from "@/components/shared/SaveButton";

const SAVED_MSG = "Modifications enregistrées";
const ERROR_MSG = "Erreur · modifications non enregistrées";

const TABS = [
  { id: "identite", label: "Identité", icon: Store },
  { id: "coordonnees", label: "Coordonnées", icon: Phone },
  { id: "ventes", label: "Ventes & caisse", icon: ShoppingCart },
  { id: "livraison", label: "Livraison", icon: Truck },
  { id: "paiements", label: "Paiements", icon: CreditCard },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "integrations", label: "Intégrations", icon: Plug },
  { id: "equipe", label: "Équipe & horaires", icon: Users },
  { id: "securite", label: "Sécurité", icon: Shield },
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
          {tab === "notifications" && <NotificationsTab />}
          {tab === "integrations" && <IntegrationsTab />}
          {tab === "equipe" && <EquipeTab />}
          {tab === "securite" && <SecuriteTab />}
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
      toast.success("Identité enregistrée · logo propagé partout");
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
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get("/business").then(r => setB(r.data || {})).catch(() => {}); }, []);
  const save = async () => { if (saving) return; setSaving(true); try { await api.patch("/business", b); toast.success(SAVED_MSG); } catch { toast.error(ERROR_MSG); } finally { setSaving(false); } };
  const upd = (k, v) => setB({...b, [k]: v});
  return (
    <div className="dina-card-white p-5 space-y-3" data-testid="tab-coordonnees">
      <div className="font-serif text-xl">Coordonnées</div>
      <textarea className="dina-input" rows={2} placeholder="Adresse complète" value={b.address || ""} onChange={e => upd("address", e.target.value)} data-testid="biz-address"/>
      <div className="grid grid-cols-2 gap-2">
        <input className="dina-input" placeholder="Téléphone" value={b.phone || ""} onChange={e => upd("phone", e.target.value)} data-testid="biz-phone"/>
        <input className="dina-input" placeholder="WhatsApp" value={b.whatsapp || ""} onChange={e => upd("whatsapp", e.target.value)}/>
        <input className="dina-input" placeholder="Email" value={b.email || ""} onChange={e => upd("email", e.target.value)}/>
        <input className="dina-input" placeholder="Horaires (ex: Lun-Sam 9h-19h)" value={b.hours || ""} onChange={e => upd("hours", e.target.value)}/>
        <input className="dina-input" placeholder="RCCM" value={b.rccm || ""} onChange={e => upd("rccm", e.target.value)}/>
        <input className="dina-input" placeholder="NCC" value={b.ncc || ""} onChange={e => upd("ncc", e.target.value)}/>
      </div>
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
  const save = async () => { if (saving) return; setSaving(true); try { await api.patch("/site", { delivery: s }); toast.success(SAVED_MSG); } catch { toast.error(ERROR_MSG); } finally { setSaving(false); } };
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
        <input className="dina-input" value={(s.slots || []).join(", ")} onChange={e => setS({...s, slots: e.target.value.split(",").map(x => x.trim()).filter(Boolean)})} data-testid="livraison-slots"/>
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
  const [extra, setExtra] = useState({ wave_payment_link: "", deposit_policy: { mode: "none", value: 0, threshold: 0 }, social: {} });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get("/public/site").then(r => {
      const d = r.data || {};
      setS(prev => ({ ...prev, ...(d.payments || {}) }));
      setExtra({ wave_payment_link: d.wave_payment_link || "", deposit_policy: d.deposit_policy || { mode: "none", value: 0, threshold: 0 }, social: d.social || {} });
    }).catch(() => {});
  }, []);
  const save = async () => {
    if (busy) return;
    setBusy(true);
    try { await api.patch("/site", { payments: s, wave_payment_link: extra.wave_payment_link, deposit_policy: extra.deposit_policy, social: extra.social }); toast.success("Modifications enregistrées · propagées sur la vitrine"); }
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
        <div className="text-xs text-[#666]">Utilisé partout où un paiement Wave est demandé (checkout, POS, orders, rider app). Le montant n'est pas inclus — la cliente le tape elle-même.</div>
        <input className="dina-input" placeholder="https://pay.wave.com/m/..." value={extra.wave_payment_link} onChange={e => setExtra({...extra, wave_payment_link: e.target.value})} data-testid="wave-payment-link"/>
        <div className="text-[11px] text-[#5867fd]">💡 Affiché avec le montant exact + référence commande à chaque envoi.</div>
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
        <p className="text-sm text-[#666]">Téléchargez toutes vos données au format JSON (produits, clientes, commandes, dépenses, etc.).</p>
        <button onClick={exportAll} className="dina-btn-primary" data-testid="export-all"><Database size={14}/> Exporter mes données</button>
      </div>

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
        <p className="text-sm text-[#666]">Vide <strong>toutes les données transactionnelles et démo</strong> (produits, commandes, clientes, livraisons, promotions, messages, événements, etc.) en 1 clic.<br/>Garde : <strong>comptes staff, business, paramètres vitrine, boutiques, zones</strong>.</p>
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
