import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "@/lib/api";
import { fcfa, dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";
import { ChevronLeft, Pencil, Boxes, TrendingUp, History, Image as ImageIcon } from "lucide-react";
import SmartImage from "@/components/shared/SmartImage";

export default function ProductDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [product, setProduct] = useState(null);
  const [movements, setMovements] = useState([]);
  const [sales, setSales] = useState([]);
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [p, mv, s] = await Promise.all([
          api.get(`/products/${id}`).catch(() => api.get("/products").then(r => ({ data: (r.data || []).find(x => x.id === id) }))),
          api.get(`/stock-movements?product_id=${id}`).catch(() => ({ data: [] })),
          api.get("/orders").catch(() => ({ data: [] })),
        ]);
        if (!p.data) return toast.error("Produit introuvable");
        setProduct(p.data);
        setMovements((mv.data || []).slice(0, 30));
        const prodSales = (s.data || []).flatMap(o => (o.items || []).filter(it => it.product_id === id).map(it => ({ ...it, order_code: o.code, order_date: o.created_at, status: o.status })));
        setSales(prodSales.slice(0, 30));
      } catch { toast.error("Erreur chargement"); }
    })();
  }, [id]);

  if (!product) return <div className="text-center py-12 text-sm text-[#666]">Chargement…</div>;

  const totalSold = sales.filter(s => s.status === "livree").reduce((s, i) => s + (i.qty || 0), 0);
  const totalRevenue = sales.filter(s => s.status === "livree").reduce((s, i) => s + (i.qty || 0) * (i.price || 0), 0);
  const stock = Object.values(product.stock_by_size || {}).reduce((a, b) => a + Number(b || 0), 0) || product.stock || 0;

  return (
    <div className="space-y-5 font-sora" data-testid="product-detail">
      <button onClick={() => nav("/console/produits")} className="text-sm text-[#666] inline-flex items-center gap-1 hover:text-[#b02a2a]"><ChevronLeft size={13}/>Retour au catalogue</button>

      <div className="dina-card-white p-5 flex flex-col lg:flex-row gap-5">
        <div className="lg:w-72 shrink-0">
          <SmartImage src={product.image || product.images?.[0]} alt={product.name} fallbackText={product.name} className="w-full aspect-square rounded-xl object-cover bg-[#fff5f5]"/>
          {(product.images || []).length > 1 && (
            <div className="grid grid-cols-4 gap-1 mt-2">
              {(product.images || []).slice(0, 8).map((img, i) => <SmartImage key={i} src={img} alt="" className="w-full aspect-square rounded object-cover bg-[#fff5f5]"/>)}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <div className="text-xs text-[#999] uppercase font-semibold">{product.brand} · {product.category}</div>
              <div className="font-serif text-3xl">{product.name}</div>
              <div className="text-xs text-[#666] mt-1">SKU {product.sku || "—"} · {product.material || "—"}</div>
            </div>
            <button onClick={() => nav(`/console/produits?edit=${product.id}`)} className="dina-btn-primary !min-h-[36px]" data-testid="product-edit"><Pencil size={13}/>Modifier</button>
          </div>
          <p className="text-sm text-[#444] leading-relaxed">{product.description || "—"}</p>
          <div className="flex items-center gap-4 flex-wrap">
            <div><div className="text-[10px] uppercase text-[#999]">Prix</div><div className="font-serif tabular text-2xl text-[#b02a2a]">{fcfa(product.price)}</div></div>
            {product.price_old > product.price && <div><div className="text-[10px] uppercase text-[#999]">Avant</div><div className="font-serif tabular text-sm line-through text-[#999]">{fcfa(product.price_old)}</div></div>}
            <div><div className="text-[10px] uppercase text-[#999]">Coût</div><div className="font-serif tabular text-lg">{fcfa(product.cost || 0)}</div></div>
            <div><div className="text-[10px] uppercase text-[#999]">Marge</div><div className="font-serif tabular text-lg text-[#1f8a4c]">{fcfa((product.price || 0) - (product.cost || 0))}</div></div>
          </div>
          <div className="flex gap-2 flex-wrap text-xs">
            {(product.sizes || []).map(sz => <span key={sz} className="dina-chip">{sz} · {product.stock_by_size?.[sz] || 0}</span>)}
          </div>
          <div className="flex gap-2 flex-wrap text-xs">
            {(product.colors || []).map(c => <span key={c} className="dina-chip">{c}</span>)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Stock total" value={stock} color={stock === 0 ? "#c62828" : stock < 5 ? "#e4991e" : "#1f8a4c"} testid="prod-kpi-stock"/>
        <Kpi label="Vendus (livrés)" value={totalSold} color="#1c1c1c" testid="prod-kpi-sold"/>
        <Kpi label="CA réalisé" value={fcfa(totalRevenue)} color="#b02a2a" testid="prod-kpi-revenue"/>
        <Kpi label="Statut" value={product.status || "actif"} color="#5867fd" testid="prod-kpi-status"/>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Section title="Historique stock" icon={Boxes} testid="prod-movements">
          {movements.length === 0 ? <Empty>Aucun mouvement enregistré</Empty> : movements.map(m => (
            <div key={m.id} className="flex items-center justify-between py-1.5 px-2 rounded border-b border-[#f0f0f0]">
              <div className="min-w-0"><div className="text-sm font-medium truncate">{m.reason || m.type || "Mouvement"}</div><div className="text-[11px] text-[#666]">{dateTimeFmt(m.at)}</div></div>
              <span className={`tabular font-semibold ${m.qty > 0 ? "text-[#1f8a4c]" : "text-[#c62828]"}`}>{m.qty > 0 ? "+" : ""}{m.qty}</span>
            </div>
          ))}
        </Section>

        <Section title="Dernières ventes" icon={TrendingUp} testid="prod-sales">
          {sales.length === 0 ? <Empty>Aucune vente</Empty> : sales.map((s, i) => (
            <div key={i} onClick={() => nav(`/console/commandes/${s.order_code}`)} className="flex items-center justify-between py-1.5 px-2 rounded cursor-pointer hover:bg-[#fff5f5] border-b border-[#f0f0f0]">
              <div className="min-w-0"><div className="text-sm font-medium truncate">{s.order_code} · ×{s.qty}</div><div className="text-[11px] text-[#666]">{dateTimeFmt(s.order_date)} · {s.size || "—"} · {s.color || "—"}</div></div>
              <div className="text-right"><div className="tabular font-semibold text-sm">{fcfa(s.qty * s.price)}</div><div className="text-[10px] text-[#666]">{s.status}</div></div>
            </div>
          ))}
        </Section>
      </div>
    </div>
  );
}

function Kpi({ label, value, color, testid }) {
  return <div className="dina-card-white p-3" data-testid={testid}><div className="text-[10px] uppercase text-[#666] font-semibold">{label}</div><div className="font-serif tabular text-xl mt-1 truncate" style={{ color }}>{value}</div></div>;
}
function Section({ title, icon: Icon, testid, children }) {
  return <div className="dina-card-white p-4" data-testid={testid}><div className="flex items-center gap-2 font-semibold mb-3"><Icon size={14} className="text-[#b02a2a]"/>{title}</div><div className="max-h-96 overflow-y-auto">{children}</div></div>;
}
function Empty({ children }) { return <div className="text-center text-xs text-[#999] py-4">{children}</div>; }
