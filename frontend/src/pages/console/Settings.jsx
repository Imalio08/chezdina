import React, { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  Save, Upload, Store, Phone, ShoppingCart, Truck, CreditCard, FileText,
  Bell, Plug, Users, Shield, Database, Trash2, Image as ImageIcon,
} from "lucide-react";

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

  const save = async () => {
    try {
      await api.patch("/business", b);
      await api.patch("/site", { logo: site.logo, favicon: site.favicon });
      toast.success("Identité enregistrée · logo propagé partout");
    } catch { toast.error("Erreur"); }
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

      <button onClick={save} className="dina-btn-primary" data-testid="identite-save"><Save size={14}/> Enregistrer l'identité</button>
    </div>
  );
}

/* -------- Coordonnées -------- */
function CoordonneesTab() {
  const [b, setB] = useState({});
  useEffect(() => { api.get("/business").then(r => setB(r.data || {})).catch(() => {}); }, []);
  const save = async () => { try { await api.patch("/business", b); toast.success("Enregistré"); } catch { toast.error("Erreur"); } };
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
      <button onClick={save} className="dina-btn-primary" data-testid="coordonnees-save"><Save size={14}/> Enregistrer</button>
    </div>
  );
}

/* -------- Ventes & caisse -------- */
function VentesTab() {
  const [s, setS] = useState({ discount_max: 20, out_of_stock_rule: "block", exchange_policy: "48h non portés", float_default: 10000, cancel_reasons: ["Rupture","Changement d'avis","Prix élevé"] });
  useEffect(() => { api.get("/public/site").then(r => setS({...s, ...(r.data?.sales || {})})).catch(() => {}); /* eslint-disable-next-line */ }, []);
  const save = async () => { try { await api.patch("/site", { sales: s }); toast.success("Enregistré"); } catch { toast.error("Erreur"); } };
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
      <button onClick={save} className="dina-btn-primary" data-testid="ventes-save"><Save size={14}/> Enregistrer</button>
    </div>
  );
}

/* -------- Livraison -------- */
function LivraisonTab() {
  const [s, setS] = useState({ score_weights: { on_time: 40, no_cancel: 30, rating: 20, proof: 10 }, proof_threshold: 50000, slots: ["Matin 9h-12h","Après-midi 14h-18h","Soir 18h-21h"] });
  useEffect(() => { api.get("/public/site").then(r => setS({...s, ...(r.data?.delivery || {})})).catch(() => {}); /* eslint-disable-next-line */ }, []);
  const save = async () => { try { await api.patch("/site", { delivery: s }); toast.success("Enregistré"); } catch { toast.error("Erreur"); } };
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

      <button onClick={save} className="dina-btn-primary" data-testid="livraison-save"><Save size={14}/> Enregistrer</button>
    </div>
  );
}

/* -------- Paiements -------- */
function PaiementsTab() {
  const [s, setS] = useState({ methods: { cash: true, wave: true, orange: true, mtn: false, moov: false, card: false, cod: true }, wave_business: "", orange_money: "", mtn_money: "" });
  useEffect(() => { api.get("/public/site").then(r => setS({...s, ...(r.data?.payments || {})})).catch(() => {}); /* eslint-disable-next-line */ }, []);
  const save = async () => { try { await api.patch("/site", { payments: s }); toast.success("Enregistré"); } catch { toast.error("Erreur"); } };
  const methods = s.methods || {};
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
      <div className="dina-card-white p-5 space-y-2">
        <div className="font-serif text-xl mb-2">Numéros & liens Mobile Money</div>
        <input className="dina-input" placeholder="Lien Wave Business" value={s.wave_business} onChange={e => setS({...s, wave_business: e.target.value})} data-testid="wave-link"/>
        <input className="dina-input" placeholder="Numéro Orange Money" value={s.orange_money} onChange={e => setS({...s, orange_money: e.target.value})}/>
        <input className="dina-input" placeholder="Numéro MTN Money" value={s.mtn_money} onChange={e => setS({...s, mtn_money: e.target.value})}/>
      </div>
      <button onClick={save} className="dina-btn-primary" data-testid="paiements-save"><Save size={14}/> Enregistrer</button>
    </div>
  );
}

