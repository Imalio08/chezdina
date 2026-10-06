import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fcfa, dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, X, Send, BarChart3, ChevronLeft, MessageSquare, Phone } from "lucide-react";
import ImageUpload from "@/components/shared/ImageUpload";

const STATUS_LABEL = { draft: "Brouillon", scheduled: "Planifiée", sent: "Envoyée" };
const STATUS_COLOR = { draft: "#999", scheduled: "#e4991e", sent: "#1f8a4c" };

export default function Campagnes() {
  const [list, setList] = useState([]);
  const [segs, setSegs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  const load = async () => {
    const [a, b, c] = await Promise.all([
      api.get("/campaigns").catch(() => ({ data: [] })),
      api.get("/segments").catch(() => ({ data: [] })),
      api.get("/customers").catch(() => ({ data: [] })),
    ]);
    setList(a.data || []); setSegs(b.data || []); setCustomers(c.data || []);
  };
  useEffect(() => { load(); }, []);

  const save = async (f) => {
    try {
      if (f.id) await api.patch(`/campaigns/${f.id}`, f);
      else await api.post("/campaigns", f);
      toast.success("Enregistrée"); setOpen(false); setEdit(null); load();
    } catch { toast.error("Erreur"); }
  };
  const del = async (c) => { if (!confirm(`Supprimer "${c.name}" ?`)) return; try { await api.delete(`/campaigns/${c.id}`); load(); } catch { toast.error("Erreur"); } };
  const send = async (c) => {
    if (!confirm(`Envoyer la campagne "${c.name}" maintenant ?`)) return;
    try { const r = await api.post(`/campaigns/${c.id}/send`); toast.success(`Envoyée · WA: ${r.data.sent_wa} · in-app: ${r.data.sent_inapp}`); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Erreur"); }
  };

  if (detail) return <CampaignReport cid={detail} onBack={() => { setDetail(null); load(); }} />;

  return (
    <div className="space-y-5 font-sora">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Campagnes</h1><p className="text-sm text-[#666]">{list.length} campagne(s) · WhatsApp + in-app</p></div>
        <button onClick={() => { setEdit(null); setOpen(true); }} className="dina-btn-primary !min-h-[40px]" data-testid="camp-new"><Plus size={14} />Nouvelle campagne</button>
      </div>

      <div className="dina-card-white overflow-x-auto">
        <table className="dina-table">
          <thead><tr><th>Campagne</th><th>Canaux</th><th>Cibles</th><th className="text-right">Envoyés</th><th className="text-right">Lus</th><th className="text-right">CA</th><th>Statut</th><th></th></tr></thead>
          <tbody>{list.length === 0 ? <tr><td colSpan={8} className="text-center text-sm text-[#666] py-8">Aucune campagne</td></tr> :
            list.map(c => (
              <tr key={c.id} data-testid={`camp-row-${c.name}`}>
                <td><button onClick={() => setDetail(c.id)} className="font-medium hover:text-[#b02a2a]">{c.name}</button><div className="text-[10px] text-[#999]">{dateTimeFmt(c.created_at)}</div></td>
                <td className="whitespace-nowrap">{(c.channels || []).map(ch => <span key={ch} className="dina-chip text-[10px] mr-1">{ch === "whatsapp" ? <Phone size={9} className="inline mr-0.5" /> : <MessageSquare size={9} className="inline mr-0.5" />}{ch}</span>)}</td>
                <td className="text-xs tabular">{c.stats?.targets || 0}</td>
                <td className="text-right tabular">{c.stats?.sent || 0}</td>
                <td className="text-right tabular">{c.stats?.read || 0}</td>
                <td className="text-right tabular font-semibold">{fcfa(c.stats?.revenue || 0)}</td>
                <td><span className="dina-chip text-[10px]" style={{ color: STATUS_COLOR[c.status], borderColor: STATUS_COLOR[c.status] }}>{STATUS_LABEL[c.status] || c.status}</span></td>
                <td className="text-right whitespace-nowrap">
                  {c.status !== "sent" && <button onClick={() => send(c)} className="text-[#1f8a4c] mr-2" title="Envoyer maintenant" data-testid={`camp-send-${c.name}`}><Send size={13} /></button>}
                  <button onClick={() => setDetail(c.id)} className="text-[#5867fd] mr-2" title="Rapport"><BarChart3 size={13} /></button>
                  <button onClick={() => del(c)} className="text-[#c62828]"><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && <CampaignForm initial={edit} segs={segs} customers={customers} onSave={save} onClose={() => { setOpen(false); setEdit(null); }} />}
    </div>
  );
}

function CampaignForm({ initial, segs, customers, onSave, onClose }) {
  const [f, setF] = useState(initial || { name: "", channels: ["whatsapp"], target_type: "all", segment_ids: [], customer_ids: [], text: "", offer: null });
  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));
  const toggleChannel = (ch) => upd("channels", (f.channels || []).includes(ch) ? f.channels.filter(x => x !== ch) : [...(f.channels || []), ch]);
  const toggleSeg = (sid) => upd("segment_ids", (f.segment_ids || []).includes(sid) ? f.segment_ids.filter(x => x !== sid) : [...(f.segment_ids || []), sid]);
  const toggleOffer = (on) => upd("offer", on ? { code: "", discount_pct: 10, valid_to: "" } : null);

  const submit = () => {
    if (!f.name) return toast.error("Nom requis");
    if (!f.text) return toast.error("Message requis");
    if (!(f.channels || []).length) return toast.error("Au moins un canal");
    onSave(f);
  };

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-xl max-h-[92vh] overflow-y-auto font-sora" onClick={e => e.stopPropagation()} data-testid="camp-form">
        <div className="flex items-center justify-between mb-4"><div className="font-serif text-xl">{initial?.id ? "Modifier" : "Nouvelle"} campagne</div><button onClick={onClose}><X size={18} /></button></div>
        <div className="space-y-3">
          <input className="dina-input" placeholder="Nom de la campagne *" value={f.name} onChange={e => upd("name", e.target.value)} data-testid="camp-name" />

          <div>
            <div className="text-[10px] uppercase font-semibold text-[#666] mb-2">Canaux</div>
            <div className="flex gap-2">
              <label className="dina-chip cursor-pointer flex items-center gap-1"><input type="checkbox" checked={(f.channels || []).includes("whatsapp")} onChange={() => toggleChannel("whatsapp")} className="accent-[#b02a2a]" data-testid="camp-ch-wa" /><Phone size={10} />WhatsApp</label>
              <label className="dina-chip cursor-pointer flex items-center gap-1"><input type="checkbox" checked={(f.channels || []).includes("inapp")} onChange={() => toggleChannel("inapp")} className="accent-[#b02a2a]" data-testid="camp-ch-inapp" /><MessageSquare size={10} />In-app</label>
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-semibold text-[#666] mb-2">Cibles</div>
            <div className="flex gap-1 mb-2 bg-[#f5f5f5] dark:bg-[#1a1a1a] p-1 rounded w-fit">
              {[["all", "Toutes actives"], ["segments", "Segments"], ["ids", "Clientes sélectionnées"]].map(([k, l]) => (
                <button key={k} onClick={() => upd("target_type", k)} className={`px-3 py-1 text-xs rounded ${f.target_type === k ? "bg-white dark:bg-[#2a2a2a] font-semibold" : ""}`} data-testid={`camp-target-${k}`}>{l}</button>
              ))}
            </div>
            {f.target_type === "segments" && (
              <div className="max-h-36 overflow-y-auto border rounded p-2 space-y-1 text-xs">
                {segs.map(s => <label key={s.id} className="flex items-center gap-2"><input type="checkbox" checked={(f.segment_ids || []).includes(s.id)} onChange={() => toggleSeg(s.id)} className="accent-[#b02a2a]" />{s.name} <span className="text-[#666]">({s.count})</span></label>)}
              </div>
            )}
            {f.target_type === "ids" && <div className="text-xs text-[#666]">{(f.customer_ids || []).length} cliente(s) · utilisez les segments pour un ciblage plus large</div>}
          </div>

          <textarea className="dina-input" rows={4} placeholder="Message... (variables : {prenom}, {code}, {reduction})" value={f.text} onChange={e => upd("text", e.target.value)} data-testid="camp-text" />

          <div>
            <label className="text-[10px] uppercase font-semibold text-[#666] mb-1 block">Image (optionnel)</label>
            <ImageUpload value={f.image ? [f.image] : []} onChange={imgs => upd("image", imgs[0] || "")} single max={1} maxKB={400} testid="camp-image" />
          </div>

          <input className="dina-input" placeholder="Lien à inclure (optionnel)" value={f.link || ""} onChange={e => upd("link", e.target.value)} />

          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.offer} onChange={e => toggleOffer(e.target.checked)} className="accent-[#b02a2a]" data-testid="camp-offer-toggle" />Inclure une offre promo</label>
          {f.offer && (
            <div className="dina-card-white p-3 bg-[#fff5f5] dark:bg-[#2a1818]">
              <div className="grid grid-cols-2 gap-2">
                <input className="dina-input !py-1.5 text-xs" placeholder="Code promo" value={f.offer.code || ""} onChange={e => upd("offer", { ...f.offer, code: e.target.value.toUpperCase() })} data-testid="camp-offer-code" />
                <input type="number" className="dina-input !py-1.5 text-xs" placeholder="Réduction %" value={f.offer.discount_pct || 0} onChange={e => upd("offer", { ...f.offer, discount_pct: +e.target.value })} data-testid="camp-offer-pct" />
                <input type="date" className="dina-input !py-1.5 text-xs" value={f.offer.valid_from || ""} onChange={e => upd("offer", { ...f.offer, valid_from: e.target.value })} />
                <input type="date" className="dina-input !py-1.5 text-xs" value={f.offer.valid_to || ""} onChange={e => upd("offer", { ...f.offer, valid_to: e.target.value })} data-testid="camp-offer-to" />
              </div>
            </div>
          )}

          <input type="datetime-local" className="dina-input" value={f.scheduled_at || ""} onChange={e => upd("scheduled_at", e.target.value)} placeholder="Planification (laisser vide pour envoi manuel)" />
        </div>
        <div className="flex gap-2 mt-5"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={submit} className="dina-btn-primary flex-1" data-testid="camp-save">Enregistrer</button></div>
      </div>
    </div>
  );
}

function CampaignReport({ cid, onBack }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.get(`/campaigns/${cid}/report`).then(r => setData(r.data)); }, [cid]);
  if (!data) return <div className="text-center text-sm text-[#666] py-12">Chargement…</div>;
  const { campaign: c, stats } = data;
  const openRate = stats.sent > 0 ? Math.round(stats.read / stats.sent * 100) : 0;
  const convRate = stats.sent > 0 ? Math.round(stats.orders / stats.sent * 100) : 0;

  return (
    <div className="space-y-5 font-sora">
      <button onClick={onBack} className="text-sm text-[#666] inline-flex items-center gap-1 hover:text-[#b02a2a]"><ChevronLeft size={13} />Retour</button>
      <div className="dina-card-white p-5">
        <h1 className="font-serif text-2xl">{c.name}</h1>
        <div className="text-sm text-[#666]">{dateTimeFmt(c.created_at)}{c.sent_at && ` · Envoyée ${dateTimeFmt(c.sent_at)}`}</div>
        <div className="flex gap-2 mt-2">{(c.channels || []).map(ch => <span key={ch} className="dina-chip text-xs">{ch}</span>)}<span className="dina-chip text-xs" style={{ color: STATUS_COLOR[c.status], borderColor: STATUS_COLOR[c.status] }}>{STATUS_LABEL[c.status]}</span></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        <Kpi label="Cibles" v={stats.targets} c="#5867fd" />
        <Kpi label="Envoyés" v={stats.sent} c="#5867fd" />
        <Kpi label="Lus" v={`${stats.read} (${openRate}%)`} c="#e4991e" small />
        <Kpi label="Commandes" v={`${stats.orders} (${convRate}%)`} c="#1f8a4c" small />
        <Kpi label="CA généré" v={fcfa(stats.revenue)} c="#b02a2a" small />
      </div>

      <div className="dina-card-white p-5">
        <div className="font-semibold mb-2">Message envoyé</div>
        <div className="bg-[#fafafa] dark:bg-[#0f0f0f] rounded p-3 text-sm whitespace-pre-wrap">{c.text}</div>
        {c.offer && <div className="mt-3 text-xs text-[#666]">Offre : code <b>{c.offer.code}</b> · {c.offer.discount_pct}% {c.offer.valid_to && `· valide jusqu'au ${c.offer.valid_to}`}</div>}
      </div>
    </div>
  );
}

function Kpi({ label, v, c, small }) { return <div className="dina-card-white p-3"><div className="text-[10px] uppercase text-[#666] font-semibold truncate">{label}</div><div className={`font-serif tabular mt-1 truncate ${small ? "text-base" : "text-xl"}`} style={{ color: c }}>{v}</div></div>; }
