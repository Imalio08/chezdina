import React, { useState, useEffect, useRef } from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { ShoppingBag, User, Search, MessageCircle, X, ChevronDown, LogOut, Package, MessageSquare, Heart, Ticket, Facebook, Instagram, Youtube, Linkedin, Hash, Share2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useCustomer } from "@/context/CustomerContext";
import useSiteTheme from "@/hooks/useSiteTheme";
import api from "@/lib/api";

const SOCIAL_ICONS = {
  facebook: Facebook, instagram: Instagram, tiktok: Hash,
  whatsapp: Share2, snapchat: Share2, youtube: Youtube, linkedin: Linkedin,
};

export default function StorefrontLayout() {
  useSiteTheme();
  const { cart } = useApp();
  const { customer, logout } = useCustomer();
  const count = cart.reduce((s,x)=>s+x.qty,0);
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [sugg, setSugg] = useState([]);
  const [open, setOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [social, setSocial] = useState({});
  const [site, setSite] = useState({});
  const [biz, setBiz] = useState({});
  const umRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (umRef.current && !umRef.current.contains(e.target)) setUserMenu(false); };
    window.addEventListener("click", onClick);
    api.get("/public/site").then(r => {
      const d = r.data || {};
      setSocial(d.social || {});
      setSite(d);
      // Inject favicon if provided
      if (d.favicon) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
        link.href = d.favicon;
      }
    }).catch(() => {});
    api.get("/public/business").then(r => setBiz(r.data || {})).catch(() => {});
    return () => window.removeEventListener("click", onClick);
  }, []);

  const brandName = biz.name || site.name || "Chez Dina";
  const brandInitials = (brandName.split(" ").map(w => w[0]).join("").slice(0, 2) || "CD").toUpperCase();

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
            {site.logo ? (
              <img src={site.logo} alt={brandName} className="h-11 max-w-[160px] object-contain" data-testid="storefront-logo-img"/>
            ) : (
              <>
                <div className="w-11 h-11 rounded-full bg-[#fde8e8] grid place-items-center font-serif text-[#b02a2a] font-bold">{brandInitials}</div>
                <div className="font-serif text-xl text-[#b02a2a] hidden sm:block">{brandName}</div>
              </>
            )}
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
          {customer ? (
            <div ref={umRef} className="relative shrink-0">
              <button onClick={(e) => { e.stopPropagation(); setUserMenu(v => !v); }} className="h-9 pl-2 pr-2 rounded-full hover:bg-[#fafafa] flex items-center gap-1.5 text-sm" data-testid="storefront-user-menu">
                {customer.photo ? (
                  <img src={customer.photo} alt="" className="w-7 h-7 rounded-full object-cover"/>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#fde8e8] text-[#b02a2a] font-semibold grid place-items-center text-xs">{(customer.name || "D")[0]}</div>
                )}
                <span className="hidden md:inline font-medium text-[#1c1c1c]">Bonjour, {(customer.name || "").split(" ")[0]}</span>
                <ChevronDown size={14} className="text-[#666]"/>
              </button>
              {userMenu && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-[#ececec] rounded-xl shadow-lg py-1 z-40" data-testid="user-dropdown" onClick={() => setUserMenu(false)}>
                  <Link to="/boutique/compte" className="flex items-center gap-2 px-3 py-2 hover:bg-[#fff5f5] text-sm" data-testid="menu-account"><User size={14}/>Mon compte</Link>
                  <Link to="/boutique/compte/commandes" className="flex items-center gap-2 px-3 py-2 hover:bg-[#fff5f5] text-sm" data-testid="menu-orders"><Package size={14}/>Mes commandes</Link>
                  <Link to="/boutique/compte/messages" className="flex items-center gap-2 px-3 py-2 hover:bg-[#fff5f5] text-sm" data-testid="menu-messages"><MessageSquare size={14}/>Messages</Link>
                  <Link to="/boutique/compte/favoris" className="flex items-center gap-2 px-3 py-2 hover:bg-[#fff5f5] text-sm" data-testid="menu-favorites"><Heart size={14}/>Favoris</Link>
                  <Link to="/boutique/compte/bons-achat" className="flex items-center gap-2 px-3 py-2 hover:bg-[#fff5f5] text-sm" data-testid="menu-vouchers"><Ticket size={14}/>Bons d'achat</Link>
                  <div className="border-t border-[#f0f0f0] my-1"></div>
                  <button onClick={() => { logout(); nav("/boutique"); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#fff5f5] text-sm text-[#c62828]" data-testid="menu-logout-header"><LogOut size={14}/>Déconnexion</button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/boutique/compte" className="w-9 h-9 grid place-items-center shrink-0" data-testid="storefront-account"><User size={18}/></Link>
          )}
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
          <div>
            {site.logo ? <img src={site.logo} alt={brandName} className="h-10 object-contain mb-2"/> : <div className="font-serif text-xl text-[#b02a2a] mb-2">{brandName}</div>}
            <p>{biz.tagline || "Mode féminine · Abidjan."}<br/>Livraison partout en Côte d'Ivoire.</p>
            <div className="mt-3 text-xs">WhatsApp Business<br/><strong className="text-[#1c1c1c]">{biz.whatsapp || "+225 07 77 92 61 79"}</strong></div>
          </div>
          <div><div className="font-semibold text-[#1c1c1c] mb-2">Boutique</div><ul className="space-y-1"><li><Link to="/boutique/catalog">Catalogue</Link></li><li>Nouveautés</li><li>Promotions</li><li>Guide des tailles</li></ul></div>
          <div><div className="font-semibold text-[#1c1c1c] mb-2">Aide</div><ul className="space-y-1"><li>Livraison & retours</li><li>Suivi de commande</li><li>Contact</li></ul></div>
          <div><div className="font-semibold text-[#1c1c1c] mb-2">Suivez-nous</div><ul className="space-y-1">
            {Object.entries(social).filter(([k,v])=>v).map(([k,v])=>{
              const Icon = SOCIAL_ICONS[k] || Share2;
              return <li key={k}><a href={v} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-[#b02a2a]" data-testid={`footer-social-${k}`}><Icon size={12}/>{k.charAt(0).toUpperCase()+k.slice(1)}</a></li>;
            })}
            {!Object.values(social).some(v=>v) && <li><a href="https://www.tiktok.com/@dinoush04" target="_blank" rel="noreferrer">TikTok @dinoush04</a></li>}
          </ul></div>
        </div>
        <div className="max-w-6xl mx-auto px-4 mt-8 text-xs text-[#999]">© 2026 Chez Dina · Abidjan</div>
      </footer>
    </div>
  );
}
