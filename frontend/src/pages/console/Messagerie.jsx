import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { RichComposer, RichText, plainPreview, AttachmentsView } from "@/components/shared/RichComposer";
import { dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";
import {
  Search, Send, MessageSquare, Megaphone, X, Pin, PinOff, Archive, ArchiveRestore, File as FileIcon,
  Download, Reply, SmilePlus, Trash2,
} from "lucide-react";

function MessageBubble({ m, isMe, onReact }) {
  const [showRx, setShowRx] = useState(false);
  const reactions = m.reactions || {};
  return (
    <div className={`group flex gap-2 ${isMe ? "justify-end" : "justify-start"}`} data-testid={`msg-${m.id}`}>
      <div className={`max-w-[75%] relative`}>
        <div className={`p-2.5 rounded-2xl ${isMe ? "bg-[#b02a2a] text-white rounded-br-sm" : "bg-white dark:bg-[#2a2a2a] rounded-bl-sm border border-[#ececec] dark:border-[#333]"}`}>
          <div className={`text-[10px] mb-1 ${isMe ? "opacity-80" : "text-[#666]"}`}>{m.from_name} · {dateTimeFmt(m.at)}</div>
          {m.text && <RichText text={m.text} className="text-sm leading-snug"/>}
          {m.image && <img src={m.image} alt="" className="mt-1 rounded max-h-48 object-contain" />}
          <div className="mt-1.5"><AttachmentsView items={m.attachments || []} onOpen={(u) => window.open(u, "_blank")} light={isMe}/></div>
          {Object.keys(reactions).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {Object.entries(reactions).map(([e, uids]) => (
                <button key={e} onClick={() => onReact(e)} className={`text-[11px] px-1.5 py-0.5 rounded-full ${isMe ? "bg-white/20" : "bg-[#f5f5f5]"}`} data-testid={`reaction-${e}`}>{e} {uids.length}</button>
              ))}
            </div>
          )}
        </div>
        <div className="absolute -top-3 right-0 opacity-0 group-hover:opacity-100 transition flex gap-1">
          <button onClick={() => setShowRx(!showRx)} className="bg-white dark:bg-[#1a1a1a] shadow border border-[#ececec] dark:border-[#333] rounded-full w-6 h-6 grid place-items-center" title="Réagir" data-testid={`react-btn-${m.id}`}><SmilePlus size={11}/></button>
        </div>
        {showRx && (
          <div className="absolute -top-10 right-0 bg-white dark:bg-[#1a1a1a] border border-[#ececec] dark:border-[#333] rounded-full px-2 py-1 shadow-lg flex gap-1 z-20" onMouseLeave={() => setShowRx(false)}>
            {["❤️","👍","👏","😂","🔥","💯"].map(e => (
              <button key={e} onClick={() => { onReact(e); setShowRx(false); }} className="hover:scale-125 transition" data-testid={`quick-react-${e}`}>{e}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------- Main component -------------------------- */
export default function Messagerie() {
  const [sp, setSp] = useSearchParams();
  const [convs, setConvs] = useState([]);
  const [archived, setArchived] = useState([]);
  const [active, setActive] = useState(null);
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [filter, setFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [q, setQ] = useState("");
  const [threadSearch, setThreadSearch] = useState("");
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastSegment, setBroadcastSegment] = useState(sp.get("segment_id") || null);
  const bottomRef = useRef();

  const load = async () => {
    const [a, b] = await Promise.all([
      api.get("/messages/conversations"),
      api.get("/messages/conversations?archived=true").catch(() => ({ data: [] })),
    ]);
    setConvs(a.data || []);
    setArchived(b.data || []);
    if (active) {
      const all = [...(a.data || []), ...(b.data || [])];
      const upd = all.find(c => c.id === active.id);
      if (upd) setActive(upd);
    }
  };

  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, []); // eslint-disable-line
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [active?.messages?.length]);
  useEffect(() => {
    if (active?.id && active.unread > 0) api.get(`/messages/conversations/${active.id}`).then(() => setConvs(cs => cs.map(c => c.id === active.id ? { ...c, unread: 0 } : c))).catch(() => {});
  }, [active?.id, active?.unread]); // eslint-disable-line

  // Deep-link: ?segment_id= opens broadcast, ?rider_id= / ?customer_id= opens conv
  useEffect(() => {
    const seg = sp.get("segment_id");
    const riderId = sp.get("rider_id");
    const custId = sp.get("customer_id");
    if (seg) { setBroadcastSegment(seg); setBroadcastOpen(true); }
    const openConv = async () => {
      if (!riderId && !custId) return;
      try {
        const r = await api.post("/messages/open", { rider_id: riderId || undefined, customer_id: custId || undefined });
        const list = await api.get("/messages/conversations");
        const conv = (list.data || []).find(c => c.id === r.data.id);
        if (conv) setActive(conv);
        setSp({}, { replace: true });
      } catch (e) { toast.error("Impossible d'ouvrir la conversation"); }
    };
    openConv();
  }, [sp]); // eslint-disable-line

  const visible = showArchived ? archived : convs;
  const filtered = visible.filter(c => {
    if (filter === "clientes" && c.kind !== "boutique_cliente") return false;
    if (filter === "livreurs" && c.kind !== "boutique_livreur") return false;
    if (filter === "unread" && !c.unread) return false;
    if (q) {
      const s = q.toLowerCase();
      const names = (c.participants || []).map(p => p.name || "").join(" ").toLowerCase();
      const code = `${c.order_code || ""} ${(c.order_codes || []).join(" ")}`.toLowerCase();
      const inMsgs = (c.messages || []).some(m => (m.text || "").toLowerCase().includes(s)) || (c.last_message?.text || "").toLowerCase().includes(s);
      if (!names.includes(s) && !code.includes(s) && !inMsgs) return false;
    }
    return true;
  });

  const otherParty = (c) => (c.participants || []).find(p => p.kind !== "store");

  const send = async () => {
    if (!text.trim() && attachments.length === 0) return;
    if (!active) return;
    const other = otherParty(active);
    if (!other) return;
    try {
      await api.post("/messages/send", {
        [other.kind === "customer" ? "customer_id" : "rider_id"]: other.id,
        text, attachments, kind: active.kind, order_id: active.order_id, conversation_id: active.id,
      });
      setText(""); setAttachments([]); load();
    } catch { toast.error("Erreur d'envoi"); }
  };

  const togglePin = async (c, e) => {
    e?.stopPropagation();
    await api.patch(`/messages/conversations/${c.id}/pin`);
    toast.success(c.pinned ? "Désépinglée" : "Épinglée en haut");
    load();
  };

  const toggleArchive = async (c, e) => {
    e?.stopPropagation();
    await api.patch(`/messages/conversations/${c.id}/archive`);
    toast.success(c.archived ? "Désarchivée" : "Conversation archivée");
    if (active?.id === c.id) setActive(null);
    load();
  };

  const react = async (msgId, emoji) => {
    if (!active) return;
    await api.post(`/messages/conversations/${active.id}/react`, { message_id: msgId, emoji });
    load();
  };

  const filteredMessages = useMemo(() => {
    const msgs = active?.messages || [];
    if (!threadSearch.trim()) return msgs;
    return msgs.filter(m => (m.text || "").toLowerCase().includes(threadSearch.toLowerCase()));
  }, [active, threadSearch]);

  return (
    <div className="font-sora">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div>
          <h1 className="font-serif text-3xl">Messagerie interne</h1>
          <p className="text-sm text-[#666]">{convs.length} active(s) · {archived.length} archivée(s)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowArchived(!showArchived)} className={`dina-btn-secondary !min-h-[40px] ${showArchived ? "!bg-[#fff5f5] !text-[#b02a2a] !border-[#b02a2a]" : ""}`} data-testid="msg-toggle-archive">
            {showArchived ? <><ArchiveRestore size={14}/>Voir actives</> : <><Archive size={14}/>Archivées ({archived.length})</>}
          </button>
          <button onClick={() => setBroadcastOpen(true)} className="dina-btn-primary !min-h-[40px]" data-testid="msg-broadcast"><Megaphone size={14}/>Diffusion</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-14rem)]">
        {/* Sidebar list */}
        <div className="dina-card-white p-3 flex flex-col min-h-0">
          <div className="relative mb-2">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#999]"/>
            <input className="dina-input pl-7 !py-1.5 text-xs" placeholder="Nom, n° de commande ou message…" value={q} onChange={e => setQ(e.target.value)} data-testid="msg-search"/>
          </div>
          <div className="flex gap-1 mb-2 text-[11px] flex-wrap">
            {[["all","Toutes"],["clientes","Clientes"],["livreurs","Livreurs"],["unread","Non lus"]].map(([k,l]) => (
              <button key={k} onClick={() => setFilter(k)} className={`px-2 py-1 rounded ${filter===k?"bg-[#b02a2a] text-white":"bg-[#f5f5f5] dark:bg-[#1a1a1a]"}`} data-testid={`msg-filter-${k}`}>{l}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto space-y-1">
            {filtered.length === 0 ? (
              <div className="text-xs text-[#666] text-center py-6">{showArchived ? "Aucune conversation archivée" : "Aucune conversation"}</div>
            ) : filtered.map(c => {
              const other = otherParty(c);
              return (
                <div key={c.id} className={`group relative rounded ${active?.id===c.id?"bg-[#fff5f5] dark:bg-[#2a1818]":"hover:bg-[#fafafa] dark:hover:bg-[#141414]"}`}>
                  <button onClick={() => setActive(c)} className="w-full text-left p-2" data-testid={`msg-conv-${c.id}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#fff5f5] text-[#b02a2a] grid place-items-center text-xs font-bold shrink-0">{other?.name?.[0] || "?"}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate flex items-center gap-1">
                          {c.pinned && <Pin size={10} className="text-[#e4991e]"/>}
                          {other?.name || "—"}
                          {c.unread > 0 && <span className="bg-[#b02a2a] text-white text-[9px] px-1.5 rounded-full">{c.unread}</span>}
                        </div>
                        <div className="text-[11px] text-[#666] truncate">
                          {c.last_message?.text ? plainPreview(c.last_message.text) : (c.last_message?.attachments?.length ? "Pièce jointe" : "—")}
                        </div>
                      </div>
                      <span className="text-[9px] text-[#999]">{c.kind?.includes("livreur") ? "🛵" : "👤"}</span>
                    </div>
                  </button>
                  <div className="absolute top-1 right-1 hidden group-hover:flex gap-0.5">
                    <button onClick={e => togglePin(c, e)} className="w-6 h-6 grid place-items-center rounded hover:bg-white text-[#666]" title={c.pinned ? "Désépingler" : "Épingler"} data-testid={`msg-pin-${c.id}`}>{c.pinned ? <PinOff size={10}/> : <Pin size={10}/>}</button>
                    <button onClick={e => toggleArchive(c, e)} className="w-6 h-6 grid place-items-center rounded hover:bg-white text-[#666]" title={c.archived ? "Désarchiver" : "Archiver"} data-testid={`msg-archive-${c.id}`}>{c.archived ? <ArchiveRestore size={10}/> : <Archive size={10}/>}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Thread */}
        <div className="dina-card-white p-3 flex flex-col min-h-0">
          {!active ? (
            <div className="flex-1 grid place-items-center text-sm text-[#666]">
              <div className="text-center">
                <MessageSquare size={32} className="mx-auto text-[#ccc] mb-2"/>
                Sélectionnez une conversation<br/>
                <span className="text-xs">Choisissez une conversation pour lire et répondre</span>
              </div>
            </div>
          ) : (
            <>
              <div className="pb-2 mb-2 border-b border-[#ececec] dark:border-[#2a2a2a] flex items-center gap-2">
                <div className="flex-1">
                  <div className="font-semibold">{otherParty(active)?.name}</div>
                  <div className="text-[11px] text-[#666]">
                    {active.kind?.replace(/_/g, " ")}
                    {active.pinned && " · 📌 épinglée"}
                    {active.archived && " · 📦 archivée"}
                    {active.closed && " · ❌ fermée"}
                  </div>
                </div>
                <input type="search" placeholder="Chercher dans ce fil…" value={threadSearch} onChange={e => setThreadSearch(e.target.value)} className="dina-input !py-1 !h-7 text-xs max-w-[180px]" data-testid="msg-thread-search"/>
                <button onClick={e => togglePin(active, e)} className="dina-btn-secondary !min-h-[28px] !px-2" title={active.pinned ? "Désépingler" : "Épingler"} data-testid="thread-pin">{active.pinned ? <PinOff size={12}/> : <Pin size={12}/>}</button>
                <button onClick={e => toggleArchive(active, e)} className="dina-btn-secondary !min-h-[28px] !px-2" title={active.archived ? "Désarchiver" : "Archiver"} data-testid="thread-archive">{active.archived ? <ArchiveRestore size={12}/> : <Archive size={12}/>}</button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 bg-[#fafafa] dark:bg-[#0f0f0f] rounded p-3" data-testid="msg-thread">
                {filteredMessages.length === 0 ? (
                  <div className="text-center text-xs text-[#666] py-6">{threadSearch ? "Aucun message correspondant" : "Démarrez la conversation ci-dessous"}</div>
                ) : filteredMessages.map(m => (
                  <MessageBubble key={m.id} m={m} isMe={m.from_kind === "store"} onReact={e => react(m.id, e)}/>
                ))}
                <div ref={bottomRef}/>
              </div>

              {!active.closed && (
                <div className="mt-3">
                  <RichComposer value={text} onChange={setText} onSend={send} attachments={attachments} onAttachments={setAttachments} canSend={!!(text.trim() || attachments.length)} rows={2} placeholder="Votre message…" testid="msg"/>
                </div>
              )}
              {active.closed && <div className="text-xs text-[#999] text-center mt-3">Conversation fermée après livraison</div>}
            </>
          )}
        </div>
      </div>

      {broadcastOpen && <BroadcastModal preselectedSegment={broadcastSegment} onClose={() => { setBroadcastOpen(false); setBroadcastSegment(null); }} onDone={() => { setBroadcastOpen(false); setBroadcastSegment(null); load(); }}/>}
    </div>
  );
}

function BroadcastModal({ preselectedSegment, onClose, onDone }) {
  const [target, setTarget] = useState(preselectedSegment ? `segment:${preselectedSegment}` : "all");
  const [text, setText] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [atts, setAtts] = useState([]);
  const [sending, setSending] = useState(false);
  const [segments, setSegments] = useState([]);
  useEffect(() => { api.get("/segments").then(r => setSegments(r.data || [])).catch(() => {}); }, []);
  const send = async () => {
    if (!text.trim()) return toast.error("Message requis");
    setSending(true);
    try { const r = await api.post("/messages/broadcast", { target, text, attachments: atts, valid_until: validUntil || null }); toast.success(`Envoyé à ${r.data.count} destinataire(s)`); onDone(); }
    catch { toast.error("Erreur"); } finally { setSending(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()} data-testid="broadcast-modal">
        <div className="flex items-center justify-between mb-4"><div className="font-serif text-xl">Diffusion in-app</div><button onClick={onClose}><X size={18}/></button></div>
        <label className="text-[10px] uppercase text-[#666] font-semibold">Cible</label>
        <select className="dina-input mb-3 mt-1" value={target} onChange={e => setTarget(e.target.value)} data-testid="broadcast-target">
          <option value="all">Toutes les clientes actives</option>
          {segments.length > 0 && <optgroup label="Segments définis">
            {segments.map(s => <option key={s.id} value={`segment:${s.id}`}>{s.name} ({s.count || 0} cliente{(s.count || 0) > 1 ? "s" : ""})</option>)}
          </optgroup>}
        </select>
        <label className="text-[10px] uppercase text-[#666] font-semibold">Message</label>
        <div className="mb-3 mt-1"><RichComposer value={text} onChange={setText} attachments={atts} onAttachments={setAtts} rows={5} placeholder="Votre message…" testid="broadcast-text"/></div>
        <label className="text-[10px] uppercase text-[#666] font-semibold">Valide jusqu'au</label>
        <input type="date" className="dina-input mb-3 mt-1" value={validUntil} onChange={e => setValidUntil(e.target.value)}/>
        <div className="flex gap-2"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={send} disabled={sending} className="dina-btn-primary flex-1" data-testid="broadcast-send">{sending ? "Envoi…" : "Diffuser"}</button></div>
      </div>
    </div>
  );
}
