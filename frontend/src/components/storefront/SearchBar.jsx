import React, { useEffect, useState, useRef } from "react";
import { Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";

const RECENT_KEY = "dina_recent_search";

export default function SearchBar() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const [recent, setRecent] = useState(() => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; } });
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (q.length < 2) { setRes(null); return; }
    const t = setTimeout(() => api.get(`/public/search-suggestions?q=${encodeURIComponent(q)}`).then(r => setRes(r.data)).catch(() => { }), 200);
    return () => clearTimeout(t);
  }, [q]);
  const addRecent = (term) => { const n = [term, ...recent.filter(x => x !== term)].slice(0, 5); setRecent(n); localStorage.setItem(RECENT_KEY, JSON.stringify(n)); };
  const found = (res?.products?.length || 0) > 0;
  return (
    <div className="relative flex-1 max-w-xl" ref={ref}>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]" />
        <input className="dina-input pl-9 pr-9" placeholder="Cherchez un produit, une marque ou une catégorie" value={q} onChange={e => setQ(e.target.value)} onFocus={() => setOpen(true)} data-testid="storefront-search" />
        {q && <button onClick={() => { setQ(""); setRes(null); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#999]"><X size={14} /></button>}
      </div>
      {open && (q.length >= 2 || recent.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1a1a1a] border border-[#ececec] dark:border-[#2a2a2a] rounded-xl shadow-xl z-40 max-h-[70vh] overflow-y-auto" data-testid="search-dropdown">
          {q.length < 2 && recent.length > 0 && (
            <div className="p-3">
              <div className="text-[10px] uppercase text-[#999] mb-2">Recherches récentes</div>
              {recent.map(r => <button key={r} onClick={() => setQ(r)} className="block text-sm py-1 text-[#1c1c1c] dark:text-white hover:text-[#b02a2a]">{r}</button>)}
            </div>
          )}
          {q.length >= 2 && res && (
            <>
              {!found && (
                <div className="p-4 text-center text-sm text-[#666]" data-testid="search-noresult">
                  Aucun résultat pour <strong>« {q} »</strong>.<br />
                  <a href={`https://wa.me/2250777926179?text=${encodeURIComponent(`Bonjour, je cherche: ${q}`)}`} target="_blank" rel="noreferrer" className="dina-btn-primary mt-3 inline-flex text-xs !min-h-[36px]">Demander sur WhatsApp</a>
                </div>
              )}
              {res.categories?.length > 0 && (
                <div className="p-3 border-b border-[#f5f5f5] dark:border-[#2a2a2a]"><div className="text-[10px] uppercase text-[#999] mb-1">Catégories</div>{res.categories.map(c => <Link key={c} to={`/boutique/catalog?cat=${encodeURIComponent(c)}`} onClick={() => { addRecent(c); setOpen(false); }} className="block py-1 text-sm hover:text-[#b02a2a]">{c}</Link>)}</div>
              )}
              {res.products?.length > 0 && (
                <div className="p-2">{res.products.map(p => (
                  <Link key={p.id} to={`/boutique/product/${p.id}`} onClick={() => { addRecent(p.name); setOpen(false); }} className="flex gap-2 items-center p-2 hover:bg-[#fff5f5] dark:hover:bg-[#2a1818] rounded-lg" data-testid={`search-prod-${p.id}`}>
                    <img src={p.image} alt="" className="w-10 h-12 object-cover rounded" />
                    <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{p.name}</div><div className="text-[11px] text-[#999]">{p.brand}</div></div>
                    <div className="tabular text-sm font-bold text-[#b02a2a]">{fcfa(p.price)}</div>
                  </Link>
                ))}</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
