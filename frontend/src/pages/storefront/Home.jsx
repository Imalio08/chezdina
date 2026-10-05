import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Truck, Shield, MessageCircle, ChevronRight } from "lucide-react";

const DEFAULT_HERO = {
  tagline: "Collection Harmattan 2026",
  title: "Vos talons,",
  highlight: "votre allure.",
  subtitle: "Chaussures, robes, sacs et accessoires soigneusement choisis pour la femme ivoirienne. Livraison partout en Côte d'Ivoire.",
  mosaic: [
    "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800",
    "https://images.unsplash.com/photo-1709809081557-78f803ce93a0?w=800",
    "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800",
    "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800",
  ],
};

export default function Home() {
  const [products, setProducts] = useState([]);
  const [hero, setHero] = useState(DEFAULT_HERO);
  const [idx, setIdx] = useState(0);
  useEffect(() => { api.get("/public/products").then(r=>setProducts(r.data)); api.get("/public/site").then(r=>{ if (r.data?.hero) setHero({...DEFAULT_HERO, ...r.data.hero}); }).catch(()=>{}); }, []);
  useEffect(() => { const t = setInterval(()=>setIdx(i=>(i+1)%hero.mosaic.length), 4000); return ()=>clearInterval(t); }, [hero.mosaic.length]);

  return (
    <div>
      <section className="bg-[#fff5f5]">
        <div className="max-w-6xl mx-auto px-4 py-14 lg:py-20 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="text-[#b02a2a] text-xs font-semibold tracking-widest uppercase mb-3">{hero.tagline}</div>
            <h1 className="font-serif text-4xl lg:text-6xl leading-[1.05] text-[#1c1c1c]">{hero.title}<br/><span className="text-[#b02a2a] italic">{hero.highlight}</span></h1>
            <p className="text-[#666] mt-5 max-w-md leading-relaxed">{hero.subtitle}</p>
            <div className="flex gap-3 mt-6">
              <Link to="/boutique/catalog" className="dina-btn-primary" data-testid="home-shop-now">Découvrir la collection <ChevronRight size={16}/></Link>
              <a href="https://wa.me/2250777926179" target="_blank" rel="noreferrer" className="dina-btn-secondary"><MessageCircle size={16}/>WhatsApp</a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 relative">
            {hero.mosaic.map((src, i) => (
              <div key={i} className={`relative overflow-hidden rounded-2xl bg-[#fde8e8] ${i===0?"aspect-[3/4]":i===1?"aspect-square mt-6":i===2?"aspect-square":"aspect-[3/4] -mt-6"}`}>
                <img src={src} alt="" className={`w-full h-full object-cover transition-transform duration-700 ${idx===i?"scale-105":"scale-100"}`}/>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-14">
        <div className="flex items-end justify-between mb-6">
          <div><div className="text-xs tracking-widest uppercase text-[#b02a2a]">Nouveautés</div><h2 className="font-serif text-3xl mt-1">Les coups de cœur</h2></div>
          <Link to="/boutique/catalog" className="text-sm underline">Voir tout</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.slice(0,8).map(p=>(
            <Link key={p.id} to={`/boutique/product/${p.id}`} className="group" data-testid={`storefront-product-${p.id}`}>
              <div className="aspect-[4/5] bg-[#fff5f5] rounded-xl overflow-hidden"><img src={p.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition"/></div>
              <div className="mt-2"><div className="text-xs text-[#b02a2a] uppercase tracking-wide">{p.category}</div><div className="text-sm font-medium truncate">{p.name}</div><div className="flex items-center justify-between mt-0.5"><div className="tabular font-semibold text-sm">{fcfa(p.price)}</div>{p.rating_avg>0 && <div className="text-xs text-[#666] flex items-center gap-0.5"><span className="text-[#f4b12c]">★</span>{p.rating_avg}</div>}</div></div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-[#1c1c1c] text-white">
        <div className="max-w-6xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-6">
          <div className="flex gap-3"><Truck className="text-[#b02a2a] shrink-0"/><div><div className="font-serif text-lg">Livraison rapide</div><div className="text-sm text-[#bbb] mt-1">Partout à Abidjan en 24h.</div></div></div>
          <div className="flex gap-3"><Shield className="text-[#b02a2a] shrink-0"/><div><div className="font-serif text-lg">Paiement à la livraison</div><div className="text-sm text-[#bbb] mt-1">Espèces ou Wave à la réception.</div></div></div>
          <div className="flex gap-3"><MessageCircle className="text-[#b02a2a] shrink-0"/><div><div className="font-serif text-lg">Conseillère WhatsApp</div><div className="text-sm text-[#bbb] mt-1">0777 92 61 79 · 7j/7.</div></div></div>
        </div>
      </section>
    </div>
  );
}
