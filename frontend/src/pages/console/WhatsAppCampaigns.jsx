import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Send, Check, Trash2, MessageCircle, Users, Megaphone, Clock, Zap } from "lucide-react";
import { dateTimeFmt } from "@/lib/format";

const SEGMENTS = [
  { v: "all", label: "Toutes" },
  { v: "active", label: "Actives (30j)" },
  { v: "inactive", label: "Dormantes 30j+" },
  { v: "vip", label: "VIP (500+ pts)" },
  { v: "nouvelles", label: "Nouvelles (30j)" },
];

const TEMPLATES = [
  { label: "Nouvelle collection", text: "Bonjour {prenom} 👋 Nouvelle collection chez Dina ! Jupes, robes et sandales dispos. Venez vite au showroom ou commandez via WhatsApp 💕" },
  { label: "Promotion flash", text: "Bonjour {prenom} 🎉 -20% pendant 48h sur toute la boutique Chez Dina. Code FLASH20. Dernier jour demain soir !" },
  { label: "Rupture → arrivage", text: "Bonjour {prenom} 📦 L'article que vous attendiez est de retour en stock chez Dina ! Pointez votre taille avant qu'il reparte." },
  { label: "Code parrainage", text: "Bonjour {prenom} 💌 Votre code parrainage Chez Dina : {code}. Partagez-le, votre amie reçoit 500 FCFA et vous 1 000 FCFA sur votre porte-monnaie !" },
];

