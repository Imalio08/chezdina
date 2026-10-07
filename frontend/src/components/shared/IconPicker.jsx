import React, { useMemo, useState } from "react";
import {
  Truck, Shield, MessageCircle, Star, Heart, Gift, Package, Clock, CreditCard, Lock,
  Award, Zap, Flame, Sparkles, Tag, Percent, ShoppingBag, ShoppingCart, CheckCircle2,
  Phone, Mail, MapPin, Store, Users, UserCheck, Smile, ThumbsUp, Headphones,
  Facebook, Instagram, Youtube, Linkedin, Hash, Share2, Globe, Bell, Camera,
  Image as ImageIcon, Video, Mic, Calendar, Sun, Moon, Palette,
  Scissors, Shirt, Watch, Diamond, Crown, Flower, Leaf, RefreshCw,
  Repeat, Timer, TrendingUp, Target, Trophy, Medal, Rocket, Lightbulb, Search,
  Wallet, Receipt, Banknote, Coins, PiggyBank, Gem, Smartphone,
  QrCode, BookOpen, Megaphone
} from "lucide-react";

// Curated icon library mapped by friendly keys
export const ICON_MAP = {
  truck: { Icon: Truck, label: "Livraison / Camion" },
  shield: { Icon: Shield, label: "Bouclier / Sécurité" },
  whatsapp: { Icon: MessageCircle, label: "WhatsApp / Chat" },
  star: { Icon: Star, label: "Étoile" },
  heart: { Icon: Heart, label: "Cœur" },
  gift: { Icon: Gift, label: "Cadeau" },
  package: { Icon: Package, label: "Colis" },
  clock: { Icon: Clock, label: "Horloge" },
  "credit-card": { Icon: CreditCard, label: "Carte bancaire" },
  lock: { Icon: Lock, label: "Cadenas" },
  award: { Icon: Award, label: "Récompense" },
  zap: { Icon: Zap, label: "Éclair" },
  flame: { Icon: Flame, label: "Flamme" },
  sparkles: { Icon: Sparkles, label: "Étincelles" },
  tag: { Icon: Tag, label: "Étiquette" },
  percent: { Icon: Percent, label: "Pourcentage" },
  "shopping-bag": { Icon: ShoppingBag, label: "Sac" },
  "shopping-cart": { Icon: ShoppingCart, label: "Panier" },
  check: { Icon: CheckCircle2, label: "Validé" },
  phone: { Icon: Phone, label: "Téléphone" },
  mail: { Icon: Mail, label: "E-mail" },
  "map-pin": { Icon: MapPin, label: "Localisation" },
  store: { Icon: Store, label: "Boutique" },
  users: { Icon: Users, label: "Clientes" },
  "user-check": { Icon: UserCheck, label: "Cliente validée" },
  smile: { Icon: Smile, label: "Sourire" },
  "thumbs-up": { Icon: ThumbsUp, label: "Pouce" },
  headphones: { Icon: Headphones, label: "Support" },
  facebook: { Icon: Facebook, label: "Facebook" },
  instagram: { Icon: Instagram, label: "Instagram" },
  youtube: { Icon: Youtube, label: "YouTube" },
  linkedin: { Icon: Linkedin, label: "LinkedIn" },
  hash: { Icon: Hash, label: "TikTok / Hashtag" },
  share: { Icon: Share2, label: "Partage" },
  globe: { Icon: Globe, label: "Web" },
  bell: { Icon: Bell, label: "Notification" },
  camera: { Icon: Camera, label: "Photo" },
  image: { Icon: ImageIcon, label: "Image" },
  video: { Icon: Video, label: "Vidéo" },
  mic: { Icon: Mic, label: "Micro" },
  calendar: { Icon: Calendar, label: "Calendrier" },
  sun: { Icon: Sun, label: "Soleil" },
  moon: { Icon: Moon, label: "Lune" },
  flower: { Icon: Flower, label: "Fleur" },
  leaf: { Icon: Leaf, label: "Feuille" },
  diamond: { Icon: Diamond, label: "Diamant" },
  crown: { Icon: Crown, label: "Couronne" },
  shirt: { Icon: Shirt, label: "Vêtement" },
  watch: { Icon: Watch, label: "Montre" },
  scissors: { Icon: Scissors, label: "Ciseaux" },
  palette: { Icon: Palette, label: "Palette" },
  trophy: { Icon: Trophy, label: "Trophée" },
  medal: { Icon: Medal, label: "Médaille" },
  rocket: { Icon: Rocket, label: "Fusée" },
  target: { Icon: Target, label: "Cible" },
  "trending-up": { Icon: TrendingUp, label: "Tendance" },
  timer: { Icon: Timer, label: "Minuteur" },
  bulb: { Icon: Lightbulb, label: "Idée" },
  refresh: { Icon: RefreshCw, label: "Actualiser" },
  repeat: { Icon: Repeat, label: "Répéter" },
  wallet: { Icon: Wallet, label: "Portefeuille" },
  receipt: { Icon: Receipt, label: "Reçu" },
  banknote: { Icon: Banknote, label: "Billet" },
  coins: { Icon: Coins, label: "Pièces" },
  "piggy-bank": { Icon: PiggyBank, label: "Tirelire" },
  gem: { Icon: Gem, label: "Pierre précieuse" },
  smartphone: { Icon: Smartphone, label: "Smartphone" },
  "qr-code": { Icon: QrCode, label: "QR Code" },
  book: { Icon: BookOpen, label: "Livre" },
  megaphone: { Icon: Megaphone, label: "Mégaphone" },
};

