import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Bike, LogIn, Eye, EyeOff, Delete, KeyRound, Mail } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const BORDEAUX = "#b02a2a";
const BORDEAUX_DEEP = "#4a1010";
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

function PinPad({ busy, onSubmit }) {
  const [pin, setPin] = useState("");
  const press = (k) => {
    if (busy) return;
    if (k === "del") return setPin(p => p.slice(0, -1));
    if (pin.length >= 6) return;
    setPin(pin + k);
  };
  useEffect(() => {
    const f = (e) => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === "Backspace") press("del"); else if (e.key === "Enter" && pin.length >= 4) onSubmit(pin, setPin); };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  });
  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/15" data-testid="rider-pin-pad">
      <div className="text-center text-sm text-white/80 mb-3">Tapez votre code PIN</div>
      <div className="flex justify-center gap-3 mb-5" data-testid="rider-pin-dots">
        {[0, 1, 2, 3].concat(pin.length > 4 ? [4, 5].slice(0, pin.length - 4) : []).map(i => <span key={i} className={`w-3.5 h-3.5 rounded-full border-2 border-white transition-colors ${i < pin.length ? "bg-white" : ""}`}/>)}
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {KEYS.map((k, i) => k === "" ? <span key={i}/> : (
          <button key={i} type="button" onClick={() => press(k)} className="h-14 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 transition-transform text-xl font-semibold grid place-items-center" data-testid={`rider-pin-key-${k}`}>
            {k === "del" ? <Delete size={20}/> : k}
          </button>
        ))}
      </div>
      <button type="button" disabled={busy || pin.length < 4} onClick={() => onSubmit(pin, setPin)} className="mt-4 w-full rounded-xl py-3 font-semibold text-sm bg-white inline-flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform" style={{ color: BORDEAUX }} data-testid="rider-pin-submit"><LogIn size={16}/>{busy ? "Connexion…" : "Démarrer ma journée"}</button>
    </div>
  );
}

function EmailForm({ busy, onSubmit }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(email.trim(), password); }} className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 space-y-3 border border-white/15">
      <input type="email" autoComplete="username" required placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-xl px-4 py-3 bg-white text-[#1c1c1c] text-sm outline-none" data-testid="rider-login-email"/>
      <div className="relative">
        <input type={show ? "text" : "password"} autoComplete="current-password" required placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-xl px-4 py-3 pr-11 bg-white text-[#1c1c1c] text-sm outline-none" data-testid="rider-login-password"/>
        <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666]">{show ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
      </div>
      <button type="submit" disabled={busy} className="w-full rounded-xl py-3 font-semibold text-sm bg-white inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform" style={{ color: BORDEAUX }} data-testid="rider-login-submit"><LogIn size={16}/>{busy ? "Connexion…" : "Démarrer ma journée"}</button>
    </form>
  );
}

export default function RiderLogin() {
  const { login, logout, setUser } = useAuth();
  const nav = useNavigate();
  const from = useLocation().state?.from;
  const [cms, setCms] = useState({});
  const [site, setSite] = useState({});
  const [mode, setMode] = useState("pin");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    localStorage.setItem("dina_app", "rider");
    api.get("/public/rider-cms").then(r => setCms(r.data || {})).catch(() => {});
    api.get("/public/site").then(r => setSite(r.data || {})).catch(() => {});
  }, []);
  const logo = cms.logo || site.logo;
  const go = () => nav(from?.startsWith("/riders") ? from : "/riders", { replace: true });
  const submitPin = async (pin, reset) => {
    setBusy(true);
    try {
      const { data } = await api.post("/auth/rider-login-pin", { pin });
      if (data.token) localStorage.setItem("dina_token", data.token);
      setUser(data.user); go();
    } catch (err) { reset(""); toast.error(err.response?.data?.detail || "Code PIN incorrect"); }
    finally { setBusy(false); }
  };
  const submitEmail = async (email, password) => {
    setBusy(true);
    try {
      const u = await login(email, password);
      if (u?.role !== "rider") { await logout(); toast.error("Cet espace est réservé aux livreurs · l'équipe se connecte sur /console"); return; }
      go();
    } catch (err) { toast.error(err.response?.data?.detail || "Identifiants invalides"); }
    finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5 text-white" style={{ background: `linear-gradient(165deg, ${BORDEAUX} 0%, #8e1f1f 45%, ${BORDEAUX_DEEP} 100%)` }} data-testid="rider-login-page">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          {logo ? <img src={logo} alt="" className="w-20 h-20 rounded-2xl object-cover shadow-xl mb-3 bg-white ring-4 ring-white/20"/> : <div className="w-20 h-20 rounded-2xl bg-white/15 grid place-items-center mb-3"><Bike size={34}/></div>}
          <h1 className="font-serif text-3xl">{cms.app_name || "Espace Livreur"}</h1>
          <p className="text-sm text-[#fde8e8] mt-1">{site.name || "Chez Dina"} · vos courses du jour</p>
        </div>
        {mode === "pin" ? <PinPad busy={busy} onSubmit={submitPin}/> : <EmailForm busy={busy} onSubmit={submitEmail}/>}
        <button type="button" onClick={() => setMode(m => m === "pin" ? "email" : "pin")} className="mt-4 w-full text-xs text-[#fde8e8] inline-flex items-center justify-center gap-1.5 hover:text-white" data-testid="rider-login-mode-toggle">
          {mode === "pin" ? <><Mail size={13}/>Se connecter avec e-mail et mot de passe</> : <><KeyRound size={13}/>Se connecter avec mon code PIN</>}
        </button>
        <p className="text-center text-[11px] text-white/60 mt-6">Espace réservé aux livreurs · ajoutez cette page à votre écran d'accueil</p>
      </div>
    </div>
  );
}
