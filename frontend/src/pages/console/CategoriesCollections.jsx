import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa, dateFmt } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, ChevronRight, ChevronDown, Eye, EyeOff, Layers, FolderTree, Package, Image as ImageIcon, Trophy, Calendar } from "lucide-react";
import ImageUpload from "@/components/shared/ImageUpload";
import { useSearchParams } from "react-router-dom";
import MarquesV2 from "@/pages/console/MarquesV2";

const CC_TABS = { cats: "Catégories", cols: "Collections", marques: "Marques" };

export default function CategoriesCollections() {
  const [sp, setSp] = useSearchParams();
  const tab = CC_TABS[sp.get("tab")] ? sp.get("tab") : "cats";
  const setTab = (t) => setSp({ tab: t }, { replace: true });
  return (
    <div className="space-y-5">
      <div><h1 className="font-serif text-3xl">Catégories & marques</h1><p className="text-sm text-[#666]">Catégories hiérarchiques, collections mises en avant et marques du catalogue</p></div>
      <div className="flex gap-1 bg-[#f5f5f5] dark:bg-[#1a1a1a] p-1 rounded-lg w-fit">
        <button onClick={() => setTab("cats")} className={`px-4 py-1.5 text-sm rounded-md flex items-center gap-1 ${tab === "cats" ? "bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold" : ""}`} data-testid="cc-tab-cats"><FolderTree size={11} />Catégories</button>
        <button onClick={() => setTab("cols")} className={`px-4 py-1.5 text-sm rounded-md flex items-center gap-1 ${tab === "cols" ? "bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold" : ""}`} data-testid="cc-tab-cols"><Layers size={11} />Collections</button>
        <button onClick={() => setTab("marques")} className={`px-4 py-1.5 text-sm rounded-md flex items-center gap-1 ${tab === "marques" ? "bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold" : ""}`} data-testid="cc-tab-marques"><Package size={11} />Marques</button>
      </div>
      {tab === "cats" ? <CategoriesTab /> : tab === "cols" ? <CollectionsTab /> : <MarquesV2 embedded />}
    </div>
  );
}

