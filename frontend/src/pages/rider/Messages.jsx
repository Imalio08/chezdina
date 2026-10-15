import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { dateTimeFmt } from "@/lib/format";
import { MessagePhotos, PhotoLightbox } from "@/components/shared/OrderThread";
import { RichComposer, RichText } from "@/components/shared/RichComposer";

const KIND = { livreur_cliente: "Cliente", commande_livreur: "Boutique · commande" };
const kindLabel = (c) => KIND[c.kind] || "Boutique";

function Inbox() {
  const nav = useNavigate();
  const [list, setList] = useState(null);
  useEffect(() => {
    const load = () => api.get("/rider/conversations").then(r => setList(r.data)).catch(() => setList([]));
    load(); const t = setInterval(load, 10000); return () => clearInterval(t);
  }, []);
  if (!list) return <div className="text-center text-sm text-[#666] py-10">Chargement…</div>;
  if (!list.length) return <div className="text-center text-sm text-[#666] py-12" data-testid="rider-inbox-empty"><MessageSquare size={36} className="mx-auto text-[#ccc] mb-2"/>Aucune conversation pour le moment</div>;
  return (
    <div className="space-y-2" data-testid="rider-inbox">
      <div className="font-serif text-xl px-1">Messages</div>
      {list.map(c => (
        <button key={c.id} onClick={() => nav(`/rider/messages/${c.id}`)} className="w-full text-left bg-white dark:bg-[#1a1a1a] rounded-xl p-3 border border-[#ececec] dark:border-[#2a2a2a] flex gap-3" data-testid={`rider-conv-${c.id}`}>
          <div className="w-9 h-9 rounded-full bg-[color:var(--rider-accent)] text-[color:var(--rider-primary)] font-bold text-sm grid place-items-center shrink-0">{(c.with?.name || "?")[0]}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-sm truncate">{c.with?.name || "—"}</div>
              {c.unread > 0 && <span className="bg-[#b02a2a] text-white text-[10px] rounded-full px-1.5 py-0.5 shrink-0" data-testid={`rider-conv-unread-${c.id}`}>{c.unread}</span>}
            </div>
            <div className="text-[10px] uppercase text-[#999]">{kindLabel(c)}{c.order_code ? ` · ${c.order_code}` : ""}{c.closed ? " · fermée" : ""}</div>
            <div className="text-xs text-[#666] truncate">{c.last_message?.text || (c.last_message ? "📷 Photo" : "Nouvelle conversation")}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

function Conversation({ id }) {
  const nav = useNavigate();
  const [conv, setConv] = useState(null);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState(null);
  const [zoom, setZoom] = useState(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const load = () => api.get(`/rider/conversations/${id}`).then(r => setConv(r.data)).catch(() => toast.error("Conversation introuvable"));
  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, [id]); // eslint-disable-line
  const count = conv?.messages?.length || 0;
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [count]);
  const send = async () => {
    if ((!text.trim() && !photo) || sending) return;
    setSending(true);
    try {
      const r = await api.post(`/rider/conversations/${id}/send`, { text, attachments: photo ? [{ type: "image", url: photo, name: "photo.jpg", mime: "image/jpeg" }] : [] });
      setText(""); setPhoto(null); setConv(c => ({ ...c, messages: [...(c?.messages || []), r.data.message] }));
    } catch (e) { toast.error(e.response?.data?.detail || "Erreur envoi"); }
    finally { setSending(false); }
  };
  const other = conv && (conv.participants || []).find(p => p.kind !== "rider");
  return (
    <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-[#ececec] dark:border-[#2a2a2a] p-3 flex flex-col h-[calc(100dvh-170px)]" data-testid="rider-conversation">
      <PhotoLightbox src={zoom} onClose={() => setZoom(null)}/>
      <div className="flex items-center gap-2 pb-2 border-b border-[#f0f0f0] dark:border-[#2a2a2a]">
        <button onClick={() => nav("/rider/messages")} className="p-1" data-testid="rider-conv-back"><ArrowLeft size={16}/></button>
        <div className="min-w-0"><div className="font-semibold text-sm truncate">{other?.name || "…"}</div><div className="text-[10px] text-[#999] uppercase">{conv ? kindLabel(conv) : ""}{conv?.order_code ? ` · ${conv.order_code}` : ""}</div></div>
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto py-2 space-y-2">
        {count === 0 ? <div className="text-xs text-[#999] text-center py-6">Pas encore de message</div> : conv.messages.map(m => {
          const mine = m.from_kind === "rider";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[82%] rounded-xl px-3 py-2 text-sm ${mine ? "bg-[color:var(--rider-primary)] text-white" : "bg-[#f5f5f5] dark:bg-[#242424]"}`}>
                <MessagePhotos m={m} onOpen={setZoom}/><RichText text={m.text}/>
                <div className={`text-[9px] mt-1 ${mine ? "text-white/70" : "text-[#999]"}`}>{!mine && m.from_name ? `${m.from_name} · ` : ""}{dateTimeFmt(m.at)}</div>
              </div>
            </div>
          );
        })}
      </div>
      {photo && <div className="relative inline-block mb-2 self-start"><img src={photo} alt="Aperçu" className="h-16 rounded-lg"/><button onClick={() => setPhoto(null)} className="absolute -top-2 -right-2 bg-[#1c1c1c] text-white rounded-full px-1.5 text-xs">×</button></div>}
      {conv?.closed ? <div className="text-xs text-[#999] text-center pt-2">Conversation fermée après la livraison</div>
        : <RichComposer value={text} onChange={setText} onSend={send} onPhoto={setPhoto} sending={sending} canSend={!!(text.trim() || photo)} testid="rider-msg"/>}
    </div>
  );
}

export default function RiderMessages() {
  const { id } = useParams();
  return id ? <Conversation id={id}/> : <Inbox/>;
}
