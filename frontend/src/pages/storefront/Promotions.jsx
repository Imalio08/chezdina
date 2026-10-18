import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import ProductCardV2 from "@/components/storefront/ProductCardV2";

export default function Promotions() {
  const [items, setItems] = useState(null);
  useEffect(() => {
    api.get("/public/products").then(r => {
      const promos = (r.data || []).filter(p => p.compare_at > (p.price || 0));
      setItems(promos.sort((a, b) => (b.promo_pct || 0) - (a.promo_pct || 0)));
    }).catch(() => setItems([]));
  }, []);
  return (
    <div className="max-w-6xl mx-auto px-4 py-8" data-testid="page-promotions">
      <h1 className="font-serif text-3xl mb-1">Promotions</h1>
      <p className="text-sm text-[#666] mb-6">Tous les produits en promotion</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {(items || []).map(p => <ProductCardV2 key={p.id} product={p} />)}
        {items && items.length === 0 && <div className="col-span-full text-sm text-[#666] text-center py-10">Aucune promotion active en ce moment</div>}
      </div>
    </div>
  );
}
