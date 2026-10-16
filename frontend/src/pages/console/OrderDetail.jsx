import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "@/lib/api";
import { fcfa, dateTimeFmt, statusLabel, statusColor } from "@/lib/format";
import { toast } from "sonner";
import { ChevronLeft, Download, Printer, MessageCircle, FileText, User, Truck, MapPin, Clock, Send, Eye } from "lucide-react";
import { InvoicePreviewModal, buildInvoicePreview, shareInvoiceOnWhatsApp } from "@/components/shared/InvoicePreviewModal";
import { SlotBadge } from "@/components/delivery/SlotPicker";
import OrderThread from "@/components/shared/OrderThread";
import useFocusParam from "@/lib/useFocusParam";
import SmartImage from "@/components/shared/SmartImage";
import { downloadInvoicePDF, downloadPackingSlipPDF, fetchBusinessForPdf } from "@/lib/pdfInvoice";
import { OrderActions } from "@/pages/console/Orders";
import { PrepRunner } from "@/pages/console/Preparation";
import { useAuth } from "@/context/AuthContext";
import WaveProofCard from "@/components/orders/WaveProofCard";
import OrderTimeline from "@/components/orders/OrderTimeline";

const STATUSES = ["nouvelle", "confirmee", "en_preparation", "prete", "assignee", "en_livraison", "livree", "retournee", "annulee"];

