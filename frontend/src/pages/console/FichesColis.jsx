import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { fcfa, payInfo } from "@/lib/format";
import { toast } from "sonner";
import { Printer, Phone, MapPin } from "lucide-react";
import { OrderFilters, applyOrderFilters, EMPTY_FILTERS } from "@/components/shared/OrderFilters";

const QR_URL = (txt, size=120) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(txt)}`;

export default function FichesColis() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [format, setFormat] = useState("a4"); // 80mm | a6 | a4
  const [f, setF] = useState({ ...EMPTY_FILTERS });
  const [brand, setBrand] = useState({ logo: "", name: "Chez Dina", phone: "+225 07 77 92 61 79", tiktok: "@dinoush04" });
  useEffect(() => {
    api.get("/orders").then(r => {
      const ready = r.data.filter(o => ["prete","assignee","en_livraison"].includes(o.status));
      setOrders(ready);
      // Preselect from ?ids=
      const idsParam = params.get("ids");
      if (idsParam) {
        const ids = idsParam.split(",").filter(Boolean);
        setSelected(new Set(ids.filter(id => ready.some(o => o.id === id))));
      }
    });
    api.get("/public/site").then(r => setBrand(b => ({ ...b, logo: r.data?.logo || "", name: r.data?.name || b.name }))).catch(() => {});
    api.get("/public/business").then(r => setBrand(b => ({ ...b, phone: r.data?.phone || b.phone, tiktok: r.data?.tiktok || b.tiktok }))).catch(() => {});
  }, []); // eslint-disable-line

  const toggle = (id) => { const n = new Set(selected); n.has(id)?n.delete(id):n.add(id); setSelected(n); };
  const shown = applyOrderFilters(orders, f);
  const allShownSel = shown.length > 0 && shown.every(o => selected.has(o.id));
  const toggleAll = () => { const n = new Set(selected); shown.forEach(o => allShownSel ? n.delete(o.id) : n.add(o.id)); setSelected(n); };
  const list = orders.filter(o => selected.has(o.id));

  const print = () => { if (!list.length) return toast.error("Sélectionnez des commandes"); window.print(); };

  return (
    <div className="space-y-5">
      <div className="print:hidden flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="font-serif text-3xl">Fiches colis</h1><p className="text-sm text-[#666]">Étiquettes QR imprimables à coller sur les sacs de livraison</p></div>
        <div className="flex gap-2 flex-wrap">
          <select className="dina-input !w-auto" value={format} onChange={e=>setFormat(e.target.value)} data-testid="format-select">
            <option value="80mm">Thermique 80mm</option>
            <option value="a6">A6 (100×150 mm)</option>
            <option value="a4">A4 — 4 par feuille</option>
          </select>
          <button onClick={print} disabled={!list.length} className="dina-btn-primary" data-testid="print-labels"><Printer size={14}/>Aperçu & impression ({list.length})</button>
        </div>
      </div>

      <div className="print:hidden dina-card-white p-4 space-y-3">
        <OrderFilters orders={orders} value={f} onChange={setF} fields={["q", "status", "date", "slot", "zone", "rider"]} statuses={["prete", "assignee", "en_livraison"]} testid="fiches-filters"/>
        <div className="flex items-center justify-between">
          <div className="font-semibold text-sm">Commandes à expédier ({shown.length}{shown.length !== orders.length ? ` / ${orders.length}` : ""})</div>
          <button onClick={toggleAll} className="text-xs text-[#b02a2a]" data-testid="toggle-all">{allShownSel?"Tout désélectionner":"Tout sélectionner"}</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[55vh] overflow-y-auto">
          {shown.map(o => (
            <label key={o.id} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${selected.has(o.id)?"border-[#b02a2a] bg-[#fff5f5] dark:bg-[#2a1818]":"border-[#ececec] dark:border-[#2a2a2a]"}`} data-testid={`order-select-${o.code}`}>
              <input type="checkbox" checked={selected.has(o.id)} onChange={()=>toggle(o.id)} className="accent-[#b02a2a]"/>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{o.code}</div>
                <div className="text-xs text-[#666] truncate">{o.customer?.name} · {o.delivery_zone}</div>
                <div className="text-xs tabular">{fcfa(o.total)} · {o.payment_method==="cod"?"Paiement livraison":payInfo(o).label}</div>
              </div>
            </label>
          ))}
          {shown.length === 0 && <div className="text-sm text-[#666] text-center col-span-full py-8">{orders.length ? "Aucune commande pour ces filtres" : "Aucune commande prête à expédier"}</div>}
        </div>
      </div>

      {/* Printable labels */}
      <div className={`labels-area labels-${format}`}>
        {list.map(o => <Label key={o.id} order={o} format={format} brand={brand}/>)}
      </div>

      <style>{`
        @media print { .print\\:hidden { display:none !important; } body { background:white !important; } }
        .labels-area.labels-a4 { display:grid; grid-template-columns:1fr 1fr; gap:4mm; page-break-inside:avoid; }
        .labels-area.labels-a4 .fiche { break-inside:avoid; }
        .labels-area.labels-a4 .fiche:nth-child(4n) { page-break-after:always; }
        .labels-area.labels-a6 .fiche { page-break-after:always; }
        .labels-area.labels-80mm .fiche { width:80mm; page-break-after:always; font-size:11px; }
        .fiche { background:white; color:#1c1c1c; border:1px solid #ececec; border-radius:8px; padding:10px 12px; font-family:'Sora',sans-serif; }
      `}</style>
    </div>
  );
}