export function renderIcon(key, size = 16, className = "") {
  const entry = ICON_MAP[key];
  if (!entry) return null;
  const { Icon } = entry;
  return <Icon size={size} className={className} />;
}

export default function IconPicker({ value, onChange, testid = "icon-picker" }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const entries = Object.entries(ICON_MAP);
    if (!q) return entries;
    return entries.filter(([k, v]) => k.toLowerCase().includes(q) || v.label.toLowerCase().includes(q));
  }, [search]);

  const current = ICON_MAP[value];
  const CurrentIcon = current?.Icon;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="dina-input flex items-center gap-2 h-10 w-full !justify-start text-left hover:border-[#b02a2a]"
        data-testid={testid}
      >
        {CurrentIcon ? <CurrentIcon size={16} className="text-[#b02a2a]"/> : <span className="w-4 h-4 rounded border border-dashed border-[#999]"/>}
        <span className="text-sm truncate flex-1">{current?.label || "Choisir une icône"}</span>
        <span className="text-[10px] text-[#999]">▼</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)}/>
          <div className="absolute z-40 top-full left-0 mt-1 w-[360px] max-w-[calc(100vw-2rem)] bg-white dark:bg-[#1a1a1a] border border-[#ececec] dark:border-[#2a2a2a] rounded-xl shadow-xl p-3" data-testid={`${testid}-dropdown`}>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#999]"/>
              <input
                autoFocus
                className="dina-input pl-8 h-9 text-sm"
                placeholder="Rechercher une icône…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                data-testid={`${testid}-search`}
              />
            </div>
            <div className="grid grid-cols-8 gap-1 max-h-[280px] overflow-y-auto scrollbar-thin">
              {filtered.map(([k, { Icon, label }]) => {
                const active = k === value;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => { onChange(k); setOpen(false); setSearch(""); }}
                    title={label}
                    className={`aspect-square grid place-items-center rounded-lg transition ${active ? "bg-[#b02a2a] text-white" : "hover:bg-[#fff5f5] dark:hover:bg-[#2a1818] text-[#1c1c1c] dark:text-white"}`}
                    data-testid={`${testid}-opt-${k}`}
                  >
                    <Icon size={16}/>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-8 text-xs text-[#999] text-center py-6">Aucune icône trouvée</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