export default function WhatsAppCampaigns() {
  const [tab, setTab] = useState("outbox");
  const [outbox, setOutbox] = useState([]);
  const [segCounts, setSegCounts] = useState({});
  const [kindFilter, setKindFilter] = useState("all");
  const [showBroadcast, setShowBroadcast] = useState(false);

  const load = async () => {
    try {
      const [o, s] = await Promise.all([api.get("/whatsapp-outbox"), api.get("/customer-segments")]);
      setOutbox(o.data); setSegCounts(s.data || {});
    } catch { toast.error("Erreur de chargement"); }
  };
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  const markSent = async (m) => {
    window.open(m.link, "_blank");
    try { await api.post(`/whatsapp-outbox/${m.id}/mark-sent`); toast.success("Marqué envoyé"); load(); } catch { toast.error("Erreur"); }
  };
  const del = async (id) => { if (!confirm("Supprimer ?")) return; await api.delete(`/whatsapp-outbox/${id}`); load(); };

  const filtered = outbox.filter(m => kindFilter === "all" || m.kind === kindFilter);
  const pending = outbox.filter(m => !m.sent);
  const statusTriggers = outbox.filter(m => m.kind === "status" && !m.sent).length;
  const broadcasts = outbox.filter(m => m.kind === "broadcast").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-serif text-3xl">Campagnes WhatsApp</h1>
          <p className="text-sm text-[#666]">Messages automatiques sur changement de statut + diffusions ciblées</p>
        </div>
        <button onClick={() => setShowBroadcast(true)} className="dina-btn-primary !min-h-[40px]" data-testid="wa-new-broadcast"><Megaphone size={14} />Nouvelle diffusion</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">En attente d'envoi</div><div className="font-serif text-2xl tabular mt-1 text-[#b02a2a]">{pending.length}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Notifs statut auto</div><div className="font-serif text-2xl tabular mt-1 text-[#1f8a4c]">{statusTriggers}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Diffusions</div><div className="font-serif text-2xl tabular mt-1">{broadcasts}</div></div>
        <div className="dina-card-white p-4"><div className="text-xs uppercase text-[#666]">Total envoyés</div><div className="font-serif text-2xl tabular mt-1">{outbox.filter(m => m.sent).length}</div></div>
      </div>

      <div className="flex gap-1 bg-[#f5f5f5] dark:bg-[#1a1a1a] p-1 rounded-lg w-fit">
        {[["all", "Tous"], ["status", "Notifs statut"], ["broadcast", "Diffusions"]].map(([v, l]) => (
          <button key={v} onClick={() => setKindFilter(v)} className={`px-4 py-1.5 text-sm rounded-md ${kindFilter === v ? "bg-white dark:bg-[#2a2a2a] shadow-sm font-semibold" : ""}`} data-testid={`wa-kind-${v}`}>{l}</button>
        ))}
      </div>

      <div className="dina-card-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dina-table">
            <thead><tr><th>Cliente</th><th>Déclencheur</th><th>Message</th><th>Créé</th><th>Statut</th><th className="text-right">Action</th></tr></thead>
            <tbody>{filtered.length === 0 ? <tr><td colSpan={6} className="text-center text-sm text-[#666] py-8">Aucun message en file</td></tr> :
              filtered.slice(0, 200).map(m => (
                <tr key={m.id} data-testid={`wa-msg-${m.id}`}>
                  <td className="font-medium">{m.customer_name}<div className="text-xs text-[#666]">{m.phone}</div></td>
                  <td className="text-xs">{m.kind === "status"
                    ? <span className="dina-chip"><Clock size={10} />{m.status_trigger}{m.order_code ? ` · ${m.order_code}` : ""}</span>
                    : <span className="dina-chip" style={{ color: "#b02a2a" }}><Megaphone size={10} />{m.segment || "diffusion"}</span>}
                  </td>
                  <td className="max-w-[280px] text-xs text-[#666]"><div className="truncate" title={m.message}>{m.message}</div></td>
                  <td className="text-xs text-[#666] whitespace-nowrap">{dateTimeFmt(m.created_at)}</td>
                  <td>{m.sent
                    ? <span className="dina-chip !text-[#1f8a4c] !border-[#1f8a4c]"><Check size={10} />Envoyé</span>
                    : <span className="dina-chip !text-[#e4991e] !border-[#e4991e]">En attente</span>}
                  </td>
                  <td className="text-right whitespace-nowrap">
                    {!m.sent && <button onClick={() => markSent(m)} className="dina-btn-primary !min-h-[28px] text-[11px]" data-testid={`wa-send-${m.id}`}><Send size={10} />Envoyer</button>}
                    <button onClick={() => del(m.id)} className="text-[#c62828] ml-2"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showBroadcast && <BroadcastModal segCounts={segCounts} onClose={() => setShowBroadcast(false)} onDone={() => { setShowBroadcast(false); load(); }} />}
    </div>
  );
}

function BroadcastModal({ segCounts, onClose, onDone }) {
  const [segment, setSegment] = useState("active");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const applyTemplate = (t) => setMessage(t.text);
  const send = async () => {
    if (!message.trim()) return toast.error("Message vide");
    setLoading(true);
    try {
      const r = await api.post("/whatsapp-outbox/broadcast", { segment, message });
      toast.success(`${r.data.enqueued} messages mis en file`); onDone();
    } catch { toast.error("Erreur"); } finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="font-serif text-xl mb-1">Nouvelle diffusion WhatsApp</div>
        <div className="text-xs text-[#666] mb-4">Les messages sont mis en file dans l'outbox. Un agent clique sur "Envoyer" pour ouvrir wa.me avec le texte prêt.</div>

        <label className="text-xs uppercase font-semibold text-[#666]">Segment cible</label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 my-2">
          {SEGMENTS.map(s => (
            <button key={s.v} onClick={() => setSegment(s.v)} className={`p-3 rounded-lg border text-xs ${segment === s.v ? "bg-[#b02a2a] text-white border-[#b02a2a]" : "border-[#ececec] dark:border-[#2a2a2a]"}`} data-testid={`seg-${s.v}`}>
              <div className="font-semibold">{s.label}</div>
              <div className="opacity-70 text-[11px] mt-0.5">{segCounts[s.v] ?? "—"} clientes</div>
            </button>
          ))}
        </div>

        <label className="text-xs uppercase font-semibold text-[#666] mt-2">Modèles rapides</label>
        <div className="flex flex-wrap gap-1.5 my-2">
          {TEMPLATES.map(t => <button key={t.label} onClick={() => applyTemplate(t)} className="text-xs dina-chip hover:bg-[#fff5f5] dark:hover:bg-[#2a1818]"><Zap size={10} />{t.label}</button>)}
        </div>

        <label className="text-xs uppercase font-semibold text-[#666]">Message (variables : {"{prenom}"}, {"{code}"})</label>
        <textarea className="dina-input my-2" rows={6} value={message} onChange={e => setMessage(e.target.value)} placeholder="Bonjour {prenom}, nous avons de nouveaux arrivages…" data-testid="wa-message" />

        <div className="flex gap-2 mt-3">
          <button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button>
          <button onClick={send} disabled={loading} className="dina-btn-primary flex-1" data-testid="wa-send-broadcast"><Send size={14} />{loading ? "Envoi…" : `Enfiler pour ${segCounts[segment] ?? "?"} clientes`}</button>
        </div>
      </div>
    </div>
  );
}
