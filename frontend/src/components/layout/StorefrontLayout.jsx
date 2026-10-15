import React, { useState, useEffect, useRef } from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { ShoppingBag, User, Search, MessageCircle, X, ChevronDown, LogOut, Package, MessageSquare, Heart, Ticket, Sun, Moon } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useCustomer } from "@/context/CustomerContext";
import useSiteTheme from "@/hooks/useSiteTheme";
import api from "@/lib/api";
import { FacebookLogo, WhatsappLogo, TiktokLogo } from "@/components/shared/BrandIcons";

const SOCIAL_ICONS = {
  facebook: FacebookLogo, tiktok: TiktokLogo, whatsapp: WhatsappLogo,
};

export default function StorefrontLayout() {
  useSiteTheme();
  const { cart, theme, setTheme } = useApp();
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

  // On first load with no stored pref, honor system preference (but still write it so toggle makes sense)
  useEffect(() => {
    if (!localStorage.getItem("dina_theme") && window.matchMedia) {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) setTheme("dark");
    }
    // First-party analytics: auto-opt-in anonymous events on first visit (no cookies, no 3rd party)
    if (!localStorage.getItem("dina_consent")) localStorage.setItem("dina_consent", "yes");
  }, [setTheme]);

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
    <div className="min-h-screen bg-white dark:bg-[#0f0f0f] text-[#1c1c1c] dark:text-[#f0f0f0]">
      <div className="bg-[#b02a2a] text-white text-center text-xs py-1.5">Livraison 24h à Abidjan · Paiement à la livraison · WhatsApp 0777 92 61 79</div>
      <header className="sticky top-0 z-30 bg-white dark:bg-[#141414] border-b border-[#ececec] dark:border-[#2a2a2a]">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-16 sm:h-20 flex items-center gap-1.5 sm:gap-3 md:gap-4">
          <Link to="/boutique" className="flex items-center gap-2 shrink-0" data-testid="storefront-logo">
            {site.logo ? (
              <>
                <img src={site.logo} alt={brandName} className="h-9 sm:h-11 max-w-[90px] sm:max-w-[120px] object-contain" data-testid="storefront-logo-img"/>
                <div className="font-serif text-lg text-[#b02a2a] leading-tight hidden sm:block">{brandName}</div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#fde8e8] grid place-items-center font-serif text-[#b02a2a] font-bold">{brandInitials}</div>
                <div className="font-serif text-xl text-[#b02a2a] hidden sm:block">{brandName}</div>
              </>
            )}
          </Link>
          <nav className="hidden lg:flex items-center gap-5 text-sm text-[#1c1c1c] dark:text-[#f0f0f0] ml-2">
            <Link to="/boutique/catalog" data-testid="nav-catalog">Catalogue</Link>
            <Link to="/boutique/catalog?category=Talons">Talons</Link>
            <Link to="/boutique/catalog?category=Sandales">Sandales</Link>
            <Link to="/boutique/catalog?category=Sacs à main">Sacs</Link>
            <Link to="/boutique/catalog?category=Pochettes">Pochettes</Link>
          </nav>
          <form onSubmit={submit} className="flex-1 min-w-0 max-w-xl relative" data-testid="storefront-search-form">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999] pointer-events-none" />
            <input
              type="search"
              className="w-full h-10 pl-9 pr-9 rounded-full border border-[#ececec] dark:border-[#2a2a2a] bg-[#fafafa] dark:bg-[#1a1a1a] text-[#1c1c1c] dark:text-[#f0f0f0] focus:bg-white dark:focus:bg-[#242424] focus:border-[#b02a2a] text-sm transition outline-none"
              placeholder="Rechercher…"
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
              <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-[#1a1a1a] border border-[#ececec] dark:border-[#2a2a2a] rounded-xl shadow-lg py-2 z-40 max-h-80 overflow-y-auto" data-testid="search-suggestions">
                {sugg.slice(0, 8).map((s, i) => (
                  <Link
                    key={i}
                    to={s.link}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-[#fff5f5] dark:hover:bg-[#2a1818] text-sm"
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
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-9 h-9 hidden sm:grid place-items-center shrink-0 rounded-full hover:bg-[#fafafa] dark:hover:bg-[#1a1a1a] transition"
            data-testid="storefront-theme-toggle"
            title={theme === "dark" ? "Mode clair" : "Mode sombre"}
            aria-label={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
          >
            {theme === "dark" ? <Sun size={18} className="text-[#f4b12c]"/> : <Moon size={18}/>}
          </button>
          {customer ? (
            <div ref={umRef} className="relative shrink-0">
              <button onClick={(e) => { e.stopPropagation(); setUserMenu(v => !v); }} className="h-9 pl-2 pr-2 rounded-full hover:bg-[#fafafa] dark:hover:bg-[#1a1a1a] flex items-center gap-1.5 text-sm" data-testid="storefront-user-menu">
                {customer.photo ? (
                  <img src={customer.photo} alt="" className="w-7 h-7 rounded-full object-cover"/>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#fde8e8] dark:bg-[#2a1818] text-[#b02a2a] font-semibold grid place-items-center text-xs">{(customer.name || "D")[0]}</div>
                )}
                <span className="hidden md:inline font-medium text-[#1c1c1c] dark:text-[#f0f0f0]">Bonjour, {(customer.name || "").split(" ")[0]}</span>
                <ChevronDown size={14} className="text-[#666] dark:text-[#999]"/>
              </button>
              {userMenu && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-[#1a1a1a] border border-[#ececec] dark:border-[#2a2a2a] rounded-xl shadow-lg py-1 z-40" data-testid="user-dropdown" onClick={() => setUserMenu(false)}>
                  <Link to="/boutique/compte" className="flex items-center gap-2 px-3 py-2 hover:bg-[#fff5f5] dark:hover:bg-[#2a1818] text-sm" data-testid="menu-account"><User size={14}/>Mon compte</Link>
                  <Link to="/boutique/compte/commandes" className="flex items-center gap-2 px-3 py-2 hover:bg-[#fff5f5] dark:hover:bg-[#2a1818] text-sm" data-testid="menu-orders"><Package size={14}/>Mes commandes</Link>
                  <Link to="/boutique/compte/messages" className="flex items-center gap-2 px-3 py-2 hover:bg-[#fff5f5] dark:hover:bg-[#2a1818] text-sm" data-testid="menu-messages"><MessageSquare size={14}/>Messages</Link>
                  <Link to="/boutique/compte/favoris" className="flex items-center gap-2 px-3 py-2 hover:bg-[#fff5f5] dark:hover:bg-[#2a1818] text-sm" data-testid="menu-favorites"><Heart size={14}/>Favoris</Link>
                  <Link to="/boutique/compte/bons-achat" className="flex items-center gap-2 px-3 py-2 hover:bg-[#fff5f5] dark:hover:bg-[#2a1818] text-sm" data-testid="menu-vouchers"><Ticket size={14}/>Bons d'achat</Link>
                  <div className="border-t border-[#f0f0f0] dark:border-[#2a2a2a] my-1"></div>
                  <button onClick={() => { logout(); nav("/boutique"); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#fff5f5] dark:hover:bg-[#2a1818] text-sm text-[#c62828]" data-testid="menu-logout-header"><LogOut size={14}/>Déconnexion</button>
                </div>
              )}
            </div>
          ) : (
            <div className="relative shrink-0">
              <button onClick={() => setUserMenu(!userMenu)} className="w-9 h-9 grid place-items-center" data-testid="storefront-account" aria-label="Mon compte"><User size={18}/></button>
              {userMenu && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-[#1a1a1a] border border-[#ececec] dark:border-[#2a2a2a] rounded-xl shadow-lg p-2 z-40 space-y-1" data-testid="guest-dropdown" onClick={() => setUserMenu(false)}>
                  <Link to="/boutique/compte" className="dina-btn-primary w-full !min-h-[38px] text-sm justify-center" data-testid="guest-login">Se connecter</Link>
                  <Link to="/boutique/compte?mode=inscription" className="dina-btn-secondary w-full !min-h-[38px] text-sm justify-center" data-testid="guest-signup">Créer un compte</Link>
                  <div className="text-[10px] text-[#999] text-center pt-1">Suivi de commandes, adresses, fidélité</div>
                </div>
              )}
            </div>
          )}
          <Link to="/boutique/checkout" className="relative w-9 h-9 grid place-items-center shrink-0" data-testid="storefront-cart">
            <ShoppingBag size={18}/>
            {count>0 && <span className="absolute -top-1 -right-1 bg-[#b02a2a] text-white text-[10px] font-bold rounded-full w-4 h-4 grid place-items-center">{count}</span>}
          </Link>
        </div>
      </header>
      <Outlet />
      <a href={`https://wa.me/${(biz.whatsapp || "+2250777926179").replace(/\D/g,"")}`} target="_blank" rel="noreferrer" className="fixed bottom-5 right-5 bg-white rounded-full w-14 h-14 grid place-items-center shadow-xl hover:shadow-2xl transition hover:scale-105" data-testid="storefront-whatsapp" aria-label="Nous écrire sur WhatsApp Business"><WhatsappLogo size={30}/></a>
      <footer className="border-t border-[#ececec] dark:border-[#2a2a2a] mt-20 py-10 text-sm text-[#666] dark:text-[#aaa] bg-[#fff5f5] dark:bg-[#141414]">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-4 gap-6">
          <div>
            {site.logo ? (
              <div className="flex items-center gap-2 mb-2">
                <img src={site.logo} alt={brandName} className="h-10 object-contain"/>
                <span className="font-serif text-xl text-[#b02a2a]" data-testid="footer-brand-name">{brandName}</span>
              </div>
            ) : (
              <div className="font-serif text-xl text-[#b02a2a] mb-2" data-testid="footer-brand-name">{brandName}</div>
            )}
            <p>{biz.tagline || "Mode féminine · Abidjan."}<br/>Livraison partout en Côte d'Ivoire.</p>
            <div className="mt-3 text-xs">WhatsApp Business<br/><strong className="text-[#1c1c1c] dark:text-[#f0f0f0]">{biz.whatsapp || "+225 07 77 92 61 79"}</strong></div>
          </div>
          <div><div className="font-semibold text-[#1c1c1c] dark:text-[#f0f0f0] mb-2">Boutique</div><ul className="space-y-1"><li><Link to="/boutique/catalog">Catalogue</Link></li><li><Link to="/boutique/nouveautes">Nouveautés</Link></li><li><Link to="/boutique/promotions">Promotions</Link></li><li><Link to="/boutique/guide-tailles">Guide des tailles</Link></li></ul></div>
          <div><div className="font-semibold text-[#1c1c1c] dark:text-[#f0f0f0] mb-2">Aide</div><ul className="space-y-1"><li><Link to="/boutique/livraison-retours">Livraison & retours</Link></li><li><Link to="/boutique/suivi-commande">Suivi de commande</Link></li><li><Link to="/boutique/contact">Contact</Link></li></ul></div>
          <div>
            <div className="font-semibold text-[#1c1c1c] dark:text-[#f0f0f0] mb-2">Suivez-nous</div>
            <ul className="space-y-2">
              <li><a href={social.facebook || "https://www.facebook.com/chezdina"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-[#b02a2a]" data-testid="footer-social-facebook"><FacebookLogo size={18}/><span>Facebook</span></a></li>
              <li><a href={`https://wa.me/${(biz.whatsapp || "+2250777926179").replace(/\D/g,"")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-[#b02a2a]" data-testid="footer-social-whatsapp"><WhatsappLogo size={18}/><span>WhatsApp Business</span></a></li>
              <li><a href={social.tiktok || "https://www.tiktok.com/@dinoush04"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-[#b02a2a]" data-testid="footer-social-tiktok"><TiktokLogo size={18}/><span>TikTok</span></a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 mt-8 text-xs text-[#999]">© 2026 Chez Dina · Abidjan</div>
      </footer>
    </div>
  );
}
