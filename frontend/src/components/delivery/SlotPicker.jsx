import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Clock, X, AlertTriangle } from "lucide-react";

export const SlotBadge = ({ order }) => order?.delivery_slot ? (
  <span className="inline-flex items-center gap-1 text-[10px] text-[#5867fd] font-semibold" data-testid={`slot-badge-${order.code}`}>
    <Clock size={10}/>{order.delivery_slot.label} · {order.delivery_slot.start}–{order.delivery_slot.end}
  </span>
) : null;

export function SlotPickerModal({ riderId, riderName, count = 1, onCancel, onConfirm }) {
  const [slots, setSlots] = useState(null);
  const [choice, setChoice] = useState("");
  useEffect(() => {
    api.get(`/riders/${riderId}/slots`).then(r => setSlots(r.data || [])).catch(() => setSlots([]));
  }, [riderId]);
  useEffect(() => { if (slots && slots.length === 0) onConfirm(null); }, [slots]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!slots || slots.length === 0) return null;
  const chosen = slots.find(s => s.id === choice);
  const over = chosen && chosen.used + count > chosen.capacity;
  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()} data-testid="slot-picker-modal">
        <div className="flex items-center justify-between mb-1"><div className="font-serif text-xl">Choisir un créneau</div><button onClick={onCancel} data-testid="slot-picker-close"><X size={18}/></button></div>
        <p className="text-xs text-[#666] mb-3">{count} commande(s) → {riderName}</p>
        <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
          {slots.map(s => {
            const left = s.capacity - s.used;
            return (
              <label key={s.id} className={`flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer transition-colors ${choice === s.id ? "border-[#b02a2a] bg-[#fff5f5] dark:bg-[#2a1818]" : "border-[#ececec] dark:border-[#2a2a2a]"}`} data-testid={`slot-option-${s.id}`}>
                <input type="radio" name="slot" checked={choice === s.id} onChange={() => setChoice(s.id)} className="accent-[#b02a2a]"/>
                <div className="flex-1"><div className="text-sm font-medium">{s.label}</div><div className="text-xs text-[#666] tabular">{s.start} – {s.end}</div></div>
                <span className={`text-xs font-semibold tabular ${left <= 0 ? "text-[#e4991e]" : "text-[#1f8a4c]"}`}>{left <= 0 ? "Complet" : `${left} place(s)`} · {s.used}/{s.capacity}</span>
              </label>
            );
          })}
          <label className={`flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer ${choice === "" ? "border-[#b02a2a] bg-[#fff5f5] dark:bg-[#2a1818]" : "border-[#ececec] dark:border-[#2a2a2a]"}`} data-testid="slot-option-none">
            <input type="radio" name="slot" checked={choice === ""} onChange={() => setChoice("")} className="accent-[#b02a2a]"/>
            <div className="text-sm">Sans créneau</div>
          </label>
        </div>
        {over && <div className="mt-3 p-2 rounded-lg bg-[#fff8e8] dark:bg-[#2a2210] text-xs text-[#a86a00] flex items-center gap-1.5" data-testid="slot-full-warning"><AlertTriangle size={12}/>Ce créneau sera dépassé ({chosen.used + count}/{chosen.capacity}). L'affectation reste possible.</div>}
        <div className="flex gap-2 mt-4"><button onClick={onCancel} className="dina-btn-secondary flex-1">Annuler</button><button onClick={() => onConfirm(choice || null)} className="dina-btn-primary flex-1" data-testid="slot-picker-confirm"><Clock size={13}/>Affecter</button></div>
      </div>
    </div>
  );
}
