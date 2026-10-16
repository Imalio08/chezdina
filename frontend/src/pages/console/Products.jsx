import { useAuth } from "@/context/AuthContext";

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { fcfa, fcfaCompact } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Download, Pencil, Eye, Trash2, Copy, Archive, Tag, Package, AlertTriangle, Clock, BarChart3, DollarSign, Percent, CheckCircle, XCircle, ChevronDown, Search } from "lucide-react";
import KPICard from "@/components/shared/KPICard";
import ViewToggle, { useStoredView } from "@/components/shared/ViewToggle";
import FiltersPanel from "@/components/shared/FiltersPanel";
import ProductDetailView from "@/components/products/ProductDetailView";
import ProductFormV3 from "@/components/products/ProductFormV3";
import SmartImage from "@/components/shared/SmartImage";

const STATUS_LABEL = { actif:"Actif", inactif:"Inactif", brouillon:"Brouillon", liste_attente:"Liste d'attente", archive:"Archivé" };
const STATUS_COLOR = { actif:"#1f8a4c", inactif:"#999", brouillon:"#5867fd", liste_attente:"#e4991e", archive:"#666" };

function deriveStatus(p) { return p.status || "actif"; }

export default function Products() {
  const nav = useNavigate();
  const { user } = useAuth();
  const money = ["admin", "manager"].includes(user?.role);
  const canEdit = ["admin", "manager", "stock_keeper"].includes(user?.role);
  const [products, setProducts] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [salesMap, setSalesMap] = useState({});
  const [brands, setBrands] = useState([]);
  const [cats, setCats] = useState([]);
  const [view, setView] = useStoredView("products", "grid");
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({});
  const [selected, setSelected] = useState([]);
  const [detailId, setDetailId] = useState(null);
  const [editId, setEditId] = useState(null); // null = no form, "new" = new, "<id>" = edit
  const [bulkOpen, setBulkOpen] = useState(false);

  const load = async () => {
    const [p, k, s, b, c] = await Promise.all([
      api.get("/products"),
      api.get("/products/kpis").catch(()=>({data:null})),
      api.get("/products/sales-30d").catch(()=>({data:{}})),
      api.get("/brands").catch(()=>({data:[]})),
      api.get("/categories").catch(()=>({data:[]})),
    ]);
    setProducts(p.data); setKpis(k.data); setSalesMap(s.data||{}); setBrands(b.data||[]); setCats(c.data||[]);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const nq = q.trim().toLowerCase();
    return products.filter(p => {
      if (nq && !(p.name?.toLowerCase().includes(nq) || p.brand?.toLowerCase().includes(nq) || p.sku?.toLowerCase().includes(nq) || p.barcode?.includes(nq))) return false;
      if (filters.category && p.category !== filters.category) return false;
      if (filters.brand && p.brand !== filters.brand) return false;
      if (filters.status && deriveStatus(p) !== filters.status) return false;
      if (filters.stock === "en_stock" && (p.stock||0) < 5) return false;
      if (filters.stock === "bas" && !((p.stock||0) > 0 && (p.stock||0) < 5)) return false;
      if (filters.stock === "rupture" && (p.stock||0) > 0) return false;
      if (filters.price_min && p.price < filters.price_min) return false;
      if (filters.price_max && p.price > filters.price_max) return false;
      if (filters.promo && !(p.price_old && p.price_old > p.price)) return false;
      if (filters.size && !(p.sizes||[]).includes(filters.size)) return false;
      if (filters.color && !(p.colors||[]).includes(filters.color)) return false;
      return true;
    });
  }, [products, q, filters]);

  const toggleSel = (id) => setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : [...s, id]);
  const allSelected = selected.length === filtered.length && filtered.length > 0;

  const bulkStatus = async (status) => {
    if (!selected.length) return;
    await api.post("/products/bulk-status", { ids: selected, status });
    toast.success(`${selected.length} produits mis en « ${STATUS_LABEL[status]} »`);
    setSelected([]); setBulkOpen(false); load();
  };
  const bulkPromo = async () => {
    const pct = Number(prompt("Promotion % (10-70) :")||0);
    if (!pct || pct < 1 || pct > 90) return;
    await api.post("/products/bulk-promo", { ids: selected, discount_pct: pct });
    toast.success(`${selected.length} produits en promo -${pct}%`); setSelected([]); setBulkOpen(false); load();
  };
  const del = async (id) => { if(!confirm("Supprimer définitivement ?")) return; await api.delete(`/products/${id}`); toast.success("Supprimé"); load(); };
  const exportCSV = () => {
    const rows = [["Nom","Marque","Catégorie","SKU","Prix","Prix d'achat","Marge %","Stock","Statut"], ...filtered.map(p=>{
      const m = p.price&&p.cost ? Math.round((p.price-p.cost)/p.price*100) : 0;
      return [p.name,p.brand,p.category,p.sku,p.price,p.cost,m,p.stock,STATUS_LABEL[deriveStatus(p)]||"Actif"];
    })];
    const csv = rows.map(r=>r.map(c=>`"${String(c||"").replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `produits-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const filterFields = [
    { key:"category", label:"Catégorie", type:"select", options: cats.map(c=>c.name) },
    { key:"brand", label:"Marque", type:"select", options: brands.map(b=>b.name) },
    { key:"status", label:"Statut", type:"select", options: Object.entries(STATUS_LABEL).map(([v,l])=>({value:v,label:l})) },
    { key:"stock", label:"Stock", type:"select", options: [{value:"en_stock",label:"En stock"},{value:"bas",label:"Stock bas"},{value:"rupture",label:"Rupture"}] },
    { key:"price", label:"Prix", type:"range" },
    { key:"size", label:"Taille", type:"select", options: ["XS","S","M","L","XL","XXL","36","37","38","39","40","41","42"] },
    { key:"color", label:"Couleur", type:"select", options: ["Noir","Blanc","Rouge","Beige","Doré","Marine","Rose poudré","Camel","Vert émeraude"] },
    { key:"promo", label:"En promotion", type:"select", options: [{value:"1",label:"Oui"}] },
  ];

  if (detailId) return <ProductDetailView productId={detailId} onBack={()=>{setDetailId(null); load();}} onEdit={(id)=>{setDetailId(null); setEditId(id);}}/>;
  if (editId) return <ProductFormV3 productId={editId==="new"?null:editId} brands={brands} cats={cats} onClose={(saved)=>{setEditId(null); if(saved) load();}}/>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Produits</h1><p className="text-sm text-[#666]">{products.length} références · {filtered.length} affichées</p></div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="dina-btn-secondary !min-h-[40px]" data-testid="products-export"><Download size={14}/>Exporter</button>
          {canEdit && <button onClick={()=>setEditId("new")} className="dina-btn-primary !min-h-[40px]" data-testid="products-new"><Plus size={14}/>Nouveau produit</button>}
        </div>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-2">
          <KpiMini label="Actifs" v={kpis.actifs} c="#1f8a4c"/>
          <KpiMini label="Inactifs" v={kpis.inactifs} c="#999"/>
          <KpiMini label="En attente" v={kpis.liste_attente} c="#e4991e"/>
          <KpiMini label="Rupture" v={kpis.rupture} c="#c62828"/>
          <KpiMini label="Stock bas" v={kpis.stock_bas} c="#e4991e"/>
          {kpis.valeur_cout != null && <KpiMini label="Valeur au coût" v={fcfaCompact(kpis.valeur_cout)} full={fcfa(kpis.valeur_cout)} c="#5867fd" small/>}
          <KpiMini label="Valeur de vente" v={fcfaCompact(kpis.valeur_vente)} full={fcfa(kpis.valeur_vente)} c="#b02a2a" small/>
          {kpis.marge_moyenne != null && <KpiMini label="Marge moyenne" v={`${kpis.marge_moyenne}%`} c="#1f8a4c"/>}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <div className="relative flex-1 max-w-md"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]"/><input className="dina-input pl-9" placeholder="Nom, marque, SKU, code-barres…" value={q} onChange={e=>setQ(e.target.value)} data-testid="products-search"/></div>
          <FiltersPanel fields={filterFields} value={filters} onChange={setFilters} tabKey="products"/>
        </div>
        <div className="flex items-center gap-2">
          {selected.length > 0 && (
            <div className="relative">
              <button onClick={()=>setBulkOpen(!bulkOpen)} className="dina-chip !bg-[#1c1c1c] !text-white" data-testid="bulk-menu">{selected.length} sélectionné(s)<ChevronDown size={11}/></button>
              {bulkOpen && (
                <div className="absolute right-0 top-10 bg-white dark:bg-[#1a1a1a] border border-[#ececec] dark:border-[#2a2a2a] rounded-xl shadow-xl p-1 z-30 w-56">
                  <button onClick={()=>bulkStatus("actif")} className="w-full text-left text-xs px-2 py-1.5 hover:bg-[#fff5f5] dark:hover:bg-[#2a1818] rounded">Activer</button>
                  <button onClick={()=>bulkStatus("inactif")} className="w-full text-left text-xs px-2 py-1.5 hover:bg-[#fff5f5] dark:hover:bg-[#2a1818] rounded">Désactiver</button>
                  <button onClick={()=>bulkStatus("liste_attente")} className="w-full text-left text-xs px-2 py-1.5 hover:bg-[#fff5f5] dark:hover:bg-[#2a1818] rounded">Mettre en liste d'attente</button>
                  <button onClick={()=>bulkStatus("archive")} className="w-full text-left text-xs px-2 py-1.5 hover:bg-[#fff5f5] dark:hover:bg-[#2a1818] rounded">Archiver</button>
                  <div className="border-t border-[#ececec] dark:border-[#2a2a2a] my-1"/>
                  <button onClick={bulkPromo} className="w-full text-left text-xs px-2 py-1.5 hover:bg-[#fff5f5] dark:hover:bg-[#2a1818] rounded"><Tag size={10} className="inline mr-1"/>Mettre en promotion</button>
                </div>
              )}
            </div>
          )}
          <ViewToggle value={view} onChange={setView} options={["grid","table"]} tabKey="products"/>
        </div>
      </div>

      {/* List */}
      {view === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3" data-testid="products-grid">
          {filtered.map(p => <ProductCard key={p.id} p={p} selected={selected.includes(p.id)} onToggle={toggleSel} onOpen={()=>nav(`/console/produits/${p.id}`)} onEdit={canEdit ? ()=>setEditId(p.id) : null} money={money} salesMap={salesMap}/>)}
          {filtered.length === 0 && <div className="col-span-full dina-card-white py-12 text-center text-sm text-[#666]">Aucun produit</div>}
        </div>
      ) : (
        <div className="dina-card-white overflow-hidden">
          <div className="overflow-x-auto"><table className="dina-table" data-testid="products-table">
            <thead><tr>
              <th className="w-8"><input type="checkbox" checked={allSelected} onChange={()=>setSelected(allSelected?[]:filtered.map(p=>p.id))} className="accent-[#b02a2a]"/></th>
              <th>Produit</th><th>Marque</th><th>Catégorie</th><th>SKU</th>
              <th className="text-right">Prix</th>{money && <><th className="text-right">Achat</th><th className="text-right">Marge</th></>}
              <th className="text-right">Stock</th><th>Variantes</th><th>Statut</th><th className="text-right">Ventes 30j</th><th></th>
            </tr></thead>
            <tbody>{filtered.slice(0,200).map(p => {
              const m = p.price&&p.cost ? Math.round((p.price-p.cost)/p.price*100) : 0;
              const status = deriveStatus(p); const sales30 = salesMap[p.id] || 0;
              const stk = p.stock || 0;
              return (
                <tr key={p.id} data-testid={`product-row-${p.sku}`} className={selected.includes(p.id)?"bg-[#fff5f5] dark:bg-[#2a1818]":""}>
                  <td><input type="checkbox" checked={selected.includes(p.id)} onChange={()=>toggleSel(p.id)} className="accent-[#b02a2a]"/></td>
                  <td><button onClick={()=>setDetailId(p.id)} className="flex items-center gap-2 hover:text-[#b02a2a] text-left"><div className="w-9 h-9 rounded bg-[#f5f5f5] overflow-hidden shrink-0"><SmartImage src={p.image || p.images?.[0]} alt={p.name} fallbackText={p.name} className="w-full h-full object-cover"/></div><span className="font-medium">{p.name}</span></button></td>
                  <td className="text-[#666]">{p.brand}</td>
                  <td className="text-[#666]">{p.category}</td>
                  <td className="font-mono text-xs">{p.sku}</td>
                  <td className="text-right tabular font-semibold">{fcfa(p.price)}</td>
                  {money && <><td className="text-right tabular text-[#666]">{fcfa(p.cost||0)}</td>
                  <td className="text-right tabular"><span className={m>=40?"text-[#1f8a4c]":m<20?"text-[#c62828]":"text-[#e4991e]"}>{m}%</span></td></>}
                  <td className="text-right tabular"><span className={stk<5?"text-[#c62828] font-semibold":stk<10?"text-[#e4991e]":""}>{stk}</span></td>
                  <td className="text-xs text-[#666]">{(p.sizes||[]).length}·{(p.colors||[]).length}c</td>
                  <td><span className="dina-chip !py-0.5 !px-2 text-[10px]" style={{color:STATUS_COLOR[status],borderColor:STATUS_COLOR[status]}}>{STATUS_LABEL[status]||"Actif"}</span></td>
                  <td className="text-right tabular text-[#666]">{sales30}</td>
                  <td className="text-right whitespace-nowrap">
                    <button onClick={()=>setDetailId(p.id)} className="text-[#5867fd] mr-1.5" title="Voir" data-testid={`view-${p.sku}`}><Eye size={14}/></button>
                    {canEdit && <button onClick={()=>setEditId(p.id)} className="text-[#0021cc] mr-1.5" title="Modifier" data-testid={`edit-product-${p.sku}`}><Pencil size={14}/></button>}
                    {money && <button onClick={()=>del(p.id)} className="text-[#c62828]" title="Supprimer"><Trash2 size={14}/></button>}
                  </td>
                </tr>
              );
            })}</tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}

function ProductCard({ p, selected, onToggle, onOpen, onEdit, salesMap, money }) {
  const status = deriveStatus(p); const stk = p.stock||0;
  const promo = p.price_old && p.price_old > p.price;
  const m = p.price&&p.cost ? Math.round((p.price-p.cost)/p.price*100) : 0;
  const sales30 = salesMap[p.id] || 0;
  return (
    <div className={`dina-card-white overflow-hidden group relative ${selected?"ring-2 ring-[#b02a2a]":""}`} data-testid={`product-card-${p.id}`}>
      <input type="checkbox" checked={selected} onChange={()=>onToggle(p.id)} className="absolute top-2 left-2 z-10 accent-[#b02a2a] w-4 h-4"/>
      <button onClick={onOpen} className="block w-full text-left">
        <div className="aspect-square bg-[#fff5f5] relative overflow-hidden">
          <SmartImage src={p.image || p.images?.[0]} alt={p.name} fallbackText={p.name} className="w-full h-full object-cover group-hover:scale-105 transition"/>
          {promo && <span className="absolute top-2 right-2 bg-[#b02a2a] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">-{p.promo_pct || Math.round((p.price_old-p.price)/p.price_old*100)}%</span>}
          {status !== "actif" && <span className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{background:STATUS_COLOR[status]}}>{STATUS_LABEL[status]}</span>}
          {status === "actif" && stk === 0 && <div className="absolute inset-0 bg-black/40 grid place-items-center text-white text-xs font-bold">RUPTURE</div>}
        </div>
        <div className="p-3">
          <div className="text-[10px] text-[#999] font-semibold uppercase">{p.brand}</div>
          <div className="text-sm font-medium leading-tight line-clamp-2 min-h-[2.2em]">{p.name}</div>
          <div className="flex items-baseline justify-between mt-1.5">
            <div><span className="tabular text-sm font-bold text-[#b02a2a]">{fcfa(p.price)}</span>{promo && <span className="text-[10px] text-[#999] line-through tabular ml-1">{fcfa(p.price_old)}</span>}</div>
            {money && <span className={`text-[10px] tabular ${m>=40?"text-[#1f8a4c]":m<20?"text-[#c62828]":""}`}>{m}%</span>}
          </div>
          <div className="flex items-center justify-between mt-1 text-[10px] text-[#999]"><span>Stk <b>{stk}</b> · {(p.sizes||[]).length}t·{(p.colors||[]).length}c</span><span><BarChart3 size={9} className="inline"/> {sales30}/30j</span></div>
        </div>
      </button>
      {onEdit && <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition flex gap-1">
        <button onClick={onEdit} className="w-7 h-7 rounded-lg bg-white dark:bg-[#2a2a2a] shadow grid place-items-center" title="Modifier"><Pencil size={11}/></button>
      </div>}
    </div>
  );
}

function KpiMini({ label, v, c, small, full }) {
  return (
    <div className="dina-card-white p-3 min-w-0" title={full || undefined} data-testid={`kpi-${label.toLowerCase().replace(/\s/g,'-').replace(/\./g,'')}`}>
      <div className="text-[10px] uppercase tracking-wide text-[#666] font-semibold leading-tight">{label}</div>
      <div className={`font-serif tabular leading-tight mt-1.5 break-words ${small ? "text-base" : "text-2xl"}`} style={{ color: c }}>{v}</div>
    </div>
  );
}
