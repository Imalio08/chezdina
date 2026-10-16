import React from "react";
import { WifiOff, AlertTriangle } from "lucide-react";
import { dateTimeFmt, statusLabel } from "@/lib/format";

export default function OrderTimeline({ timeline }) {
  const tl = timeline || [];
  return (
    <div className="dina-card-white p-5" data-testid="order-timeline">
      <div className="font-semibold mb-3">Historique</div>
      {!tl.length ? <div className="text-xs text-[#666]">Aucun événement</div> : (
        <div className="space-y-1.5">
          {tl.map((t, i) => (
            <div key={i} className={`text-xs flex gap-2 items-start ${t.offline_rejected ? "bg-[#fff4e0] text-[#8a5a00] rounded p-2" : "text-[#666]"}`} data-testid={`timeline-${i}`}>
              {t.offline_rejected ? <AlertTriangle size={12} className="mt-0.5 shrink-0"/> : t.offline ? <WifiOff size={12} className="mt-0.5 shrink-0 text-[#e4991e]"/> : <span className="w-3 shrink-0"/>}
              <span>
                <b className="text-[#1c1c1c] dark:text-white">{dateTimeFmt(t.at)}</b> · {t.offline_rejected ? "Action hors ligne à vérifier" : (statusLabel[t.status] || t.status)} · {t.by}
                {t.reason ? ` — ${t.reason}` : ""}{t.note ? ` — ${t.note}` : ""}
                {t.offline && !t.offline_rejected ? <span className="ml-1 text-[10px] text-[#e4991e] font-semibold" data-testid={`timeline-offline-${i}`}>hors ligne · synchronisé {dateTimeFmt(t.synced_at)}</span> : null}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
