import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";

export default function Catalog() {
  const [sp, setSp] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const cat = sp.get("category") || "all";
  useEffect(()=>{api.get(`/public/products?category=${cat}`).then(r=>setProducts(r.data));},[cat]);
  const cats = useMemo(()=>["all", ...Array.from(new Set(products.map(p=>p.category)))], [products]);
  const filtered = products.filter(p=>!q||p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="font-serif text-3xl mb-4">Catalogue</h1>
      <div className="flex gap-2 mb-4 flex-wrap">
        <input className="dina-input max-w-xs" placeholder="Rechercher…" value={q} onChange={e=>setQ(e.target.value)} data-testid="catalog-search"/>
        <div className="flex gap-2 flex-wrap">{cats.map(c=><button key={c} onClick={()=>setSp(c==="all"?{}:{category:c})} className={`dina-chip ${cat===c?"!bg-[#1c1c1c] !text-white":""}`} data-testid={`catalog-cat-${c}`}>{c==="all"?"Tout":c}</button>)}</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map(p=>(
          <Link key={p.id} to={`/boutique/product/${p.id}`} className="group" data-testid={`catalog-card-${p.id}`}>
            <div className="aspect-[4/5] bg-[#f5f5f5] rounded-xl overflow-hidden"><img src={p.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition"/></div>
            <div className="mt-2"><div className="text-xs text-[#666]">{p.category}</div><div className="text-sm font-medium truncate">{p.name}</div><div className="flex items-center justify-between mt-0.5"><div className="tabular font-semibold text-sm">{fcfa(p.price)}</div>{p.rating_avg>0 && <div className="text-xs text-[#666] flex items-center gap-0.5"><span className="text-[#f4b12c]">★</span>{p.rating_avg}</div>}</div>{p.stock<5 && <div className="text-xs text-[#c62828]">Plus que {p.stock} !</div>}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