export default function OrderDetail() {
  const { code } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [prep, setPrep] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [preview, setPreview] = useState(null);
  useFocusParam();

  const load = async () => {
    try {
      const r = await api.get(`/orders?code=${code}`);
      const o = (r.data || []).find(x => x.code === code);
      if (!o) return toast.error("Commande introuvable");
      setOrder(o);
    } catch { toast.error("Erreur chargement"); }
  };
  useEffect(() => { load(); }, [code]);

  const changeStatus = async (status) => {
    let payload = { status };
    if (status === "annulee" || status === "retournee") {
      const reason = prompt(status === "annulee" ? "Motif d'annulation ?" : "Motif du retour ?");
      if (reason === null) return;
      payload.reason = reason;
    }
    try {
      await api.patch(`/orders/${order.id}/status`, payload);
      toast.success("Statut mis à jour"); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Changement de statut impossible · réessayez"); }
  };

  const invoiceAction = async (action) => {
    try {
      let inv = invoice;
      if (!inv) {
        const r = await api.post(`/invoices/from-order/${order.id}`);
        inv = r.data; setInvoice(inv);
      }
      if (action === "view") { setPreview(await buildInvoicePreview(api, order, inv)); return; }
      if (action === "wa") { await shareInvoiceOnWhatsApp(await buildInvoicePreview(api, order, inv)); return; }
      const business = await fetchBusinessForPdf(api);
      if (action === "pdf") { downloadInvoicePDF(order, inv, business); toast.success(`Facture ${inv.number} générée`); }
      else if (action === "slip") { downloadPackingSlipPDF(order, business); toast.success(`Fiche colis ${order.code} générée`); }
    } catch { toast.error("Erreur facture"); }
  };

  if (!order) return <div className="text-center py-12 text-sm text-[#666]">Chargement…</div>;
  if (prep) return <PrepRunner order={{ ...order, status: "en_preparation" }} onBack={() => { setPrep(false); load(); }}/>;

  const subtotal = (order.items || []).reduce((s, i) => s + (i.qty * i.price), 0);

  return (
    <div className="space-y-5 font-sora" data-testid="order-detail">
      {preview && <InvoicePreviewModal data={preview} onClose={() => setPreview(null)}/>}
      <button onClick={() => nav("/console/commandes")} className="text-sm text-[#666] inline-flex items-center gap-1 hover:text-[#b02a2a]"><ChevronLeft size={13}/>Retour aux commandes</button>
      <div className="dina-card-white p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs text-[#999] uppercase font-semibold">Commande</div>
            <div className="font-serif text-3xl">{order.code}</div>
            <div className="text-xs text-[#666] mt-1">{dateTimeFmt(order.created_at)} · {order.channel || "—"} · {order.mode || "—"}</div>
          </div>
          <div>
            <span className="dina-chip" style={{ color: statusColor[order.status] }}><span className="status-dot" style={{ background: statusColor[order.status] }}/>{statusLabel[order.status]}</span>
            <div className="font-serif tabular text-3xl text-[#b02a2a] text-right mt-2">{fcfa(order.total)}</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <InfoCard icon={User} title="Cliente" testid="order-customer">
          <div className="font-semibold">{order.customer?.name || "—"}</div>
          <div className="text-sm text-[#666]">{order.customer?.phone || "—"}</div>
          {order.customer?.id && <button onClick={() => nav(`/console/clients/${order.customer.id}`)} className="text-xs text-[#5867fd] mt-1 hover:underline">Voir la fiche cliente →</button>}
        </InfoCard>

        <InfoCard icon={Truck} title="Livraison" testid="order-delivery">
          <div className="text-sm">{order.mode === "delivery" ? "À domicile" : order.mode === "pickup" ? "Retrait" : "À emporter"}</div>
          {order.delivery_zone && <div className="text-xs text-[#666] flex items-center gap-1 mt-1"><MapPin size={11}/>{order.delivery_zone}</div>}
          {order.delivery_address && <div className="text-xs text-[#666] mt-0.5">{order.delivery_address}</div>}
          {order.rider_id && <button onClick={() => nav(`/console/livreurs/${order.rider_id}`)} className="text-xs text-[#5867fd] mt-1 hover:underline">Livreur : {order.rider_name || "—"} →</button>}
          {order.delivery_slot && <div className="mt-1"><SlotBadge order={order}/></div>}
          {order.delivery_date && <div className="text-xs text-[#666] flex items-center gap-1 mt-1"><Clock size={11}/>{order.delivery_date} · {order.delivery_slot || ""}</div>}
        </InfoCard>

        <InfoCard icon={FileText} title="Facture" testid="order-invoice">
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => invoiceAction("view")} className="dina-btn-secondary !min-h-[32px] text-xs" data-testid="od-invoice-view"><Eye size={12}/>Aperçu</button>
            <button onClick={() => invoiceAction("pdf")} className="dina-btn-secondary !min-h-[32px] text-xs" data-testid="od-invoice-pdf"><Download size={12}/>Facture PDF</button>
            <button onClick={() => invoiceAction("slip")} className="dina-btn-secondary !min-h-[32px] text-xs" data-testid="od-slip-pdf"><Printer size={12}/>Fiche colis</button>
            <button onClick={() => invoiceAction("wa")} className="dina-btn-secondary !min-h-[32px] text-xs !text-[#1f8a4c]" data-testid="od-invoice-wa"><MessageCircle size={12}/>WhatsApp</button>
          </div>
        </InfoCard>
      </div>

      <div className="dina-card-white p-5" data-testid="order-items-block">
        <div className="font-semibold mb-3">Articles ({(order.items || []).length})</div>
        <div className="space-y-2">
          {(order.items || []).map((it, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-[#f0f0f0] pb-2">
              <SmartImage src={it.image} alt={it.name} fallbackText={it.name} className="w-14 h-14 rounded object-cover bg-[#fff5f5]"/>
              <button onClick={() => it.product_id && nav(`/console/produits/${it.product_id}`)} className="flex-1 text-left min-w-0 hover:text-[#b02a2a]">
                <div className="font-medium truncate">{it.name}</div>
                <div className="text-xs text-[#666]">{[it.size, it.color].filter(Boolean).join(" · ")} · {fcfa(it.price)}</div>
              </button>
              <div className="text-sm tabular">×{it.qty}</div>
              <div className="tabular w-24 text-right font-semibold">{fcfa(it.qty * it.price)}</div>
            </div>
          ))}
        </div>
        <div className="space-y-1 text-sm mt-4 pt-3 border-t border-[#ececec]">
          <div className="flex justify-between"><span className="text-[#666]">Sous-total</span><span className="tabular">{fcfa(subtotal)}</span></div>
          {order.delivery_fee > 0 && <div className="flex justify-between"><span className="text-[#666]">Livraison</span><span className="tabular">{fcfa(order.delivery_fee)}</span></div>}
          {order.discount > 0 && <div className="flex justify-between"><span className="text-[#666]">Remise</span><span className="tabular text-[#1f8a4c]">-{fcfa(order.discount)}</span></div>}
          <div className="flex justify-between font-semibold text-base pt-2 border-t"><span>Total</span><span className="tabular text-[#b02a2a] text-xl">{fcfa(order.total)}</span></div>
        </div>
      </div>

      <WaveProofCard order={order} canVerify={["admin", "manager"].includes(user?.role)} onDone={load}/>

      <div className="dina-card-white p-5" data-testid="order-status-flow">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="font-semibold">Prochaine étape</div>
          <OrderActions o={order} canConfirm={["admin", "manager"].includes(user?.role)} onConfirm={() => changeStatus("confirmee")} onPrepare={async () => {
            if (order.status === "confirmee") { try { await api.patch(`/orders/${order.id}/status-v3`, { status: "en_preparation" }); } catch (e) { return toast.error(e.response?.data?.detail || "Préparation impossible"); } }
            setPrep(true);
          }}/>
        </div>
        <div className="font-semibold mb-2 text-sm">Changer le statut</div>
        <div className="flex gap-2 flex-wrap">
          {STATUSES.map(s => (
            <button key={s} onClick={() => changeStatus(s)} className={`dina-chip ${order.status === s ? "!bg-[#1c1c1c] !text-white" : ""}`} data-testid={`od-status-${s}`}>
              <span className="status-dot" style={{ background: statusColor[s] }}/>{statusLabel[s]}
            </button>
          ))}
        </div>
      </div>

      <OrderTimeline timeline={order.timeline}/>

      <OrderMessages order={order} />
    </div>
  );
}

function OrderMessages({ order }) {
  const [tab, setTab] = useState("customer");
  const [last, setLast] = useState("");
  useEffect(() => {
    api.post(`/orders/${order.id}/threads/read`).then(() => window.dispatchEvent(new Event("dina:unread-refresh"))).catch(() => {});
  }, [order.id]);
  const phone = (order.customer?.phone || "").replace(/\D/g, "");
  const first = order.customer?.name?.split(" ")[0] || "";
  const replies = tab === "customer"
    ? [`Bonjour ${first}, votre commande ${order.code} est confirmée.`, `Votre commande ${order.code} est prête.`, "Le livreur est en route, merci de rester joignable.", "Merci pour votre achat chez Chez Dina !"]
    : [`Commande ${order.code} prête à récupérer.`, "Merci d'appeler la cliente avant d'arriver.", "Merci de confirmer la livraison.", "Point sur la course ?"];
  const openWa = () => {
    if (!phone) return toast.error("Numéro cliente manquant");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(last || `Bonjour ${first}, concernant votre commande ${order.code} chez Chez Dina :`)}`, "_blank");
  };
  return (
    <div className="dina-card-white p-4" data-testid="order-messages" data-focus-id="order-messages">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 font-semibold"><MessageCircle size={14} className="text-[#b02a2a]"/>Messages de la commande</div>
        {tab === "customer" && <button onClick={openWa} className="dina-btn-secondary !min-h-[30px] text-[11px] !text-[#1f8a4c]" data-testid="od-msg-wa"><MessageCircle size={11}/>WhatsApp</button>}
      </div>
      <div className="flex gap-1 border-b border-[#ececec] dark:border-[#2a2a2a] mb-3">
        <button onClick={() => setTab("customer")} className={`px-3 py-1.5 text-xs border-b-2 ${tab === "customer" ? "border-[#b02a2a] text-[#b02a2a] font-semibold" : "border-transparent text-[#666]"}`} data-testid="od-msg-tab-customer">Cliente {order.customer?.name ? `· ${order.customer.name}` : ""}</button>
        <button onClick={() => setTab("rider")} className={`px-3 py-1.5 text-xs border-b-2 ${tab === "rider" ? "border-[#b02a2a] text-[#b02a2a] font-semibold" : "border-transparent text-[#666]"}`} data-testid="od-msg-tab-rider">Livreur {order.rider_name ? `· ${order.rider_name}` : ""}</button>
        <button onClick={() => setTab("rider_customer")} className={`px-3 py-1.5 text-xs border-b-2 ${tab === "rider_customer" ? "border-[#b02a2a] text-[#b02a2a] font-semibold" : "border-transparent text-[#666]"}`} data-testid="od-msg-tab-rider-customer">Livreur ↔ Cliente</button>
      </div>
      <OrderThread orderId={order.id} party={tab} quickReplies={tab === "rider_customer" ? [] : replies} onSent={setLast} readOnly={tab === "rider_customer"}/>
      {tab === "customer" && <div className="text-[10px] text-[#999] mt-2">La cliente lit et répond depuis « Mon compte › Messages » sur la boutique. Sans compte, utilisez WhatsApp.</div>}
    </div>
  );
}

function InfoCard({ icon: Icon, title, testid, children }) {
  return <div className="dina-card-white p-4" data-testid={testid}><div className="flex items-center gap-2 font-semibold mb-2"><Icon size={14} className="text-[#b02a2a]"/>{title}</div>{children}</div>;
}
