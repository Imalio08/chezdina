import React from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { ShoppingBag, User, Search, MessageCircle } from "lucide-react";
import { useApp } from "@/context/AppContext";

export default function StorefrontLayout() {
  const { cart } = useApp();
  const count = cart.reduce((s,x)=>s+x.qty,0);
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-white">
      <div className="bg-[#b02a2a] text-white text-center text-xs py-1.5">Livraison 24h à Abidjan · Paiement à la livraison · WhatsApp 0777 92 61 79</div>
      <header className="sticky top-0 z-30 bg-white border-b border-[#ececec]">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center gap-4">
          <Link to="/boutique" className="flex items-center gap-2" data-testid="storefront-logo">
            <div className="w-11 h-11 rounded-full bg-[#fde8e8] grid place-items-center font-serif text-[#b02a2a] font-bold">CD</div>
            <div className="leading-tight"><div className="font-serif text-xl text-[#b02a2a]">Chez Dina</div><div className="text-[10px] uppercase tracking-widest text-[#666]">boutique</div></div>
          </Link>
          <nav className="hidden md:flex items-center gap-5 text-sm text-[#1c1c1c] ml-6">
            <Link to="/boutique/catalog" data-testid="nav-catalog">Catalogue</Link>
            <Link to="/boutique/catalog?category=Chaussures">Talons & Chaussures</Link>
            <Link to="/boutique/catalog?category=Robes">Robes</Link>
            <Link to="/boutique/catalog?category=Sacs">Sacs</Link>
            <Link to="/boutique/catalog?category=Accessoires">Accessoires</Link>
          </nav>
          <div className="flex-1"/>
          <button onClick={()=>nav("/boutique/catalog")} className="w-9 h-9 grid place-items-center" data-testid="storefront-search"><Search size={18}/></button>
          <Link to="/boutique/account" className="w-9 h-9 grid place-items-center" data-testid="storefront-account"><User size={18}/></Link>
          <Link to="/boutique/checkout" className="relative w-9 h-9 grid place-items-center" data-testid="storefront-cart">
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
