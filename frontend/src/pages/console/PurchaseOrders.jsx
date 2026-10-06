import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { fcfa, dateFmt } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, X, Package, Download, Printer, FileSpreadsheet, Eye, Pencil, LayoutGrid, Table as TableIcon, QrCode, CheckSquare, AlertTriangle } from "lucide-react";
import ViewToggle, { useStoredView } from "@/components/shared/ViewToggle";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

const STATUSES = ["brouillon", "commande", "recu_partiel", "recu", "cloture"];
const STATUS_LABEL = { brouillon: "Brouillon", commande: "Commandé", en_attente: "Commandé", recu_partiel: "Reçu partiellement", recu: "Reçu", receptionne: "Reçu", cloture: "Clôturé" };
const STATUS_COLOR = { brouillon: "#999", commande: "#5867fd", en_attente: "#5867fd", recu_partiel: "#e4991e", recu: "#1f8a4c", receptionne: "#1f8a4c", cloture: "#666" };
const QR_URL = (txt) => `https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(txt)}`;
// Builds a deep-link URL encoded in the QR that opens the right product variant when scanned
const buildScanUrl = (sku, size, color, productId) => {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams();
  if (sku) params.set("sku", sku);
  if (size) params.set("size", size);
  if (color) params.set("color", color);
  if (productId) params.set("pid", productId);
  return `${origin}/scan?${params.toString()}`;
};

