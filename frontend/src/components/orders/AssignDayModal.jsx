import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { X, Truck } from "lucide-react";

// Bulk "Affecter à une journée de livraison": reuse the rider's open session for that date or create it.
export default function AssignDayModal({ orders, onClose, onDone }) {
  const [riders, setRiders] = useState([]);
  const [riderId, setRiderId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get("/users").then(r => setRiders((r.data || []).filter(u => u.role === "rider" && u.active !== false))).catch(() => toast.error("Livreurs indisponibles"));
  }, []);
  const submit = async () => {
    const rider = riders.find(r => r.id === riderId);
    if (!rider) return toast.error("Choisissez un livreur");
    setBusy(true);
    try {
      const s = await api.get("/delivery-sessions", { params: { rider_id: rider.id, date } });
      let sid = (s.data || []).find(x => !x.closed)?.id;
      if (!sid) sid = (await api.post("/delivery-sessions", { rider_id: rider.id, rider_name: rider.name, date })).data.id;
      for (const o of orders) await api.patch(`/delivery-sessions/${sid}/add-order`, { order_id: o.id });
      toast.success(`${orders.length} commande(s) affectée(s) à ${rider.name} · ${new Date(date).toLocaleDateString("fr-FR")}`);
      onDone();
    } catch (e) { toast.error(e?.response?.data?.detail || "Affectation impossible · réessayez"); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-end sm:place-items-center p-0 sm:p-4" data-testid="assign-day-modal">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-md">
        <div className="flex justify-between items-start mb-4">
          <div><div className="font-serif text-xl">Affecter à une journée de livraison</div><div className="text-xs text-[#666]">{orders.length} commande(s) prête(s) · {orders.map(o => o.code).join(", ")}</div></div>
          <button onClick={onClose} data-testid="assign-day-close"><X size={16}/></button>
        </div>
        <label className="text-xs text-[#666]">Journée</label>
        <input type="date" className="dina-input mt-1 mb-3" value={date} onChange={e => setDate(e.target.value)} data-testid="assign-day-date"/>
        <label className="text-xs text-[#666]">Livreur</label>
        <select className="dina-input mt-1 mb-4" value={riderId} onChange={e => setRiderId(e.target.value)} data-testid="assign-day-rider">
          <option value="">Choisir…</option>
          {riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <div className="flex gap-2">
          <button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button>
          <button onClick={submit} disabled={busy} className="dina-btn-primary flex-1" data-testid="assign-day-submit"><Truck size={14}/>{busy ? "Affectation…" : "Affecter"}</button>
        </div>
      </div>
    </div>
  );
}
