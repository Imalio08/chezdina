import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";
import { toast } from "sonner";
import { Gift, Star, Users, Save, Plus, Trash2 } from "lucide-react";
import SaveButton from "@/components/shared/SaveButton";

export default function Loyalty() {
  const [s, setS] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [a, b] = await Promise.all([api.get("/loyalty/settings"), api.get("/customers")]);
      setS(a.data); setCustomers(b.data);
    } catch { toast.error("Erreur"); }
  };
  useEffect(() => { load(); }, []);

  const update = (patch) => setS({ ...s, ...patch });
  const addTier = () => setS({ ...s, tiers: [...(s.tiers || []), { name: "Nouveau palier", min_points: 0, discount_pct: 0, free_delivery: false }] });
  const removeTier = (i) => setS({ ...s, tiers: s.tiers.filter((_, idx) => idx !== i) });
  const updateTier = (i, patch) => setS({ ...s, tiers: s.tiers.map((t, idx) => idx === i ? { ...t, ...patch } : t) });

  const save = async () => {
    setSaving(true);
    try {
      await api.patch("/loyalty/settings", s);
      toast.success("Règles de fidélité enregistrées");
    } catch { toast.error("Erreur"); } finally { setSaving(false); }
  };

  if (!s) return <div className="text-sm text-[#666]">Chargement…</div>;

  const byTier = customers.reduce((a, x) => { const t = x.tier || "Bronze"; a[t] = (a[t] || 0) + 1; return a; }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Fidélité</h1><p className="text-sm text-[#666]">Points, paliers et avantages personnalisables</p></div>
        <SaveButton loading={saving} onClick={save} testid="loyalty-save" className="!min-h-[40px]"/>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(s.tiers || []).map(t => (
          <div key={t.name} className="dina-card-white p-4">
            <div className="text-xs uppercase text-[#666] mb-2 flex items-center gap-2"><Star size={14} />{t.name}</div>
            <div className="font-serif text-3xl tabular">{byTier[t.name] || 0}</div>
            <div className="text-xs text-[#666] mt-1">clientes · à partir de {t.min_points} pts</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="dina-card-white p-5">
          <div className="font-semibold mb-3 flex items-center gap-2"><Gift size={16} />Règles générales</div>
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={s.enabled !== false} onChange={e => update({ enabled: e.target.checked })} className="accent-[#b02a2a]" data-testid="loyalty-enabled" />
              <span className="text-sm">Programme fidélité actif</span>
            </label>
            <div>
              <label className="text-xs uppercase font-semibold text-[#666]">Points</label>
              <div className="flex items-center gap-2 mt-1 text-sm">
                <span>1 point gagné pour</span>
                <input type="number" className="dina-input tabular text-right w-28" value={s.points_per_fcfa} onChange={e => update({ points_per_fcfa: +e.target.value })} data-testid="loyalty-pts-rate" />
                <span>FCFA dépensés</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold text-[#666]">Bonus parrain</label>
                <input type="number" className="dina-input tabular text-right" value={s.referral_bonus_parrain} onChange={e => update({ referral_bonus_parrain: +e.target.value })} data-testid="loyalty-bonus-parrain" />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold text-[#666]">Bonus filleul</label>
                <input type="number" className="dina-input tabular text-right" value={s.referral_bonus_filleul} onChange={e => update({ referral_bonus_filleul: +e.target.value })} data-testid="loyalty-bonus-filleul" />
              </div>
            </div>
            <div className="pt-3 mt-3 border-t border-[#ececec] dark:border-[#2a2a2a]">
              <div className="text-xs uppercase font-semibold text-[#666] mb-2">Code de parrainage</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] uppercase text-[#999]">Préfixe</label>
                  <input className="dina-input !py-1.5 text-sm font-mono" value={s.referral_code_prefix || "DINA"} onChange={e => update({ referral_code_prefix: e.target.value.toUpperCase().slice(0, 8) })} data-testid="loyalty-code-prefix" placeholder="DINA"/>
                </div>
                <div>
                  <label className="text-[10px] uppercase text-[#999]">Longueur</label>
                  <input type="number" min="3" max="8" className="dina-input !py-1.5 text-sm tabular text-right" value={s.referral_code_length || 4} onChange={e => update({ referral_code_length: Math.max(3, Math.min(8, +e.target.value || 4)) })} data-testid="loyalty-code-length"/>
                </div>
                <div>
                  <label className="text-[10px] uppercase text-[#999]">Validité (jours)</label>
                  <input type="number" min="1" className="dina-input !py-1.5 text-sm tabular text-right" value={s.referral_validity_days || 90} onChange={e => update({ referral_validity_days: Math.max(1, +e.target.value || 90) })} data-testid="loyalty-validity"/>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-[#666]">Aperçu du code : <span className="font-mono bg-[#fff5f5] dark:bg-[#2a1818] px-2 py-0.5 rounded text-[#b02a2a]" data-testid="loyalty-code-preview">{(s.referral_code_prefix || "DINA")}-{"X".repeat(s.referral_code_length || 4)}</span> · récompenses valides {s.referral_validity_days || 90} jours</div>
            </div>
          </div>
        </div>

        <div className="dina-card-white p-5">
          <div className="flex justify-between items-center mb-3">
            <div className="font-semibold flex items-center gap-2"><Users size={16} />Paliers</div>
            <button onClick={addTier} className="dina-btn-secondary !min-h-[32px] text-xs" data-testid="loyalty-add-tier"><Plus size={12} />Ajouter</button>
          </div>
          <div className="space-y-2">
            {(s.tiers || []).map((t, i) => (
              <div key={i} className="grid grid-cols-[1fr_90px_90px_60px_28px] gap-2 items-end" data-testid={`loyalty-tier-${i}`}>
                <div>
                  <label className="text-[10px] uppercase text-[#999]">Nom</label>
                  <input className="dina-input !py-1.5 text-sm" value={t.name} onChange={e => updateTier(i, { name: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-[#999]">Min pts</label>
                  <input type="number" className="dina-input !py-1.5 text-sm tabular text-right" value={t.min_points} onChange={e => updateTier(i, { min_points: +e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-[#999]">Remise %</label>
                  <input type="number" className="dina-input !py-1.5 text-sm tabular text-right" value={t.discount_pct} onChange={e => updateTier(i, { discount_pct: +e.target.value })} />
                </div>
                <label className="flex flex-col items-center text-[10px] uppercase text-[#999]">Livr.<input type="checkbox" checked={!!t.free_delivery} onChange={e => updateTier(i, { free_delivery: e.target.checked })} className="accent-[#b02a2a] mt-1" /></label>
                <button onClick={() => removeTier(i)} className="text-[#c62828] pb-2"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dina-card-white p-5">
        <div className="font-semibold mb-3 flex items-center gap-2"><Users size={16} />Top ambassadrices</div>
        <table className="dina-table">
          <thead><tr><th>Cliente</th><th>Code</th><th className="text-right">Points</th><th>Niveau</th><th className="text-right">Porte-monnaie</th></tr></thead>
          <tbody>{customers.sort((a, b) => (b.loyalty_points || 0) - (a.loyalty_points || 0)).slice(0, 15).map(x => (
            <tr key={x.id}><td className="font-medium">{x.name}</td><td className="font-mono text-xs">{x.referral_code}</td><td className="text-right tabular font-semibold">{x.loyalty_points || 0}</td><td><span className="dina-chip">{x.tier || "Bronze"}</span></td><td className="text-right tabular">{fcfa(x.wallet || 0)}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
