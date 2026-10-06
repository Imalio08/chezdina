import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa, statusLabel, statusColor, dateFmt } from "@/lib/format";
import { ChevronDown, ChevronUp, Clock, Check } from "lucide-react";

const PERIODS = [{ v: 1, label: "Aujourd'hui" }, { v: 7, label: "Semaine" }, { v: 30, label: "Mois" }, { v: 90, label: "3 mois" }];

export default function Historique() {
  const [sessions, setSessions] = useState([]);
  const [tab, setTab] = useState("toutes");
  const [period, setPeriod] = useState(30);
  const [openIds, setOpenIds] = useState({});
  useEffect(() => { api.get(`/riders/me/history?days=${period}`).then(r => setSessions(r.data)).catch(() => { }); }, [period]);

  const matchTab = (o) => tab === "toutes" || (tab === "livrees" && o.status === "livree") || (tab === "annulees" && o.status === "annulee") || (tab === "reportees" && o.status === "reportee") || (tab === "echecs" && o.status === "echouee");

  const totalDeliv = sessions.reduce((s, x) => s + (x.delivered_count || 0), 0);
  const totalColl = sessions.reduce((s, x) => s + (x.collected_total || 0), 0);
  const totalEcart = sessions.reduce((s, x) => s + Object.values(x.reconciliations || {}).reduce((a, b) => a + (typeof b === "object" ? b.ecart || 0 : 0), 0), 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <KPI label="Jours" v={sessions.length} />
        <KPI label="Livraisons" v={totalDeliv} c="#1f8a4c" />
        <KPI label="Encaissé" v={fcfa(totalColl)} c="#b02a2a" wide />
        <KPI label="Écarts cumulés" v={fcfa(totalEcart)} c={totalEcart >= 0 ? "#1f8a4c" : "#c62828"} wide />
      </div>
      <div className="flex gap-1 overflow-x-auto scrollbar-thin -mx-3 px-3">
        {PERIODS.map(p => <button key={p.v} onClick={() => setPeriod(p.v)} className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border ${period === p.v ? "bg-[#1c1c1c] text-white dark:bg-white dark:text-[#1c1c1c] border-transparent" : "border-[#ececec]"}`} data-testid={`hist-period-${p.v}`}>{p.label}</button>)}
      </div>
      <div className="flex gap-1 overflow-x-auto scrollbar-thin -mx-3 px-3">
        {[["toutes","Toutes"],["livrees","Livrées"],["annulees","Annulées"],["reportees","Reportées"],["echecs","Échecs"]].map(([k,label]) => <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border ${tab === k ? "bg-[#b02a2a] text-white border-[#b02a2a]" : "border-[#ececec]"}`} data-testid={`hist-tab-${k}`}>{label}</button>)}
      </div>

      <div className="space-y-2">
        {sessions.length === 0 && <div className="text-center text-sm text-[#666] py-10">Aucune journée</div>}
        {sessions.map(s => {
          const open = openIds[s.id];
          const orders = (s.orders_detail || []).filter(matchTab);
          const recVals = Object.values(s.reconciliations || {});
          const ecart = recVals.reduce((a, r) => a + (typeof r === "object" ? r.ecart || 0 : 0), 0);
          return (
            <div key={s.id} className="dina-card-white overflow-hidden" data-testid={`hist-day-${s.date}`}>
              <button className="w-full p-3 flex items-center gap-2" onClick={() => setOpenIds({ ...openIds, [s.id]: !open })}>
                <Clock size={14} className="text-[#666]" />
                <div className="flex-1 text-left">
                  <div className="font-semibold text-sm">{s.date}</div>
                  <div className="text-[11px] text-[#666]">{s.delivered_count || 0} livrées · encaissé {fcfa(s.collected_total || 0)}</div>
                </div>
                <span className={`dina-chip text-[10px] ${ecart === 0 ? "!text-[#1f8a4c] !border-[#1f8a4c]" : "!text-[#c62828] !border-[#c62828]"}`}>{ecart === 0 ? <><Check size={9} />Validée</> : `Écart ${fcfa(ecart)}`}</span>
                {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {open && (
                <div className="border-t border-[#ececec] dark:border-[#2a2a2a] p-3 space-y-1.5">
                  {orders.length === 0 ? <div className="text-xs text-[#666] text-center py-4">Aucune commande dans ce filtre</div> :
                    orders.map(o => (
                      <div key={o.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-[#f5f5f5] dark:border-[#2a2a2a] last:border-0">
                        <div className="flex-1">
                          <div className="font-medium">{o.code} · {(o.customer?.name || "").split(" ")[0]}</div>
                          <div className="text-[10px] text-[#999]">{o.customer?.phone_masked || o.delivery_zone}</div>
                          {o.last_reason && <div className="text-[10px] italic text-[#c62828]">« {o.last_reason} »</div>}
                        </div>
                        <span className="dina-chip text-[9px]" style={{ color: statusColor[o.status] }}>{statusLabel[o.status]}</span>
                        <div className="tabular font-semibold">{fcfa(o.total)}</div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
function KPI({ label, v, c, wide }) {
  return <div className="dina-card-white p-3"><div className="text-[10px] uppercase text-[#999]">{label}</div><div className="font-serif text-xl tabular mt-0.5" style={{ color: c }}>{v}</div></div>;
}
