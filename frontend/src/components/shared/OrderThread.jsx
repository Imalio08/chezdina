import React, { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Camera, X } from "lucide-react";
import { dateTimeFmt } from "@/lib/format";
import { compressImage } from "@/lib/imageCompress";
import { editImage } from "@/components/shared/ImageEditor";
import { RichComposer, RichText } from "@/components/shared/RichComposer";

export function MessagePhotos({ m, onOpen }) {
  const imgs = (m.attachments || []).filter(a => a.type === "image");
  if (!imgs.length) return null;
  return <div className="flex flex-wrap gap-1.5 mb-1">{imgs.map((a, i) => <img key={i} src={a.url} alt="Photo" onClick={() => onOpen(a.url)} className="w-36 h-28 object-cover rounded-lg cursor-zoom-in hover:opacity-90 transition-opacity" data-testid="thread-photo"/>)}</div>;
}

export function PhotoLightbox({ src, onClose }) {
  if (!src) return null;
  return (
    <div className="fixed inset-0 bg-black/85 z-[90] grid place-items-center p-4" onClick={onClose} data-testid="photo-lightbox">
      <button className="absolute top-4 right-4 text-white" onClick={onClose} data-testid="photo-lightbox-close"><X size={22}/></button>
      <img src={src} alt="Photo" className="max-w-full max-h-[90vh] rounded-lg"/>
    </div>
  );
}

export function PhotoButton({ onPick, disabled, testid }) {
  const ref = useRef(null);
  const pick = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    try { const c = await compressImage(f, 1600, 0.9); const ed = await editImage(c); if (ed) onPick(await compressImage(await (await fetch(ed)).blob())); } catch (err) { toast.error(err.message); }
  };
  return (
    <>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={pick} data-testid={`${testid}-input`}/>
      <button type="button" onClick={() => ref.current?.click()} disabled={disabled} title="Joindre une photo" className="dina-btn-secondary !min-h-[36px] !px-2.5" data-testid={testid}><Camera size={14}/></button>
    </>
  );
}

