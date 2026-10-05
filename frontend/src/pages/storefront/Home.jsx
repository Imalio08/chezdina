import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";

export default function Home() {
  const [products, setProducts] = useState([]);
  useEffect(()=>{api.get("/public/products").then(r=>setProducts(r.data));},[]);
  return (
    <div>
      <section className="relative bg-[#1c1c1c] text-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 py-16 lg:py-24 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="text-[#f4b12c] text-xs font-semibold tracking-widest uppercase mb-3">Nouvelle collection · Harmattan 2026</div>
            <h1 className="font-serif text-4xl lg:text-6xl leading-[1.05]">La mode d'Abidjan,<br/><span className="text-[#f4b12c]">livrée chez vous.</span></h1>
            <p className="text-[#bbb] mt-5 max-w-md">Chaussures, robes, sacs. Pièces soigneusement choisies, prix justes, livraison partout en Côte d'Ivoire.</p>
            <div className="flex gap-3 mt-6">
              <Link to="/boutique/catalog" className="dina-btn-primary" data-testid="home-shop-now">Découvrir</Link>
              <Link to="/boutique/catalog?category=Chaussures" className="dina-btn-secondary" style={{background:"transparent",color:"white",borderColor:"white"}}>Chaussures</Link>
            </div>
          </div>
          <div className="relative"><img src="https://images.unsplash.com/photo-1709809081557-78f803ce93a0?w=800" alt="" className="rounded-2xl aspect-[4/5] object-cover w-full"/></div>
        </div>
      </section>
      <section className="max-w-6xl mx-auto px-4 py-14">
        <div className="flex items-end justify-between mb-6"><div><div className="text-xs tracking-widest uppercase text-[#666]">Sélection</div><h2 className="font-serif text-3xl">Nouveautés</h2></div><Link to="/boutique/catalog" className="text-sm underline">Voir tout</Link></div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.slice(0,8).map(p=>(
            <Link key={p.id} to={`/boutique/product/${p.id}`} className="group" data-testid={`storefront-product-${p.id}`}>
              <div className="aspect-[4/5] bg-[#f5f5f5] rounded-xl overflow-hidden"><img src={p.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition"/></div>
              <div className="mt-2"><div className="text-xs text-[#666]">{p.category}</div><div className="text-sm font-medium truncate">{p.name}</div><div className="tabular font-semibold text-sm mt-0.5">{fcfa(p.price)}</div></div>
            </Link>
          ))}
        </div>
      </section>
      <section className="bg-[#fff8e9] py-14">
        <div className="max-w-6xl mx-auto px-4 grid lg:grid-cols-3 gap-6">
          <div><div className="font-serif text-2xl">Livraison rapide</div><p className="text-sm text-[#666] mt-1">Toutes zones d'Abidjan sous 24h.</p></div>
          <div><div className="font-serif text-2xl">Paiement à la livraison</div><p className="text-sm text-[#666] mt-1">Payez en espèces ou par Wave en recevant la commande.</p></div>
          <div><div className="font-serif text-2xl">WhatsApp 24/7</div><p className="text-sm text-[#666] mt-1">Discutez avec une conseillère en direct.</p></div>
        </div>
      </section>
    </div>
  );
}
