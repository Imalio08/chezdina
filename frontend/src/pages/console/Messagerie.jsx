import React, { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";
import { Search, Send, MessageSquare, Users, Megaphone, X } from "lucide-react";

export default function Messagerie() {
  const [convs, setConvs] = useState([]);
  const [active, setActive] = useState(null);
  const [text, setText] = useState("");
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const bottomRef = useRef();

  const load = async () => {
    const r = await api.get("/messages/conversations");
    setConvs(r.data || []);
    if (active) {
      const upd = (r.data || []).find(c => c.id === active.id);
      if (upd) setActive(upd);
    }
  };
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [active?.messages?.length]);

  const filtered = convs.filter(c => {
    if (filter === "clientes" && c.kind !== "boutique_cliente") return false;
    if (filter === "livreurs" && c.kind !== "boutique_livreur") return false;
    if (filter === "unread" && !c.unread) return false;
    if (q) {
      const names = (c.participants || []).map(p => p.name || "").join(" ").toLowerCase();
      if (!names.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const otherParty = (c) => (c.participants || []).find(p => p.kind !== "store");

  const send = async () => {
    if (!text.trim() || !active) return;
    const other = otherParty(active);
    if (!other) return;
    try {
      await api.post("/messages/send", {
        [other.kind === "customer" ? "customer_id" : "rider_id"]: other.id,
        text, kind: active.kind, order_id: active.order_id,
      });
      setText(""); load();
    } catch { toast.error("Erreur"); }
  };

  return (
    <div className="font-sora">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-5">
        <div><h1 className="font-serif text-3xl">Messagerie</h1><p className="text-sm text-[#666]">{convs.length} conversation(s)</p></div>
        <button onClick={() => setBroadcastOpen(true)} className="dina-btn-primary !min-h-[40px]" data-testid="msg-broadcast"><Megaphone size={14} />Diffusion</button>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-14rem)]">
        <div className="dina-card-white p-3 flex flex-col min-h-0">
          <div className="relative mb-2"><Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#999]" /><input className="dina-input pl-7 !py-1.5 text-xs" placeholder="Rechercher…" value={q} onChange={e => setQ(e.target.value)} data-testid="msg-search" /></div>
          <div className="flex gap-1 mb-2 text-[11px]">
            {[["all", "Toutes"], ["clientes", "Clientes"], ["livreurs", "Livreurs"], ["unread", "Non lus"]].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={`px-2 py-1 rounded ${filter === k ? "bg-[#b02a2a] text-white" : "bg-[#f5f5f5] dark:bg-[#1a1a1a]"}`} data-testid={`msg-filter-${k}`}>{l}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto space-y-1">
            {filtered.length === 0 ? <div className="text-xs text-[#666] text-center py-6">Aucune conversation</div> :
              filtered.map(c => {
                const other = otherParty(c);
                return (
                  <button key={c.id} onClick={() => setActive(c)} className={`w-full text-left p-2 rounded ${active?.id === c.id ? "bg-[#fff5f5] dark:bg-[#2a1818]" : "hover:bg-[#fafafa] dark:hover:bg-[#141414]"}`} data-testid={`msg-conv-${c.id}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#fff5f5] text-[#b02a2a] grid place-items-center text-xs font-bold shrink-0">{other?.name?.[0] || "?"}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate flex items-center gap-1">{other?.name || "—"}{c.unread > 0 && <span className="bg-[#b02a2a] text-white text-[9px] px-1.5 rounded-full">{c.unread}</span>}</div>
                        <div className="text-[11px] text-[#666] truncate">{c.last_message?.text || "—"}</div>
                      </div>
                      {c.closed && <span className="text-[9px] text-[#999]">Fermée</span>}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        <div className="dina-card-white p-3 flex flex-col min-h-0">
          {!active ? <div className="flex-1 grid place-items-center text-sm text-[#666]"><div className="text-center"><MessageSquare size={32} className="mx-auto text-[#ccc] mb-2" />Sélectionnez une conversation</div></div> :
            <>
              <div className="pb-2 mb-2 border-b border-[#ececec] dark:border-[#2a2a2a]"><div className="font-semibold">{otherParty(active)?.name}</div><div className="text-[11px] text-[#666]">{active.kind.replace(/_/g, " ")}{active.closed && " · Fermée"}</div></div>
              <div className="flex-1 overflow-y-auto space-y-2 bg-[#fafafa] dark:bg-[#0f0f0f] rounded p-3" data-testid="msg-thread">
                {(active.messages || []).map(m => (
                  <div key={m.id} className={`flex ${m.from_kind === "store" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] p-2.5 rounded-lg text-sm ${m.from_kind === "store" ? "bg-[#b02a2a] text-white" : "bg-white dark:bg-[#2a2a2a]"}`}>
                      <div className="text-[10px] opacity-70 mb-0.5">{m.from_name} · {dateTimeFmt(m.at)}</div>
                      <div>{m.text}</div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              {!active.closed ? (
                <div className="flex gap-2 mt-3">
                  <input className="dina-input flex-1" placeholder="Message…" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} data-testid="msg-input" />
                  <button onClick={send} className="dina-btn-primary" data-testid="msg-send"><Send size={13} /></button>
                </div>
              ) : <div className="text-xs text-[#999] text-center mt-3">Conversation fermée après livraison</div>}
            </>}
        </div>
      </div>

      {broadcastOpen && <BroadcastModal onClose={() => setBroadcastOpen(false)} onDone={() => { setBroadcastOpen(false); load(); }} />}
    </div>
  );
}

function BroadcastModal({ onClose, onDone }) {
  const [target, setTarget] = useState("all");
  const [text, setText] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!text.trim()) return toast.error("Message requis");
    setSending(true);
    try { const r = await api.post("/messages/broadcast", { target, text, valid_until: validUntil || null }); toast.success(`Envoyé à ${r.data.count} destinataire(s)`); onDone(); }
    catch { toast.error("Erreur"); } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()} data-testid="broadcast-modal">
        <div className="flex items-center justify-between mb-4"><div className="font-serif text-xl">Diffusion in-app</div><button onClick={onClose}><X size={18} /></button></div>
        <select className="dina-input mb-3" value={target} onChange={e => setTarget(e.target.value)} data-testid="broadcast-target"><option value="all">Toutes les clientes actives</option></select>
        <textarea className="dina-input mb-3" rows={5} placeholder="Message..." value={text} onChange={e => setText(e.target.value)} data-testid="broadcast-text" />
        <input type="date" className="dina-input mb-3" value={validUntil} onChange={e => setValidUntil(e.target.value)} placeholder="Valide jusqu'au..." />
        <div className="flex gap-2"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={send} disabled={sending} className="dina-btn-primary flex-1" data-testid="broadcast-send">{sending ? "Envoi…" : "Diffuser"}</button></div>
      </div>
    </div>
  );
}
