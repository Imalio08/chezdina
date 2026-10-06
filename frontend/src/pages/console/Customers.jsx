import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { fcfa, dateFmt } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, MessageSquare, X, Search, Copy, Phone, Ban, Check, Users } from "lucide-react";
import ImageUpload from "@/components/shared/ImageUpload";
import ViewToggle, { useStoredView } from "@/components/shared/ViewToggle";

const TABS = [
  { k: "all", label: "Toutes" }, { k: "active", label: "Actives" }, { k: "inactive", label: "Inactives" },
  { k: "new", label: "Nouvelles" }, { k: "vip", label: "VIP" }, { k: "risk", label: "À risque" }, { k: "blacklist", label: "Liste noire" },
];

export default function Customers() {
  const nav = useNavigate();
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [view, setView] = useStoredView("customers", "table");
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState(false);
  const [newCode, setNewCode] = useState(null); // { code, phone, name }

  const load = async () => {
    const r = await api.get(`/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    setList(r.data || []);
  };
  useEffect(() => { load(); }, [q]);

  const filtered = useMemo(() => {
    const cutoffNew = Date.now() - 7 * 24 * 3600 * 1000;
    const cutoffRisk = Date.now() - 60 * 24 * 3600 * 1000;
    return list.filter(x => {
      if (tab === "active") return x.derived_status === "active" && x.status !== "blacklist";
      if (tab === "inactive") return x.derived_status === "inactive";
      if (tab === "new") return new Date(x.created_at).getTime() > cutoffNew;
      if (tab === "vip") return (x.loyalty_points || 0) > 500 || x.tier === "Or" || x.tier === "Platine";
      if (tab === "risk") return x.last_order_at && new Date(x.last_order_at).getTime() < cutoffRisk && x.status !== "blacklist";
      if (tab === "blacklist") return x.status === "blacklist";
      return true;
    });
  }, [list, tab]);

  const save = async (f) => {
    try {
      if (edit?.id) { await api.patch(`/customers/${edit.id}`, f); toast.success("Mis à jour"); setOpen(false); setEdit(null); load(); }
      else {
        const r = await api.post("/customers", f);
        setNewCode({ code: r.data.access_code, phone: r.data.phone, name: r.data.name });
        toast.success("Cliente créée · code temporaire généré");
        setOpen(false); setEdit(null); load();
      }
    } catch { toast.error("Erreur"); }
  };

  const regenCode = async (c) => {
    try { const r = await api.post(`/customers/${c.id}/regen-access-code`); setNewCode(r.data); toast.success("Nouveau code généré"); }
    catch { toast.error("Erreur"); }
  };

  const openWa = (c, text) => {
    const digits = (c.phone || "").replace(/\D/g, "");
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text || `Bonjour ${c.name?.split(" ")[0] || ""}, Chez Dina 💕`)}`, "_blank");
  };

  const toggleBlacklist = async (c) => {
    const next = c.status === "blacklist" ? "active" : "blacklist";
    await api.patch(`/customers/${c.id}`, { status: next });
    toast.success(next === "blacklist" ? "Mise en liste noire" : "Réactivée"); load();
  };

  return (
    <div className="space-y-5 font-sora">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-serif text-3xl">Clientes</h1><p className="text-sm text-[#666]">{filtered.length} / {list.length} profils · {TABS.find(t => t.k === tab)?.label}</p></div>
        <button onClick={() => { setEdit({}); setOpen(true); }} className="dina-btn-primary !min-h-[40px]" data-testid="cust-new"><Plus size={14} />Nouvelle cliente</button>
      </div>

      <div className="flex gap-1 overflow-x-auto bg-[#f5f5f5] dark:bg-[#1a1a1a] p-1 rounded-lg w-fit">
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`px-3 py-1.5 text-xs rounded whitespace-nowrap ${tab === t.k ? "bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold" : ""}`} data-testid={`cust-tab-${t.k}`}>{t.label}</button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-md"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]" /><input className="dina-input pl-9" placeholder="Nom, téléphone, email…" value={q} onChange={e => setQ(e.target.value)} data-testid="cust-search" /></div>
        <ViewToggle value={view} onChange={setView} options={["table", "grid"]} tabKey="customers" />
      </div>

      {view === "table" ? (
        <div className="dina-card-white overflow-x-auto">
          <table className="dina-table">
            <thead><tr><th>Cliente</th><th>Téléphone</th><th>Zone</th><th className="text-right">Points</th><th className="text-right">Dépensé</th><th>Statut</th><th></th></tr></thead>
            <tbody>{filtered.map(c => (
              <tr key={c.id} data-testid={`cust-row-${c.phone}`}>
                <td><button onClick={() => nav(`/console/clients/${c.id}`)} className="flex items-center gap-2 hover:text-[#b02a2a]">
                  {c.photo ? <img src={c.photo} className="w-8 h-8 rounded-full object-cover" alt="" /> : <div className="w-8 h-8 rounded-full bg-[#fff5f5] text-[#b02a2a] grid place-items-center text-xs font-bold">{c.name?.[0]}</div>}
                  <div className="text-left"><div className="font-medium">{c.name}</div><div className="text-[10px] text-[#999]">{c.email || "—"}</div></div>
                </button></td>
                <td className="text-xs">{c.phone}</td>
                <td className="text-xs text-[#666]">{c.zone || c.quartier || "—"}</td>
                <td className="text-right tabular text-[#e4991e] font-semibold">{c.loyalty_points || 0}</td>
                <td className="text-right tabular">{fcfa(c.total_spent || 0)}</td>
                <td><span className={`dina-chip text-[10px] ${c.status === "blacklist" ? "!text-[#c62828] !border-[#c62828]" : c.derived_status === "inactive" ? "!text-[#999]" : "!text-[#1f8a4c] !border-[#1f8a4c]"}`}>{c.status === "blacklist" ? "Noire" : c.derived_status === "inactive" ? "Inactive" : "Active"}</span></td>
                <td className="text-right whitespace-nowrap">
                  <button onClick={() => nav(`/console/clients/${c.id}?tab=messages`)} className="text-[#5867fd] mr-1.5" title="Message in-app" data-testid={`cust-msg-${c.phone}`}><MessageSquare size={13} /></button>
                  <button onClick={() => openWa(c)} className="text-[#1f8a4c] mr-1.5" title="WhatsApp" data-testid={`cust-wa-${c.phone}`}><Phone size={13} /></button>
                  <button onClick={() => { setEdit(c); setOpen(true); }} className="text-[#0021cc] mr-1.5"><Pencil size={13} /></button>
                  <button onClick={() => regenCode(c)} className="text-[#e4991e] mr-1.5" title="Régénérer code"><Copy size={13} /></button>
                  <button onClick={() => toggleBlacklist(c)} className="text-[#c62828]" title="Liste noire"><Ban size={13} /></button>
                </td>
              </tr>
            ))}{filtered.length === 0 && <tr><td colSpan={7} className="text-center text-sm text-[#666] py-8">Aucune cliente</td></tr>}</tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(c => (
            <div key={c.id} className="dina-card-white p-4" data-testid={`cust-card-${c.phone}`}>
              <div className="flex items-start gap-3">
                <button onClick={() => nav(`/console/clients/${c.id}`)}>{c.photo ? <img src={c.photo} className="w-12 h-12 rounded-full object-cover" alt="" /> : <div className="w-12 h-12 rounded-full bg-[#fff5f5] text-[#b02a2a] grid place-items-center font-serif font-bold">{c.name?.[0]}</div>}</button>
                <div className="flex-1 min-w-0">
                  <button onClick={() => nav(`/console/clients/${c.id}`)} className="font-semibold truncate hover:text-[#b02a2a]">{c.name}</button>
                  <div className="text-[11px] text-[#666] truncate">{c.phone}</div>
                  <div className="text-[11px] text-[#e4991e]">{c.loyalty_points || 0} pts · {c.tier}</div>
                </div>
              </div>
              <div className="flex gap-1 mt-3">
                <button onClick={() => nav(`/console/clients/${c.id}?tab=messages`)} className="dina-btn-secondary flex-1 !min-h-[32px] text-xs"><MessageSquare size={11} />Message</button>
                <button onClick={() => openWa(c)} className="dina-btn-secondary !min-h-[32px] text-xs !text-[#1f8a4c]"><Phone size={11} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && <CustomerForm initial={edit} onSave={save} onClose={() => { setOpen(false); setEdit(null); }} />}
      {newCode && <AccessCodeModal data={newCode} onClose={() => setNewCode(null)} />}
    </div>
  );
}

function AccessCodeModal({ data, onClose }) {
  const copy = () => { navigator.clipboard.writeText(data.code); toast.success("Copié"); };
  const digits = (data.phone || "").replace(/\D/g, "");
  const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(`Bonjour ${data.name?.split(" ")[0] || ""}, bienvenue Chez Dina 💕 Votre code d'accès temporaire : ${data.code}. Connectez-vous sur https://chezdina.ci/boutique/account et changez-le dès que possible.`)}`;
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()} data-testid="access-code-modal">
        <div className="flex items-center justify-between mb-3"><div className="font-serif text-xl">Code d'accès généré</div><button onClick={onClose}><X size={18} /></button></div>
        <div className="text-xs text-[#666] mb-2">Pour {data.name} · {data.phone}</div>
        <div className="text-center py-4 bg-[#fff5f5] dark:bg-[#2a1818] rounded-lg mb-3">
          <div className="text-[10px] uppercase text-[#999]">Code temporaire 6 chiffres</div>
          <div className="font-serif text-4xl tabular tracking-widest text-[#b02a2a] mt-1" data-testid="access-code-value">{data.code}</div>
          <div className="text-[11px] text-[#666] mt-1">La cliente devra choisir son propre code au 1er login</div>
        </div>
        <div className="flex gap-2">
          <button onClick={copy} className="dina-btn-secondary flex-1" data-testid="access-code-copy"><Copy size={13} />Copier</button>
          <a href={waUrl} target="_blank" rel="noreferrer" className="dina-btn-primary flex-1 text-center" data-testid="access-code-wa"><Phone size={13} />Envoyer via WhatsApp</a>
        </div>
      </div>
    </div>
  );
}

function CustomerForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial?.id ? { ...initial } : { name: "", phone: "+225 ", wa_consent: true, msg_consent: true, addresses: [], tags: [], gender: "F", status: "active" });
  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));
  const addAddr = () => upd("addresses", [...(f.addresses || []), { label: "Maison", commune: "", quartier: "", repere: "", zone: "" }]);
  const updAddr = (i, patch) => upd("addresses", (f.addresses || []).map((a, idx) => idx === i ? { ...a, ...patch } : a));
  const rmAddr = (i) => upd("addresses", (f.addresses || []).filter((_, idx) => idx !== i));

  const submit = () => {
    const [first, ...rest] = (f.name || "").split(" ");
    if (!first) return toast.error("Prénom requis");
    if (!f.phone || f.phone.replace(/\D/g, "").length < 10) return toast.error("Téléphone valide requis");
    onSave(f);
  };

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-2xl max-h-[92vh] overflow-y-auto font-sora" onClick={e => e.stopPropagation()} data-testid="cust-form">
        <div className="flex items-center justify-between mb-4"><div className="font-serif text-xl">{initial?.id ? "Modifier" : "Nouvelle"} cliente</div><button onClick={onClose}><X size={18} /></button></div>
        <div className="space-y-3">
          <ImageUpload value={f.photo ? [f.photo] : []} onChange={imgs => upd("photo", imgs[0] || "")} single max={1} maxKB={300} testid="cust-photo" />
          <div className="grid md:grid-cols-2 gap-3">
            <input className="dina-input" placeholder="Nom complet (Prénom Nom) *" value={f.name || ""} onChange={e => upd("name", e.target.value)} data-testid="cust-name" />
            <input className="dina-input" placeholder="Téléphone *" value={f.phone || ""} onChange={e => upd("phone", e.target.value)} data-testid="cust-phone" />
            <input className="dina-input" placeholder="WhatsApp (si différent)" value={f.whatsapp || ""} onChange={e => upd("whatsapp", e.target.value)} />
            <input className="dina-input" placeholder="Email" value={f.email || ""} onChange={e => upd("email", e.target.value)} />
            <input type="date" className="dina-input" value={f.birthday || ""} onChange={e => upd("birthday", e.target.value)} />
            <select className="dina-input" value={f.gender || "F"} onChange={e => upd("gender", e.target.value)}><option value="F">Femme</option><option value="M">Homme</option><option value="X">Autre</option></select>
            <input className="dina-input" placeholder="Profession" value={f.profession || ""} onChange={e => upd("profession", e.target.value)} />
            <input className="dina-input" placeholder="Source (ami, Instagram, …)" value={f.source || ""} onChange={e => upd("source", e.target.value)} />
          </div>

          <div className="border-t border-[#ececec] dark:border-[#2a2a2a] pt-3">
            <div className="flex justify-between items-center mb-2"><div className="text-xs uppercase font-semibold text-[#666]">Adresses</div><button onClick={addAddr} className="text-xs text-[#b02a2a]"><Plus size={11} className="inline" />Ajouter</button></div>
            {(f.addresses || []).map((a, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_28px] gap-2 mb-1 items-center">
                <select className="dina-input !py-1 text-xs" value={a.label} onChange={e => updAddr(i, { label: e.target.value })}><option>Maison</option><option>Bureau</option><option>Autre</option></select>
                <input className="dina-input !py-1 text-xs" placeholder="Commune" value={a.commune} onChange={e => updAddr(i, { commune: e.target.value })} />
                <input className="dina-input !py-1 text-xs" placeholder="Quartier" value={a.quartier} onChange={e => updAddr(i, { quartier: e.target.value })} />
                <input className="dina-input !py-1 text-xs" placeholder="Repère" value={a.repere} onChange={e => updAddr(i, { repere: e.target.value })} />
                <button onClick={() => rmAddr(i)} className="text-[#c62828]"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-3 border-t border-[#ececec] dark:border-[#2a2a2a] pt-3">
            <input className="dina-input" placeholder="Pointure" value={f.shoe_size || ""} onChange={e => upd("shoe_size", e.target.value)} />
            <input className="dina-input" placeholder="Taille haut" value={f.top_size || ""} onChange={e => upd("top_size", e.target.value)} />
            <input className="dina-input" placeholder="Taille bas" value={f.bottom_size || ""} onChange={e => upd("bottom_size", e.target.value)} />
            <input className="dina-input md:col-span-3" placeholder="Couleurs & styles préférés" value={f.preferences || ""} onChange={e => upd("preferences", e.target.value)} />
            <input className="dina-input md:col-span-2" placeholder="Marques préférées" value={f.favorite_brands || ""} onChange={e => upd("favorite_brands", e.target.value)} />
            <input className="dina-input" placeholder="Code parrain" value={f.referrer_code || ""} onChange={e => upd("referrer_code", e.target.value)} />
          </div>

          <div className="border-t border-[#ececec] dark:border-[#2a2a2a] pt-3">
            <div className="text-xs uppercase font-semibold text-[#666] mb-2">Consentements</div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.wa_consent !== false} onChange={e => upd("wa_consent", e.target.checked)} className="accent-[#b02a2a]" data-testid="cust-wa-consent" />WhatsApp (promos, confirmations)</label>
            <label className="flex items-center gap-2 text-sm mt-1"><input type="checkbox" checked={f.msg_consent !== false} onChange={e => upd("msg_consent", e.target.checked)} className="accent-[#b02a2a]" />Messagerie in-app</label>
          </div>

          <input className="dina-input" placeholder="Tags (séparés par ,)" value={(f.tags || []).join(", ")} onChange={e => upd("tags", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} />
          <textarea className="dina-input" rows={2} placeholder="Notes internes" value={f.notes || ""} onChange={e => upd("notes", e.target.value)} />
        </div>
        <div className="flex gap-2 mt-5"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={submit} className="dina-btn-primary flex-1" data-testid="cust-save">Enregistrer</button></div>
      </div>
    </div>
  );
}
