import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { MessageCircle, Smartphone, Printer, Instagram, Facebook, MapPin, Mail, Check } from "lucide-react";

const INTS = [
  { key:"whatsapp", icon: MessageCircle, name:"WhatsApp Business", desc:"Confirmations, suivi, campagnes", field:"phone", placeholder:"Numéro WhatsApp (ex: 2250777926179)" },
  { key:"wave", icon: Smartphone, name:"Wave Business", desc:"Lien de paiement envoyé par WhatsApp", field:"link", placeholder:"Votre lien Wave (https://pay.wave.com/...)" },
  { key:"printer", icon: Printer, name:"Imprimante thermique Wi-Fi", desc:"Reçus, bons, étiquettes", field:"ip", placeholder:"Adresse IP (ex: 192.168.1.100)" },
  { key:"instagram", icon: Instagram, name:"Instagram", desc:"Catalogue + inbox", field:"handle", placeholder:"@votre_compte" },
  { key:"facebook", icon: Facebook, name:"Facebook Shops", desc:"Catalogue produit", field:"page", placeholder:"https://facebook.com/votre_page" },
  { key:"tiktok", icon: MessageCircle, name:"TikTok", desc:"Pixel + catalogue", field:"handle", placeholder:"@dinoush04" },
  { key:"maps", icon: MapPin, name:"Google Maps", desc:"Zones et suivi livreurs", field:"api_key", placeholder:"API key (optionnel)" },
  { key:"email", icon: Mail, name:"Email", desc:"Factures et rapports par email", field:"from", placeholder:"from@dinaboutique.ci" },
];

export default function Integrations() {
  const [state, setState] = useState({});
  useEffect(() => { const s = JSON.parse(localStorage.getItem("dina_integrations")||"{}"); setState(s); }, []);
  const save = (key, value) => {
    const next = {...state, [key]: {...state[key], value, connected: !!value}};
    setState(next); localStorage.setItem("dina_integrations", JSON.stringify(next));
    toast.success(value ? `${INTS.find(i=>i.key===key).name} connecté` : "Déconnecté");
  };

  return (
    <div className="space-y-5">
      <div><h1 className="font-serif text-3xl">Intégrations</h1><p className="text-sm text-[#666]">Mettez votre numéro ou lien — la connexion se fait automatiquement</p></div>

      <div className="grid md:grid-cols-2 gap-4">
        {INTS.map(i=>{
          const val = state[i.key]?.value || "";
          const connected = state[i.key]?.connected;
          return (
            <div key={i.key} className="dina-card-white p-5" data-testid={`integration-${i.key}`}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#fff5f5] text-[#b02a2a] grid place-items-center"><i.icon size={18}/></div>
                <div className="flex-1"><div className="font-semibold">{i.name}</div><div className="text-xs text-[#666]">{i.desc}</div></div>
                {connected && <span className="dina-chip" style={{color:"#1f8a4c"}}><Check size={10}/>Connecté</span>}
              </div>
              <div className="flex gap-2">
                <input className="dina-input text-sm" placeholder={i.placeholder} defaultValue={val} onBlur={e=>save(i.key, e.target.value)} data-testid={`int-input-${i.key}`}/>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
