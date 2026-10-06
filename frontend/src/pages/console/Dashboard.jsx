import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { TrendingUp, ShoppingBag, Users, AlertTriangle, Truck, Receipt, Wallet, Package, X, RefreshCw, Percent, ArrowRight, ChevronRight, Clock } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, LineChart, Line } from "recharts";
import PeriodSelector from "@/components/shared/PeriodSelector";
import KPICard from "@/components/shared/KPICard";
import ActionItems from "@/components/dashboard/ActionItems";

const COLORS = ["#b02a2a","#f4b12c","#0021cc","#1f8a4c","#5867fd","#d94848","#e4991e","#1c1c1c"];
const STATUS_COLORS = { orders: "#5867fd", delivered: "#1f8a4c", cancelled: "#c62828", deferred: "#e4991e" };

const PERIOD_LABELS = {
  today: "hier", yesterday: "avant-hier", this_week: "la semaine dernière", last_week: "la semaine d'avant",
  last7: "les 7 jours précédents", last30: "les 30 jours précédents", this_month: "le mois dernier",
  last_month: "le mois d'avant", this_quarter: "le trimestre dernier", this_year: "l'an dernier", all: "la période précédente",
};
const toBackendPeriod = (p) => ({ today:"today", yesterday:"yesterday", this_week:"7d", last_week:"7d", last7:"7d", last30:"30d", this_month:"30d", last_month:"last_month", this_quarter:"90d", last_quarter:"90d", this_year:"year", last_year:"year", all:"year" }[p] || "30d");

