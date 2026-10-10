import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Clock, Plus, Trash2, Save } from "lucide-react";

const blank = () => ({ label: "", start: "09:00", end: "12:00", capacity: 5 });

export default function RiderSlotsEditor({ riderId }) {
  const [slots, setSlots] = useState([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get(`/riders/${riderId}/slots`).then(r => setSlots(r.data || [])).catch(() => {}); }, [riderId]);
  const set = (i, k, v) => setSlots(s => s.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const save = async () => {
    setSaving(true);
    try { const r = await api.put(`/riders/${riderId}/slots`, { slots: slots.map(({ used, ...s }) => ({ ...s, capacity: +s.capacity })) }); setSlots(r.data.map(s => ({ ...s, used: slots.find(x => x.id === s.id)?.used || 0 }))); toast.success("Créneaux enregistrés"); }
    catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
    finally { setSaving(false); }
  };
  return (
    <div className="dina-card-white p-4" data-testid="rider-slots">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-sm flex items-center gap-1.5"><Clock size={14} className="text-[#b02a2a]"/>Créneaux de livraison</div>
        <button onClick={() => setSlots(s => [...s, blank()])} className="text-xs text-[#b02a2a] font-semibold hover:underline inline-flex items-center gap-1" data-testid="slot-add"><Plus size={12}/>Ajouter</button>
      </div>
      {slots.length === 0 && <div className="text-xs text-[#999] text-center py-4">Aucun créneau · ajoutez-en pour les proposer lors de l'affectation</div>}
      <div className="space-y-2">
        {slots.map((s, i) => (
          <div key={s.id || `new-${i}`} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center" data-testid={`slot-row-${i}`}>
            <input className="dina-input !min-h-[36px] text-sm" placeholder="Ex. Matin" value={s.label} onChange={e => set(i, "label", e.target.value)} data-testid={`slot-label-${i}`}/>
            <input type="time" className="dina-input !min-h-[36px] text-sm w-[105px]" value={s.start} onChange={e => set(i, "start", e.target.value)} data-testid={`slot-start-${i}`}/>
            <input type="time" className="dina-input !min-h-[36px] text-sm w-[105px]" value={s.end} onChange={e => set(i, "end", e.target.value)} data-testid={`slot-end-${i}`}/>
            <input type="number" min="1" title="Commandes max" className="dina-input !min-h-[36px] text-sm w-[70px] tabular" value={s.capacity} onChange={e => set(i, "capacity", e.target.value)} data-testid={`slot-capacity-${i}`}/>
            <button onClick={() => setSlots(x => x.filter((_, j) => j !== i))} className="p-1.5 text-[#999] hover:text-[#c62828]" data-testid={`slot-delete-${i}`}><Trash2 size={14}/></button>
            {s.id && <div className="col-span-5 -mt-1 text-[10px] text-[#666]">{s.used || 0}/{s.capacity} commande(s) en cours dans ce créneau</div>}
          </div>
        ))}
      </div>
      <div className="flex justify-end mt-3"><button onClick={save} disabled={saving} className="dina-btn-primary !min-h-[36px] text-xs" data-testid="slots-save"><Save size={12}/>{saving ? "Enregistrement…" : "Enregistrer"}</button></div>
    </div>
  );
}
