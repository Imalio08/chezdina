import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";
import {
  Search, Send, MessageSquare, Megaphone, X, Paperclip, Smile, Bold, Italic, Strikethrough,
  List as ListIcon, Pin, PinOff, Archive, ArchiveRestore, Image as ImageIcon, Video, File as FileIcon,
  Download, Reply, SmilePlus, Trash2,
} from "lucide-react";

/* -------------------------- Emoji picker (curated) -------------------------- */
const EMOJI_GROUPS = {
  Visages: ["😀","😁","😂","🤣","😊","😍","😘","😎","🤔","🙄","😅","😏","🥰","😇","🙂","😉","😢","😭","😡","🤯","😱","😴","🤤","😷"],
  Gestes: ["👍","👎","👏","🙏","💪","🤝","✋","👌","✊","🫶","🤌","👉","👈","👆","👇"],
  Cœurs: ["❤️","🧡","💛","💚","💙","💜","🤍","🖤","💔","💕","💞","💓","💗","💖","💘","💝"],
  Mode: ["👗","👚","👕","👖","👠","👡","👢","👜","👛","💄","💍","👒","🧢","🧣","🧥","🕶️"],
  Objets: ["🎁","🎉","🎊","🛍️","💰","💵","💳","📦","📱","📸","⭐","✨","🔥","💯","✅","❌","⏰","📅","🎯","💡"],
};

