import React, { useState, useEffect } from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { ShoppingBag, User, Search, MessageCircle, X } from "lucide-react";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";

export default function StorefrontLayout() {
  const { cart } = useApp();
  const count = cart.reduce((s,x)=>s+x.qty,0);
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [sugg, setSugg] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!q.trim() || q.trim().length < 2) { setSugg([]); return; }
    const t = setTimeout(() => {
      api.get(`/public/search-suggestions?q=${encodeURIComponent(q)}`)
        .then(r => {
          const d = r.data || {};
          const items = [
            ...(d.products || []).map(p => ({ type: "produit", id: p.id, name: p.name, image: p.image, link: `/boutique/product/${p.id}` })),
            ...(d.categories || []).map(c => ({ type: "catégorie", name: c, link: `/boutique/catalog?category=${encodeURIComponent(c)}` })),
            ...(d.brands || []).map(b => ({ type: "marque", name: b, link: `/boutique/catalog?brand=${encodeURIComponent(b)}` })),
          ];
          setSugg(items);
        })
        .catch(() => setSugg([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const submit = (e) => {
    e?.preventDefault?.();
    if (q.trim()) nav(`/boutique/catalog?q=${encodeURIComponent(q.trim())}`);
    setOpen(false);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-[#b02a2a] text-white text-center text-xs py-1.5">Livraison 24h à Abidjan · Paiement à la livraison · WhatsApp 0777 92 61 79</div>
      <header className="sticky top-0 z-30 bg-white border-b border-[#ececec]">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center gap-3 md:gap-4">
          <Link to="/boutique" className="flex items-center gap-2 shrink-0" data-testid="storefront-logo">
            <div className="w-11 h-11 rounded-full bg-[#fde8e8] grid place-items-center font-serif text-[#b02a2a] font-bold">CD</div>
            <div className="font-serif text-xl text-[#b02a2a] hidden sm:block">Chez Dina</div>
          </Link>
          <nav className="hidden lg:flex items-center gap-5 text-sm text-[#1c1c1c] ml-2">
            <Link to="/boutique/catalog" data-testid="nav-catalog">Catalogue</Link>
            <Link to="/boutique/catalog?category=Chaussures">Talons</Link>
            <Link to="/boutique/catalog?category=Robes">Robes</Link>
            <Link to="/boutique/catalog?category=Sacs">Sacs</Link>
          </nav>
          <form onSubmit={submit} className="flex-1 max-w-xl relative" data-testid="storefront-search-form">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999] pointer-events-none" />
            <input
              type="search"
              className="w-full h-10 pl-9 pr-9 rounded-full border border-[#ececec] bg-[#fafafa] focus:bg-white focus:border-[#b02a2a] text-sm transition outline-none"
              placeholder="Rechercher un produit, une marque…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 180)}
              data-testid="storefront-search-input"
            />
            {q && (
              <button type="button" onClick={() => { setQ(""); setSugg([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999]" aria-label="Effacer"><X size={14}/></button>
            )}
            {open && sugg.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#ececec] rounded-xl shadow-lg py-2 z-40 max-h-80 overflow-y-auto" data-testid="search-suggestions">
                {sugg.slice(0, 8).map((s, i) => (
                  <Link
                    key={i}
                    to={s.link}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-[#fff5f5] text-sm"
                    onMouseDown={(e) => e.preventDefault()}
                    data-testid={`search-sugg-${i}`}
                  >
                    {s.image && <img src={s.image} alt="" className="w-7 h-7 rounded object-cover" />}
                    <span className="flex-1 truncate">{s.name}</span>
                    <span className="text-[10px] uppercase text-[#999]">{s.type}</span>
                  </Link>
                ))}
              </div>
            )}
          </form>
          <Link to="/boutique/account" className="w-9 h-9 grid place-items-center shrink-0" data-testid="storefront-account"><User size={18}/></Link>
          <Link to="/boutique/checkout" className="relative w-9 h-9 grid place-items-center shrink-0" data-testid="storefront-cart">
            <ShoppingBag size={18}/>
            {count>0 && <span className="absolute -top-1 -right-1 bg-[#b02a2a] text-white text-[10px] font-bold rounded-full w-4 h-4 grid place-items-center">{count}</span>}
          </Link>
        </div>
      </header>
      <Outlet />
      <a href="https://wa.me/2250777926179" target="_blank" rel="noreferrer" className="fixed bottom-5 right-5 bg-[#1f8a4c] text-white rounded-full w-14 h-14 grid place-items-center shadow-lg" data-testid="storefront-whatsapp"><MessageCircle size={22}/></a>
      <footer className="border-t border-[#ececec] mt-20 py-10 text-sm text-[#666] bg-[#fff5f5]">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-4 gap-6">
          <div><div className="font-serif text-xl text-[#b02a2a] mb-2">Chez Dina</div><p>Mode féminine · Abidjan.<br/>Livraison partout en Côte d'Ivoire.</p><div className="mt-3 text-xs">WhatsApp Business<br/><strong className="text-[#1c1c1c]">+225 07 77 92 61 79</strong></div></div>
          <div><div className="font-semibold text-[#1c1c1c] mb-2">Boutique</div><ul className="space-y-1"><li><Link to="/boutique/catalog">Catalogue</Link></li><li>Nouveautés</li><li>Promotions</li><li>Guide des tailles</li></ul></div>
          <div><div className="font-semibold text-[#1c1c1c] mb-2">Aide</div><ul className="space-y-1"><li>Livraison & retours</li><li>Suivi de commande</li><li>Contact</li></ul></div>
          <div><div className="font-semibold text-[#1c1c1c] mb-2">Suivez-nous</div><ul className="space-y-1"><li><a href="https://www.tiktok.com/@dinoush04" target="_blank" rel="noreferrer">TikTok @dinoush04</a></li><li><a href="https://wa.me/2250777926179" target="_blank" rel="noreferrer">WhatsApp</a></li></ul></div>
        </div>
        <div className="max-w-6xl mx-auto px-4 mt-8 text-xs text-[#999]">© 2026 Chez Dina · Abidjan</div>
      </footer>
    </div>
  );
}
