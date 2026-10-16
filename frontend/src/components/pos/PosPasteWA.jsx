import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { X, Sparkles } from "lucide-react";
import { fcfa } from "@/lib/format";

/** Paste a WhatsApp order message, Dina IA parses it into cart items + customer hints. */
export default function PosPasteWA({ onApply, onClose }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [catalog, setCatalog] = useState([]);
  useEffect(() => { api.get("/products").then(r => setCatalog(r.data || [])).catch(() => {}); }, []);
  const pick = (i, pid) => {
    const p = catalog.find(x => x.id === pid);
    setParsed(d => ({ ...d, items: d.items.map((it, k) => k === i ? { ...it, product_id: p?.id, name: p?.name || it.name, price: p?.price || 0, image: p?.image, manual: true,
      size: (p?.sizes || []).includes(it.size) ? it.size : ((p?.sizes || []).length === 1 ? p.sizes[0] : null),
      color: (p?.colors || []).includes(it.color) ? it.color : ((p?.colors || []).length === 1 ? p.colors[0] : null) } : it) }));
  };
  const setVar = (i, key, val) => setParsed(d => ({ ...d, items: d.items.map((it, k) => k === i ? { ...it, [key]: val || null } : it) }));
  const prodOf = (it) => catalog.find(x => x.id === it.product_id);
  const stockOf = (p, size, color) => {
    const v = (p?.variants || []).find(x => (!size || x.size === size) && (!color || x.color === color) && x.enabled !== false);
    return v ? Number(v.stock || 0) : null;
  };
  const missingVar = (it) => { const p = prodOf(it); return it.manual && p && (((p.sizes || []).length && !it.size) || ((p.colors || []).length && !it.color)); };

  const parse = async () => {
    if (!text.trim()) return toast.error("Collez un message WhatsApp");
    setLoading(true);
    try {
      const { data } = await api.post("/ai/parse-order", { text });
      if (data.error) toast.error(data.error);
      setParsed(data);
    } catch { toast.error("IA indisponible"); } finally { setLoading(false); }
  };

  const apply = () => {
    if (!parsed) return;
    if (parsed.possible_duplicate && !window.confirm(`Une commande similaire existe déjà (${parsed.possible_duplicate.code}, moins de 24 h). Continuer quand même ?`)) return;
    const missing = (parsed.items || []).filter(it => !it.product_id).length;
    const noVar = (parsed.items || []).filter(missingVar).length;
    if (noVar) return toast.error(`Choisissez la taille et la couleur de ${noVar} article(s)`);
    if (missing && !window.confirm(`${missing} article(s) non identifié(s) seront ignorés. Continuer ?`)) return;
    const items = (parsed.items||[]).filter(it => it.product_id).map(it => ({
      product_id: it.product_id, name: it.name, size: it.size || null, color: it.color || null,
      qty: Number(it.qty||1), price: Number(it.price||0), image: it.image,
    }));
    if (!items.length) return toast.error("Aucun article identifié avec certitude");
    onApply({ items, customer_hint: parsed.customer_hint || {} });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-end sm:place-items-center z-50 p-0 sm:p-4" onClick={onClose} data-testid="paste-wa-modal">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-xl max-h-[92vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-[#ececec] dark:border-[#2a2a2a]">
          <div className="flex items-center gap-2"><div className="w-9 h-9 rounded-lg bg-[#fff5f5] text-[#b02a2a] grid place-items-center"><Sparkles size={16}/></div><div><div className="font-serif text-lg">Coller une commande WhatsApp</div><div className="text-xs text-[#666]">Dina IA remplit le panier automatiquement</div></div></div>
          <button onClick={onClose}><X size={18}/></button>
        </div>
        <div className="p-5 space-y-3">
          <textarea className="dina-input" rows={6} placeholder={`Collez le message de la cliente ici. Ex.:\n\n« Bonjour, je veux la mule Nora noire en 39 et le sac Awa, livré à Angré »`} value={text} onChange={e=>setText(e.target.value)} data-testid="paste-wa-text"/>
          <button onClick={parse} disabled={loading||!text.trim()} className="dina-btn-primary w-full" data-testid="paste-wa-parse"><Sparkles size={14}/>{loading?"Analyse en cours…":"Analyser avec Dina IA"}</button>

          {parsed && (
            <div className="mt-3 border border-[#ececec] dark:border-[#2a2a2a] rounded-xl p-3">
              {parsed.possible_duplicate && <div className="mb-2 text-xs bg-[#fff4e0] text-[#8a5a00] rounded p-2" data-testid="paste-wa-duplicate">⚠ Commande similaire déjà créée pour ce numéro : <b>{parsed.possible_duplicate.code}</b>. Vérifiez avant de recréer.</div>}
              <div className="text-[10px] uppercase font-semibold text-[#666] mb-2">Articles identifiés · confiance {(parsed.confidence*100||0).toFixed(0)}%</div>
              {(parsed.items||[]).length === 0 ? <div className="text-sm text-[#c62828]">Aucun article trouvé — vérifiez l'orthographe ou ajoutez-les manuellement.</div> :
                (parsed.items||[]).map((it, i) => (
                  <div key={i} className={`flex items-center gap-2 py-1.5 ${!it.product_id?"bg-[#fff8e8] rounded px-1":""}`}>
                    <div className="w-10 h-10 rounded bg-[#fff5f5] overflow-hidden shrink-0">{it.image && <img src={it.image} alt="" className="w-full h-full object-cover"/>}</div>
                    <div className="flex-1 min-w-0"><div className="text-sm font-medium break-words">{it.qty}× {it.name || "Produit inconnu"}</div><div className="text-xs text-[#666]">{[it.size,it.color].filter(Boolean).join(" · ") || "sans variante"}{!it.product_id?" · ⚠ non identifié":""}</div>
                      {!it.product_id && <select className="dina-input !min-h-[32px] text-xs mt-1 !opacity-100" value="" onChange={e => pick(i, e.target.value)} data-testid={`paste-wa-pick-${i}`}><option value="">Choisir le produit…</option>{catalog.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
                      {it.manual && <VariantPick it={it} i={i} p={prodOf(it)} setVar={setVar} stockOf={stockOf} missing={missingVar(it)}/>}</div>
                    {it.price>0 && <div className="tabular text-sm font-semibold">{fcfa(it.qty*it.price)}</div>}
                  </div>
                ))
              }
              {parsed.customer_hint && (parsed.customer_hint.name || parsed.customer_hint.phone || parsed.customer_hint.zone) && (
                <div className="mt-2 pt-2 border-t border-[#ececec] dark:border-[#2a2a2a] text-xs text-[#666]">
                  <b>Cliente :</b> {parsed.customer_hint.name || "?"}{parsed.customer_hint.phone?` · ${parsed.customer_hint.phone}`:""}{parsed.customer_hint.zone?` · ${parsed.customer_hint.zone}`:""}
                  {parsed.customer_hint.address && <div className="mt-0.5"><b>Adresse :</b> {parsed.customer_hint.address}</div>}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="sticky bottom-0 bg-white dark:bg-[#1a1a1a] border-t border-[#ececec] dark:border-[#2a2a2a] p-4 flex gap-2">
          <button onClick={onClose} className="dina-btn-secondary flex-1">Fermer</button>
          <button onClick={apply} disabled={!parsed || !(parsed.items||[]).filter(i=>i.product_id).length} className="dina-btn-primary flex-1" data-testid="paste-wa-apply">Remplir le panier</button>
        </div>
      </div>
    </div>
  );
}

function VariantPick({ it, i, p, setVar, stockOf, missing }) {
  if (!p || (!(p.sizes || []).length && !(p.colors || []).length)) return null;
  const opt = (key, values) => values.map(v => {
    const s = key === "size" ? stockOf(p, v, it.color) : stockOf(p, it.size, v);
    return <option key={v} value={v} disabled={s === 0}>{v}{s === 0 ? " (épuisé)" : s != null ? ` (${s})` : ""}</option>;
  });
  return (
    <div className="flex flex-wrap gap-1.5 mt-1" data-testid={`paste-wa-variant-${i}`}>
      {(p.sizes || []).length > 0 && <select className={`dina-input !min-h-[32px] text-xs !w-auto !opacity-100 ${missing && !it.size ? "!border-[#c62828]" : ""}`} value={it.size || ""} onChange={e => setVar(i, "size", e.target.value)} data-testid={`paste-wa-size-${i}`}><option value="">Taille…</option>{opt("size", p.sizes)}</select>}
      {(p.colors || []).length > 0 && <select className={`dina-input !min-h-[32px] text-xs !w-auto !opacity-100 ${missing && !it.color ? "!border-[#c62828]" : ""}`} value={it.color || ""} onChange={e => setVar(i, "color", e.target.value)} data-testid={`paste-wa-color-${i}`}><option value="">Couleur…</option>{opt("color", p.colors)}</select>}
    </div>
  );
}
