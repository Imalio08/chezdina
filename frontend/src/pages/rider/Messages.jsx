import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { ArrowLeft, MessageSquare, Store, Package, Archive, ArchiveRestore } from "lucide-react";
import { notifsChanged } from "@/pages/rider/Notifications";
import { dateTimeFmt } from "@/lib/format";
import { MessagePhotos, PhotoLightbox } from "@/components/shared/OrderThread";
import { RichComposer, RichText, plainPreview } from "@/components/shared/RichComposer";
import { kvGet, kvSet, enqueue } from "@/lib/riderOffline";

const KIND = { livreur_cliente: "Cliente", commande_livreur: "Boutique · commande" };
const kindLabel = (c) => KIND[c.kind] || "Boutique";
const isClient = (c) => c.kind === "livreur_cliente";

function Inbox() {
  const nav = useNavigate();
  const [list, setList] = useState(null);
  const [tab, setTab] = useState(() => sessionStorage.getItem("rider_inbox_tab") || "clientes");
  const [opening, setOpening] = useState(false);
  const [showArch, setShowArch] = useState(false);
  const [tick, setTick] = useState(0);
  const [q, setQ] = useState("");
  const [qd, setQd] = useState("");
  useEffect(() => { const t = setTimeout(() => setQd(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    const load = () => api.get("/rider/conversations", { params: qd ? { q: qd } : {} }).then(r => { setList(r.data); if (!qd) kvSet("inbox", r.data).catch(() => {}); }).catch(async () => { const c = await kvGet("inbox").catch(() => null); setList(l => l || c || []); });
    load(); const t = setInterval(load, 10000); return () => clearInterval(t);
  }, [tick, qd]);
  const archive = async (c, archived) => {
    try { await api.patch(`/rider/conversations/${c.id}/archive`, { archived }); toast.success(archived ? "Conversation archivée" : "Conversation désarchivée"); setTick(x => x + 1); }
    catch { toast.error("Action impossible · réessayez"); }
  };
  const pick = (t) => { setTab(t); sessionStorage.setItem("rider_inbox_tab", t); };
  const writeStore = async () => {
    setOpening(true);
    try { const r = await api.post("/rider/conversations/store"); nav(`/riders/messages/${r.data.id}`); }
    catch { toast.error("Impossible d'ouvrir la conversation · réessayez"); } finally { setOpening(false); }
  };
  if (!list) return <div className="text-center text-sm text-[#666] py-10">Chargement…</div>;
  const live = list.filter(c => !!c.archived === showArch);
  const groups = { clientes: live.filter(isClient), boutique: live.filter(c => !isClient(c)) };
  const archCount = list.filter(c => c.archived).length;
  const unread = (arr) => arr.reduce((s, c) => s + (c.unread || 0), 0);
  const shown = groups[tab];
  return (
    <div className="space-y-2" data-testid="rider-inbox">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="font-serif text-xl">Messages</div>
        <button onClick={writeStore} disabled={opening} className="text-[11px] font-semibold flex items-center gap-1 px-3 py-1.5 rounded-full text-white bg-[color:var(--rider-primary)]" data-testid="rider-write-store"><Store size={13}/>{opening ? "Ouverture…" : "Écrire à la boutique"}</button>
      </div>
      <div className="grid grid-cols-2 gap-1 bg-white dark:bg-[#1a1a1a] rounded-xl p-1 border border-[#ececec] dark:border-[#2a2a2a]" data-testid="rider-inbox-tabs">
        {[["clientes", "Clientes"], ["boutique", "Boutique / gérante"]].map(([k, l]) => (
          <button key={k} onClick={() => pick(k)} className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${tab === k ? "bg-[color:var(--rider-primary)] text-white" : "text-[#666]"}`} data-testid={`rider-inbox-tab-${k}`}>
            {l}{unread(groups[k]) > 0 && <span className={`text-[10px] rounded-full px-1.5 ${tab === k ? "bg-white text-[#b02a2a]" : "bg-[#b02a2a] text-white"}`} data-testid={`rider-inbox-tab-${k}-unread`}>{unread(groups[k])}</span>}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 px-1">
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Nom, n° de commande ou message…" className="dina-input flex-1 !py-2" data-testid="rider-inbox-search"/>
        <button onClick={() => setShowArch(v => !v)} className={`text-[11px] font-semibold px-3 py-1 rounded-full border inline-flex items-center gap-1 ${showArch ? "bg-[color:var(--rider-primary)] text-white border-transparent" : "border-[#ececec] dark:border-[#2a2a2a] text-[#666]"}`} data-testid="rider-inbox-archived-toggle"><Archive size={12}/>Archivées{archCount ? ` (${archCount})` : ""}</button>
      </div>
      {!shown.length && <div className="text-center text-sm text-[#666] py-12" data-testid="rider-inbox-empty"><MessageSquare size={36} className="mx-auto text-[#ccc] mb-2"/>{showArch ? "Aucune conversation archivée" : qd ? `Aucun résultat pour « ${qd} »` : tab === "clientes" ? "Aucun message de cliente pour le moment" : "Aucun message de la boutique pour le moment"}</div>}
      {shown.map(c => (
        <div key={c.id} className="flex items-stretch gap-1.5">
        <button onClick={() => nav(`/riders/messages/${c.id}`)} className="flex-1 min-w-0 text-left bg-white dark:bg-[#1a1a1a] rounded-xl p-3 border border-[#ececec] dark:border-[#2a2a2a] flex gap-3" data-testid={`rider-conv-${c.id}`}>
          <div className="w-9 h-9 rounded-full bg-[color:var(--rider-accent)] text-[color:var(--rider-primary)] font-bold text-sm grid place-items-center shrink-0">{(c.with?.name || "?")[0]}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-sm truncate">{c.with?.name || "—"}</div>
              {c.unread > 0 && <span className="bg-[#b02a2a] text-white text-[10px] rounded-full px-1.5 py-0.5 shrink-0" data-testid={`rider-conv-unread-${c.id}`}>{c.unread}</span>}
            </div>
            <div className="text-[10px] uppercase text-[#999]">{kindLabel(c)}{c.order_code ? ` · ${c.order_code}` : ""}{c.closed ? " · fermée" : ""}</div>
            <div className="text-xs text-[#666] truncate">{c.last_message?.text ? plainPreview(c.last_message.text) : (c.last_message ? "Pièce jointe" : "Nouvelle conversation")}</div>
          </div>
        </button>
        <button onClick={() => archive(c, !c.archived)} className="w-11 shrink-0 rounded-xl border border-[#ececec] dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] grid place-items-center text-[#666]" title={c.archived ? "Désarchiver" : "Archiver"} aria-label={c.archived ? "Désarchiver" : "Archiver"} data-testid={`rider-conv-archive-${c.id}`}>{c.archived ? <ArchiveRestore size={16}/> : <Archive size={16}/>}</button>
        </div>
      ))}
    </div>
  );
}

function Conversation({ id }) {
  const nav = useNavigate();
  const [conv, setConv] = useState(null);
  const [text, setText] = useState("");
  const [atts, setAtts] = useState([]);
  const [zoom, setZoom] = useState(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const notified = useRef(false);
  const load = () => api.get(`/rider/conversations/${id}`).then(r => { setConv(r.data); kvSet(`conv:${id}`, r.data).catch(() => {}); if (!notified.current) { notified.current = true; notifsChanged(); } }).catch(async (e) => { if (!e.response) { const c = await kvGet(`conv:${id}`).catch(() => null); setConv(prev => prev || c || { messages: [], participants: [] }); } else toast.error("Conversation introuvable"); });
  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, [id]); // eslint-disable-line
  const count = conv?.messages?.length || 0;
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [count]);
  const send = async () => {
    if ((!text.trim() && !atts.length) || sending) return;
    setSending(true);
    const attachments = atts;
    try {
      const r = await api.post(`/rider/conversations/${id}/send`, { text, attachments });
      setText(""); setAtts([]); setConv(c => ({ ...c, messages: [...(c?.messages || []), r.data.message] }));
    } catch (e) {
      if (!e.response) {
        await enqueue("conv", { conv_id: id, payload: { text, attachments } });
        setConv(c => { const next = { ...c, messages: [...(c?.messages || []), { id: `local_${Date.now()}`, from_kind: "rider", text: `${text} · ⏳ envoi au retour du réseau`, at: new Date().toISOString(), attachments }] }; kvSet(`conv:${id}`, next).catch(() => {}); return next; });
        setText(""); setAtts([]); toast.success("Message gardé · envoyé au retour du réseau");
      } else toast.error(e.response?.data?.detail || "Message non envoyé · réessayez");
    }
    finally { setSending(false); }
  };
  const other = conv && (conv.participants || []).find(p => p.kind !== "rider");
  return (
    <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-[#ececec] dark:border-[#2a2a2a] p-3 flex flex-col h-[calc(100dvh-170px)]" data-testid="rider-conversation">
      <PhotoLightbox src={zoom} onClose={() => setZoom(null)}/>
      <div className="flex items-center gap-2 pb-2 border-b border-[#f0f0f0] dark:border-[#2a2a2a]">
        <button onClick={() => nav("/riders/messages")} className="p-1" data-testid="rider-conv-back"><ArrowLeft size={16}/></button>
        <div className="min-w-0 flex-1"><div className="font-semibold text-sm truncate">{other?.name || "…"}</div><div className="text-[10px] text-[#999] uppercase">{conv ? kindLabel(conv) : ""}{conv?.order_code ? ` · ${conv.order_code}` : ""}</div></div>
        {conv?.order_code && <button onClick={() => nav(`/riders?course=${conv.order_code}`)} className="text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#ececec] dark:border-[#2a2a2a] shrink-0" data-testid="rider-conv-open-course"><Package size={12}/>Voir la course</button>}
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto py-2 space-y-2">
        {count === 0 ? <div className="text-xs text-[#999] text-center py-6">Pas encore de message</div> : conv.messages.map(m => {
          const mine = m.from_kind === "rider";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[82%] rounded-xl px-3 py-2 text-sm ${mine ? "bg-[color:var(--rider-primary)] text-white" : "bg-[#f5f5f5] dark:bg-[#242424]"}`}>
                <MessagePhotos m={m} onOpen={setZoom} light={mine}/><RichText text={m.text}/>
                <div className={`text-[9px] mt-1 ${mine ? "text-white/70" : "text-[#999]"}`}>{!mine && m.from_name ? `${m.from_name} · ` : ""}{dateTimeFmt(m.at)}</div>
              </div>
            </div>
          );
        })}
      </div>
      {conv?.closed ? <div className="text-xs text-[#999] text-center pt-2">Conversation fermée après la livraison</div>
        : <RichComposer value={text} onChange={setText} onSend={send} attachments={atts} onAttachments={setAtts} sending={sending} canSend={!!(text.trim() || atts.length)} testid="rider-msg"/>}
    </div>
  );
}

export default function RiderMessages() {
  const { id } = useParams();
  return id ? <Conversation id={id}/> : <Inbox/>;
}
