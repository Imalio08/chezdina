import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { useKeptState } from "@/lib/keptState";
import { fcfa, dateTimeFmt, statusLabel, statusColor } from "@/lib/format";
import { toast } from "sonner";
import { X, Pencil, Printer, FileText, MessageCircle, Download, Receipt, Eye, CheckCircle2, ScanLine, Truck, Wallet } from "lucide-react";
import { InvoicePreviewModal, buildInvoicePreview, shareInvoiceOnWhatsApp } from "@/components/shared/InvoicePreviewModal";
import { downloadInvoicePDF, fetchBusinessForPdf } from "@/lib/pdfInvoice";
import { printFichesFor } from "@/lib/printFiches";
import { OrderFilters, applyOrderFilters, EMPTY_FILTERS } from "@/components/shared/OrderFilters";
import { PrepRunner } from "@/pages/console/Preparation";
import AssignDayModal from "@/components/orders/AssignDayModal";
import { useAuth } from "@/context/AuthContext";

const STATUSES = ["en_attente_acompte","nouvelle","confirmee","en_preparation","prete","assignee","en_livraison","livree","annulee","reportee","echouee","retournee"];
const KANBAN = ["en_attente_acompte","nouvelle","confirmee","en_preparation","prete","assignee","en_livraison","livree","annulee","reportee","echouee","retournee"];
const TABS = [["", "Toutes"], ["nouvelle", "À confirmer"], ["confirmee", "À préparer"], ["en_preparation", "En préparation"], ["prete", "Prêtes"], ["assignee", "Affectées"], ["en_livraison", "En livraison"], ["livree", "Livrées"], ["echouee", "Échecs"], ["annulee_reportee", "Annulées / Reportées"], ["en_attente_acompte", "En attente d'acompte"], ["wave_verif", "Paiements Wave à vérifier"]];
const inTab = (o, t) => !t || (t === "wave_verif" ? o.payment_status === "preuve_envoyee" : t === "annulee_reportee" ? ["annulee", "reportee", "retournee"].includes(o.status) || (!!o.rescheduled_for && o.status === "confirmee") : t === "en_livraison" ? ["en_livraison", "recuperee"].includes(o.status) : o.status === t);

export function OrderActions({ o, canConfirm, onConfirm, onPrepare, compact }) {
  const cls = `inline-flex items-center gap-1 rounded-md font-semibold ${compact ? "text-[10px] px-2 py-1" : "text-xs px-2.5 py-1.5"}`;
  if (o.status === "en_attente_acompte") return <span className={`${cls} bg-[#fff4e0] text-[#b26a00]`} title="Confirmation possible après réception de l'acompte" data-testid={`order-deposit-${o.code}`}><Wallet size={11}/>Acompte requis</span>;
  if (o.status === "nouvelle" && canConfirm) return <button onClick={(e) => { e.stopPropagation(); onConfirm(o); }} className={`${cls} bg-[#0021cc] text-white`} data-testid={`order-confirm-${o.code}`}><CheckCircle2 size={11}/>Confirmer</button>;
  if (["confirmee", "en_preparation"].includes(o.status)) return <button onClick={(e) => { e.stopPropagation(); onPrepare(o); }} className={`${cls} bg-[#b02a2a] text-white`} data-testid={`order-prepare-${o.code}`}><ScanLine size={11}/>{o.status === "en_preparation" ? "Reprendre" : "Préparer"}</button>;
  return null;
}