/* -------- Documents -------- */
function DocumentsTab() {
  const [s, setS] = useState({ receipt_footer: "Merci pour votre achat !", invoice_footer: "RCCM: xxx · NCC: xxx", show_qr: true, show_barcode: false });
  useEffect(() => { api.get("/public/site").then(r => setS({...s, ...(r.data?.documents || {})})).catch(() => {}); /* eslint-disable-next-line */ }, []);
  const save = async () => { try { await api.patch("/site", { documents: s }); toast.success("Enregistré"); } catch { toast.error("Erreur"); } };
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
      <button onClick={save} className="dina-btn-primary" data-testid="documents-save"><Save size={14}/> Enregistrer</button>
    </div>
  );
}

/* -------- Notifications -------- */
function NotificationsTab() {
  const [s, setS] = useState({ wa_order_confirm: true, wa_delivery_code: true, wa_delivery_update: true, wa_abandoned_cart: false, email_daily_summary: false });
  useEffect(() => { api.get("/public/site").then(r => setS({...s, ...(r.data?.notifications || {})})).catch(() => {}); /* eslint-disable-next-line */ }, []);
  const save = async () => { try { await api.patch("/site", { notifications: s }); toast.success("Enregistré"); } catch { toast.error("Erreur"); } };
  return (
    <div className="dina-card-white p-5 space-y-2" data-testid="tab-notifications">
      <div className="font-serif text-xl mb-2">Notifications</div>
      {[["wa_order_confirm","WhatsApp — confirmation de commande"],["wa_delivery_code","WhatsApp — code de livraison"],["wa_delivery_update","WhatsApp — mise à jour livraison"],["wa_abandoned_cart","WhatsApp — panier abandonné"],["email_daily_summary","Email — résumé quotidien gérante"]].map(([k,l]) => (
        <label key={k} className="flex items-center justify-between py-1 text-sm">
          <span>{l}</span>
          <input type="checkbox" checked={!!s[k]} onChange={e => setS({...s, [k]: e.target.checked})} data-testid={`notif-${k}`}/>
        </label>
      ))}
      <button onClick={save} className="dina-btn-primary mt-2" data-testid="notifications-save"><Save size={14}/> Enregistrer</button>
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
  useEffect(() => { api.get("/public/site").then(r => setS({...s, ...(r.data?.security || {})})).catch(() => {}); /* eslint-disable-next-line */ }, []);
  const save = async () => { try { await api.patch("/site", { security: s }); toast.success("Enregistré"); } catch { toast.error("Erreur"); } };
  return (
    <div className="dina-card-white p-5 space-y-2" data-testid="tab-securite">
      <div className="font-serif text-xl">Sécurité</div>
      <label className="flex items-center justify-between text-sm py-1"><span>PIN gérante requis pour remises</span><input type="checkbox" checked={s.require_pin_discounts} onChange={e => setS({...s, require_pin_discounts: e.target.checked})} data-testid="sec-pin-discounts"/></label>
      <label className="flex items-center justify-between text-sm py-1"><span>PIN gérante requis pour remboursements</span><input type="checkbox" checked={s.require_pin_refunds} onChange={e => setS({...s, require_pin_refunds: e.target.checked})}/></label>
      <label className="text-xs text-[#666] block">Déconnexion auto (minutes)
        <input type="number" className="dina-input" value={s.session_timeout_min} onChange={e => setS({...s, session_timeout_min: +e.target.value})}/>
      </label>
      <label className="flex items-center justify-between text-sm py-1"><span>Double authentification admin</span><input type="checkbox" checked={s.two_factor} onChange={e => setS({...s, two_factor: e.target.checked})}/></label>
      <button onClick={save} className="dina-btn-primary mt-2" data-testid="securite-save"><Save size={14}/> Enregistrer</button>
    </div>
  );
}

/* -------- Données -------- */
function DonneesTab() {
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
    </div>
  );
}
