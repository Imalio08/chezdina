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
      <header className="sticky top-0 z-30 bg-white border-b border-[#ececec]">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link to="/boutique" className="font-serif text-2xl tracking-tight" data-testid="storefront-logo">Dina Store</Link>
          <nav className="hidden md:flex items-center gap-5 text-sm text-[#1c1c1c] ml-6">
            <Link to="/boutique/catalog" data-testid="nav-catalog">Catalogue</Link>
            <Link to="/boutique/catalog?category=Chaussures">Chaussures</Link>
            <Link to="/boutique/catalog?category=Robes">Robes</Link>
            <Link to="/boutique/catalog?category=Sacs">Sacs</Link>
          </nav>
          <div className="flex-1"/>
          <button onClick={()=>nav("/boutique/catalog")} className="w-9 h-9 grid place-items-center" data-testid="storefront-search"><Search size={18}/></button>
          <Link to="/boutique/account" className="w-9 h-9 grid place-items-center" data-testid="storefront-account"><User size={18}/></Link>
          <Link to="/boutique/checkout" className="relative w-9 h-9 grid place-items-center" data-testid="storefront-cart">
            <ShoppingBag size={18}/>
            {count>0 && <span className="absolute -top-1 -right-1 bg-[#f4b12c] text-[#1c1c1c] text-[10px] font-bold rounded-full w-4 h-4 grid place-items-center">{count}</span>}
          </Link>
        </div>
      </header>
      <Outlet />
      <a href="https://wa.me/2250700000000" target="_blank" rel="noreferrer" className="fixed bottom-5 right-5 bg-[#1f8a4c] text-white rounded-full w-14 h-14 grid place-items-center shadow-lg" data-testid="storefront-whatsapp"><MessageCircle size={22}/></a>
      <footer className="border-t border-[#ececec] mt-20 py-10 text-sm text-[#666]">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-4 gap-6">
          <div><div className="font-serif text-xl text-[#1c1c1c] mb-2">Dina Store</div><p>Mode féminine · Abidjan.<br/>Livraison dans toute la Côte d'Ivoire.</p></div>
          <div><div className="font-semibold text-[#1c1c1c] mb-2">Boutique</div><ul className="space-y-1"><li>Catalogue</li><li>Nouveautés</li><li>Promotions</li></ul></div>
          <div><div className="font-semibold text-[#1c1c1c] mb-2">Aide</div><ul className="space-y-1"><li>Livraison & retours</li><li>Guide des tailles</li><li>Contact</li></ul></div>
          <div><div className="font-semibold text-[#1c1c1c] mb-2">Suivez-nous</div><ul className="space-y-1"><li>Instagram</li><li>TikTok</li><li>WhatsApp</li></ul></div>
        </div>
        <div className="max-w-6xl mx-auto px-4 mt-8 text-xs text-[#999]">© 2026 Dina Store · Abidjan</div>
      </footer>
    </div>
  );
}
