import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { fcfa, dateFmt } from "@/lib/format";
import { toast } from "sonner";
import {
  Plus, Trash2, Pencil, Upload, Receipt as ReceiptIcon, Image as ImageIcon,
  Filter, X, Tag, Wallet, TrendingUp, TrendingDown, FileText,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

const COLORS = ["#b02a2a", "#1f8a4c", "#5867fd", "#e4991e", "#f4b12c", "#9333ea", "#0ea5e9", "#f43f5e"];
const TABS = [
  { id: "depenses", label: "Dépenses", icon: Wallet },
  { id: "encaissements", label: "Encaissements", icon: TrendingUp },
  { id: "pnl", label: "Compte de résultat", icon: FileText },
  { id: "categories", label: "Catégories", icon: Tag },
];

export default function Finances() {
  const [tab, setTab] = useState("depenses");
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-serif text-3xl">Finances</h1>
          <p className="text-sm text-[#666]">Dépenses, encaissements et résultat d'exploitation</p>
        </div>
      </div>
      <div className="flex gap-1 border-b border-[#ececec] dark:border-[#2a2a2a] overflow-x-auto" data-testid="finances-tabs">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              data-testid={`finances-tab-${t.id}`}
              className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 flex items-center gap-2 transition ${active ? "border-[#b02a2a] text-[#b02a2a] font-semibold" : "border-transparent text-[#666] hover:text-black"}`}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>
      {tab === "depenses" && <DepensesTab />}
      {tab === "encaissements" && <EncaissementsTab />}
      {tab === "pnl" && <PnLTab />}
      {tab === "categories" && <CategoriesTab />}
    </div>
  );
}

/* ===========================================================================
   TAB 1 : Dépenses
=========================================================================== */
function DepensesTab() {
  const [rows, setRows] = useState([]);
  const [cats, setCats] = useState([]);
  const [editing, setEditing] = useState(null);
  const [filters, setFilters] = useState({ type: "", category: "", q: "", days: "" });
  const [viewReceipt, setViewReceipt] = useState(null);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.type) params.set("type", filters.type);
      if (filters.category) params.set("category", filters.category);
      if (filters.q) params.set("q", filters.q);
      if (filters.days) params.set("days", filters.days);
      const [r, c] = await Promise.all([
        api.get(`/expenses?${params.toString()}`),
        api.get("/expense-categories"),
      ]);
      setRows(r.data); setCats(c.data);
    } catch { toast.error("Erreur de chargement"); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filters]);

  const save = async (f) => {
    try {
      if (f.id) await api.patch(`/expenses/${f.id}`, f);
      else await api.post("/expenses", f);
      toast.success("Dépense enregistrée");
      setEditing(null); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
  };
  const del = async (id) => {
    if (!window.confirm("Supprimer cette dépense ?")) return;
    try { await api.delete(`/expenses/${id}`); toast.success("Supprimée"); load(); }
    catch { toast.error("Erreur"); }
  };

  const totals = useMemo(() => {
    const total = rows.reduce((s, x) => s + (x.amount || 0), 0);
    const fixe = rows.filter(x => x.type === "fixe").reduce((s, x) => s + (x.amount || 0), 0);
    const variable = total - fixe;
    const byCat = {};
    rows.forEach(x => { byCat[x.category] = (byCat[x.category] || 0) + (x.amount || 0); });
    return { total, fixe, variable, byCat };
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Total dépenses" value={fcfa(totals.total)} color="#c62828" testId="kpi-total" />
        <KPI label="Charges fixes" value={fcfa(totals.fixe)} color="#5867fd" testId="kpi-fixe" />
        <KPI label="Charges variables" value={fcfa(totals.variable)} color="#e4991e" testId="kpi-variable" />
        <KPI label="Nb écritures" value={String(rows.length)} testId="kpi-count" />
      </div>

      {/* Filters + Action */}
      <div className="dina-card-white p-3 flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-[#666]" />
        <select data-testid="depenses-filter-type" className="dina-input !w-auto !min-w-[120px]" value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}>
          <option value="">Tous types</option>
          <option value="fixe">Fixes</option>
          <option value="variable">Variables</option>
        </select>
        <select data-testid="depenses-filter-category" className="dina-input !w-auto !min-w-[140px]" value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value })}>
          <option value="">Toutes catégories</option>
          {cats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <select data-testid="depenses-filter-days" className="dina-input !w-auto !min-w-[120px]" value={filters.days} onChange={e => setFilters({ ...filters, days: e.target.value })}>
          <option value="">Toute période</option>
          <option value="7">7 jours</option>
          <option value="30">30 jours</option>
          <option value="90">90 jours</option>
          <option value="365">1 an</option>
        </select>
        <input data-testid="depenses-filter-q" className="dina-input !w-auto flex-1 min-w-[160px]" placeholder="Rechercher..." value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })} />
        {(filters.type || filters.category || filters.q || filters.days) && (
          <button onClick={() => setFilters({ type: "", category: "", q: "", days: "" })} className="text-xs text-[#666] hover:text-black flex items-center gap-1"><X size={12} /> Réinitialiser</button>
        )}
        <button onClick={() => setEditing({})} className="dina-btn-primary !min-h-[36px] ml-auto" data-testid="expense-new">
          <Plus size={14} /> Nouvelle dépense
        </button>
      </div>

      {/* Table */}
      <div className="dina-card-white overflow-x-auto">
        <table className="dina-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Libellé</th>
              <th>Catégorie</th>
              <th>Type</th>
              <th>Mode</th>
              <th className="text-right">Montant</th>
              <th>Reçu</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="text-center text-[#999] py-6">Aucune dépense</td></tr>}
            {rows.map(x => (
              <tr key={x.id} data-testid={`expense-row-${x.id}`}>
                <td className="text-[#666] text-xs">{dateFmt(x.paid_at || x.created_at)}</td>
                <td className="font-medium">{x.label || x.note || "—"}</td>
                <td><span className="px-2 py-0.5 rounded bg-[#f5f5f5] text-xs">{x.category}</span></td>
                <td>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${x.type === "fixe" ? "bg-[#5867fd]/10 text-[#5867fd]" : "bg-[#e4991e]/10 text-[#e4991e]"}`}>
                    {x.type === "fixe" ? "Fixe" : "Variable"}
                  </span>
                </td>
                <td className="capitalize text-xs">{x.payment_method}</td>
                <td className="text-right tabular font-semibold text-[#c62828]">-{fcfa(x.amount)}</td>
                <td>
                  {x.receipt ? (
                    <button onClick={() => setViewReceipt(x.receipt)} className="text-[#1f8a4c] text-xs flex items-center gap-1 hover:underline" data-testid={`expense-receipt-${x.id}`}>
                      <ImageIcon size={12} /> Voir
                    </button>
                  ) : <span className="text-xs text-[#bbb]">—</span>}
                </td>
                <td className="text-right whitespace-nowrap">
                  <button onClick={() => setEditing(x)} className="text-[#5867fd] p-1" data-testid={`expense-edit-${x.id}`}><Pencil size={14} /></button>
                  <button onClick={() => del(x.id)} className="text-[#c62828] p-1" data-testid={`expense-delete-${x.id}`}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <ExpenseForm expense={editing} cats={cats} onSave={save} onClose={() => setEditing(null)} />}
      {viewReceipt && (
        <div className="fixed inset-0 bg-black/70 grid place-items-center z-50 p-4" onClick={() => setViewReceipt(null)}>
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setViewReceipt(null)} className="absolute top-2 right-2 bg-white rounded-full p-1"><X size={16} /></button>
            <img src={viewReceipt} alt="Reçu" className="max-h-[85vh] max-w-[90vw] rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
}