function Label({ order, format, brand = {} }) {
  const total = order.total || 0;
  const paid = order.payment_method === "cod" ? 0 : total;
  const toCollect = total - paid;
  const addr = (order.delivery_address || order.customer?.address || order.delivery_zone || "");
  const maps = `https://maps.google.com/?q=${encodeURIComponent(addr + " " + order.delivery_zone + " Abidjan")}`;
  return (
    <div className="fiche" data-testid={`label-${order.code}`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          {brand.logo && <img src={brand.logo} alt="" className="w-8 h-8 object-contain rounded"/>}
          <div><div className="font-serif text-base font-bold">{brand.name || "Chez Dina"}</div><div className="text-[9px] text-[#666]">{brand.phone || "+225 07 77 92 61 79"} · {brand.tiktok || "@dinoush04"}</div></div>
        </div>
        <img alt="QR" src={QR_URL(order.code, 70)} className="w-16 h-16"/>
      </div>
      <div className="font-serif text-xl font-bold tracking-wider mb-1">{order.code}</div>
      <div className="text-[10px] text-[#666] mb-2">Livraison : {order.delivery_date ? new Date(order.delivery_date).toLocaleDateString("fr-FR") : "—"} {order.delivery_slot?`· ${order.delivery_slot}`:""}</div>

      <div className="border-t border-dashed border-[#ececec] pt-2 mb-2">
        <div className="text-[9px] uppercase text-[#999]">Cliente</div>
        <div className="font-semibold text-sm">{order.customer?.name || "—"}</div>
        <div className="flex items-center gap-1 text-sm"><Phone size={10}/><strong className="tabular">{order.customer?.phone || "—"}</strong></div>
      </div>

      <div className="border-t border-dashed border-[#ececec] pt-2 mb-2">
        <div className="text-[9px] uppercase text-[#999] flex items-center gap-1"><MapPin size={9}/>Adresse</div>
        <div className="text-xs"><strong>{order.delivery_zone || "—"}</strong></div>
        {addr && <div className="text-xs text-[#666]">{addr}</div>}
        <div className="flex items-center gap-2 mt-1"><img alt="QR Maps" src={QR_URL(maps, 50)} className="w-10 h-10"/><span className="text-[9px] text-[#999]">Scanner pour itinéraire</span></div>
      </div>

      <div className="border-t border-dashed border-[#ececec] pt-2 mb-2">
        <div className="text-[9px] uppercase text-[#999]">Articles · {order.items?.length || 0}</div>
        {(order.items||[]).map((it,i)=>(
          <div key={i} className="text-xs flex justify-between"><span>{it.qty}× {it.name}{it.size?` · ${it.size}`:""}{it.color?` · ${it.color}`:""}</span></div>
        ))}
      </div>

      <div className="border-t border-dashed border-[#ececec] pt-2 mb-2 text-xs space-y-0.5">
        <div className="flex justify-between"><span className="text-[#666]">Articles</span><span className="tabular">{fcfa(total - (order.delivery_fee||0))}</span></div>
        {order.delivery_fee>0 && <div className="flex justify-between"><span className="text-[#666]">Livraison</span><span className="tabular">{fcfa(order.delivery_fee)}</span></div>}
        <div className="flex justify-between font-semibold"><span>TOTAL</span><span className="tabular">{fcfa(total)}</span></div>
      </div>

      <div className={`rounded-lg px-3 py-2 text-center ${toCollect>0?"bg-[#b02a2a] text-white":"bg-[#1f8a4c] text-white"}`}>
        <div className="text-[9px] uppercase tracking-wider">{toCollect>0?"À encaisser":"Déjà payé"}</div>
        <div className="font-serif text-xl tabular font-bold">{toCollect>0?fcfa(toCollect):`${fcfa(paid)} ·`}&nbsp;{toCollect>0?"":"0 à encaisser"}</div>
      </div>

      {order.rider_name && <div className="mt-2 text-[10px] text-center text-[#666]">Livreur : <strong>{order.rider_name}</strong></div>}
      {order.notes && <div className="mt-2 text-[10px] italic text-[#666] text-center">« {order.notes} »</div>}
    </div>
  );
}
