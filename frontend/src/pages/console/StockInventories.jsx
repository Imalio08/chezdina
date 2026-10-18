import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { useKeptState } from "@/lib/keptState";
import ApprovalReview, { stockRow } from "@/components/shared/ApprovalReview";
import UnsellableTab from "@/components/stock/UnsellableTab";
import { fcfa, dateFmt } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Minus, X, Edit, Package, AlertTriangle, Clock, DollarSign, History, ClipboardList, CheckSquare } from "lucide-react";

const TABS = [
  { k: "stock", label: "Stock par variante" },
  { k: "movements", label: "Mouvements" },
  { k: "requests", label: "Demandes d'ajustement" },
  { k: "invendables", label: "Non vendables" },
  { k: "inventories", label: "Inventaires" },
];

export default function StockInventories() {
  const { user } = useAuth();
  const isOwner = user?.role === "admin";
  const [tab, setTab] = useKeptState("stock-tab", () => new URLSearchParams(window.location.search).get("tab") || "stock");
  useEffect(() => { const t = new URLSearchParams(window.location.search).get("tab"); if (t && TABS.some(x => x.k === t)) setTab(t); }, []); // eslint-disable-line
  const [review, setReview] = useState(null);
  const [products, setProducts] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [adjust, setAdjust] = useState(null);
  const [requests, setRequests] = useState([]);
  const [movements, setMovements] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [newInv, setNewInv] = useState(false);
  const [countInv, setCountInv] = useState(null);
  const [q, setQ] = useKeptState("stock-q", "");

  const load = async () => {
    const [p, k, r, m, i] = await Promise.all([
      api.get("/products"),
      api.get("/stock/kpis").catch(() => ({ data: null })),
      api.get("/stock/adjustment-requests").catch(() => ({ data: [] })),
      api.get("/stock/movements").catch(() => ({ data: [] })),
      api.get("/stock/inventories").catch(() => ({ data: [] })),
    ]);
    setProducts(p.data); setKpis(k.data); setRequests(r.data || []); setMovements(m.data || []); setInventories(i.data || []);
  };
  useEffect(() => { load(); }, []);

  const filtered = products.filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.sku?.includes(q));

  return (
    <div className="space-y-5">
      <div><h1 className="font-serif text-3xl">Stock & inventaires</h1><p className="text-sm text-[#666]">Vue par variante · journal · demandes · inventaires aveugles</p></div>

      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-2">
          <Kpi label="Valeur stock" v={fcfa(kpis.value)} c="#b02a2a" small />
          <Kpi label="Articles" v={kpis.items} c="#5867fd" />
          <Kpi label="Ruptures" v={kpis.ruptures} c="#c62828" />
          <Kpi label="Stock bas" v={kpis.low} c="#e4991e" />
          <Kpi label="Stock dormant" v={kpis.dormant} c="#999" />
          <Kpi label="Immobilisé >60j" v={kpis.aged ?? 0} c="#c62828" />
          <Kpi label="Écarts du mois" v={kpis.ecarts_month} c="#5867fd" />
        </div>
      )}

      <div className="flex gap-1 bg-[#f5f5f5] dark:bg-[#1a1a1a] p-1 rounded-lg w-fit overflow-x-auto">
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`px-4 py-1.5 text-sm rounded-md whitespace-nowrap ${tab === t.k ? "bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold" : ""}`} data-testid={`stock-tab-${t.k}`}>{t.label}</button>
        ))}
      </div>

      {tab === "stock" && (
        <div className="dina-card-white p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Stock par produit ({filtered.length})</div>
            <input className="dina-input max-w-xs" placeholder="Rechercher…" value={q} onChange={e => setQ(e.target.value)} data-testid="stock-search" />
          </div>
          <div className="overflow-x-auto">
            <table className="dina-table">
              <thead><tr><th>Produit</th><th>SKU</th><th>Variantes · Stock</th><th className="text-right">Total</th><th className="text-right">Valeur</th><th>Âge</th><th></th></tr></thead>
              <tbody>{filtered.slice(0, 200).map(p => {
                const ageDays = p.created_at ? Math.floor((Date.now() - new Date(p.created_at).getTime()) / (24*3600*1000)) : null;
                const aged = ageDays !== null && ageDays > 60 && (p.stock || 0) > 0;
                return (
                <tr key={p.id} data-testid={`stock-row-${p.sku}`}>
                  <td><div className="flex items-center gap-2"><div className="w-9 h-9 rounded bg-[#f5f5f5] overflow-hidden"><img src={p.image || p.images?.[0]} alt="" className="w-full h-full object-cover" /></div><div><div className="font-medium">{p.name}</div><div className="text-[10px] text-[#999]">{p.brand} · {p.category}</div></div></div></td>
                  <td className="font-mono text-xs">{p.sku}</td>
                  <td className="text-xs text-[#666]">{Object.entries(p.stock_by_size || {}).map(([s, v]) => <span key={s} className="inline-block mr-2">{s}:<b className={v === 0 ? "text-[#c62828]" : v < 3 ? "text-[#e4991e]" : "text-[#1f8a4c]"}>{v}</b></span>)}</td>
                  <td className="text-right tabular"><span className={p.stock < 5 ? "text-[#c62828] font-semibold" : ""}>{p.stock}</span></td>
                  <td className="text-right tabular">{fcfa(p.stock * p.cost)}</td>
                  <td className="text-xs">{ageDays === null ? "—" : aged ? (
                    <span className="dina-chip text-[10px] inline-flex items-center gap-1 !text-[#c62828] !border-[#c62828]" title="Produit immobilisé — pensez à une promo"><Clock size={9}/>{ageDays}j</span>
                  ) : ageDays > 30 ? (
                    <span className="dina-chip text-[10px] !text-[#e4991e] !border-[#e4991e]">{ageDays}j</span>
                  ) : (
                    <span className="text-[#1f8a4c]">{ageDays}j</span>
                  )}</td>
                  <td className="text-right"><button onClick={() => setAdjust(p)} className="text-[#0021cc]" data-testid={`stock-adjust-${p.sku}`}><Edit size={13} /></button></td>
                </tr>
                );
              })}</tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "movements" && (
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Journal des mouvements ({movements.length})</div>
          <table className="dina-table"><thead><tr><th>Date</th><th>Produit</th><th>Taille</th><th className="text-right">Delta</th><th>Raison</th><th>Par</th></tr></thead>
            <tbody>{movements.length === 0 ? <tr><td colSpan={6} className="text-center text-sm text-[#666] py-6">Aucun mouvement</td></tr> :
              movements.slice(0, 100).map(m => (
                <tr key={m.id} data-testid={`mov-${m.id}`}><td className="text-xs text-[#666]">{dateFmt(m.created_at)}</td><td>{m.product_name || m.product_id}</td><td>{m.size || "—"}</td><td className={`text-right tabular font-semibold ${m.qty_delta < 0 ? "text-[#c62828]" : "text-[#1f8a4c]"}`}>{m.qty_delta > 0 ? "+" : ""}{m.qty_delta}</td><td className="text-xs">{m.reason}</td><td className="text-xs text-[#666]">{m.created_by}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "requests" && (
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Demandes d'ajustement ({requests.length})</div>
          <table className="dina-table"><thead><tr><th>Date</th><th>Produit</th><th>Taille</th><th className="text-right">Delta</th><th>Raison</th><th>Demandeur</th><th>Statut</th><th></th></tr></thead>
            <tbody>{requests.length === 0 ? <tr><td colSpan={8} className="text-center text-sm text-[#666] py-6">Aucune demande</td></tr> :
              requests.map(r => (
                <tr key={r.id} data-testid={`req-${r.id}`} onClick={() => setReview(stockRow(r))} className="cursor-pointer hover:bg-[#fff5f5]">
                  <td className="text-xs text-[#666]">{dateFmt(r.created_at)}</td>
                  <td>{r.product_name}</td><td>{r.size || "—"}</td>
                  <td className={`text-right tabular font-semibold ${r.qty_delta < 0 ? "text-[#c62828]" : "text-[#1f8a4c]"}`}>{r.qty_delta > 0 ? "+" : ""}{r.qty_delta}</td>
                  <td className="text-xs">{r.reason}</td>
                  <td className="text-xs">{r.requested_by}</td>
                  <td><span className={`dina-chip text-[10px] ${r.status === "approved" ? "!text-[#1f8a4c] !border-[#1f8a4c]" : r.status === "rejected" ? "!text-[#c62828] !border-[#c62828]" : ""}`}>{r.status === "approved" ? "Validée" : r.status === "rejected" ? "Refusée" : "En attente"}</span>{r.status === "rejected" && r.decision_note && <div className="text-[10px] text-[#c62828] mt-0.5">Motif : {r.decision_note}</div>}</td>
                  <td className="text-right whitespace-nowrap">{r.status === "pending" && isOwner && <button onClick={e => { e.stopPropagation(); setReview(stockRow(r)); }} className="dina-chip text-[11px]" data-testid={`req-open-${r.id}`}>Voir et décider</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {review && <ApprovalReview row={review} onClose={() => setReview(null)} onDone={() => { setReview(null); load(); }}/>}
        </div>
      )}

      {tab === "invendables" && <UnsellableTab/>}

      {tab === "inventories" && (
        <div className="space-y-3">
          <div className="flex justify-between"><div className="font-semibold">Inventaires ({inventories.length})</div>{isOwner && <button onClick={() => setNewInv(true)} className="dina-btn-primary !min-h-[36px]" data-testid="inv-new"><Plus size={13} />Nouvel inventaire</button>}</div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {inventories.length === 0 ? <div className="col-span-full text-center text-sm text-[#666] py-6">Aucun inventaire</div> :
              inventories.map(inv => (
                <div key={inv.id} className="dina-card-white p-4" data-testid={`inv-${inv.id}`}>
                  <div className="flex items-start justify-between mb-2"><div><div className="font-semibold">{inv.name}</div><div className="text-[11px] text-[#666]">{dateFmt(inv.created_at)} · {inv.created_by}</div></div><span className={`dina-chip text-[10px] ${inv.status === "closed" ? "!text-[#999]" : "!text-[#1f8a4c] !border-[#1f8a4c]"}`}>{inv.status === "open" ? "Ouvert" : "Clôturé"}</span></div>
                  <div className="text-xs text-[#666]">{inv.lines?.length || 0} lignes · {inv.gaps?.length || 0} écarts</div>
                  <button onClick={() => setCountInv(inv)} className="dina-btn-secondary w-full !min-h-[32px] text-xs mt-2" data-testid={`inv-open-${inv.id}`}>{inv.status === "open" ? "Compter" : "Consulter"}</button>
                </div>
              ))}
          </div>
        </div>
      )}

      {adjust && <AdjustModal product={adjust} isOwner={isOwner} onClose={() => setAdjust(null)} onSaved={() => { setAdjust(null); load(); }} />}
      {newInv && <NewInventoryModal products={products} onClose={() => setNewInv(false)} onDone={() => { setNewInv(false); load(); }} />}
      {countInv && <CountInventoryModal inv={countInv} isOwner={isOwner} onClose={() => setCountInv(null)} onDone={() => { setCountInv(null); load(); }} />}
    </div>
  );
}

function Kpi({ label, v, c, small }) {
  return <div className="dina-card-white p-3 min-w-0"><div className="text-[10px] uppercase tracking-wide text-[#666] font-semibold truncate">{label}</div><div className={`font-serif tabular leading-none mt-1.5 truncate ${small ? "text-base" : "text-xl"}`} style={{ color: c }}>{v}</div></div>;
}

function AdjustModal({ product, isOwner, onClose, onSaved }) {
  const [sbs, setSbs] = useState({ ...(product.stock_by_size || {}) });
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const sizes = product.sizes?.length ? product.sizes : Object.keys(sbs);

  const save = async () => {
    setSaving(true);
    try {
      // compute deltas per size and send as adjustment requests
      for (const s of sizes) {
        const oldQty = Number(product.stock_by_size?.[s] || 0);
        const newQty = Number(sbs[s] || 0);
        if (oldQty !== newQty) {
          await api.post("/stock/adjustment-requests", {
            product_id: product.id, product_name: product.name, size: s,
            qty_delta: newQty - oldQty, reason: reason || "Ajustement manuel",
          });
        }
      }
      toast.success(isOwner ? "Stock ajusté" : "Demande envoyée pour validation du propriétaire");
      onSaved();
    } catch { toast.error("Erreur"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="adjust-modal">
        <div className="flex justify-between items-start mb-4"><div><div className="font-serif text-xl">Ajuster le stock</div><div className="text-xs text-[#666]">{product.name}{!isOwner && " — Nécessite validation"}</div></div><button onClick={onClose}><X size={16} /></button></div>
        {sizes.length === 0 ? <div className="text-sm text-[#666] text-center py-6">Pas de tailles définies</div> :
          <div className="space-y-2 mb-4">
            <div className="text-xs uppercase text-[#666] mb-2">Stock par taille</div>
            {sizes.map(s => (
              <div key={s} className="flex items-center gap-2" data-testid={`adj-size-${s}`}>
                <div className="w-14 font-semibold">{s}</div>
                <button type="button" onClick={() => setSbs({ ...sbs, [s]: Math.max(0, (+sbs[s] || 0) - 1) })} className="w-8 h-8 border rounded"><Minus size={12} className="mx-auto" /></button>
                <input type="number" min="0" className="dina-input text-center tabular flex-1" value={sbs[s] || 0} onChange={e => setSbs({ ...sbs, [s]: Math.max(0, +e.target.value) })} />
                <button type="button" onClick={() => setSbs({ ...sbs, [s]: (+sbs[s] || 0) + 1 })} className="w-8 h-8 border rounded"><Plus size={12} className="mx-auto" /></button>
              </div>
            ))}
          </div>}
        <input className="dina-input mb-4" placeholder="Motif (réception, perte, inventaire…)" value={reason} onChange={e => setReason(e.target.value)} data-testid="adj-reason" />
        <div className="flex gap-2"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={save} disabled={saving} className="dina-btn-primary flex-1" data-testid="adj-save">{saving ? "…" : (isOwner ? "Appliquer" : "Demander validation")}</button></div>
      </div>
    </div>
  );
}

function NewInventoryModal({ products, onClose, onDone }) {
  const [name, setName] = useState(`Inventaire ${new Date().toLocaleDateString('fr-FR')}`);
  const [selected, setSelected] = useState([]);
  const [all, setAll] = useState(true);

  const create = async () => {
    try {
      const payload = { name, product_ids: all ? [] : selected };
      await api.post("/stock/inventories", payload);
      toast.success("Inventaire créé"); onDone();
    } catch { toast.error("Erreur"); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()} data-testid="inv-new-modal">
        <div className="flex justify-between items-start mb-4"><div className="font-serif text-xl">Nouvel inventaire</div><button onClick={onClose}><X size={16} /></button></div>
        <input className="dina-input mb-3" placeholder="Nom de l'inventaire" value={name} onChange={e => setName(e.target.value)} data-testid="inv-name" />
        <label className="flex items-center gap-2 text-sm mb-3"><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} className="accent-[#b02a2a]" />Tous les produits</label>
        {!all && (
          <div className="max-h-56 overflow-y-auto border rounded p-2 space-y-1 text-xs">
            {products.map(p => (
              <label key={p.id} className="flex items-center gap-2 p-1 hover:bg-[#fafafa] rounded">
                <input type="checkbox" checked={selected.includes(p.id)} onChange={() => setSelected(selected.includes(p.id) ? selected.filter(x => x !== p.id) : [...selected, p.id])} className="accent-[#b02a2a]" />
                <span className="flex-1 truncate">{p.name}</span>
              </label>
            ))}
          </div>
        )}
        <div className="flex gap-2 mt-5"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={create} className="dina-btn-primary flex-1" data-testid="inv-create">Créer</button></div>
      </div>
    </div>
  );
}

function CountInventoryModal({ inv, isOwner, onClose, onDone }) {
  const [lines, setLines] = useState(inv.lines || []);
  const [note, setNote] = useState("");
  const [working, setWorking] = useState(false);
  const readonly = inv.status === "closed";

  const upd = (i, v) => setLines(lines.map((x, idx) => idx === i ? { ...x, qty_counted: Math.max(0, +v || 0) } : x));

  const saveCounts = async () => {
    setWorking(true);
    try {
      await api.post(`/stock/inventories/${inv.id}/count`, { counts: lines.map((l, i) => ({ line_index: i, qty_counted: l.qty_counted })) });
      toast.success("Comptages enregistrés");
    } catch { toast.error("Erreur"); } finally { setWorking(false); }
  };

  const close = async () => {
    if (!confirm("Clôturer l'inventaire et appliquer les écarts ?")) return;
    setWorking(true);
    try {
      await saveCounts();
      const { data } = await api.post(`/stock/inventories/${inv.id}/close`, { note });
      toast.success(`Clôturé · ${data.gaps.length} écart(s) appliqué(s)`); onDone();
    } catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
    finally { setWorking(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="inv-count-modal">
        <div className="flex items-center justify-between mb-3"><div><div className="font-serif text-xl">{inv.name}</div><div className="text-xs text-[#666]">{readonly ? "Lecture seule · " : "Comptage à l'aveugle · "}{lines.length} lignes</div></div><button onClick={onClose}><X size={18} /></button></div>
        <table className="dina-table mb-3"><thead><tr><th>Produit</th><th>Taille</th><th className="text-right">Compté</th>{(readonly || isOwner && inv.status === "closed") && <th className="text-right">Attendu</th>}{readonly && <th className="text-right">Écart</th>}</tr></thead>
          <tbody>{lines.map((l, i) => (
            <tr key={i}><td className="font-medium">{l.product_name}</td><td>{l.size || "—"}</td><td className="text-right"><input type="number" disabled={readonly} min={0} className="dina-input tabular text-right w-24 !py-1" value={l.qty_counted ?? ""} onChange={e => upd(i, e.target.value)} data-testid={`inv-count-${i}`} /></td>{readonly && <td className="text-right tabular">{l.qty_expected ?? "—"}</td>}{readonly && <td className={`text-right tabular font-semibold ${(l.qty_counted - l.qty_expected) < 0 ? "text-[#c62828]" : (l.qty_counted - l.qty_expected) > 0 ? "text-[#1f8a4c]" : ""}`}>{l.qty_counted != null ? (l.qty_counted - l.qty_expected > 0 ? "+" : "") + (l.qty_counted - l.qty_expected) : "—"}</td>}</tr>
          ))}</tbody>
        </table>
        {!readonly && <textarea className="dina-input mb-3" rows={2} placeholder="Note de clôture (facultatif)" value={note} onChange={e => setNote(e.target.value)} />}
        <div className="flex gap-2">
          <button onClick={onClose} className="dina-btn-secondary flex-1">Fermer</button>
          {!readonly && <button onClick={saveCounts} disabled={working} className="dina-btn-secondary flex-1" data-testid="inv-save-counts">Enregistrer</button>}
          {!readonly && isOwner && <button onClick={close} disabled={working} className="dina-btn-primary flex-1" data-testid="inv-close">Clôturer et appliquer</button>}
        </div>
      </div>
    </div>
  );
}
