import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { toast } from "sonner";
import { Map, TrendingUp, Package, Users, Truck } from "lucide-react";

const PERIODS = [{v:"7d",label:"7 jours"},{v:"30d",label:"30 jours"},{v:"last_month",label:"Mois dernier"},{v:"90d",label:"90 jours"},{v:"year",label:"12 mois"}];
const COLORS = ["#b02a2a","#f4b12c","#0021cc","#1f8a4c","#5867fd","#d94848","#e4991e","#1c1c1c"];
const TABS = [
  { k:"ventes", label:"Ventes & produits", icon:TrendingUp },
  { k:"zones", label:"Zones géographiques", icon:Map },
  { k:"clients", label:"Clientes", icon:Users },
  { k:"livraisons", label:"Livraisons", icon:Truck },
  { k:"finances", label:"Finances", icon:Package },
];

export default function Statistics() {
  const [period, setPeriod] = useState("30d");
  const [tab, setTab] = useState("ventes");
  const [s, setS] = useState(null);
  const [zones, setZones] = useState(null);
  useEffect(() => { setS(null); api.get(`/stats/full?period=${period}`).then(r=>setS(r.data)).catch(()=>toast.error("Erreur")); }, [period]);
  useEffect(() => { if (tab==="zones") { setZones(null); api.get(`/stats/zones?period=${period}`).then(r=>setZones(r.data)); } }, [tab, period]);
  if (!s) return <div className="text-sm text-[#666]">Chargement…</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="font-serif text-3xl">Statistiques</h1><p className="text-sm text-[#666]">Bibliothèque de rapports · ventes, clientes, zones, livraisons, finances</p></div>
        <div className="flex gap-1 bg-[#f5f5f5] dark:bg-[#141414] p-1 rounded-xl">{PERIODS.map(p=><button key={p.v} onClick={()=>setPeriod(p.v)} className={`px-3 py-1.5 text-xs rounded-lg font-medium ${period===p.v?"bg-white dark:bg-[#2a2a2a] shadow-sm":"text-[#666]"}`} data-testid={`stats-period-${p.v}`}>{p.label}</button>)}</div>
      </div>

      <div className="flex gap-1 border-b border-[#ececec] dark:border-[#2a2a2a] overflow-x-auto">
        {TABS.map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition ${tab===t.k?"border-[#b02a2a] text-[#b02a2a]":"border-transparent text-[#666] hover:text-[#1c1c1c] dark:hover:text-white"}`} data-testid={`stats-tab-${t.k}`}>
            <t.icon size={13}/>{t.label}
          </button>
        ))}
      </div>

      {tab === "ventes" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">CA</div><div className="font-serif text-2xl tabular">{fcfa(s.revenue)}</div></div>
            <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Coût marchandises</div><div className="font-serif text-2xl tabular">{fcfa(s.cost_of_goods)}</div></div>
            <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Marge brute</div><div className="font-serif text-2xl tabular text-[#1f8a4c]">{fcfa(s.gross_margin)}</div></div>
            <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Taux de marge</div><div className="font-serif text-2xl tabular">{s.revenue?((s.gross_margin/s.revenue)*100).toFixed(1):0}%</div></div>
            <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Commandes</div><div className="font-serif text-2xl tabular">{s.orders_count}</div></div>
            <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Panier moyen</div><div className="font-serif text-2xl tabular">{fcfa(s.avg_basket)}</div></div>
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="dina-card-white p-5"><div className="font-semibold mb-1">Ventes par heure</div><div className="text-xs text-[#666] mb-3">Repérez vos pics d'activité</div><ResponsiveContainer width="100%" height={240}><BarChart data={s.by_hour}><CartesianGrid stroke="#f0f0f0" vertical={false}/><XAxis dataKey="h" fontSize={10}/><YAxis fontSize={10} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/><Tooltip formatter={v=>fcfa(v)}/><Legend wrapperStyle={{fontSize:10}}/><Bar dataKey="value" name="CA" fill="#b02a2a" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
            <div className="dina-card-white p-5"><div className="font-semibold mb-1">CA par catégorie</div><ResponsiveContainer width="100%" height={240}><PieChart><Pie data={s.cat_rev} dataKey="value" nameKey="name" outerRadius={85} innerRadius={45}>{s.cat_rev.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip formatter={v=>fcfa(v)}/><Legend wrapperStyle={{fontSize:10}}/></PieChart></ResponsiveContainer></div>
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="dina-card-white p-5"><div className="font-semibold mb-1">Top pointures</div><div className="text-xs text-[#666] mb-3">Tailles les plus vendues</div><ResponsiveContainer width="100%" height={240}><BarChart data={s.size_sales} layout="vertical"><CartesianGrid stroke="#f0f0f0"/><XAxis type="number" fontSize={10}/><YAxis type="category" dataKey="name" fontSize={11} width={40}/><Tooltip/><Legend wrapperStyle={{fontSize:10}}/><Bar dataKey="value" name="Unités" fill="#f4b12c" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer></div>
            <div className="dina-card-white p-5"><div className="font-semibold mb-1">Top couleurs</div><ResponsiveContainer width="100%" height={240}><BarChart data={s.color_sales.slice(0,8)} layout="vertical"><CartesianGrid stroke="#f0f0f0"/><XAxis type="number" fontSize={10}/><YAxis type="category" dataKey="name" fontSize={11} width={80}/><Tooltip/><Legend wrapperStyle={{fontSize:10}}/><Bar dataKey="value" name="Unités" fill="#0021cc" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer></div>
          </div>
        </>
      )}

      {tab === "zones" && (
        !zones ? <div className="text-sm text-[#666]">Chargement des zones…</div> : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Zones actives</div><div className="font-serif text-2xl tabular">{zones.zones.length}</div></div>
              <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Clientes géolocalisées</div><div className="font-serif text-2xl tabular">{zones.total_customers}</div></div>
              <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Commandes</div><div className="font-serif text-2xl tabular">{zones.total_orders}</div></div>
              <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">CA total</div><div className="font-serif text-2xl tabular">{fcfa(zones.total_revenue)}</div></div>
            </div>
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="dina-card-white p-5">
                <div className="font-semibold mb-1">Part du CA par zone</div>
                <div className="text-xs text-[#666] mb-3">Top 8 zones par chiffre d'affaires</div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={zones.zones.slice(0,8)} layout="vertical" margin={{left:30}}>
                    <CartesianGrid stroke="#f0f0f0"/>
                    <XAxis type="number" fontSize={10} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                    <YAxis type="category" dataKey="name" fontSize={10} width={120}/>
                    <Tooltip formatter={v=>fcfa(v)}/>
                    <Legend wrapperStyle={{fontSize:10}}/>
                    <Bar dataKey="revenue" name="CA" fill="#b02a2a" radius={[0,4,4,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="dina-card-white p-5">
                <div className="font-semibold mb-1">Commandes par zone</div>
                <div className="text-xs text-[#666] mb-3">Volume de commandes</div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={zones.zones.slice(0,8)}>
                    <CartesianGrid stroke="#f0f0f0" vertical={false}/>
                    <XAxis dataKey="name" fontSize={9} angle={-20} textAnchor="end" height={60}/>
                    <YAxis fontSize={10}/>
                    <Tooltip/>
                    <Legend wrapperStyle={{fontSize:10}}/>
                    <Bar dataKey="orders" name="Commandes" fill="#0021cc" radius={[4,4,0,0]}/>
                    <Bar dataKey="delivered" name="Livrées" fill="#1f8a4c" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="dina-card-white p-5">
              <div className="font-semibold mb-3">Détail par zone</div>
              <div className="overflow-x-auto">
                <table className="dina-table">
                  <thead><tr><th>Zone</th><th>Tarif</th><th className="text-right">Clientes</th><th className="text-right">Commandes</th><th className="text-right">Livrées</th><th className="text-right">CA</th><th className="text-right">Part CA</th><th className="text-right">Panier moy.</th><th className="text-right">Annulation</th><th className="text-right">Frais encaissés</th></tr></thead>
                  <tbody>{zones.zones.map((z,i)=>(
                    <tr key={i} data-testid={`zone-row-${i}`}>
                      <td className="font-medium">{z.name}</td>
                      <td className="tabular text-xs text-[#666]">{z.fee?fcfa(z.fee):"—"}</td>
                      <td className="text-right tabular">{z.clients}</td>
                      <td className="text-right tabular">{z.orders}</td>
                      <td className="text-right tabular text-[#1f8a4c]">{z.delivered}</td>
                      <td className="text-right tabular font-semibold">{fcfa(z.revenue)}</td>
                      <td className="text-right tabular"><span className="dina-chip" style={{color:z.share>20?"#1f8a4c":"#666"}}>{z.share}%</span></td>
                      <td className="text-right tabular">{fcfa(z.avg_basket)}</td>
                      <td className="text-right tabular"><span style={{color:z.cancel_rate>10?"#c62828":"#666"}}>{z.cancel_rate}%</span></td>
                      <td className="text-right tabular">{fcfa(z.fees_collected)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          </>
        )
      )}

      {tab === "clients" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="dina-card-white p-5">
            <div className="font-semibold mb-3">Clientes</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-[#fff5f5] dark:bg-[#2a1818] rounded-lg"><div className="text-[10px] uppercase text-[#666]">Nouvelles</div><div className="font-serif text-xl tabular">{s.customers_new}</div></div>
              <div className="p-3 bg-[#fff5f5] dark:bg-[#2a1818] rounded-lg"><div className="text-[10px] uppercase text-[#666]">Récurrentes</div><div className="font-serif text-xl tabular text-[#1f8a4c]">{s.customers_returning}</div></div>
              <div className="p-3 bg-[#fff5f5] dark:bg-[#2a1818] rounded-lg"><div className="text-[10px] uppercase text-[#666]">Inactives (30j+)</div><div className="font-serif text-xl tabular text-[#c62828]">{s.customers_inactive}</div></div>
            </div>
            <div className="mt-4"><div className="text-xs uppercase text-[#666] mb-2">Ventes par canal</div><ResponsiveContainer width="100%" height={160}><BarChart data={s.channels}><CartesianGrid stroke="#f0f0f0" vertical={false}/><XAxis dataKey="name" fontSize={10}/><YAxis fontSize={10} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/><Tooltip formatter={v=>fcfa(v)}/><Legend wrapperStyle={{fontSize:10}}/><Bar dataKey="value" name="CA" fill="#b02a2a" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
          </div>
          <div className="dina-card-white p-5">
            <div className="font-semibold mb-3">Statuts commandes</div>
            <ResponsiveContainer width="100%" height={240}><PieChart><Pie data={s.statuses} dataKey="value" nameKey="name" outerRadius={85}>{s.statuses.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip/><Legend wrapperStyle={{fontSize:10}}/></PieChart></ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === "livraisons" && (
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Performance par zone (livraisons)</div>
          <div className="text-xs text-[#666] mb-3">Consultez l'onglet Zones géographiques pour le détail livraisons par zone.</div>
          <button onClick={()=>setTab("zones")} className="dina-btn-primary !min-h-[36px] text-xs">Ouvrir Zones géographiques →</button>
        </div>
      )}

      {tab === "finances" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="dina-card-white p-5"><div className="font-semibold mb-3">Dépenses par catégorie</div><ResponsiveContainer width="100%" height={240}><BarChart data={s.exp_by_cat}><CartesianGrid stroke="#f0f0f0" vertical={false}/><XAxis dataKey="name" fontSize={10}/><YAxis fontSize={10} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/><Tooltip formatter={v=>fcfa(v)}/><Legend wrapperStyle={{fontSize:10}}/><Bar dataKey="value" name="Dépenses" fill="#c62828" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
          <div className="dina-card-white p-5">
            <div className="font-semibold mb-3">Résultat net estimé</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>CA</span><span className="tabular font-semibold">{fcfa(s.revenue)}</span></div>
              <div className="flex justify-between text-[#666]"><span>− Coût marchandises</span><span className="tabular">{fcfa(s.cost_of_goods)}</span></div>
              <div className="flex justify-between border-t pt-2"><span className="font-semibold">Marge brute</span><span className="tabular font-semibold text-[#1f8a4c]">{fcfa(s.gross_margin)}</span></div>
              <div className="flex justify-between text-[#666]"><span>− Dépenses</span><span className="tabular">{fcfa(s.expenses)}</span></div>
              <div className="flex justify-between border-t-2 pt-2 border-[#1c1c1c]"><span className="font-serif text-lg">Résultat net</span><span className="font-serif text-xl tabular" style={{color:(s.gross_margin-s.expenses)>=0?"#1f8a4c":"#c62828"}}>{fcfa(s.gross_margin-s.expenses)}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
