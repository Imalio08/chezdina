import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Package, TrendingUp, ShoppingBag, AlertTriangle, Users, Megaphone, Globe, Wallet, UserCheck, MapPin, LayoutGrid, Clock } from "lucide-react";
import { AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import PeriodSelector from "@/components/shared/PeriodSelector";
import * as XLSX from "xlsx";
import { useAuth } from "@/context/AuthContext";

const COLORS = ["#b02a2a","#f4b12c","#0021cc","#1f8a4c","#5867fd","#d94848","#e4991e","#1c1c1c"];
const toBackendPeriod = (p) => ({ today:"today", yesterday:"yesterday", this_week:"7d", last_week:"7d", last7:"7d", last30:"30d", this_month:"30d", last_month:"last_month", this_quarter:"90d", last_quarter:"90d", this_year:"year", last_year:"year", all:"year" }[p] || "30d");

const TABS = [
  { k: "sales", label: "Ventes", icon: TrendingUp },
  { k: "products", label: "Produits", icon: Package },
  { k: "categories", label: "Catégories", icon: LayoutGrid },
  { k: "funnel", label: "Entonnoir vitrine", icon: Globe },
  { k: "stock-purchases", label: "Stock & achats", icon: ShoppingBag },
  { k: "orders-delivery", label: "Commandes & livraison", icon: AlertTriangle },
  { k: "zones", label: "Zones", icon: MapPin },
  { k: "customers", label: "Clientes", icon: Users },
  { k: "demand", label: "Demande", icon: Clock },
  { k: "marketing", label: "Marketing", icon: Megaphone },
  { k: "site", label: "Site vitrine", icon: Globe },
  { k: "encaissements", label: "Encaissements", icon: Wallet },
  { k: "team", label: "Équipe", icon: UserCheck },
];

const toCsv = (rows) => {
  if (!rows?.length) return "";
  const keys = Object.keys(rows[0]);
  return [keys.join(","), ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
};
const downloadBlob = (data, name, mime) => {
  const b = new Blob([data], { type: mime }); const u = URL.createObjectURL(b);
  const a = document.createElement("a"); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u);
};
const exportCsv = (rows, name = "export") => downloadBlob(toCsv(rows), `${name}.csv`, "text/csv");
const exportXlsx = (rows, name = "export") => { const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Stats"); XLSX.writeFile(wb, `${name}.xlsx`); };

export default function Statistiques() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") || "sales");
  const [preset, setPreset] = useState("last30");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const period = toBackendPeriod(preset);

  useEffect(() => { setParams({ tab }); }, [tab]); // eslint-disable-line

  useEffect(() => {
    if (tab === "funnel") {
      setLoading(true);
      api.get(`/analytics/funnel?days=${period === "d7" ? 7 : period === "d30" ? 30 : 7}`).then(r => setData({ funnel_data: r.data })).catch(() => toast.error("Erreur chargement")).finally(() => setLoading(false));
      return;
    }
    setLoading(true);
    api.get(`/stats/${tab}?period=${period}`).then(r => setData(r.data)).catch(() => toast.error("Erreur chargement")).finally(() => setLoading(false));
  }, [tab, period]);

  return (
    <div className="space-y-5 font-sora">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Statistiques</h1><p className="text-sm text-[#666]">Analyse détaillée · 12 angles · exports CSV & Excel</p></div>
        <PeriodSelector value={preset} onChange={setPreset} comparison="prev" onComparisonChange={() => {}} />
      </div>

      <div className="flex gap-1 overflow-x-auto bg-[#f5f5f5] dark:bg-[#1a1a1a] p-1 rounded-lg">
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`px-3 py-1.5 text-xs rounded whitespace-nowrap flex items-center gap-1 ${tab === t.k ? "bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold" : ""}`} data-testid={`stats-tab-${t.k}`}>
            <t.icon size={11} />{t.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-sm text-[#666] py-8 text-center">Chargement…</div>}
      {!loading && data && (
        <>
          {tab === "sales" && <SalesTab d={data} />}
          {tab === "products" && <ProductsTab d={data} period={period} />}
          {tab === "categories" && <CategoriesTab d={data} />}
          {tab === "funnel" && <FunnelTab d={data?.funnel_data} />}
          {tab === "stock-purchases" && <StockPurchasesTab d={data} />}
          {tab === "orders-delivery" && <OrdersDeliveryTab d={data} />}
          {tab === "zones" && <ZonesTab period={period} />}
          {tab === "customers" && <CustomersTab d={data} />}
          {tab === "demand" && <DemandTab d={data} />}
          {tab === "marketing" && <MarketingTab d={data} />}
          {tab === "site" && <SiteTab d={data} />}
          {tab === "encaissements" && <EncaissementsTab d={data} />}
          {tab === "team" && <TeamTab d={data} />}
        </>
      )}
    </div>
  );
}

function ExportBar({ rows, name }) {
  const { user } = useAuth();
  if (user?.role !== "admin") return null;
  return (
    <div className="flex gap-2 justify-end">
      <button onClick={() => exportCsv(rows, name)} className="dina-btn-secondary !min-h-[32px] text-xs" data-testid={`exp-csv-${name}`}><Download size={11} />CSV</button>
      <button onClick={() => exportXlsx(rows, name)} className="dina-btn-secondary !min-h-[32px] text-xs" data-testid={`exp-xlsx-${name}`}><FileSpreadsheet size={11} />Excel</button>
    </div>
  );
}

function Kpi({ label, v, c = "#5867fd", sub }) {
  return <div className="dina-card-white p-3"><div className="text-[10px] uppercase text-[#666] font-semibold truncate">{label}</div><div className="font-serif tabular text-xl mt-1" style={{ color: c }}>{v}</div>{sub && <div className="text-[10px] text-[#999] mt-0.5">{sub}</div>}</div>;
}

/* ===== TABS ===== */
function SalesTab({ d }) {
  const split = d.split || { orders: 0, delivered: 0, cancelled: 0, deferred: 0 };
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
        <Kpi label="CA commandé" v={fcfa(split.orders)} c="#5867fd" />
        <Kpi label="CA livré" v={fcfa(split.delivered)} c="#1f8a4c" />
        <Kpi label="CA annulé" v={fcfa(split.cancelled)} c="#c62828" />
        <Kpi label="CA reporté" v={fcfa(split.deferred)} c="#e4991e" />
        <Kpi label="Taux annulation" v={`${d.cancel_rate ?? 0}%`} c="#c62828" />
        <Kpi label="Panier moyen" v={fcfa(d.avg_basket)} c="#b02a2a" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Ventes par jour de la semaine">
          <BarChart data={d.by_dow || []}><CartesianGrid stroke="#f0f0f0" vertical={false} /><XAxis dataKey="day" fontSize={11} /><YAxis fontSize={11} tickFormatter={v => `${(v/1000).toFixed(0)}k`} /><Tooltip formatter={v => fcfa(v)} /><Bar dataKey="value" fill="#b02a2a" radius={[4,4,0,0]} /></BarChart>
        </ChartCard>
        <ChartCard title="Ventes par heure">
          <BarChart data={d.by_hour || []}><CartesianGrid stroke="#f0f0f0" vertical={false} /><XAxis dataKey="hour" fontSize={10} interval={1} /><YAxis fontSize={11} tickFormatter={v => `${(v/1000).toFixed(0)}k`} /><Tooltip formatter={v => fcfa(v)} /><Bar dataKey="value" fill="#5867fd" radius={[4,4,0,0]} /></BarChart>
        </ChartCard>
      </div>

      <HeatmapCard matrix={d.heatmap} />

      <div className="grid lg:grid-cols-3 gap-4">
        <ChartCard title="Par canal"><PieChart><Pie data={d.channels || []} dataKey="value" nameKey="name" outerRadius={70}>{(d.channels || []).map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip formatter={v=>fcfa(v)}/><Legend wrapperStyle={{fontSize:10}}/></PieChart></ChartCard>
        <ChartCard title="Par mode paiement"><PieChart><Pie data={d.payments || []} dataKey="value" nameKey="name" outerRadius={70}>{(d.payments || []).map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip formatter={v=>fcfa(v)}/><Legend wrapperStyle={{fontSize:10}}/></PieChart></ChartCard>
        <div className="dina-card-white p-4"><div className="font-semibold mb-2 text-sm">Par vendeuse</div>{(d.sellers || []).slice(0,8).map((s,i)=>(<div key={i} className="flex justify-between text-xs py-1 border-b border-[#ececec] dark:border-[#2a2a2a] last:border-0"><span>{s.name}</span><span className="tabular font-semibold">{fcfa(s.revenue)}</span></div>))}</div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ReasonTable title="Motifs d'annulation" rows={d.cancel_reasons} />
        <ReasonTable title="Motifs de report" rows={d.defer_reasons} />
      </div>
      <ExportBar rows={d.sellers} name="ventes" />
    </div>
  );
}

function HeatmapCard({ matrix }) {
  const days = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
  const safe = Array.isArray(matrix) && matrix.length ? matrix : [];
  const flat = safe.flat();
  const max = Math.max(...(flat.length ? flat : [1]), 1);
  if (!safe.length) {
    return (
      <div className="dina-card-white p-4" data-testid="heatmap">
        <div className="font-semibold mb-2 text-sm">Heatmap jour × heure</div>
        <div className="text-sm text-[#666] text-center py-6">Aucune donnée pour cette période</div>
      </div>
    );
  }
  return (
    <div className="dina-card-white p-4" data-testid="heatmap">
      <div className="font-semibold mb-2 text-sm">Heatmap jour × heure</div>
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[40px_repeat(24,1fr)] gap-0.5 text-[9px]">
            <div></div>{Array.from({length:24}).map((_,h)=><div key={h} className="text-center text-[#999]">{h}</div>)}
            {safe.map((row, d)=>(<React.Fragment key={d}><div className="text-[#666] text-right pr-1">{days[d]}</div>{(row||[]).map((v,h)=>{const i=v/max;return <div key={h} className="aspect-square rounded" style={{background:`rgba(176,42,42,${i})`}} title={`${days[d]} ${h}h · ${fcfa(v)}`}></div>;})}</React.Fragment>))}
          </div>
        </div>
      </div>
    </div>
  );
}
function ReasonTable({ title, rows }) {
  return <div className="dina-card-white p-4"><div className="font-semibold mb-2 text-sm">{title}</div>{(!rows || !rows.length) ? <div className="text-xs text-[#666]">Aucun</div> : rows.map((r,i)=>(<div key={i} className="flex justify-between text-xs py-1"><span>{r.reason}</span><span className="dina-chip text-[10px]">{r.count}</span></div>))}</div>;
}
function ChartCard({ title, children }) { return <div className="dina-card-white p-4"><div className="font-semibold mb-2 text-sm">{title}</div><ResponsiveContainer width="100%" height={220}>{children}</ResponsiveContainer></div>; }

function ProductsTab({ d, period }) {
  const [pid, setPid] = useState("");
  const [variant, setVariant] = useState(null);
  const loadVariant = async (id) => { setPid(id); const r = await api.get(`/stats/products?period=${period}&product_id=${id}`); setVariant(r.data.variant); };
  return (
    <div className="space-y-5">
      <div className="grid lg:grid-cols-3 gap-4">
        <RankTable title="Top par quantité" rows={d.by_qty} field="qty" format={v=>v} onPick={loadVariant} />
        <RankTable title="Top par CA" rows={d.by_revenue} field="revenue" format={fcfa} onPick={loadVariant} />
        <RankTable title="Top par marge" rows={d.by_margin} field="margin" format={fcfa} onPick={loadVariant} />
      </div>
      {variant && <VariantMatrix v={variant} />}
      <div className="dina-card-white p-4">
        <div className="flex items-center justify-between mb-2"><div className="font-semibold text-sm">Jamais vendus ({(d.never_sold || []).length})</div><ExportBar rows={d.never_sold} name="jamais_vendus" /></div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-72 overflow-y-auto">
          {(d.never_sold || []).slice(0,30).map(p=>(<div key={p.id} className="text-xs"><img src={p.image} alt="" className="aspect-square rounded object-cover"/><div className="line-clamp-1 mt-1">{p.name}</div><div className="text-[#666] text-[10px]">Stock: {p.stock}</div></div>))}
        </div>
      </div>
    </div>
  );
}
function RankTable({ title, rows, field, format, onPick }) {
  const safe = Array.isArray(rows) ? rows : [];
  return (
    <div className="dina-card-white p-4">
      <div className="font-semibold mb-2 text-sm">{title}</div>
      {safe.length === 0 ? <div className="text-xs text-[#666] py-3">Aucune donnée pour cette période</div> : (
      <div className="space-y-1 max-h-80 overflow-y-auto">
        {safe.slice(0,15).map((r,i)=>(<button key={r.id} onClick={()=>onPick&&onPick(r.id)} className="flex items-center gap-2 w-full text-left text-xs py-1 hover:bg-[#fafafa] dark:hover:bg-[#141414] rounded px-1"><span className="text-[#999] w-5">#{i+1}</span><img src={r.image} alt="" className="w-6 h-6 rounded object-cover"/><span className="flex-1 truncate">{r.name}</span><span className="tabular font-semibold">{format(r[field])}</span></button>))}
      </div>)}
    </div>
  );
}
function VariantMatrix({ v }) {
  const sizes = v.sizes || Object.keys(v.matrix || {});
  const colors = v.colors || Object.keys(Object.values(v.matrix || {})[0] || {});
  return (
    <div className="dina-card-white p-4" data-testid="variant-matrix">
      <div className="flex items-center gap-3 mb-3">
        <img src={v.product.image} alt="" className="w-12 h-12 rounded object-cover"/>
        <div><div className="font-semibold">{v.product.name}</div><div className="text-xs text-[#666]">Performance par variante</div></div>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div><div className="text-xs uppercase font-semibold mb-2 text-[#666]">Ventes par taille</div><table className="dina-table text-xs"><thead><tr><th>Taille</th><th className="text-right">Vendu</th><th className="text-right">Stock</th></tr></thead><tbody>{sizes.map(s=>(<tr key={s}><td>{s}</td><td className="text-right tabular">{(v.sales_by_size || {})[s]||0}</td><td className="text-right tabular">{v.stock_by_size?.[s]||0}</td></tr>))}</tbody></table></div>
        <div><div className="text-xs uppercase font-semibold mb-2 text-[#666]">Ventes par couleur</div><table className="dina-table text-xs"><thead><tr><th>Couleur</th><th className="text-right">Vendu</th></tr></thead><tbody>{colors.map(c=>(<tr key={c}><td>{c}</td><td className="text-right tabular">{(v.sales_by_color || {})[c]||0}</td></tr>))}</tbody></table></div>
      </div>
      <div className="mt-3">
        <div className="text-xs uppercase font-semibold mb-2 text-[#666]">Matrice taille × couleur (vendu / stock)</div>
        <div className="overflow-x-auto"><table className="dina-table text-xs"><thead><tr><th>Taille</th>{colors.map(c=>(<th key={c} className="text-right">{c}</th>))}</tr></thead><tbody>{sizes.map(s=>(<tr key={s}><td className="font-semibold">{s}</td>{colors.map(c=>{const sold=v.matrix?.[s]?.[c]||0;const stock=v.stock_by_size?.[s]||0;return <td key={c} className="text-right tabular"><span className={sold>0?"text-[#1f8a4c] font-semibold":""}>{sold}</span><span className="text-[#999]"> / {stock}</span></td>;})}</tr>))}</tbody></table></div>
      </div>
    </div>
  );
}

function CategoriesTab({ d }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><ExportBar rows={d.rows} name="categories" /></div>
      <div className="dina-card-white overflow-x-auto"><table className="dina-table"><thead><tr><th>Catégorie</th><th className="text-right">CA</th><th className="text-right">Commandes</th><th className="text-right">Articles</th><th className="text-right">Panier moy.</th><th className="text-right">Marge</th><th className="text-right">Évolution</th><th>Top tailles</th><th>Top couleurs</th></tr></thead>
        <tbody>{(d.rows || []).map(r=>(<tr key={r.category} data-testid={`cat-${r.category}`}><td className="font-medium">{r.category}</td><td className="text-right tabular font-semibold">{fcfa(r.revenue)}</td><td className="text-right tabular">{r.orders}</td><td className="text-right tabular">{r.items}</td><td className="text-right tabular">{fcfa(r.avg_basket)}</td><td className="text-right tabular text-[#1f8a4c]">{r.margin_pct}%</td><td className={`text-right tabular ${r.delta_pct>=0?"text-[#1f8a4c]":"text-[#c62828]"}`}>{r.delta_pct>=0?"+":""}{r.delta_pct}%</td><td className="text-xs">{(r.top_sizes||[]).slice(0,3).map(t=>t.size).join(" · ")}</td><td className="text-xs">{(r.top_colors||[]).slice(0,3).map(t=>t.color).join(" · ")}</td></tr>))}</tbody></table></div>
    </div>
  );
}

function StockPurchasesTab({ d }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2"><Kpi label="Valeur stock" v={fcfa(d.stock_value)} c="#b02a2a"/><Kpi label="Rotation (×/an)" v={d.rotation} c="#5867fd"/><Kpi label="Ruptures" v={d.ruptures} c="#c62828"/><Kpi label="Stock bas" v={d.low} c="#e4991e"/><Kpi label="Dormants" v={(d.dormant || []).length} c="#999"/></div>
      <div className="dina-card-white p-4"><div className="font-semibold mb-2">Fournisseurs</div><table className="dina-table"><thead><tr><th>Nom</th><th className="text-right">Acheté</th><th className="text-right">Bons</th><th className="text-right">Délai</th></tr></thead><tbody>{(d.suppliers || []).map(s=>(<tr key={s.supplier_id}><td className="font-medium">{s.name}</td><td className="text-right tabular font-semibold">{fcfa(s.purchased)}</td><td className="text-right">{s.pos}</td><td className="text-right">{s.avg_lead}j</td></tr>))}</tbody></table></div>
      <div className="dina-card-white p-4"><div className="font-semibold mb-2">Produits dormants (60j+ sans vente)</div><table className="dina-table"><thead><tr><th>Produit</th><th className="text-right">Stock</th></tr></thead><tbody>{(d.dormant || []).slice(0,30).map(p=>(<tr key={p.id}><td>{p.name}</td><td className="text-right">{p.stock}</td></tr>))}</tbody></table></div>
    </div>
  );
}

function OrdersDeliveryTab({ d }) {
  return (
    <div className="space-y-4">
      <Kpi label="Frais de livraison encaissés" v={fcfa(d.fees_collected)} c="#1f8a4c"/>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="dina-card-white p-4"><div className="font-semibold mb-2">Volume par statut</div>{(d.by_status || []).map((s,i)=>(<div key={i} className="flex justify-between text-xs py-1"><span className="capitalize">{s.status.replace("_"," ")}</span><span className="dina-chip">{s.count}</span></div>))}</div>
        <div className="dina-card-white p-4"><div className="font-semibold mb-2">Performance par livreur</div><table className="dina-table"><thead><tr><th>Nom</th><th>Livrées</th><th>Annulées</th><th className="text-right">CA</th></tr></thead><tbody>{(d.riders || []).map(r=>(<tr key={r.rider_id}><td>{r.name}</td><td>{r.delivered}</td><td className="text-[#c62828]">{r.cancelled}</td><td className="text-right tabular">{fcfa(r.revenue)}</td></tr>))}</tbody></table></div>
      </div>
      <div className="grid lg:grid-cols-2 gap-4"><ReasonTable title="Motifs d'annulation" rows={d.cancel_reasons}/><ReasonTable title="Motifs de report" rows={d.defer_reasons}/></div>
    </div>
  );
}

function ZonesTab({ period }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.get(`/stats/zones?period=${period}`).then(r=>setData(r.data)).catch(()=>setData({zones:[]})); }, [period]);
  if (!data) return <div className="text-sm text-[#666]">Chargement…</div>;
  const rows = Array.isArray(data) ? data : (data.zones || []);
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><ExportBar rows={rows} name="zones" /></div>
      <div className="dina-card-white overflow-x-auto"><table className="dina-table"><thead><tr><th>Zone</th><th>Clientes</th><th>Commandes</th><th className="text-right">CA</th><th className="text-right">Livrées</th><th className="text-right">Annulées</th></tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={6} className="text-sm text-[#666] text-center py-6">Aucune donnée pour cette période</td></tr> : rows.map((z,i)=>(<tr key={i}><td className="font-medium">{z.name}</td><td>{z.clients}</td><td>{z.orders}</td><td className="text-right tabular">{fcfa(z.revenue)}</td><td className="text-right text-[#1f8a4c]">{z.delivered}</td><td className="text-right text-[#c62828]">{z.cancelled}</td></tr>))}</tbody></table></div>
      <div className="text-xs text-[#666]">La carte des zones se trouve dans Zones géographiques.</div>
    </div>
  );
}

