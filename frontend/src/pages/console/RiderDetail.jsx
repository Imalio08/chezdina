import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "@/lib/api";
import { goBack } from "@/lib/keptState";
import { fcfa, dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";
import { ChevronLeft, Phone, MessageSquare, Truck, Trophy, Clock, MapPin, Star, Package, Printer } from "lucide-react";
import SmartImage from "@/components/shared/SmartImage";
import RiderSlotsEditor from "@/components/delivery/RiderSlotsEditor";
import { downloadRiderRoutePDF, fetchBusinessForPdf } from "@/lib/pdfInvoice";

export default function RiderDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [rider, setRider] = useState(null);
  const [kpis, setKpis] = useState({});
  const [score, setScore] = useState({});
  const [reviews, setReviews] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [users, k, s, r, ses, att, ords] = await Promise.all([
          api.get("/team"),
          api.get(`/riders/${id}/kpis`).catch(() => ({ data: {} })),
          api.get(`/riders/${id}/score`).catch(() => ({ data: {} })),
          api.get(`/riders/${id}/reviews`).catch(() => ({ data: [] })),
          api.get("/delivery-sessions").catch(() => ({ data: [] })),
          api.get(`/attendance?user_id=${id}`).catch(() => ({ data: [] })),
          api.get("/orders").catch(() => ({ data: [] })),
        ]);
        const u = (users.data || []).find(x => x.id === id);
        if (!u) return toast.error("Livreur introuvable");
        setRider(u);
        setKpis(k.data || {});
        setScore(s.data || {});
        setReviews(r.data || []);
        setSessions((ses.data || []).filter(x => x.rider_id === id).slice(0, 20));
        setAttendance((att.data || []).filter(x => x.user_id === id).slice(0, 30));
        setOrders((ords.data || []).filter(o => o.rider_id === id).slice(0, 30));
      } catch { toast.error("Erreur chargement livreur"); }
    })();
  }, [id]);

  if (!rider) return <div className="text-center py-12 text-sm text-[#666]">Chargement…</div>;

  const avg = reviews.length ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1) : "—";
  const totalDelivered = orders.filter(o => o.status === "livree").length;
  const totalCollected = orders.filter(o => o.status === "livree" && o.payment_method === "cod").reduce((s, o) => s + (o.total || 0), 0);
  const openWa = () => { const d = (rider.phone || "").replace(/\D/g, ""); window.open(`https://wa.me/${d}`, "_blank"); };

  const printTodayRoute = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const todayOrders = orders.filter(o => (o.created_at || "").slice(0, 10) === today || (o.delivery_date || "").slice(0, 10) === today);
    if (!todayOrders.length) return toast.error("Aucune livraison assignée aujourd'hui");
    const business = await fetchBusinessForPdf(api);
    downloadRiderRoutePDF(rider, todayOrders, business);
    toast.success(`Feuille de route générée (${todayOrders.length} livraisons)`);
  };

  return (
    <div className="space-y-5 font-sora" data-testid="rider-detail">
      <button onClick={() => goBack(nav, "/console/livreurs")} data-testid="detail-back" className="text-sm text-[#666] inline-flex items-center gap-1 hover:text-[#b02a2a]"><ChevronLeft size={13}/>Retour</button>

      <div className="dina-card-white p-5 flex items-start gap-4 flex-wrap">
        {rider.photo ? <SmartImage src={rider.photo} alt={rider.name} fallbackText={rider.name} className="w-20 h-20 rounded-full object-cover"/> : <div className="w-20 h-20 rounded-full bg-[#eef4ff] text-[#5867fd] grid place-items-center font-serif text-3xl font-bold">{rider.name?.[0]}</div>}
        <div className="flex-1 min-w-0">
          <div className="font-serif text-3xl truncate">{rider.name}</div>
          <div className="text-sm text-[#666] flex items-center gap-3 flex-wrap mt-1">
            <span className="flex items-center gap-1"><Phone size={13}/>{rider.phone || "—"}</span>
            <span className="flex items-center gap-1"><MapPin size={13}/>{rider.zone || "Toutes zones"}</span>
            {rider.status && <span className={`dina-chip text-[10px] ${rider.status === "active" ? "!text-[#1f8a4c] !border-[#1f8a4c]" : "!text-[#999]"}`}>{rider.status}</span>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={printTodayRoute} className="dina-btn-secondary !min-h-[36px]" data-testid="rider-print-route"><Printer size={13}/>Feuille de route (jour)</button>
          <button onClick={openWa} className="dina-btn-secondary !min-h-[36px] !text-[#1f8a4c]" data-testid="rider-wa"><Phone size={13}/>WhatsApp</button>
          <button onClick={() => nav(`/console/messagerie?rider_id=${rider.id}`)} className="dina-btn-primary !min-h-[36px]" data-testid="rider-msg"><MessageSquare size={13}/>Message</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Kpi label="Score" value={score.score != null ? `${score.score}/100` : "—"} color="#f4b12c" testid="rider-kpi-score"/>
        <Kpi label="Livraisons" value={totalDelivered} color="#1f8a4c" testid="rider-kpi-delivered"/>
        <Kpi label="En cours" value={kpis.active || 0} color="#5867fd" testid="rider-kpi-active"/>
        <Kpi label="Note moy." value={`${avg} ★`} color="#e4991e" testid="rider-kpi-rating"/>
        <Kpi label="Encaissé COD" value={fcfa(totalCollected)} color="#b02a2a" testid="rider-kpi-cash"/>
        <Kpi label="Taux à temps" value={`${score.on_time_rate != null ? Math.round(score.on_time_rate * 100) : "—"}%`} color="#1c1c1c" testid="rider-kpi-ontime"/>
      </div>

      <RiderSlotsEditor riderId={id}/>

      <div className="grid lg:grid-cols-2 gap-4">
        <Section title="Pointages récents" icon={Clock} testid="rider-attendance">
          {attendance.length === 0 ? <Empty>Aucun pointage</Empty> : attendance.slice(0, 10).map(a => (
            <Row key={a.id} testid={`rider-att-${a.id}`}>
              <div className="flex items-center gap-2 min-w-0">
                {a.selfie && <img src={a.selfie} alt="" className="w-8 h-8 rounded object-cover shrink-0"/>}
                <div className="min-w-0"><div className="text-sm font-medium truncate">{a.kind === "arrival" ? "Arrivée" : "Départ"}</div><div className="text-[11px] text-[#666]">{dateTimeFmt(a.at)}</div></div>
              </div>
              {a.late && <span className="dina-chip text-[10px] !text-[#c62828] !border-[#c62828]">+{a.late_min}min</span>}
            </Row>
          ))}
        </Section>

        <Section title="Journées de livraison" icon={Truck} testid="rider-sessions">
          {sessions.length === 0 ? <Empty>Aucune journée</Empty> : sessions.slice(0, 10).map(s => (
            <Row key={s.id}>
              <div className="min-w-0"><div className="text-sm font-medium truncate">{dateTimeFmt(s.opened_at)}</div><div className="text-[11px] text-[#666]">{s.delivered || 0} livrées · {fcfa(s.cash_collected || 0)}</div></div>
              <span className={`dina-chip text-[10px] ${s.status === "reconciled" ? "!text-[#1f8a4c] !border-[#1f8a4c]" : "!text-[#e4991e] !border-[#e4991e]"}`}>{s.status || "ouvert"}</span>
            </Row>
          ))}
        </Section>

        <Section title="Dernières commandes" icon={Package} testid="rider-orders">
          {orders.length === 0 ? <Empty>Aucune commande</Empty> : orders.slice(0, 10).map(o => (
            <Row key={o.id} onClick={() => nav(`/console/commandes/${o.code}`)} clickable>
              <div className="min-w-0"><div className="text-sm font-medium truncate">{o.code} · {o.customer?.name}</div><div className="text-[11px] text-[#666]">{dateTimeFmt(o.created_at)}</div></div>
              <div className="text-right"><div className="tabular font-semibold text-sm">{fcfa(o.total)}</div><div className="text-[10px] text-[#666]">{o.status}</div></div>
            </Row>
          ))}
        </Section>

        <Section title="Avis clientes" icon={Star} testid="rider-reviews">
          {reviews.length === 0 ? <Empty>Aucun avis</Empty> : reviews.slice(0, 10).map(r => (
            <Row key={r.id}>
              <div className="min-w-0"><div className="text-sm">{"★".repeat(r.rating || 0)}{"☆".repeat(5 - (r.rating || 0))}</div><div className="text-[11px] text-[#666] truncate">{r.comment || "—"}</div></div>
              <div className="text-[10px] text-[#666] shrink-0">{dateTimeFmt(r.at)}</div>
            </Row>
          ))}
        </Section>
      </div>
    </div>
  );
}

function Kpi({ label, value, color, testid }) {
  return <div className="dina-card-white p-3" data-testid={testid}><div className="text-[10px] uppercase text-[#666] font-semibold">{label}</div><div className="font-serif tabular text-xl mt-1 truncate" style={{ color }}>{value}</div></div>;
}
function Section({ title, icon: Icon, testid, children }) {
  return <div className="dina-card-white p-4" data-testid={testid}><div className="flex items-center gap-2 font-semibold mb-3"><Icon size={14} className="text-[#b02a2a]"/>{title}</div><div className="space-y-1 max-h-80 overflow-y-auto">{children}</div></div>;
}
function Row({ children, onClick, clickable, testid }) {
  return <div onClick={onClick} className={`flex items-center justify-between gap-2 py-1.5 px-2 rounded ${clickable ? "cursor-pointer hover:bg-[#fff5f5]" : ""}`} data-testid={testid}>{children}</div>;
}
function Empty({ children }) { return <div className="text-center text-xs text-[#999] py-4">{children}</div>; }
