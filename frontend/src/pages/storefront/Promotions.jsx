import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";

export default function Promotions() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    api.get("/public/products").then(r => {
      const promos = (r.data || []).filter(p => p.compare_at_price && p.compare_at_price > (p.price || 0));
      setItems(promos);
    });
  }, []);
  return (
    <div className="max-w-6xl mx-auto px-4 py-8" data-testid="page-promotions">
      <h1 className="font-serif text-3xl mb-1">Promotions</h1>
      <p className="text-sm text-[#666] mb-6">Tous les produits en promotion — prix barré et badge de réduction</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map(p => {
          const pct = Math.round(((p.compare_at_price - p.price) / p.compare_at_price) * 100);
          return (
            <Link key={p.id} to={`/product/${p.id}`} className="block relative" data-testid={`promo-${p.id}`}>
              <div className="aspect-[3/4] bg-[#fff5f5] rounded overflow-hidden"><img src={p.image || p.images?.[0]} alt={p.name} className="w-full h-full object-cover"/></div>
              <span className="absolute top-2 left-2 bg-[#b02a2a] text-white text-xs font-bold px-2 py-1 rounded">-{pct}%</span>
              <div className="mt-2 text-sm font-medium truncate">{p.name}</div>
              <div className="flex items-baseline gap-2"><span className="text-sm font-serif text-[#b02a2a] font-semibold">{fcfa(p.price)}</span><s className="text-xs text-[#999] tabular">{fcfa(p.compare_at_price)}</s></div>
            </Link>
          );
        })}
        {items.length === 0 && <div className="col-span-full text-sm text-[#666] text-center py-10">Aucune promotion active en ce moment</div>}
      </div>
    </div>
  );
}
