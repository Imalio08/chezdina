import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { fcfa, dateFmt } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, ChevronLeft, Building2, Phone, Mail, Globe, MessageCircle, Clock, DollarSign, Package, Lock } from "lucide-react";
import ImageUpload from "@/components/shared/ImageUpload";
import ViewToggle, { useStoredView } from "@/components/shared/ViewToggle";

const COUNTRIES = ["CI", "SN", "GH", "MA", "FR", "TR", "CN", "AE", "ES"];

export default function Suppliers() {
  const { user } = useAuth();
  const isOwner = user?.role === "admin";
  const [list, setList] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [view, setView] = useStoredView("suppliers", "grid");

  const load = async () => {
    const [a, b] = await Promise.all([
      api.get("/suppliers").catch(() => ({ data: [] })),
      api.get("/suppliers/kpis").catch(() => ({ data: null })),
    ]);
    setList(a.data || []); setKpis(b.data);
  };
  useEffect(() => { load(); }, []);

  const save = async (f) => {
    try {
      if (f.id) await api.patch(`/suppliers/${f.id}`, f);
      else await api.post("/suppliers", f);
      toast.success("Enregistré"); setOpen(false); setEdit(null); load();
    } catch { toast.error("Erreur"); }
  };
  const del = async (s) => {
    if (!confirm(`Supprimer "${s.name}" ?`)) return;
    try { await api.delete(`/suppliers/${s.id}`); toast.success("Supprimé"); load(); } catch { toast.error("Erreur"); }
  };

  if (detail) return <SupplierDetail sid={detail} onBack={() => { setDetail(null); load(); }} onEdit={(s) => { setEdit(s); setOpen(true); setDetail(null); }} />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Fournisseurs</h1><p className="text-sm text-[#666]">{list.length} fournisseur(s) · {isOwner ? "Vue propriétaire — infos complètes" : "Vue limitée — contacts et conditions masqués"}</p></div>
        {isOwner && <button onClick={() => { setEdit(null); setOpen(true); }} className="dina-btn-primary !min-h-[40px]" data-testid="sup-new"><Plus size={14} />Nouveau fournisseur</button>}
      </div>

      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <Kpi label="Fournisseurs" v={kpis.total} c="#5867fd" />
          <Kpi label="Actifs" v={kpis.actives} c="#1f8a4c" />
          <Kpi label="Acheté 30j" v={fcfa(kpis.purchased_30d)} c="#b02a2a" small />
          <Kpi label="Montant dû" v={fcfa(kpis.balance)} c="#c62828" small />
          <Kpi label="Délai moy." v={`${kpis.avg_lead_days}j`} c="#e4991e" />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs text-[#666]">{list.length} affiché(s)</div>
        <ViewToggle value={view} onChange={setView} options={["grid","table"]} tabKey="suppliers" />
      </div>

      {view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.length === 0 ? <div className="col-span-full dina-card-white py-12 text-center text-sm text-[#666]">Aucun fournisseur</div> :
            list.map(s => (
              <div key={s.id} className="dina-card-white p-4" data-testid={`sup-card-${s.name}`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-lg bg-[#fff5f5] overflow-hidden grid place-items-center shrink-0">
                    {s.logo ? <img src={s.logo} alt="" className="w-full h-full object-contain" /> : <Building2 size={18} className="text-[#b02a2a]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{s.name}</div>
                    {s.trade_name && <div className="text-[11px] text-[#666] truncate">« {s.trade_name} »</div>}
                    <div className="text-[11px] text-[#999]">{s.country}{s.city ? ` · ${s.city}` : ""}</div>
                  </div>
                </div>
                {isOwner ? (
                  <div className="text-xs text-[#666] space-y-0.5">
                    {s.phone && <div className="flex items-center gap-1"><Phone size={10} />{s.phone}</div>}
                    {s.email && <div className="flex items-center gap-1 truncate"><Mail size={10} />{s.email}</div>}
                    {s.lead_time_days > 0 && <div className="flex items-center gap-1"><Clock size={10} />Délai : {s.lead_time_days}j</div>}
                    {s.balance > 0 && <div className="text-[#c62828] font-semibold">Solde dû : {fcfa(s.balance)}</div>}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-[11px] text-[#999]"><Lock size={10} />Informations masquées</div>
                )}
                <div className="flex gap-2 mt-3">
                  {isOwner && <button onClick={() => setDetail(s.id)} className="dina-btn-secondary flex-1 !min-h-[32px] text-xs" data-testid={`sup-view-${s.name}`}>Détails</button>}
                  {isOwner && <button onClick={() => { setEdit(s); setOpen(true); }} className="dina-btn-secondary !min-h-[32px] text-xs" data-testid={`sup-edit-${s.name}`}><Pencil size={11} /></button>}
                  {isOwner && <button onClick={() => del(s)} className="dina-btn-secondary !min-h-[32px] text-xs !text-[#c62828]"><Trash2 size={11} /></button>}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="dina-card-white overflow-x-auto">
          <table className="dina-table">
            <thead><tr><th>Nom</th><th>Pays</th>{isOwner && <th>Téléphone</th>}{isOwner && <th>Email</th>}<th className="text-right">Délai</th>{isOwner && <th className="text-right">Solde dû</th>}<th></th></tr></thead>
            <tbody>{list.map(s => (
              <tr key={s.id} data-testid={`sup-row-${s.name}`}>
                <td><button onClick={() => isOwner && setDetail(s.id)} className="font-medium hover:text-[#b02a2a]">{s.name}</button>{s.trade_name && <div className="text-[11px] text-[#666]">{s.trade_name}</div>}</td>
                <td>{s.country}</td>
                {isOwner && <td className="text-xs">{s.phone || "—"}</td>}
                {isOwner && <td className="text-xs text-[#666]">{s.email || "—"}</td>}
                <td className="text-right text-xs">{s.lead_time_days || 0}j</td>
                {isOwner && <td className="text-right tabular text-[#c62828]">{fcfa(s.balance || 0)}</td>}
                <td className="text-right whitespace-nowrap">
                  {isOwner && <button onClick={() => { setEdit(s); setOpen(true); }} className="text-[#0021cc] mr-2"><Pencil size={13} /></button>}
                  {isOwner && <button onClick={() => del(s)} className="text-[#c62828]"><Trash2 size={13} /></button>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {open && isOwner && <SupplierForm initial={edit} onSave={save} onClose={() => { setOpen(false); setEdit(null); }} />}
    </div>
  );
}

function Kpi({ label, v, c, small }) {
  return (
    <div className="dina-card-white p-3 min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-[#666] font-semibold truncate">{label}</div>
      <div className={`font-serif tabular leading-none mt-1.5 truncate ${small ? "text-lg" : "text-2xl"}`} style={{ color: c }}>{v}</div>
    </div>
  );
}

function SupplierForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { name: "", country: "CI", status: "active", lead_time_days: 0, balance: 0 });
  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="sup-form">
        <div className="flex items-center justify-between mb-4"><div className="font-serif text-xl">{initial?.id ? "Modifier" : "Nouveau"} fournisseur</div><button onClick={onClose}><X size={18} /></button></div>
        <div className="space-y-3">
          <div><label className="text-[10px] uppercase font-semibold text-[#666] mb-1 block">Logo</label><ImageUpload value={f.logo ? [f.logo] : []} onChange={imgs => upd("logo", imgs[0] || "")} single max={1} maxKB={200} testid="sup-logo" /></div>
          <div className="grid md:grid-cols-2 gap-3">
            <input className="dina-input" placeholder="Raison sociale *" value={f.name || ""} onChange={e => upd("name", e.target.value)} data-testid="sup-name" />
            <input className="dina-input" placeholder="Nom commercial" value={f.trade_name || ""} onChange={e => upd("trade_name", e.target.value)} />
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <select className="dina-input" value={f.country || "CI"} onChange={e => upd("country", e.target.value)} data-testid="sup-country">{COUNTRIES.map(c => <option key={c}>{c}</option>)}</select>
            <input className="dina-input" placeholder="Ville" value={f.city || ""} onChange={e => upd("city", e.target.value)} />
            <input className="dina-input" placeholder="Adresse du magasin" value={f.address || ""} onChange={e => upd("address", e.target.value)} />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <input className="dina-input" placeholder="Téléphone magasin" value={f.phone || ""} onChange={e => upd("phone", e.target.value)} data-testid="sup-phone" />
            <input className="dina-input" placeholder="WhatsApp magasin" value={f.whatsapp || ""} onChange={e => upd("whatsapp", e.target.value)} />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <input className="dina-input" placeholder="Email" value={f.email || ""} onChange={e => upd("email", e.target.value)} />
            <input className="dina-input" placeholder="Site web" value={f.website || ""} onChange={e => upd("website", e.target.value)} />
          </div>

          <div className="border-t border-[#ececec] dark:border-[#2a2a2a] pt-3">
            <div className="text-xs uppercase font-semibold text-[#666] mb-2">Gérant / contact</div>
            <div className="grid md:grid-cols-2 gap-3">
              <input className="dina-input" placeholder="Nom du gérant" value={f.manager_name || ""} onChange={e => upd("manager_name", e.target.value)} data-testid="sup-manager-name" />
              <input className="dina-input" placeholder="Fonction" value={f.manager_role || ""} onChange={e => upd("manager_role", e.target.value)} />
              <input className="dina-input" placeholder="Téléphone contact" value={f.manager_phone || ""} onChange={e => upd("manager_phone", e.target.value)} />
              <input className="dina-input" placeholder="WhatsApp contact" value={f.manager_whatsapp || ""} onChange={e => upd("manager_whatsapp", e.target.value)} />
            </div>
          </div>

          <div className="border-t border-[#ececec] dark:border-[#2a2a2a] pt-3 grid md:grid-cols-3 gap-3">
            <input className="dina-input" placeholder="Conditions de paiement" value={f.payment_terms || ""} onChange={e => upd("payment_terms", e.target.value)} />
            <input type="number" className="dina-input" placeholder="Délai moyen (jours)" value={f.lead_time_days || 0} onChange={e => upd("lead_time_days", +e.target.value || 0)} />
            <input type="number" className="dina-input" placeholder="Solde dû (FCFA)" value={f.balance || 0} onChange={e => upd("balance", +e.target.value || 0)} />
          </div>
          <input className="dina-input" placeholder="Catégories fournies (séparées par ,)" value={(f.categories || []).join(", ")} onChange={e => upd("categories", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} />
          <textarea className="dina-input" rows={2} placeholder="Notes" value={f.notes || ""} onChange={e => upd("notes", e.target.value)} />

          <select className="dina-input" value={f.status || "active"} onChange={e => upd("status", e.target.value)}>
            <option value="active">Actif</option>
            <option value="inactive">Inactif</option>
          </select>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button>
          <button onClick={() => onSave(f)} disabled={!f.name} className="dina-btn-primary flex-1" data-testid="sup-save">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function SupplierDetail({ sid, onBack, onEdit }) {
  const [s, setS] = useState(null);
  useEffect(() => { api.get(`/suppliers/${sid}`).then(r => setS(r.data)).catch(() => toast.error("Erreur")); }, [sid]);
  if (!s) return <div className="text-center text-sm text-[#666] py-12">Chargement…</div>;
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm text-[#666] inline-flex items-center gap-1 hover:text-[#b02a2a]"><ChevronLeft size={13} />Retour</button>
      <div className="dina-card-white p-5 flex items-start gap-4">
        <div className="w-20 h-20 rounded-xl bg-[#fff5f5] overflow-hidden grid place-items-center shrink-0">{s.logo ? <img src={s.logo} className="w-full h-full object-contain" alt="" /> : <Building2 size={30} className="text-[#b02a2a]" />}</div>
        <div className="flex-1">
          <h1 className="font-serif text-2xl">{s.name}</h1>
          {s.trade_name && <div className="text-sm text-[#666]">« {s.trade_name} »</div>}
          <div className="grid md:grid-cols-2 gap-x-6 gap-y-1 text-xs mt-2">
            {s.phone && <div className="flex items-center gap-1"><Phone size={11} />{s.phone}</div>}
            {s.whatsapp && <div className="flex items-center gap-1"><MessageCircle size={11} />{s.whatsapp}</div>}
            {s.email && <div className="flex items-center gap-1"><Mail size={11} />{s.email}</div>}
            {s.website && <div className="flex items-center gap-1"><Globe size={11} />{s.website}</div>}
            {s.address && <div className="col-span-2 text-[#666]">{s.address}, {s.city}, {s.country}</div>}
            {s.manager_name && <div className="col-span-2 pt-1 border-t border-[#ececec] dark:border-[#2a2a2a]"><b>Contact :</b> {s.manager_name} {s.manager_role && `(${s.manager_role})`} · {s.manager_phone}</div>}
            {s.payment_terms && <div className="col-span-2"><b>Paiement :</b> {s.payment_terms}</div>}
          </div>
        </div>
        <button onClick={() => onEdit(s)} className="dina-btn-secondary !min-h-[36px]"><Pencil size={13} />Modifier</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        <Kpi label="Produits fournis" v={s.stats.product_count} c="#5867fd" />
        <Kpi label="Bons de commande" v={s.stats.po_count} c="#e4991e" />
        <Kpi label="Total acheté" v={fcfa(s.stats.purchased_total)} c="#b02a2a" small />
        <Kpi label="Solde dû" v={fcfa(s.stats.balance)} c="#c62828" small />
        <Kpi label="Marge produits" v={`${s.stats.avg_margin}%`} c="#1f8a4c" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Approvisionnements récents</div>
          {(s.purchase_orders || []).length === 0 ? <div className="text-sm text-[#666] text-center py-6">Aucun bon</div> :
            <table className="dina-table"><thead><tr><th>N°</th><th>Date</th><th>Statut</th><th className="text-right">Total</th></tr></thead>
              <tbody>{(s.purchase_orders || []).slice(0, 10).map(p => (
                <tr key={p.id}><td className="font-mono text-xs">{p.number}</td><td className="text-[#666]">{dateFmt(p.created_at)}</td><td><span className="dina-chip text-[10px] capitalize">{(p.status || "").replace("_", " ")}</span></td><td className="text-right tabular">{fcfa(p.total)}</td></tr>
              ))}</tbody>
            </table>}
        </div>
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Produits fournis ({s.products.length})</div>
          <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto">
            {s.products.slice(0, 24).map(p => (
              <div key={p.id} className="text-xs"><img src={p.image || p.images?.[0]} alt="" className="aspect-square object-cover rounded" /><div className="line-clamp-1 mt-1">{p.name}</div><div className="tabular font-semibold text-[#b02a2a]">{fcfa(p.price)}</div></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