export default function Orders() {
  const nav = useNavigate();
  const { user } = useAuth();
  const canConfirm = ["admin", "manager"].includes(user?.role);
  const canInvoice = canConfirm;
  const [sp, setSp] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [view, setView] = useState(() => localStorage.getItem("orders_view") || "table");
  const filter = sp.get("tab") || "";
  const setFilter = (t) => { const n = new URLSearchParams(sp); if (t) n.set("tab", t); else n.delete("tab"); setSp(n, { replace: true }); setSel(new Set()); };
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null);
  const [unread, setUnread] = useState({});
  const [f, setF] = useKeptState("orders-filters", { ...EMPTY_FILTERS });
  const [sel, setSel] = useState(new Set());
  const [prepOrder, setPrepOrder] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => { try { const r = await api.get("/orders"); setOrders(r.data || []); } catch { toast.error("Commandes indisponibles · réessayez"); } };
  const loadUnread = () => api.get("/orders-messages/unread").then(r => setUnread(r.data?.by_order || {})).catch(() => {});
  useEffect(() => {
    load(); loadUnread();
    const t = setInterval(loadUnread, 20000);
    window.addEventListener("dina:unread-refresh", loadUnread);
    return () => { clearInterval(t); window.removeEventListener("dina:unread-refresh", loadUnread); };
  }, []);

  const changeStatus = async (id, status) => {
    let payload = { status };
    if (status === "annulee" || status === "echouee") {
      const reason = prompt("Motif de l'annulation / échec ?");
      if (reason === null) return;
      payload.reason = reason;
    }
    if (status === "retournee") {
      const reason = prompt("Motif du retour ?");
      if (reason === null) return;
      payload.reason = reason;
    }
    if (status === "reportee") {
      const next = prompt("Date de report (YYYY-MM-DD) ?");
      if (!next) return;
      payload = { status: "confirmee", reason: "Reportée", next_date: next };
    }
    try { await api.patch(`/orders/${id}/status`, payload); }
    catch (e) { return toast.error(e.response?.data?.detail || "Erreur"); }
    toast.success("Statut mis à jour"); load();
    if (selected) setSelected({...selected, status: payload.status});
  };

  const filtered = applyOrderFilters(orders, f).filter(o => filter === "unread" ? unread[o.code] > 0 : inTab(o, filter));
  const unreadCount = orders.filter(o => unread[o.code] > 0).length;
  const counts = useMemo(() => Object.fromEntries(TABS.map(([k]) => [k, orders.filter(o => inTab(o, k)).length])), [orders]);
  const selOrders = orders.filter(o => sel.has(o.id));
  const toggle = (id) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allShown = filtered.slice(0, 200);
  const allChecked = allShown.length > 0 && allShown.every(o => sel.has(o.id));

  const confirm = async (list) => {
    const ok = list.filter(o => o.status === "nouvelle");
    if (!ok.length) return toast.error("Aucune commande « À confirmer » dans la sélection");
    setBusy(true);
    let done = 0;
    for (const o of ok) { try { await api.patch(`/orders/${o.id}/status`, { status: "confirmee" }); done++; } catch (e) { toast.error(`${o.code} : ${e.response?.data?.detail || "confirmation impossible"}`); } }
    setBusy(false); setSel(new Set());
    if (done) toast.success(done > 1 ? `${done} commandes confirmées · à préparer` : `${ok[0].code} confirmée · à préparer`);
    load();
  };
  const prepare = async (o) => {
    if (o.status === "confirmee") {
      try { await api.patch(`/orders/${o.id}/status-v3`, { status: "en_preparation" }); }
      catch (e) { return toast.error(e.response?.data?.detail || "Préparation impossible"); }
    }
    setPrepOrder({ ...o, status: "en_preparation" });
    window.scrollTo(0, 0);
  };
  const printSlips = async (list) => {
    if (!list.length) return;
    try { await printFichesFor(list); } catch { toast.error("Impression impossible · réessayez"); }
  };
  const assignSel = () => {
    const ready = selOrders.filter(o => o.status === "prete");
    if (!ready.length) return toast.error("Sélectionnez des commandes « Prête »");
    if (ready.length < selOrders.length) toast.message(`${selOrders.length - ready.length} commande(s) non prête(s) ignorée(s)`);
    setAssigning(ready);
  };

  if (prepOrder) return <PrepRunner order={prepOrder} onBack={() => { setPrepOrder(null); load(); }}/>;

  const openInvoice = async (o, action) => {
    try {
      let inv = o._invoice;
      if (!inv) {
        const r = await api.post(`/invoices/from-order/${o.id}`);
        inv = r.data;
      }
      if (action === "view") { setPreview(await buildInvoicePreview(api, o, inv)); return; }
      if (action === "wa") { await shareInvoiceOnWhatsApp(await buildInvoicePreview(api, o, inv)); return; }
      const business = await fetchBusinessForPdf(api);
      if (action === "pdf") {
        // Generate the REAL A4 PDF with logo + lines + totals and trigger download.
        downloadInvoicePDF(o, inv, business);
      } else if (action === "slip") {
        await printFichesFor([o]);
      }
    } catch (e) { console.error(e); toast.error("Erreur facture"); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Commandes</h1><p className="text-sm text-[#666]">Tous canaux · {orders.length} commandes</p></div>
        <div className="flex gap-2">
          <button onClick={() => nav("/console/pos?coller=1")} className="px-3 py-2 text-xs rounded-md border border-[#b02a2a] text-[#b02a2a] font-semibold" data-testid="orders-from-message">Commande depuis un message</button>
          {[["table", "Table"], ["kanban", "Kanban"]].map(([v, l]) => <button key={v} onClick={()=>{ setView(v); localStorage.setItem("orders_view", v); }} className={`px-3 py-2 text-xs rounded-md border ${view===v?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec]"}`} data-testid={`orders-view-${v}`}>{l}</button>)}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1 lg:flex-wrap" data-testid="orders-tabs">
        {TABS.map(([k, l]) => <button key={k || "all"} onClick={()=>setFilter(k)} className={`dina-chip shrink-0 ${filter===k?"!bg-[#1c1c1c] !text-white":""}`} data-testid={`orders-tab-${k || "all"}`}>{k && !["annulee_reportee", "wave_verif"].includes(k) && <span className="status-dot" style={{background:statusColor[k]}}/>}{l} <b className="tabular">{counts[k]}</b></button>)}
        <button onClick={()=>setFilter("unread")} className={`dina-chip shrink-0 ${filter==="unread"?"!bg-[#e53935] !text-white !border-[#e53935]":"!text-[#e53935]"}`} data-testid="orders-filter-unread"><span className="w-2 h-2 rounded-full bg-[#e53935]"/>Messages non lus ({unreadCount})</button>
      </div>

      <OrderFilters orders={orders} value={f} onChange={setF} fields={["q", "date", "slot", "zone", "rider"]} testid="orders-filters"/>

      {sel.size > 0 && (
        <div className="sticky top-16 z-20 dina-card-white p-2.5 flex items-center gap-2 flex-wrap shadow-md" data-testid="orders-bulk-bar">
          <span className="text-sm font-semibold px-1" data-testid="orders-bulk-count">{sel.size} sélectionnée(s)</span>
          {canConfirm && <button onClick={() => confirm(selOrders)} disabled={busy} className="dina-btn-primary !min-h-[34px] text-xs" data-testid="orders-bulk-confirm"><CheckCircle2 size={13}/>{busy ? "Confirmation…" : "Confirmer"}</button>}
          {canConfirm && <button onClick={assignSel} className="dina-btn-secondary !min-h-[34px] text-xs" data-testid="orders-bulk-assign"><Truck size={13}/>Affecter à une journée de livraison</button>}
          <button onClick={() => printSlips(selOrders)} className="dina-btn-secondary !min-h-[34px] text-xs" data-testid="orders-bulk-print"><Printer size={13}/>Imprimer les fiches colis</button>
          <button onClick={() => setSel(new Set())} className="text-xs text-[#666] ml-auto px-2" data-testid="orders-bulk-clear">Tout désélectionner</button>
        </div>
      )}

      {view === "table" ? (
        <div className="dina-card-white overflow-hidden"><div className="overflow-x-auto"><table className="dina-table w-full">
          <thead><tr><th className="w-8"><input type="checkbox" checked={allChecked} onChange={() => setSel(allChecked ? new Set() : new Set(allShown.map(o => o.id)))} className="accent-[#b02a2a]" data-testid="orders-select-all"/></th><th>Commande</th><th>Date</th><th>Cliente</th><th>Canal</th><th>Mode</th><th>Statut</th><th>Action</th><th className="text-right">Total</th><th className="text-center">Documents</th></tr></thead>
          <tbody>{filtered.length === 0 ? <tr><td colSpan={10} className="text-sm text-[#666] text-center py-8">Aucune commande pour ce filtre</td></tr>
          : allShown.map(o=>(
            <tr key={o.id} className={`hover:bg-[#fafafa] dark:hover:bg-[#141414] ${sel.has(o.id) ? "bg-[#fff5f5]" : ""}`} data-testid={`order-row-${o.code}`}>
              <td><input type="checkbox" checked={sel.has(o.id)} onChange={() => toggle(o.id)} className="accent-[#b02a2a]" data-testid={`order-select-${o.code}`}/></td>
              <td className="font-medium cursor-pointer hover:text-[#b02a2a]" onClick={()=>nav(`/console/commandes/${o.code}`)}><span className="inline-flex items-center gap-1.5">{o.code}<UnreadDot n={unread[o.code]} code={o.code}/></span></td>
              <td className="text-[#666] cursor-pointer" onClick={()=>nav(`/console/commandes/${o.code}`)}>{dateTimeFmt(o.created_at)}</td>
              <td className="cursor-pointer" onClick={()=>nav(`/console/commandes/${o.code}`)}>{o.customer?.name||"—"}</td>
              <td className="capitalize cursor-pointer" onClick={()=>nav(`/console/commandes/${o.code}`)}>{o.channel}</td>
              <td className="capitalize text-xs cursor-pointer" onClick={()=>nav(`/console/commandes/${o.code}`)}>{o.mode}</td>
              <td className="cursor-pointer" onClick={()=>nav(`/console/commandes/${o.code}`)}><span className="dina-chip" style={{color:statusColor[o.status]}}><span className="status-dot" style={{background:statusColor[o.status]}}/>{statusLabel[o.status] || o.status}</span>{o.payment_status === "preuve_envoyee" && <span className="ml-1 text-[10px] font-semibold text-[#b26a00] bg-[#fff4e0] rounded px-1.5 py-0.5" data-testid={`order-wave-verify-${o.code}`}>Wave à vérifier</span>}</td>
              <td><OrderActions o={o} canConfirm={canConfirm} onConfirm={(x) => confirm([x])} onPrepare={prepare}/></td>
              <td className="text-right tabular font-semibold cursor-pointer" onClick={()=>nav(`/console/commandes/${o.code}`)}>{fcfa(o.total)}</td>
              <td>
                <div className="flex items-center justify-center gap-1">
                  {canInvoice && <>
                  <button onClick={() => openInvoice(o, "view")} className="text-[#666] hover:text-[#b02a2a] p-1" title="Aperçu facture PDF" data-testid={`invoice-view-${o.code}`}><Eye size={13}/></button>
                  <button onClick={() => openInvoice(o, "pdf")} className="text-[#5867fd] hover:text-[#b02a2a] p-1" title="Voir la facture PDF" data-testid={`invoice-pdf-${o.code}`}><FileText size={13}/></button>
                  <button onClick={() => openInvoice(o, "wa")} className="text-[#1f8a4c] hover:text-[#b02a2a] p-1" title="Envoyer par WhatsApp" data-testid={`invoice-wa-${o.code}`}><MessageCircle size={13}/></button>
                  </>}
                  <button onClick={() => printSlips([o])} className="text-[#666] hover:text-[#b02a2a] p-1" title="Fiche colis" data-testid={`slip-${o.code}`}><Printer size={13}/></button>
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table></div></div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2" data-testid="orders-kanban">
          {KANBAN.map(s=>{ const col = filtered.filter(o=>o.status===s || (s === "en_livraison" && o.status === "recuperee")); return (
            <div key={s} className="dina-card p-3 min-h-[200px] w-64 shrink-0" data-testid={`kanban-col-${s}`}>
              <div className="font-semibold text-xs uppercase mb-2 flex justify-between" style={{color:statusColor[s]}}><span>{statusLabel[s]}</span><span>{col.length}</span></div>
              <div className="space-y-2">{col.slice(0,30).map(o=>(
                <div key={o.id} onClick={()=>nav(`/console/commandes/${o.code}`)} className={`bg-white dark:bg-[#1a1a1a] rounded-lg border p-2 cursor-pointer hover:border-[#b02a2a] ${sel.has(o.id) ? "border-[#b02a2a]" : "border-[#ececec] dark:border-[#2a2a2a]"}`} data-testid={`kanban-card-${o.code}`}>
                  <div className="text-xs font-medium flex items-center gap-1.5"><input type="checkbox" checked={sel.has(o.id)} onClick={e => e.stopPropagation()} onChange={() => toggle(o.id)} className="accent-[#b02a2a]" data-testid={`kanban-select-${o.code}`}/>{o.code}<UnreadDot n={unread[o.code]} code={o.code}/></div>
                  <div className="text-xs text-[#666]">{o.customer?.name||"—"}</div>
                  <div className="flex items-center justify-between mt-1 gap-1"><span className="tabular text-sm font-semibold">{fcfa(o.total)}</span><OrderActions o={o} canConfirm={canConfirm} onConfirm={(x) => confirm([x])} onPrepare={prepare} compact/></div>
                </div>
              ))}</div>
            </div>
          ); })}
        </div>
      )}

      {assigning && <AssignDayModal orders={assigning} onClose={() => setAssigning(null)} onDone={() => { setAssigning(null); setSel(new Set()); load(); }}/>}

      {preview && <InvoicePreviewModal data={preview} onClose={() => setPreview(null)}/>}
      {selected && <OrderDrawer order={selected} onClose={()=>setSelected(null)} onStatus={changeStatus} onReload={load} onInvoice={openInvoice}/>}
    </div>
  );
}

function UnreadDot({ n, code }) {
  if (!n) return null;
  return <span className="relative inline-flex w-2.5 h-2.5" title={`${n} message(s) non lu(s)`} data-testid={`order-unread-${code}`}><span className="absolute inset-0 rounded-full bg-[#e53935] opacity-60 animate-ping"/><span className="relative w-2.5 h-2.5 rounded-full bg-[#e53935]"/></span>;
}


function KpiMini({ label, value, color, onClick, active, compact, testid }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={`dina-card-white p-3 min-w-0 text-left transition ${onClick ? "hover:border-[#b02a2a]" : ""} ${active ? "ring-2" : ""}`} style={active ? { "--tw-ring-color": color } : {}} data-testid={testid}>
      <div className="text-[9px] uppercase tracking-wide text-[#666] font-semibold truncate">{label}</div>
      <div className={`font-serif tabular leading-none mt-1 truncate ${compact ? "text-base" : "text-xl"}`} style={{ color }}>{value}</div>
    </Tag>
  );
}

function OrderDrawer({ order, onClose, onStatus, onReload, onInvoice }) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState(order.items || []);
  const [discount, setDiscount] = useState(order.discount||0);
  const [fee, setFee] = useState(order.delivery_fee||0);
  const canEdit = order.status !== "livree";

  const save = async () => {
    try { await api.patch(`/orders/${order.id}`, { items, discount:+discount, delivery_fee:+fee }); toast.success("Enregistré"); setEditing(false); onReload(); onClose(); }
    catch { toast.error("Erreur"); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-end lg:place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div><div className="font-serif text-xl">{order.code}</div><div className="text-xs text-[#666]">{dateTimeFmt(order.created_at)} · {order.channel} · {order.mode}</div></div>
          <button onClick={onClose}><X size={16}/></button>
        </div>

        <div className="mb-4 p-3 bg-[#fff5f5] rounded-lg">
          <div className="text-xs text-[#666] uppercase">Cliente</div>
          <div className="font-medium">{order.customer?.name}</div>
          <div className="text-sm text-[#666]">{order.customer?.phone}</div>
          {order.delivery_zone && <div className="text-xs text-[#666] mt-1">{order.delivery_zone} · {order.note}</div>}
        </div>

        <div className="mb-4 p-3 bg-[#f5f5f5] dark:bg-[#141414] rounded-lg flex items-center justify-between flex-wrap gap-2" data-testid="order-invoice-block">
          <div className="flex items-center gap-2 text-sm"><Receipt size={14} className="text-[#b02a2a]"/><span className="font-semibold">Facture</span><span className="text-xs text-[#666]">générée automatiquement</span></div>
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => onInvoice(order, "view")} className="dina-btn-secondary !min-h-[32px] text-xs" data-testid="order-invoice-view"><Eye size={12}/>Aperçu</button>
            <button onClick={() => onInvoice(order, "pdf")} className="dina-btn-secondary !min-h-[32px] text-xs" data-testid="order-invoice-pdf"><Download size={12}/>Facture PDF</button>
            <button onClick={() => onInvoice(order, "slip")} className="dina-btn-secondary !min-h-[32px] text-xs" data-testid="order-slip-pdf"><Printer size={12}/>Fiche colis</button>
            <button onClick={() => onInvoice(order, "wa")} className="dina-btn-secondary !min-h-[32px] text-xs !text-[#1f8a4c]" data-testid="order-invoice-wa"><MessageCircle size={12}/>WhatsApp</button>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <div className="font-semibold text-sm">Articles</div>
            {canEdit && !editing && <button onClick={()=>setEditing(true)} className="text-xs text-[#0021cc] flex items-center gap-1" data-testid="order-edit"><Pencil size={11}/>Modifier</button>}
          </div>
          <div className="space-y-2">{(items || []).map((it,i)=>(
            <div key={i} className="flex items-center gap-3 text-sm border-b border-[#ececec] pb-2">
              <div className="w-10 h-10 bg-[#fff5f5] rounded overflow-hidden"><img src={it.image} alt="" className="w-full h-full object-cover"/></div>
              <div className="flex-1"><div className="font-medium">{it.name}</div><div className="text-xs text-[#666]">{[it.size,it.color].filter(Boolean).join(" · ")}</div></div>
              {editing ? <input type="number" min="1" className="dina-input w-16 tabular !py-1 text-center" value={it.qty} onChange={e=>{const n=[...items];n[i]={...n[i],qty:+e.target.value};setItems(n);}}/> : <span className="text-xs">×{it.qty}</span>}
              <div className="tabular w-20 text-right">{fcfa(it.qty*it.price)}</div>
            </div>
          ))}</div>
        </div>

        <div className="text-sm space-y-1 mb-4">
          <div className="flex justify-between"><span className="text-[#666]">Sous-total</span><span className="tabular">{fcfa((items || []).reduce((s,i)=>s+i.qty*i.price,0))}</span></div>
          <div className="flex justify-between items-center"><span className="text-[#666]">Livraison</span>{editing ? <input type="number" className="dina-input w-24 !py-1 tabular text-right" value={fee} onChange={e=>setFee(e.target.value)}/> : <span className="tabular">{fcfa(fee)}</span>}</div>
          <div className="flex justify-between items-center"><span className="text-[#666]">Remise</span>{editing ? <input type="number" className="dina-input w-24 !py-1 tabular text-right" value={discount} onChange={e=>setDiscount(e.target.value)}/> : <span className="tabular text-[#1f8a4c]">-{fcfa(discount)}</span>}</div>
          <div className="flex justify-between font-semibold text-base pt-1 border-t"><span>Total</span><span className="tabular text-[#b02a2a]">{fcfa((items || []).reduce((s,i)=>s+i.qty*i.price,0)+(+fee)-(+discount))}</span></div>
        </div>

        {editing ? (
          <div className="flex gap-2 mb-4"><button onClick={()=>{setEditing(false);setItems(order.items || []);setDiscount(order.discount||0);setFee(order.delivery_fee||0);}} className="dina-btn-secondary flex-1">Annuler</button><button onClick={save} className="dina-btn-primary flex-1" data-testid="order-save">Enregistrer</button></div>
        ) : canEdit && (
          <div className="mb-4">
            <div className="text-xs text-[#666] mb-2">Changer le statut</div>
            <div className="flex gap-1 flex-wrap">{STATUSES.map(s=><button key={s} onClick={()=>onStatus(order.id,s)} className={`px-2 py-1 text-xs rounded border ${order.status===s?"bg-[#1c1c1c] text-white border-[#1c1c1c]":"border-[#ececec]"}`} data-testid={`change-status-${s}`}>{statusLabel[s]}</button>)}
              <button onClick={()=>onStatus(order.id,"reportee")} className="px-2 py-1 text-xs rounded border border-[#e4991e] text-[#e4991e]" data-testid="change-status-reportee">Reporter</button>
            </div>
          </div>
        )}

        <div className="text-xs text-[#666]">
          <div className="font-semibold text-[#1c1c1c] mb-1">Historique</div>
          {(order.timeline||[]).map((t,i)=><div key={i} className={t.offline_rejected ? "text-[#8a5a00]" : ""}>{dateTimeFmt(t.at)} · {t.offline_rejected ? "Action hors ligne à vérifier" : (statusLabel[t.status]||t.status)} · {t.by}{t.reason?` — ${t.reason}`:""}{t.note?` — ${t.note}`:""}{t.offline && !t.offline_rejected ? " · hors ligne" : ""}</div>)}
        </div>
      </div>
    </div>
  );
}
