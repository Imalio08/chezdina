import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { fcfa, fcfaCompact } from "@/lib/format";
import { ShoppingBag, DollarSign, MessageSquare, CheckCircle, X, Send, Target, Upload, Trash2 } from "lucide-react";
import KPICard from "@/components/shared/KPICard";
import ImageUpload from "@/components/shared/ImageUpload";

const OFFER_TYPES = [
  { v:"none", label:"Aucune (simple rappel)" },
  { v:"pct", label:"Réduction en %" },
  { v:"amount", label:"Réduction en FCFA" },
  { v:"special_price", label:"Prix spécial sur un article" },
  { v:"free_delivery", label:"Livraison offerte" },
  { v:"gift", label:"Cadeau" },
  { v:"custom", label:"Offre personnalisée" },
];

const CHANNELS = [
  { v:"whatsapp", label:"WhatsApp" },
  { v:"inapp", label:"Message in-app" },
  { v:"popup", label:"Pop-up espace cliente" },
];

const STATUS_LABEL = { nouveau: "Nouveau", relance: "Relancé", recupere: "Récupéré", expire: "Expiré" };

export default function AbandonedCarts({ embedded }) {
  const [carts, setCarts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [relaunchFor, setRelaunchFor] = useState(null); // array of ids, or "all"

  const load = async () => { const r = await api.get("/abandoned-carts"); setCarts(r.data || []); };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (detailId) api.get(`/abandoned-carts/${detailId}`).then(r => setDetail(r.data)).catch(()=>setDetail(null));
    else setDetail(null);
  }, [detailId]);

  const total = carts.reduce((s,c)=>s+(c.total||c.value||0), 0);
  const relaunched = carts.filter(c => c.status === "relance").length;
  const recovered = carts.filter(c => c.recovered).length;
  const recoveredCA = carts.filter(c => c.recovered).reduce((s,c)=>s+(c.total||c.value||0),0);
  const rate = carts.length ? Math.round(recovered/carts.length*100) : 0;

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : [...s, id]);
  const launchRelaunch = () => {
    if (!selected.length) return toast.error("Sélectionnez des paniers");
    setRelaunchFor(selected);
  };

  return (
    <div className="space-y-5" data-testid="abandoned-carts-page">
      <div className="flex items-center justify-between flex-wrap gap-2">
        {!embedded && <div><h1 className="font-serif text-3xl">Paniers abandonnés</h1><p className="text-sm text-[#666]">Récupérez le chiffre d'affaires perdu</p></div>}
        <button onClick={()=>setRelaunchFor("all")} className="dina-btn-primary !min-h-[40px]" data-testid="relaunch-all"><Target size={14}/>Créer une offre de relance</button>
      </div>

      {!embedded && <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KPICard testid="ac-count" label="Paniers abandonnés" value={carts.length} icon={ShoppingBag} color="#e4991e"/>
        <KPICard testid="ac-value" label="Valeur totale" value={fcfaCompact(total)} valueFull={fcfa(total)} icon={DollarSign} color="#b02a2a"/>
        <KPICard testid="ac-relaunched" label="Relancés" value={relaunched} icon={MessageSquare} color="#5867fd"/>
        <KPICard testid="ac-recovered" label="Récupérés" value={recovered} icon={CheckCircle} color="#1f8a4c"/>
        <KPICard testid="ac-rate" label="Taux de récupération" value={`${rate}%`} color="#1f8a4c"/>
        <KPICard testid="ac-ca" label="Chiffre d'affaires récupéré" value={fcfaCompact(recoveredCA)} valueFull={fcfa(recoveredCA)} color="#1f8a4c"/>
      </div>}

      {selected.length > 0 && (
        <div className="flex items-center gap-2 bg-[#fff5f5] dark:bg-[#2a1818] p-2 rounded-lg text-sm">
          <span>{selected.length} panier{selected.length>1?"s":""} sélectionné{selected.length>1?"s":""}</span>
          <button onClick={launchRelaunch} className="dina-btn-primary !min-h-[32px] text-xs" data-testid="relaunch-selected">Relancer la sélection</button>
          <button onClick={()=>setSelected([])} className="text-xs text-[#c62828]">Tout désélectionner</button>
        </div>
      )}

      <div className="dina-card-white overflow-hidden">
        <table className="dina-table" data-testid="ac-table">
          <thead><tr><th className="w-8"></th><th>Cliente</th><th>Téléphone</th><th>Date</th><th className="text-right">Articles</th><th className="text-right">Valeur</th><th>Statut</th><th></th></tr></thead>
          <tbody>{carts.length === 0 ? <tr><td colSpan={8} className="text-center text-sm text-[#666] py-8">Aucun panier abandonné</td></tr> :
            carts.map(c => (
              <tr key={c.id} className={selected.includes(c.id)?"bg-[#fff5f5] dark:bg-[#2a1818]":""} data-testid={`ac-row-${c.id}`}>
                <td><input type="checkbox" checked={selected.includes(c.id)} onChange={()=>toggle(c.id)} className="accent-[#b02a2a]"/></td>
                <td className="font-medium">{(c.customer?.name) || c.customer_name || "—"}</td>
                <td className="text-xs text-[#666]">{(c.customer?.phone) || c.customer_phone || "—"}</td>
                <td className="text-xs text-[#666]">{new Date(c.created_at).toLocaleDateString("fr-FR")}</td>
                <td className="text-right tabular">{(c.items||[]).length}</td>
                <td className="text-right tabular font-semibold">{fcfa(c.total || c.value || 0)}</td>
                <td><span className="dina-chip !py-0.5 text-[10px]">{STATUS_LABEL[c.status||"nouveau"]}</span></td>
                <td className="text-right"><button onClick={()=>setDetailId(c.id)} className="text-[#5867fd] text-xs hover:underline" data-testid={`ac-open-${c.id}`}>Détails →</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && <DetailPanel data={detail} onClose={()=>setDetailId(null)} onRelaunch={()=>setRelaunchFor([detail.id])}/>}
      {relaunchFor && <RelaunchForm targets={relaunchFor} carts={carts} onClose={(sent)=>{setRelaunchFor(null); if(sent){setSelected([]); load();}}}/>}
    </div>
  );
}

function DetailPanel({ data, onClose, onRelaunch }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={onClose} data-testid="ac-detail-panel">
      <div className="w-full max-w-md bg-white dark:bg-[#1a1a1a] h-full overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-[#1a1a1a] p-4 border-b border-[#ececec] dark:border-[#2a2a2a] flex items-center justify-between">
          <div><div className="font-serif text-lg">Détail du panier</div><div className="text-xs text-[#666]">{new Date(data.created_at).toLocaleString("fr-FR")}</div></div>
          <button onClick={onClose}><X size={18}/></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-[#fff5f5] dark:bg-[#2a1818] rounded-xl p-3">
            <div className="text-[10px] uppercase text-[#666] font-semibold mb-2">Cliente</div>
            <div className="font-semibold">{data.customer?.name || data.customer_name}</div>
            <div className="text-xs text-[#666]">{data.customer?.phone || data.customer_phone}</div>
            {data.customer_full && (
              <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
                <div><div className="text-[#999]">Palier</div><div className="font-semibold">{data.customer_stats?.tier || "—"}</div></div>
                <div><div className="text-[#999]">Commandes</div><div className="font-semibold">{data.customer_stats?.orders_count || 0}</div></div>
                <div><div className="text-[#999]">Dépensé</div><div className="font-semibold tabular">{fcfa(data.customer_stats?.total_spent || 0)}</div></div>
              </div>
            )}
          </div>
          <div>
            <div className="text-[10px] uppercase text-[#666] font-semibold mb-2">Panier · {(data.items||[]).length} articles</div>
            {(data.items||[]).map((it,i) => (
              <div key={i} className="flex items-center gap-2 py-2 border-b border-[#f0f0f0] dark:border-[#2a2a2a] last:border-0">
                <div className="w-11 h-11 rounded bg-[#fff5f5] overflow-hidden shrink-0">{it.image && <img src={it.image} alt="" className="w-full h-full object-cover"/>}</div>
                <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{it.name}</div><div className="text-xs text-[#666]">{[it.size,it.color].filter(Boolean).join(" · ")}</div></div>
                <div className="text-right"><div className="text-xs">{it.qty}× {fcfa(it.price)}</div><div className="text-sm font-semibold tabular">{fcfa(it.qty*it.price)}</div></div>
              </div>
            ))}
            <div className="flex justify-between font-semibold text-base mt-2 pt-2 border-t"><span>Total</span><span className="tabular text-[#b02a2a]">{fcfa(data.total || data.value || 0)}</span></div>
          </div>
          {(data.reminders||[]).length > 0 && (
            <div>
              <div className="text-[10px] uppercase text-[#666] font-semibold mb-2">Relances envoyées</div>
              {data.reminders.map(r => (
                <div key={r.id} className="text-xs py-1.5 border-b border-[#f0f0f0] last:border-0">
                  <div>{new Date(r.sent_at).toLocaleString("fr-FR")} · <b>{r.channel}</b> · <code>{r.code||"—"}</code></div>
                  <div className="text-[#666] italic truncate">"{r.message?.slice(0,80)}"</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="sticky bottom-0 bg-white dark:bg-[#1a1a1a] p-3 border-t border-[#ececec] dark:border-[#2a2a2a]">
          <button onClick={onRelaunch} className="dina-btn-primary w-full" data-testid="ac-detail-relaunch"><Send size={14}/>Relancer cette cliente</button>
        </div>
      </div>
    </div>
  );
}

function RelaunchForm({ targets, carts, onClose }) {
  // Initial target mode: single/multiple preselect from targets prop; "all" if string
  const initialSingle = Array.isArray(targets) && targets.length === 1;
  const initialAll = targets === "all";
  const [mode, setMode] = useState(initialAll ? "all" : initialSingle ? "single" : "selected");
  const [selectedIds, setSelectedIds] = useState(Array.isArray(targets) ? targets : []);
  const [attachImage, setAttachImage] = useState(false);
  const [image, setImage] = useState("");
  const now = new Date();
  const defaultEnd = new Date(Date.now() + 3 * 24 * 3600 * 1000);
  const [f, setF] = useState({
    offer_type: "none", value: 0,
    custom_name: "", custom_desc: "", custom_value: "",
    starts_at: new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16),
    ends_at: new Date(defaultEnd.getTime() - defaultEnd.getTimezoneOffset() * 60000).toISOString().slice(0, 16),
    channels: ["whatsapp"],
    message: "Bonjour {prénom}, nous avons remarqué que vous n'avez pas finalisé votre panier chez Chez Dina ({produits}). Profitez de {code} valable jusqu'au {date_fin} : {lien_panier} 💕",
  });
  const [sending, setSending] = useState(false);

  const toggleChannel = (v) => setF(s => ({ ...s, channels: s.channels.includes(v) ? s.channels.filter(x => x !== v) : [...s.channels, v] }));
  const toggleId = (id) => setSelectedIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const effectiveTargetIds = mode === "all" ? carts.map(c => c.id) : mode === "single" ? selectedIds.slice(0, 1) : selectedIds;

  const submit = async () => {
    if (!f.channels.length) return toast.error("Sélectionnez au moins un canal");
    if (!effectiveTargetIds.length) return toast.error("Sélectionnez au moins une cliente");
    if (new Date(f.ends_at) <= new Date(f.starts_at)) return toast.error("La fin doit être après le début");
    if (f.offer_type === "custom" && !f.custom_name.trim()) return toast.error("Nommez votre offre personnalisée");
    setSending(true);
    try {
      const body = {
        cart_ids: effectiveTargetIds,
        offer_type: f.offer_type,
        value: f.offer_type === "custom" ? Number(f.custom_value || 0) : Number(f.value || 0),
        offer_custom: f.offer_type === "custom" ? { name: f.custom_name, description: f.custom_desc, value: Number(f.custom_value || 0) } : null,
        starts_at: new Date(f.starts_at).toISOString(),
        ends_at: new Date(f.ends_at).toISOString(),
        channels: f.channels, message: f.message,
        image: attachImage ? image : null,
      };
      const { data } = await api.post("/abandoned-carts/relaunch", body);
      toast.success(`${data.sent || effectiveTargetIds.length} relance(s) envoyée(s) · code ${data.code || "—"}`);
      onClose(true);
    } catch { toast.error("Erreur relance"); }
    finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-[60] p-4" onClick={() => onClose(false)} data-testid="relaunch-form">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-5 w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div><div className="font-serif text-xl">Créer une offre de relance</div><div className="text-xs text-[#666]">Formulaire 100% personnalisable</div></div>
          <button onClick={() => onClose(false)}><X size={18}/></button>
        </div>

        <div className="space-y-4">
          {/* Cible */}
          <div>
            <label className="text-[10px] uppercase text-[#666] font-semibold">Cible</label>
            <div className="flex gap-1 mt-1">
              {[["single", "1 cliente"], ["selected", "Plusieurs"], ["all", "Toutes"]].map(([v, l]) => (
                <button key={v} onClick={() => setMode(v)} className={`dina-chip text-[11px] ${mode === v ? "!bg-[#b02a2a] !text-white" : ""}`} data-testid={`rf-mode-${v}`}>{l}</button>
              ))}
            </div>
            {mode !== "all" && (
              <div className="mt-2 max-h-40 overflow-y-auto border border-[#ececec] dark:border-[#2a2a2a] rounded-lg p-2 space-y-1">
                {carts.map(c => (
                  <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[#fafafa] dark:hover:bg-[#141414] p-1 rounded">
                    <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleId(c.id)} disabled={mode === "single" && selectedIds.length >= 1 && !selectedIds.includes(c.id)} className="accent-[#b02a2a]" data-testid={`rf-pick-${c.id}`}/>
                    <span className="flex-1 truncate">{c.customer?.name || c.customer_name || "—"} · {c.customer?.phone || c.customer_phone || "—"}</span>
                    <span className="tabular text-[#666]">{fcfa(c.total || c.value || 0)}</span>
                  </label>
                ))}
                {carts.length === 0 && <div className="text-xs text-[#666] text-center py-2">Aucun panier</div>}
              </div>
            )}
            <div className="text-[11px] text-[#666] mt-1">{effectiveTargetIds.length} cliente(s) ciblée(s)</div>
          </div>

          {/* Type d'offre */}
          <div>
            <label className="text-[10px] uppercase text-[#666] font-semibold">Type d'offre</label>
            <select className="dina-input" value={f.offer_type} onChange={e => setF({...f, offer_type: e.target.value})} data-testid="rf-type">
              {OFFER_TYPES.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </div>
          {["pct", "amount", "special_price"].includes(f.offer_type) && (
            <div><label className="text-[10px] uppercase text-[#666] font-semibold">Valeur {f.offer_type === "pct" ? "(%)" : "(FCFA)"}</label>
              <input type="number" className="dina-input tabular" value={f.value || ""} onChange={e => setF({...f, value: +e.target.value || 0})} data-testid="rf-value"/></div>
          )}
          {f.offer_type === "custom" && (
            <div className="grid gap-2 bg-[#fff5f5] dark:bg-[#2a1818] p-3 rounded-lg" data-testid="rf-custom-box">
              <input className="dina-input" placeholder="Nom de l'offre (ex: Pack Dina trio)" value={f.custom_name} onChange={e => setF({...f, custom_name: e.target.value})} data-testid="rf-custom-name"/>
              <textarea className="dina-input" rows={2} placeholder="Description détaillée (ex: 3 articles au prix de 2 + sac offert)" value={f.custom_desc} onChange={e => setF({...f, custom_desc: e.target.value})} data-testid="rf-custom-desc"/>
              <input type="number" className="dina-input tabular" placeholder="Valeur approximative FCFA (facultatif)" value={f.custom_value} onChange={e => setF({...f, custom_value: e.target.value})} data-testid="rf-custom-value"/>
            </div>
          )}

          {/* Validité */}
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] uppercase text-[#666] font-semibold">Début</label>
              <input type="datetime-local" className="dina-input" value={f.starts_at} onChange={e => setF({...f, starts_at: e.target.value})} data-testid="rf-starts"/></div>
            <div><label className="text-[10px] uppercase text-[#666] font-semibold">Fin</label>
              <input type="datetime-local" className="dina-input" value={f.ends_at} onChange={e => setF({...f, ends_at: e.target.value})} data-testid="rf-ends"/></div>
          </div>

          {/* Canaux */}
          <div>
            <label className="text-[10px] uppercase text-[#666] font-semibold">Canaux (plusieurs possibles)</label>
            <div className="flex gap-1 mt-1 flex-wrap">
              {CHANNELS.map(c => (
                <button key={c.v} onClick={() => toggleChannel(c.v)} className={`dina-chip text-[11px] ${f.channels.includes(c.v) ? "!bg-[#b02a2a] !text-white" : ""}`} data-testid={`rf-ch-${c.v}`}>{c.label}</button>
              ))}
            </div>
          </div>

          {/* Image */}
          <div>
            <label className="text-[10px] uppercase text-[#666] font-semibold flex items-center gap-2">Joindre une image
              <div className="flex gap-1">
                <button onClick={() => setAttachImage(true)} className={`dina-chip text-[11px] ${attachImage ? "!bg-[#1f8a4c] !text-white" : ""}`} data-testid="rf-img-yes">Oui</button>
                <button onClick={() => { setAttachImage(false); setImage(""); }} className={`dina-chip text-[11px] ${!attachImage ? "!bg-[#666] !text-white" : ""}`} data-testid="rf-img-no">Non</button>
              </div>
            </label>
            {attachImage && (
              <div className="mt-2">
                <ImageUpload value={image ? [image] : []} onChange={imgs => setImage(imgs[0] || "")} single max={1} maxKB={500} testid="rf-img-upload"/>
              </div>
            )}
          </div>

          {/* Message */}
          <div>
            <label className="text-[10px] uppercase text-[#666] font-semibold">Message · variables {`{prénom} {produits} {code} {date_fin} {lien_panier}`}</label>
            <textarea rows={5} className="dina-input" value={f.message} onChange={e => setF({...f, message: e.target.value})} data-testid="rf-message"/>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={() => onClose(false)} className="dina-btn-secondary flex-1">Annuler</button>
          <button onClick={submit} disabled={sending} className="dina-btn-primary flex-1" data-testid="rf-send"><Send size={13}/>{sending ? "Envoi…" : `Envoyer à ${effectiveTargetIds.length}`}</button>
        </div>
      </div>
    </div>
  );
}
