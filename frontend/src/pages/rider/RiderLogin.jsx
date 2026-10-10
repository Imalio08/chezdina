import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Bike, LogIn, Eye, EyeOff } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function RiderLogin() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [cms, setCms] = useState({});
  const [site, setSite] = useState({});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    localStorage.setItem("dina_app", "rider");
    api.get("/public/rider-cms").then(r => setCms(r.data || {})).catch(() => {});
    api.get("/public/site").then(r => setSite(r.data || {})).catch(() => {});
  }, []);
  const primary = cms.primary_color || "#b02a2a";
  const logo = cms.logo || site.logo;
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await login(email.trim(), password);
      if (u?.role !== "rider") toast.message("Compte non livreur · redirection vers la console");
      nav(u?.role === "rider" ? "/rider" : "/console", { replace: true });
    } catch (err) { toast.error(err.response?.data?.detail || "Identifiants invalides"); }
    finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5 text-white" style={{ background: `linear-gradient(160deg, ${primary} 0%, #141414 70%)` }} data-testid="rider-login-page">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          {logo ? <img src={logo} alt="" className="w-20 h-20 rounded-2xl object-cover shadow-xl mb-3 bg-white"/> : <div className="w-20 h-20 rounded-2xl bg-white/15 grid place-items-center mb-3"><Bike size={34}/></div>}
          <h1 className="font-serif text-3xl">{cms.app_name || "Espace Livreur"}</h1>
          <p className="text-sm text-white/70 mt-1">{site.name || "Chez Dina"} · vos courses du jour</p>
        </div>
        <form onSubmit={submit} className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 space-y-3 border border-white/15">
          <input type="email" autoComplete="username" required placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-xl px-4 py-3 bg-white text-[#1c1c1c] text-sm outline-none" data-testid="rider-login-email"/>
          <div className="relative">
            <input type={show ? "text" : "password"} autoComplete="current-password" required placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-xl px-4 py-3 pr-11 bg-white text-[#1c1c1c] text-sm outline-none" data-testid="rider-login-password"/>
            <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666]">{show ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
          </div>
          <button type="submit" disabled={busy} className="w-full rounded-xl py-3 font-semibold text-sm bg-white inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform" style={{ color: primary }} data-testid="rider-login-submit"><LogIn size={16}/>{busy ? "Connexion…" : "Démarrer ma journée"}</button>
        </form>
        <p className="text-center text-[11px] text-white/50 mt-6">Espace réservé aux livreurs · ajoutez cette page à votre écran d'accueil</p>
      </div>
    </div>
  );
}
