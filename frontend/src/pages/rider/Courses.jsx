import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { fcfa, statusLabel, statusColor, payInfo } from "@/lib/format";
import { toast } from "sonner";
import { Phone, MessageCircle, Navigation, ChevronRight, X, MapPin, Send } from "lucide-react";
import DeliveryProofModal from "@/components/rider/DeliveryProofModal";
import { SlotBadge } from "@/components/delivery/SlotPicker";
import OrderThread, { PhotoButton } from "@/components/shared/OrderThread";
import { useNavigate as useNav, useSearchParams } from "react-router-dom";
import { notifsChanged } from "@/pages/rider/Notifications";
import { OrderFilters, applyOrderFilters, EMPTY_FILTERS } from "@/components/shared/OrderFilters";

const FAIL_REASONS = ["Cliente absente", "Cliente injoignable", "Refus de la commande", "Adresse introuvable", "Autre"];

function FailForm({ order, onCancel, onStatus }) {
  const [reason, setReason] = useState(FAIL_REASONS[0]);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(null);
  const [later, setLater] = useState(false);
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const submit = async () => {
    if (reason === "Autre" && !note.trim()) return toast.error("Précisez le motif");
    if (later && !date) return toast.error("Choisissez la date de report");
    const label = `Échec : ${reason}${note.trim() ? ` — ${note.trim()}` : ""}`;
    setBusy(true);
    try {
      if (photo || note.trim()) await api.post(`/orders/${order.id}/thread/rider/send`, { text: label, attachments: photo ? [{ type: "image", url: photo, name: "echec.jpg", mime: "image/jpeg" }] : [] }).catch(() => {});
      await onStatus(order.id, later ? "reportee" : "echouee", label, later ? date : undefined);
    } finally { setBusy(false); }
  };
  return (
    <div className="p-3 rounded-lg border border-[#c62828] bg-[#fff5f5] dark:bg-[#2a1818] space-y-2" data-testid="fail-form">
      <div className="text-xs font-semibold text-[#c62828]">Livraison impossible — motif</div>
      <div className="flex flex-wrap gap-1.5">{FAIL_REASONS.map(r => <button key={r} onClick={() => setReason(r)} className={`text-[11px] px-2.5 py-1 rounded-full border ${reason === r ? "bg-[#c62828] text-white border-[#c62828]" : "border-[#ececec] dark:border-[#2a2a2a]"}`} data-testid={`fail-reason-${FAIL_REASONS.indexOf(r)}`}>{r}</button>)}</div>
      <textarea className="dina-input" rows={2} placeholder="Note (ce qui s'est passé)" value={note} onChange={e => setNote(e.target.value)} data-testid="fail-note"/>
      <div className="flex items-center gap-2"><PhotoButton onPick={setPhoto} testid="fail-photo"/>{photo ? <img src={photo} alt="" className="h-12 rounded"/> : <span className="text-[11px] text-[#666]">Photo facultative (porte, lieu…)</span>}</div>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={later} onChange={e => setLater(e.target.checked)} data-testid="fail-postpone"/>Proposer un report</label>
      {later && <input type="date" min={today} className="dina-input" value={date} onChange={e => setDate(e.target.value)} data-testid="fail-date"/>}
      <div className="flex gap-2"><button onClick={onCancel} className="dina-btn-secondary flex-1 !min-h-[40px]">Annuler</button><button onClick={submit} disabled={busy} className="dina-btn-primary flex-1 !min-h-[40px] !bg-[#c62828]" data-testid="fail-confirm">{later ? "Reporter" : "Confirmer l'échec"}</button></div>
    </div>
  );
}

const FILTERS = [
  { v: "all", label: "Toutes", k: null },
  { v: "a_livrer", label: "À livrer", k: "a_livrer" },
  { v: "en_route", label: "En route", k: "en_route" },
  { v: "livrees", label: "Livrées", k: "livrees" },
  { v: "annulees", label: "Annulées", k: "annulees" },
  { v: "reportees", label: "Reportées", k: "reportees" },
  { v: "echecs", label: "Échecs", k: "echecs" },
];