function KpiMini({ label, v, c, i: Icon, sub }) {
  return (
    <div className="dina-card-white p-3 min-w-0" data-testid={`kpi-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex items-center gap-1.5 mb-1.5">{Icon && <Icon size={11} style={{ color: c }} />}<div className="text-[10px] uppercase tracking-wide text-[#666] font-semibold truncate">{label}</div></div>
      <div className="font-serif tabular leading-none text-xl truncate" style={{ color: c }}>{v}</div>
      {sub && <div className="text-[10px] text-[#999] mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

/* ---------------- CATEGORIES ---------------- */
function CategoriesTab() {
  const [tree, setTree] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const [t, k] = await Promise.all([
      api.get("/categories/tree").catch(() => ({ data: [] })),
      api.get("/categories/kpis").catch(() => ({ data: null })),
    ]);
    setTree(t.data || []); setKpis(k.data);
  };
  useEffect(() => { load(); }, []);

  const save = async (f) => {
    try {
      if (f.id && !f._isDerived) await api.patch(`/categories/${f.id}`, f);
      else await api.post("/categories", f);
      toast.success("Enregistré"); setOpen(false); setEdit(null); load();
    } catch { toast.error("Erreur"); }
  };
  const del = async (c) => {
    if (!confirm(`Supprimer "${c.name}" ?`)) return;
    try { await api.delete(`/categories/${c.id}`); toast.success("Supprimée"); load(); }
    catch { toast.error("Erreur"); }
  };
  const moveOrder = async (c, delta) => {
    const newOrder = Math.max(0, (c.order || 0) + delta);
    try { await api.patch(`/categories/${c.id}`, { ...c, order: newOrder }); load(); } catch {}
  };
  const toggleVisible = async (c) => {
    try { await api.patch(`/categories/${c.id}`, { ...c, visible: !c.visible }); load(); } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-[#666]">{tree.length} catégorie(s) racine · drag ↑↓ pour réordonner</div>
        <button onClick={() => { setEdit(null); setOpen(true); }} className="dina-btn-primary !min-h-[36px]" data-testid="cat-new"><Plus size={13} />Nouvelle catégorie</button>
      </div>

      {kpis && (
        <div className="grid grid-cols-3 gap-2">
          <KpiMini label="Catégories" v={kpis.total} c="#5867fd" i={FolderTree} />
          <KpiMini label="Sous-catégories" v={kpis.sub} c="#e4991e" i={Layers} />
          <KpiMini label="Plus vendue" v={kpis.top || "—"} c="#b02a2a" i={Trophy} sub={fcfa(kpis.top_ca)} />
        </div>
      )}

      <div className="dina-card-white p-3">
        {tree.length === 0 ? <div className="text-sm text-[#666] text-center py-8">Aucune catégorie. Créez-en une.</div> :
          <div className="space-y-1">
            {flattenTree(tree).map(({ c, depth }) => <CatRow key={c.id} c={c} depth={depth} onEdit={(x) => { setEdit(x); setOpen(true); }} onDel={del} onToggle={toggleVisible} onMove={moveOrder} onAddChild={(parent) => { setEdit({ parent_id: parent.id, parent_name: parent.name }); setOpen(true); }} />)}
          </div>}
      </div>

      {open && <CatForm initial={edit} roots={tree} onSave={save} onClose={() => { setOpen(false); setEdit(null); }} />}
    </div>
  );
}

function CatRow({ c, depth, onEdit, onDel, onToggle, onMove, onAddChild }) {
  const hasKids = (c.children || []).length > 0;
  return (
    <div className="flex items-center gap-2 p-2 rounded hover:bg-[#fafafa] dark:hover:bg-[#141414]" style={{ paddingLeft: 8 + depth * 20 }} data-testid={`cat-row-${c.name}`}>
      <span className="w-[14px] text-[#999] text-xs">{hasKids ? "▸" : ""}</span>
      <div className="w-9 h-9 rounded bg-[#fff5f5] overflow-hidden grid place-items-center shrink-0">{c.image ? <img src={c.image} alt="" className="w-full h-full object-cover" /> : <FolderTree size={14} className="text-[#b02a2a]" />}</div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{c.name}</div>
        <div className="text-[11px] text-[#666]">{c.product_count || 0} produits</div>
      </div>
      <button onClick={() => onMove(c, -1)} className="text-[#999] text-xs">↑</button>
      <button onClick={() => onMove(c, 1)} className="text-[#999] text-xs">↓</button>
      <button onClick={() => onToggle(c)} className={c.visible === false ? "text-[#999]" : "text-[#1f8a4c]"} title={c.visible === false ? "Masquée" : "Visible"} data-testid={`cat-visible-${c.name}`}>{c.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}</button>
      <button onClick={() => onAddChild(c)} className="text-[#0021cc] text-xs" title="Ajouter une sous-catégorie" data-testid={`cat-add-sub-${c.name}`}><Plus size={13} /></button>
      <button onClick={() => onEdit(c)} className="text-[#0021cc]" data-testid={`cat-edit-${c.name}`}><Pencil size={12} /></button>
      <button onClick={() => onDel(c)} className="text-[#c62828]" data-testid={`cat-del-${c.name}`}><Trash2 size={12} /></button>
    </div>
  );
}

function flattenTree(nodes, depth = 0, out = []) {
  for (const n of nodes || []) {
    out.push({ c: n, depth });
    if ((n.children || []).length) flattenTree(n.children, depth + 1, out);
  }
  return out;
}

function CatForm({ initial, roots, onSave, onClose }) {
  const [f, setF] = useState(initial || { name: "", parent_id: null, image: "", order: 0, visible: true, note: "" });
  const flatRoots = roots.filter(r => r.id !== f.id);
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="cat-form">
        <div className="flex items-center justify-between mb-4">
          <div className="font-serif text-xl">{initial?.id ? "Modifier" : "Nouvelle"} catégorie{initial?.parent_name ? ` (sous ${initial.parent_name})` : ""}</div>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input className="dina-input" placeholder="Nom *" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} data-testid="cat-name" />
          <div>
            <label className="text-[10px] uppercase font-semibold text-[#666]">Parent (optionnel)</label>
            <select className="dina-input mt-1" value={f.parent_id || ""} onChange={e => setF({ ...f, parent_id: e.target.value || null })} data-testid="cat-parent">
              <option value="">Racine (aucune)</option>
              {flatRoots.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-semibold text-[#666] mb-1 block">Image</label>
            <ImageUpload value={f.image ? [f.image] : []} onChange={imgs => setF({ ...f, image: imgs[0] || "" })} single max={1} maxKB={300} testid="cat-image" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] uppercase font-semibold text-[#666]">Ordre</label><input type="number" className="dina-input tabular" value={f.order || 0} onChange={e => setF({ ...f, order: +e.target.value || 0 })} /></div>
            <label className="flex items-center gap-2 text-sm pt-5"><input type="checkbox" checked={f.visible !== false} onChange={e => setF({ ...f, visible: e.target.checked })} className="accent-[#b02a2a]" data-testid="cat-visible-input" />Visible sur le site</label>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button>
          <button onClick={() => onSave(f)} disabled={!f.name} className="dina-btn-primary flex-1" data-testid="cat-save">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- COLLECTIONS ---------------- */
function CollectionsTab() {
  const [cols, setCols] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [products, setProducts] = useState([]);
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const [c, k, p] = await Promise.all([
      api.get("/collections").catch(() => ({ data: [] })),
      api.get("/collections/kpis").catch(() => ({ data: null })),
      api.get("/products").catch(() => ({ data: [] })),
    ]);
    setCols(c.data || []); setKpis(k.data); setProducts(p.data || []);
  };
  useEffect(() => { load(); }, []);

  const save = async (f) => {
    try {
      if (f.id) await api.patch(`/collections/${f.id}`, f);
      else await api.post("/collections", f);
      toast.success("Enregistrée"); setOpen(false); setEdit(null); load();
    } catch { toast.error("Erreur"); }
  };
  const del = async (c) => {
    if (!confirm(`Supprimer "${c.name}" ?`)) return;
    try { await api.delete(`/collections/${c.id}`); toast.success("Supprimée"); load(); } catch { toast.error("Erreur"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-[#666]">{cols.length} collection(s) · manuelles ou automatiques</div>
        <button onClick={() => { setEdit(null); setOpen(true); }} className="dina-btn-primary !min-h-[36px]" data-testid="col-new"><Plus size={13} />Nouvelle collection</button>
      </div>

      {kpis && (
        <div className="grid grid-cols-3 gap-2">
          <KpiMini label="Collections" v={kpis.total} c="#5867fd" i={Layers} />
          <KpiMini label="Actives" v={kpis.actives} c="#1f8a4c" i={Eye} />
          <KpiMini label="Produits inclus" v={kpis.products} c="#b02a2a" i={Package} />
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {cols.length === 0 ? <div className="col-span-full dina-card-white py-12 text-center text-sm text-[#666]">Aucune collection</div> :
          cols.map(c => (
            <div key={c.id} className="dina-card-white overflow-hidden" data-testid={`col-card-${c.name}`}>
              <div className="aspect-[16/8] bg-[#fff5f5] relative">
                {c.banner ? <img src={c.banner} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-[#ccc]"><ImageIcon size={28} /></div>}
                {c.visible === false && <span className="absolute top-2 left-2 dina-chip !text-[10px] bg-black/70 text-white border-none">Masquée</span>}
                <span className="absolute top-2 right-2 dina-chip !text-[10px] !bg-white">{c.kind === "auto" ? "Auto" : "Manuelle"}</span>
              </div>
              <div className="p-3">
                <div className="font-semibold truncate">{c.name}</div>
                <div className="text-[11px] text-[#666] flex items-center gap-1">{c.product_count} produits{c.starts_at && <> · <Calendar size={9} />du {dateFmt(c.starts_at)}</>}</div>
                {c.description && <div className="text-[11px] text-[#999] italic mt-1 line-clamp-2">« {c.description} »</div>}
                <div className="flex gap-2 mt-2">
                  <button onClick={() => { setEdit(c); setOpen(true); }} className="dina-btn-secondary flex-1 !min-h-[32px] text-xs"><Pencil size={11} />Modifier</button>
                  <button onClick={() => del(c)} className="dina-btn-secondary !min-h-[32px] text-xs !text-[#c62828]"><Trash2 size={11} /></button>
                </div>
              </div>
            </div>
          ))}
      </div>

      {open && <ColForm initial={edit} products={products} onSave={save} onClose={() => { setOpen(false); setEdit(null); }} />}
    </div>
  );
}

function ColForm({ initial, products, onSave, onClose }) {
  const [f, setF] = useState(initial || { name: "", kind: "manual", product_ids: [], rules: {}, banner: "", description: "", starts_at: "", ends_at: "", visible: true });
  const togglePid = (pid) => setF({ ...f, product_ids: (f.product_ids || []).includes(pid) ? f.product_ids.filter(x => x !== pid) : [...(f.product_ids || []), pid] });
  const brands = [...new Set(products.map(p => p.brand).filter(Boolean))].sort();
  const cats = [...new Set(products.map(p => p.category).filter(Boolean))].sort();

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="col-form">
        <div className="flex items-center justify-between mb-4">
          <div className="font-serif text-xl">{initial?.id ? "Modifier" : "Nouvelle"} collection</div>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input className="dina-input" placeholder="Nom de la collection *" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} data-testid="col-name" />
          <textarea className="dina-input" rows={2} placeholder="Description" value={f.description || ""} onChange={e => setF({ ...f, description: e.target.value })} />
          <div>
            <label className="text-[10px] uppercase font-semibold text-[#666] mb-1 block">Bannière</label>
            <ImageUpload value={f.banner ? [f.banner] : []} onChange={imgs => setF({ ...f, banner: imgs[0] || "" })} single max={1} maxKB={500} testid="col-banner" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] uppercase font-semibold text-[#666]">Début</label><input type="date" className="dina-input" value={f.starts_at || ""} onChange={e => setF({ ...f, starts_at: e.target.value })} data-testid="col-starts" /></div>
            <div><label className="text-[10px] uppercase font-semibold text-[#666]">Fin</label><input type="date" className="dina-input" value={f.ends_at || ""} onChange={e => setF({ ...f, ends_at: e.target.value })} data-testid="col-ends" /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.visible !== false} onChange={e => setF({ ...f, visible: e.target.checked })} className="accent-[#b02a2a]" data-testid="col-visible" />Visible sur le site</label>

          <div className="flex gap-1 bg-[#f5f5f5] dark:bg-[#1a1a1a] p-1 rounded-lg w-fit">
            <button onClick={() => setF({ ...f, kind: "manual" })} className={`px-3 py-1 text-xs rounded ${f.kind === "manual" ? "bg-white dark:bg-[#2a2a2a] font-semibold" : ""}`} data-testid="col-kind-manual">Manuelle</button>
            <button onClick={() => setF({ ...f, kind: "auto" })} className={`px-3 py-1 text-xs rounded ${f.kind === "auto" ? "bg-white dark:bg-[#2a2a2a] font-semibold" : ""}`} data-testid="col-kind-auto">Automatique</button>
          </div>

          {f.kind === "manual" ? (
            <div>
              <label className="text-[10px] uppercase font-semibold text-[#666]">Produits ({(f.product_ids || []).length} sélectionnés)</label>
              <div className="max-h-56 overflow-y-auto border border-[#ececec] dark:border-[#2a2a2a] rounded-lg p-2 space-y-1 mt-1">
                {products.map(p => (
                  <label key={p.id} className="flex items-center gap-2 text-xs p-1 hover:bg-[#fafafa] dark:hover:bg-[#141414] rounded cursor-pointer" data-testid={`col-prod-${p.sku}`}>
                    <input type="checkbox" checked={(f.product_ids || []).includes(p.id)} onChange={() => togglePid(p.id)} className="accent-[#b02a2a]" />
                    <img src={p.image || p.images?.[0]} alt="" className="w-6 h-6 rounded object-cover" />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-[#666]">{p.brand}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-[#666]">Règles — tous les produits qui respectent ces conditions seront inclus automatiquement.</div>
              <div className="grid grid-cols-2 gap-2">
                <select className="dina-input text-sm" value={f.rules?.category || ""} onChange={e => setF({ ...f, rules: { ...f.rules, category: e.target.value } })} data-testid="col-rule-cat"><option value="">— Toute catégorie —</option>{cats.map(c => <option key={c}>{c}</option>)}</select>
                <select className="dina-input text-sm" value={f.rules?.brand || ""} onChange={e => setF({ ...f, rules: { ...f.rules, brand: e.target.value } })} data-testid="col-rule-brand"><option value="">— Toute marque —</option>{brands.map(c => <option key={c}>{c}</option>)}</select>
              </div>
              <input type="number" className="dina-input text-sm" placeholder="Prix max (FCFA)" value={f.rules?.price_max || ""} onChange={e => setF({ ...f, rules: { ...f.rules, price_max: +e.target.value || 0 } })} data-testid="col-rule-price" />
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button>
          <button onClick={() => onSave(f)} disabled={!f.name} className="dina-btn-primary flex-1" data-testid="col-save">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