// Order-scoped thread shared by the whole team. party: "customer" | "rider"; me: "store" | "rider"
export default function OrderThread({ orderId, party, me = "store", quickReplies = [], onSent, height = "max-h-72", readOnly = false }) {
  const [conv, setConv] = useState(null);
  const [error, setError] = useState(null);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState(null);
  const [zoom, setZoom] = useState(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const count = conv?.messages?.length || 0;

  const load = async () => {
    const key = `thread:${orderId}:${party}`;
    try { const r = await api.get(`/orders/${orderId}/thread/${party}`); setConv(r.data); setError(null); if (me === "rider") import("@/lib/riderOffline").then(m => m.kvSet(key, r.data)).catch(() => {}); }
    catch (e) {
      if (me === "rider" && !e.response) { const m = await import("@/lib/riderOffline"); const c = await m.kvGet(key).catch(() => null); setConv(prev => prev || c || { messages: [] }); setError(null); return; }
      setError(e.response?.data?.detail || "Messagerie indisponible");
    }
  };
  useEffect(() => { setConv(null); setPhoto(null); load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [orderId, party]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [count]);

  const send = async (value) => {
    const txt = (value ?? text).trim();
    if ((!txt && !photo) || sending) return;
    setSending(true);
    try {
      const attachments = photo && value === undefined ? [{ type: "image", url: photo, name: "photo.jpg", mime: "image/jpeg" }] : [];
      const r = await api.post(`/orders/${orderId}/thread/${party}/send`, { text: txt, attachments });
      setText(""); if (attachments.length) setPhoto(null);
      setConv(c => ({ ...c, messages: [...(c?.messages || []), r.data.message] })); onSent?.(txt);
    } catch (e) {
      if (me === "rider" && !e.response) {
        const attachments = photo && value === undefined ? [{ type: "image", url: photo, name: "photo.jpg", mime: "image/jpeg" }] : [];
        const { enqueue } = await import("@/lib/riderOffline");
        await enqueue("thread", { order_id: orderId, party, payload: { text: txt, attachments } });
        setText(""); if (attachments.length) setPhoto(null);
        const local = { id: `local_${Date.now()}`, from_kind: "rider", text: `${txt} · ⏳ envoi au retour du réseau`, at: new Date().toISOString(), attachments };
        setConv(c => { const next = { ...c, messages: [...(c?.messages || []), local] }; import("@/lib/riderOffline").then(m => m.kvSet(`thread:${orderId}:${party}`, next)).catch(() => {}); return next; });
        toast.success("Message gardé · envoyé au retour du réseau");
      } else toast.error(e.response?.data?.detail || "Erreur envoi");
    }
    finally { setSending(false); }
  };

  if (error) return <div className="text-xs text-[#999] py-6 text-center" data-testid={`thread-error-${party}`}>{error}</div>;
  if (!conv) return <div className="text-xs text-[#999] py-6 text-center">Chargement…</div>;
  const mine = (m) => (me === "rider" || readOnly) ? m.from_kind === "rider" : m.from_kind === "store";
  const who = (m) => readOnly ? ({ rider: "Livreur", customer: "Cliente" }[m.from_kind] || "Boutique") + " · " : "";

  return (
    <div data-testid={`order-thread-${party}`}>
      <PhotoLightbox src={zoom} onClose={() => setZoom(null)}/>
      <div ref={listRef} className={`${height} overflow-y-auto space-y-2 mb-3 p-2 bg-[#fafafa] dark:bg-[#141414] rounded-lg scrollbar-thin`} data-testid="od-msg-list">
        {count === 0 ? <div className="text-xs text-[#999] py-4 text-center">Pas encore de message. Commencez la conversation.</div>
        : conv.messages.map(m => (
          <div key={m.id} className={`flex ${mine(m) ? "justify-end" : "justify-start"}`} data-testid={`thread-msg-${m.id}`}>
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${mine(m) ? "bg-[#b02a2a] text-white" : "bg-white dark:bg-[#1f1f1f] border border-[#ececec] dark:border-[#2a2a2a]"}`}>
              <MessagePhotos m={m} onOpen={setZoom}/>
              {m.text && <RichText text={m.text}/>}
              <div className={`text-[9px] mt-1 ${mine(m) ? "text-white/70" : "text-[#999]"}`}>{who(m)}{m.from_name} · {dateTimeFmt(m.at)}</div>
            </div>
          </div>
        ))}
      </div>
      {readOnly ? <div className="text-[10px] text-[#999]" data-testid={`thread-readonly-${party}`}>Lecture seule · échange direct entre le livreur et la cliente.</div> : <>
      {quickReplies.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-2 mb-1">
          {quickReplies.map((q, i) => <button key={i} onClick={() => send(q)} disabled={sending} className="shrink-0 text-[11px] px-2.5 py-1 rounded-full border border-[#ececec] dark:border-[#2a2a2a] hover:border-[#b02a2a] hover:text-[#b02a2a] transition-colors" data-testid={`quick-reply-${party}-${i}`}>{q}</button>)}
        </div>
      )}
      {photo && (
        <div className="relative inline-block mb-2" data-testid="thread-photo-preview">
          <img src={photo} alt="Aperçu" className="h-20 rounded-lg"/>
          <button onClick={() => setPhoto(null)} className="absolute -top-2 -right-2 bg-[#1c1c1c] text-white rounded-full p-0.5" data-testid="thread-photo-remove"><X size={12}/></button>
        </div>
      )}
      <RichComposer value={text} onChange={setText} onSend={() => send()} onPhoto={setPhoto} sending={sending} canSend={!!(text.trim() || photo)}
        placeholder={photo ? "Légende (facultative)…" : "Votre message…"} testid={`thread-composer-${party}`}/>
      </>}
    </div>
  );
}
