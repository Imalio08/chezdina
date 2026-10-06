import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { Truck, Shield, MessageCircle, ChevronRight, Gift, Sparkles } from "lucide-react";

const ICONS = { truck: Truck, shield: Shield, whatsapp: MessageCircle, gift: Gift, sparkles: Sparkles };

function Countdown({ endsAt }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 1000); return () => clearInterval(t); }, []);
  const ms = new Date(endsAt) - new Date();
  if (ms <= 0) return null;
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const B = ({ v, l }) => <span className="inline-flex flex-col items-center bg-white/15 rounded-lg px-2 py-1 min-w-[42px]"><span className="font-bold tabular text-lg leading-none">{String(v).padStart(2, "0")}</span><span className="text-[9px] uppercase opacity-70">{l}</span></span>;
  return <div className="flex gap-1.5 items-center" data-testid="flash-countdown">{d > 0 && <B v={d} l="j" />}<B v={h} l="h" /><B v={m} l="min" /><B v={s} l="s" /></div>;
}

function Hero({ props, idx }) {
  const mosaic = props.mosaic || [];
  return (
    <section className="bg-[#fff5f5]">
      <div className="max-w-6xl mx-auto px-4 py-14 lg:py-20 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          {props.tagline && <div className="text-[#b02a2a] text-xs font-semibold tracking-widest uppercase mb-3">{props.tagline}</div>}
          <h1 className="font-serif text-4xl lg:text-6xl leading-[1.05] text-[#1c1c1c]">{props.title}<br /><span className="text-[#b02a2a] italic">{props.highlight}</span></h1>
          <p className="text-[#666] mt-5 max-w-md leading-relaxed">{props.subtitle}</p>
          <div className="flex gap-3 mt-6">
            <Link to={props.cta_link || "/boutique/catalog"} className="dina-btn-primary" data-testid="home-shop-now">{props.cta_label || "Découvrir"} <ChevronRight size={16} /></Link>
            <a href="https://wa.me/2250777926179" target="_blank" rel="noreferrer" className="dina-btn-secondary"><MessageCircle size={16} />WhatsApp</a>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 relative">
          {mosaic.map((src, i) => (
            <div key={i} className={`relative overflow-hidden rounded-2xl bg-[#fde8e8] ${i === 0 ? "aspect-[3/4]" : i === 1 ? "aspect-square mt-6" : i === 2 ? "aspect-square" : "aspect-[3/4] -mt-6"}`}>
              <img src={src} alt="" className={`w-full h-full object-cover transition-transform duration-700 ${idx === i ? "scale-105" : "scale-100"}`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductGrid({ props, products }) {
  const limit = props.limit || 8;
  const items = products.slice(0, limit);
  return (
    <section className="max-w-6xl mx-auto px-4 py-14">
      <div className="flex items-end justify-between mb-6">
        <div>{props.eyebrow && <div className="text-xs tracking-widest uppercase text-[#b02a2a]">{props.eyebrow}</div>}<h2 className="font-serif text-3xl mt-1">{props.title}</h2></div>
        <Link to="/boutique/catalog" className="text-sm underline">Voir tout</Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map(p => (
          <Link key={p.id} to={`/boutique/product/${p.id}`} className="group" data-testid={`storefront-product-${p.id}`}>
            <div className="aspect-[4/5] bg-[#fff5f5] rounded-xl overflow-hidden"><img src={p.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" /></div>
            <div className="mt-2"><div className="text-xs text-[#b02a2a] uppercase tracking-wide">{p.category}</div><div className="text-sm font-medium truncate">{p.name}</div><div className="flex items-center justify-between mt-0.5"><div className="tabular font-semibold text-sm">{fcfa(p.price)}</div>{p.rating_avg > 0 && <div className="text-xs text-[#666] flex items-center gap-0.5"><span className="text-[#f4b12c]">★</span>{p.rating_avg}</div>}</div></div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function TrustStrip({ props }) {
  return (
    <section className="bg-[#1c1c1c] text-white">
      <div className="max-w-6xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-6">
        {(props.items || []).map((it, i) => {
          const Icon = ICONS[it.icon] || Shield;
          return <div key={i} className="flex gap-3"><Icon className="text-[#b02a2a] shrink-0" /><div><div className="font-serif text-lg">{it.title}</div><div className="text-sm text-[#bbb] mt-1">{it.text}</div></div></div>;
        })}
      </div>
    </section>
  );
}

function Banner({ props }) {
  return (
    <section style={{ backgroundImage: `url(${props.image || ""})`, backgroundSize: "cover", backgroundPosition: "center" }} className="relative">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative max-w-6xl mx-auto px-4 py-20 lg:py-28 text-white text-center">
        <h2 className="font-serif text-4xl lg:text-5xl">{props.title}</h2>
        {props.subtitle && <p className="opacity-90 mt-3 max-w-2xl mx-auto">{props.subtitle}</p>}
        {props.cta_label && <Link to={props.cta_link || "/boutique/catalog"} className="dina-btn-primary mt-6 inline-flex">{props.cta_label}</Link>}
      </div>
    </section>
  );
}

function TextBlock({ props }) {
  return (
    <section className="max-w-3xl mx-auto px-4 py-10 text-center">
      {props.eyebrow && <div className="text-xs tracking-widest uppercase text-[#b02a2a] mb-2">{props.eyebrow}</div>}
      <h2 className="font-serif text-3xl mb-3">{props.title}</h2>
      <p className="text-[#666] leading-relaxed whitespace-pre-line">{props.text}</p>
    </section>
  );
}

function Newsletter({ props }) {
  return (
    <section className="bg-[#fff5f5]">
      <div className="max-w-2xl mx-auto px-4 py-14 text-center">
        <Sparkles className="mx-auto text-[#b02a2a] mb-3" />
        <h2 className="font-serif text-3xl">{props.title || "Restez dans la boucle"}</h2>
        <p className="text-[#666] mt-2">{props.subtitle || "Les ventes flash et nouveautés directement sur votre WhatsApp."}</p>
        <a href="https://wa.me/2250777926179?text=Je%20veux%20recevoir%20les%20nouveaut%C3%A9s%20Chez%20Dina" target="_blank" rel="noreferrer" className="dina-btn-primary mt-5 inline-flex">S'inscrire via WhatsApp</a>
      </div>
    </section>
  );
}

export default function Home() {
  const [sections, setSections] = useState([]);
  const [products, setProducts] = useState([]);
  const [flash, setFlash] = useState(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    api.get("/public/storefront/sections").then(r => setSections(r.data || [])).catch(() => { });
    api.get("/public/products").then(r => setProducts(r.data));
    api.get("/public/promotions").then(r => {
      const f = (r.data || []).find(p => p.flash && p.ends_at);
      if (f) setFlash(f);
    }).catch(() => { });
  }, []);
  useEffect(() => { const t = setInterval(() => setIdx(i => (i + 1) % 4), 4000); return () => clearInterval(t); }, []);

  return (
    <div>
      {flash && (
        <div className="bg-gradient-to-r from-[#b02a2a] via-[#d94848] to-[#b02a2a] text-white px-4 py-3" data-testid="flash-banner">
          <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl animate-pulse">⚡</span>
              <div>
                <div className="font-serif text-lg">Vente flash — Code <span className="font-mono bg-white/20 px-2 rounded">{flash.code}</span></div>
                <div className="text-xs opacity-90">{flash.type === "percent" ? `-${flash.value}% sur toute la boutique` : flash.type === "free_delivery" ? "Livraison offerte" : ""}</div>
              </div>
            </div>
            <Countdown endsAt={flash.ends_at} />
          </div>
        </div>
      )}
      {sections.map(sec => {
        if (!sec.enabled) return null;
        const key = sec.id;
        if (sec.type === "hero") return <Hero key={key} props={sec.props || {}} idx={idx} />;
        if (sec.type === "product_grid") return <ProductGrid key={key} props={sec.props || {}} products={products} />;
        if (sec.type === "trust_strip") return <TrustStrip key={key} props={sec.props || {}} />;
        if (sec.type === "banner") return <Banner key={key} props={sec.props || {}} />;
        if (sec.type === "text_block") return <TextBlock key={key} props={sec.props || {}} />;
        if (sec.type === "newsletter") return <Newsletter key={key} props={sec.props || {}} />;
        return null;
      })}
    </div>
  );
}
