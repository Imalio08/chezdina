import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { ExternalLink, Save, Clock } from "lucide-react";
import OpeningHoursEditor from "@/components/storefront/OpeningHoursEditor";

export default function SiteSettings() {
  const [hero, setHero] = useState({ tagline:"Collection Harmattan 2026", title:"Vos talons,", highlight:"votre allure.", subtitle:"Chaussures, robes, sacs et accessoires pour la femme ivoirienne.", mosaic:["","","",""] });
  const [openingHours, setOpeningHours] = useState({});

  useEffect(() => {
    api.get("/public/site").then(r => {
      const d = r.data || {};
      if (d.hero) setHero(h => ({ ...h, ...d.hero }));
      setOpeningHours(d.opening_hours || {});
    }).catch(() => {});
  }, []);

  const save = async () => {
    try {
      await api.patch("/site", { hero, opening_hours: openingHours });
      toast.success("Site mis à jour");
    } catch { toast.error("Erreur"); }
  };
  const upd = (k,v) => setHero({...hero, [k]:v});
  const updImg = (i,v) => { const m=[...hero.mosaic]; m[i]=v; setHero({...hero, mosaic:m}); };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div><h1 className="font-serif text-3xl">Site vitrine</h1><p className="text-sm text-[#666]">Configuration du site public — textes, visuels, horaires</p></div>
        <a href="/boutique" target="_blank" rel="noreferrer" className="dina-btn-secondary !min-h-[40px]" data-testid="view-site"><ExternalLink size={14}/>Voir le site</a>
      </div>

      <div className="dina-card-white p-5">
        <div className="font-semibold mb-1">Hero mosaïque</div>
        <p className="text-xs text-[#666] mb-4">Textes et 4 images de la page d'accueil</p>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs uppercase text-[#666]">Mini-titre</label>
            <input className="dina-input" value={hero.tagline} onChange={e=>upd("tagline",e.target.value)} data-testid="hero-tagline"/>
            <label className="text-xs uppercase text-[#666]">Titre</label>
            <input className="dina-input" value={hero.title} onChange={e=>upd("title",e.target.value)} data-testid="hero-title"/>
            <label className="text-xs uppercase text-[#666]">Mot mis en avant (rouge)</label>
            <input className="dina-input" value={hero.highlight} onChange={e=>upd("highlight",e.target.value)} data-testid="hero-highlight"/>
            <label className="text-xs uppercase text-[#666]">Sous-titre</label>
            <textarea className="dina-input" rows={3} value={hero.subtitle} onChange={e=>upd("subtitle",e.target.value)} data-testid="hero-subtitle"/>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase text-[#666]">4 images (URL)</label>
            {hero.mosaic.map((src,i)=>(
              <div key={i} className="flex gap-2 items-center">
                <div className="w-14 h-14 rounded-lg bg-[#fff5f5] overflow-hidden shrink-0">{src && <img src={src} alt="" className="w-full h-full object-cover"/>}</div>
                <input className="dina-input" value={src} onChange={e=>updImg(i,e.target.value)} placeholder={`Image ${i+1}`} data-testid={`hero-image-${i}`}/>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dina-card-white p-5">
        <div className="font-semibold mb-1 flex items-center gap-2"><Clock size={16}/>Horaires d'ouverture</div>
        <p className="text-xs text-[#666] mb-4">Ces horaires alimentent le bandeau "Boutique fermée actuellement" sur la vitrine et sont affichés dans la page Contact</p>
        <OpeningHoursEditor value={openingHours} onChange={setOpeningHours}/>
      </div>

      <div className="flex justify-end">
        <button onClick={save} className="dina-btn-primary" data-testid="site-save"><Save size={14}/>Enregistrer le site</button>
      </div>
    </div>
  );
}
