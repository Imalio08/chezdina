import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { ChevronRight, Store, Truck, Smartphone, Sparkles } from "lucide-react";

const COLLAGE = [
  "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600",
  "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600",
  "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600",
  "https://images.unsplash.com/photo-1612336307429-8a898d10e223?w=600",
  "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=600",
  "https://images.unsplash.com/photo-1591561954555-607968c989ab?w=600",
];

export default function Login() {
  const { login, loginPin } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState("password");
  const [email, setEmail] = useState("aouattaraesca@gmail.com");
  const [password, setPassword] = useState("Admin123!");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const u = mode === "password" ? await login(email, password) : await loginPin(pin);
      toast.success(`Bienvenue ${u.name}`);
      nav(u.role === "rider" ? "/console/livreur" : "/console");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Connexion impossible");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden lg:flex bg-[#1c1c1c] text-white overflow-hidden">
        <div className="absolute inset-0 grid grid-cols-3 gap-2 p-3 opacity-30">
          {COLLAGE.map((src, i) => (
            <div key={i} className={`rounded-2xl overflow-hidden ${i===0||i===5?"row-span-2":""}`}>
              <img src={src} alt="" className="w-full h-full object-cover"/>
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-[#1c1c1c]/95 via-[#1c1c1c]/80 to-[#b02a2a]/70"/>
        <div className="relative z-10 flex flex-col justify-between p-10 w-full">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#fde8e8] grid place-items-center font-serif text-[#b02a2a] font-bold">CD</div>
            <div><div className="font-serif text-2xl tracking-tight">Chez Dina</div><div className="text-[10px] uppercase tracking-widest text-[#f0b8b8]">boutique · Abidjan</div></div>
          </div>
          <div>
            <div className="inline-block px-3 py-1 rounded-full bg-[#b02a2a] text-xs font-semibold uppercase tracking-wider mb-5">Console admin</div>
            <div className="font-serif text-5xl xl:text-6xl leading-[1.05]">La boutique.<br/>Toute entière,<br/><span className="italic text-[#ffb3b3]">dans votre main.</span></div>
            <p className="text-sm text-[#e8d4d4] mt-6 max-w-md leading-relaxed">Caisse, commandes, stock, livraisons et site vitrine — un seul espace de travail, en temps réel.</p>
            <div className="grid grid-cols-2 gap-3 mt-8 max-w-md">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur"><Store size={14} className="text-[#ffb3b3] mb-1"/><div className="text-xs font-semibold">Caisse rapide</div><div className="text-[11px] text-[#d0c0c0]">De la vente au reçu en 10 secondes</div></div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur"><Truck size={14} className="text-[#ffb3b3] mb-1"/><div className="text-xs font-semibold">Dispatch livreurs</div><div className="text-[11px] text-[#d0c0c0]">Suivi en direct par zone</div></div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur"><Smartphone size={14} className="text-[#ffb3b3] mb-1"/><div className="text-xs font-semibold">WhatsApp intégré</div><div className="text-[11px] text-[#d0c0c0]">Confirmations & lien Wave</div></div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur"><Sparkles size={14} className="text-[#ffb3b3] mb-1"/><div className="text-xs font-semibold">Assistant IA</div><div className="text-[11px] text-[#d0c0c0]">Posez une question à Dina</div></div>
            </div>
          </div>
          <div className="text-xs text-[#c0a8a8] flex items-center justify-between"><span>© 2026 Chez Dina · Abidjan</span><a href="/boutique" className="hover:text-white underline flex items-center gap-1" data-testid="login-view-shop">Voir le site vitrine <ChevronRight size={12}/></a></div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 bg-[#fff5f5]">
        <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl border border-[#ececec] p-8 shadow-sm" data-testid="login-form">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#fde8e8] grid place-items-center font-serif text-[#b02a2a] font-bold text-sm">CD</div>
            <div><div className="font-serif text-xl text-[#b02a2a]">Chez Dina</div><div className="text-[10px] uppercase tracking-widest text-[#666]">boutique</div></div>
          </div>
          <h1 className="font-serif text-3xl mb-1">Connexion</h1>
          <p className="text-sm text-[#666] mb-6">Accédez à votre espace de gestion.</p>

          <div className="flex gap-2 mb-5 text-xs">
            <button type="button" onClick={() => setMode("password")} className={`flex-1 px-3 py-2 rounded-md border transition ${mode === "password" ? "bg-[#1c1c1c] text-white border-[#1c1c1c]" : "border-[#ececec] text-[#666] bg-white"}`} data-testid="login-tab-password">Email · mot de passe</button>
            <button type="button" onClick={() => setMode("pin")} className={`flex-1 px-3 py-2 rounded-md border transition ${mode === "pin" ? "bg-[#1c1c1c] text-white border-[#1c1c1c]" : "border-[#ececec] text-[#666] bg-white"}`} data-testid="login-tab-pin">PIN rapide</button>
          </div>

          {mode === "password" ? (
            <>
              <label className="text-xs font-medium text-[#666] uppercase tracking-wide">Email</label>
              <input className="dina-input mt-1 mb-3" value={email} onChange={(e)=>setEmail(e.target.value)} data-testid="login-email" />
              <label className="text-xs font-medium text-[#666] uppercase tracking-wide">Mot de passe</label>
              <input type="password" className="dina-input mt-1 mb-5" value={password} onChange={(e)=>setPassword(e.target.value)} data-testid="login-password" />
            </>
          ) : (
            <>
              <label className="text-xs font-medium text-[#666] uppercase tracking-wide">Code PIN</label>
              <input inputMode="numeric" className="dina-input mt-1 mb-3 text-center text-2xl tracking-[0.5em] font-serif" maxLength={6} value={pin} onChange={(e)=>setPin(e.target.value.replace(/\D/g,""))} data-testid="login-pin" />
              <div className="bg-[#fff5f5] border border-[#fde8e8] rounded-lg p-3 mb-5 text-xs text-[#666]">PIN démo : 1234 (admin) · 2222 (manager) · 3333 (vendeuse) · 4444 (stock) · 5555 (livreur)</div>
            </>
          )}

          <button className="dina-btn-primary w-full" disabled={loading} data-testid="login-submit">
            {loading ? "Connexion…" : "Se connecter"}
          </button>

          <div className="mt-6 text-xs text-[#666] text-center">
            Pas d'accès ? <Link to="/boutique" className="text-[#b02a2a] font-medium hover:underline">Visiter la boutique en ligne →</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
