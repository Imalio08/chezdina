import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { fcfa, siteLink } from "@/lib/format";
import ProductCardV2 from "@/components/storefront/ProductCardV2";
import { track } from "@/lib/analytics";
import WelcomePopup from "@/components/storefront/WelcomePopup";
import MosaicSection from "@/components/storefront/MosaicSection";
import { Truck, Shield, MessageCircle, ChevronRight, Clock, Sparkles, Flame } from "lucide-react";
import SmartImage from "@/components/shared/SmartImage";

function Countdown({ ends }) {
  const [, setT] = useState(0);
  useEffect(() => { const i = setInterval(() => setT(x => x + 1), 1000); return () => clearInterval(i); }, []);
  const ms = new Date(ends) - new Date();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  const B = ({ v, l }) => <span className="inline-flex flex-col bg-white/15 rounded px-1.5 py-0.5 min-w-[36px] items-center"><span className="font-bold tabular text-base leading-none">{String(v).padStart(2, "0")}</span><span className="text-[8px] uppercase opacity-70">{l}</span></span>;
  return <div className="flex gap-1" data-testid="flash-countdown"><B v={h} l="h" /><B v={m} l="min" /><B v={s} l="s" /></div>;
}

function Row({ title, products, link, eyebrow }) {
  const scrollRef = useRef();
  if (!products.length) return null;
  return (
    <section className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-end justify-between mb-4">
        <div>{eyebrow && <div className="text-[10px] uppercase tracking-widest text-[#b02a2a]">{eyebrow}</div>}<h2 className="font-serif text-2xl md:text-3xl mt-0.5">{title}</h2></div>
        {link && <Link to={link} className="text-xs underline flex items-center gap-1">Voir plus <ChevronRight size={12} /></Link>}
      </div>
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto scrollbar-thin snap-x snap-mandatory -mx-4 px-4 pb-2" data-testid={`row-${(title || "").toLowerCase().replace(/\s/g, "-")}`}>
        {products.slice(0, 12).map(p => <div key={p.id} className="snap-start shrink-0 w-[45%] md:w-[23%]"><ProductCardV2 product={p} /></div>)}
      </div>
    </section>
  );
}

export default function Home() {
  const [products, setProducts] = useState([]);
  const [sections, setSections] = useState([]);
  const [flash, setFlash] = useState(null);
  const [bestSellers, setBest] = useState([]);
  const [lookbook, setLookbook] = useState([]);
  const [announcement, setAnn] = useState({});
  const [heroIdx, setHeroIdx] = useState(0);

  useEffect(() => {
    track("page_view", { page_type: "home" });
    api.get("/public/products").then(r => setProducts(r.data));
    api.get("/public/storefront/sections").then(r => setSections(r.data || []));
    api.get("/public/promotions").then(r => { const f = (r.data || []).find(p => p.flash && p.ends_at && new Date(p.ends_at) > new Date()); if (f) setFlash(f); });
    api.get("/public/best-sellers?limit=12").then(r => setBest(r.data)).catch(() => { });
    api.get("/public/lookbook").then(r => setLookbook(r.data)).catch(() => { });
    api.get("/public/announcement").then(r => setAnn(r.data || {})).catch(() => { });
  }, []);
  useEffect(() => { const t = setInterval(() => setHeroIdx(i => (i + 1) % Math.max(4, 1)), 5000); return () => clearInterval(t); }, []);

  const nouveautes = [...products].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")).slice(0, 12);
  const bonsPlans = [...products].filter(p => p.compare_at > p.price).sort((a, b) => (b.compare_at - b.price) / b.compare_at - (a.compare_at - a.price) / a.compare_at).slice(0, 12);
  const byCat = (c) => products.filter(p => p.category === c).slice(0, 12);
  const categories = [...new Set(products.map(p => p.category))];
  const heroSec = sections.find(s => s.type === "hero");

  return (
    <div>
      {announcement.enabled && (
        <div className="bg-[#1c1c1c] text-white text-xs text-center py-2 px-4" data-testid="announcement">
          {announcement.text} {announcement.ends_at && <span className="ml-2"><Countdown ends={announcement.ends_at} /></span>}
        </div>
      )}

      {heroSec && <HeroCarousel props={heroSec.props || {}} idx={heroIdx} />}

      {flash && (
        <section className="bg-gradient-to-r from-[#b02a2a] via-[#d94848] to-[#b02a2a] text-white py-6" data-testid="flash-sale">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <div className="flex items-center gap-2"><Flame size={22} className="animate-pulse" /><div><div className="font-serif text-xl">Vente flash</div><div className="text-xs opacity-80">Code <span className="font-mono bg-white/20 px-1.5 rounded">{flash.code}</span> · {flash.type === "percent" ? `-${flash.value}%` : "Livraison offerte"}</div></div></div>
              <Countdown ends={flash.ends_at} />
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-thin snap-x -mx-4 px-4 pb-1">
              {bonsPlans.slice(0, 10).map(p => <div key={p.id} className="snap-start shrink-0 w-[45%] md:w-[20%]"><ProductCardV2 product={p} flashEndsAt={flash.ends_at} /></div>)}
            </div>
          </div>
        </section>
      )}

      <section className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="font-serif text-2xl mb-4">Nos catégories</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3" data-testid="categories">
          {categories.slice(0, 6).map(c => {
            const img = products.find(p => p.category === c)?.image;
            return <Link key={c} to={`/catalog?cat=${encodeURIComponent(c)}`} className="group">
              <div className="aspect-square bg-[#fff5f5] dark:bg-[#2a1818] rounded-xl overflow-hidden"><SmartImage src={img} alt={c} fallbackText={c} className="w-full h-full object-cover group-hover:scale-105 transition" /></div>
              <div className="text-center text-xs mt-1.5 font-semibold">{c}</div>
            </Link>;
          })}
        </div>
      </section>

      <Row title="Bons plans" eyebrow="Promotions" products={bonsPlans} link="/bons-plans" />
      <Row title="Nouveautés" eyebrow="Fraîchement arrivé" products={nouveautes} link="/catalog?sort=new" />

      {categories.slice(0, 4).map(c => <Row key={c} title={c} products={byCat(c)} link={`/catalog?cat=${encodeURIComponent(c)}`} />)}

      {lookbook.length > 0 && lookbook[0].product_ids?.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-10">
          <div className="text-[10px] uppercase tracking-widest text-[#b02a2a]">Lookbook</div>
          <h2 className="font-serif text-2xl md:text-3xl mt-0.5 mb-6">Complétez le look</h2>
          <div className="grid md:grid-cols-[1.3fr_1fr] gap-6 items-center">
            <div className="aspect-[4/5] md:aspect-[3/4] rounded-2xl overflow-hidden"><SmartImage src={lookbook[0].image} alt="Lookbook" fallbackText="Lookbook" className="w-full h-full object-cover" /></div>
            <div className="grid grid-cols-2 gap-3">
              {lookbook[0].product_ids.map(pid => { const p = products.find(x => x.id === pid); return p ? <ProductCardV2 key={pid} product={p} /> : null; })}
            </div>
          </div>
        </section>
      )}

      <Row title="Meilleures ventes" eyebrow="Les plus aimés" products={bestSellers} />

      <section className="bg-[#1c1c1c] dark:bg-black text-white py-12 mt-6">
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-4 gap-6" data-testid="trust-band">
          {[
            { i: Truck, t: "Livraison partout à Abidjan", s: "24h sous conditions" },
            { i: Shield, t: "Paiement à la livraison", s: "Espèces, Wave ou carte" },
            { i: Sparkles, t: "Échange sous 48h", s: "Articles non portés" },
            { i: MessageCircle, t: "Commande sur WhatsApp", s: "0777 92 61 79" },
          ].map((x, i) => <div key={i} className="flex gap-3"><x.i size={22} className="text-[#b02a2a] shrink-0" /><div><div className="font-serif text-base">{x.t}</div><div className="text-xs text-[#aaa] mt-0.5">{x.s}</div></div></div>)}
        </div>
      </section>

      <a href="https://wa.me/2250777926179" target="_blank" rel="noreferrer" className="fixed bottom-6 right-6 w-14 h-14 bg-[#25d366] rounded-full grid place-items-center shadow-xl z-40 hover:scale-110 transition" data-testid="float-wa"><MessageCircle size={24} className="text-white" /></a>

      <WelcomePopup />
    </div>
  );
}

