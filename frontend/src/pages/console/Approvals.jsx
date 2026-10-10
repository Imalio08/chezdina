import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { fcfa, dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";
import useFocusParam from "@/lib/useFocusParam";
import { CheckCircle, XCircle, Filter, Clock, AlertTriangle, DollarSign, Package, Tag, Receipt } from "lucide-react";

const KIND_LABEL = {
  discount: "Remise exceptionnelle",
  refund: "Remboursement",
  stock_adjustment: "Ajustement stock",
  price_change: "Changement de prix",
  expense: "Dépense",
  cash_handover: "Versement caisse",
};
const KIND_ICON = { discount: Tag, refund: DollarSign, stock_adjustment: Package, price_change: Tag, expense: Receipt, cash_handover: DollarSign };
const KIND_COLOR = { discount: "#e4991e", refund: "#c62828", stock_adjustment: "#5867fd", price_change: "#b02a2a", expense: "#5867fd", cash_handover: "#1f8a4c" };

export default function Approvals() {
  useFocusParam();
  const { user } = useAuth();
  const [approvals, setApprovals] = useState([]);
  const [expenseReqs, setExpenseReqs] = useState([]);
  const [stockReqs, setStockReqs] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [kindFilter, setKindFilter] = useState("");
  const [note, setNote] = useState("");

  const load = async () => {
    try {
      const [a, e, s] = await Promise.all([
        api.get(`/approval-requests${filter === "all" ? "" : `?status=${filter}`}`).catch(() => ({data:[]})),
        api.get(`/expense-requests${filter === "all" ? "" : `?status=${filter}`}`).catch(() => ({data:[]})),
        api.get(`/stock/adjustment-requests`).catch(() => ({data:[]})),
      ]);
      setApprovals(a.data || []);
      setExpenseReqs(e.data || []);
      setStockReqs((s.data || []).filter(r => filter === "all" || r.status === filter));
    } catch { toast.error("Erreur de chargement"); }
  };
  useEffect(() => { load(); }, [filter]); // eslint-disable-line

  const unified = useMemo(() => {
    const rows = [];
    approvals.forEach(a => rows.push({
      id: a.id, kind: a.kind, source: "approval",
      title: KIND_LABEL[a.kind] || a.kind,
      requestedBy: a.requested_by_name, reason: a.reason,
      payload: a.payload || {}, status: a.status,
      createdAt: a.created_at, decisionBy: a.decision_by, decisionNote: a.decision_note,
      amount: a.payload?.amount,
    }));
    expenseReqs.forEach(e => rows.push({
      id: e.id, kind: "expense", source: "expense",
      title: e.label || "Dépense",
      requestedBy: e.requested_by_name, reason: e.note,
      payload: { category: e.category }, status: e.status,
      createdAt: e.created_at, decisionBy: e.decision_by,
      amount: e.amount,
    }));
    stockReqs.forEach(s => rows.push({
      id: s.id, kind: "stock_adjustment", source: "stock",
      title: `Stock · ${s.product_name}${s.size ? ` · ${s.size}` : ""}`,
      requestedBy: s.requested_by, reason: s.reason,
      payload: { qty_delta: s.qty_delta }, status: s.status === "approved" ? "approved" : s.status === "rejected" ? "rejected" : "pending",
      createdAt: s.created_at,
    }));
    rows.sort((a,b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return kindFilter ? rows.filter(r => r.kind === kindFilter) : rows;
  }, [approvals, expenseReqs, stockReqs, kindFilter]);

  const counts = {
    pending: approvals.filter(a => a.status === "pending").length + expenseReqs.filter(e => e.status === "pending").length + stockReqs.filter(s => s.status === "pending").length,
    approved: approvals.filter(a => a.status === "approved").length + expenseReqs.filter(e => e.status === "approved").length,
    rejected: approvals.filter(a => a.status === "rejected").length + expenseReqs.filter(e => e.status === "rejected").length,
  };

  const decide = async (row, decision) => {
    const endpoint = row.source === "expense"
      ? `/expense-requests/${row.id}/decide`
      : row.source === "stock"
      ? `/stock/adjustment-requests/${row.id}/decide`
      : `/approval-requests/${row.id}/decide`;
    try {
      const body = row.source === "stock"
        ? { decision: decision === "approved" ? "approve" : "reject", note }
        : { decision, note };
      await api.post(endpoint, body);
      toast.success(decision === "approved" ? "Approuvé" : "Refusé");
      setNote("");
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
  };

  if (user?.role !== "admin") {
    return (
      <div className="dina-card-white p-8 text-center" data-testid="approvals-no-access">
        <AlertTriangle size={32} className="text-[#e4991e] mx-auto mb-3"/>
        <div className="font-serif text-xl mb-1">Accès réservé</div>
        <div className="text-sm text-[#666]">Cette page est réservée au propriétaire.</div>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="approvals-page">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-serif text-3xl">À approuver</h1>
          <p className="text-sm text-[#666]">Boîte unique · remises, remboursements, dépenses, ajustements stock, versements caisse</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <KPI label="En attente" value={counts.pending} color="#e4991e" active={filter==="pending"} onClick={() => setFilter("pending")} testid="kpi-pending"/>
        <KPI label="Approuvées" value={counts.approved} color="#1f8a4c" active={filter==="approved"} onClick={() => setFilter("approved")} testid="kpi-approved"/>
        <KPI label="Refusées" value={counts.rejected} color="#c62828" active={filter==="rejected"} onClick={() => setFilter("rejected")} testid="kpi-rejected"/>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-xs text-[#666] font-semibold uppercase flex items-center gap-1"><Filter size={11}/>Type</span>
        <button onClick={() => setKindFilter("")} className={`dina-chip ${!kindFilter ? "!bg-[#1c1c1c] !text-white" : ""}`} data-testid="kind-all">Tous</button>
        {Object.entries(KIND_LABEL).map(([k, label]) => (
          <button key={k} onClick={() => setKindFilter(k)} className={`dina-chip ${kindFilter === k ? "!bg-[#1c1c1c] !text-white" : ""}`} data-testid={`kind-${k}`}>{label}</button>
        ))}
      </div>

      <div className="space-y-2">
        {unified.length === 0 ? (
          <div className="dina-card-white p-8 text-center text-sm text-[#666]">Aucune demande dans cette catégorie</div>
        ) : unified.map(r => {
          const Icon = KIND_ICON[r.kind] || Clock;
          const color = KIND_COLOR[r.kind] || "#666";
          return (
            <div key={`${r.source}-${r.id}`} className="dina-card-white p-4" data-testid={`approval-row-${r.id}`} data-focus-id={r.id}>
              <div className="flex items-start gap-3 flex-wrap">
                <div className="w-10 h-10 rounded-lg grid place-items-center shrink-0" style={{background: `${color}1a`, color}}><Icon size={16}/></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-serif text-base">{r.title}</span>
                    <span className="dina-chip text-[10px] capitalize" style={{color}}>{r.kind}</span>
                    {r.amount != null && <span className="font-semibold tabular text-sm">{fcfa(r.amount)}</span>}
                    {r.payload?.qty_delta != null && <span className={`font-semibold tabular text-sm ${r.payload.qty_delta < 0 ? "text-[#c62828]" : "text-[#1f8a4c]"}`}>{r.payload.qty_delta > 0 ? "+" : ""}{r.payload.qty_delta}</span>}
                  </div>
                  <div className="text-xs text-[#666] mt-1">
                    Demandé par <b className="text-[#1c1c1c] dark:text-white">{r.requestedBy || "—"}</b> · {dateTimeFmt(r.createdAt)}
                  </div>
                  {r.reason && <div className="text-sm italic mt-1 text-[#666]">"{r.reason}"</div>}
                  {r.payload?.category && <div className="text-xs text-[#999] mt-1">Catégorie · {r.payload.category}</div>}
                  {r.status !== "pending" && (
                    <div className="text-xs mt-2" style={{color: r.status === "approved" ? "#1f8a4c" : "#c62828"}}>
                      {r.status === "approved" ? "✓ Approuvé" : "✗ Refusé"} par {r.decisionBy || "—"}
                      {r.decisionNote && <> · "{r.decisionNote}"</>}
                    </div>
                  )}
                </div>
                {r.status === "pending" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <input className="dina-input !py-1 text-xs max-w-[160px]" placeholder="Commentaire (optionnel)" value={note} onChange={e => setNote(e.target.value)} data-testid={`approval-note-${r.id}`}/>
                    <button onClick={() => decide(r, "approved")} className="dina-btn-primary !min-h-[36px] !bg-[#1f8a4c]" data-testid={`approval-approve-${r.id}`}><CheckCircle size={13}/>Approuver</button>
                    <button onClick={() => decide(r, "rejected")} className="dina-btn-secondary !min-h-[36px] !text-[#c62828]" data-testid={`approval-reject-${r.id}`}><XCircle size={13}/>Refuser</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KPI({ label, value, color, active, onClick, testid }) {
  return (
    <button onClick={onClick} className={`dina-card-white p-4 text-left transition ${active ? "ring-2 ring-offset-1" : ""}`} style={active ? { "--tw-ring-color": color } : {}} data-testid={testid}>
      <div className="text-xs uppercase text-[#666] font-semibold">{label}</div>
      <div className="font-serif text-3xl tabular mt-1" style={{color}}>{value}</div>
    </button>
  );
}
