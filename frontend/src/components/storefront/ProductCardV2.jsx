import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, Zap } from "lucide-react";
import { fcfa } from "@/lib/format";
import api from "@/lib/api";
import { toast } from "sonner";
import SmartImage from "@/components/shared/SmartImage";
import { colorCss } from "@/lib/colors";

const KEY = "dina_favs";
const getFavs = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
const setFavs = (list) => localStorage.setItem(KEY, JSON.stringify(list));

export function toggleFavorite(id) {
  const list = getFavs(); const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1); else list.push(id);
  setFavs(list); window.dispatchEvent(new Event("favs-changed"));
  return i < 0;
}

export default function ProductCardV2({ product, flashEndsAt }) {
  const [favs, setFavsState] = useState(getFavs());
  const [showSizes, setShowSizes] = useState(false);
  const navTo = useNavigate();
  useEffect(() => { const h = () => setFavsState(getFavs()); window.addEventListener("favs-changed", h); return () => window.removeEventListener("favs-changed", h); }, []);
  const fav = favs.includes(product.id);
  const discount = product.compare_at ? Math.round((1 - product.price / product.compare_at) * 100) : 0;
  const badges = [];
  if (flashEndsAt) badges.push({ k: "flash", t: "Flash", c: "#e4991e" });
  if (discount >= 10) badges.push({ k: "disc", t: `-${discount}%`, c: "#c62828" });
  if (product.is_new) badges.push({ k: "new", t: "Nouveau", c: "#1f8a4c" });
  if (product.sold_count >= 50) badges.push({ k: "top", t: "Top vente", c: "#5867fd" });
  if (product.stock > 0 && product.stock <= 2) badges.push({ k: "low", t: `Plus que ${product.stock}`, c: "#b02a2a" });
  if (product.stock === 0 && product.restock_soon) badges.push({ k: "back", t: "Bientôt de retour", c: "#999" });
  const shown = badges.slice(0, 2);
  const colors = product.colors || [];
  const sizes = (product.sizes || []).filter(Boolean);
  const soldOut = (s) => (product.stock_by_size || {})[s] === 0;
  const addCart = (size) => {
    const cart = JSON.parse(localStorage.getItem("dina_cart") || "[]");
    cart.push({ product_id: product.id, name: product.name, image: product.image, price: product.price, size, color: colors[0], qty: 1, key: `${product.id}-${size}-${Date.now()}` });
    localStorage.setItem("dina_cart", JSON.stringify(cart));
    toast.success("Ajouté au panier", { description: `${product.name} · ${size}`, action: { label: "Voir le panier", onClick: () => navTo("/checkout") } });
    setShowSizes(false);
    window.dispatchEvent(new Event("cart-changed"));
  };

  return (
    <div className="group relative" data-testid={`card-${product.id}`}>
      <Link to={`/product/${product.id}`} className="block">
        <div className="relative aspect-[3/4] bg-[#fff5f5] dark:bg-[#2a1818] rounded-xl overflow-hidden">
          <SmartImage src={product.image} alt={product.name} fallbackText={product.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
          {product.images?.[1] && <SmartImage src={product.images[1]} alt="" fallbackText={product.name} className="hidden md:block absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition" />}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {shown.map(b => <span key={b.k} className="text-[10px] font-semibold text-white px-1.5 py-0.5 rounded" style={{ background: b.c }}>{b.t}</span>)}
          </div>
          <button onClick={(e) => { e.preventDefault(); toggleFavorite(product.id); }} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 dark:bg-black/60 grid place-items-center shadow" data-testid={`fav-${product.id}`}>
            <Heart size={14} fill={fav ? "#b02a2a" : "none"} stroke={fav ? "#b02a2a" : "currentColor"} />
          </button>
          {product.stock === 0 && <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] text-center py-1 uppercase tracking-widest">Rupture</div>}
        </div>
      </Link>
      <div className="mt-2">
        {product.brand && <div className="text-[10px] text-[#999] uppercase tracking-wide">{product.brand}</div>}
        <Link to={`/product/${product.id}`} className="text-sm font-medium line-clamp-2 min-h-[2.5em]">{product.name}</Link>
        {colors.length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            {colors.slice(0, 4).map((c, i) => <span key={i} className="w-3.5 h-3.5 rounded-full border border-[#ececec] dark:border-[#2a2a2a]" title={c} style={{ background: cssColor(c) }} />)}
            {colors.length > 4 && <span className="text-[10px] text-[#999]">+{colors.length - 4}</span>}
          </div>
        )}
        {product.rating_count >= 3 && <div className="text-[10px] mt-0.5 text-[#666]"><span className="text-[#f4b12c]">★</span> {product.rating_avg} <span className="text-[#999]">({product.rating_count})</span></div>}
        <div className="flex items-end justify-between mt-1">
          <div>
            <div className="tabular font-bold text-[#b02a2a]">{fcfa(product.price)}</div>
            {product.compare_at > product.price && <div className="text-[11px] text-[#999] line-through tabular">{fcfa(product.compare_at)}</div>}
          </div>
          {sizes.length > 0 && product.stock > 0 && <button onClick={() => setShowSizes(true)} className="text-[10px] bg-[#1c1c1c] dark:bg-white dark:text-[#1c1c1c] text-white px-2.5 py-1.5 rounded-full font-semibold" data-testid={`quick-${product.id}`}>+ Ajouter</button>}
        </div>
        {product.sold_count > 20 && <div className="text-[10px] text-[#1f8a4c] mt-0.5">🔥 {product.sold_count} vendus</div>}
      </div>
      {showSizes && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => setShowSizes(false)}>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-t-2xl p-4 w-full max-w-md mx-auto" onClick={e => e.stopPropagation()}>
            <div className="font-serif text-lg mb-3">{product.name}</div>
            <div className="text-xs text-[#666] mb-2">Choisir une taille</div>
            <div className="grid grid-cols-4 gap-2">
              {sizes.map(s => {
                const out = soldOut(s);
                return <button key={s} disabled={out} onClick={() => addCart(s)} className={`py-3 rounded-lg border text-sm font-semibold ${out ? "border-[#ececec] text-[#999] line-through" : "border-[#1c1c1c] dark:border-white hover:bg-[#1c1c1c] hover:text-white dark:hover:bg-white dark:hover:text-[#1c1c1c]"}`} data-testid={`size-${s}`}>{s}{out ? "" : ""}</button>;
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function cssColor(name) {
  return colorCss(name);
}