function HeroCarousel({ props }) {
  const images = (props.mosaic || []).filter(Boolean);
  const col1 = images.filter((_, i) => i % 2 === 0);
  const col2 = images.filter((_, i) => i % 2 === 1);
  return (
    <section className="relative bg-[#fff5f5] dark:bg-[#2a1818] overflow-hidden" data-testid="hero-carousel">
      <div className="max-w-7xl mx-auto px-4 py-10 md:py-16 grid md:grid-cols-2 gap-8 items-center">
        <div>
          {props.tagline && <div className="text-xs uppercase tracking-widest text-[#b02a2a] font-semibold mb-3">{props.tagline}</div>}
          <h1 className="font-serif text-4xl md:text-6xl leading-[1.05]">{props.title}<br /><span className="italic text-[#b02a2a]">{props.highlight}</span></h1>
          <p className="text-[#666] dark:text-[#aaa] mt-4 max-w-md leading-relaxed">{props.subtitle}</p>
          <Link to={siteLink(props.cta_link) || "/catalog"} className="dina-btn-primary mt-5 inline-flex" data-testid="hero-cta">{props.cta_label || "J'achète"} <ChevronRight size={16} /></Link>
        </div>
        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-3 h-[520px] md:h-[560px] overflow-hidden" data-testid="hero-mosaic">
            <HeroColumn images={col1} direction="up" speed={18} />
            <HeroColumn images={col2.length ? col2 : col1} direction="up" speed={22} offset />
          </div>
        )}
      </div>
    </section>
  );
}

function HeroColumn({ images, speed = 20, offset = false }) {
  const trackRef = useRef(null);
  const posRef = useRef(offset ? -120 : 0);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !trackRef.current) return;
    let raf, last = performance.now();
    const half = () => (trackRef.current ? trackRef.current.scrollHeight / 2 : 0);
    const step = (now) => {
      const dt = (now - last) / 1000; last = now;
      posRef.current += speed * dt;
      const h = half();
      if (h && posRef.current >= h) posRef.current -= h;
      if (trackRef.current) trackRef.current.style.transform = `translate3d(0, ${-posRef.current}px, 0)`;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [images.length, speed]);
  if (!images.length) return null;
  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div ref={trackRef} className="will-change-transform">
        {[0, 1].map(dup => (
          <div key={dup}>
            {images.map((src, i) => (
              <div key={`${dup}-${i}`} className={`${i % 3 === 0 ? "aspect-[3/4]" : i % 3 === 1 ? "aspect-[4/5]" : "aspect-square"} rounded-2xl overflow-hidden mb-3 bg-[#eee]`}>
                <SmartImage src={src} alt="" fallbackIcon className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
