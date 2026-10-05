import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { ExternalLink, Save } from "lucide-react";

export default function Settings() {
  const [stores, setStores] = useState([]);
  const [hero, setHero] = useState({ tagline:"Collection Harmattan 2026", title:"Vos talons,", highlight:"votre allure.", subtitle:"Chaussures, robes, sacs et accessoires pour la femme ivoirienne.", mosaic:["","","",""] });
  useEffect(() => { api.get("/stores").then(r=>setStores(r.data)); api.get("/public/site").then(r=>{ if (r.data?.hero) setHero(h=>({...h,...r.data.hero})); }); }, []);
  const save = async () => { await api.patch("/site", { hero }); toast.success("Site mis à jour"); };
  const reseed = async () => { try { await api.post("/seed"); toast.success("Données réensemencées"); } catch { toast.error("Réservé admin"); } };
  const upd = (k, v) => setHero({ ...hero, [k]: v });
  const updImg = (i, v) => { const m = [...hero.mosaic]; m[i] = v; setHero({ ...hero, mosaic: m }); };
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><div><h1 className="font-serif text-3xl">Paramètres</h1><p className="text-sm text-[#666]">Boutique, site vitrine, paiements, zones</p></div><a href="/boutique" target="_blank" rel="noreferrer" className="dina-btn-secondary !min-h-[40px]" data-testid="view-storefront"><ExternalLink size={14}/>Voir le site</a></div>

      <div className="dina-card-white p-5">
        <div className="font-semibold mb-1">Site vitrine · Hero mosaïque</div>
        <p className="text-xs text-[#666] mb-4">Modifiez textes et 4 images de la page d'accueil. Visible immédiatement sur <a href="/boutique" target="_blank" className="text-[#b02a2a] underline">/boutique</a>.</p>
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
        <button onClick={save} className="dina-btn-primary mt-4" data-testid="site-save"><Save size={14}/>Enregistrer le site</button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Boutiques physiques</div>
          {stores.map(s=><div key={s.id} className="border border-[#ececec] rounded-lg p-3 mb-2"><div className="font-medium">{s.name}{s.main && <span className="dina-chip ml-2 text-xs">Principale</span>}</div><div className="text-xs text-[#666]">{s.address} · {s.phone}</div></div>)}
        </div>
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Contact & réseaux</div>
          <div className="text-sm space-y-2"><div className="flex justify-between"><span className="text-[#666]">WhatsApp Business</span><strong>+225 07 77 92 61 79</strong></div><div className="flex justify-between"><span className="text-[#666]">TikTok</span><a href="https://www.tiktok.com/@dinoush04" target="_blank" rel="noreferrer" className="text-[#b02a2a] underline">@dinoush04</a></div></div>
        </div>
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Zones de livraison Abidjan</div>
          <div className="flex flex-wrap gap-1 text-xs">{["Cocody","Riviera","Angré","Plateau","Marcory","Zone 4","Treichville","Koumassi","Yopougon","Abobo","Adjamé","Port-Bouët","Bingerville","Songon","Grand-Bassam"].map(z=><span key={z} className="dina-chip">{z}</span>)}</div>
        </div>
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Données de démonstration</div>
          <p className="text-xs text-[#666] mb-3">Réensemencer les données (produits, clientes, commandes).</p>
          <button onClick={reseed} className="dina-btn-secondary" data-testid="reseed-button">Réensemencer</button>
        </div>
      </div>
    </div>
  );
}
