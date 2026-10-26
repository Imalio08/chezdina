import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, X, Camera, CalendarClock, Zap, Play, Trash2 } from "lucide-react";
import { fcfa, dateFmt } from "@/lib/format";
import { compressImage } from "@/lib/imageCompress";

const ST = { open: ["À compter", "#e4991e"], submitted: ["À valider", "#5867fd"], closed: ["Validé", "#1f8a4c"] };
const KIND = { manuel: "Ponctuel", planifie: "Planifié", surprise: "Surprise" };
const FREQ = [["weekly", "Chaque semaine"], ["biweekly", "Toutes les 2 semaines"], ["monthly", "Chaque mois"], ["quarterly", "Chaque trimestre"]];
const SCOPES = [["all", "Tout le stock"], ["category", "Par catégorie"], ["brand", "Par marque"], ["location", "Par emplacement"]];
const scopeText = (s) => !s || s.type === "all" ? "Tout le stock" : s.type === "selection" ? "Sélection d'articles" : `${SCOPES.find(x => x[0] === s.type)?.[1]} : ${(s.values || []).join(", ")}`;

// Stock › Inventaires: planned / surprise / partial counts, blind count with comment + photo, owner validation, history.
export default function InventoriesTab({ products, isOwner, onChanged }) {
  const [rows, setRows] = useState([]);
  const [plans, setPlans] = useState([]);
  const [create, setCreate] = useState(null);
  const [open, setOpen] = useState(null);
  const load = () => Promise.all([api.get("/stock/inventories"), api.get("/stock/inventory-plans").catch(() => ({ data: [] }))]).then(([a, b]) => { setRows(a.data); setPlans(b.data); });
  useEffect(() => { load(); }, []);
  const delPlan = async (p) => { if (!window.confirm(`Supprimer la planification « ${p.name} » ?`)) return; await api.delete(`/stock/inventory-plans/${p.id}`); load(); };
  const runNow = () => api.post("/stock/inventory-plans/run").then(r => { toast.success(`${r.data.opened} inventaire(s) ouvert(s) · ${r.data.reminded} rappel(s)`); load(); });
  const done = () => { setCreate(null); setOpen(null); load(); onChanged?.(); };
  return (
    <div className="space-y-4" data-testid="inventories-tab">
      <div className="dina-card-white p-4 space-y-2">
        <div className="flex justify-between items-center flex-wrap gap-2"><div className="font-semibold flex items-center gap-2"><CalendarClock size={15} />Inventaires planifiés</div>
          {isOwner && <div className="flex gap-2"><button onClick={runNow} className="dina-btn-secondary !min-h-[34px] text-xs" data-testid="inv-plan-run"><Play size={12} />Lancer les échéances</button><button onClick={() => setCreate("plan")} className="dina-btn-secondary !min-h-[34px] text-xs" data-testid="inv-plan-new"><Plus size={12} />Planifier</button></div>}</div>
        {plans.map(p => <div key={p.id} className="flex items-center gap-2 text-sm border-t border-[#f2f2f2] pt-2" data-testid={`inv-plan-${p.id}`}>
          <div className="flex-1"><div className="font-medium">{p.name}</div><div className="text-[11px] text-[#666]">{FREQ.find(f => f[0] === p.frequency)?.[1] || `Tous les ${p.every_days} jours`} · {scopeText(p.scope)} · prochain le {dateFmt(p.next_due)} · rappel {p.remind_days_before} j avant</div></div>
          {isOwner && <button onClick={() => delPlan(p)} className="text-[#c62828]" data-testid={`inv-plan-del-${p.id}`}><Trash2 size={13} /></button>}
        </div>)}
        {!plans.length && <div className="text-xs text-[#666]">Aucune planification. {isOwner ? "Planifiez un inventaire régulier : il s'ouvre tout seul à la date prévue, avec rappels." : ""}</div>}
      </div>
      <div className="flex justify-between items-center flex-wrap gap-2"><div className="font-semibold">Historique des inventaires ({rows.length})</div>
        <div className="flex gap-2">{isOwner && <button onClick={() => setCreate("surprise")} className="dina-btn-secondary !min-h-[36px] text-xs" data-testid="inv-surprise"><Zap size={13} />Inventaire surprise</button>}
          {isOwner && <button onClick={() => setCreate("manuel")} className="dina-btn-primary !min-h-[36px] text-xs" data-testid="inv-new"><Plus size={13} />Nouvel inventaire</button>}</div></div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map(inv => <button key={inv.id} onClick={() => setOpen(inv)} className="dina-card-white p-4 text-left" data-testid={`inv-${inv.id}`}>
          <div className="flex justify-between gap-2"><div className="font-semibold">{inv.name}</div><span className="dina-chip text-[10px] whitespace-nowrap" style={{ color: ST[inv.status]?.[1] }} data-testid={`inv-status-${inv.id}`}>{ST[inv.status]?.[0] || inv.status}</span></div>
          <div className="text-[11px] text-[#666] mt-0.5">{KIND[inv.kind] || "Ponctuel"} · {scopeText(inv.scope)} · {dateFmt(inv.created_at)}</div>
          <div className="text-xs text-[#666] mt-1">{inv.lines?.length || 0} lignes{inv.status === "closed" ? ` · ${inv.gaps?.length || 0} écart(s) · ${fcfa(inv.gap_value || 0)}` : inv.status === "submitted" ? ` · soumis par ${inv.submitted_by}` : ""}</div>
          {inv.status === "open" && inv.owner_comment && <div className="text-[11px] text-[#c62828] mt-1">À recompter : {inv.owner_comment}</div>}
        </button>)}
        {!rows.length && <div className="col-span-full text-center text-sm text-[#666] py-6">Aucun inventaire</div>}
      </div>
      {create && <CreateModal mode={create} products={products} onClose={() => setCreate(null)} onDone={done} />}
      {open && <InventorySheet inv={open} isOwner={isOwner} onClose={() => setOpen(null)} onDone={done} />}
    </div>
  );
}

