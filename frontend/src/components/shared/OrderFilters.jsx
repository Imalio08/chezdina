import React, { useMemo } from "react";
import { Search, X } from "lucide-react";
import { statusLabel } from "@/lib/format";

export const EMPTY_FILTERS = { q: "", status: "", date: "", slot: "", zone: "", rider: "" };
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const dayOf = (o) => (o.delivery_date || o.created_at || "").slice(0, 10);
export const slotOf = (o) => { const s = o.delivery_slot; return s && typeof s === "object" ? (s.label || [s.start, s.end].filter(Boolean).join("–")) : (s || ""); };

export function applyOrderFilters(orders, f) {
  const q = norm(f.q);
  return orders.filter(o =>
    (!q || norm([o.code, o.customer?.name, o.customer?.phone, o.delivery_zone, o.delivery_address].join(" ")).includes(q)) &&
    (!f.status || o.status === f.status) &&
    (!f.date || dayOf(o) === f.date) &&
    (!f.slot || slotOf(o) === f.slot) &&
    (!f.zone || o.delivery_zone === f.zone) &&
    (!f.rider || (f.rider === "__none__" ? !o.rider_id : o.rider_id === f.rider))
  );
}

const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();

// Reusable filter bar · fields: q, status, date, slot, zone, rider
export function OrderFilters({ orders, value, onChange, fields = ["q", "date", "slot", "zone", "rider"], statuses = [], testid = "order-filters" }) {
  const opts = useMemo(() => ({
    slot: uniq(orders.map(slotOf)),
    zone: uniq(orders.map(o => o.delivery_zone)),
    rider: Object.entries(Object.fromEntries(orders.filter(o => o.rider_id).map(o => [o.rider_id, o.rider_name || "Livreur"]))),
  }), [orders]);
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const active = Object.entries(value).filter(([k, v]) => v && fields.includes(k)).length;
  const sel = "dina-input !min-h-[38px] text-xs w-full";
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap gap-2 items-center" data-testid={testid}>
      {fields.includes("q") && (
        <div className="relative col-span-2 sm:col-span-3 lg:flex-1 lg:min-w-[220px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]"/>
          <input className="dina-input !min-h-[38px] pl-8 text-sm w-full" placeholder="Rechercher code, cliente, téléphone, adresse…" value={value.q} onChange={set("q")} data-testid={`${testid}-q`}/>
        </div>
      )}
      {fields.includes("status") && (
        <select className={`${sel} lg:w-auto`} value={value.status} onChange={set("status")} data-testid={`${testid}-status`}>
          <option value="">Tous statuts</option>
          {statuses.map(s => <option key={s} value={s}>{statusLabel[s] || s}</option>)}
        </select>
      )}
      {fields.includes("date") && <input type="date" className={`${sel} lg:w-auto`} value={value.date} onChange={set("date")} title="Date de livraison / commande" data-testid={`${testid}-date`}/>}
      {fields.includes("slot") && (
        <select className={`${sel} lg:w-auto`} value={value.slot} onChange={set("slot")} data-testid={`${testid}-slot`}>
          <option value="">Tous créneaux</option>
          {opts.slot.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      )}
      {fields.includes("zone") && (
        <select className={`${sel} lg:w-auto`} value={value.zone} onChange={set("zone")} data-testid={`${testid}-zone`}>
          <option value="">Toutes zones</option>
          {opts.zone.map(z => <option key={z} value={z}>{z}</option>)}
        </select>
      )}
      {fields.includes("rider") && (
        <select className={`${sel} lg:w-auto`} value={value.rider} onChange={set("rider")} data-testid={`${testid}-rider`}>
          <option value="">Tous livreurs</option>
          <option value="__none__">Sans livreur</option>
          {opts.rider.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
      )}
      {active > 0 && <button onClick={() => onChange({ ...EMPTY_FILTERS })} className="dina-chip !min-h-[38px] justify-center" data-testid={`${testid}-reset`}><X size={12}/>Effacer ({active})</button>}
    </div>
  );
}
