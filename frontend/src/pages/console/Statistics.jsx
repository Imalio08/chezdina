import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend, AreaChart, Area } from "recharts";
import { toast } from "sonner";

const PERIODS = [{v:"7d",label:"7 jours"},{v:"30d",label:"30 jours"},{v:"last_month",label:"Mois dernier"},{v:"90d",label:"90 jours"},{v:"year",label:"12 mois"}];
const COLORS = ["#b02a2a","#f4b12c","#0021cc","#1f8a4c","#5867fd","#d94848","#e4991e","#1c1c1c"];

export default function Statistics() {
  const [period, setPeriod] = useState("30d");
  const [s, setS] = useState(null);
  useEffect(() => { setS(null); api.get(`/stats/full?period=${period}`).then(r=>setS(r.data)).catch(()=>toast.error("Erreur")); }, [period]);
  if (!s) return <div className="text-sm text-[#666]">Chargement…</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="font-serif text-3xl">Statistiques</h1><p className="text-sm text-[#666]">Rapports détaillés · ventes, produits, clientes, finances</p></div>
        <div className="flex gap-1 bg-[#f5f5f5] p-1 rounded-xl">{PERIODS.map(p=><button key={p.v} onClick={()=>setPeriod(p.v)} className={`px-3 py-1.5 text-xs rounded-lg font-medium ${period===p.v?"bg-white shadow-sm":"text-[#666]"}`} data-testid={`stats-period-${p.v}`}>{p.label}</button>)}</div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">CA</div><div className="font-serif text-2xl tabular">{fcfa(s.revenue)}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Coût marchandises</div><div className="font-serif text-2xl tabular">{fcfa(s.cost_of_goods)}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Marge brute</div><div className="font-serif text-2xl tabular text-[#1f8a4c]">{fcfa(s.gross_margin)}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Dépenses</div><div className="font-serif text-2xl tabular text-[#c62828]">{fcfa(s.expenses)}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Commandes</div><div className="font-serif text-2xl tabular">{s.orders_count}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Panier moyen</div><div className="font-serif text-2xl tabular">{fcfa(s.avg_basket)}</div></div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-1">Ventes par heure</div>
          <div className="text-xs text-[#666] mb-3">Repérez vos pics d'activité</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={s.by_hour}><CartesianGrid stroke="#f0f0f0" vertical={false}/><XAxis dataKey="h" fontSize={10} stroke="#999"/><YAxis fontSize={10} stroke="#999" tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/><Tooltip formatter={v=>fcfa(v)} contentStyle={{fontSize:12}}/><Bar dataKey="value" fill="#b02a2a" radius={[4,4,0,0]}/></BarChart>
          </ResponsiveContainer>
        </div>
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-1">CA par catégorie</div>
          <div className="text-xs text-[#666] mb-3">Chaussures, Robes, Sacs, Accessoires…</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart><Pie data={s.cat_rev} dataKey="value" nameKey="name" outerRadius={85} innerRadius={45}>{s.cat_rev.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip formatter={v=>fcfa(v)}/><Legend wrapperStyle={{fontSize:10}}/></PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-1">Top pointures / tailles vendues</div>
          <div className="text-xs text-[#666] mb-3">Guide vos commandes fournisseurs</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={s.size_sales} layout="vertical"><CartesianGrid stroke="#f0f0f0"/><XAxis type="number" fontSize={10}/><YAxis type="category" dataKey="name" fontSize={11} width={40}/><Tooltip contentStyle={{fontSize:12}}/><Bar dataKey="value" fill="#f4b12c" radius={[0,4,4,0]}/></BarChart>
          </ResponsiveContainer>
        </div>
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-1">Top couleurs</div>
          <div className="text-xs text-[#666] mb-3">Les plus demandées sur la période</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={s.color_sales.slice(0,8)} layout="vertical"><CartesianGrid stroke="#f0f0f0"/><XAxis type="number" fontSize={10}/><YAxis type="category" dataKey="name" fontSize={11} width={80}/><Tooltip contentStyle={{fontSize:12}}/><Bar dataKey="value" fill="#0021cc" radius={[0,4,4,0]}/></BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Top 10 produits</div>
          <table className="dina-table">
            <thead><tr><th>#</th><th>Produit</th><th className="text-right">Qté</th><th className="text-right">CA</th></tr></thead>
            <tbody>{s.top10.map((p,i)=><tr key={i}><td className="tabular text-[#999]">#{i+1}</td><td className="font-medium">{p.name}</td><td className="text-right tabular">{p.qty}</td><td className="text-right tabular font-semibold">{fcfa(p.revenue)}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-1">Clientes</div>
          <div className="text-xs text-[#666] mb-3">Vue d'ensemble du portefeuille</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 bg-[#fff5f5] rounded-lg"><div className="text-[10px] uppercase text-[#666]">Total</div><div className="font-serif text-xl tabular">{s.customers_total}</div></div>
            <div className="p-3 bg-[#fff5f5] rounded-lg"><div className="text-[10px] uppercase text-[#666]">Fidèles (achat récent)</div><div className="font-serif text-xl tabular text-[#1f8a4c]">{s.customers_returning}</div></div>
            <div className="p-3 bg-[#fff5f5] rounded-lg"><div className="text-[10px] uppercase text-[#666]">Inactives (30j+)</div><div className="font-serif text-xl tabular text-[#c62828]">{s.customers_inactive}</div></div>
          </div>
          <div className="mt-4"><div className="text-xs uppercase text-[#666] mb-2">Ventes par canal</div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={s.channels}><CartesianGrid stroke="#f0f0f0" vertical={false}/><XAxis dataKey="name" fontSize={10}/><YAxis fontSize={10} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/><Tooltip formatter={v=>fcfa(v)}/><Bar dataKey="value" fill="#b02a2a" radius={[4,4,0,0]}/></BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Dépenses par catégorie</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={s.exp_by_cat}><CartesianGrid stroke="#f0f0f0" vertical={false}/><XAxis dataKey="name" fontSize={10}/><YAxis fontSize={10} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/><Tooltip formatter={v=>fcfa(v)} contentStyle={{fontSize:12}}/><Bar dataKey="value" fill="#c62828" radius={[4,4,0,0]}/></BarChart>
          </ResponsiveContainer>
        </div>
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Statuts commandes</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart><Pie data={s.statuses} dataKey="value" nameKey="name" outerRadius={85}>{s.statuses.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip/><Legend wrapperStyle={{fontSize:10}}/></PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
