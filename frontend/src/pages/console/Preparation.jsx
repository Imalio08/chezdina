import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import { fcfa, dateTimeFmt, statusLabel, statusColor } from "@/lib/format";
import { toast } from "sonner";
import { Check, Package, ScanLine, AlertTriangle, ArrowLeft, Keyboard, LayoutGrid, List, Columns3, Printer, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { OrderFilters, applyOrderFilters, EMPTY_FILTERS, slotOf } from "@/components/shared/OrderFilters";
import { downloadPackingSlipPDF, fetchBusinessForPdf } from "@/lib/pdfInvoice";

const PREP_STATUSES = ["nouvelle", "confirmee", "en_preparation", "prete"];
const KANBAN_COLS = [["nouvelle", "Nouvelles", "#0021cc"], ["confirmee", "Confirmées", "#5867fd"], ["en_preparation", "En préparation", "#e4991e"], ["prete", "Prêtes", "#1f8a4c"]];
const slip = async (o) => downloadPackingSlipPDF(o, await fetchBusinessForPdf(api));

export default function Preparation() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("en_preparation");
  const [current, setCurrent] = useState(null);
  const [view, setView] = useState(() => localStorage.getItem("prep_view") || "cards");
  const [f, setF] = useState({ ...EMPTY_FILTERS });
  const nav = useNavigate();
  useEffect(() => { localStorage.setItem("prep_view", view); }, [view]);

  const load = async () => {
    try { const r = await api.get("/orders"); setOrders((r.data || []).filter(o => PREP_STATUSES.includes(o.status))); }
    catch { toast.error("Erreur"); }
  };
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, []);

  const moveTo = async (o, status) => {
    if (o.status === status) return;
    if (status === "prete") { setCurrent(o); return; }
    try { await api.patch(`/orders/${o.id}/status-v3`, { status }); toast.success(`${o.code} → ${statusLabel[status]}`); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
  };

  const shown = applyOrderFilters(orders, f);
  const filtered = shown.filter(o => !filter || o.status === filter);
  const counts = useMemo(() => Object.fromEntries(PREP_STATUSES.map(s => [s, shown.filter(o => o.status === s).length])), [shown]);
  const openOrder = (o) => o.status === "prete" ? nav(`/console/commandes/${o.code}`) : setCurrent(o);

  if (current) return <PrepRunner order={current} onBack={() => { setCurrent(null); load(); }}/>;

  return (
    <div className="space-y-5" data-testid="preparation-page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div><h1 className="font-serif text-3xl">Préparation</h1><p className="text-sm text-[#666]">Scannez article par article avant de marquer la commande comme prête</p></div>
        <div className="flex gap-0.5 bg-[#f5f5f5] dark:bg-[#141414] rounded-lg p-0.5 text-xs" data-testid="prep-view-switch">
          {[["cards", "Cartes", LayoutGrid], ["table", "Tableau", List], ["kanban", "Kanban", Columns3]].map(([k, l, Icon]) => (
            <button key={k} onClick={() => setView(k)} className={`px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 transition-colors ${view === k ? "bg-white dark:bg-[#2a2a2a] font-semibold shadow-sm" : "text-[#666]"}`} data-testid={`prep-view-${k}`}><Icon size={12}/>{l}</button>
          ))}
        </div>
      </div>
      <OrderFilters orders={orders} value={f} onChange={setF} fields={["q", "date", "slot", "zone", "rider"]} testid="prep-filters"/>
      {view !== "kanban" && <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        <KpiBox label="Toutes" value={shown.length} color="#1c1c1c" active={!filter} onClick={()=>setFilter("")} testid="prep-kpi-all"/>
        <KpiBox label="Nouvelles" value={counts.nouvelle} color="#0021cc" active={filter==="nouvelle"} onClick={()=>setFilter("nouvelle")} testid="prep-kpi-nouvelle"/>
        <KpiBox label="Confirmées" value={counts.confirmee} color="#5867fd" active={filter==="confirmee"} onClick={()=>setFilter("confirmee")} testid="prep-kpi-confirmee"/>
        <KpiBox label="En préparation" value={counts.en_preparation} color="#e4991e" active={filter==="en_preparation"} onClick={()=>setFilter("en_preparation")} testid="prep-kpi-prep"/>
        <KpiBox label="Prêtes" value={counts.prete} color="#1f8a4c" active={filter==="prete"} onClick={()=>setFilter("prete")} testid="prep-kpi-prete"/>
      </div>}

      {view === "kanban" ? <PrepKanban orders={shown} onOpen={openOrder} onMove={moveTo}/>
      : filtered.length === 0 ? (
        <div className="dina-card-white p-10 text-center">
          <Package size={32} className="mx-auto mb-3 text-[#999]"/>
          <div className="font-serif text-xl">Aucune commande{filter ? ` « ${statusLabel[filter]} »` : ""}</div>
          <div className="text-sm text-[#666] mt-1">Changez de filtre pour voir les autres commandes</div>
        </div>
      ) : view === "table" ? <PrepTable orders={filtered} onOpen={openOrder}/> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(o => o.status === "prete" ? <ReadyCard key={o.id} o={o} onOpen={() => openOrder(o)}/> : (
            <button key={o.id} onClick={() => setCurrent(o)} className="dina-card-white p-4 text-left hover:border-[#b02a2a] transition" data-testid={`prep-card-${o.code}`}>
              <div className="flex items-start justify-between mb-2">
                <div><div className="font-mono text-xs text-[#666]">{o.code}</div><div className="font-serif text-lg">{o.customer?.name || "—"}</div></div>
                <span className="dina-chip text-[10px]" style={{color:statusColor[o.status]}}><span className="status-dot" style={{background:statusColor[o.status]}}/>{statusLabel[o.status]}</span>
              </div>
              <div className="text-xs text-[#666]">{(o.items||[]).length} article(s) · {fcfa(o.total)}{o.delivery_zone ? ` · ${o.delivery_zone}` : ""}</div>
              <div className="text-[11px] text-[#999] mt-1">{dateTimeFmt(o.created_at)}{o.delivery_slot ? ` · ${slotOf(o)}` : ""}</div>
              <div className="mt-2 flex items-center gap-1 text-xs text-[#b02a2a] font-semibold"><ScanLine size={12}/>Commencer la préparation →</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReadyCard({ o, onOpen }) {
  return (
    <div className="dina-card-white p-4 border-l-4 !border-l-[#1f8a4c]" data-testid={`prep-ready-card-${o.code}`}>
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="min-w-0"><div className="font-mono text-xs text-[#666]">{o.code}</div><div className="font-serif text-lg truncate">{o.customer?.name || "—"}</div></div>
        <span className="dina-chip text-[10px] shrink-0 !text-[#1f8a4c]"><Check size={10}/>Prête</span>
      </div>
      <div className="text-xs text-[#666]">{(o.items||[]).length} article(s) · {fcfa(o.total)}{o.delivery_zone ? ` · ${o.delivery_zone}` : ""}</div>
      <div className="text-[11px] text-[#999] mt-1">{o.rider_name ? `Livreur : ${o.rider_name}` : "En attente d'un livreur"}{o.delivery_slot ? ` · ${slotOf(o)}` : ""}</div>
      <div className="mt-3 flex gap-2">
        <button onClick={onOpen} className="dina-btn-secondary !min-h-[32px] text-xs flex-1" data-testid={`prep-ready-open-${o.code}`}><Eye size={12}/>Fiche commande</button>
        <button onClick={() => slip(o)} className="dina-btn-secondary !min-h-[32px] text-xs flex-1" data-testid={`prep-ready-slip-${o.code}`}><Printer size={12}/>Fiche colis</button>
      </div>
    </div>
  );
}

function PrepTable({ orders, onOpen }) {
  return (
    <div className="dina-card-white overflow-hidden" data-testid="prep-table"><div className="overflow-x-auto"><table className="dina-table">
      <thead><tr><th>Commande</th><th>Cliente</th><th className="text-right">Articles</th><th className="text-right">Montant</th><th>Zone</th><th>Date</th><th>Statut</th><th></th></tr></thead>
      <tbody>{orders.map(o => (
        <tr key={o.id} className="hover:bg-[#fafafa] dark:hover:bg-[#141414]" data-testid={`prep-row-${o.code}`}>
          <td className="font-mono text-xs">{o.code}</td>
          <td className="font-medium">{o.customer?.name || "—"}</td>
          <td className="text-right tabular">{(o.items || []).reduce((s, i) => s + (i.qty || 1), 0)}</td>
          <td className="text-right tabular font-semibold">{fcfa(o.total)}</td>
          <td className="text-xs">{o.delivery_zone || (o.mode === "pickup" ? "Retrait" : "—")}</td>
          <td className="text-xs text-[#666]">{dateTimeFmt(o.created_at)}</td>
          <td><span className="dina-chip text-[10px]" style={{ color: statusColor[o.status] }}><span className="status-dot" style={{ background: statusColor[o.status] }}/>{statusLabel[o.status]}</span></td>
          <td className="text-right whitespace-nowrap">{o.status === "prete"
            ? <div className="inline-flex gap-1"><button onClick={() => slip(o)} className="dina-btn-secondary !min-h-[30px] text-[11px]" data-testid={`prep-slip-${o.code}`}><Printer size={11}/>Fiche colis</button><button onClick={() => onOpen(o)} className="dina-btn-secondary !min-h-[30px] text-[11px]" data-testid={`prep-open-${o.code}`}><Eye size={11}/>Voir</button></div>
            : <button onClick={() => onOpen(o)} className="dina-btn-primary !min-h-[30px] text-[11px]" data-testid={`prep-start-${o.code}`}><ScanLine size={11}/>Préparer</button>}</td>
        </tr>
      ))}</tbody>
    </table></div></div>
  );
}

function PrepKanban({ orders, onOpen, onMove }) {
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null);
  const drop = (status) => (e) => {
    e.preventDefault(); setOver(null);
    const o = orders.find(x => x.id === dragId);
    setDragId(null);
    if (o) onMove(o, status);
  };
  return (
    <div className="overflow-x-auto pb-2" data-testid="prep-kanban">
      <div className="grid grid-cols-4 gap-3 min-w-[860px]">
        {KANBAN_COLS.map(([status, label, color]) => {
          const items = orders.filter(o => o.status === status);
          return (
            <div key={status} onDragOver={e => { e.preventDefault(); setOver(status); }} onDragLeave={() => setOver(null)} onDrop={drop(status)}
              className={`rounded-xl p-2.5 min-h-[420px] transition-colors ${over === status ? "bg-[#fff5f5] dark:bg-[#2a1818] ring-2 ring-[#b02a2a]/40" : "bg-[#f7f7f7] dark:bg-[#141414]"}`} data-testid={`prep-col-${status}`}>
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="text-xs font-semibold uppercase flex items-center gap-1.5"><span className="status-dot" style={{ background: color }}/>{label}</div>
                <span className="text-xs tabular font-bold" style={{ color }}>{items.length}</span>
              </div>
              <div className="space-y-2 max-h-[65vh] overflow-y-auto scrollbar-thin">
                {items.length === 0 && <div className="text-[11px] text-[#999] text-center py-8 border-2 border-dashed border-[#e5e5e5] dark:border-[#2a2a2a] rounded-lg">{status === "prete" ? "Déposez ici pour scanner" : "Aucune commande"}</div>}
                {items.map(o => (
                  <div key={o.id} draggable={status !== "prete"} onDragStart={() => setDragId(o.id)} onDragEnd={() => setDragId(null)} onClick={() => onOpen(o)}
                    className={`bg-white dark:bg-[#1a1a1a] border border-[#ececec] dark:border-[#2a2a2a] rounded-lg p-2.5 text-xs transition-transform hover:-translate-y-0.5 hover:shadow-md ${status !== "prete" ? "cursor-grab active:cursor-grabbing" : ""} ${dragId === o.id ? "opacity-50" : ""}`} data-testid={`prep-kcard-${o.code}`}>
                    <div className="flex justify-between items-start"><span className="font-mono text-[10px] text-[#666]">{o.code}</span><span className="tabular font-semibold">{fcfa(o.total)}</span></div>
                    <div className="font-medium text-sm truncate mt-0.5">{o.customer?.name || "—"}</div>
                    <div className="text-[10px] text-[#666] mt-0.5 truncate">{(o.items || []).length} article(s) · {o.delivery_zone || (o.mode === "pickup" ? "Retrait" : "Comptoir")}</div>
                    {status === "prete" && <div className="mt-1 flex items-center justify-between gap-1"><span className="text-[10px] text-[#1f8a4c] font-semibold flex items-center gap-1"><Check size={10}/>{o.rider_name || "Sans livreur"}</span><button onClick={(e) => { e.stopPropagation(); slip(o); }} className="text-[10px] text-[#b02a2a] inline-flex items-center gap-0.5 hover:underline" data-testid={`prep-kslip-${o.code}`}><Printer size={10}/>Fiche</button></div>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-[11px] text-[#999] mt-2">Glissez une carte pour changer son statut. Déposer dans « Prêtes » ouvre le scan obligatoire.</div>
    </div>
  );
}

function KpiBox({ label, value, color, active, onClick, testid }) {
  return (
    <button onClick={onClick} className={`dina-card-white p-2.5 sm:p-4 text-left transition ${active ? "ring-2" : ""}`} style={active ? { "--tw-ring-color": color } : {}} data-testid={testid}>
      <div className="text-[10px] sm:text-xs uppercase text-[#666] font-semibold truncate">{label}</div>
      <div className="font-serif text-2xl sm:text-3xl tabular mt-1" style={{color}}>{value}</div>
    </button>
  );
}

const MANUAL_REASONS = [
  "Étiquette illisible",
  "Code-barres endommagé",
  "Caméra indisponible",
  "Produit sans étiquette",
  "Scan refusé plusieurs fois",
];

function PrepRunner({ order, onBack }) {
  // Each item line gets: scanned (boolean), manual (boolean), reason (string)
  const [lines, setLines] = useState(() => (order.items || []).map((it, i) => ({ idx: i, item: it, scanned: false, manual: false, reason: "" })));
  const [scanBuffer, setScanBuffer] = useState("");
  const [manualFor, setManualFor] = useState(null);
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  const refocus = () => setTimeout(() => inputRef.current?.focus(), 80);

  const matches = (scan, item) => {
    const s = (scan || "").toLowerCase().trim();
    if (!s) return false;
    const parts = s.split(/[|,;_\s]+/);
    const sku = (item.sku || item.product_id || "").toLowerCase();
    const size = (item.size || "").toLowerCase();
    const color = (item.color || "").toLowerCase();
    if (parts.includes(sku) || s === sku) return true;
    if (s.includes(sku) && sku.length > 2) return true;
    if (size && parts.includes(size)) return true;
    return false;
  };

  const handleScan = (raw) => {
    const code = raw.trim();
    if (!code) return;
    const idx = lines.findIndex(l => !l.scanned && !l.manual && matches(code, l.item));
    if (idx === -1) {
      toast.error("Article non trouvé dans cette commande");
      setScanBuffer(""); refocus();
      return;
    }
    const newLines = [...lines];
    newLines[idx] = { ...newLines[idx], scanned: true };
    setLines(newLines);
    toast.success(`✓ ${newLines[idx].item.name}`);
    setScanBuffer(""); refocus();
  };

  const onKey = (e) => {
    if (e.key === "Enter") { handleScan(scanBuffer); e.preventDefault(); }
  };

  const openManual = (idx) => { setManualFor(idx); setReason(MANUAL_REASONS[0]); setCustomReason(""); };
  const confirmManual = () => {
    const finalReason = reason === "__custom__" ? customReason.trim() : reason;
    if (!finalReason) { toast.error("Motif obligatoire"); return; }
    const newLines = [...lines];
    newLines[manualFor] = { ...newLines[manualFor], manual: true, scanned: false, reason: finalReason };
    setLines(newLines);
    toast.success(`Confirmé manuellement · ${finalReason}`);
    setManualFor(null); refocus();
  };

  const allDone = lines.every(l => l.scanned || l.manual);
  const scannedCount = lines.filter(l => l.scanned || l.manual).length;

  const markReady = async () => {
    if (!allDone) { toast.error("Scannez ou confirmez tous les articles"); return; }
    setSubmitting(true);
    try {
      const payload = {
        status: "prete",
        scanned_items: lines.map((l,i) => ({
          line_index: i,
          product_id: l.item.product_id,
          sku: l.item.sku,
          size: l.item.size,
          color: l.item.color,
          qty: l.item.qty,
          scanned: l.scanned,
          manual: l.manual,
          manual_reason: l.reason || null,
        })),
      };
      await api.patch(`/orders/${order.id}/status-v3`, payload).catch(async () => {
        await api.patch(`/orders/${order.id}/status`, { status: "prete" });
      });
      toast.success("Commande marquée Prête ✓");
      onBack();
    } catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-4" data-testid="prep-runner">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button onClick={onBack} className="text-sm text-[#666] inline-flex items-center gap-1 hover:text-[#b02a2a]" data-testid="prep-back"><ArrowLeft size={14}/>Retour</button>
        <div className="text-xs text-[#666]"><b className="text-[#1c1c1c] dark:text-white">{scannedCount}</b> / {lines.length} articles</div>
      </div>

      <div className="dina-card-white p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div><div className="font-mono text-xs text-[#666]">{order.code}</div><div className="font-serif text-2xl">{order.customer?.name || "—"}</div><div className="text-xs text-[#666]">{order.customer?.phone} · {order.mode}{order.delivery_zone ? ` · ${order.delivery_zone}` : ""}</div></div>
          <div className="font-serif text-2xl tabular text-[#b02a2a]">{fcfa(order.total)}</div>
        </div>
        <div className="flex items-center gap-2 p-3 bg-[#fafafa] dark:bg-[#141414] rounded-lg">
          <ScanLine size={16} className="text-[#b02a2a]"/>
          <input ref={inputRef} value={scanBuffer} onChange={e => setScanBuffer(e.target.value)} onKeyDown={onKey} placeholder="Scannez un article (douchette ou saisie) puis Entrée" className="flex-1 bg-transparent outline-none text-sm font-mono" data-testid="prep-scan-input"/>
          <button onClick={() => handleScan(scanBuffer)} className="dina-btn-primary !min-h-[36px] text-xs" data-testid="prep-scan-submit"><Check size={13}/>Valider</button>
        </div>
        <div className="text-[10px] text-[#999] mt-1.5">Format attendu : SKU · ou SKU|taille|couleur. Pour les cas particuliers, utilisez l'override manuel.</div>
      </div>

      <div className="space-y-2">
        {lines.map((l, idx) => (
          <div key={idx} className={`dina-card-white p-3 transition ${l.scanned ? "border-l-4 !border-l-[#1f8a4c] bg-[#f0f9f4]/50" : l.manual ? "border-l-4 !border-l-[#e4991e] bg-[#fff8e8]/50" : ""}`} data-testid={`prep-line-${idx}`}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#fff5f5] overflow-hidden shrink-0">{l.item.image && <img src={l.item.image} alt="" className="w-full h-full object-cover"/>}</div>
              <div className="flex-1 min-w-0">
                <div className="font-serif text-base truncate">{l.item.name}</div>
                <div className="text-xs text-[#666] flex items-center gap-2 flex-wrap">
                  <span className="font-mono">{l.item.sku || "—"}</span>
                  {l.item.size && <span>· Taille <b>{l.item.size}</b></span>}
                  {l.item.color && <span>· Couleur <b>{l.item.color}</b></span>}
                  <span>· Qté <b>{l.item.qty}</b></span>
                </div>
                {l.manual && <div className="text-[11px] text-[#e4991e] font-semibold mt-0.5">Override manuel · "{l.reason}"</div>}
              </div>
              <div className="shrink-0">
                {l.scanned ? <div className="w-10 h-10 rounded-full bg-[#1f8a4c] text-white grid place-items-center" title="Scanné"><Check size={18}/></div>
                : l.manual ? <div className="w-10 h-10 rounded-full bg-[#e4991e] text-white grid place-items-center" title="Confirmé manuellement"><Keyboard size={16}/></div>
                : (
                  <button onClick={() => openManual(idx)} className="text-[11px] px-2 py-1.5 rounded border border-[#e4991e] text-[#e4991e] font-semibold inline-flex items-center gap-1" title="Override manuel" data-testid={`prep-manual-${idx}`}><Keyboard size={11}/>Manuel</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 bg-white dark:bg-[#1a1a1a] p-3 sm:p-4 border-t border-[#ececec] dark:border-[#2a2a2a] -mx-3 sm:-mx-4">
        {!allDone && <div className="text-xs text-[#666] mb-2 flex items-center gap-1"><AlertTriangle size={12} className="text-[#e4991e]"/>Il reste {lines.length - scannedCount} article(s) à scanner ou confirmer manuellement</div>}
        <button onClick={markReady} disabled={!allDone || submitting} className="dina-btn-primary w-full !min-h-[48px] text-base" data-testid="prep-mark-ready"><Package size={16}/>{submitting ? "Enregistrement…" : "Marquer la commande comme Prête"}</button>
      </div>

      {manualFor !== null && (
        <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4" onClick={() => setManualFor(null)}>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()} data-testid="prep-manual-modal">
            <div className="font-serif text-xl mb-1">Override manuel</div>
            <div className="text-xs text-[#666] mb-3">Confirmez manuellement <b>{lines[manualFor].item.name}</b>. Le motif est obligatoire et sera enregistré dans le journal d'audit.</div>
            <label className="text-xs uppercase text-[#666] font-semibold">Motif *</label>
            <select className="dina-input mt-1 mb-3" value={reason} onChange={e => setReason(e.target.value)} data-testid="prep-manual-reason">
              {MANUAL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              <option value="__custom__">Autre (préciser)…</option>
            </select>
            {reason === "__custom__" && (
              <input className="dina-input mb-3" placeholder="Préciser le motif…" value={customReason} onChange={e => setCustomReason(e.target.value)} autoFocus data-testid="prep-manual-custom"/>
            )}
            <div className="flex gap-2">
              <button onClick={() => setManualFor(null)} className="dina-btn-secondary flex-1">Annuler</button>
              <button onClick={confirmManual} className="dina-btn-primary flex-1" data-testid="prep-manual-confirm">Ajouter l'override</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
