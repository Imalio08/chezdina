import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa, dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";
import { Gift, Copy, Users, Trophy, Plus } from "lucide-react";
import { SOURCE_LABEL } from "@/components/shared/WalletLedger";

export default function Referrals() {
  const [list, setList] = useState([]);
  const [top, setTop] = useState([]);
  const [settings, setSettings] = useState(null);
  const [showApply, setShowApply] = useState(false);

  const load = async () => {
    try {
      const [r, t, s] = await Promise.all([api.get("/referrals"), api.get("/referrals/leaderboard"), api.get("/loyalty/settings")]);
      setList(r.data); setTop(t.data); setSettings(s.data);
    } catch { toast.error("Erreur"); }
  };
  useEffect(() => { load(); }, []);

  const copy = (code) => { navigator.clipboard.writeText(code); toast.success(`Code ${code} copié`); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Parrainage</h1><p className="text-sm text-[#666]">Un code unique par cliente · récompense parrain & filleul</p></div>
        <button onClick={() => setShowApply(true)} className="dina-btn-primary !min-h-[40px]" data-testid="refer-apply"><Plus size={14} />Appliquer un code</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Parrainages</div><div className="font-serif text-2xl tabular mt-1 text-[#1f8a4c]">{list.length} <span className="text-sm text-[#666]">· {list.filter(r => r.status === "recompensee").length} récompensés</span></div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Récompense marraine</div><div className="font-serif text-2xl tabular mt-1 text-[#b02a2a]">{fcfa(settings?.referral_bonus_parrain || 1000)}</div><div className="text-[10px] text-[#999]">à la 1re commande livrée de la filleule</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Récompense filleule</div><div className="font-serif text-2xl tabular mt-1">{fcfa(settings?.referral_bonus_filleul || 1000)}</div><div className="text-[10px] text-[#999]">à l'inscription</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Top ambassadrices</div><div className="font-serif text-2xl tabular mt-1">{top.length}</div></div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3 flex items-center gap-2"><Trophy size={16} />Classement</div>
          {top.length === 0 ? <div className="text-sm text-[#666] text-center py-8">Aucun parrainage pour le moment</div> :
            <table className="dina-table">
              <thead><tr><th>Cliente</th><th>Code</th><th className="text-right">Filleuls</th><th className="text-right">Porte-monnaie</th></tr></thead>
              <tbody>{top.slice(0, 15).map(c => (
                <tr key={c.id} data-testid={`refer-top-${c.id}`}>
                  <td className="font-medium">{c.name}</td>
                  <td><button onClick={() => copy(c.referral_code)} className="font-mono text-xs text-[#b02a2a] hover:underline flex items-center gap-1"><Copy size={10} />{c.referral_code}</button></td>
                  <td className="text-right tabular font-semibold">{c.referral_count || 0}</td>
                  <td className="text-right tabular">{fcfa(c.wallet || 0)}</td>
                </tr>
              ))}</tbody>
            </table>}
        </div>

        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3 flex items-center gap-2"><Users size={16} />Dernières conversions</div>
          {list.length === 0 ? <div className="text-sm text-[#666] text-center py-8">Rien à afficher</div> :
            <table className="dina-table">
              <thead><tr><th>Marraine</th><th>Filleule</th><th>Statut</th><th>Date</th></tr></thead>
              <tbody>{list.slice(0, 20).map(r => (
                <tr key={r.id} data-testid={`refer-${r.id}`}>
                  <td className="font-medium">{r.parrain_name}</td>
                  <td>{r.filleul_name}</td>
                  <td className="text-xs">{r.status === "recompensee" ? <span className="text-[#1f8a4c]">Récompensé · {r.first_order_code}</span> : r.status === "inscrite" ? <span className="text-[#e4991e]">En attente 1re livraison</span> : <span className="text-[#666]">Ancien système</span>}</td>
                  <td className="text-xs text-[#666]">{dateTimeFmt(r.created_at)}</td>
                </tr>
              ))}</tbody>
            </table>}
        </div>
      </div>

      <WalletTxTable/>

      {showApply && <ApplyModal onClose={() => setShowApply(false)} onDone={() => { setShowApply(false); load(); }} />}
    </div>
  );
}

function WalletTxTable() {
  const [rows, setRows] = useState([]);
  const [src, setSrc] = useState("");
  useEffect(() => { api.get("/wallet/transactions").then(r => setRows(r.data)).catch(() => {}); }, []);
  const shown = rows.filter(r => r.status !== "validated" && (!src || r.source === src));
  return (
    <div className="dina-card-white p-5" data-testid="wallet-tx-table">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap"><div className="font-semibold">Mouvements des porte-monnaie</div>
        <select className="dina-input !w-auto !min-h-[34px] text-xs" value={src} onChange={e => setSrc(e.target.value)} data-testid="wallet-tx-filter"><option value="">Toutes origines</option>{Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div className="overflow-x-auto"><table className="dina-table">
        <thead><tr><th>Date</th><th>Cliente</th><th>Origine</th><th>Libellé</th><th>Statut</th><th className="text-right">Montant</th><th className="text-right">Solde</th></tr></thead>
        <tbody>{shown.length === 0 ? <tr><td colSpan={7} className="text-center text-sm text-[#666] py-6">Aucun mouvement</td></tr> : shown.slice(0, 200).map(r => (
          <tr key={r.id}><td className="text-xs whitespace-nowrap">{dateTimeFmt(r.at)}</td><td>{r.customer_name}</td><td className="text-xs">{SOURCE_LABEL[r.source] || r.source}</td><td className="text-xs">{r.label}{r.by ? ` · par ${r.by}` : ""}</td><td className="text-xs">{r.status === "pending" ? "En attente" : "Crédité"}</td><td className={`text-right tabular ${r.amount < 0 ? "text-[#c62828]" : "text-[#1f8a4c]"}`}>{r.amount > 0 ? "+" : ""}{fcfa(r.amount)}</td><td className="text-right tabular">{r.balance_after != null ? fcfa(r.balance_after) : "—"}</td></tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}

function ApplyModal({ onClose, onDone }) {
  const [customers, setCustomers] = useState([]);
  const [cid, setCid] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => { api.get("/customers").then(r => setCustomers(r.data)).catch(() => { }); }, []);
  const submit = async () => {
    if (!cid || !code) return toast.error("Cliente et code requis");
    setLoading(true);
    try {
      await api.post("/referrals/apply", { customer_id: cid, code });
      toast.success("Parrainage validé, bonus crédités");
      onDone();
    } catch (e) { toast.error(e.response?.data?.detail || "Erreur"); } finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="font-serif text-xl mb-4 flex items-center gap-2"><Gift size={18} />Appliquer un code de parrainage</div>
        <label className="text-xs uppercase font-semibold text-[#666]">Nouvelle cliente (filleule)</label>
        <select className="dina-input mb-3" value={cid} onChange={e => setCid(e.target.value)} data-testid="refer-cid">
          <option value="">Sélectionner…</option>
          {customers.filter(c => !c.referred_by).map(c => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}
        </select>
        <label className="text-xs uppercase font-semibold text-[#666]">Code parrain</label>
        <input className="dina-input mb-4 font-mono uppercase" placeholder="DINA-1234" value={code} onChange={e => setCode(e.target.value.toUpperCase())} data-testid="refer-code" />
        <div className="flex gap-2"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={submit} disabled={loading} className="dina-btn-primary flex-1" data-testid="refer-submit">{loading ? "Validation…" : "Valider"}</button></div>
      </div>
    </div>
  );
}
