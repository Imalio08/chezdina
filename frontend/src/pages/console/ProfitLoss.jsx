import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { toast } from "sonner";

export default function ProfitLoss() {
  const [days, setDays] = useState(30);
  const [d, setD] = useState(null);
  useEffect(() => { api.get(`/profit-loss?days=${days}`).then(r => setD(r.data)).catch(() => toast.error("Erreur")); }, [days]);
  if (!d) return <div className="text-sm text-[#666]">Chargement…</div>;
  const Line = ({ label, value, color, bold, indent }) => (
    <div className={`flex justify-between py-2 ${bold ? "border-t border-[#ececec] font-semibold text-base" : "text-sm"} ${indent ? "pl-4 text-[#666]" : ""}`}>
      <span>{label}</span><span className="tabular" style={color ? { color } : {}}>{fcfa(value)}</span>
    </div>
  );
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Compte de résultat</h1><p className="text-sm text-[#666]">CA − coût marchandises = marge brute − dépenses = résultat net</p></div>
        <div className="flex gap-1 bg-[#f5f5f5] dark:bg-[#1a1a1a] p-1 rounded-lg">
          {[7, 30, 90, 365].map(x => <button key={x} onClick={() => setDays(x)} className={`px-3 py-1 text-xs rounded-md ${days === x ? "bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold" : ""}`} data-testid={`pl-days-${x}`}>{x === 365 ? "1 an" : `${x} jours`}</button>)}
        </div>
      </div>
      <div className="dina-card-white p-6">
        <Line label="Chiffre d'affaires" value={d.revenue} bold />
        <Line label="Coût des marchandises vendues" value={-d.cogs} indent />
        <Line label={`Marge brute (${d.gross_margin_pct}%)`} value={d.gross_margin} color={d.gross_margin >= 0 ? "#1f8a4c" : "#c62828"} bold />
        <div className="my-3 text-xs uppercase text-[#666] font-semibold">Dépenses</div>
        {d.expenses_by_cat.map(c => <Line key={c.category} label={c.category} value={-c.amount} indent />)}
        <Line label="Total dépenses" value={-d.expenses_total} bold />
        <Line label={`Résultat net (${d.net_margin_pct}%)`} value={d.net} color={d.net >= 0 ? "#1f8a4c" : "#c62828"} bold />
      </div>
    </div>
  );
}
