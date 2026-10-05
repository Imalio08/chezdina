import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa, statusLabel, statusColor } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { TrendingUp, ShoppingBag, Users, AlertTriangle, Package, Truck, Receipt } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, BarChart, Bar } from "recharts";

const KPI = ({ icon: Icon, label, value, sub, test }) => (
  <div className="dina-card-white p-5" data-testid={test}>
    <div className="flex items-center justify-between mb-3"><div className="text-xs uppercase tracking-wider text-[#666] font-medium">{label}</div><Icon size={16} className="text-[#666]"/></div>
    <div className="font-serif text-2xl tabular font-semibold">{value}</div>
    {sub && <div className="text-xs text-[#1f8a4c] mt-1">{sub}</div>}
  </div>
);

export default function Dashboard() {
  const { storeId } = useApp();
  const [k, setK] = useState(null);
  useEffect(() => { api.get(`/dashboard/kpis?store_id=${storeId}`).then(r=>setK(r.data)); }, [storeId]);
  if (!k) return <div className="text-sm text-[#666]">Chargement…</div>;
  const COLORS = ["#f4b12c","#0021cc","#3242e8","#5867fd","#1c1c1c","#1f8a4c"];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">Tableau de bord</h1>
          <p className="text-sm text-[#666] mt-1">Vue d'ensemble en temps réel · Africa/Abidjan</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI icon={TrendingUp} label="CA aujourd'hui" value={fcfa(k.rev_today)} sub={`${k.orders_count} commandes au total`} test="kpi-rev-today"/>
        <KPI icon={TrendingUp} label="CA 7 jours" value={fcfa(k.rev_week)} test="kpi-rev-week"/>
        <KPI icon={TrendingUp} label="CA 30 jours" value={fcfa(k.rev_month)} sub={`Panier moyen ${fcfa(k.avg_basket)}`} test="kpi-rev-month"/>
        <KPI icon={ShoppingBag} label="Articles vendus" value={k.items_sold} test="kpi-items"/>
        <KPI icon={Users} label="Nouveaux clients" value={k.customers_new} test="kpi-customers"/>
        <KPI icon={Package} label="Stock faible" value={k.low_stock} sub="à réapprovisionner" test="kpi-low-stock"/>
        <KPI icon={Receipt} label="Commandes en cours" value={k.pending_orders} test="kpi-pending"/>
        <KPI icon={Truck} label="Livraisons actives" value={k.pending_orders} test="kpi-deliveries"/>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 dina-card-white p-5">
          <div className="flex items-center justify-between mb-4"><div className="font-semibold">Chiffre d'affaires · 14 derniers jours</div></div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={k.sales_series}>
              <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f4b12c" stopOpacity={0.4}/><stop offset="100%" stopColor="#f4b12c" stopOpacity={0}/></linearGradient></defs>
              <XAxis dataKey="date" fontSize={11} stroke="#999"/>
              <YAxis fontSize={11} stroke="#999" tickFormatter={(v)=>`${(v/1000).toFixed(0)}k`}/>
              <Tooltip formatter={(v)=>fcfa(v)} contentStyle={{borderRadius:8, border:"1px solid #ececec"}}/>
              <Area type="monotone" dataKey="value" stroke="#f4b12c" strokeWidth={2} fill="url(#g)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-4">Ventes par canal</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={k.channels} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {k.channels.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
              </Pie>
              <Tooltip formatter={(v)=>fcfa(v)}/>
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-2 text-xs">
            {k.channels.map((c,i)=>(
              <div key={c.name} className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="status-dot" style={{background:COLORS[i%COLORS.length]}}/>{c.name}</span><span className="tabular">{fcfa(c.value)}</span></div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-4">Top 5 produits</div>
          <div className="space-y-3">
            {k.top_products.map((p,i)=>(
              <div key={i} className="flex items-center gap-3" data-testid={`top-product-${i}`}>
                <div className="w-10 h-10 rounded-lg bg-[#f5f5f5] overflow-hidden">{p.image && <img src={p.image} alt="" className="w-full h-full object-cover"/>}</div>
                <div className="flex-1 min-w-0"><div className="truncate text-sm font-medium">{p.name}</div><div className="text-xs text-[#666]">{p.qty} vendus</div></div>
                <div className="tabular text-sm font-semibold">{fcfa(p.revenue)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle size={16} className="text-[#e4991e]"/>Alertes</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between p-3 bg-[#fff8e9] rounded-lg border border-[#ffdc98]"><span>Stock faible</span><strong>{k.low_stock} variantes</strong></div>
            <div className="flex justify-between p-3 bg-[#f5f5f5] rounded-lg border border-[#ececec]"><span>Commandes à confirmer</span><strong>{k.pending_orders}</strong></div>
            <div className="flex justify-between p-3 bg-[#f5f5f5] rounded-lg border border-[#ececec]"><span>Factures impayées</span><strong>2</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
}