function CreateModal({ mode, products, onClose, onDone }) {
  const [f, setF] = useState({ name: mode === "plan" ? "Inventaire mensuel" : mode === "surprise" ? `Inventaire surprise ${new Date().toLocaleDateString("fr-FR")}` : `Inventaire ${new Date().toLocaleDateString("fr-FR")}`,
    type: "all", values: [], frequency: "monthly", next_due: new Date().toISOString().slice(0, 10), remind_days_before: 1 });
  const opts = useMemo(() => f.type === "all" ? [] : [...new Set(products.map(p => p[f.type]).filter(Boolean))].sort(), [f.type, products]);
  const save = async () => {
    const scope = { type: f.type, values: f.values };
    if (f.type !== "all" && !f.values.length) return toast.error("Choisissez au moins une valeur");
    try {
      if (mode === "plan") await api.post("/stock/inventory-plans", { name: f.name, frequency: f.frequency, next_due: f.next_due, remind_days_before: f.remind_days_before, scope });
      else await api.post("/stock/inventories", { name: f.name, kind: mode, scope });
      toast.success(mode === "plan" ? "Inventaire planifié" : mode === "surprise" ? "Inventaire surprise lancé · l'équipe est prévenue" : "Inventaire créé"); onDone();
    } catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-5 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="inv-create-modal">
        <div className="flex justify-between"><div className="font-serif text-xl">{mode === "plan" ? "Planifier un inventaire" : mode === "surprise" ? "Inventaire surprise" : "Nouvel inventaire"}</div><button onClick={onClose}><X size={16} /></button></div>
        <input className="dina-input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} data-testid="inv-name" />
        {mode === "plan" && <div className="grid grid-cols-2 gap-2">
          <select className="dina-input" value={f.frequency} onChange={e => setF({ ...f, frequency: e.target.value })} data-testid="inv-plan-frequency">{FREQ.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <input type="date" className="dina-input" value={f.next_due} onChange={e => setF({ ...f, next_due: e.target.value })} data-testid="inv-plan-date" />
          <label className="text-xs col-span-2 flex items-center gap-2">Rappel<input type="number" min={0} className="dina-input w-20" value={f.remind_days_before} onChange={e => setF({ ...f, remind_days_before: +e.target.value })} data-testid="inv-plan-remind" />jour(s) avant</label>
        </div>}
        <div className="flex flex-wrap gap-1">{SCOPES.map(([k, l]) => <button key={k} onClick={() => setF({ ...f, type: k, values: [] })} className={`px-3 py-1 text-xs rounded-full border ${f.type === k ? "bg-[#b02a2a] text-white border-[#b02a2a]" : "border-[#ddd]"}`} data-testid={`inv-scope-${k}`}>{l}</button>)}</div>
        {f.type !== "all" && <div className="max-h-48 overflow-y-auto border rounded p-2 text-xs space-y-1">
          {opts.map(v => <label key={v} className="flex items-center gap-2"><input type="checkbox" checked={f.values.includes(v)} onChange={e => setF({ ...f, values: e.target.checked ? [...f.values, v] : f.values.filter(x => x !== v) })} data-testid={`inv-scope-val-${v}`} />{v}</label>)}
          {!opts.length && <div className="text-[#666]">Aucune valeur renseignée sur les produits{f.type === "location" ? " (ajoutez un emplacement dans la fiche produit)" : ""}.</div>}
        </div>}
        <div className="flex gap-2"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={save} className="dina-btn-primary flex-1" data-testid="inv-create">{mode === "plan" ? "Planifier" : "Lancer"}</button></div>
      </div>
    </div>
  );
}

const tm = (iso) => iso ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

function CountedBy({ l }) {
  const [open, setOpen] = useState(false);
  if (l._dirty) return <span className="text-[#e4991e]">non enregistré</span>;
  if (!l.counted_by) return <span className="text-[#999]">—</span>;
  const log = l.count_log || [];
  return (
    <div>
      <div className="font-medium">{l.counted_by}</div>
      <div className="text-[#666]">{tm(l.counted_at)}</div>
      {log.length > 1 && <button onClick={() => setOpen(!open)} className="text-[#5867fd] underline" data-testid="inv-count-history">{log.length} saisies</button>}
      {open && log.map((e, k) => <div key={k} className="text-[#666]">{tm(e.at)} · {e.by} → {e.qty}</div>)}
    </div>
  );
}

function Counters({ lines }) {
  const by = {};
  lines.forEach(l => (l.count_log || (l.counted_by ? [{ by: l.counted_by, at: l.counted_at }] : [])).forEach(e => {
    const x = by[e.by] || (by[e.by] = { n: new Set(), first: e.at, last: e.at });
    x.n.add(l.product_id + (l.size || "")); if (e.at < x.first) x.first = e.at; if (e.at > x.last) x.last = e.at;
  }));
  const rows = Object.entries(by);
  if (!rows.length) return null;
  return (
    <div className="text-xs p-2 rounded bg-[#f6f7ff] mb-2 flex flex-wrap gap-x-4 gap-y-1" data-testid="inv-counters">
      <span className="font-semibold">Compté par :</span>
      {rows.map(([name, x]) => <span key={name}>{name} · {x.n.size} ligne{x.n.size > 1 ? "s" : ""} · {tm(x.first)}{x.last !== x.first ? ` → ${tm(x.last)}` : ""}</span>)}
    </div>
  );
}

function InventorySheet({ inv, isOwner, onClose, onDone }) {
  const [lines, setLines] = useState(inv.lines || []);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const counting = inv.status === "open";
  const showGaps = isOwner && inv.status !== "open" || inv.status === "closed";
  const upd = (i, p) => setLines(ls => ls.map((x, k) => k === i ? { ...x, ...p, _dirty: true } : x));
  const photo = async (i, file) => { if (!file) return; const d = await compressImage(file, 900, 0.6); upd(i, { photo: d }); };
  const save = async (quiet) => {
    const counts = lines.map((l, i) => l._dirty ? { line_index: i, qty_counted: l.qty_counted, comment: l.comment || "", photo: l.photo?.startsWith("data:") ? l.photo : undefined } : null).filter(Boolean);
    if (counts.length) await api.post(`/stock/inventories/${inv.id}/count`, { counts });
    const fresh = (await api.get("/stock/inventories")).data.find(x => x.id === inv.id);
    setLines(fresh?.lines || lines.map(l => ({ ...l, _dirty: false })));
    if (!quiet) toast.success("Comptages enregistrés");
  };
  const act = async (fn, msg) => { setBusy(true); try { await fn(); toast.success(msg); onDone(); } catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); } finally { setBusy(false); } };
  const submit = () => act(async () => { await save(true); await api.post(`/stock/inventories/${inv.id}/submit`, { note }); }, "Inventaire soumis au propriétaire");
  const validate = () => window.confirm("Valider l'inventaire et appliquer les écarts au stock ?") && act(async () => { if (counting) await save(true); await api.post(`/stock/inventories/${inv.id}/close`, { note }); }, "Inventaire validé · écarts appliqués");
  const reject = () => { const r = window.prompt("Motif du recomptage (obligatoire)"); if (r?.trim()) act(() => api.post(`/stock/inventories/${inv.id}/reject`, { reason: r.trim() }), "Renvoyé pour recomptage"); };
  const total = lines.reduce((s, l) => s + (l.gap_value ?? ((l.qty_counted ?? l.qty_expected) - (l.qty_expected ?? 0)) * (l.unit_cost || 0)), 0);
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-3" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-5 w-full max-w-4xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="inv-count-modal">
        <div className="flex justify-between items-start mb-2"><div><div className="font-serif text-xl">{inv.name}</div>
          <div className="text-xs text-[#666]">{KIND[inv.kind] || "Ponctuel"} · {scopeText(inv.scope)} · {ST[inv.status]?.[0]}{counting ? " · comptage à l'aveugle" : ""}{inv.submitted_by ? ` · soumis par ${inv.submitted_by}` : ""}{inv.closed_by ? ` · validé par ${inv.closed_by}` : ""}</div></div><button onClick={onClose}><X size={18} /></button></div>
        {inv.owner_comment && <div className="text-xs p-2 rounded bg-[#fff8e9] mb-2" data-testid="inv-owner-comment">Commentaire du propriétaire : {inv.owner_comment}</div>}
        <Counters lines={lines} />
        {showGaps && isOwner && <div className="text-sm font-semibold mb-2" data-testid="inv-gap-total">Écart total : <span className={total < 0 ? "text-[#c62828]" : "text-[#1f8a4c]"}>{fcfa(total)}</span></div>}
        <div className="overflow-x-auto"><table className="dina-table"><thead><tr><th>Article</th><th>Taille</th><th className="text-right">Compté</th>{showGaps && <><th className="text-right">Attendu</th><th className="text-right">Écart</th><th className="text-right">Valeur</th></>}<th>Commentaire</th><th>Photo</th><th>Compté par</th></tr></thead>
          <tbody>{lines.map((l, i) => { const gap = l.gap ?? (l.qty_counted != null && l.qty_expected != null ? l.qty_counted - l.qty_expected : null); return (
            <tr key={i} data-testid={`inv-line-${i}`}>
              <td className="font-medium">{l.product_name}<div className="text-[10px] text-[#999]">{[l.sku, l.location].filter(Boolean).join(" · ")}</div></td><td>{l.size || "—"}</td>
              <td className="text-right"><input type="number" min={0} disabled={!counting} className="dina-input tabular text-right w-20 !py-1" value={l.qty_counted ?? ""} onChange={e => upd(i, { qty_counted: e.target.value === "" ? null : Math.max(0, +e.target.value) })} data-testid={`inv-count-${i}`} /></td>
              {showGaps && <><td className="text-right tabular">{l.qty_expected ?? "—"}</td><td className={`text-right tabular font-semibold ${gap < 0 ? "text-[#c62828]" : gap > 0 ? "text-[#1f8a4c]" : ""}`}>{gap == null ? "—" : `${gap > 0 ? "+" : ""}${gap}`}</td><td className="text-right tabular text-xs">{gap ? fcfa(gap * (l.unit_cost || 0)) : "—"}</td></>}
              <td><input disabled={!counting} className="dina-input !py-1 text-xs min-w-[140px]" placeholder="—" value={l.comment || ""} onChange={e => upd(i, { comment: e.target.value })} data-testid={`inv-comment-${i}`} /></td>
              <td>{l.photo ? <a href={l.photo} target="_blank" rel="noreferrer"><img src={l.photo} alt="" className="w-9 h-9 object-cover rounded" data-testid={`inv-photo-${i}`} /></a> : counting ? <label className="cursor-pointer text-[#666]" data-testid={`inv-photo-add-${i}`}><Camera size={15} /><input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => photo(i, e.target.files?.[0])} /></label> : "—"}</td>
              <td className="text-[11px] whitespace-nowrap" data-testid={`inv-counted-by-${i}`}><CountedBy l={l} /></td>
            </tr>); })}</tbody></table></div>
        {inv.status !== "closed" && <textarea className="dina-input mt-3" rows={2} placeholder={isOwner ? "Commentaire du propriétaire (facultatif)" : "Note pour le propriétaire (facultatif)"} value={note} onChange={e => setNote(e.target.value)} data-testid="inv-note" />}
        <div className="flex gap-2 mt-3 flex-wrap">
          <button onClick={onClose} className="dina-btn-secondary flex-1">Fermer</button>
          {counting && <button onClick={() => save(false).catch(e => toast.error(e?.response?.data?.detail || "Erreur"))} disabled={busy} className="dina-btn-secondary flex-1" data-testid="inv-save-counts">Enregistrer</button>}
          {counting && <button onClick={submit} disabled={busy} className="dina-btn-primary flex-1" data-testid="inv-submit">Soumettre au propriétaire</button>}
          {isOwner && inv.status === "submitted" && <button onClick={reject} disabled={busy} className="dina-btn-secondary flex-1 !text-[#c62828]" data-testid="inv-reject">Faire recompter</button>}
          {isOwner && inv.status !== "closed" && <button onClick={validate} disabled={busy} className="dina-btn-primary flex-1" data-testid="inv-close">Valider et appliquer</button>}
        </div>
      </div>
    </div>
  );
}
