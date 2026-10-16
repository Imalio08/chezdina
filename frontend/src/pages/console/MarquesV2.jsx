import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, ChevronLeft, Package, TrendingUp, Percent, Trophy } from "lucide-react";
import ImageUpload from "@/components/shared/ImageUpload";
import ViewToggle, { useStoredView } from "@/components/shared/ViewToggle";

export default function MarquesV2({ embedded }) {
  const [brands, setBrands] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useStoredView("marques", "grid");
  const [detail, setDetail] = useState(null); // brand id

  const load = async () => {
    const [b, k] = await Promise.all([
      api.get("/brands/full").catch(() => ({ data: [] })),
      api.get("/brands/kpis").catch(() => ({ data: null })),
    ]);
    setBrands(b.data || []); setKpis(k.data);
  };
  useEffect(() => { load(); }, []);

  const save = async (f) => {
    try {
      if (f.id && brands.find(b => b.id === f.id)) await api.patch(`/brands/${f.id}`, f);
      else await api.post("/brands", f);
      toast.success("Enregistré"); setOpen(false); setEdit(null); load();
    } catch { toast.error("Erreur"); }
  };
  const del = async (id, name) => {
    if (!confirm(`Supprimer la marque "${name}" ? Les produits conservent leur marque.`)) return;
    try { await api.delete(`/brands/${id}`); toast.success("Supprimée"); load(); }
    catch { toast.error("Erreur"); }
  };

  if (detail) return <BrandDetail bid={detail} onBack={() => { setDetail(null); load(); }} onEdit={(b) => { setEdit(b); setOpen(true); setDetail(null); }} />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>{!embedded && <h1 className="font-serif text-3xl">Marques</h1>}<p className="text-sm text-[#666]">{brands.length} marques · suivi du chiffre d'affaires sur 30 jours et de la marge</p></div>
        <button onClick={() => { setEdit(null); setOpen(true); }} className="dina-btn-primary !min-h-[40px]" data-testid="marque-new"><Plus size={14} />Nouvelle marque</button>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <KpiMini label="Marques" v={kpis.total} c="#5867fd" i={Package} />
          <KpiMini label="Actives" v={kpis.actives} c="#1f8a4c" i={Package} />
          <KpiMini label="Produits / marque" v={kpis.avg_products} c="#e4991e" i={Package} />
          <KpiMini label="Meilleure vente" v={kpis.top_brand || "—"} c="#b02a2a" i={Trophy} sub={fcfa(kpis.top_brand_ca)} />
          <KpiMini label="Marge moyenne" v={`${kpis.avg_margin}%`} c="#1f8a4c" i={Percent} />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs text-[#666]">{brands.length} marque(s) affichée(s)</div>
        <ViewToggle value={view} onChange={setView} options={["grid", "table"]} tabKey="marques" />
      </div>

      {view === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {brands.length === 0 ? <div className="col-span-full dina-card-white py-12 text-center text-sm text-[#666]">Aucune marque</div> :
            brands.map(b => (
              <button key={b.id} onClick={() => setDetail(b.id)} className="dina-card-white p-4 text-left hover:ring-2 hover:ring-[#fde8e8] transition" data-testid={`brand-card-${b.name}`}>
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-14 h-14 rounded-lg bg-[#fff5f5] dark:bg-[#2a1818] overflow-hidden grid place-items-center shrink-0">
                    {b.logo ? <img src={b.logo} alt="" className="w-full h-full object-contain" /> : <span className="font-serif text-xl text-[#b02a2a] font-bold">{(b.name || "?")[0]}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{b.name}</div>
                    <div className="text-[11px] text-[#666]">{b.product_count || 0} produits</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div><div className="text-[#999]">Chiffre d'affaires 30 jours</div><div className="font-semibold tabular">{fcfa(b.ca_30d)}</div></div>
                  <div><div className="text-[#999]">Marge moyenne</div><div className="font-semibold tabular text-[#1f8a4c]">{b.avg_margin}%</div></div>
                </div>
              </button>
            ))}
        </div>
      ) : (
        <div className="dina-card-white overflow-x-auto">
          <table className="dina-table">
            <thead><tr><th>Logo</th><th>Marque</th><th className="text-right">Produits</th><th className="text-right">Chiffre d'affaires 30 jours</th><th className="text-right">Marge</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              {brands.map(b => (
                <tr key={b.id} data-testid={`brand-row-${b.name}`}>
                  <td><div className="w-9 h-9 rounded bg-[#fff5f5] overflow-hidden grid place-items-center">{b.logo ? <img src={b.logo} alt="" className="w-full h-full object-contain" /> : <span className="font-serif text-sm text-[#b02a2a] font-bold">{(b.name || "?")[0]}</span>}</div></td>
                  <td><button onClick={() => setDetail(b.id)} className="font-medium hover:text-[#b02a2a]">{b.name}</button></td>
                  <td className="text-right tabular">{b.product_count || 0}</td>
                  <td className="text-right tabular font-semibold">{fcfa(b.ca_30d)}</td>
                  <td className="text-right tabular"><span className={b.avg_margin >= 40 ? "text-[#1f8a4c]" : b.avg_margin < 20 ? "text-[#c62828]" : "text-[#e4991e]"}>{b.avg_margin}%</span></td>
                  <td><span className={`dina-chip text-[10px] ${b.status === "inactive" ? "" : "!text-[#1f8a4c] !border-[#1f8a4c]"}`}>{b.status === "inactive" ? "Inactive" : "Active"}</span></td>
                  <td className="text-right whitespace-nowrap">
                    <button onClick={() => { setEdit(b); setOpen(true); }} className="text-[#0021cc] mr-2"><Pencil size={13} /></button>
                    <button onClick={() => del(b.id, b.name)} className="text-[#c62828]"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <BrandForm initial={edit} onSave={save} onClose={() => { setOpen(false); setEdit(null); }} />}
    </div>
  );
}

function KpiMini({ label, v, c, i: Icon, sub }) {
  return (
    <div className="dina-card-white p-3 min-w-0" data-testid={`kpi-${label.toLowerCase().replace(/\s/g, '-').replace(/\./g, '').replace(/\//g, '-')}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon size={11} style={{ color: c }} />}
        <div className="text-[10px] uppercase tracking-wide text-[#666] font-semibold truncate">{label}</div>
      </div>
      <div className="font-serif tabular leading-none text-xl truncate" style={{ color: c }}>{v}</div>
      {sub && <div className="text-[10px] text-[#999] tabular mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

function BrandForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { name: "", note: "", logo: "", status: "active" });
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="brand-form">
        <div className="flex items-center justify-between mb-4">
          <div className="font-serif text-xl">{initial?.id ? "Modifier" : "Nouvelle"} marque</div>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input className="dina-input" placeholder="Nom de la marque *" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} data-testid="brand-name" />
          <div>
            <div className="text-[10px] uppercase font-semibold text-[#666] mb-1.5">Logo</div>
            <ImageUpload value={f.logo ? [f.logo] : []} onChange={imgs => setF({ ...f, logo: imgs[0] || "" })} single max={1} maxKB={200} testid="brand-logo" />
          </div>
          <select className="dina-input" value={f.status || "active"} onChange={e => setF({ ...f, status: e.target.value })} data-testid="brand-status">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <textarea className="dina-input" rows={3} placeholder="Note / description interne" value={f.note || ""} onChange={e => setF({ ...f, note: e.target.value })} data-testid="brand-note" />
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button>
          <button onClick={() => onSave(f)} disabled={!f.name} className="dina-btn-primary flex-1" data-testid="brand-save">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function BrandDetail({ bid, onBack, onEdit }) {
  const [b, setB] = useState(null);
  useEffect(() => { api.get(`/brands/${bid}`).then(r => setB(r.data)).catch(() => toast.error("Erreur")); }, [bid]);
  if (!b) return <div className="text-center text-sm text-[#666] py-12">Chargement…</div>;
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm text-[#666] inline-flex items-center gap-1 hover:text-[#b02a2a]" data-testid="brand-back"><ChevronLeft size={13} />Retour</button>
      <div className="dina-card-white p-5 flex items-center gap-4">
        <div className="w-20 h-20 rounded-xl bg-[#fff5f5] overflow-hidden grid place-items-center shrink-0">
          {b.logo ? <img src={b.logo} alt="" className="w-full h-full object-contain" /> : <span className="font-serif text-3xl text-[#b02a2a] font-bold">{(b.name || "?")[0]}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-3xl">{b.name}</h1>
          {b.note && <div className="text-xs text-[#666] italic mt-1">« {b.note} »</div>}
        </div>
        <button onClick={() => onEdit(b)} className="dina-btn-secondary !min-h-[36px]" data-testid="brand-detail-edit"><Pencil size={13} />Modifier</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiMini label="Produits" v={b.stats.product_count} c="#5867fd" i={Package} />
        <KpiMini label="Chiffre d'affaires 30 jours" v={fcfa(b.stats.ca_30d)} c="#b02a2a" i={TrendingUp} />
        <KpiMini label="Marge moyenne" v={`${b.stats.avg_margin}%`} c="#1f8a4c" i={Percent} />
        <KpiMini label="Valeur stock" v={fcfa(b.stats.stock_value)} c="#e4991e" />
      </div>

      <div className="dina-card-white p-5">
        <div className="font-semibold mb-3">Produits de la marque ({(b.products || []).length})</div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {b.products.map(p => (
            <div key={p.id} className="dina-card-white overflow-hidden" data-testid={`brand-prod-${p.sku}`}>
              <div className="aspect-square bg-[#fff5f5]"><img src={p.image || p.images?.[0]} alt="" className="w-full h-full object-cover" /></div>
              <div className="p-2"><div className="text-[11px] font-medium line-clamp-2 leading-tight min-h-[2.2em]">{p.name}</div><div className="text-xs tabular font-bold text-[#b02a2a] mt-1">{fcfa(p.price)}</div></div>
            </div>
          ))}
          {(b.products || []).length === 0 && <div className="col-span-full text-sm text-[#666] py-6 text-center">Aucun produit pour cette marque</div>}
        </div>
      </div>
    </div>
  );
}