function CustomersTab({ d }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2"><Kpi label="Nouvelles" v={d.new} c="#5867fd"/><Kpi label="Récurrentes" v={d.recurring} c="#1f8a4c"/><Kpi label="Valeur vie moy." v={fcfa(d.ltv)} c="#b02a2a"/><Kpi label="Fréquence moy." v={`${d.frequency} cmd`} c="#e4991e"/></div>
      <div className="dina-card-white p-4">
        <div className="font-semibold mb-3">Profil type des meilleures clientes</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div><div className="font-semibold mb-1">Zones</div>{(d.best_profile?.top_zones || []).map((z,i)=>(<div key={i} className="flex justify-between"><span>{z.zone}</span><span className="dina-chip text-[10px]">{z.count}</span></div>))}</div>
          <div><div className="font-semibold mb-1">Catégories</div>{(d.best_profile?.top_cats || []).map((z,i)=>(<div key={i} className="flex justify-between"><span>{z.cat}</span><span className="dina-chip text-[10px]">{z.count}</span></div>))}</div>
          <div><div className="font-semibold mb-1">Tailles</div>{(d.best_profile?.top_sizes || []).map((z,i)=>(<div key={i} className="flex justify-between"><span>{z.size}</span><span className="dina-chip text-[10px]">{z.count}</span></div>))}</div>
          <div><div className="font-semibold mb-1">Canaux</div>{(d.best_profile?.top_channels || []).map((z,i)=>(<div key={i} className="flex justify-between"><span className="capitalize">{z.channel}</span><span className="dina-chip text-[10px]">{z.count}</span></div>))}</div>
        </div>
      </div>
      <div className="dina-card-white overflow-x-auto"><table className="dina-table"><thead><tr><th>Cliente</th><th>Téléphone</th><th className="text-right">Dépensé</th><th className="text-right">Commandes</th></tr></thead><tbody>{(d.best_customers || []).map(c=>(<tr key={c.id}><td className="font-medium">{c.name}</td><td className="text-xs">{c.phone}</td><td className="text-right tabular font-semibold">{fcfa(c.total_spent||0)}</td><td className="text-right">{c.total_orders||0}</td></tr>))}</tbody></table></div>
    </div>
  );
}

