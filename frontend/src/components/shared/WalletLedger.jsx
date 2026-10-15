import React from "react";
import { fcfa, dateTimeFmt } from "@/lib/format";

export const SOURCE_LABEL = { parrainage: "Parrainage", fidelite: "Fidélité", promotion: "Promotion", remboursement: "Remboursement", commande: "Commande", correction: "Correction", initial: "Solde initial", autre: "Autre" };
const TYPE_LABEL = { credit: "Crédit", debit: "Débit", conversion: "Conversion", correction: "Correction", annulation: "Annulation", expiration: "Expiration" };
const STATUS = { available: ["Crédité", "#1f8a4c"], pending: ["En attente", "#e4991e"], validated: ["Validé", "#999"], cancelled: ["Annulé", "#c62828"] };

// Wallet history table/cards shared by the customer account and the console
export function WalletLedger({ rows, testid = "wallet-history" }) {
  if (!rows?.length) return <div className="text-sm text-[#666] text-center py-6" data-testid={`${testid}-empty`}>Aucune opération pour le moment</div>;
  return (
    <div className="divide-y divide-[#f0f0f0] dark:divide-[#2a2a2a]" data-testid={testid}>
      {rows.filter(r => r.status !== "validated").map(r => {
        const [st, col] = r.amount < 0 && r.status === "available" ? ["Débité", "#c62828"] : (STATUS[r.status] || [r.status, "#666"]);
        return (
          <div key={r.id} className="py-2.5 flex items-start gap-3" data-testid={`wallet-tx-${r.id}`}>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium break-words">{r.label}</div>
              <div className="text-[11px] text-[#999]">{dateTimeFmt(r.at)} · {TYPE_LABEL[r.type] || r.type} · {SOURCE_LABEL[r.source] || r.source}{r.order_code ? ` · ${r.order_code}` : ""}{r.by ? ` · par ${r.by}` : ""}</div>
            </div>
            <div className="text-right shrink-0">
              <div className={`tabular font-semibold text-sm ${r.amount < 0 ? "text-[#c62828]" : r.status === "pending" ? "text-[#e4991e]" : "text-[#1f8a4c]"}`}>{r.amount > 0 ? "+" : ""}{fcfa(r.amount)}</div>
              <div className="text-[10px]" style={{ color: col }}>{st}{r.balance_after != null ? ` · solde ${fcfa(r.balance_after)}` : ""}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
