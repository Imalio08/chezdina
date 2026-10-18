import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, X, Camera } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { dateTimeFmt, fcfa } from "@/lib/format";
import { compressImage } from "@/lib/imageCompress";

const APPROVAL = { pending: ["En attente de validation", "#e4991e"], approved: ["Validé · hors stock vendable", "#1f8a4c"], rejected: ["Refusé", "#c62828"] };
const OUTCOMES = [["remis_en_stock", "Réparé · remettre en stock"], ["en_reparation", "Envoyer en réparation"], ["retour_fournisseur", "Renvoyé au fournisseur"], ["vendu_remise", "Vendu avec remise"], ["detruit", "Détruit"]];

function DeclareModal({ statuses, onClose, onDone, reload }) {
  const [products, setProducts] = useState([]);
  const [f, setF] = useState({ product_id: "", size: "", qty: 1, status: "", reason: "", comment: "", photo: null });
  const [extra, setExtra] = useState("");
  useEffect(() => { api.get("/products").then(r => setProducts(r.data || [])).catch(() => {}); }, []);
  const p = products.find(x => x.id === f.product_id);
  const sizes = Object.keys(p?.stock_by_size || {});
  const submit = async () => {
    try { await api.post("/stock/unsellable", { ...f, qty: +f.qty || 1 }); toast.success("Déclaré · en attente de validation du propriétaire"); onDone(); }
    catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };
  const addStatus = async () => { if (!extra.trim()) return; await api.post("/stock/unsellable/statuses", { label: extra }); setF({ ...f, status: extra.trim() }); setExtra(""); reload(); };
  return (
    <div className="fixed inset-0 bg-black/50 z-[70] grid place-items-center p-4" onClick={e => e.target === e.currentTarget && onClose()} data-testid="unsellable-modal">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto space-y-2">
        <div className="flex justify-between"><div className="font-serif text-xl">Déclarer un article non vendable</div><button onClick={onClose} aria-label="Fermer"><X size={18}/></button></div>
        <select className="dina-input" value={f.product_id} onChange={e => setF({ ...f, product_id: e.target.value, size: "" })} data-testid="unsellable-product"><option value="">Produit…</option>{products.map(x => <option key={x.id} value={x.id}>{x.name} · {x.sku}</option>)}</select>
        {sizes.length > 0 && <select className="dina-input" value={f.size} onChange={e => setF({ ...f, size: e.target.value })} data-testid="unsellable-size"><option value="">Taille…</option>{sizes.map(s => <option key={s} value={s}>{s} ({p.stock_by_size[s]} en stock)</option>)}</select>}
        <input type="number" min="1" className="dina-input" value={f.qty} onChange={e => setF({ ...f, qty: e.target.value })} placeholder="Quantité" data-testid="unsellable-qty"/>
        <div className="flex flex-wrap gap-1.5">{statuses.map(s => <button key={s} type="button" onClick={() => setF({ ...f, status: s })} className={`px-3 py-1 rounded-full text-xs border ${f.status === s ? "bg-[#b02a2a] text-white border-[#b02a2a]" : "border-[#ddd]"}`} data-testid={`unsellable-status-${s}`}>{s}</button>)}</div>
        <div className="flex gap-2"><input className="dina-input flex-1" placeholder="+ Ajouter un motif" value={extra} onChange={e => setExtra(e.target.value)} data-testid="unsellable-new-status"/><button type="button" onClick={addStatus} className="dina-btn-secondary"><Plus size={13}/></button></div>
        <input className="dina-input" placeholder="Raison (obligatoire)" value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} data-testid="unsellable-reason"/>
        <textarea className="dina-input" rows={2} placeholder="Commentaire (facultatif)" value={f.comment} onChange={e => setF({ ...f, comment: e.target.value })}/>
        <label className="dina-btn-secondary cursor-pointer inline-flex"><Camera size={13}/>{f.photo ? "Photo ajoutée" : "Photo (facultatif)"}<input type="file" accept="image/*" capture="environment" className="hidden" onChange={async e => { const x = e.target.files?.[0]; if (x) setF({ ...f, photo: await compressImage(x, 1200, 0.8) }); }}/></label>
        <button onClick={submit} disabled={!f.product_id || !f.status || !f.reason.trim() || (sizes.length > 0 && !f.size)} className="dina-btn-primary w-full disabled:opacity-50" data-testid="unsellable-submit">Envoyer pour validation</button>
      </div>
    </div>
  );
}

