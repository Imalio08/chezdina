import React from "react";
import { MessageCircle, Smartphone, Printer, Instagram, Facebook, MapPin, Mail } from "lucide-react";

const INTS = [
  { icon: MessageCircle, name: "WhatsApp Business", status: "disconnected", desc: "Confirmations, suivi, campagnes, inbox partagée" },
  { icon: Smartphone, name: "Wave Business", status: "placeholder", desc: "Lien de paiement envoyé par WhatsApp" },
  { icon: Printer, name: "Imprimante thermique Wi-Fi", status: "placeholder", desc: "ESC/POS 80mm — reçus, bons, étiquettes" },
  { icon: Instagram, name: "Instagram / Meta Commerce", status: "disconnected", desc: "Catalogue, Pixel, inbox" },
  { icon: Facebook, name: "Facebook Shops", status: "disconnected", desc: "Catalogue produit synchronisé" },
  { icon: MessageCircle, name: "TikTok Pixel & Catalog", status: "disconnected", desc: "Attribution, Shop link" },
  { icon: MapPin, name: "Google Maps", status: "connected", desc: "Zones de livraison, suivi livreurs" },
  { icon: Mail, name: "Email (Resend)", status: "placeholder", desc: "Factures et rapports par email" },
];

export default function Integrations() {
  return (
    <div className="space-y-5">
      <div><h1 className="font-serif text-3xl">Canaux & intégrations</h1><p className="text-sm text-[#666]">Branchez vos outils en un clic</p></div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {INTS.map(i=>(
          <div key={i.name} className="dina-card-white p-5" data-testid={`integration-${i.name.replace(/\s/g,"-")}`}>
            <div className="flex items-start justify-between mb-3"><div className="w-10 h-10 rounded-lg bg-[#f5f5f5] grid place-items-center"><i.icon size={18}/></div><span className="dina-chip" style={{color: i.status==="connected"?"#1f8a4c":i.status==="placeholder"?"#e4991e":"#666"}}><span className="status-dot" style={{background: i.status==="connected"?"#1f8a4c":i.status==="placeholder"?"#e4991e":"#999"}}/>{i.status==="connected"?"Connecté":i.status==="placeholder"?"À configurer":"Non connecté"}</span></div>
            <div className="font-semibold">{i.name}</div>
            <div className="text-xs text-[#666] mt-1 mb-3">{i.desc}</div>
            <button className="dina-btn-secondary w-full !min-h-[38px] text-xs">Configurer</button>
          </div>
        ))}
      </div>
    </div>
  );
}