function DemandTab({ d }) {
  return (
    <div className="space-y-4">
      <div className="dina-card-white p-4"><div className="font-semibold mb-2">Liste d'attente par produit × variante ({(d.waitlist || []).length})</div><table className="dina-table"><thead><tr><th>Produit</th><th>Taille</th><th>Couleur</th><th className="text-right">Demandes</th></tr></thead><tbody>{(d.waitlist || []).slice(0,30).map((w,i)=>(<tr key={i}><td>{w.product_name}</td><td>{w.size||"—"}</td><td>{w.color||"—"}</td><td className="text-right tabular font-semibold">{w.count}</td></tr>))}</tbody></table></div>
      <div className="dina-card-white p-4"><div className="font-semibold mb-2">Recherches sans résultat</div>{(d.searches_no_result || []).length === 0 ? <div className="text-xs text-[#666]">Aucune</div> : (d.searches_no_result || []).map((s,i)=>(<div key={i} className="text-xs py-1 flex justify-between"><span>"{s.q}"</span><span className="text-[#999]">{s.at}</span></div>))}</div>
    </div>
  );
}

function MarketingTab({ d }) {
  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="dina-card-white p-4"><div className="font-semibold mb-2">Codes promo</div><table className="dina-table"><thead><tr><th>Code</th><th>Type</th><th className="text-right">Utilisations</th></tr></thead><tbody>{(d.promotions || []).map((p,i)=>(<tr key={i}><td className="font-mono">{p.code}</td><td className="text-xs">{p.type}</td><td className="text-right">{p.uses}</td></tr>))}</tbody></table></div>
        <div className="dina-card-white p-4"><div className="font-semibold mb-2">Campagnes</div><table className="dina-table"><thead><tr><th>Nom</th><th className="text-right">Envoyées</th><th className="text-right">CA</th></tr></thead><tbody>{(d.campaigns || []).map((c,i)=>(<tr key={i}><td>{c.name}</td><td className="text-right">{c.stats?.sent||0}</td><td className="text-right tabular">{fcfa(c.stats?.revenue||0)}</td></tr>))}</tbody></table></div>
      </div>
      <div className="dina-card-white p-4"><div className="font-semibold mb-2">Sources d'acquisition</div><table className="dina-table"><thead><tr><th>Source</th><th className="text-right">Clientes</th></tr></thead><tbody>{(d.sources || []).map((s,i)=>(<tr key={i}><td>{s.source}</td><td className="text-right tabular font-semibold">{s.count}</td></tr>))}</tbody></table></div>
    </div>
  );
}

