import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import ProductCardV2 from "@/components/storefront/ProductCardV2";
import { Flame } from "lucide-react";
import { Link } from "react-router-dom";

const CHIPS = [
  { v: "all", label: "Tout" },
  { v: "flash", label: "Ventes flash" },
  { v: "d30", label: "-30% et plus" },
  { v: "u10", label: "Moins de 10 000 FCFA" },
  { v: "u20", label: "Moins de 20 000 FCFA" },
  { v: "last", label: "Derniers articles" },
];

export default function BonsPlans() {
  const [products, setProducts] = useState([]);
  const [promos, setPromos] = useState([]);
  const [chip, setChip] = useState("all");
  const [sort, setSort] = useState("disc");

  useEffect(() => {
    api.get("/public/products").then(r => setProducts(r.data));
    api.get("/public/promotions").then(r => setPromos(r.data || [])).catch(() => { });
  }, []);

  const deals = useMemo(() => products.filter(p => p.compare_at > p.price || p.flash), [products]);
  const filtered = useMemo(() => deals.filter(p => {
    const disc = p.compare_at ? (1 - p.price / p.compare_at) : 0;
    if (chip === "flash") return !!p.flash;
    if (chip === "d30") return disc >= 0.3;
    if (chip === "u10") return p.price < 10000;
    if (chip === "u20") return p.price < 20000;
    if (chip === "last") return p.stock <= 3 && p.stock > 0;
    return true;
  }), [deals, chip]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === "disc") arr.sort((a, b) => (b.compare_at ? (b.compare_at - b.price) / b.compare_at : 0) - (a.compare_at ? (a.compare_at - a.price) / a.compare_at : 0));
    if (sort === "price") arr.sort((a, b) => a.price - b.price);
    if (sort === "new") arr.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    return arr;
  }, [filtered, sort]);

  const activeFlash = promos.filter(p => p.flash && p.ends_at && new Date(p.ends_at) > new Date());

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-widest text-[#b02a2a] mb-1">Promotions en cours</div>
        <h1 className="font-serif text-4xl md:text-5xl">Bons plans</h1>
        <p className="text-sm text-[#666] mt-2">{deals.length} produits en promotion</p>
      </div>

      {activeFlash.length > 0 && (
        <div className="space-y-3 mb-6">
          {activeFlash.map(p => (
            <div key={p.id} className="dina-card-white p-4 flex items-center gap-4" data-testid={`promo-banner-${p.code}`}>
              <Flame className="text-[#b02a2a]" />
              <div className="flex-1"><div className="font-semibold">{p.code} · {p.type === "percent" ? `-${p.value}%` : "Livraison offerte"}</div><div className="text-xs text-[#666]">Jusqu'au {new Date(p.ends_at).toLocaleDateString("fr-FR")}</div></div>
              <Link to={`/boutique/catalog?promo=${p.code}`} className="dina-btn-primary !min-h-[36px] text-xs">Voir les produits</Link>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto scrollbar-thin -mx-4 px-4 pb-2 mb-4" data-testid="bp-chips">
        {CHIPS.map(c => <button key={c.v} onClick={() => setChip(c.v)} className={`px-4 py-2 rounded-full text-xs whitespace-nowrap border ${chip === c.v ? "bg-[#b02a2a] text-white border-[#b02a2a]" : "border-[#ececec] dark:border-[#2a2a2a]"}`} data-testid={`chip-${c.v}`}>{c.label}</button>)}
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-[#666]">{sorted.length} résultat{sorted.length > 1 ? "s" : ""}</div>
        <select className="dina-input !py-1.5 w-auto text-xs" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="disc">Plus grosse remise</option>
          <option value="price">Prix croissant</option>
          <option value="new">Nouveautés</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {sorted.map(p => <ProductCardV2 key={p.id} product={p} />)}
      </div>
      {sorted.length === 0 && <div className="text-center text-sm text-[#666] py-10">Aucune promotion dans ce filtre</div>}
    </div>
  );
}
