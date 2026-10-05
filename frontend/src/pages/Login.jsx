import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

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
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex relative bg-[#1c1c1c] text-white p-10 flex-col justify-between">
        <div>
          <div className="font-serif text-3xl tracking-tight">Dina Store</div>
          <div className="text-sm text-[#999] mt-1">Système de gestion retail · Abidjan</div>
        </div>
        <div>
          <div className="text-5xl font-serif leading-tight">La boutique.<br/>Toute entière,<br/><span className="text-[#f4b12c]">dans votre main.</span></div>
          <p className="text-sm text-[#bbb] mt-6 max-w-md">Caisse, commandes, stock, livraisons et boutique en ligne — un seul espace, en temps réel, même hors ligne.</p>
        </div>
        <div className="text-xs text-[#777]">© 2026 Dina Store · Abidjan, Côte d'Ivoire</div>
      </div>
      <div className="flex items-center justify-center p-6 bg-white">
        <form onSubmit={submit} className="w-full max-w-sm" data-testid="login-form">
          <div className="lg:hidden font-serif text-2xl mb-6">Dina Store</div>
          <h1 className="font-serif text-3xl mb-1">Connexion</h1>
          <p className="text-sm text-[#666] mb-6">Accédez à votre console.</p>

          <div className="flex gap-2 mb-5 text-xs">
            <button type="button" onClick={() => setMode("password")} className={`px-3 py-2 rounded-md border ${mode === "password" ? "bg-[#1c1c1c] text-white border-[#1c1c1c]" : "border-[#ececec] text-[#666]"}`} data-testid="login-tab-password">Email + mot de passe</button>
            <button type="button" onClick={() => setMode("pin")} className={`px-3 py-2 rounded-md border ${mode === "pin" ? "bg-[#1c1c1c] text-white border-[#1c1c1c]" : "border-[#ececec] text-[#666]"}`} data-testid="login-tab-pin">PIN rapide</button>
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
              <input inputMode="numeric" className="dina-input mt-1 mb-5 text-center text-2xl tracking-[0.5em]" maxLength={6} value={pin} onChange={(e)=>setPin(e.target.value.replace(/\D/g,""))} data-testid="login-pin" />
              <p className="text-xs text-[#666] mb-3">Démos: 1234 (admin), 2222 (manager), 3333 (vendeuse), 4444 (stock), 5555 (livreur).</p>
            </>
          )}

          <button className="dina-btn-primary w-full" disabled={loading} data-testid="login-submit">
            {loading ? "Connexion…" : "Se connecter"}
          </button>

          <div className="mt-6 text-xs text-[#666] text-center">
            Pas d'accès ? <Link to="/boutique" className="text-[#0021cc] underline">Visiter la boutique</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
