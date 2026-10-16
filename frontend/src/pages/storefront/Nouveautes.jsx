import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";

export default function Nouveautes() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    api.get("/public/products").then(r => {
      const sorted = (r.data || []).slice().sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")).slice(0, 40);
      setItems(sorted);
    });
  }, []);
  return (
    <div className="max-w-6xl mx-auto px-4 py-8" data-testid="page-nouveautes">
      <h1 className="font-serif text-3xl mb-1">Nouveautés</h1>
      <p className="text-sm text-[#666] mb-6">Les derniers produits ajoutés — les plus récents en premier</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map(p => (
          <Link key={p.id} to={`/product/${p.id}`} className="block" data-testid={`new-${p.id}`}>
            <div className="aspect-[3/4] bg-[#fff5f5] rounded overflow-hidden"><img src={p.image || p.images?.[0]} alt={p.name} className="w-full h-full object-cover"/></div>
            <div className="mt-2 text-sm font-medium leading-snug break-words">{p.name}</div>
            <div className="text-sm font-serif text-[#b02a2a]">{fcfa(p.price)}</div>
          </Link>
        ))}
        {items.length === 0 && <div className="col-span-full text-sm text-[#666] text-center py-10">Aucune nouveauté pour le moment</div>}
      </div>
    </div>
  );
}
