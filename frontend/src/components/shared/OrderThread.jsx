import React, { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { dateTimeFmt } from "@/lib/format";

// Order-scoped thread shared by the whole team. party: "customer" | "rider"; me: "store" | "rider"
export default function OrderThread({ orderId, party, me = "store", quickReplies = [], onSent, height = "max-h-72" }) {
  const [conv, setConv] = useState(null);
  const [error, setError] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const count = conv?.messages?.length || 0;

  const load = async () => {
    try { const r = await api.get(`/orders/${orderId}/thread/${party}`); setConv(r.data); setError(null); }
    catch (e) { setError(e.response?.data?.detail || "Messagerie indisponible"); }
  };
  useEffect(() => { setConv(null); load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [orderId, party]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [count]);

  const send = async (value) => {
    const txt = (value ?? text).trim();
    if (!txt || sending) return;
    setSending(true);
    try {
      const r = await api.post(`/orders/${orderId}/thread/${party}/send`, { text: txt });
      setText(""); setConv(c => ({ ...c, messages: [...(c?.messages || []), r.data.message] })); onSent?.(txt);
    } catch (e) { toast.error(e.response?.data?.detail || "Erreur envoi"); }
    finally { setSending(false); }
  };

  if (error) return <div className="text-xs text-[#999] py-6 text-center" data-testid={`thread-error-${party}`}>{error}</div>;
  if (!conv) return <div className="text-xs text-[#999] py-6 text-center">Chargement…</div>;
  const mine = (m) => me === "rider" ? m.from_kind === "rider" : m.from_kind === "store";

  return (
    <div data-testid={`order-thread-${party}`}>
      <div ref={listRef} className={`${height} overflow-y-auto space-y-2 mb-3 p-2 bg-[#fafafa] dark:bg-[#141414] rounded-lg scrollbar-thin`} data-testid="od-msg-list">
        {count === 0 ? <div className="text-xs text-[#999] py-4 text-center">Pas encore de message. Commencez la conversation.</div>
        : conv.messages.map(m => (
          <div key={m.id} className={`flex ${mine(m) ? "justify-end" : "justify-start"}`} data-testid={`thread-msg-${m.id}`}>
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${mine(m) ? "bg-[#b02a2a] text-white" : "bg-white dark:bg-[#1f1f1f] border border-[#ececec] dark:border-[#2a2a2a]"}`}>
              <div className="whitespace-pre-wrap break-words">{m.text}</div>
              <div className={`text-[9px] mt-1 ${mine(m) ? "text-white/70" : "text-[#999]"}`}>{m.from_name} · {dateTimeFmt(m.at)}</div>
            </div>
          </div>
        ))}
      </div>
      {quickReplies.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-2 mb-1">
          {quickReplies.map((q, i) => <button key={i} onClick={() => send(q)} disabled={sending} className="shrink-0 text-[11px] px-2.5 py-1 rounded-full border border-[#ececec] dark:border-[#2a2a2a] hover:border-[#b02a2a] hover:text-[#b02a2a] transition-colors" data-testid={`quick-reply-${party}-${i}`}>{q}</button>)}
        </div>
      )}
      <div className="flex gap-2">
        <input className="dina-input flex-1" placeholder="Votre message…" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} data-testid="od-msg-input"/>
        <button onClick={() => send()} disabled={sending || !text.trim()} className="dina-btn-primary !min-h-[36px]" data-testid="od-msg-send"><Send size={13}/>Envoyer</button>
      </div>
    </div>
  );
}