function DetailModal({ kind, period, onClose }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get(`/dashboard/drill/${kind}?period=${period}`).then(r=>setRows(r.data)).catch(()=>setRows([])); }, [kind, period]);
  const titles = { orders:"Commandes", customers_new:"Nouvelles clientes", delivered:"Commandes livrées", low_stock:"Stock faible", pending:"Commandes en cours", expenses:"Dépenses" };
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4"><div><div className="font-serif text-xl">{titles[kind]||kind}</div><div className="text-xs text-[#666]">{rows?.length||0} éléments</div></div><button onClick={onClose}><X size={16}/></button></div>
        {!rows ? <div className="text-sm text-[#666]">Chargement…</div> : rows.length===0 ? <div className="text-sm text-[#666] text-center py-8">Aucune donnée</div> : (
          <div className="space-y-2">{rows.map(r=>(
            <div key={r.id} className="p-3 border border-[#ececec] dark:border-[#2a2a2a] rounded-lg flex items-center gap-3">
              {r.image && <div className="w-10 h-10 bg-[#fff5f5] rounded overflow-hidden"><img src={r.image} alt="" className="w-full h-full object-cover"/></div>}
              <div className="flex-1 min-w-0"><div className="font-medium text-sm truncate">{r.code || r.name || r.category}</div><div className="text-xs text-[#666] truncate">{r.customer?.name || r.phone || r.note || r.sku}</div></div>
              {r.total !== undefined && <div className="tabular font-semibold">{fcfa(r.total)}</div>}
              {r.amount !== undefined && <div className="tabular font-semibold">{fcfa(r.amount)}</div>}
              {r.stock !== undefined && <div className="dina-chip" style={{color:"#c62828"}}>{r.stock} en stock</div>}
            </div>
          ))}</div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [preset, setPreset] = useState("last30");
  const [comparison, setComparison] = useState("prev");
  const [custom, setCustom] = useState({ from:"", to:"" });
  const [k, setK] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const backendPeriod = toBackendPeriod(preset);
  const vs = PERIOD_LABELS[preset] || "la période précédente";

  const load = () => { setLoading(true); api.get(`/dashboard/kpis?period=${backendPeriod}`).then(r=>setK(r.data)).finally(()=>setLoading(false)); };
  useEffect(load, [backendPeriod]); // eslint-disable-line

  const asOfLabel = useMemo(() => {
    if (!k?.generated_at) return "—";
    const d = new Date(k.generated_at);
    const diff = Math.round((Date.now() - d.getTime()) / 60000);
    return `${d.toLocaleString("fr-FR", { dateStyle:"medium", timeStyle:"short" })} (il y a ${diff} min)`;
  }, [k]);

  if (loading && !k) return <div className="text-sm text-[#666]">Chargement du tableau de bord…</div>;
  if (!k) return <div className="text-sm text-[#666]">Aucune donnée</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-3xl">Tableau de bord</h1>
          <p className="text-sm text-[#666] mt-1">Chiffres au {asOfLabel} · comparaison vs {vs}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PeriodSelector value={preset} onChange={setPreset} comparison={comparison} onComparisonChange={setComparison} customFrom={custom.from} customTo={custom.to} onCustomChange={setCustom}/>
          <button onClick={load} className="dina-chip !py-2 !px-3" data-testid="dashboard-refresh" title="Actualiser"><RefreshCw size={12} className={loading ? "animate-spin" : ""}/>Actualiser</button>
        </div>
      </div>

      {/* Row 1 — À traiter */}
      <ActionItems/>

      {/* Row 2 — Ventes global */}
      <div className="space-y-1 pt-2">
        <div className="font-semibold text-sm">Ventes</div>
        <div className="text-xs text-[#666]">Chiffre d'affaires, marge, panier, articles — vs {vs}</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KPICard label="CA période" value={fcfa(k.revenue.value)} previousValue={k.revenue.prev} info={k.revenue.description} icon={TrendingUp} color="#b02a2a" deltaLabel={`vs ${vs}`} hero/>
        <KPICard label="Commandes" value={k.orders_count.value} previousValue={k.orders_count.prev} info={k.orders_count.description} icon={Receipt} color="#0021cc" deltaLabel={`vs ${vs}`}/>
        <KPICard label="Articles vendus" value={k.items_sold.value} previousValue={k.items_sold.prev} info={k.items_sold.description} icon={ShoppingBag} color="#f4b12c" deltaLabel={`vs ${vs}`}/>
        <KPICard label="Panier moyen" value={fcfa(k.avg_basket.value)} previousValue={k.avg_basket.prev} info={k.avg_basket.description} icon={Wallet} color="#5867fd" deltaLabel={`vs ${vs}`}/>
        <KPICard label="Marge brute" value={fcfa(k.margin.value)} previousValue={k.margin.prev} info={k.margin.description} icon={TrendingUp} color="#1f8a4c" deltaLabel={`vs ${vs}`}/>
        <KPICard label="Taux d'annulation" value={`${k.cancel_rate.value}%`} previousValue={k.cancel_rate.prev !== undefined ? `${k.cancel_rate.prev}%` : undefined} info={k.cancel_rate.description} icon={AlertTriangle} color="#c62828" inverse deltaLabel={`vs ${vs}`}/>
      </div>

      {/* Row 3 — Par catégorie */}
      <div className="dina-card-white p-5" data-testid="dashboard-by-category">
        <div className="flex items-center justify-between mb-3">
          <div><div className="font-semibold">Par catégorie</div><div className="text-xs text-[#666]">CA, commandes et marge, trié par CA</div></div>
          <Link to="/console/statistiques?tab=categories" className="text-xs text-[#b02a2a] hover:underline flex items-center gap-1">Voir dans les statistiques <ChevronRight size={12}/></Link>
        </div>
        {(k.by_category || []).length === 0 ? <div className="text-sm text-[#666] text-center py-6">Aucune donnée sur cette période</div> : (
          <div className="overflow-x-auto">
            <table className="dina-table">
              <thead><tr><th>Catégorie</th><th className="text-right">CA</th><th className="text-right">Commandes</th><th className="text-right">Articles</th><th className="text-right">Panier moy.</th><th className="text-right">Marge</th><th className="text-right">Évolution</th></tr></thead>
              <tbody>{(k.by_category || []).slice(0, 10).map(c => (
                <tr key={c.category} data-testid={`cat-row-${c.category}`}>
                  <td className="font-medium">{c.category}</td>
                  <td className="text-right tabular font-semibold">{fcfa(c.revenue)}</td>
                  <td className="text-right tabular">{c.orders}</td>
                  <td className="text-right tabular">{c.items}</td>
                  <td className="text-right tabular">{fcfa(c.avg_basket)}</td>
                  <td className="text-right tabular"><span className={c.margin_pct >= 30 ? "text-[#1f8a4c]" : c.margin_pct < 15 ? "text-[#c62828]" : "text-[#e4991e]"}>{fcfa(c.margin)} · {c.margin_pct}%</span></td>
                  <td className="text-right tabular"><span className={c.delta_pct >= 0 ? "text-[#1f8a4c]" : "text-[#c62828]"}>{c.delta_pct >= 0 ? "+" : ""}{c.delta_pct}%</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      {/* Charts: CA & marge + Status split */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="dina-card-white p-5">
          <div className="font-semibold">CA & marge par jour</div>
          <div className="text-xs text-[#666] mb-3">Chiffre d'affaires et marge brute quotidienne</div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={k.sales_series} margin={{top:5,right:10,left:0,bottom:5}}>
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b02a2a" stopOpacity={0.4}/><stop offset="100%" stopColor="#b02a2a" stopOpacity={0}/></linearGradient>
                <linearGradient id="gMgn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1f8a4c" stopOpacity={0.3}/><stop offset="100%" stopColor="#1f8a4c" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid stroke="#f0f0f0" vertical={false}/>
              <XAxis dataKey="date" fontSize={11} stroke="#999"/>
              <YAxis fontSize={11} stroke="#999" tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
              <Tooltip formatter={(v,n)=>[fcfa(v), n]} contentStyle={{borderRadius:8,fontSize:12}}/>
              <Legend wrapperStyle={{fontSize:11, paddingTop:8}} verticalAlign="bottom"/>
              <Area type="monotone" dataKey="revenue" name="CA" stroke="#b02a2a" strokeWidth={2} fill="url(#gRev)"/>
              <Area type="monotone" dataKey="margin" name="Marge brute" stroke="#1f8a4c" strokeWidth={2} fill="url(#gMgn)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="dina-card-white p-5">
          <div className="font-semibold">Commandes par statut (jour)</div>
          <div className="text-xs text-[#666] mb-3">Passées · livrées · annulées · reportées</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={k.sales_series} margin={{top:5,right:10,left:0,bottom:5}}>
              <CartesianGrid stroke="#f0f0f0" vertical={false}/>
              <XAxis dataKey="date" fontSize={11} stroke="#999"/>
              <YAxis fontSize={11} stroke="#999" allowDecimals={false}/>
              <Tooltip contentStyle={{borderRadius:8,fontSize:12}}/>
              <Legend wrapperStyle={{fontSize:11, paddingTop:8}} verticalAlign="bottom"/>
              <Line type="monotone" dataKey="orders" name="Passées" stroke={STATUS_COLORS.orders} strokeWidth={2} dot={false}/>
              <Line type="monotone" dataKey="delivered" name="Livrées" stroke={STATUS_COLORS.delivered} strokeWidth={2} dot={false}/>
              <Line type="monotone" dataKey="cancelled" name="Annulées" stroke={STATUS_COLORS.cancelled} strokeWidth={2} dot={false}/>
              <Line type="monotone" dataKey="deferred" name="Reportées" stroke={STATUS_COLORS.deferred} strokeWidth={2} dot={false}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Channels + Top 5 */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="dina-card-white p-5">
          <div className="font-semibold">Ventes par canal</div>
          <div className="text-xs text-[#666] mb-3">Boutique, web, WhatsApp, social</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={k.channels} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                {k.channels.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
              </Pie>
              <Tooltip formatter={v=>fcfa(v)} contentStyle={{fontSize:12}}/>
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 text-xs mt-2">
            {(k.channels || []).map((c,i)=><div key={c.name} className="flex items-center justify-between"><span className="flex items-center gap-2 capitalize"><span className="status-dot" style={{background:COLORS[i%COLORS.length]}}/>{c.name}</span><span className="tabular">{fcfa(c.value)}</span></div>)}
          </div>
        </div>

        <div className="lg:col-span-2 dina-card-white p-5">
          <div className="flex items-center justify-between mb-3">
            <div><div className="font-semibold">Top 5 produits</div><div className="text-xs text-[#666]">Classement par quantité vendue</div></div>
            <Link to="/console/statistiques?tab=products" className="text-xs text-[#b02a2a] hover:underline flex items-center gap-1">Voir plus <ChevronRight size={12}/></Link>
          </div>
          <div className="space-y-2">
            {(k.top_products || []).map((p,i)=>(
              <div key={i} className="flex items-center gap-3" data-testid={`top-product-${i}`}>
                <div className="text-xs font-bold w-5 text-[#999]">#{i+1}</div>
                <div className="w-10 h-10 rounded-lg bg-[#fff5f5] overflow-hidden">{p.image && <img src={p.image} alt="" className="w-full h-full object-cover"/>}</div>
                <div className="flex-1 min-w-0"><div className="truncate text-sm font-medium">{p.name}</div><div className="text-xs text-[#666]">{p.qty} vendus</div></div>
                <div className="tabular text-sm font-semibold">{fcfa(p.revenue)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dina-card-white p-4">
        <div className="text-xs uppercase text-[#666] font-semibold mb-2">Accès rapides</div>
        <div className="flex flex-wrap gap-2">
          <button onClick={()=>setDetail("orders")} className="dina-chip" data-testid="quick-orders">Commandes</button>
          <button onClick={()=>setDetail("customers_new")} className="dina-chip" data-testid="quick-customers">Nouvelles clientes</button>
          <button onClick={()=>setDetail("delivered")} className="dina-chip" data-testid="quick-delivered">Livrées</button>
          <button onClick={()=>setDetail("pending")} className="dina-chip" data-testid="quick-pending">En cours</button>
          <button onClick={()=>setDetail("low_stock")} className="dina-chip" data-testid="quick-stock">Stock faible</button>
          <button onClick={()=>setDetail("expenses")} className="dina-chip" data-testid="quick-expenses">Dépenses</button>
        </div>
      </div>

      {detail && <DetailModal kind={detail} period={backendPeriod} onClose={()=>setDetail(null)}/>}
    </div>
  );
}
