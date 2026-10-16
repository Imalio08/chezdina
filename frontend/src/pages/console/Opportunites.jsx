import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BellRing, Search, ShoppingBag, DollarSign, TrendingUp } from "lucide-react";
import api from "@/lib/api";
import { fcfa, fcfaCompact } from "@/lib/format";
import KPICard from "@/components/shared/KPICard";
import Waitlist from "@/pages/console/Waitlist";
import AbandonedCarts from "@/pages/console/AbandonedCarts";

const TABS = [["attente", "Liste d'attente"], ["hors", "Demandes hors catalogue"], ["paniers", "Paniers abandonnés"]];

function useKpis() {
  const [k, setK] = useState(null);
  useEffect(() => {
    Promise.all([
      api.get("/waitlist/grouped").catch(() => ({ data: {} })),
      api.get("/out-of-catalog").catch(() => ({ data: {} })),
      api.get("/abandoned-carts").catch(() => ({ data: [] })),
    ]).then(([w, o, c]) => {
      const carts = c.data || [];
      const open = carts.filter(x => !x.recovered);
      const recovered = carts.filter(x => x.recovered).length;
      setK({ pending: w.data?.pending || 0, ooc: o.data?.total || 0, carts: carts.length,
        value: open.reduce((s, x) => s + (x.total || x.value || 0), 0), rate: carts.length ? Math.round(recovered / carts.length * 100) : 0 });
    });
  }, []);
  return k;
}

export default function Opportunites() {
  const [sp, setSp] = useSearchParams();
  const tab = TABS.some(([k]) => k === sp.get("tab")) ? sp.get("tab") : "attente";
  const k = useKpis();
  return (
    <div className="space-y-5" data-testid="opportunites-page">
      <div><h1 className="font-serif text-3xl">Opportunités</h1><p className="text-sm text-[#666]">Ventes à récupérer : clientes en attente, demandes hors catalogue et paniers abandonnés</p></div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <KPICard testid="opp-pending" label="Demandes en attente" value={k?.pending ?? "…"} icon={BellRing} color="#e4991e"/>
        <KPICard testid="opp-ooc" label="Demandes hors catalogue" value={k?.ooc ?? "…"} icon={Search} color="#5867fd"/>
        <KPICard testid="opp-carts" label="Paniers abandonnés" value={k?.carts ?? "…"} icon={ShoppingBag} color="#b02a2a"/>
        <KPICard testid="opp-value" label="Valeur à récupérer" value={k ? fcfaCompact(k.value) : "…"} valueFull={k ? fcfa(k.value) : undefined} icon={DollarSign} color="#b02a2a"/>
        <KPICard testid="opp-rate" label="Taux de récupération" value={k ? `${k.rate} %` : "…"} icon={TrendingUp} color="#1f8a4c"/>
      </div>
      <div className="flex gap-1 bg-[#f5f5f5] dark:bg-[#1a1a1a] p-1 rounded-lg w-fit max-w-full overflow-x-auto">
        {TABS.map(([key, label]) => <button key={key} onClick={() => setSp({ tab: key }, { replace: true })} className={`px-4 py-1.5 text-sm rounded-md whitespace-nowrap ${tab === key ? "bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold" : ""}`} data-testid={`opp-tab-${key}`}>{label}</button>)}
      </div>
      {tab === "attente" && <Waitlist embedded section="groups"/>}
      {tab === "hors" && <Waitlist embedded section="ooc"/>}
      {tab === "paniers" && <AbandonedCarts embedded/>}
    </div>
  );
}
