import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { fcfa, statusLabel, statusColor, dateFmt } from "@/lib/format";
import { toast } from "sonner";
import { User, Wallet, Gift, Package, LogOut, Copy, ChevronRight, Star } from "lucide-react";

const KEY = "dina_customer";

function getLocal() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch { return null; }
}
function setLocal(data) {
  if (data) sessionStorage.setItem(KEY, JSON.stringify(data));
  else sessionStorage.removeItem(KEY);
}

export default function Account() {
  const [session, setSession] = useState(getLocal());
  const [data, setData] = useState(null);

  const loadMe = async (token) => {
    try {
      const r = await api.get("/public/account/me", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      setData(r.data);
    } catch { setSession(null); setLocal(null); }
  };
  useEffect(() => {
    if (session?.token) loadMe(session.token);
  }, []);

  const logout = async () => {
    try { await api.post("/public/customer-logout"); } catch { }
    setSession(null); setLocal(null); setData(null);
    toast.success("Déconnectée");
  };

  if (!session) return <LoginForm onDone={(d) => { setSession(d); setLocal(d); loadMe(d.token); }} />;
  if (!data) return <div className="max-w-md mx-auto px-4 py-10 text-center text-sm text-[#666]">Chargement…</div>;

  return <Dashboard data={data} onLogout={logout} />;
}

function LoginForm({ onDone }) {
  const [phone, setPhone] = useState("+225 ");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (phone.replace(/\D/g, "").length < 8) return toast.error("Numéro invalide");
    if (code.length < 6) return toast.error("Code à 6 chiffres");
    setLoading(true);
    try {
      const r = await api.post("/public/customer-login-code", { phone, code });
      toast.success(`Bonjour ${r.data.customer.name.split(" ")[0]} 👋`);
      // Merge guest favorites into the account
      try {
        const localFavs = JSON.parse(localStorage.getItem("dina_favorites") || "[]");
        if (Array.isArray(localFavs) && localFavs.length) {
          await api.post("/public/account/favorites/merge", { product_ids: localFavs }, { headers: { Authorization: `Bearer ${r.data.token}` }});
          toast.info(`${localFavs.length} favoris synchronisés`);
        }
      } catch {}
      onDone({ token: r.data.token, customer: r.data.customer });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Connexion échouée");
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-[#fde8e8] text-[#b02a2a] font-serif text-3xl font-bold grid place-items-center mx-auto mb-3">D</div>
        <h1 className="font-serif text-3xl mb-2">Mon compte</h1>
        <p className="text-sm text-[#666]">Entrez votre numéro et votre code secret à 6 chiffres pour accéder à votre porte-monnaie, vos points et vos commandes.</p>
      </div>

      <div className="dina-card-white p-5 space-y-3">
        <div>
          <label className="text-xs uppercase font-semibold text-[#666]">Téléphone</label>
          <input className="dina-input mt-1" placeholder="+225 07 XX XX XX XX" value={phone} onChange={e => setPhone(e.target.value)} data-testid="account-phone" />
        </div>
        <div>
          <label className="text-xs uppercase font-semibold text-[#666]">Code secret (6 chiffres)</label>
          <input type="password" inputMode="numeric" maxLength={6} className="dina-input mt-1 tracking-[0.5em] text-center text-xl" placeholder="••••••" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} data-testid="account-code" />
        </div>
        <button onClick={submit} disabled={loading} className="dina-btn-primary w-full !min-h-[46px]" data-testid="account-login">{loading ? "Connexion…" : "Se connecter"}</button>
      </div>

      <div className="text-xs text-[#666] text-center mt-5">
        Pas encore de code ? Demandez-le au moment de votre prochaine commande ou via WhatsApp.
        <br />
        <a href="https://wa.me/2250777926179" target="_blank" rel="noreferrer" className="text-[#b02a2a] underline">0777 92 61 79</a>
      </div>
      <Link to="/" className="dina-btn-secondary w-full mt-4">Retour boutique</Link>
    </div>
  );
}

function Dashboard({ data, onLogout }) {
  const { customer: c, orders, metrics } = data;
  const copy = (v) => { navigator.clipboard.writeText(v); toast.success("Copié !"); };
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="dina-card-white p-6 mb-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-[#fde8e8] text-[#b02a2a] font-serif text-2xl font-bold grid place-items-center">{c.name[0]}</div>
          <div className="flex-1">
            <div className="font-serif text-2xl">{c.name}</div>
            <div className="text-sm text-[#666]">{c.phone}</div>
            <div className="flex gap-2 mt-1">
              <span className="dina-chip"><Star size={10} />{c.tier || "Bronze"}</span>
              <span className="dina-chip"><Gift size={10} />{c.loyalty_points || 0} pts</span>
            </div>
          </div>
          <button onClick={onLogout} className="dina-btn-secondary !min-h-[36px] text-xs" data-testid="account-logout"><LogOut size={12} />Déconnexion</button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 bg-[#fff5f5] rounded-lg">
            <div className="text-[10px] uppercase text-[#666] mb-1 flex items-center gap-1"><Wallet size={11} />Porte-monnaie</div>
            <div className="font-serif text-xl tabular text-[#b02a2a]">{fcfa(c.wallet || 0)}</div>
          </div>
          <div className="p-3 bg-[#fff5f5] rounded-lg">
            <div className="text-[10px] uppercase text-[#666] mb-1">Points fidélité</div>
            <div className="font-serif text-xl tabular">{c.loyalty_points || 0}</div>
          </div>
          <div className="p-3 bg-[#fff5f5] rounded-lg">
            <div className="text-[10px] uppercase text-[#666] mb-1 flex items-center gap-1"><Package size={11} />Commandes</div>
            <div className="font-serif text-xl tabular">{metrics.total_orders}</div>
          </div>
          <div className="p-3 bg-[#fff5f5] rounded-lg">
            <div className="text-[10px] uppercase text-[#666] mb-1">Parrainages</div>
            <div className="font-serif text-xl tabular text-[#1f8a4c]">{metrics.referrals}</div>
          </div>
        </div>
      </div>

      <div className="dina-card-white p-6 mb-5">
        <div className="font-serif text-xl mb-3 flex items-center gap-2"><Gift size={16} />Mon code de parrainage</div>
        <div className="flex items-center gap-3 p-4 bg-[#fff5f5] rounded-lg">
          <button onClick={() => copy(c.referral_code)} className="font-mono text-2xl text-[#b02a2a] font-bold tracking-wide" data-testid="account-ref-code">{c.referral_code}</button>
          <button onClick={() => copy(c.referral_code)} className="ml-auto dina-btn-secondary !min-h-[36px] text-xs"><Copy size={12} />Copier</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(`Salut 💕 Utilise mon code ${c.referral_code} sur chezdina.net et on reçoit un bonus toutes les deux !`)}`} target="_blank" rel="noreferrer" className="dina-btn-primary !min-h-[36px] text-xs">Partager</a>
        </div>
      </div>

      <div className="dina-card-white p-6">
        <div className="font-serif text-xl mb-3 flex items-center gap-2"><Package size={16} />Mes commandes ({orders.length})</div>
        {orders.length === 0
          ? <div className="text-sm text-[#666] text-center py-6">Aucune commande pour le moment.<br /><Link to="/catalog" className="text-[#b02a2a] underline">Explorer la collection</Link></div>
          : <div className="space-y-2">
            {orders.slice(0, 20).map(o => (
              <Link key={o.id} to={`/suivi/${o.code}`} className="flex items-center gap-3 p-3 border border-[#ececec] rounded-lg hover:bg-[#fff5f5] transition" data-testid={`account-order-${o.code}`}>
                <div className="flex-1">
                  <div className="font-medium text-sm">{o.code}</div>
                  <div className="text-xs text-[#666]">{dateFmt(o.created_at)} · {o.items?.length || 0} article(s)</div>
                </div>
                <span className="dina-chip" style={{ color: statusColor[o.status] }}>{statusLabel[o.status]}</span>
                <div className="tabular font-semibold">{fcfa(o.total)}</div>
                <ChevronRight size={14} className="text-[#999]" />
              </Link>
            ))}
          </div>}
      </div>
    </div>
  );
}
