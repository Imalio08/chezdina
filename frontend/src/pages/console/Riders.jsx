import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { Users, TrendingUp, Star, Wallet, Package, X, Phone, MessageCircle, MessageSquare } from "lucide-react";
import KPICard from "@/components/shared/KPICard";
import ViewToggle, { useStoredView } from "@/components/shared/ViewToggle";

export default function Riders() {
  const [riders, setRiders] = useState([]);
  const [orders, setOrders] = useState([]);
  const [scores, setScores] = useState({});
  const [view, setView] = useStoredView("riders", "grid");
  const [open, setOpen] = useState(null);

  const load = async () => {
    const [t, o] = await Promise.all([api.get("/team"), api.get("/orders").catch(()=>({data:[]}))]);
    const rs = (t.data||[]).filter(u => u.role === "rider");
    setRiders(rs); setOrders(o.data||[]);
    const scoreMap = {};
    await Promise.all(rs.map(async r => { try { const s = await api.get(`/riders/${r.id}/score`); scoreMap[r.id] = s.data; } catch {} }));
    setScores(scoreMap);
  };
  useEffect(() => { load(); }, []);

  const todayStr = new Date().toISOString().slice(0,10);
  const stats = (rid) => {
    const my = orders.filter(o => o.rider_id === rid);
    const today = my.filter(o => (o.created_at||"").slice(0,10) === todayStr);
    const delivered = my.filter(o => o.status === "livree");
    const rate = my.length ? Math.round(delivered.length / my.length * 100) : 0;
    return { today: today.length, total: my.length, rate };
  };

  if (open) return <RiderProfile rider={open} score={scores[open.id]} onBack={()=>setOpen(null)}/>;

  const avg = riders.length ? Math.round(Object.values(scores).reduce((s,v)=>s+(v?.score||0),0) / Math.max(1, Object.values(scores).length)) : 0;
  const totalToday = orders.filter(o=>(o.created_at||"").slice(0,10)===todayStr && o.rider_id).length;

  return (
    <div className="space-y-5" data-testid="riders-page">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Livreurs</h1><p className="text-sm text-[#666]">{riders.length} livreur{riders.length>1?"s":""} actif{riders.length>1?"s":""}</p></div>
        <ViewToggle value={view} onChange={setView} options={["grid","table"]} tabKey="riders"/>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard testid="r-active" label="Livreurs actifs" value={riders.filter(r=>r.active!==false).length} icon={Users} color="#1f8a4c"/>
        <KPICard testid="r-today" label="Livraisons aujourd'hui" value={totalToday} icon={Package} color="#5867fd"/>
        <KPICard testid="r-score" label="Score moyen" value={`${avg}/100`} icon={Star} color="#f4b12c"/>
        <KPICard testid="r-balance" label="Soldes à régler" value={fcfa(0)} icon={Wallet} color="#e4991e"/>
      </div>

      {view === "grid" ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {riders.map(r => {
            const s = stats(r.id); const sc = scores[r.id];
            return (
              <button key={r.id} onClick={()=>setOpen(r)} className="dina-card-white p-4 text-left hover:border-[#b02a2a]" data-testid={`rider-card-${r.id}`}>
                <div className="flex items-start gap-3">
                  {r.photo ? <img src={r.photo} className="w-14 h-14 rounded-full object-cover"/> : <div className="w-14 h-14 rounded-full bg-[#fde8e8] grid place-items-center font-bold text-[#b02a2a]">{r.name?.[0]}</div>}
                  <div className="flex-1 min-w-0">
                    <div className="font-serif text-base truncate">{r.name}</div>
                    <div className="text-xs text-[#666]">{r.phone || "—"}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`dina-chip !py-0.5 text-[10px] ${r.active===false?"":"!text-[#1f8a4c] !border-[#1f8a4c]"}`}>{r.active===false?"Inactif":"Actif"}</span>
                      {sc && <span className="text-[10px] text-[#f4b12c] font-bold">⭐ {sc.score}/100 · {sc.level}</span>}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div><div className="text-[10px] text-[#999]">Aujourd'hui</div><div className="font-bold tabular">{s.today}</div></div>
                  <div><div className="text-[10px] text-[#999]">Total</div><div className="font-bold tabular">{s.total}</div></div>
                  <div><div className="text-[10px] text-[#999]">Réussite</div><div className="font-bold tabular text-[#1f8a4c]">{s.rate}%</div></div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="dina-card-white overflow-hidden">
          <table className="dina-table" data-testid="riders-table">
            <thead><tr><th>Livreur</th><th>Statut</th><th className="text-right">Aujourd'hui</th><th className="text-right">Total</th><th className="text-right">Réussite</th><th className="text-right">Score</th><th></th></tr></thead>
            <tbody>{riders.map(r => { const s = stats(r.id); const sc = scores[r.id]; return (
              <tr key={r.id} data-testid={`rider-row-${r.id}`}>
                <td className="font-medium flex items-center gap-2">{r.photo ? <img src={r.photo} className="w-8 h-8 rounded-full object-cover"/> : <div className="w-8 h-8 rounded-full bg-[#fde8e8] grid place-items-center text-xs font-bold text-[#b02a2a]">{r.name?.[0]}</div>}{r.name}</td>
                <td><span className={`dina-chip !py-0.5 text-[10px] ${r.active===false?"":"!text-[#1f8a4c]"}`}>{r.active===false?"Inactif":"Actif"}</span></td>
                <td className="text-right tabular">{s.today}</td>
                <td className="text-right tabular">{s.total}</td>
                <td className="text-right tabular text-[#1f8a4c]">{s.rate}%</td>
                <td className="text-right tabular font-bold">{sc?.score||"—"}</td>
                <td className="text-right"><button onClick={()=>setOpen(r)} className="text-[#5867fd] text-xs hover:underline">Voir →</button></td>
              </tr>
            );})}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RiderProfile({ rider, score, onBack }) {
  const nav = useNavigate();
  const [history, setHistory] = useState([]);
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate()-14); return d.toISOString().slice(0,10); });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0,10));

  useEffect(() => {
    api.get("/orders").then(r => {
      const my = (r.data||[]).filter(o => o.rider_id === rider.id);
      setHistory(my);
    }).catch(()=>{});
  }, [rider.id]);

  const filtered = history.filter(o => {
    const d = (o.created_at||"").slice(0,10);
    return d >= from && d <= to;
  });
  const stats = {
    total: filtered.length,
    delivered: filtered.filter(o => o.status === "livree").length,
    cancelled: filtered.filter(o => ["annulee","echouee"].includes(o.status)).length,
    revenue: filtered.filter(o => o.status === "livree").reduce((s,o)=>s+(o.total||0),0),
  };

  return (
    <div className="space-y-5" data-testid="rider-profile">
      <button onClick={onBack} className="text-sm text-[#666] hover:text-[#b02a2a]">← Retour aux livreurs</button>
      <div className="dina-card-white p-5 flex items-center gap-4">
        {rider.photo ? <img src={rider.photo} className="w-20 h-20 rounded-full object-cover"/> : <div className="w-20 h-20 rounded-full bg-[#fde8e8] grid place-items-center text-2xl font-bold text-[#b02a2a]">{rider.name?.[0]}</div>}
        <div className="flex-1">
          <h1 className="font-serif text-2xl">{rider.name}</h1>
          <div className="text-sm text-[#666] flex items-center gap-3">{rider.phone && <><Phone size={11}/>{rider.phone}</>}{rider.email && <>· {rider.email}</>}</div>
        </div>
        <a href={`https://wa.me/${(rider.phone||"").replace(/\D/g,"")}`} target="_blank" rel="noreferrer" className="dina-btn-secondary !min-h-[36px] text-xs"><MessageCircle size={13}/>WhatsApp</a>
        <button onClick={() => nav(`/console/messagerie?rider_id=${rider.id}`)} className="dina-btn-primary !min-h-[36px] text-xs" data-testid="rider-internal-msg"><MessageSquare size={13}/>Messagerie interne</button>
      </div>

      {score && (
        <div className="dina-card-white p-5">
          <div className="flex items-center justify-between mb-3"><div className="font-serif text-xl">Score · {score.score}/100 · {score.level}</div></div>
          <div className="space-y-2">
            {Object.entries(score.components||{}).map(([k,v]) => {
              const label = { delivery_rate:"Livraisons réussies", punctuality:"Ponctualité", rating:"Note clientes", cash:"Exactitude caisse", proof:"Preuves complètes" }[k] || k;
              const w = (score.weights||{})[k] || 0;
              return (
                <div key={k}>
                  <div className="flex justify-between text-xs"><span className="text-[#666]">{label} · pondération {w}%</span><span className="font-semibold tabular">{v}%</span></div>
                  <div className="h-1.5 bg-[#f5f5f5] dark:bg-[#141414] rounded"><div className="h-full bg-[#b02a2a] rounded" style={{width:`${v}%`}}/></div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-[#999] mt-4 italic">35 % livraisons réussies · 20 % ponctualité · 25 % note clientes · 10 % exactitude caisse · 10 % preuves complètes.</p>
        </div>
      )}

      <div className="dina-card-white p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="font-serif text-xl">Historique · {filtered.length} commande(s)</div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs text-[#666]">Du</label>
            <input type="date" className="dina-input !py-1 text-xs" value={from} onChange={e=>setFrom(e.target.value)} data-testid="rider-hist-from"/>
            <label className="text-xs text-[#666]">au</label>
            <input type="date" className="dina-input !py-1 text-xs" value={to} onChange={e=>setTo(e.target.value)} data-testid="rider-hist-to"/>
            <button onClick={() => { const d = new Date(); setFrom(new Date(d.getTime()-6*86400000).toISOString().slice(0,10)); setTo(d.toISOString().slice(0,10)); }} className="dina-chip text-[10px]" data-testid="rider-hist-7d">7j</button>
            <button onClick={() => { const d = new Date(); setFrom(new Date(d.getTime()-29*86400000).toISOString().slice(0,10)); setTo(d.toISOString().slice(0,10)); }} className="dina-chip text-[10px]" data-testid="rider-hist-30d">30j</button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <StatMini label="Total" value={stats.total} color="#5867fd"/>
          <StatMini label="Livrées" value={stats.delivered} color="#1f8a4c"/>
          <StatMini label="Annulées" value={stats.cancelled} color="#c62828"/>
          <StatMini label="CA livré" value={stats.revenue.toLocaleString("fr-FR")+" FCFA"} color="#b02a2a" small/>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="dina-table" data-testid="rider-hist-table">
            <thead><tr><th>Date</th><th>Commande</th><th>Cliente</th><th>Zone</th><th>Statut</th><th className="text-right">Total</th></tr></thead>
            <tbody>{filtered.length === 0 ? <tr><td colSpan={6} className="text-center text-sm text-[#666] py-6">Aucune commande sur cette période</td></tr>
            : filtered.slice(0,200).map(o => (
              <tr key={o.id}>
                <td className="text-xs text-[#666]">{(o.created_at||"").slice(0,10)}</td>
                <td className="font-mono text-xs">{o.code}</td>
                <td>{o.customer?.name || "—"}</td>
                <td className="text-xs">{o.delivery_zone || "—"}</td>
                <td><span className="dina-chip text-[10px]">{o.status}</span></td>
                <td className="text-right tabular font-semibold">{o.total?.toLocaleString("fr-FR")} FCFA</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatMini({ label, value, color, small }) {
  return <div className="dina-card-white p-3"><div className="text-[9px] uppercase text-[#666] font-semibold">{label}</div><div className={`font-serif tabular leading-none mt-1 ${small?"text-sm":"text-xl"}`} style={{color}}>{value}</div></div>;
}
