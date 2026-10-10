import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "@/lib/api";
import { fcfa, dateTimeFmt, statusLabel, statusColor } from "@/lib/format";
import { toast } from "sonner";
import { ChevronLeft, Download, Printer, MessageCircle, FileText, User, Truck, MapPin, Clock } from "lucide-react";
import SmartImage from "@/components/shared/SmartImage";
import { downloadInvoicePDF, downloadPackingSlipPDF, fetchBusinessForPdf } from "@/lib/pdfInvoice";

const STATUSES = ["nouvelle", "confirmee", "en_preparation", "prete", "assignee", "en_livraison", "livree", "retournee", "annulee"];

export default function OrderDetail() {
  const { code } = useParams();
  const nav = useNavigate();
  const [order, setOrder] = useState(null);
  const [invoice, setInvoice] = useState(null);

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
    } catch { toast.error("Erreur"); }
  };

  const invoiceAction = async (action) => {
    try {
      let inv = invoice;
      if (!inv) {
        const r = await api.post(`/invoices/from-order/${order.id}`);
        inv = r.data; setInvoice(inv);
      }
      const business = await fetchBusinessForPdf(api);
      if (action === "pdf") { downloadInvoicePDF(order, inv, business); toast.success(`Facture ${inv.number} générée`); }
      else if (action === "slip") { downloadPackingSlipPDF(order, business); toast.success(`Fiche colis ${order.code} générée`); }
      else if (action === "wa") {
        downloadInvoicePDF(order, inv, business);
        const phone = (order.customer?.phone || "").replace(/\D/g, "");
        if (!phone) return toast.error("Numéro cliente manquant");
        const txt = `Bonjour ${order.customer?.name || ""}, voici votre facture ${inv.number} pour la commande ${order.code} — Total ${fcfa(inv.total)}. Le PDF a été téléchargé, pensez à le joindre à ce message. Merci Chez Dina 💛`;
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(txt)}`, "_blank");
      }
    } catch { toast.error("Erreur facture"); }
  };

  if (!order) return <div className="text-center py-12 text-sm text-[#666]">Chargement…</div>;

  const subtotal = (order.items || []).reduce((s, i) => s + (i.qty * i.price), 0);

  return (
    <div className="space-y-5 font-sora" data-testid="order-detail">
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
          {order.delivery_date && <div className="text-xs text-[#666] flex items-center gap-1 mt-1"><Clock size={11}/>{order.delivery_date} · {order.delivery_slot || ""}</div>}
        </InfoCard>

        <InfoCard icon={FileText} title="Facture" testid="order-invoice">
          <div className="flex gap-1 flex-wrap">
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

      <div className="dina-card-white p-5" data-testid="order-status-flow">
        <div className="font-semibold mb-2">Changer le statut</div>
        <div className="flex gap-2 flex-wrap">
          {STATUSES.map(s => (
            <button key={s} onClick={() => changeStatus(s)} className={`dina-chip ${order.status === s ? "!bg-[#1c1c1c] !text-white" : ""}`} data-testid={`od-status-${s}`}>
              <span className="status-dot" style={{ background: statusColor[s] }}/>{statusLabel[s]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, testid, children }) {
  return <div className="dina-card-white p-4" data-testid={testid}><div className="flex items-center gap-2 font-semibold mb-2"><Icon size={14} className="text-[#b02a2a]"/>{title}</div>{children}</div>;
}