function ExpenseForm({ expense, cats, onSave, onClose }) {
  const [f, setF] = useState({
    id: expense?.id || null,
    label: expense?.label || "",
    category: expense?.category || (cats[0]?.name || "Autre"),
    amount: expense?.amount || 0,
    note: expense?.note || "",
    payment_method: expense?.payment_method || "cash",
    type: expense?.type || "variable",
    paid_at: (expense?.paid_at || expense?.created_at || new Date().toISOString()).slice(0, 10),
    receipt: expense?.receipt || null,
    supplier: expense?.supplier || "",
  });

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Max 2 Mo"); return; }
    const reader = new FileReader();
    reader.onload = () => setF({ ...f, receipt: reader.result });
    reader.readAsDataURL(file);
  };

  const submit = () => {
    if (!f.amount || f.amount <= 0) { toast.error("Montant invalide"); return; }
    if (!f.category) { toast.error("Catégorie requise"); return; }
    onSave({ ...f, amount: +f.amount });
  };

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-serif text-xl">{f.id ? "Modifier la dépense" : "Nouvelle dépense"}</div>
          <button onClick={onClose} className="text-[#666]"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-[#666] mb-1 block">Libellé</label>
            <input className="dina-input" placeholder="Ex. Loyer Cocody - mars" value={f.label} onChange={e => setF({ ...f, label: e.target.value })} data-testid="expense-label" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#666] mb-1 block">Catégorie</label>
              <select className="dina-input" value={f.category} onChange={e => setF({ ...f, category: e.target.value })} data-testid="expense-category">
                {cats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#666] mb-1 block">Type</label>
              <select className="dina-input" value={f.type} onChange={e => setF({ ...f, type: e.target.value })} data-testid="expense-type">
                <option value="fixe">Fixe</option>
                <option value="variable">Variable</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#666] mb-1 block">Montant (FCFA)</label>
              <input type="number" className="dina-input" placeholder="0" value={f.amount || ""} onChange={e => setF({ ...f, amount: +e.target.value })} data-testid="expense-amount" />
            </div>
            <div>
              <label className="text-xs text-[#666] mb-1 block">Date</label>
              <input type="date" className="dina-input" value={f.paid_at} onChange={e => setF({ ...f, paid_at: e.target.value })} data-testid="expense-paid-at" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#666] mb-1 block">Mode de paiement</label>
              <select className="dina-input" value={f.payment_method} onChange={e => setF({ ...f, payment_method: e.target.value })} data-testid="expense-payment-method">
                <option value="cash">Espèces</option>
                <option value="wave">Wave</option>
                <option value="orange_money">Orange Money</option>
                <option value="mtn">MTN</option>
                <option value="virement">Virement</option>
                <option value="cheque">Chèque</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[#666] mb-1 block">Fournisseur (opt.)</label>
              <input className="dina-input" placeholder="Nom du fournisseur" value={f.supplier} onChange={e => setF({ ...f, supplier: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs text-[#666] mb-1 block">Note</label>
            <textarea className="dina-input" rows={2} placeholder="Détails..." value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-[#666] mb-1 block flex items-center gap-2"><ReceiptIcon size={12} /> Reçu / Facture</label>
            {f.receipt ? (
              <div className="flex items-center gap-2">
                <img src={f.receipt} alt="Reçu" className="h-16 w-16 object-cover rounded border" />
                <button onClick={() => setF({ ...f, receipt: null })} className="text-xs text-[#c62828]">Retirer</button>
              </div>
            ) : (
              <label className="dina-btn-secondary cursor-pointer inline-flex items-center gap-2 !min-h-[36px]">
                <Upload size={14} /> Téléverser
                <input type="file" accept="image/*" className="hidden" onChange={onFile} data-testid="expense-receipt-upload" />
              </label>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button>
          <button onClick={submit} className="dina-btn-primary flex-1" data-testid="expense-save">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

/* ===========================================================================
   TAB 2 : Encaissements
=========================================================================== */
function EncaissementsTab() {
  const [days, setDays] = useState(7);
  const [d, setD] = useState(null);
  useEffect(() => { api.get(`/encaissements?days=${days}`).then(r => setD(r.data)).catch(() => toast.error("Erreur")); }, [days]);
  if (!d) return <div className="text-sm text-[#666]">Chargement…</div>;
  const avgBasket = d.count ? d.total / d.count : 0;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-1 bg-[#f5f5f5] dark:bg-[#1a1a1a] p-1 rounded-lg w-fit ml-auto">
        {[7, 30, 90].map(x => (
          <button key={x} onClick={() => setDays(x)} className={`px-3 py-1 text-xs rounded-md ${days === x ? "bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold" : ""}`} data-testid={`enc-days-${x}`}>{x} jours</button>
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Encaissé total" value={fcfa(d.total)} color="#b02a2a" testId="enc-total" />
        <KPI label="Commandes" value={String(d.count)} testId="enc-count" />
        <KPI label="Panier moyen" value={fcfa(avgBasket)} testId="enc-avg" />
        <KPI label="Modes utilisés" value={String(d.by_method.length)} testId="enc-modes" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Répartition par mode</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={d.by_method} dataKey="total" nameKey="method" cx="50%" cy="50%" outerRadius={80} label>
                {d.by_method.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => fcfa(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Encaissé par jour</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d.daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={10} />
              <YAxis fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fcfa(v)} />
              <Bar dataKey="total" fill="#b02a2a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="dina-card-white p-5">
        <div className="font-semibold mb-3">Détail par mode</div>
        <table className="dina-table">
          <thead><tr><th>Mode</th><th className="text-right">Commandes</th><th className="text-right">Total</th><th className="text-right">Part</th></tr></thead>
          <tbody>
            {d.by_method.map(m => (
              <tr key={m.method}>
                <td className="font-medium capitalize">{m.method === "cod" ? "Paiement à la livraison" : m.method}</td>
                <td className="text-right tabular">{m.count}</td>
                <td className="text-right tabular font-semibold">{fcfa(m.total)}</td>
                <td className="text-right tabular">{d.total ? Math.round(m.total / d.total * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===========================================================================
   TAB 3 : Compte de résultat (P&L)
=========================================================================== */
function PnLTab() {
  const [days, setDays] = useState(30);
  const [d, setD] = useState(null);
  useEffect(() => { api.get(`/profit-loss?days=${days}`).then(r => setD(r.data)).catch(() => toast.error("Erreur")); }, [days]);
  if (!d) return <div className="text-sm text-[#666]">Chargement…</div>;

  const waterfall = [
    { name: "CA", value: d.revenue, fill: "#1f8a4c" },
    { name: "Coût march.", value: -d.cogs, fill: "#e4991e" },
    { name: "Marge brute", value: d.gross_margin, fill: "#5867fd" },
    { name: "Dépenses", value: -d.expenses_total, fill: "#c62828" },
    { name: "Résultat", value: d.net, fill: d.net >= 0 ? "#1f8a4c" : "#c62828" },
  ];

  const Line_ = ({ label, value, color, bold, indent }) => (
    <div className={`flex justify-between py-2 ${bold ? "border-t border-[#ececec] font-semibold text-base" : "text-sm"} ${indent ? "pl-4 text-[#666]" : ""}`}>
      <span>{label}</span><span className="tabular" style={color ? { color } : {}}>{fcfa(value)}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-1 bg-[#f5f5f5] dark:bg-[#1a1a1a] p-1 rounded-lg w-fit ml-auto">
        {[7, 30, 90, 365].map(x => (
          <button key={x} onClick={() => setDays(x)} className={`px-3 py-1 text-xs rounded-md ${days === x ? "bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold" : ""}`} data-testid={`pl-days-${x}`}>{x === 365 ? "1 an" : `${x} jours`}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Chiffre d'affaires" value={fcfa(d.revenue)} color="#1f8a4c" testId="pl-ca" />
        <KPI label={`Marge brute (${d.gross_margin_pct}%)`} value={fcfa(d.gross_margin)} color="#5867fd" testId="pl-mb" />
        <KPI label="Total dépenses" value={fcfa(d.expenses_total)} color="#c62828" testId="pl-dep" />
        <KPI label={`Résultat d'exploitation (${d.net_margin_pct}%)`} value={fcfa(d.net)} color={d.net >= 0 ? "#1f8a4c" : "#c62828"} testId="pl-net" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3">Compte de résultat</div>
          <Line_ label="Chiffre d'affaires" value={d.revenue} bold />
          <Line_ label="Coût des marchandises vendues" value={-d.cogs} indent />
          <Line_ label={`Marge brute (${d.gross_margin_pct}%)`} value={d.gross_margin} color={d.gross_margin >= 0 ? "#1f8a4c" : "#c62828"} bold />
          <div className="my-3 text-xs uppercase text-[#666] font-semibold">Dépenses d'exploitation</div>
          {d.expenses_by_cat.map(c => <Line_ key={c.category} label={c.category} value={-c.amount} indent />)}
          <Line_ label="Total dépenses" value={-d.expenses_total} bold />
          <Line_ label={`Résultat d'exploitation (${d.net_margin_pct}%)`} value={d.net} color={d.net >= 0 ? "#1f8a4c" : "#c62828"} bold />
        </div>

        <div className="space-y-4">
          <div className="dina-card-white p-5">
            <div className="font-semibold mb-3">Flux financier</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={waterfall}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => fcfa(v)} />
                <Bar dataKey="value">
                  {waterfall.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="dina-card-white p-5">
            <div className="font-semibold mb-3">Dépenses par catégorie</div>
            {d.expenses_by_cat.length === 0 ? (
              <div className="text-sm text-[#999]">Aucune dépense sur la période</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={d.expenses_by_cat} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={70} label={(e) => e.category}>
                    {d.expenses_by_cat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fcfa(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===========================================================================
   TAB 4 : Catégories
=========================================================================== */
function CategoriesTab() {
  const [cats, setCats] = useState([]);
  const [newCat, setNewCat] = useState({ name: "", type: "variable" });

  const load = async () => {
    try { const r = await api.get("/expense-categories"); setCats(r.data); }
    catch { toast.error("Erreur"); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!newCat.name.trim()) { toast.error("Nom requis"); return; }
    try {
      await api.post("/expense-categories", newCat);
      toast.success("Catégorie créée"); setNewCat({ name: "", type: "variable" }); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
  };
  const toggleType = async (c) => {
    const next = c.type === "fixe" ? "variable" : "fixe";
    try { await api.patch(`/expense-categories/${c.id}`, { type: next }); load(); }
    catch { toast.error("Erreur"); }
  };
  const del = async (id) => {
    if (!window.confirm("Supprimer cette catégorie ?")) return;
    try { await api.delete(`/expense-categories/${id}`); toast.success("Supprimée"); load(); }
    catch { toast.error("Erreur"); }
  };

  return (
    <div className="space-y-4">
      <div className="dina-card-white p-4">
        <div className="font-semibold mb-3 flex items-center gap-2"><Plus size={14} /> Nouvelle catégorie</div>
        <div className="flex gap-2 flex-wrap">
          <input
            className="dina-input !w-auto flex-1 min-w-[200px]"
            placeholder="Nom de la catégorie"
            value={newCat.name}
            onChange={e => setNewCat({ ...newCat, name: e.target.value })}
            data-testid="category-name"
          />
          <select className="dina-input !w-auto" value={newCat.type} onChange={e => setNewCat({ ...newCat, type: e.target.value })} data-testid="category-type">
            <option value="fixe">Fixe</option>
            <option value="variable">Variable</option>
          </select>
          <button onClick={create} className="dina-btn-primary !min-h-[36px]" data-testid="category-create">Créer</button>
        </div>
      </div>

      <div className="dina-card-white overflow-x-auto">
        <table className="dina-table">
          <thead><tr><th>Nom</th><th>Type</th><th>Créée le</th><th></th></tr></thead>
          <tbody>
            {cats.length === 0 && <tr><td colSpan={4} className="text-center text-[#999] py-6">Aucune catégorie</td></tr>}
            {cats.map(c => (
              <tr key={c.id} data-testid={`category-row-${c.id}`}>
                <td className="font-medium">{c.name}</td>
                <td>
                  <button onClick={() => toggleType(c)} className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${c.type === "fixe" ? "bg-[#5867fd]/10 text-[#5867fd]" : "bg-[#e4991e]/10 text-[#e4991e]"}`} data-testid={`category-toggle-${c.id}`}>
                    {c.type === "fixe" ? "Fixe" : "Variable"}
                  </button>
                </td>
                <td className="text-xs text-[#666]">{dateFmt(c.created_at)}</td>
                <td className="text-right">
                  <button onClick={() => del(c.id)} className="text-[#c62828] p-1" data-testid={`category-delete-${c.id}`}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Shared ---------- */
function KPI({ label, value, color, testId }) {
  return (
    <div className="dina-card-white p-4" data-testid={testId}>
      <div className="text-xs uppercase text-[#666]">{label}</div>
      <div className="font-serif text-2xl tabular mt-1" style={color ? { color } : {}}>{value}</div>
    </div>
  );
}
