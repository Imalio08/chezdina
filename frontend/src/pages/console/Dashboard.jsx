import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { TrendingUp, TrendingDown, ShoppingBag, Users, AlertTriangle, Package, Truck, Receipt, Wallet, PieChart as PieIcon, Info, Eye, X } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, CartesianGrid } from "recharts";

const PERIODS = [
  { v: "today", label: "Aujourd'hui" },
  { v: "yesterday", label: "Hier" },
  { v: "7d", label: "7 jours" },
  { v: "30d", label: "30 jours" },
  { v: "last_month", label: "Mois dernier" },
  { v: "90d", label: "90 jours" },
  { v: "year", label: "12 mois" },
];

const COLORS = ["#b02a2a","#f4b12c","#0021cc","#1f8a4c","#5867fd","#d94848","#e4991e","#1c1c1c"];

const Delta = ({ v }) => {
  if (!v && v !== 0) return null;
  const up = v >= 0;
  return <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up?"text-[#1f8a4c]":"text-[#c62828]"}`}>{up?<TrendingUp size={11}/>:<TrendingDown size={11}/>}{Math.abs(v)}%</span>;
};

function KPI({ icon:Icon, label, value, desc, delta, prev, onDetail, test, color="#b02a2a" }) {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div className="dina-card-white p-4 flex flex-col group relative" data-testid={test}>
      <div className="flex items-center justify-between mb-2">
        <div className="w-8 h-8 rounded-lg grid place-items-center" style={{background: `${color}1a`, color}}><Icon size={14}/></div>
        <button onMouseEnter={()=>setShowInfo(true)} onMouseLeave={()=>setShowInfo(false)} className="text-[#999] hover:text-[#1c1c1c]" data-testid={`${test}-info`}><Info size={12}/></button>
      </div>
      <div className="text-[10px] uppercase tracking-wider text-[#666] font-medium">{label}</div>
      <div className="font-serif text-2xl tabular font-semibold mt-1">{value}</div>
      <div className="flex items-center gap-2 mt-1 text-xs">
        <Delta v={delta}/>
        {prev !== undefined && prev !== null && <span className="text-[#999] tabular">vs {typeof prev === "number" && prev > 1000 ? fcfa(prev) : prev}</span>}
      </div>
      {onDetail && <button onClick={onDetail} className="mt-2 text-[11px] text-[#b02a2a] font-medium inline-flex items-center gap-1 opacity-70 hover:opacity-100" data-testid={`${test}-detail`}><Eye size={11}/>Voir détails</button>}
      {showInfo && desc && <div className="absolute left-0 right-0 bottom-full mb-2 bg-[#1c1c1c] text-white text-xs rounded-lg p-2.5 shadow-xl z-10">{desc}</div>}
    </div>
  );
}

function DetailModal({ kind, period, onClose }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get(`/dashboard/drill/${kind}?period=${period}`).then(r=>setRows(r.data)); }, [kind, period]);
  const titles = { orders: "Commandes", customers_new: "Nouvelles clientes", delivered: "Commandes livrées", low_stock: "Stock faible", pending: "Commandes en cours", expenses: "Dépenses" };
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4"><div><div className="font-serif text-xl">{titles[kind]}</div><div className="text-xs text-[#666]">{rows?.length||0} éléments</div></div><button onClick={onClose}><X size={16}/></button></div>
        {!rows ? <div className="text-sm text-[#666]">Chargement…</div> : (
          <div className="space-y-2">{rows.map(r=>(
            <div key={r.id} className="p-3 border border-[#ececec] rounded-lg flex items-center gap-3">
              {r.image && <div className="w-10 h-10 bg-[#fff5f5] rounded overflow-hidden"><img src={r.image} alt="" className="w-full h-full object-cover"/></div>}
              <div className="flex-1"><div className="font-medium text-sm">{r.code || r.name || r.category}</div><div className="text-xs text-[#666]">{r.customer?.name || r.phone || r.note || r.sku}</div></div>
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
  const [period, setPeriod] = useState("30d");
  const [k, setK] = useState(null);
  const [detail, setDetail] = useState(null);
  useEffect(() => { setK(null); api.get(`/dashboard/kpis?period=${period}`).then(r=>setK(r.data)); }, [period]);
  if (!k) return <div className="text-sm text-[#666]">Chargement…</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-3xl">Tableau de bord</h1>
          <p className="text-sm text-[#666] mt-1">Vue d'ensemble en temps réel · comparaison vs période précédente</p>
        </div>
        <div className="flex gap-1 flex-wrap bg-[#f5f5f5] p-1 rounded-xl" data-testid="period-filter">
          {PERIODS.map(p=><button key={p.v} onClick={()=>setPeriod(p.v)} className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${period===p.v?"bg-white shadow-sm text-[#1c1c1c]":"text-[#666] hover:text-[#1c1c1c]"}`} data-testid={`period-${p.v}`}>{p.label}</button>)}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        <KPI icon={TrendingUp} label="CA période" value={fcfa(k.revenue.value)} desc={k.revenue.description} delta={k.revenue.delta} prev={k.revenue.prev} test="kpi-rev" color="#b02a2a"/>
        <KPI icon={Receipt} label="Commandes" value={k.orders_count.value} desc={k.orders_count.description} delta={k.orders_count.delta} prev={k.orders_count.prev} onDetail={()=>setDetail("orders")} test="kpi-orders" color="#0021cc"/>
        <KPI icon={ShoppingBag} label="Articles vendus" value={k.items_sold.value} desc={k.items_sold.description} delta={k.items_sold.delta} prev={k.items_sold.prev} test="kpi-items" color="#f4b12c"/>
        <KPI icon={Wallet} label="Panier moyen" value={fcfa(k.avg_basket.value)} desc={k.avg_basket.description} delta={k.avg_basket.delta} prev={k.avg_basket.prev} test="kpi-basket" color="#5867fd"/>
        <KPI icon={Users} label="Nouvelles clientes" value={k.customers_new.value} desc={k.customers_new.description} delta={k.customers_new.delta} prev={k.customers_new.prev} onDetail={()=>setDetail("customers_new")} test="kpi-customers" color="#1f8a4c"/>
        <KPI icon={Truck} label="Livrées" value={k.delivered.value} desc={k.delivered.description} delta={k.delivered.delta} prev={k.delivered.prev} onDetail={()=>setDetail("delivered")} test="kpi-delivered" color="#1f8a4c"/>
        <KPI icon={Receipt} label="En cours" value={k.pending_orders.value} desc={k.pending_orders.description} onDetail={()=>setDetail("pending")} test="kpi-pending" color="#e4991e"/>
        <KPI icon={AlertTriangle} label="Stock faible" value={k.low_stock.value} desc={k.low_stock.description} onDetail={()=>setDetail("low_stock")} test="kpi-stock" color="#c62828"/>
        <KPI icon={Wallet} label="Dépenses" value={fcfa(k.expenses.value)} desc={k.expenses.description} onDetail={()=>setDetail("expenses")} test="kpi-expenses" color="#c62828"/>
        <KPI icon={TrendingUp} label="Marge brute" value={fcfa(k.margin.value)} desc={k.margin.description} test="kpi-margin" color="#b02a2a"/>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 dina-card-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div><div className="font-semibold">Évolution du CA & commandes</div><div className="text-xs text-[#666]">Comparaison des deux séries sur la période</div></div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={k.sales_series} margin={{top:5,right:10,left:0,bottom:5}}>
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b02a2a" stopOpacity={0.4}/><stop offset="100%" stopColor="#b02a2a" stopOpacity={0}/></linearGradient>
                <linearGradient id="gOrd" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f4b12c" stopOpacity={0.3}/><stop offset="100%" stopColor="#f4b12c" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid stroke="#f0f0f0" vertical={false}/>
              <XAxis dataKey="date" fontSize={11} stroke="#999"/>
              <YAxis yAxisId="l" fontSize={11} stroke="#999" tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
              <YAxis yAxisId="r" orientation="right" fontSize={11} stroke="#999"/>
              <Tooltip formatter={(v,n)=>n==="revenue"?fcfa(v):v} contentStyle={{borderRadius:8,border:"1px solid #ececec",fontSize:12}}/>
              <Legend wrapperStyle={{fontSize:11, paddingTop:8}}/>
              <Area yAxisId="l" type="monotone" dataKey="revenue" name="CA" stroke="#b02a2a" strokeWidth={2} fill="url(#gRev)"/>
              <Area yAxisId="r" type="monotone" dataKey="orders" name="Commandes" stroke="#f4b12c" strokeWidth={2} fill="url(#gOrd)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="dina-card-white p-5">
          <div className="font-semibold mb-1">Ventes par canal</div>
          <div className="text-xs text-[#666] mb-3">Boutique physique, web, WhatsApp, social</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={k.channels} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                {k.channels.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
              </Pie>
              <Tooltip formatter={(v)=>fcfa(v)}/>
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 text-xs mt-2">
            {k.channels.map((c,i)=><div key={c.name} className="flex items-center justify-between"><span className="flex items-center gap-2 capitalize"><span className="status-dot" style={{background:COLORS[i%COLORS.length]}}/>{c.name}</span><span className="tabular">{fcfa(c.value)}</span></div>)}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-1">Top 5 produits</div>
          <div className="text-xs text-[#666] mb-3">Classement par quantité vendue sur la période</div>
          <div className="space-y-2">
            {k.top_products.map((p,i)=>(
              <div key={i} className="flex items-center gap-3" data-testid={`top-product-${i}`}>
                <div className="text-xs font-bold w-5 text-[#999]">#{i+1}</div>
                <div className="w-10 h-10 rounded-lg bg-[#fff5f5] overflow-hidden">{p.image && <img src={p.image} alt="" className="w-full h-full object-cover"/>}</div>
                <div className="flex-1 min-w-0"><div className="truncate text-sm font-medium">{p.name}</div><div className="text-xs text-[#666]">{p.qty} vendus</div></div>
                <div className="tabular text-sm font-semibold">{fcfa(p.revenue)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="dina-card-white p-5">
          <div className="font-semibold mb-1">Modes de paiement</div>
          <div className="text-xs text-[#666] mb-3">Répartition du CA par moyen de paiement</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={k.payments} layout="vertical" margin={{left:20}}>
              <CartesianGrid stroke="#f0f0f0" horizontal={false}/>
              <XAxis type="number" fontSize={11} stroke="#999" tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
              <YAxis type="category" dataKey="name" fontSize={11} stroke="#999" width={70}/>
              <Tooltip formatter={v=>fcfa(v)} contentStyle={{borderRadius:8,fontSize:12}}/>
              <Bar dataKey="value" fill="#b02a2a" radius={[0,6,6,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {detail && <DetailModal kind={detail} period={period} onClose={()=>setDetail(null)}/>}
    </div>
  );
}
