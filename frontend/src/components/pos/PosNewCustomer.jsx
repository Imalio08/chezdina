import React, { useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { X } from "lucide-react";

const SOURCES = ["Boutique","Instagram","TikTok","Facebook","WhatsApp","Bouche-à-oreille","Parrainage"];
const ZONES = ["Cocody","Riviera","Angré","Plateau","Marcory","Zone 4","Treichville","Koumassi","Yopougon","Abobo","Adjamé","Port-Bouët","Bingerville","Songon","Grand-Bassam"];
const SHOE = ["36","37","38","39","40","41","42"];
const CLOTH = ["XS","S","M","L","XL","XXL"];

export default function PosNewCustomer({ onCreated, onClose }) {
  const [f, setF] = useState({
    first_name:"", last_name:"", phone:"+225 ", whatsapp:"", email:"",
    commune:"Cocody", quartier:"", repere:"", zone:"Cocody",
    shoe_size:"", clothing_size:"", birthday:"", source:"Boutique",
    referral_code:"", wa_consent:true,
  });
  const [loading, setLoading] = useState(false);

  const upd = (k,v) => setF(p => ({...p, [k]:v}));
  const save = async () => {
    if (!f.first_name || !f.last_name || !f.phone) return toast.error("Prénom, nom et téléphone requis");
    const name = `${f.first_name.trim()} ${f.last_name.trim()}`;
    const address = [f.commune, f.quartier, f.repere].filter(Boolean).join(" · ");
    setLoading(true);
    try {
      // Duplicate check
      const dup = await api.get(`/customers?q=${encodeURIComponent(f.phone.replace(/\s/g,""))}`);
      if (dup.data?.length) {
        const found = dup.data.find(c => (c.phone||"").replace(/\s/g,"") === f.phone.replace(/\s/g,""));
        if (found) {
          toast.success(`Cliente existante rattachée : ${found.name}`);
          onCreated(found); return;
        }
      }
      const { data } = await api.post("/customers", {
        name, phone: f.phone, email: f.email || null, address,
        shoe_size: f.shoe_size || null, clothing_size: f.clothing_size || null,
        birthday: f.birthday || null,
        notes: `Source: ${f.source}${f.referral_code?` · Parrain: ${f.referral_code}`:""}${f.wa_consent?" · WhatsApp OK":""}`,
      });
      toast.success(`Cliente ${name} créée`);
      onCreated(data);
    } catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-end sm:place-items-center z-50 p-0 sm:p-4" onClick={onClose} data-testid="pos-new-customer-full">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-[#1a1a1a] flex items-center justify-between p-5 border-b border-[#ececec] dark:border-[#2a2a2a] z-10">
          <div><div className="font-serif text-xl">Nouvelle cliente</div><div className="text-xs text-[#666]">Fiche complète — pour un suivi personnalisé</div></div>
          <button onClick={onClose}><X size={18}/></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <div className="text-[10px] uppercase font-semibold text-[#666] mb-2">Identité</div>
            <div className="grid grid-cols-2 gap-2">
              <input className="dina-input" placeholder="Prénom *" value={f.first_name} onChange={e=>upd("first_name",e.target.value)} data-testid="nc-first-name"/>
              <input className="dina-input" placeholder="Nom *" value={f.last_name} onChange={e=>upd("last_name",e.target.value)} data-testid="nc-last-name"/>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <input className="dina-input" placeholder="Téléphone * (+225…)" value={f.phone} onChange={e=>upd("phone",e.target.value)} data-testid="nc-phone"/>
              <input className="dina-input" placeholder="WhatsApp (si différent)" value={f.whatsapp} onChange={e=>upd("whatsapp",e.target.value)} data-testid="nc-whatsapp"/>
            </div>
            <input className="dina-input mt-2" placeholder="Email (optionnel)" value={f.email} onChange={e=>upd("email",e.target.value)} data-testid="nc-email"/>
          </div>

          <div>
            <div className="text-[10px] uppercase font-semibold text-[#666] mb-2">Adresse</div>
            <div className="grid grid-cols-2 gap-2">
              <select className="dina-input" value={f.commune} onChange={e=>upd("commune",e.target.value)} data-testid="nc-commune">
                {ZONES.map(z=><option key={z}>{z}</option>)}
              </select>
              <input className="dina-input" placeholder="Quartier" value={f.quartier} onChange={e=>upd("quartier",e.target.value)} data-testid="nc-quartier"/>
            </div>
            <input className="dina-input mt-2" placeholder="Repère (près de la pharmacie X…)" value={f.repere} onChange={e=>upd("repere",e.target.value)} data-testid="nc-repere"/>
            <select className="dina-input mt-2" value={f.zone} onChange={e=>upd("zone",e.target.value)} data-testid="nc-zone">
              <option value="">Zone de livraison…</option>
              {ZONES.map(z=><option key={z} value={z}>{z}</option>)}
            </select>
          </div>

          <div>
            <div className="text-[10px] uppercase font-semibold text-[#666] mb-2">Tailles</div>
            <div className="grid grid-cols-3 gap-2">
              <select className="dina-input" value={f.shoe_size} onChange={e=>upd("shoe_size",e.target.value)} data-testid="nc-shoe">
                <option value="">Pointure…</option>
                {SHOE.map(s=><option key={s}>{s}</option>)}
              </select>
              <select className="dina-input" value={f.clothing_size} onChange={e=>upd("clothing_size",e.target.value)} data-testid="nc-cloth">
                <option value="">Taille vêt…</option>
                {CLOTH.map(s=><option key={s}>{s}</option>)}
              </select>
              <input type="date" className="dina-input" value={f.birthday} onChange={e=>upd("birthday",e.target.value)} data-testid="nc-birthday" title="Anniversaire"/>
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-semibold text-[#666] mb-2">Source & parrainage</div>
            <div className="grid grid-cols-2 gap-2">
              <select className="dina-input" value={f.source} onChange={e=>upd("source",e.target.value)} data-testid="nc-source">
                {SOURCES.map(s=><option key={s}>{s}</option>)}
              </select>
              <input className="dina-input" placeholder="Code parrain (DINA-XXXX)" value={f.referral_code} onChange={e=>upd("referral_code",e.target.value.toUpperCase())} data-testid="nc-referral"/>
            </div>
            <label className="flex items-center gap-2 text-xs text-[#666] mt-2 cursor-pointer">
              <input type="checkbox" checked={f.wa_consent} onChange={e=>upd("wa_consent",e.target.checked)} className="accent-[#b02a2a]" data-testid="nc-wa-consent"/>
              Elle accepte de recevoir nos messages WhatsApp (promos, nouveautés)
            </label>
          </div>
        </div>
        <div className="sticky bottom-0 bg-white dark:bg-[#1a1a1a] border-t border-[#ececec] dark:border-[#2a2a2a] p-4 flex gap-2">
          <button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button>
          <button onClick={save} disabled={loading} className="dina-btn-primary flex-1" data-testid="nc-save">{loading?"…":"Créer la cliente"}</button>
        </div>
      </div>
    </div>
  );
}