function EmojiPicker({ onPick, onClose }) {
  const [tab, setTab] = useState("Visages");
  return (
    <div className="absolute bottom-full mb-2 right-0 bg-white dark:bg-[#1a1a1a] border border-[#ececec] dark:border-[#2a2a2a] rounded-xl shadow-xl p-2 w-72 z-30" onClick={e => e.stopPropagation()} data-testid="emoji-picker">
      <div className="flex gap-1 mb-2 border-b border-[#f0f0f0] pb-2 overflow-x-auto">
        {Object.keys(EMOJI_GROUPS).map(g => (
          <button key={g} onClick={() => setTab(g)} className={`px-2 py-1 text-[11px] rounded whitespace-nowrap ${tab === g ? "bg-[#fff5f5] text-[#b02a2a]" : "hover:bg-[#fafafa]"}`} data-testid={`emoji-tab-${g}`}>{g}</button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-1 max-h-56 overflow-y-auto">
        {EMOJI_GROUPS[tab].map(e => (
          <button key={e} onClick={() => onPick(e)} className="text-xl hover:bg-[#fff5f5] rounded p-1" data-testid={`emoji-${e}`}>{e}</button>
        ))}
      </div>
      <button onClick={onClose} className="w-full text-[10px] text-[#666] mt-2 hover:text-[#1c1c1c]">Fermer</button>
    </div>
  );
}

/* -------------------------- Markdown renderer (minimal) -------------------------- */
function renderMarkdown(text = "") {
  // Escape then re-apply styles. Order matters.
  let out = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<u>$1</u>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/~~(.+?)~~/g, "<s>$1</s>")
    .replace(/`([^`]+?)`/g, '<code class="px-1 py-0.5 rounded bg-black/10 text-[11px] font-mono">$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="underline text-[#5867fd]">$1</a>')
    .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noreferrer" class="underline opacity-80">$2</a>')
    .replace(/\n/g, "<br/>");
  // Simple bullet lines "- item" or "• item" grouped into a <ul>
  if (/^(-|•)\s/m.test(out)) {
    out = out.replace(/(?:^|<br\/>)((?:-|•)\s[^<]+)(?=<br\/>|$)/g, (_, li) => `<li>${li.replace(/^(-|•)\s/, "")}</li>`);
    out = out.replace(/(<li>[^]+?<\/li>)/, '<ul class="list-disc list-inside my-1">$1</ul>');
  }
  return out;
}

function AttachmentPreview({ a, onRemove }) {
  const Icon = a.type === "image" ? ImageIcon : a.type === "video" ? Video : FileIcon;
  return (
    <div className="relative inline-flex items-center gap-2 bg-[#fff5f5] dark:bg-[#2a1818] rounded-lg px-2 py-1 text-xs" data-testid="attachment-preview">
      {a.type === "image" && a.url ? <img src={a.url} alt="" className="w-8 h-8 rounded object-cover"/> : <Icon size={14} className="text-[#b02a2a]"/>}
      <span className="max-w-[120px] truncate">{a.name || "fichier"}</span>
      <span className="text-[10px] text-[#666]">{a.size ? `${Math.round(a.size / 1024)} ko` : ""}</span>
      {onRemove && <button onClick={onRemove} className="text-[#c62828] ml-1" data-testid="attachment-remove"><X size={11}/></button>}
    </div>
  );
}

function MessageBubble({ m, isMe, onReact }) {
  const [showRx, setShowRx] = useState(false);
  const reactions = m.reactions || {};
  return (
    <div className={`group flex gap-2 ${isMe ? "justify-end" : "justify-start"}`} data-testid={`msg-${m.id}`}>
      <div className={`max-w-[75%] relative`}>
        <div className={`p-2.5 rounded-2xl ${isMe ? "bg-[#b02a2a] text-white rounded-br-sm" : "bg-white dark:bg-[#2a2a2a] rounded-bl-sm border border-[#ececec] dark:border-[#333]"}`}>
          <div className={`text-[10px] mb-1 ${isMe ? "opacity-80" : "text-[#666]"}`}>{m.from_name} · {dateTimeFmt(m.at)}</div>
          {m.text && <div className="text-sm leading-snug" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }}/>}
          {m.image && <img src={m.image} alt="" className="mt-1 rounded max-h-48 object-contain" />}
          {(m.attachments || []).map((a, i) => (
            <div key={i} className="mt-1.5">
              {a.type === "image" && <img src={a.url} alt={a.name} className="rounded max-h-48 object-contain"/>}
              {a.type === "video" && <video src={a.url} controls className="rounded max-h-48 w-full"/>}
              {a.type === "audio" && <audio src={a.url} controls className="w-full"/>}
              {a.type === "file" && (
                <a href={a.url} target="_blank" rel="noreferrer" download={a.name} className={`inline-flex items-center gap-2 text-xs underline ${isMe ? "text-white" : "text-[#5867fd]"}`}>
                  <FileIcon size={12}/>{a.name || "fichier"} ({a.size ? `${Math.round(a.size / 1024)} ko` : "—"})<Download size={11}/>
                </a>
              )}
            </div>
          ))}
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
  const [emojiOpen, setEmojiOpen] = useState(false);
  const bottomRef = useRef();
  const fileRef = useRef();
  const inputRef = useRef();

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
      const names = (c.participants || []).map(p => p.name || "").join(" ").toLowerCase();
      const inMsgs = (c.messages || []).some(m => (m.text || "").toLowerCase().includes(q.toLowerCase()));
      if (!names.includes(q.toLowerCase()) && !inMsgs) return false;
    }
    return true;
  });

  const otherParty = (c) => (c.participants || []).find(p => p.kind !== "store");

  const insertMarkdown = (before, after = before) => {
    const el = inputRef.current;
    if (!el) { setText(text + before + after); return; }
    const start = el.selectionStart || 0, end = el.selectionEnd || 0;
    const sel = text.slice(start, end) || "texte";
    const next = text.slice(0, start) + before + sel + after + text.slice(end);
    setText(next);
    setTimeout(() => { el.focus(); el.setSelectionRange(start + before.length, start + before.length + sel.length); }, 0);
  };

  const addAttachment = (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("10 Mo maximum par pièce jointe");
    const type = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "file";
    const reader = new FileReader();
    reader.onload = () => setAttachments(a => [...a, { type, url: reader.result, name: file.name, size: file.size, mime: file.type }]);
    reader.readAsDataURL(file);
  };

  const send = async () => {
    if (!text.trim() && attachments.length === 0) return;
    if (!active) return;
    const other = otherParty(active);
    if (!other) return;
    try {
      await api.post("/messages/send", {
        [other.kind === "customer" ? "customer_id" : "rider_id"]: other.id,
        text, attachments, kind: active.kind, order_id: active.order_id,
      });
      setText(""); setAttachments([]); setEmojiOpen(false); load();
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
            {showArchived ? <><ArchiveRestore size={14}/>Voir actives</> : <><Archive size={14}/>Archives ({archived.length})</>}
          </button>
          <button onClick={() => setBroadcastOpen(true)} className="dina-btn-primary !min-h-[40px]" data-testid="msg-broadcast"><Megaphone size={14}/>Diffusion</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-14rem)]">
        {/* Sidebar list */}
        <div className="dina-card-white p-3 flex flex-col min-h-0">
          <div className="relative mb-2">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#999]"/>
            <input className="dina-input pl-7 !py-1.5 text-xs" placeholder="Rechercher nom ou message…" value={q} onChange={e => setQ(e.target.value)} data-testid="msg-search"/>
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
                          {c.last_message?.text?.replace(/[*_~`]/g, "") || (c.last_message?.attachments?.length ? "📎 pièce jointe" : "—")}
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
                <span className="text-xs">Markdown • emojis • pièces jointes • réactions</span>
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
                  {/* Toolbar */}
                  <div className="flex items-center gap-1 mb-1.5 text-[#666]">
                    <button onClick={() => insertMarkdown("**")} className="hover:text-[#1c1c1c] p-1" title="Gras" data-testid="fmt-bold"><Bold size={13}/></button>
                    <button onClick={() => insertMarkdown("*")} className="hover:text-[#1c1c1c] p-1" title="Italique" data-testid="fmt-italic"><Italic size={13}/></button>
                    <button onClick={() => insertMarkdown("~~")} className="hover:text-[#1c1c1c] p-1" title="Barré" data-testid="fmt-strike"><Strikethrough size={13}/></button>
                    <button onClick={() => insertMarkdown("\n- ", "")} className="hover:text-[#1c1c1c] p-1" title="Liste" data-testid="fmt-list"><ListIcon size={13}/></button>
                    <div className="w-px h-4 bg-[#ececec] mx-1"/>
                    <button onClick={() => fileRef.current?.click()} className="hover:text-[#1c1c1c] p-1" title="Pièce jointe" data-testid="fmt-attach"><Paperclip size={13}/></button>
                    <div className="relative">
                      <button onClick={() => setEmojiOpen(!emojiOpen)} className={`hover:text-[#1c1c1c] p-1 ${emojiOpen ? "text-[#b02a2a]" : ""}`} title="Emoji" data-testid="fmt-emoji"><Smile size={13}/></button>
                      {emojiOpen && <EmojiPicker onPick={e => { insertMarkdown(e, ""); }} onClose={() => setEmojiOpen(false)}/>}
                    </div>
                    <input ref={fileRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden" onChange={e => { addAttachment(e.target.files?.[0]); e.target.value = ""; }} data-testid="file-input"/>
                    <div className="ml-auto text-[10px] text-[#999]">**gras** · *ital.* · ~~barré~~ · [lien](url)</div>
                  </div>

                  {/* Attachments preview */}
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {attachments.map((a, i) => <AttachmentPreview key={i} a={a} onRemove={() => setAttachments(attachments.filter((_, idx) => idx !== i))}/>)}
                    </div>
                  )}

                  <div className="flex gap-2 items-end">
                    <textarea
                      ref={inputRef}
                      rows={2}
                      className="dina-input flex-1 resize-none"
                      placeholder="Message… (Entrée pour envoyer · Maj+Entrée pour nouvelle ligne)"
                      value={text}
                      onChange={e => setText(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                      data-testid="msg-input"
                    />
                    <button onClick={send} className="dina-btn-primary !min-h-[44px]" data-testid="msg-send" disabled={!text.trim() && attachments.length === 0}><Send size={13}/></button>
                  </div>
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
  const [sending, setSending] = useState(false);
  const [segments, setSegments] = useState([]);
  useEffect(() => { api.get("/segments").then(r => setSegments(r.data || [])).catch(() => {}); }, []);
  const send = async () => {
    if (!text.trim()) return toast.error("Message requis");
    setSending(true);
    try { const r = await api.post("/messages/broadcast", { target, text, valid_until: validUntil || null }); toast.success(`Envoyé à ${r.data.count} destinataire(s)`); onDone(); }
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
        <label className="text-[10px] uppercase text-[#666] font-semibold">Message (markdown supporté)</label>
        <textarea className="dina-input mb-3 mt-1" rows={5} placeholder="Message..." value={text} onChange={e => setText(e.target.value)} data-testid="broadcast-text"/>
        <label className="text-[10px] uppercase text-[#666] font-semibold">Valide jusqu'au</label>
        <input type="date" className="dina-input mb-3 mt-1" value={validUntil} onChange={e => setValidUntil(e.target.value)}/>
        <div className="flex gap-2"><button onClick={onClose} className="dina-btn-secondary flex-1">Annuler</button><button onClick={send} disabled={sending} className="dina-btn-primary flex-1" data-testid="broadcast-send">{sending ? "Envoi…" : "Diffuser"}</button></div>
      </div>
    </div>
  );
}
