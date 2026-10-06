import React, { useMemo } from "react";
import { Check, X, Zap } from "lucide-react";

/**
 * Grille taille × couleur :
 * - Chaque cellule est une variante réelle (existe = true/false)
 * - Si existe → input stock
 * - Boutons "Tout activer" par ligne (couleur) et par colonne (taille)
 * - Boutons globaux "Tout activer" et "Désactiver tout"
 *
 * Props:
 * - sizes, colors: string[]
 * - variants: [{ size, color, stock, enabled, price? }]
 * - onChange(nextVariants)
 */
export default function VariantsGrid({ sizes = [], colors = [], variants = [], onChange }) {
  const keyOf = (s, c) => `${s}||${c}`;
  const map = useMemo(() => {
    const m = {};
    variants.forEach(v => { m[keyOf(v.size, v.color)] = v; });
    return m;
  }, [variants]);

  const emit = (nextMap) => {
    const out = [];
    sizes.forEach(s => colors.forEach(c => {
      const v = nextMap[keyOf(s, c)];
      if (v && v.enabled) out.push({ size: s, color: c, stock: Number(v.stock || 0), enabled: true, price: v.price ?? null });
    }));
    onChange(out);
  };

  const toggle = (s, c) => {
    const k = keyOf(s, c);
    const cur = map[k];
    const next = { ...map, [k]: { size: s, color: c, enabled: !cur?.enabled, stock: cur?.stock ?? 0, price: cur?.price ?? null } };
    emit(next);
  };
  const setStock = (s, c, stock) => {
    const k = keyOf(s, c);
    const cur = map[k] || { size: s, color: c, enabled: true, stock: 0 };
    const next = { ...map, [k]: { ...cur, enabled: true, stock: Math.max(0, Number(stock) || 0) } };
    emit(next);
  };
  const enableRow = (c, enable = true) => {
    const next = { ...map };
    sizes.forEach(s => {
      const k = keyOf(s, c);
      next[k] = { ...(next[k] || { size: s, color: c, stock: 0 }), enabled: enable };
    });
    emit(next);
  };
  const enableCol = (s, enable = true) => {
    const next = { ...map };
    colors.forEach(c => {
      const k = keyOf(s, c);
      next[k] = { ...(next[k] || { size: s, color: c, stock: 0 }), enabled: enable };
    });
    emit(next);
  };
  const enableAll = (enable) => {
    const next = { ...map };
    sizes.forEach(s => colors.forEach(c => {
      const k = keyOf(s, c);
      next[k] = { ...(next[k] || { size: s, color: c, stock: enable ? 2 : 0 }), enabled: enable };
    }));
    emit(next);
  };

  if (!sizes.length || !colors.length) {
    return (
      <div className="text-xs text-[#666] italic p-4 border border-dashed border-[#ececec] dark:border-[#2a2a2a] rounded-lg">
        Sélectionnez au moins une taille et une couleur pour construire la grille de variantes.
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="variants-grid">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-[#666]">
          <b>{variants.filter(v => v.enabled).length}</b> combinaisons existantes sur {sizes.length * colors.length} possibles · stock total <b>{variants.reduce((s, v) => s + (v.enabled ? Number(v.stock || 0) : 0), 0)}</b>
        </div>
        <div className="flex gap-1">
          <button onClick={() => enableAll(true)} className="dina-chip text-[10px] !text-[#1f8a4c] !border-[#1f8a4c]" data-testid="var-enable-all"><Zap size={10}/>Tout activer</button>
          <button onClick={() => enableAll(false)} className="dina-chip text-[10px] !text-[#c62828]" data-testid="var-disable-all"><X size={10}/>Désactiver tout</button>
        </div>
      </div>
      <div className="overflow-x-auto border border-[#ececec] dark:border-[#2a2a2a] rounded-lg">
        <table className="w-full">
          <thead>
            <tr className="bg-[#fafafa] dark:bg-[#141414]">
              <th className="text-left px-2 py-2 text-[10px] uppercase text-[#666] sticky left-0 bg-[#fafafa] dark:bg-[#141414] z-10">Couleur \\ Taille</th>
              {sizes.map(s => (
                <th key={s} className="text-center px-1 py-2 min-w-[80px]">
                  <div className="text-xs font-bold">{s}</div>
                  <button onClick={() => enableCol(s)} className="text-[9px] text-[#5867fd] hover:underline" data-testid={`var-col-all-${s}`}>tout +</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {colors.map(c => (
              <tr key={c} className="border-t border-[#ececec] dark:border-[#2a2a2a]">
                <td className="px-2 py-1.5 sticky left-0 bg-white dark:bg-[#1a1a1a] z-10">
                  <div className="text-xs font-semibold">{c}</div>
                  <button onClick={() => enableRow(c)} className="text-[9px] text-[#5867fd] hover:underline" data-testid={`var-row-all-${c}`}>tout +</button>
                </td>
                {sizes.map(s => {
                  const k = keyOf(s, c);
                  const v = map[k];
                  const on = v?.enabled;
                  return (
                    <td key={s} className="px-1 py-1 text-center">
                      {on ? (
                        <div className="flex items-center gap-1 justify-center" data-testid={`var-cell-${s}-${c}`}>
                          <button onClick={() => toggle(s, c)} className="w-6 h-6 rounded-full bg-[#1f8a4c] text-white grid place-items-center shrink-0" title="Désactiver" data-testid={`var-off-${s}-${c}`}><Check size={11}/></button>
                          <input type="number" min="0" className="dina-input !py-1 tabular text-center text-xs w-14" value={v.stock || 0} onChange={e => setStock(s, c, e.target.value)} data-testid={`var-stock-${s}-${c}`}/>
                        </div>
                      ) : (
                        <button onClick={() => toggle(s, c)} className="w-6 h-6 rounded-full border border-dashed border-[#ddd] text-[#999] grid place-items-center mx-auto hover:border-[#1f8a4c] hover:text-[#1f8a4c]" title="N'existe pas · cliquer pour activer" data-testid={`var-on-${s}-${c}`}><X size={11}/></button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[10px] text-[#999] italic flex items-center gap-2">
        <Check size={10} className="text-[#1f8a4c]"/>Combinaison existante avec stock ·
        <X size={10}/>Combinaison inexistante (jamais affichée en vitrine)
      </div>
    </div>
  );
}