function SiteTab({ d }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2"><Kpi label="Commandes site" v={d.orders} c="#5867fd"/><Kpi label="CA site" v={fcfa(d.revenue)} c="#b02a2a"/><Kpi label="Paniers abandonnés" v={d.abandoned} c="#e4991e"/></div>
      <div className="dina-card-white p-4 text-xs text-[#666]">{d.note}</div>
    </div>
  );
}

function EncaissementsTab({ d }) {
  return (
    <div className="space-y-4">
      <Kpi label="Total encaissé" v={fcfa(d.total)} c="#b02a2a"/>
      <div className="grid lg:grid-cols-3 gap-4">
        <ChartCard title="Par mode"><PieChart><Pie data={d.by_method || []} dataKey="value" nameKey="name" outerRadius={70}>{(d.by_method || []).map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip formatter={v=>fcfa(v)}/><Legend wrapperStyle={{fontSize:10}}/></PieChart></ChartCard>
        <ChartCard title="Par source"><PieChart><Pie data={d.by_source || []} dataKey="value" nameKey="name" outerRadius={70}>{(d.by_source || []).map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip formatter={v=>fcfa(v)}/><Legend wrapperStyle={{fontSize:10}}/></PieChart></ChartCard>
        <ChartCard title="Par jour"><LineChart data={d.by_day}><CartesianGrid stroke="#f0f0f0"/><XAxis dataKey="day" fontSize={9}/><YAxis fontSize={10} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/><Tooltip formatter={v=>fcfa(v)}/><Line dataKey="value" stroke="#b02a2a" strokeWidth={2} dot={false}/></LineChart></ChartCard>
      </div>
      <ExportBar rows={d.by_day} name="encaissements" />
    </div>
  );
}

function TeamTab({ d }) {
  return (
    <div className="space-y-4">
      <div className="dina-card-white p-4"><div className="font-semibold mb-2">Ventes par vendeuse</div><table className="dina-table"><thead><tr><th>Nom</th><th className="text-right">Commandes</th><th className="text-right">CA</th></tr></thead><tbody>{(d.sellers || []).map((s,i)=>(<tr key={i}><td>{s.name}</td><td className="text-right">{s.orders}</td><td className="text-right tabular font-semibold">{fcfa(s.revenue)}</td></tr>))}</tbody></table></div>
      <div className="dina-card-white p-4"><div className="font-semibold mb-2">Ponctualité</div><table className="dina-table"><thead><tr><th>Nom</th><th className="text-right">Présent</th><th className="text-right">Retards</th><th className="text-right">Absents</th></tr></thead><tbody>{(d.attendance || []).map((a,i)=>(<tr key={i}><td>{a.name}</td><td className="text-right text-[#1f8a4c]">{a.present}</td><td className="text-right text-[#e4991e]">{a.late}</td><td className="text-right text-[#c62828]">{a.absent}</td></tr>))}</tbody></table></div>
    </div>
  );
}

function FunnelTab({ d }) {
  if (!d) return <div className="text-sm text-[#666] text-center py-8">Aucun événement capturé pour la période · ouvrez la vitrine pour générer du trafic</div>;
  const steps = d.funnel || [];
  const max = Math.max(...steps.map(s => s.value), 1);
  return (
    <div className="space-y-4" data-testid="funnel-tab">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Visiteurs uniques</div><div className="font-serif text-2xl tabular">{d.visitors || 0}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Pages vues</div><div className="font-serif text-2xl tabular">{d.page_views || 0}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Ajouts panier</div><div className="font-serif text-2xl tabular text-[#e4991e]">{d.add_to_cart || 0}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Commandes</div><div className="font-serif text-2xl tabular text-[#1f8a4c]">{d.order_placed || 0}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Conversion</div><div className="font-serif text-2xl tabular text-[#b02a2a]">{d.conversion_rate || 0}%</div></div>
      </div>
      <div className="dina-card-white p-5">
        <div className="font-semibold mb-4">Entonnoir sur {d.days || 7} jours</div>
        <div className="space-y-2">
          {steps.map((s, i) => {
            const pct = Math.round((s.value / max) * 100);
            const dropPct = i > 0 && steps[i-1].value > 0 ? Math.round(100 - (s.value / steps[i-1].value) * 100) : 0;
            return (
              <div key={s.step} data-testid={`funnel-step-${i}`}>
                <div className="flex justify-between items-end text-xs mb-1">
                  <span className="font-medium">{s.step}</span>
                  <span className="tabular"><strong className="text-base">{s.value}</strong>{i > 0 && dropPct > 0 && <span className="text-[#c62828] ml-2">-{dropPct}%</span>}</span>
                </div>
                <div className="h-7 bg-[#f5f5f5] dark:bg-[#1a1a1a] rounded-lg overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#b02a2a] to-[#e4991e] rounded-lg transition-all" style={{ width: `${pct}%` }}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="text-[11px] text-[#999]">Événements collectés en interne (sans cookie tiers) · session anonyme par visiteur · consentement implicite activable depuis le footer de la vitrine</div>
    </div>
  );
}
