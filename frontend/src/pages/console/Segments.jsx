import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useDetailParam } from "@/lib/keptState";
import { fcfa, dateFmt } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Users, Filter, ChevronLeft, Hand, Zap, Sparkles, Megaphone, Loader2 } from "lucide-react";

const ZONES = ["Cocody","Riviera","Marcory","Yopougon","Treichville","Plateau","Abobo","Angré"];
const TIERS = ["Bronze","Silver","Gold","Platine"];

export default function Segments() {
  const nav = useNavigate();
  const [segs, setSegs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useDetailParam();
  const [aiOpen, setAiOpen] = useState(false);

  const load = async () => {
    const [a, b] = await Promise.all([
      api.get("/segments").catch(() => ({ data: [] })),
      api.get("/customers").catch(() => ({ data: [] })),
    ]);
    setSegs(a.data || []); setCustomers(b.data || []);
  };
  useEffect(() => { load(); }, []);

  const save = async (f) => {
    try {
      if (f.id) await api.patch(`/segments/${f.id}`, f);
      else await api.post("/segments", f);
      toast.success("Enregistré"); setOpen(false); setEdit(null); load();
    } catch { toast.error("Erreur"); }
  };
  const del = async (s) => { if (!confirm(`Supprimer "${s.name}" ?`)) return; try { await api.delete(`/segments/${s.id}`); toast.success("Supprimé"); load(); } catch { toast.error("Erreur"); } };

  if (detail) return <SegmentDetail sid={detail} onBack={() => { setDetail(null); load(); }} onEdit={(s) => { setEdit(s); setOpen(true); setDetail(null); }} />;

  return (
    <div className="space-y-5 font-sora">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Segments & campagnes</h1><p className="text-sm text-[#666]">{segs.length} segment(s) · Manuel · Automatique · Hybride</p></div>
        <div className="flex gap-2">
          <button onClick={() => setAiOpen(true)} className="dina-btn-secondary !min-h-[40px]" data-testid="seg-ai"><Sparkles size={14} />Créer avec IA</button>
          <button onClick={() => { setEdit(null); setOpen(true); }} className="dina-btn-primary !min-h-[40px]" data-testid="seg-new"><Plus size={14} />Créer un segment</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {segs.length === 0 ? <div className="col-span-full dina-card-white py-12 text-center text-sm text-[#666]">Aucun segment</div> :
          segs.map(s => (
            <div key={s.id} className="dina-card-white p-4" data-testid={`seg-card-${s.name}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="font-semibold">{s.name}</div>
                  {s.description && <div className="text-[11px] text-[#666] italic mt-0.5 line-clamp-2">{s.description}</div>}
                </div>
                <span className="dina-chip text-[10px]">{s.kind === "manual" ? "Manuel" : s.kind === "auto" ? "Auto" : "Hybride"}</span>
              </div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="font-serif text-2xl tabular text-[#b02a2a]">{s.count || 0}</span>
                <span className="text-xs text-[#666]">cliente{(s.count || 0) > 1 ? "s" : ""}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setDetail(s.id)} className="dina-btn-secondary flex-1 !min-h-[32px] text-xs" data-testid={`seg-view-${s.name}`}>Voir</button>
                <button onClick={() => nav(`/console/messagerie?segment_id=${s.id}`)} className="dina-btn-secondary !min-h-[32px] text-xs !text-[#b02a2a] !border-[#b02a2a]" data-testid={`seg-broadcast-${s.name}`} title="Diffuser à ce segment"><Megaphone size={11} /></button>
                <button onClick={() => { setEdit(s); setOpen(true); }} className="dina-btn-secondary !min-h-[32px] text-xs"><Pencil size={11} /></button>
                <button onClick={() => del(s)} className="dina-btn-secondary !min-h-[32px] text-xs !text-[#c62828]"><Trash2 size={11} /></button>
              </div>
            </div>
          ))}
      </div>

      {open && <SegmentForm initial={edit} customers={customers} onSave={save} onClose={() => { setOpen(false); setEdit(null); }} />}
      {aiOpen && <AISegmentModal onClose={(created) => { setAiOpen(false); if (created) load(); }}/>}
    </div>
  );
}

function AISegmentModal({ onClose }) {
  const [prompt, setPrompt] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const examples = [
    "Toutes les clientes avec au moins 3 commandes à Cocody",
    "Clientes VIP qui n'ont pas commandé depuis 60 jours",
    "Nouvelles clientes du dernier mois dépensant plus de 20 000 FCFA",
  ];
  const create = async () => {
    if (!prompt.trim()) return toast.error("Décrivez votre segment");
    setBusy(true);
    try {
      const r = await api.post("/segments/ai", { prompt: prompt.trim(), name: name.trim() || null });
      toast.success(`Segment « ${r.data.name} » créé · ${r.data.count || 0} cliente(s)`);
      onClose(true);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "L'IA n'a pas pu créer ce segment");
    } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4" onClick={() => onClose(false)}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()} data-testid="seg-ai-modal">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#b02a2a] to-[#e4991e] grid place-items-center text-white"><Sparkles size={16}/></div><div className="font-serif text-xl">Créer un segment avec IA</div></div>
          <button onClick={() => onClose(false)}><X size={18}/></button>
        </div>
        <div className="text-xs text-[#666] mb-3">Décrivez votre segment en français — l'IA génère automatiquement les règles.</div>
        <input className="dina-input mb-2" placeholder="Nom du segment (facultatif)" value={name} onChange={e => setName(e.target.value)} data-testid="seg-ai-name"/>
        <textarea rows={4} className="dina-input mb-2" placeholder="Ex: Prends toutes les clientes avec au moins 1 commande à Riviera" value={prompt} onChange={e => setPrompt(e.target.value)} data-testid="seg-ai-prompt"/>
        <div className="mb-4">
          <div className="text-[10px] uppercase text-[#666] font-semibold mb-1">Exemples</div>
          <div className="flex flex-col gap-1">
            {examples.map(e => <button key={e} onClick={() => setPrompt(e)} className="text-left text-xs text-[#5867fd] hover:underline" data-testid="seg-ai-example">· {e}</button>)}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onClose(false)} className="dina-btn-secondary flex-1">Annuler</button>
          <button onClick={create} disabled={busy || !prompt.trim()} className="dina-btn-primary flex-1" data-testid="seg-ai-submit">{busy ? <><Loader2 size={13} className="animate-spin"/>Analyse…</> : <><Sparkles size={13}/>Créer</>}</button>
        </div>
      </div>
    </div>
  );
}

function SegmentForm({ initial, customers, onSave, onClose }) {
  const [f, setF] = useState(initial || { name: "", kind: "manual", rules: {}, customer_ids: [], excluded_ids: [], description: "" });
  const [q, setQ] = useState("");
  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));
  const toggleId = (id) => upd("customer_ids", (f.customer_ids || []).includes(id) ? f.customer_ids.filter(x => x !== id) : [...(f.customer_ids || []), id]);
  const filtered = customers.filter(c => !q || c.name?.toLowerCase().includes(q.toLowerCase()) || c.phone?.includes(q));

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-2xl max-h-[92vh] overflow-y-auto font-sora" onClick={e => e.stopPropagation()} data-testid="seg-form">
        <div className="flex items-center justify-between mb-4"><div className="font-serif text-xl">{initial?.id ? "Modifier" : "Nouveau"} segment</div><button onClick={onClose}><X size={18} /></button></div>
        <input className="dina-input mb-3" placeholder="Nom du segment *" value={f.name} onChange={e => upd("name", e.target.value)} data-testid="seg-name" />
        <textarea className="dina-input mb-3" rows={2} placeholder="Description" value={f.description || ""} onChange={e => upd("description", e.target.value)} />

        <div className="flex gap-1 bg-[#f5f5f5] dark:bg-[#1a1a1a] p-1 rounded-lg w-fit mb-3">
          {[["manual", "Manuel", Hand], ["auto", "Automatique", Zap], ["hybrid", "Hybride", Filter]].map(([k, l, Ic]) => (
            <button key={k} onClick={() => upd("kind", k)} className={`px-3 py-1.5 text-xs rounded flex items-center gap-1 ${f.kind === k ? "bg-white dark:bg-[#2a2a2a] font-semibold shadow-sm" : ""}`} data-testid={`seg-kind-${k}`}><Ic size={11} />{l}</button>
          ))}
        </div>

        {(f.kind === "auto" || f.kind === "hybrid") && (
          <div className="dina-card-white p-3 mb-3 bg-[#fafafa] dark:bg-[#0f0f0f]">
            <div className="text-[10px] uppercase font-semibold text-[#666] mb-2">Règles automatiques (mis à jour quotidiennement)</div>
            <div className="grid grid-cols-2 gap-2">
              <select className="dina-input !py-1.5 text-xs" value={f.rules?.zone || ""} onChange={e => upd("rules", { ...f.rules, zone: e.target.value })} data-testid="seg-rule-zone"><option value="">— Toute zone —</option>{ZONES.map(z => <option key={z}>{z}</option>)}</select>
              <select className="dina-input !py-1.5 text-xs" value={f.rules?.tier || ""} onChange={e => upd("rules", { ...f.rules, tier: e.target.value })} data-testid="seg-rule-tier"><option value="">— Tout niveau —</option>{TIERS.map(t => <option key={t}>{t}</option>)}</select>
              <input type="number" className="dina-input !py-1.5 text-xs" placeholder="Dépensé min (FCFA)" value={f.rules?.total_spent_min || ""} onChange={e => upd("rules", { ...f.rules, total_spent_min: +e.target.value || 0 })} data-testid="seg-rule-spent" />
              <input type="number" className="dina-input !py-1.5 text-xs" placeholder="Commande ≤ X jours" value={f.rules?.last_order_days_max || ""} onChange={e => upd("rules", { ...f.rules, last_order_days_max: +e.target.value || 0 })} data-testid="seg-rule-days" />
              <input className="dina-input !py-1.5 text-xs" placeholder="Catégorie achetée" value={f.rules?.category || ""} onChange={e => upd("rules", { ...f.rules, category: e.target.value })} />
              <input className="dina-input !py-1.5 text-xs" placeholder="Pointure/taille" value={f.rules?.size || ""} onChange={e => upd("rules", { ...f.rules, size: e.target.value })} />
            </div>
          </div>
        )}

        {(f.kind === "manual" || f.kind === "hybrid") && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2"><div className="text-[10px] uppercase font-semibold text-[#666]">Clientes {f.kind === "hybrid" ? "ajoutées manuellement" : "sélectionnées"} ({(f.customer_ids || []).length})</div></div>
            <input className="dina-input !py-1.5 text-xs mb-2" placeholder="Rechercher cliente…" value={q} onChange={e => setQ(e.target.value)} data-testid="seg-search" />
            <div className="max-h-56 overflow-y-auto border border-[#ececec] dark:border-[#2a2a2a] rounded-lg p-2 space-y-1">
              {filtered.slice(0, 100).map(c => (
                <label key={c.id} className="flex items-center gap-2 text-xs p-1 hover:bg-[#fafafa] dark:hover:bg-[#141414] rounded cursor-pointer" data-testid={`seg-pick-${c.phone}`}>
                  <input type="checkbox" checked={(f.customer_ids || []).includes(c.id)} onChange={() => toggleId(c.id)} className="accent-[#b02a2a]" />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-[#666]">{c.phone}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={() => onSave(f)} disabled={!f.name} className="dina-btn-primary flex-1" data-testid="seg-save">Enregistrer</button></div>
      </div>
    </div>
  );
}

function SegmentDetail({ sid, onBack, onEdit }) {
  const [seg, setSeg] = useState(null);
  const [custs, setCusts] = useState([]);
  useEffect(() => {
    Promise.all([api.get("/segments").then(r => r.data.find(x => x.id === sid)), api.get(`/segments/${sid}/customers`)])
      .then(([s, c]) => { setSeg(s); setCusts(c.data || []); });
  }, [sid]);
  if (!seg) return <div className="text-center text-sm text-[#666] py-12">Chargement…</div>;
  return (
    <div className="space-y-5 font-sora">
      <button onClick={onBack} className="text-sm text-[#666] inline-flex items-center gap-1 hover:text-[#b02a2a]"><ChevronLeft size={13} />Retour</button>
      <div className="dina-card-white p-5">
        <div className="flex items-start justify-between mb-3">
          <div><h1 className="font-serif text-2xl">{seg.name}</h1>{seg.description && <div className="text-sm text-[#666] italic">« {seg.description} »</div>}</div>
          <button onClick={() => onEdit(seg)} className="dina-btn-secondary !min-h-[36px]"><Pencil size={13} />Modifier</button>
        </div>
        <div className="flex gap-3 text-sm"><span className="dina-chip">{seg.kind}</span><span className="dina-chip">{custs.length} clientes</span></div>
      </div>
      <div className="dina-card-white overflow-x-auto"><table className="dina-table"><thead><tr><th>Cliente</th><th>Téléphone</th><th>Niveau</th><th className="text-right">Dépensé</th></tr></thead>
        <tbody>{custs.length === 0 ? <tr><td colSpan={4} className="text-center text-sm text-[#666] py-6">Aucune cliente</td></tr> :
          custs.map(c => <tr key={c.id}><td className="font-medium">{c.name}</td><td className="text-xs">{c.phone}</td><td className="text-xs"><span className="dina-chip text-[10px]">{c.tier}</span></td><td className="text-right tabular">{fcfa(c.total_spent || 0)}</td></tr>)}</tbody>
      </table></div>
    </div>
  );
}