export default function Courses() {
  const [d, setD] = useState(null);
  const [filter, setFilter] = useState("all");
  const [of, setOf] = useState({ ...EMPTY_FILTERS });
  const [open, setOpen] = useState(null); // order detail
  const [proof, setProof] = useState(null);
  const [sp, setSp] = useSearchParams();
  const want = sp.get("course");

  const load = () => api.get("/riders/me/today").then(r => { setD(r.data); setOpen(prev => prev ? ((r.data.orders || []).find(x => x.id === prev.id) || prev) : prev); }).catch(() => toast.error("Courses indisponibles · vérifiez votre connexion"));
  useEffect(() => { load(); const t = setInterval(load, 30000); window.addEventListener("rider-notifs-changed", load); return () => { clearInterval(t); window.removeEventListener("rider-notifs-changed", load); }; }, []); // eslint-disable-line
  const openCourse = (o) => { setOpen(o); api.post("/me/notifications/read", { ref: o.code }).then(r => { if (r.data?.updated) notifsChanged(); }).catch(() => {}); };
  useEffect(() => {
    if (!want || !d) return;
    const o = (d.orders || []).find(x => x.code === want);
    if (o) openCourse(o); else toast.error(`La course ${want} n'est plus dans votre liste`);
    sp.delete("course"); setSp(sp, { replace: true });
  }, [want, d]); // eslint-disable-line

  const match = (o) => {
    if (filter === "all") return true;
    const s = o.status;
    if (filter === "a_livrer") return ["confirmee", "prete", "assignee"].includes(s);
    if (filter === "en_route") return s === "en_livraison";
    if (filter === "livrees") return s === "livree";
    if (filter === "annulees") return s === "annulee";
    if (filter === "reportees") return s === "reportee";
    if (filter === "echecs") return s === "echouee";
    return true;
  };

  const changeStatus = async (oid, status, reason, next_date) => {
    try { await api.patch(`/orders/${oid}/status`, { status, reason, next_date }); toast.success(next_date ? "Commande reportée" : "Mis à jour"); load(); setOpen(null); }
    catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };
  const confirmDeliver = (o) => setProof(o);

  if (!d) return <div className="text-sm text-[#666] text-center py-10">Chargement…</div>;

  const filtered = applyOrderFilters(d.orders, of).filter(match);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <KPI label="À livrer" v={d.counts.a_livrer} c="#e4991e" />
        <KPI label="Livrées" v={d.counts.livrees} c="#1f8a4c" />
        <KPI label="À encaisser" v={fcfa(d.to_collect)} c="#b02a2a" wide />
        <KPI label="Encaissé" v={fcfa(d.collected)} c="#1f8a4c" wide />
        <KPI label="À remettre" v={fcfa(d.balance_to_hand_over)} c="#b02a2a" wide />
      </div>

      <div className="flex gap-1 overflow-x-auto scrollbar-thin pb-1 -mx-3 px-3" data-testid="rider-filters">
        {FILTERS.map(f => (
          <button key={f.v} onClick={() => setFilter(f.v)} className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border ${filter === f.v ? "bg-[#b02a2a] text-white border-[#b02a2a]" : "border-[#ececec] dark:border-[#2a2a2a] text-[#666] dark:text-[#999]"}`} data-testid={`filter-${f.v}`}>
            {f.label}{f.k ? ` · ${d.counts[f.k] || 0}` : ` · ${d.orders.length}`}
          </button>
        ))}
      </div>

      <OrderFilters orders={d.orders} value={of} onChange={setOf} fields={["q", "slot", "zone"]} testid="rider-order-filters"/>

      <div className="space-y-2">
        {filtered.length === 0 && <div className="text-center text-sm text-[#666] py-10">Aucune course</div>}
        {filtered.map(o => <OrderCard key={o.id} order={o} onOpen={() => openCourse(o)} />)}
      </div>

      {open && <OrderDetail order={open} onClose={() => setOpen(null)} onStatus={changeStatus} onDeliver={confirmDeliver} />}
      {proof && <DeliveryProofModal order={proof} onClose={() => setProof(null)} onDone={() => { setProof(null); load(); }} />}
    </div>
  );
}

function PostponeForm({ onCancel, onConfirm }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  return (
    <div className="p-3 rounded-lg border border-[#e4991e] bg-[#fff8e8] dark:bg-[#2a2210] space-y-2" data-testid="postpone-form">
      <div className="text-xs font-semibold text-[#e4991e]">Reporter la livraison au…</div>
      <input type="date" min={today} className="dina-input" value={date} onChange={e => setDate(e.target.value)} data-testid="postpone-date"/>
      <input className="dina-input" placeholder="Motif (ex. cliente absente)" value={reason} onChange={e => setReason(e.target.value)} data-testid="postpone-reason"/>
      <div className="flex gap-2"><button onClick={onCancel} className="dina-btn-secondary flex-1 !min-h-[40px]">Annuler</button><button onClick={() => date ? onConfirm(date, reason) : toast.error("Choisissez une date")} className="dina-btn-primary flex-1 !min-h-[40px] !bg-[#e4991e]" data-testid="postpone-confirm">Confirmer</button></div>
    </div>
  );
}

function KPI({ label, v, c, wide }) {
  return (
    <div className={`dina-card-white p-3 ${wide ? "" : ""}`}>
      <div className="text-[10px] uppercase text-[#999]">{label}</div>
      <div className="font-serif text-xl tabular mt-0.5" style={{ color: c }}>{v}</div>
    </div>
  );
}

function OrderCard({ order, onOpen }) {
  const isCod = order.payment_method === "cod";
  return (
    <button onClick={onOpen} className="w-full text-left dina-card-white p-3 flex items-center gap-3" data-testid={`course-${order.code}`}>
      <div className="w-10 h-10 rounded-full bg-[#fff5f5] dark:bg-[#2a1818] text-[#b02a2a] grid place-items-center font-mono text-xs font-bold">{order.code.slice(-3)}</div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{(order.customer?.name || "").split(" ")[0]} · {order.delivery_zone}</div>
        <div className="text-[11px] text-[#666] dark:text-[#999] truncate">{order.customer?.quartier || order.note || ""}</div>
        <div className="text-[11px] mt-0.5">{isCod ? <span className="text-[#c62828] font-semibold">COD {fcfa(order.total)}</span> : <span style={{ color: payInfo(order).color }}>{payInfo(order).paid ? "Déjà payé" : payInfo(order).label}</span>}</div>
        <SlotBadge order={order}/>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="dina-chip" style={{ color: statusColor[order.status] }}>{statusLabel[order.status]}</span>
        <ChevronRight size={14} className="text-[#999]" />
      </div>
    </button>
  );
}

function OrderDetail({ order, onClose, onStatus, onDeliver }) {
  const [templates, setTemplates] = useState([]);
  const [showWa, setShowWa] = useState(false);
  const [postpone, setPostpone] = useState(false);
  const [chat, setChat] = useState(false);
  const [clientChat, setClientChat] = useState(false);
  const [fail, setFail] = useState(false);
  const navTo = useNav();
  useEffect(() => { api.get("/delivery-templates").then(r => setTemplates(r.data.wa_templates || [])).catch(() => { }); }, []);
  const phone = order.customer?.phone?.replace(/\D/g, "") || "";
  const callPhone = () => { api.post(`/orders/${order.id}/contact-log`, { kind: "call" }).catch(() => { }); window.location.href = `tel:${phone}`; };
  const openWa = (tpl) => {
    const prefill = (tpl.text || "")
      .replace("{prenom_client}", (order.customer?.name || "").split(" ")[0])
      .replace("{prenom_livreur}", "")
      .replace("{numero_commande}", order.code)
      .replace("{montant}", fcfa(order.total))
      .replace("{lien_suivi}", `${window.location.origin}/suivi/${order.code}`);
    api.post(`/orders/${order.id}/contact-log`, { kind: "whatsapp", template_key: tpl.key }).catch(() => { });
    const pref = JSON.parse(localStorage.getItem("rider_prefs") || "{}");
    const scheme = pref.wa === "business" ? "whatsapp" : "whatsapp"; // click-to-chat works for both
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(prefill)}`, "_blank");
    setShowWa(false);
  };
  const itinerary = () => navTo(`/riders/carte?route=${order.id}`);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-t-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-[#1a1a1a] p-4 border-b flex justify-between items-center">
          <div><div className="font-serif text-lg">{order.code}</div><div className="text-xs text-[#666]">{order.customer?.name} · {order.delivery_zone}</div><SlotBadge order={order}/></div>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-4 gap-2">
            <button onClick={callPhone} className="dina-btn-secondary !min-h-[44px] text-xs flex-col gap-0.5" data-testid="order-call"><Phone size={14} /><span>Appeler</span></button>
            <button onClick={() => setShowWa(true)} className="dina-btn-secondary !min-h-[44px] text-xs flex-col gap-0.5" data-testid="order-whatsapp"><MessageCircle size={14} /><span>WhatsApp</span></button>
            <button onClick={() => setClientChat(c => !c)} className={`dina-btn-secondary !min-h-[44px] text-xs flex-col gap-0.5 ${clientChat ? "!border-[#b02a2a] !text-[#b02a2a]" : ""}`} data-testid="order-message-client"><Send size={14} /><span>Message</span></button>
            <button onClick={itinerary} className="dina-btn-secondary !min-h-[44px] text-xs flex-col gap-0.5" data-testid="order-route"><Navigation size={14} /><span>Itinéraire</span></button>
          </div>
          {clientChat && <div className="dina-card-white p-3" data-testid="rider-client-chat"><div className="text-xs font-semibold mb-2">Messagerie avec {order.customer?.name || "la cliente"}</div><OrderThread orderId={order.id} party="rider_customer" me="rider" height="max-h-60" quickReplies={["Je suis en route", "J'arrive dans 10 minutes", "Je suis devant chez vous", "Pouvez-vous me rappeler ?"]}/></div>}
          <div className="p-3 bg-[#fff5f5] dark:bg-[#2a1818] rounded-lg text-sm">
            <div className="font-semibold">{order.customer?.name}</div>
            <div className="text-xs text-[#666] flex items-center gap-1"><MapPin size={10} />{order.customer?.address || order.delivery_zone}</div>
            {order.note && <div className="text-xs italic mt-1">« {order.note} »</div>}
          </div>
          <div className="dina-card-white p-3">
            <div className="font-semibold text-xs uppercase text-[#666] mb-2">Articles</div>
            {(order.items || []).map((it, i) => <div key={i} className="flex justify-between text-sm py-0.5"><span>{it.qty}× {it.name} <span className="text-[11px] text-[#666]">{[it.size, it.color].filter(Boolean).join(" · ")}</span></span><span className="tabular">{fcfa(it.qty * it.price)}</span></div>)}
          </div>
          <div className="dina-card-white p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-[#666]">Sous-total</span><span className="tabular">{fcfa(order.subtotal || order.total)}</span></div>
            {order.delivery_fee > 0 && <div className="flex justify-between"><span className="text-[#666]">Livraison</span><span className="tabular">{fcfa(order.delivery_fee)}</span></div>}
            <div className="flex justify-between font-semibold text-base pt-1 border-t border-[#ececec]"><span>À encaisser</span><span className="tabular text-[#b02a2a]">{order.payment_method === "cod" ? fcfa(order.total) : payInfo(order).paid ? "0 (prépayée)" : payInfo(order).label}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {["confirmee", "prete", "assignee"].includes(order.status) && <button onClick={() => onStatus(order.id, "en_livraison")} className="dina-btn-primary !min-h-[44px]" data-testid="status-en-route">Je démarre</button>}
            {order.status === "en_livraison" && <button onClick={() => onDeliver(order)} className="dina-btn-primary !min-h-[44px]" data-testid="rider-delivered">Livrée</button>}
            {order.status !== "livree" && <button onClick={() => setFail(true)} className="dina-btn-secondary !min-h-[44px] text-xs" style={{ color: "#c62828" }} data-testid="status-fail">Échec</button>}
            {order.status !== "livree" && <button onClick={() => setPostpone(true)} className="dina-btn-secondary !min-h-[44px] text-xs" data-testid="status-reschedule">Reporter</button>}
          </div>
          {postpone && <PostponeForm onCancel={() => setPostpone(false)} onConfirm={(date, reason) => onStatus(order.id, "reportee", reason || "Reportée", date)}/>}
          {fail && <FailForm order={order} onCancel={() => setFail(false)} onStatus={onStatus}/>}
          <button onClick={() => setChat(c => !c)} className="dina-btn-secondary w-full !min-h-[44px] text-xs" data-testid="rider-msg-store"><MessageCircle size={14}/>{chat ? "Masquer les messages" : "Message boutique"}</button>
          {chat && <div className="dina-card-white p-3" data-testid="rider-order-chat"><OrderThread orderId={order.id} party="rider" me="rider" height="max-h-60" quickReplies={["Je suis en route", "Cliente injoignable", "Livraison effectuée", "Adresse introuvable"]}/></div>}
        </div>
        {showWa && (
          <div className="fixed inset-0 bg-black/70 grid place-items-end z-[80]" onClick={() => setShowWa(false)}>
            <div className="bg-white dark:bg-[#1a1a1a] rounded-t-2xl w-full p-4" onClick={e => e.stopPropagation()}>
              <div className="font-semibold mb-2">Choisir un message</div>
              {templates.map(t => <button key={t.key} onClick={() => openWa(t)} className="w-full text-left p-3 border border-[#ececec] dark:border-[#2a2a2a] rounded-lg mb-2 text-sm hover:bg-[#fff5f5] dark:hover:bg-[#2a1818]" data-testid={`wa-tpl-${t.key}`}><div className="font-semibold text-xs text-[#b02a2a]">{t.label}</div><div className="text-xs text-[#666] line-clamp-2 mt-0.5">{t.text}</div></button>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