export default function PurchaseOrders() {
  const { user } = useAuth();
  const [pos, setPos] = useState([]);
  const [sups, setSups] = useState([]);
  const [products, setProducts] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [view, setView] = useStoredView("po", "kanban");
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [receive, setReceive] = useState(null);
  const [labels, setLabels] = useState(null);

  const load = async () => {
    const [a, b, c, k] = await Promise.all([
      api.get("/purchase-orders"), api.get("/suppliers"), api.get("/products"),
      api.get("/purchase-orders/kpis").catch(() => ({ data: null })),
    ]);
    setPos(a.data); setSups(b.data); setProducts(c.data); setKpis(k.data);
  };
  useEffect(() => { load(); }, []);

  const save = async (f) => {
    try {
      if (f.id) await api.patch(`/purchase-orders/${f.id}/edit-guard`, f);
      else await api.post("/purchase-orders", f);
      toast.success("Enregistré"); setOpen(false); setEdit(null); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
  };
  const del = async (p) => { if (!confirm(`Supprimer ${p.number} ?`)) return; try { await api.delete(`/purchase-orders/${p.id}`); load(); } catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); } };

  const printPdf = (po, kind = "bon_commande") => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text(kind === "bon_commande" ? "Bon de commande" : "Bon de réception", 15, 20);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(`N° ${po.number} · ${dateFmt(po.created_at)}`, 15, 28);
    doc.text(`Fournisseur : ${po.supplier_name}`, 15, 34);
    doc.text(`Statut : ${STATUS_LABEL[po.status] || po.status}`, 15, 40);
    let y = 50;
    doc.setFont("helvetica", "bold");
    doc.text("Produit", 15, y); doc.text("Taille", 90, y); doc.text("Qté", 115, y, { align: "right" }); doc.text("Coût u.", 145, y, { align: "right" }); doc.text("Total", 185, y, { align: "right" });
    y += 2; doc.line(15, y, 195, y); y += 6;
    doc.setFont("helvetica", "normal");
    (po.items || []).forEach(it => {
      doc.text((it.product_name || "").slice(0, 40), 15, y);
      doc.text(String(it.size || ""), 90, y);
      doc.text(String(kind === "bon_reception" ? (it.qty_counted ?? it.qty) : it.qty), 115, y, { align: "right" });
      doc.text(String(it.unit_cost || 0), 145, y, { align: "right" });
      doc.text(String((it.qty || 0) * (it.unit_cost || 0)), 185, y, { align: "right" });
      y += 6;
      if (y > 270) { doc.addPage(); y = 20; }
    });
    y += 4; doc.setFont("helvetica", "bold"); doc.text(`Total : ${fcfa(po.total || 0)}`, 185, y, { align: "right" });
    doc.save(`${po.number}-${kind}.pdf`);
  };

  const exportXlsx = (po) => {
    const data = (po.items || []).map(it => ({
      Produit: it.product_name, SKU: it.sku, Taille: it.size, Couleur: it.color,
      "Qté commandée": it.qty, "Qté reçue": it.qty_counted ?? "", "Coût u.": it.unit_cost,
      "Total": (it.qty || 0) * (it.unit_cost || 0),
    }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lignes");
    XLSX.writeFile(wb, `${po.number}.xlsx`);
  };

  const openQrLabels = (po) => {
    const items = (po.items || []).filter(it => (it.qty_counted ?? it.qty) > 0);
    const labs = items.flatMap(it => {
      const qty = Number(it.qty_counted ?? it.qty) || 0;
      const url = buildScanUrl(it.sku, it.size, it.color, it.product_id);
      return Array.from({ length: qty }).map(() => ({
        product_name: it.product_name, sku: it.sku, size: it.size, color: it.color,
        unit_cost: it.unit_cost, qr: url, po_number: po.number,
      }));
    });
    if (!labs.length) { toast.error("Aucune unité à étiqueter"); return; }
    setLabels(labs);
  };

  if (detail) return (
    <>
      <PoDetail poId={detail} onBack={() => { setDetail(null); load(); }} onEdit={(p) => { setEdit(p); setOpen(true); setDetail(null); }} onReceive={(p) => { setReceive(p); setDetail(null); }} onPdf={printPdf} onXlsx={exportXlsx} onQr={openQrLabels} user={user} />
      {labels && <LabelsPrintModal labels={labels} onClose={() => setLabels(null)} />}
      {receive && <BlindReceive po={receive} user={user} onClose={() => setReceive(null)} onDone={() => { setReceive(null); load(); }} />}
    </>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Approvisionnements</h1><p className="text-sm text-[#666]">Bons de commande · Kanban · Réception à l'aveugle</p></div>
        {user?.role === "admin" && <button onClick={() => { setEdit({ items: [], extra_costs: [], status: "brouillon" }); setOpen(true); }} className="dina-btn-primary !min-h-[40px]" data-testid="po-new"><Plus size={14} />Nouveau bon</button>}
      </div>

      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
          <Kpi label="Bons du mois" v={kpis.this_month} c="#5867fd" />
          <Kpi label="Acheté mois" v={fcfa(kpis.total_month)} c="#b02a2a" small />
          <Kpi label="En attente" v={kpis.pending} c="#e4991e" />
          <Kpi label="Reçus partiel." v={kpis.partial} c="#e4991e" />
          <Kpi label="Montant dû" v={fcfa(kpis.due)} c="#c62828" small />
          <Kpi label="Marge prévue" v={`${kpis.avg_expected_margin}%`} c="#1f8a4c" />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs text-[#666]">{pos.length} bon(s)</div>
        <ViewToggle value={view} onChange={setView} options={["kanban", "table"]} tabKey="po" />
      </div>

      {view === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {STATUSES.map(st => {
            const col = pos.filter(p => (p.status === st) || (st === "commande" && p.status === "en_attente") || (st === "recu" && p.status === "receptionne"));
            return (
              <div key={st} className="dina-card-white p-3" data-testid={`po-col-${st}`}>
                <div className="flex items-center justify-between mb-2"><div className="text-xs font-semibold uppercase" style={{ color: STATUS_COLOR[st] }}>{STATUS_LABEL[st]}</div><span className="dina-chip text-[10px]">{col.length}</span></div>
                <div className="space-y-2">
                  {col.map(p => (
                    <button key={p.id} onClick={() => setDetail(p.id)} className="w-full text-left bg-[#fafafa] dark:bg-[#141414] p-2.5 rounded border border-[#ececec] dark:border-[#2a2a2a] hover:border-[#b02a2a]" data-testid={`po-kanban-${p.number}`}>
                      <div className="font-mono text-[10px] text-[#666]">{p.number}</div>
                      <div className="text-sm font-semibold truncate">{p.supplier_name}</div>
                      <div className="text-[11px] text-[#999]">{(p.items || []).length} lignes · {dateFmt(p.created_at)}</div>
                      <div className="text-xs tabular font-bold text-[#b02a2a] mt-1">{fcfa(p.total)}</div>
                    </button>
                  ))}
                  {col.length === 0 && <div className="text-[11px] text-[#999] text-center py-4">—</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="dina-card-white overflow-x-auto">
          <table className="dina-table">
            <thead><tr><th>N°</th><th>Fournisseur</th><th>Date</th><th>Lignes</th><th>Statut</th><th className="text-right">Total</th><th></th></tr></thead>
            <tbody>{pos.map(p => (
              <tr key={p.id} data-testid={`po-row-${p.number}`}>
                <td><button onClick={() => setDetail(p.id)} className="font-mono text-xs hover:text-[#b02a2a]">{p.number}</button></td>
                <td className="font-medium">{p.supplier_name}</td>
                <td className="text-xs text-[#666]">{dateFmt(p.created_at)}</td>
                <td className="text-xs">{(p.items || []).length}</td>
                <td><span className="dina-chip text-[10px]" style={{ color: STATUS_COLOR[p.status], borderColor: STATUS_COLOR[p.status] }}>{STATUS_LABEL[p.status] || p.status}</span></td>
                <td className="text-right tabular font-semibold">{fcfa(p.total)}</td>
                <td className="text-right whitespace-nowrap">
                  <button onClick={() => setDetail(p.id)} className="text-[#5867fd] mr-2"><Eye size={13} /></button>
                  {user?.role === "admin" && !["recu", "receptionne", "cloture"].includes(p.status) && <button onClick={() => del(p)} className="text-[#c62828]"><Trash2 size={13} /></button>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {open && <PoForm initial={edit} sups={sups} products={products} onSave={save} onClose={() => { setOpen(false); setEdit(null); }} />}
      {receive && <BlindReceive po={receive} user={user} onClose={() => setReceive(null)} onDone={() => { setReceive(null); load(); }} />}
      {labels && <LabelsPrintModal labels={labels} onClose={() => setLabels(null)} />}
    </div>
  );
}

function Kpi({ label, v, c, small }) {
  return <div className="dina-card-white p-3 min-w-0"><div className="text-[10px] uppercase tracking-wide text-[#666] font-semibold truncate">{label}</div><div className={`font-serif tabular leading-none mt-1.5 truncate ${small ? "text-base" : "text-xl"}`} style={{ color: c }}>{v}</div></div>;
}

function PoForm({ initial, sups, products, onSave, onClose }) {
  const [f, setF] = useState(initial || { supplier_id: "", items: [], extra_costs: [] });
  const supplier = sups.find(s => s.id === f.supplier_id);
  const itemsTotal = useMemo(() => (f.items || []).reduce((s, it) => s + (+it.qty || 0) * (+it.unit_cost || 0), 0), [f.items]);
  const extrasTotal = useMemo(() => (f.extra_costs || []).reduce((s, x) => s + (+x.amount || 0), 0), [f.extra_costs]);
  const total = itemsTotal + extrasTotal;
  const addItem = () => setF({ ...f, items: [...(f.items || []), { product_id: "", qty: 1, unit_cost: 0 }] });
  const updItem = (i, patch) => setF({ ...f, items: f.items.map((x, idx) => idx === i ? { ...x, ...patch } : x) });
  const rmItem = (i) => setF({ ...f, items: f.items.filter((_, idx) => idx !== i) });
  const addExtra = () => setF({ ...f, extra_costs: [...(f.extra_costs || []), { label: "", amount: 0 }] });
  const updExtra = (i, patch) => setF({ ...f, extra_costs: f.extra_costs.map((x, idx) => idx === i ? { ...x, ...patch } : x) });
  const rmExtra = (i) => setF({ ...f, extra_costs: f.extra_costs.filter((_, idx) => idx !== i) });
  const pickProd = (i, pid) => { const p = products.find(x => x.id === pid); if (!p) return; updItem(i, { product_id: p.id, product_name: p.name, sku: p.sku, unit_cost: p.cost || 0, size: (p.sizes || [])[0] || "", color: (p.colors || [])[0] || "", sell_price: p.price }); };

  const submit = () => {
    if (!f.supplier_id || !supplier) return toast.error("Fournisseur requis");
    if (!(f.items || []).length) return toast.error("Au moins un article");
    onSave({ ...f, supplier_name: supplier.name, total });
  };

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-4xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="po-form">
        <div className="flex items-center justify-between mb-4"><div className="font-serif text-xl">{initial?.id ? `Modifier ${initial.number}` : "Nouveau bon de commande"}</div><button onClick={onClose}><X size={18} /></button></div>
        <div className="space-y-3">
          <select className="dina-input" value={f.supplier_id || ""} onChange={e => setF({ ...f, supplier_id: e.target.value })} data-testid="po-supplier">
            <option value="">Fournisseur *…</option>
            {sups.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="date" className="dina-input" value={f.expected_at || ""} onChange={e => setF({ ...f, expected_at: e.target.value })} placeholder="Date prévue" />
          <textarea className="dina-input" rows={2} placeholder="Note" value={f.note || ""} onChange={e => setF({ ...f, note: e.target.value })} />

          <div className="flex justify-between items-center pt-2"><div className="font-semibold text-sm">Articles ({(f.items || []).length})</div><button onClick={addItem} className="dina-btn-secondary !min-h-[32px] text-xs" data-testid="po-add-item"><Plus size={11} />Ajouter</button></div>
          {(f.items || []).map((it, i) => (
            <div key={i} className="grid grid-cols-[2fr_90px_90px_80px_110px_28px] gap-2 items-end">
              <select className="dina-input !py-1.5 text-xs" value={it.product_id || ""} onChange={e => pickProd(i, e.target.value)}><option value="">Produit…</option>{products.map(p => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select>
              <input className="dina-input !py-1.5 text-xs" placeholder="Taille" value={it.size || ""} onChange={e => updItem(i, { size: e.target.value })} />
              <input className="dina-input !py-1.5 text-xs" placeholder="Couleur" value={it.color || ""} onChange={e => updItem(i, { color: e.target.value })} />
              <input type="number" className="dina-input !py-1.5 text-xs tabular text-right" value={it.qty || 1} onChange={e => updItem(i, { qty: +e.target.value })} data-testid={`po-qty-${i}`} />
              <input type="number" className="dina-input !py-1.5 text-xs tabular text-right" placeholder="Coût u." value={it.unit_cost || 0} onChange={e => updItem(i, { unit_cost: +e.target.value })} />
              <button onClick={() => rmItem(i)} className="text-[#c62828] pb-2"><Trash2 size={14} /></button>
            </div>
          ))}
          <div className="text-right text-sm tabular font-semibold pt-2 border-t">Total : <span className="text-[#b02a2a]">{fcfa(total)}</span></div>

          {/* Coûts additionnels (fret, douane, manutention) */}
          <div className="flex justify-between items-center pt-3 border-t border-[#ececec] dark:border-[#2a2a2a]">
            <div>
              <div className="font-semibold text-sm">Coûts additionnels ({(f.extra_costs || []).length})</div>
              <div className="text-[10px] text-[#666]">Transport, douane, manutention — répartis sur chaque article pour le coût de revient (landed cost)</div>
            </div>
            <button onClick={addExtra} className="dina-btn-secondary !min-h-[32px] text-xs" data-testid="po-add-extra"><Plus size={11} />Ajouter</button>
          </div>
          {(f.extra_costs || []).map((x, i) => (
            <div key={i} className="grid grid-cols-[1fr_120px_28px] gap-2 items-end" data-testid={`po-extra-${i}`}>
              <input className="dina-input !py-1.5 text-xs" placeholder="Libellé (ex: Transport, Douane, Manutention)" value={x.label || ""} onChange={e => updExtra(i, { label: e.target.value })} data-testid={`po-extra-label-${i}`}/>
              <input type="number" className="dina-input !py-1.5 text-xs tabular text-right" placeholder="Montant FCFA" value={x.amount || 0} onChange={e => updExtra(i, { amount: +e.target.value })} data-testid={`po-extra-amount-${i}`}/>
              <button onClick={() => rmExtra(i)} className="text-[#c62828] pb-2"><Trash2 size={14} /></button>
            </div>
          ))}
          {(f.extra_costs || []).length > 0 && (
            <div className="text-xs text-[#666] text-right tabular">
              Articles : <b className="text-[#1c1c1c] dark:text-white">{fcfa(itemsTotal)}</b> + Coûts additionnels : <b className="text-[#e4991e]">{fcfa(extrasTotal)}</b> = <b className="text-[#b02a2a]">{fcfa(total)}</b>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-5"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={submit} className="dina-btn-primary flex-1" data-testid="po-save">Enregistrer</button></div>
      </div>
    </div>
  );
}

function PoDetail({ poId, onBack, onEdit, onReceive, onPdf, onXlsx, onQr, user }) {
  const [po, setPo] = useState(null);
  const [validating, setValidating] = useState(false);
  useEffect(() => { api.get(`/purchase-orders/${poId}`).then(r => setPo(r.data)); }, [poId]);
  if (!po) return <div className="text-center text-sm text-[#666] py-12">Chargement…</div>;
  const readonly = ["recu", "receptionne", "cloture"].includes(po.status);
  const hasGaps = po.reception?.gaps?.length > 0 && !po.reception?.validated;

  const validate = async () => {
    const note = prompt("Note de validation (optionnel) :") || "";
    setValidating(true);
    try { await api.post(`/purchase-orders/${po.id}/validate-gaps`, { note }); toast.success("Écarts validés, stock mis à jour"); api.get(`/purchase-orders/${po.id}`).then(r => setPo(r.data)); }
    catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
    finally { setValidating(false); }
  };

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm text-[#666] inline-flex items-center gap-1 hover:text-[#b02a2a]">← Retour</button>
      <div className="dina-card-white p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-serif text-2xl">{po.number}</h1>
            <div className="text-sm text-[#666]">{po.supplier_name} · créé {dateFmt(po.created_at)}</div>
            <span className="dina-chip mt-1 text-[11px]" style={{ color: STATUS_COLOR[po.status], borderColor: STATUS_COLOR[po.status] }}>{STATUS_LABEL[po.status] || po.status}{readonly && " · lecture seule"}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => onPdf(po, "bon_commande")} className="dina-btn-secondary !min-h-[36px] text-xs" data-testid="po-pdf-cmd"><Printer size={12} />PDF commande</button>
            {po.status !== "brouillon" && <button onClick={() => onPdf(po, "bon_reception")} className="dina-btn-secondary !min-h-[36px] text-xs" data-testid="po-pdf-rcpt"><Printer size={12} />PDF réception</button>}
            <button onClick={() => onXlsx(po)} className="dina-btn-secondary !min-h-[36px] text-xs" data-testid="po-xlsx"><FileSpreadsheet size={12} />Excel</button>
            <button onClick={() => onQr(po)} className="dina-btn-secondary !min-h-[36px] text-xs" data-testid="po-qr"><QrCode size={12} />Étiquettes QR</button>
            {!readonly && user?.role === "admin" && <button onClick={() => onEdit(po)} className="dina-btn-secondary !min-h-[36px] text-xs"><Pencil size={12} />Modifier</button>}
            {!readonly && <button onClick={() => onReceive(po)} className="dina-btn-primary !min-h-[36px] text-xs" data-testid="po-receive"><Package size={12} />Réceptionner</button>}
          </div>
        </div>
      </div>

      {hasGaps && user?.role === "admin" && (
        <div className="dina-card-white p-4 bg-[#fff8e8] dark:bg-[#2a2318] border-l-4 border-[#e4991e]" data-testid="po-gaps-warning">
          <div className="font-semibold text-sm flex items-center gap-2 mb-2"><AlertTriangle size={14} className="text-[#e4991e]" />Écarts à valider ({po.reception.gaps.length})</div>
          <table className="dina-table"><thead><tr><th>Produit</th><th>Taille</th><th className="text-right">Commandé</th><th className="text-right">Compté</th><th className="text-right">Écart</th></tr></thead>
            <tbody>{po.reception.gaps.map((g, i) => (
              <tr key={i}><td>{g.product_name}</td><td>{g.size || "—"}</td><td className="text-right tabular">{g.ordered}</td><td className="text-right tabular">{g.counted}</td><td className={`text-right tabular font-semibold ${g.gap < 0 ? "text-[#c62828]" : "text-[#1f8a4c]"}`}>{g.gap > 0 ? "+" : ""}{g.gap}</td></tr>
            ))}</tbody>
          </table>
          <button onClick={validate} disabled={validating} className="dina-btn-primary mt-3" data-testid="po-validate-gaps"><CheckSquare size={13} />Valider les écarts et mettre à jour le stock</button>
        </div>
      )}

      <div className="dina-card-white p-5">
        <div className="font-semibold mb-3">Lignes ({(po.items || []).length})</div>
        <table className="dina-table"><thead><tr><th>Produit</th><th>Taille</th><th>Couleur</th><th className="text-right">Qté cmd</th><th className="text-right">Qté reçue</th><th className="text-right">Coût u.</th><th className="text-right">Prix vente</th><th className="text-right">Marge</th></tr></thead>
          <tbody>{(po.items || []).map((it, i) => {
            const m = (it.unit_cost && it.sell_price) ? Math.round((it.sell_price - it.unit_cost) / it.sell_price * 100) : 0;
            return <tr key={i}><td className="font-medium">{it.product_name}</td><td>{it.size || "—"}</td><td>{it.color || "—"}</td><td className="text-right tabular">{it.qty}</td><td className="text-right tabular">{it.qty_counted ?? "—"}</td><td className="text-right tabular">{fcfa(it.unit_cost)}</td><td className="text-right tabular">{fcfa(it.sell_price || 0)}</td><td className="text-right tabular text-[#1f8a4c]">{m}%</td></tr>;
          })}</tbody>
        </table>
      </div>

      {po.reception && (
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-2">Réception</div>
          <div className="text-sm text-[#666] space-y-1">
            <div>Reçu par <b>{po.reception.received_by}</b> le {dateFmt(po.reception.at)}</div>
            {po.reception.validated && <div>Validé par <b>{po.reception.validated_by}</b> le {dateFmt(po.reception.validated_at)}</div>}
            {po.reception.photos?.length > 0 && <div className="flex gap-2 flex-wrap mt-2">{po.reception.photos.map((p, i) => <img key={i} src={p} alt="" className="w-20 h-20 object-cover rounded" />)}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function BlindReceive({ po, user, onClose, onDone }) {
  // Blind: initial qty_counted = 0 ; receiver DOES NOT see po.items qty
  const [counts, setCounts] = useState((po.items || []).map(() => ({ qty_counted: 0, photo: "" })));
  const [photos, setPhotos] = useState([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isOwner = user?.role === "admin";

  const upd = (i, v) => setCounts(counts.map((x, idx) => idx === i ? { ...x, qty_counted: Math.max(0, +v || 0) } : x));
  const addPhoto = (e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setPhotos([...photos, r.result]); r.readAsDataURL(f); };

  const submit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        counts: counts.map((c, i) => ({ line_id: i, product_id: po.items[i]?.product_id, qty_counted: c.qty_counted })),
        photos, note,
      };
      const { data } = await api.post(`/purchase-orders/${po.id}/blind-receive`, payload);
      if (data.gaps?.length) toast.warning(`${data.gaps.length} écart(s) détecté(s) — attend la validation du propriétaire`);
      else toast.success("Réception validée, stock mis à jour");
      onDone();
    } catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="blind-receive">
        <div className="flex items-center justify-between mb-3"><div><div className="font-serif text-xl">Réception à l'aveugle · {po.number}</div><div className="text-xs text-[#666]">Comptez les articles reçus sans voir les quantités commandées.{!isOwner && " Les écarts seront validés par le propriétaire."}</div></div><button onClick={onClose}><X size={18} /></button></div>
        <table className="dina-table mb-3"><thead><tr><th>Produit</th><th>Taille</th><th>Couleur</th><th className="text-right">Qté comptée</th></tr></thead>
          <tbody>{(po.items || []).map((it, i) => (
            <tr key={i}><td className="font-medium">{it.product_name}</td><td>{it.size || "—"}</td><td>{it.color || "—"}</td><td className="text-right"><input type="number" min={0} className="dina-input tabular text-right w-24 !py-1" value={counts[i].qty_counted} onChange={e => upd(i, e.target.value)} data-testid={`blind-qty-${i}`} /></td></tr>
          ))}</tbody>
        </table>
        <div className="mb-3">
          <label className="text-xs font-semibold text-[#666] uppercase mb-1 block">Photos des articles endommagés / anomalies</label>
          <div className="flex gap-2 flex-wrap">
            {photos.map((p, i) => <img key={i} src={p} alt="" className="w-16 h-16 object-cover rounded" />)}
            <label className="w-16 h-16 border-2 border-dashed border-[#ececec] dark:border-[#2a2a2a] rounded grid place-items-center cursor-pointer text-[#999]"><input type="file" accept="image/*" capture="environment" onChange={addPhoto} className="hidden" data-testid="blind-photo" />+</label>
          </div>
        </div>
        <textarea className="dina-input mb-3" rows={2} placeholder="Note de réception (casse, anomalies, signature…)" value={note} onChange={e => setNote(e.target.value)} data-testid="blind-note" />
        <div className="flex gap-2"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={submit} disabled={submitting} className="dina-btn-primary flex-1" data-testid="blind-submit"><CheckSquare size={13} />{submitting ? "Envoi…" : "Valider la réception"}</button></div>
      </div>
    </div>
  );
}

function LabelsPrintModal({ labels, onClose }) {
  const printInNewWindow = () => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { toast.error("Pop-up bloquée — autorisez les pop-ups pour cette page"); return; }
    const cells = labels.map(l => `
      <div class="qr-cell">
        <img src="${QR_URL(l.qr)}" alt="QR"/>
        <div class="meta">
          <div class="pname">${(l.product_name || "").replace(/</g, "&lt;")}</div>
          <div>SKU: <b>${l.sku || ""}</b></div>
          <div>T: <b>${l.size || "—"}</b> · C: <b>${l.color || "—"}</b></div>
          <div class="muted">PA: ${fcfa(l.unit_cost)}</div>
          <div class="muted">${l.po_number || ""}</div>
        </div>
      </div>`).join("");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Étiquettes QR · ${labels.length}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 10mm; background: white; color: #1c1c1c; }
        h1 { font-size: 14px; margin: 0 0 8mm 0; }
        .sheet { display: grid; grid-template-columns: repeat(3, 70mm); gap: 0; }
        .qr-cell { border: 1px solid #ddd; padding: 4px 6px; height: 37mm; display: flex; gap: 6px; align-items: center; page-break-inside: avoid; }
        .qr-cell img { width: 22mm; height: 22mm; flex-shrink: 0; }
        .meta { font-size: 9px; line-height: 1.2; min-width: 0; }
        .meta .pname { font-weight: 700; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .meta .muted { color: #666; }
        @page { size: A4; margin: 10mm; }
        @media print { h1 { display: none; } body { padding: 0; } }
      </style></head><body>
      <h1>Étiquettes QR · ${labels.length} unité${labels.length > 1 ? "s" : ""} · impression A4 (24 par page)</h1>
      <div class="sheet">${cells}</div>
      <script>window.onload = () => { setTimeout(() => window.print(), 300); };</script>
    </body></html>`);
    w.document.close();
  };
  return (
    <div className="fixed inset-0 bg-black/60 z-50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-5xl mx-auto my-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="font-serif text-xl">Étiquettes QR · {labels.length} unité{labels.length > 1 ? "s" : ""}</div>
            <div className="text-xs text-[#666]">Planche A4 — 24 par page (70×37 mm) · scan ouvre la variante exacte</div>
          </div>
          <div className="flex gap-2">
            <button onClick={printInNewWindow} className="dina-btn-primary" data-testid="qr-print"><Printer size={14} />Imprimer dans une nouvelle fenêtre</button>
            <button onClick={onClose} className="dina-btn-secondary"><X size={14} />Fermer</button>
          </div>
        </div>
        <div className="qr-sheet grid grid-cols-3 gap-0 bg-white text-black max-h-[70vh] overflow-y-auto border border-[#ececec] rounded">
          {labels.slice(0, 24).map((l, i) => (
            <div key={i} className="qr-cell border border-[#ddd] p-2 flex gap-2 items-center" style={{ height: "37mm" }}>
              <img src={QR_URL(l.qr)} alt="QR" className="w-[22mm] h-[22mm] shrink-0" />
              <div className="flex-1 min-w-0 text-[9px] leading-tight">
                <div className="font-semibold truncate text-[10px]">{l.product_name}</div>
                <div className="truncate">SKU: <strong>{l.sku}</strong></div>
                <div>T: <strong>{l.size || "—"}</strong> · C: <strong>{l.color || "—"}</strong></div>
                <div className="text-[#666]">PA: {fcfa(l.unit_cost)}</div>
                <div className="text-[#666]">{l.po_number}</div>
              </div>
            </div>
          ))}
        </div>
        {labels.length > 24 && <div className="text-xs text-[#666] mt-2">+ {labels.length - 24} étiquettes supplémentaires imprimées dans la nouvelle fenêtre</div>}
      </div>
    </div>
  );
}
