import React, { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { X, Download, MessageCircle } from "lucide-react";
import { fcfa } from "@/lib/format";
import { invoicePdfBlob, fetchBusinessForPdf } from "@/lib/pdfInvoice";

export async function buildInvoicePreview(api, order, inv) {
  if (!inv) inv = (await api.post(`/invoices/from-order/${order.id}`)).data;
  const business = await fetchBusinessForPdf(api);
  const { blob, filename } = invoicePdfBlob(order, inv, business);
  return { order, inv, blob, filename };
}

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

export async function shareInvoiceOnWhatsApp({ order, inv, blob, filename }) {
  const phone = (order.customer?.phone || "").replace(/\D/g, "");
  const text = `Bonjour ${order.customer?.name || ""}, voici votre facture ${inv.number} pour la commande ${order.code} — Total ${fcfa(inv.total ?? order.total)}. Merci Chez Dina`;
  const file = new File([blob], filename, { type: "application/pdf" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); return; }
    catch (e) { if (e?.name === "AbortError") return; }
  }
  if (!phone) return toast.error("Numéro cliente manquant");
  downloadBlob(blob, filename);
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text + " (facture PDF jointe)")}`, "_blank");
  toast.success("PDF téléchargé · glissez-le dans la conversation WhatsApp");
}

export function InvoicePreviewModal({ data, onClose }) {
  const url = useMemo(() => URL.createObjectURL(data.blob), [data.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-3" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl w-full max-w-3xl h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()} data-testid="invoice-preview-modal">
        <div className="flex items-center justify-between gap-2 p-3 border-b border-[#ececec] dark:border-[#2a2a2a] flex-wrap">
          <div className="min-w-0"><div className="font-serif text-lg truncate">Facture {data.inv.number}</div><div className="text-xs text-[#666]">Commande {data.order.code} · {fcfa(data.inv.total ?? data.order.total)}</div></div>
          <div className="flex gap-2">
            <button onClick={() => downloadBlob(data.blob, data.filename)} className="dina-btn-secondary !min-h-[34px] text-xs" data-testid="invoice-preview-download"><Download size={12}/>Télécharger</button>
            <button onClick={() => shareInvoiceOnWhatsApp(data)} className="dina-btn-primary !min-h-[34px] text-xs !bg-[#1f8a4c]" data-testid="invoice-preview-wa"><MessageCircle size={12}/>WhatsApp</button>
            <button onClick={onClose} className="p-1" data-testid="invoice-preview-close"><X size={18}/></button>
          </div>
        </div>
        <iframe src={url} title="Aperçu facture" className="flex-1 w-full bg-[#f5f5f5]" data-testid="invoice-preview-frame"/>
      </div>
    </div>
  );
}
