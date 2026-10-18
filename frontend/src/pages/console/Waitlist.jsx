import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { RichComposer } from "@/components/shared/RichComposer";
import { toast } from "sonner";
import { Users, Package, BellRing, Trash2, ShoppingBag, Search as SearchIcon, Hash, Globe, Store, X, Send, Upload } from "lucide-react";
import KPICard from "@/components/shared/KPICard";
import ImageUpload from "@/components/shared/ImageUpload";

const CHANNELS = [
  { v:"whatsapp", label:"WhatsApp" },
  { v:"inapp", label:"Message in-app" },
  { v:"popup", label:"Pop-up espace cliente" },
];
const SOURCE_LABEL = { site: "Site vitrine", pos: "Caisse (POS)", search: "Recherche sans résultat", console: "Console admin" };
const SOURCE_ICON = { site: Globe, pos: Store, search: SearchIcon, console: Hash };
const SOURCE_COLOR = { site: "#5867fd", pos: "#b02a2a", search: "#e4991e", console: "#666" };

export default function Waitlist({ embedded, section }) {
  const [tabState, setTab] = useState("groups");
  const tab = section || tabState;
  const [data, setData] = useState(null);
  const [out, setOut] = useState(null);
  const [open, setOpen] = useState(null);
  const [notifyFor, setNotifyFor] = useState(null);

  const load = async () => {
    const [g, o] = await Promise.all([
      api.get("/waitlist/grouped").catch(() => ({ data: [] })),
      api.get("/out-of-catalog").catch(()=>({data:{keywords:[],total:0}})),
    ]);
    setData(g.data); setOut(o.data);
  };
  useEffect(() => { load(); }, []);

  const remove = async (wid) => {
    if (!window.confirm("Retirer de la liste d'attente ? Cette action est irréversible.")) return;
    await api.delete(`/waitlist/${wid}`); toast.success("Retiré"); load();
  };

  if (!data) return <div className="text-sm text-[#666] text-center py-10">Chargement…</div>;

  return (
    <div className="space-y-5" data-testid="waitlist-page">
      {!embedded && <div><h1 className="font-serif text-3xl">Liste d'attente</h1><p className="text-sm text-[#666]">Clientes qui attendent un produit, une taille ou une couleur</p></div>}

      {!embedded && <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard testid="wl-pending" label="Demandes en attente" value={data.pending} icon={BellRing} color="#e4991e"/>
        <KPICard testid="wl-prods" label="Produits concernés" value={data.products_affected} icon={Package} color="#5867fd"/>
        <KPICard testid="wl-clients" label="Clientes concernées" value={data.customers_total} icon={Users} color="#b02a2a"/>
        <KPICard testid="wl-conv" label="Conversion après retour" value={`${data.conversion_pct}%`} icon={ShoppingBag} color="#1f8a4c"/>
      </div>}

      {!embedded && <div className="flex gap-1 bg-[#f5f5f5] dark:bg-[#1a1a1a] p-1 rounded-lg w-fit">
        <button onClick={()=>setTab("groups")} className={`px-3 py-1.5 text-sm rounded-md ${tab==="groups"?"bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold":""}`} data-testid="wl-tab-groups">Groupés par produit ({data.groups?.length||0})</button>
        <button onClick={()=>setTab("ooc")} className={`px-3 py-1.5 text-sm rounded-md ${tab==="ooc"?"bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold":""}`} data-testid="wl-tab-ooc">Demandes hors catalogue ({out?.total||0})</button>
      </div>}

      {tab === "groups" && (
        <div className="grid md:grid-cols-2 gap-3">
          {(data.groups||[]).length === 0 && <div className="col-span-full dina-card-white py-10 text-center text-sm text-[#666]">Aucune demande en attente</div>}
          {(data.groups||[]).map((g,i) => (
            <div key={i} className="dina-card-white p-4" data-testid={`wl-group-${i}`}>
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded bg-[#fff5f5] overflow-hidden shrink-0">{g.product?.image && <img src={g.product.image} alt="" className="w-full h-full object-cover"/>}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-serif text-base leading-tight">{g.product?.name || "Produit"}</div>
                  <div className="text-xs text-[#666]">{g.product?.brand} · {[g.size, g.color].filter(Boolean).join(" · ") || "Toutes variantes"}</div>
                  <div className="flex items-center gap-2 mt-1 text-xs"><Users size={11} className="text-[#b02a2a]"/><b>{(g.customers || []).length}</b> client{(g.customers || []).length>1?"es":"e"} en attente</div>
                </div>
              </div>
              <button onClick={()=>setOpen(open===i?null:i)} className="mt-3 text-xs text-[#5867fd] hover:underline" data-testid={`wl-expand-${i}`}>{open===i?"Masquer":"Voir les clientes"}</button>
              {open===i && (
                <div className="mt-2 space-y-1">
                  {g.customers.map(c => {
                    const Icon = SOURCE_ICON[c.source] || Hash;
                    return (
                      <div key={c.id} className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-[#f0f0f0] last:border-0">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{c.name}</div>
                          <div className="text-[#666] truncate flex items-center gap-1.5">
                            {c.phone}
                            <span className="dina-chip !py-0 text-[9px] inline-flex items-center gap-0.5" style={{ color: SOURCE_COLOR[c.source || "console"], borderColor: SOURCE_COLOR[c.source || "console"] }}>
                              <Icon size={8}/>{SOURCE_LABEL[c.source || "console"]}
                            </span>
                            · {new Date(c.created_at).toLocaleDateString("fr-FR")}
                          </div>
                        </div>
                        <button onClick={()=>setNotifyFor({ wid: c.id, name: c.name, phone: c.phone, product: g.product })} className="dina-chip !py-0.5 text-[10px] !border-[#1f8a4c] !text-[#1f8a4c]" data-testid={`wl-notify-${c.id}`}><BellRing size={10}/>Notifier</button>
                        <button onClick={()=>remove(c.id)} className="text-[#c62828]"><Trash2 size={11}/></button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "ooc" && (
        <div className="dina-card-white overflow-hidden">
          {(out?.keywords||[]).length === 0 ? <div className="py-10 text-center text-sm text-[#666]">Aucune demande hors catalogue<br/><span className="text-xs">Les clientes peuvent faire une demande depuis la recherche sans résultat sur le site, ou être ajoutées manuellement depuis le POS.</span></div> :
            <table className="dina-table" data-testid="ooc-table">
              <thead><tr><th>Mot-clé / produit demandé</th><th>Source</th><th className="text-right">Demandes</th><th>Dernière demande</th></tr></thead>
              <tbody>{(out?.keywords||[]).map(k => {
                const lastReq = k.requests?.[0];
                const src = lastReq?.channel || "site";
                const Icon = SOURCE_ICON[src] || Hash;
                return (
                  <tr key={k.keyword} data-testid={`ooc-row-${k.keyword}`}>
                    <td className="font-medium">{k.keyword}</td>
                    <td>
                      <span className="dina-chip text-[10px] inline-flex items-center gap-1" style={{ color: SOURCE_COLOR[src], borderColor: SOURCE_COLOR[src] }}>
                        <Icon size={10}/>{SOURCE_LABEL[src] || src}
                      </span>
                    </td>
                    <td className="text-right tabular font-semibold">{k.count}</td>
                    <td className="text-xs text-[#666]">{lastReq?.customer_phone || "—"} · {lastReq?.created_at ? new Date(lastReq.created_at).toLocaleDateString("fr-FR") : "—"}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          }
        </div>
      )}

      {notifyFor && <NotifyModal item={notifyFor} onClose={(sent)=>{setNotifyFor(null); if (sent) load();}}/>}
    </div>
  );
}

const OFFER_TYPES = [
  { v: "none", label: "Aucune (simple rappel de retour)" },
  { v: "pct", label: "Réduction en %" },
  { v: "amount", label: "Réduction en FCFA" },
  { v: "free_delivery", label: "Livraison offerte" },
  { v: "gift", label: "Cadeau" },
  { v: "custom", label: "Offre personnalisée" },
];

function NotifyModal({ item, onClose }) {
  const now = new Date();
  const defaultEnd = new Date(Date.now() + 3 * 24 * 3600 * 1000);
  const [attachImage, setAttachImage] = useState(false);
  const [image, setImage] = useState("");
  const [f, setF] = useState({
    offer_type: "none", value: 0,
    custom_name: "", custom_desc: "", custom_value: "",
    starts_at: new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16),
    ends_at: new Date(defaultEnd.getTime() - defaultEnd.getTimezoneOffset() * 60000).toISOString().slice(0, 16),
    channels: ["whatsapp"],
    message: `Bonjour ${item.name?.split(" ")[0] || ""}, bonne nouvelle ! Le produit « ${item.product?.name || "votre article"} » que vous attendiez est de nouveau disponible chez Chez Dina 💕`,
  });
  const [sending, setSending] = useState(false);
  const toggleChannel = (v) => setF(s => ({ ...s, channels: s.channels.includes(v) ? s.channels.filter(x => x !== v) : [...s.channels, v] }));

  const submit = async () => {
    if (!f.channels.length) return toast.error("Sélectionnez au moins un canal");
    if (new Date(f.ends_at) <= new Date(f.starts_at)) return toast.error("La fin doit être après le début");
    if (f.offer_type === "custom" && !f.custom_name.trim()) return toast.error("Nommez votre offre personnalisée");
    setSending(true);
    try {
      await api.post(`/waitlist/${item.wid}/notify`, {
        channels: f.channels,
        message: f.message,
        offer_type: f.offer_type,
        offer_value: f.offer_type === "custom" ? Number(f.custom_value || 0) : Number(f.value || 0),
        offer_custom: f.offer_type === "custom" ? { name: f.custom_name, description: f.custom_desc, value: Number(f.custom_value || 0) } : null,
        starts_at: new Date(f.starts_at).toISOString(),
        ends_at: new Date(f.ends_at).toISOString(),
        image: attachImage ? image : null,
      });
      toast.success(`Notification envoyée à ${item.name}`);
      onClose(true);
    } catch { toast.error("Erreur envoi"); }
    finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-[60] p-4" onClick={() => onClose(false)} data-testid="wl-notify-modal">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-5 w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div><div className="font-serif text-xl">Notifier {item.name}</div><div className="text-xs text-[#666]">{item.product?.name} · {item.phone}</div></div>
          <button onClick={() => onClose(false)}><X size={18}/></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] uppercase text-[#666] font-semibold">Type d'offre</label>
            <select className="dina-input" value={f.offer_type} onChange={e => setF({...f, offer_type: e.target.value})} data-testid="wl-notify-type">
              {OFFER_TYPES.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </div>
          {["pct", "amount"].includes(f.offer_type) && (
            <div><label className="text-[10px] uppercase text-[#666] font-semibold">Valeur {f.offer_type === "pct" ? "(%)" : "(FCFA)"}</label>
              <input type="number" className="dina-input tabular" value={f.value || ""} onChange={e => setF({...f, value: +e.target.value || 0})} data-testid="wl-notify-value"/></div>
          )}
          {f.offer_type === "custom" && (
            <div className="grid gap-2 bg-[#fff5f5] dark:bg-[#2a1818] p-3 rounded-lg">
              <input className="dina-input" placeholder="Nom de l'offre" value={f.custom_name} onChange={e => setF({...f, custom_name: e.target.value})}/>
              <textarea className="dina-input" rows={2} placeholder="Description" value={f.custom_desc} onChange={e => setF({...f, custom_desc: e.target.value})}/>
              <input type="number" className="dina-input tabular" placeholder="Valeur FCFA (facultatif)" value={f.custom_value} onChange={e => setF({...f, custom_value: e.target.value})}/>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] uppercase text-[#666] font-semibold">Début</label>
              <input type="datetime-local" className="dina-input" value={f.starts_at} onChange={e => setF({...f, starts_at: e.target.value})}/></div>
            <div><label className="text-[10px] uppercase text-[#666] font-semibold">Fin</label>
              <input type="datetime-local" className="dina-input" value={f.ends_at} onChange={e => setF({...f, ends_at: e.target.value})}/></div>
          </div>
          <div>
            <label className="text-[10px] uppercase text-[#666] font-semibold">Canaux (plusieurs possibles)</label>
            <div className="flex gap-1 mt-1 flex-wrap">
              {CHANNELS.map(c => (
                <button key={c.v} onClick={() => toggleChannel(c.v)} className={`dina-chip text-[11px] ${f.channels.includes(c.v) ? "!bg-[#b02a2a] !text-white" : ""}`} data-testid={`wl-notify-ch-${c.v}`}>{c.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase text-[#666] font-semibold flex items-center gap-2">Joindre une image
              <div className="flex gap-1">
                <button onClick={() => setAttachImage(true)} className={`dina-chip text-[11px] ${attachImage ? "!bg-[#1f8a4c] !text-white" : ""}`}>Oui</button>
                <button onClick={() => { setAttachImage(false); setImage(""); }} className={`dina-chip text-[11px] ${!attachImage ? "!bg-[#666] !text-white" : ""}`}>Non</button>
              </div>
            </label>
            {attachImage && <div className="mt-2"><ImageUpload value={image ? [image] : []} onChange={imgs => setImage(imgs[0] || "")} single max={1} maxKB={500}/></div>}
          </div>
          <div>
            <label className="text-[10px] uppercase text-[#666] font-semibold">Message à envoyer</label>
            <RichComposer value={f.message} onChange={v => setF({...f, message: v})} rows={5} testid="wl-notify-message"/>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={() => onClose(false)} className="dina-btn-secondary flex-1">Annuler</button>
          <button onClick={submit} disabled={sending} className="dina-btn-primary flex-1" data-testid="wl-notify-send"><Send size={13}/>{sending ? "Envoi…" : "Vérifier et envoyer"}</button>
        </div>
      </div>
    </div>
  );
}