function Row({ d, isOwner, reload }) {
  const [open, setOpen] = useState(false);
  const act = async (url, body, msg) => { try { await api.post(url, body); toast.success(msg); reload(); } catch (e) { toast.error(e.response?.data?.detail || "Erreur"); } };
  const decide = (ok) => { const note = ok ? "" : window.prompt("Motif du refus (obligatoire)"); if (!ok && !note?.trim()) return; if (ok && !window.confirm(`Retirer ${d.qty} × ${d.product_name} du stock vendable ?`)) return; act(`/stock/unsellable/${d.id}/decide`, { decision: ok ? "approve" : "reject", note }, ok ? "Validé" : "Refusé"); };
  const change = (o, l) => { if (window.confirm(`${l} ?`)) act(`/stock/unsellable/${d.id}/change`, { outcome: o }, "Statut mis à jour"); };
  const [ap, col] = APPROVAL[d.approval] || ["", "#666"];
  const closed = ["remis_en_stock", "retour_fournisseur", "vendu_remise", "detruit"].includes(d.outcome);
  return (
    <div className="dina-card-white p-3" data-testid={`unsellable-${d.id}`}>
      <div className="flex gap-3 items-start cursor-pointer" onClick={() => setOpen(!open)}>
        {(d.photo || d.image) && <img src={d.photo || d.image} alt="" className="w-12 h-12 rounded object-cover"/>}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{d.product_name}{d.size ? ` · ${d.size}` : ""} × {d.qty}</div>
          <div className="text-xs"><b className="text-[#b02a2a]">{d.status}</b> · {d.reason}</div>
          <div className="text-[11px] text-[#666]">{d.declared_by} · {dateTimeFmt(d.created_at)} · valeur {fcfa(d.qty * (d.unit_cost || 0))}</div>
        </div>
        <span className="text-[11px] font-semibold" style={{ color: col }}>{closed ? OUTCOMES.find(o => o[0] === d.outcome)?.[1] : ap}</span>
      </div>
      {open && <div className="mt-2 pt-2 border-t border-[#f0f0f0] text-xs space-y-2">
        {d.comment && <div className="italic">« {d.comment} »</div>}
        <ol className="space-y-0.5">{(d.history || []).map((h, i) => <li key={i}>{dateTimeFmt(h.at)} · <b>{h.label}</b> · {h.by}{h.note ? ` · ${h.note}` : ""}</li>)}</ol>
        {d.approval === "pending" && isOwner && <div className="flex gap-2"><button onClick={() => decide(true)} className="dina-btn-primary !min-h-[32px] text-xs !bg-[#1f8a4c]" data-testid={`unsellable-approve-${d.id}`}>Valider</button><button onClick={() => decide(false)} className="dina-btn-secondary !min-h-[32px] text-xs !text-[#c62828]" data-testid={`unsellable-reject-${d.id}`}>Refuser</button></div>}
        {d.approval === "approved" && !closed && <div className="flex flex-wrap gap-1.5">{OUTCOMES.map(([o, l]) => <button key={o} onClick={() => change(o, l)} className="dina-chip text-[11px]" data-testid={`unsellable-${o}-${d.id}`}>{l}</button>)}</div>}
      </div>}
    </div>
  );
}

export default function UnsellableTab() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [show, setShow] = useState(false);
  const load = () => { api.get("/stock/unsellable").then(r => setRows(r.data || [])).catch(() => {}); api.get("/stock/unsellable/statuses").then(r => setStatuses(r.data || [])).catch(() => {}); };
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-3" data-testid="unsellable-tab">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="text-sm text-[#666]">Articles défectueux, invendables, en retour fournisseur, en réparation ou perdus : ils sortent du stock vendable après validation du propriétaire.</div>
        <button onClick={() => setShow(true)} className="dina-btn-primary" data-testid="unsellable-add"><Plus size={13}/>Déclarer un article</button>
      </div>
      {rows.length === 0 ? <div className="text-sm text-[#999] py-6 text-center">Aucun article déclaré.</div> : rows.map(d => <Row key={d.id} d={d} isOwner={user?.role === "admin"} reload={load}/>)}
      {show && <DeclareModal statuses={statuses} onClose={() => setShow(false)} onDone={() => { setShow(false); load(); }} reload={load}/>}
    </div>
  );
}
