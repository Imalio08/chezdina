import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { fcfa, dateFmt } from "@/lib/format";
import { toast } from "sonner";
import { printPOLabels } from "@/lib/printLabels";
import { Plus, Pencil, Trash2, X, ChevronRight, ChevronLeft, Printer, QrCode, Check, Package } from "lucide-react";

const COUNTRIES = ["CI", "TR", "CN", "AE", "FR", "MA", "GH", "SN"];
const QR_URL = (txt, size = 90) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(txt)}`;

export default function Purchases() {
  const [sups, setSups] = useState([]);
  const [pos, setPos] = useState([]);
  const [products, setProducts] = useState([]);
  const [editSup, setEditSup] = useState(null);
  const [wizard, setWizard] = useState(null); // null | {} | initial PO
  const [receive, setReceive] = useState(null); // PO being received
  const [labels, setLabels] = useState(null); // array of QR labels to print

  const load = () => Promise.all([api.get("/suppliers"), api.get("/purchase-orders"), api.get("/products")])
    .then(([a, b, c]) => { setSups(a.data); setPos(b.data); setProducts(c.data); })
    .catch(() => toast.error("Erreur"));
  useEffect(() => { load(); }, []);

  const saveSup = async (f) => {
    try {
      if (editSup?.id) await api.patch(`/suppliers/${editSup.id}`, f);
      else await api.post("/suppliers", f);
      toast.success("Fournisseur enregistré"); setEditSup(null); load();
    } catch { toast.error("Erreur"); }
  };
  const delSup = async (id) => { if (!confirm("Supprimer ce fournisseur ?")) return; await api.delete(`/suppliers/${id}`); toast.success("Supprimé"); load(); };

  const savePo = async (payload) => {
    try {
      await api.post("/purchase-orders", payload);
      toast.success("Bon de commande créé"); setWizard(null); load();
    } catch { toast.error("Erreur"); }
  };

  const receivePo = async (po, items, extras, note) => {
    try {
      const r = await api.post(`/purchase-orders/${po.id}/receive`, { items, extra_costs: extras, note });
      toast.success(`${r.data.labels.length} étiquettes générées`);
      setReceive(null); load();
      printPOLabels(po.id).catch(() => setLabels(r.data.labels));
    } catch { toast.error("Erreur réception"); }
  };

  const delPo = async (id) => { if (!confirm("Supprimer ce bon ?")) return; await api.delete(`/purchase-orders/${id}`); load(); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Achats & fournisseurs</h1><p className="text-sm text-[#666]">Fournisseurs, bons de commande 4-steps et réception avec étiquettes QR</p></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Fournisseurs</div><div className="font-serif text-2xl tabular">{sups.length}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Soldes dus</div><div className="font-serif text-2xl tabular text-[#c62828]">{fcfa(sups.reduce((s, x) => s + (x.balance || 0), 0))}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Bons de commande</div><div className="font-serif text-2xl tabular">{pos.length}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Total achats</div><div className="font-serif text-2xl tabular">{fcfa(pos.reduce((s, x) => s + (x.total || 0), 0))}</div></div>
      </div>

      <div className="grid lg:grid-cols-[380px_1fr] gap-4">
        <div className="dina-card-white p-5">
          <div className="flex justify-between items-center mb-3"><div className="font-semibold">Fournisseurs ({sups.length})</div><button onClick={() => setEditSup({})} className="dina-btn-primary !min-h-[36px] text-xs" data-testid="supplier-new"><Plus size={12} />Nouveau</button></div>
          <table className="dina-table"><thead><tr><th>Nom</th><th>Pays</th><th className="text-right">Solde</th><th></th></tr></thead>
            <tbody>{sups.map(s => <tr key={s.id} data-testid={`supplier-${s.id}`}>
              <td className="font-medium">{s.name}<div className="text-[11px] text-[#666]">{s.phone}</div></td>
              <td>{s.country}</td>
              <td className="text-right tabular">{fcfa(s.balance || 0)}</td>
              <td className="text-right whitespace-nowrap"><button onClick={() => setEditSup(s)} className="text-[#0021cc] mr-2"><Pencil size={13} /></button><button onClick={() => delSup(s.id)} className="text-[#c62828]"><Trash2 size={13} /></button></td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="dina-card-white p-5">
          <div className="flex justify-between items-center mb-3"><div className="font-semibold">Bons de commande ({pos.length})</div><button onClick={() => setWizard({})} className="dina-btn-primary !min-h-[36px] text-xs" data-testid="po-new"><Plus size={12} />Nouveau bon (4 étapes)</button></div>
          <table className="dina-table">
            <thead><tr><th>N°</th><th>Fournisseur</th><th>Date</th><th>Lignes</th><th>Statut</th><th className="text-right">Total</th><th></th></tr></thead>
            <tbody>{pos.map(p => (
              <tr key={p.id} data-testid={`po-${p.number}`}>
                <td className="font-mono text-xs">{p.number}</td>
                <td>{p.supplier_name}</td>
                <td className="text-[#666]">{dateFmt(p.created_at)}</td>
                <td className="text-xs text-[#666]">{(p.items || []).length}</td>
                <td><span className={`dina-chip capitalize ${p.status === "receptionne" ? "!text-[#1f8a4c] !border-[#1f8a4c]" : ""}`}>{p.status.replace("_", " ")}</span></td>
                <td className="text-right tabular font-semibold">{fcfa(p.total)}</td>
                <td className="text-right whitespace-nowrap">
                  {p.status !== "receptionne" && <button onClick={() => setReceive(p)} className="text-[#1f8a4c] mr-2" title="Réceptionner" data-testid={`po-receive-${p.number}`}><Package size={14} /></button>}
                  <button onClick={() => delPo(p.id)} className="text-[#c62828]"><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      {editSup && <SupplierForm initial={editSup.id ? editSup : null} onSave={saveSup} onClose={() => setEditSup(null)} />}
      {wizard && <PoWizard sups={sups} products={products} onSave={savePo} onClose={() => setWizard(null)} />}
      {receive && <ReceiveModal po={receive} onClose={() => setReceive(null)} onDone={receivePo} />}
      {labels && <LabelsPrintModal labels={labels} onClose={() => setLabels(null)} />}
    </div>
  );
}

function SupplierForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { name: "", country: "CI", phone: "", email: "", balance: 0, notes: "" });
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4"><div className="font-serif text-xl">{initial ? "Modifier" : "Nouveau"} fournisseur</div><button onClick={onClose}><X size={16} /></button></div>
        <div className="space-y-2.5 text-sm">
          <input className="dina-input" placeholder="Nom *" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} data-testid="sup-name" />
          <div className="grid grid-cols-2 gap-2">
            <select className="dina-input" value={f.country} onChange={e => setF({ ...f, country: e.target.value })}>{COUNTRIES.map(c => <option key={c}>{c}</option>)}</select>
            <input className="dina-input" placeholder="Téléphone" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
          </div>
          <input className="dina-input" placeholder="Email" value={f.email || ""} onChange={e => setF({ ...f, email: e.target.value })} />
          <input type="number" className="dina-input" placeholder="Solde dû (FCFA)" value={f.balance || 0} onChange={e => setF({ ...f, balance: +e.target.value })} />
          <textarea className="dina-input" rows={2} placeholder="Notes" value={f.notes || ""} onChange={e => setF({ ...f, notes: e.target.value })} />
        </div>
        <div className="flex gap-2 mt-4"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={() => onSave(f)} className="dina-btn-primary flex-1" data-testid="sup-save">Enregistrer</button></div>
      </div>
    </div>
  );
}

const STEPS = [
  { key: 1, label: "Fournisseur" },
  { key: 2, label: "Articles" },
  { key: 3, label: "Coûts annexes" },
  { key: 4, label: "Récap & création" },
];

function PoWizard({ sups, products, onSave, onClose }) {
  const [step, setStep] = useState(1);
  const [supplier, setSupplier] = useState(sups[0] || null);
  const [expected, setExpected] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState([]); // {product_id, product_name, sku, size, color, qty, unit_cost}
  const [extras, setExtras] = useState([]); // {label, amount}

  const baseTotal = useMemo(() => items.reduce((s, it) => s + (+it.qty || 0) * (+it.unit_cost || 0), 0), [items]);
  const extrasTotal = useMemo(() => extras.reduce((s, x) => s + (+x.amount || 0), 0), [extras]);
  const grandTotal = baseTotal + extrasTotal;
  const totalQty = items.reduce((s, it) => s + (+it.qty || 0), 0);

  const addItem = () => setItems([...items, { product_id: "", product_name: "", sku: "", size: "", color: "", qty: 1, unit_cost: 0 }]);
  const updateItem = (i, patch) => setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const pickProduct = (i, pid) => {
    const p = products.find(x => x.id === pid);
    if (!p) return;
    updateItem(i, { product_id: p.id, product_name: p.name, sku: p.sku, unit_cost: p.cost || 0, size: (p.sizes || [])[0] || "", color: (p.colors || [])[0] || "" });
  };

  const addExtra = () => setExtras([...extras, { label: "Fret", amount: 0 }]);
  const updateExtra = (i, patch) => setExtras(extras.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  const removeExtra = (i) => setExtras(extras.filter((_, idx) => idx !== i));

  const canNext = () => {
    if (step === 1) return !!supplier;
    if (step === 2) return items.length > 0 && items.every(it => it.product_id && it.qty > 0 && it.unit_cost >= 0);
    return true;
  };

  const submit = () => {
    if (!supplier) return;
    onSave({
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      items,
      extra_costs: extras,
      total: grandTotal,
      status: "en_attente",
      expected_at: expected || null,
      note,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div><div className="font-serif text-xl">Nouveau bon de commande</div><div className="text-xs text-[#666]">Étape {step} / 4 · landed cost calculé automatiquement</div></div>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        {/* Stepper */}
        <div className="flex items-center mb-5 overflow-x-auto">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center shrink-0">
              <div className={`w-7 h-7 rounded-full grid place-items-center text-xs font-semibold ${step >= s.key ? "bg-[#b02a2a] text-white" : "bg-[#ececec] dark:bg-[#2a2a2a] text-[#666]"}`}>{step > s.key ? <Check size={13} /> : s.key}</div>
              <span className={`ml-2 text-xs ${step >= s.key ? "font-semibold" : "text-[#666]"}`}>{s.label}</span>
              {i < STEPS.length - 1 && <div className={`w-10 h-[2px] mx-3 ${step > s.key ? "bg-[#b02a2a]" : "bg-[#ececec] dark:bg-[#2a2a2a]"}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <label className="text-xs uppercase font-semibold text-[#666]">Fournisseur</label>
            <select className="dina-input" value={supplier?.id || ""} onChange={e => setSupplier(sups.find(s => s.id === e.target.value) || null)} data-testid="wizard-supplier">
              <option value="">Sélectionner…</option>
              {sups.map(s => <option key={s.id} value={s.id}>{s.name} · {s.country}</option>)}
            </select>
            {supplier && <div className="p-3 bg-[#fff5f5] dark:bg-[#2a1818] rounded-lg text-sm"><div className="font-semibold">{supplier.name}</div><div className="text-xs text-[#666]">{supplier.phone} · {supplier.email || "—"}</div><div className="text-xs text-[#666]">Solde dû actuel : {fcfa(supplier.balance || 0)}</div></div>}
            <label className="text-xs uppercase font-semibold text-[#666]">Date de réception prévue (optionnel)</label>
            <input type="date" className="dina-input" value={expected} onChange={e => setExpected(e.target.value)} />
            <label className="text-xs uppercase font-semibold text-[#666]">Note</label>
            <textarea className="dina-input" rows={2} placeholder="Référence commande fournisseur, incoterms, délai, etc." value={note} onChange={e => setNote(e.target.value)} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center mb-2"><div className="text-xs uppercase font-semibold text-[#666]">Articles ({items.length})</div><button onClick={addItem} className="dina-btn-secondary !min-h-[32px] text-xs" data-testid="wizard-add-item"><Plus size={12} />Ajouter une ligne</button></div>
            {items.length === 0 && <div className="text-center text-sm text-[#666] py-8 border-2 border-dashed border-[#ececec] dark:border-[#2a2a2a] rounded-lg">Aucun article. Cliquez sur "Ajouter une ligne".</div>}
            {items.map((it, i) => {
              const prod = products.find(p => p.id === it.product_id);
              const sizes = prod?.sizes || [];
              const colors = prod?.colors || [];
              return (
                <div key={i} className="grid grid-cols-[2fr_90px_90px_80px_110px_28px] gap-2 items-end" data-testid={`wizard-item-${i}`}>
                  <div>
                    <label className="text-[10px] uppercase text-[#999]">Produit</label>
                    <select className="dina-input !py-1.5 text-xs" value={it.product_id} onChange={e => pickProduct(i, e.target.value)}>
                      <option value="">Sélectionner…</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-[#999]">Taille</label>
                    <select className="dina-input !py-1.5 text-xs" value={it.size} onChange={e => updateItem(i, { size: e.target.value })}>
                      {sizes.length === 0 && <option value="">—</option>}
                      {sizes.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-[#999]">Couleur</label>
                    <select className="dina-input !py-1.5 text-xs" value={it.color} onChange={e => updateItem(i, { color: e.target.value })}>
                      {colors.length === 0 && <option value="">—</option>}
                      {colors.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-[#999]">Qté</label>
                    <input type="number" min={1} className="dina-input !py-1.5 text-xs tabular text-right" value={it.qty} onChange={e => updateItem(i, { qty: +e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-[#999]">Coût unitaire</label>
                    <input type="number" className="dina-input !py-1.5 text-xs tabular text-right" value={it.unit_cost} onChange={e => updateItem(i, { unit_cost: +e.target.value })} />
                  </div>
                  <button onClick={() => removeItem(i)} className="text-[#c62828] pb-2"><Trash2 size={14} /></button>
                </div>
              );
            })}
            <div className="pt-3 flex justify-between border-t border-[#ececec] dark:border-[#2a2a2a] text-sm">
              <div>{totalQty} unité(s)</div>
              <div className="tabular font-semibold">Sous-total : {fcfa(baseTotal)}</div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center mb-2"><div className="text-xs uppercase font-semibold text-[#666]">Coûts annexes · fret, douane, taxes, commission</div><button onClick={addExtra} className="dina-btn-secondary !min-h-[32px] text-xs" data-testid="wizard-add-extra"><Plus size={12} />Ajouter un coût</button></div>
            {extras.length === 0 && <div className="text-center text-sm text-[#666] py-6 border-2 border-dashed border-[#ececec] dark:border-[#2a2a2a] rounded-lg">Aucun coût annexe. Ils seront répartis proportionnellement sur chaque article pour calculer le landed cost.</div>}
            {extras.map((x, i) => (
              <div key={i} className="grid grid-cols-[2fr_1fr_28px] gap-2 items-end">
                <input className="dina-input !py-1.5 text-sm" placeholder="Libellé (ex: Fret Turquie, Douane, Commission)" value={x.label} onChange={e => updateExtra(i, { label: e.target.value })} />
                <input type="number" className="dina-input !py-1.5 text-sm tabular text-right" placeholder="Montant FCFA" value={x.amount} onChange={e => updateExtra(i, { amount: +e.target.value })} />
                <button onClick={() => removeExtra(i)} className="text-[#c62828] pb-2"><Trash2 size={14} /></button>
              </div>
            ))}
            <div className="pt-3 border-t border-[#ececec] dark:border-[#2a2a2a] grid grid-cols-3 gap-2 text-sm">
              <div className="p-3 bg-[#fff5f5] dark:bg-[#2a1818] rounded"><div className="text-[10px] uppercase text-[#666]">Articles</div><div className="font-serif tabular text-base">{fcfa(baseTotal)}</div></div>
              <div className="p-3 bg-[#fff5f5] dark:bg-[#2a1818] rounded"><div className="text-[10px] uppercase text-[#666]">Coûts annexes</div><div className="font-serif tabular text-base text-[#e4991e]">{fcfa(extrasTotal)}</div></div>
              <div className="p-3 bg-[#fff5f5] dark:bg-[#2a1818] rounded"><div className="text-[10px] uppercase text-[#666]">Landed cost total</div><div className="font-serif tabular text-base text-[#b02a2a]">{fcfa(grandTotal)}</div></div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-[#fff5f5] dark:bg-[#2a1818] rounded"><div className="text-[10px] uppercase text-[#666]">Fournisseur</div><div className="font-semibold">{supplier?.name}</div></div>
            <table className="dina-table">
              <thead><tr><th>Produit</th><th>Taille</th><th>Couleur</th><th className="text-right">Qté</th><th className="text-right">Coût u.</th><th className="text-right">Landed u.</th><th className="text-right">Total</th></tr></thead>
              <tbody>{items.map((it, i) => {
                const share = (it.qty * it.unit_cost) / Math.max(baseTotal, 1);
                const landed_extra = (extrasTotal * share) / Math.max(it.qty, 1);
                const landed_u = Math.round(it.unit_cost + landed_extra);
                return (
                  <tr key={i}>
                    <td className="font-medium">{it.product_name}</td>
                    <td>{it.size}</td><td>{it.color}</td>
                    <td className="text-right tabular">{it.qty}</td>
                    <td className="text-right tabular">{fcfa(it.unit_cost)}</td>
                    <td className="text-right tabular text-[#b02a2a] font-semibold">{fcfa(landed_u)}</td>
                    <td className="text-right tabular">{fcfa(it.qty * landed_u)}</td>
                  </tr>
                );
              })}</tbody>
            </table>
            <div className="flex justify-end text-base pt-2 border-t"><strong className="tabular">Total : {fcfa(grandTotal)}</strong></div>
          </div>
        )}

        <div className="flex gap-2 mt-5 pt-3 border-t border-[#ececec] dark:border-[#2a2a2a]">
          <button onClick={onClose} className="dina-btn-secondary">Annuler</button>
          {step > 1 && <button onClick={() => setStep(step - 1)} className="dina-btn-secondary"><ChevronLeft size={14} />Précédent</button>}
          <div className="flex-1" />
          {step < 4 && <button onClick={() => canNext() && setStep(step + 1)} disabled={!canNext()} className="dina-btn-primary" data-testid="wizard-next">Suivant<ChevronRight size={14} /></button>}
          {step === 4 && <button onClick={submit} className="dina-btn-primary" data-testid="wizard-create">Créer le bon de commande</button>}
        </div>
      </div>
    </div>
  );
}

function ReceiveModal({ po, onClose, onDone }) {
  const [items, setItems] = useState((po.items || []).map(it => ({ ...it, qty_received: it.qty })));
  const [extras, setExtras] = useState(po.extra_costs || []);
  const [note, setNote] = useState("");

  const confirm = () => {
    const payload = items.map(it => ({ ...it, qty: +it.qty_received || 0 })).filter(it => it.qty > 0);
    if (!payload.length) return toast.error("Rien à réceptionner");
    onDone(po, payload, extras, note);
  };

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4"><div><div className="font-serif text-xl">Réceptionner {po.number}</div><div className="text-xs text-[#666]">{po.supplier_name} · ajustez les quantités reçues puis validez</div></div><button onClick={onClose}><X size={18} /></button></div>
        {items.length === 0 && <div className="text-sm text-[#666]">Aucun article sur ce bon.</div>}
        <table className="dina-table mb-4"><thead><tr><th>Produit</th><th>Variante</th><th className="text-right">Commandé</th><th className="text-right">Reçu</th><th className="text-right">Coût u.</th></tr></thead><tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td className="font-medium">{it.product_name}</td>
              <td className="text-xs text-[#666]">{it.size} · {it.color}</td>
              <td className="text-right tabular">{it.qty}</td>
              <td className="text-right"><input type="number" min={0} className="dina-input !py-1 tabular text-right w-20" value={it.qty_received} onChange={e => setItems(items.map((x, idx) => idx === i ? { ...x, qty_received: +e.target.value } : x))} data-testid={`recv-qty-${i}`} /></td>
              <td className="text-right tabular">{fcfa(it.unit_cost)}</td>
            </tr>
          ))}
        </tbody></table>
        <label className="text-xs uppercase font-semibold text-[#666]">Note de réception</label>
        <textarea className="dina-input mb-3" rows={2} placeholder="Casse, article manquant, qualité, etc." value={note} onChange={e => setNote(e.target.value)} />
        <div className="flex gap-2"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={confirm} className="dina-btn-primary flex-1" data-testid="recv-confirm"><Package size={14} />Valider la réception & générer les QR</button></div>
      </div>
    </div>
  );
}

function LabelsPrintModal({ labels, onClose }) {
  const print = () => window.print();
  return (
    <div className="fixed inset-0 bg-black/60 z-50 p-0 md:p-4 overflow-y-auto print:bg-white print:inset-auto">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-5xl mx-auto my-4 print:p-0 print:my-0 print:shadow-none print:bg-white">
        <div className="flex justify-between items-start mb-4 print:hidden">
          <div><div className="font-serif text-xl">Étiquettes QR · {labels.length} unité{labels.length > 1 ? "s" : ""}</div><div className="text-xs text-[#666]">Planche A4 — 24 par page (70×37mm)</div></div>
          <div className="flex gap-2">
            <button onClick={print} className="dina-btn-primary" data-testid="print-qr-labels"><Printer size={14} />Imprimer</button>
            <button onClick={onClose} className="dina-btn-secondary"><X size={14} />Fermer</button>
          </div>
        </div>
        <div className="qr-sheet grid grid-cols-3 gap-x-0 gap-y-0 bg-white text-black">
          {labels.map((l, i) => (
            <div key={i} className="qr-cell border border-[#ddd] p-2 flex gap-2 items-center" style={{ height: "37mm" }}>
              <img src={QR_URL(l.qr, 80)} alt="QR" className="w-[22mm] h-[22mm] shrink-0" />
              <div className="flex-1 min-w-0 text-[9px] leading-tight">
                <div className="font-semibold truncate text-[10px]">{l.product_name}</div>
                <div className="truncate">SKU: <strong>{l.sku}</strong></div>
                <div>Taille: <strong>{l.size || "—"}</strong></div>
                <div>Couleur: <strong>{l.color || "—"}</strong></div>
                <div className="text-[#666]">PA: {fcfa(l.unit_cost)}</div>
                <div className="text-[#666]">{l.po_number}</div>
              </div>
            </div>
          ))}
        </div>
        <style>{`
          @media print {
            body > *:not(.fixed) { display: none !important; }
            .fixed.inset-0 { position: static !important; background: white !important; padding: 0 !important; }
            .qr-sheet { grid-template-columns: repeat(3, 70mm) !important; }
            .qr-cell { page-break-inside: avoid; }
            @page { size: A4; margin: 10mm; }
          }
        `}</style>
      </div>
    </div>
  );
}
