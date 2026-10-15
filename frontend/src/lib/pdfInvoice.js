/**
 * A4 invoice / packing slip PDF generator for Chez Dina.
 *
 * - Puts the merchant logo (if provided) + name + address + phone at the top.
 * - Renders line items, subtotal, delivery fee, discount and total.
 * - Also exposes `downloadPackingSlipPDF` for printable rider manifests.
 *
 * Usage:
 *   await downloadInvoicePDF(order, invoice, business);
 *   await downloadPackingSlipPDF(order, business);
 */
import { jsPDF } from "jspdf";
import { openPdf } from "@/components/shared/PdfPreview";

const fcfa = (n) => `${Math.round(n || 0).toLocaleString("en-US")} FCFA`;
const safe = (s, fb = "—") => (s == null || s === "" ? fb : String(s));

function header(doc, business, title, meta) {
  const w = 210; // A4 width mm
  let y = 15;
  if (business.logo) {
    try { doc.addImage(business.logo, "PNG", 15, y, 22, 22); } catch { /* ignore */ }
  }
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text(doc.splitTextToSize(safe(business.name, "Chez Dina"), 70)[0], 42, y + 7);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(doc.splitTextToSize(safe(business.address, "Cocody Angré 7e, Abidjan"), 70)[0], 42, y + 13);
  doc.text(safe(business.phone, "+225 07 77 92 61 79"), 42, y + 18);
  if (business.tiktok) doc.text(`TikTok ${business.tiktok}`, 42, y + 23);
  // Title (right)
  doc.setFont("helvetica", "bold"); doc.setFontSize(title.length > 12 ? 16 : 20);
  doc.setTextColor(176, 42, 42);
  doc.text(title, w - 15, y + 8, { align: "right" });
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  meta.forEach((line, i) => {
    doc.text(line, w - 15, y + 16 + i * 5, { align: "right" });
  });
  // Divider
  const sepY = Math.max(y + 32, y + 19 + meta.length * 5);
  doc.setDrawColor(176, 42, 42); doc.setLineWidth(0.6);
  doc.line(15, sepY, w - 15, sepY);
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.2);
  return sepY + 8;
}

function customerBlock(doc, order, y) {
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("Cliente", 15, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(safe(order.customer?.name), 15, y + 5);
  doc.text(safe(order.customer?.phone), 15, y + 10);
  if (order.delivery_address || order.address) doc.text(safe(order.delivery_address || order.address), 15, y + 15);
  // Right block: delivery info
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("Livraison", 120, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(`Mode : ${safe(order.mode)}`, 120, y + 5);
  if (order.delivery_zone) doc.text(`Zone : ${order.delivery_zone}`, 120, y + 10);
  if (order.rider_name) doc.text(`Livreur : ${order.rider_name}`, 120, y + 15);
  return y + 24;
}

function itemsTable(doc, items, y) {
  const w = 210;
  // Header row
  doc.setFillColor(255, 245, 245);
  doc.rect(15, y, w - 30, 8, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("Article", 18, y + 5.5);
  doc.text("Qté", 130, y + 5.5, { align: "center" });
  doc.text("P.U.", 155, y + 5.5, { align: "right" });
  doc.text("Montant", w - 18, y + 5.5, { align: "right" });
  y += 10;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  (items || []).forEach((it) => {
    const label = `${it.name}${it.size ? ` · ${it.size}` : ""}${it.color ? ` · ${it.color}` : ""}`;
    const lines = doc.splitTextToSize(label, 100);
    lines.forEach((ln, i) => {
      doc.text(ln, 18, y + 4 + i * 4);
      if (i === 0) {
        doc.text(String(it.qty), 130, y + 4, { align: "center" });
        doc.text(fcfa(it.price), 155, y + 4, { align: "right" });
        doc.text(fcfa(it.qty * it.price), w - 18, y + 4, { align: "right" });
      }
    });
    y += 4 * lines.length + 2;
    doc.setDrawColor(236, 236, 236);
    doc.line(15, y, w - 15, y);
    doc.setDrawColor(0, 0, 0);
    y += 2;
  });
  return y;
}

function totalsBlock(doc, order, y) {
  const w = 210;
  const items = order.items || [];
  const subtotal = order.subtotal ?? items.reduce((s, i) => s + i.qty * i.price, 0);
  const fee = order.delivery_fee || 0;
  const disc = order.discount || 0;
  const total = order.total ?? subtotal + fee - disc;
  y += 4;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text("Sous-total", 130, y); doc.text(fcfa(subtotal), w - 18, y, { align: "right" }); y += 5;
  if (fee > 0) { doc.text("Livraison", 130, y); doc.text(fcfa(fee), w - 18, y, { align: "right" }); y += 5; }
  if (disc > 0) { doc.text("Remise", 130, y); doc.setTextColor(31, 138, 76); doc.text(`-${fcfa(disc)}`, w - 18, y, { align: "right" }); doc.setTextColor(0, 0, 0); y += 5; }
  y += 1;
  doc.setDrawColor(176, 42, 42); doc.setLineWidth(0.4);
  doc.line(128, y, w - 15, y); y += 5;
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text("TOTAL", 130, y);
  doc.setTextColor(176, 42, 42);
  doc.text(fcfa(total), w - 18, y, { align: "right" });
  doc.setTextColor(0, 0, 0);
  return y + 10;
}

export function downloadInvoicePDF(order, invoice = {}, business = {}) {
  const { doc, filename } = buildInvoiceDoc(order, invoice, business);
  openPdf(doc, filename);
}

export function invoicePdfBlob(order, invoice = {}, business = {}) {
  const { doc, filename } = buildInvoiceDoc(order, invoice, business);
  return { blob: doc.output("blob"), filename };
}

function buildInvoiceDoc(order, invoice = {}, business = {}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const number = invoice.number || `INV-${order.code}`;
  const createdDate = new Date(invoice.created_at || order.created_at || Date.now()).toLocaleDateString("fr-FR");
  let y = header(doc, business, "FACTURE", [
    `N° ${number}`,
    `Commande ${order.code || "—"}`,
    `Date : ${createdDate}`,
    `Statut : ${order.status || "—"}`,
  ]);
  y = customerBlock(doc, order, y);
  y = itemsTable(doc, order.items, y);
  y = totalsBlock(doc, order, y);
  // Footer
  doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(100, 100, 100);
  doc.text("Merci pour votre confiance Chez Dina.", 105, 280, { align: "center" });
  doc.setTextColor(0, 0, 0);
  return { doc, filename: `facture-${number}.pdf` };
}

function drawPackingSlip(doc, order, business) {
  let y = header(doc, business, "FICHE COLIS", [
    `Commande ${order.code || "—"}`,
    `Date : ${new Date(order.created_at || Date.now()).toLocaleDateString("fr-FR")}`,
    `Mode : ${order.mode || "—"}`,
    order.delivery_zone ? `Zone : ${order.delivery_zone}` : "",
  ].filter(Boolean));
  y = customerBlock(doc, order, y);
  y = itemsTable(doc, order.items, y);
  y = totalsBlock(doc, order, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text("Signature cliente :", 15, y + 10);
  doc.line(55, y + 10, 110, y + 10);
  doc.text("Signature livreur :", 120, y + 10);
  doc.line(160, y + 10, 195, y + 10);
}

export function downloadPackingSlipPDF(order, business = {}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawPackingSlip(doc, order, business);
  openPdf(doc, `fiche-colis-${order.code || "chez-dina"}.pdf`);
}

// Several packing slips in one PDF (one page per order).
export function downloadPackingSlipsPDF(orders, business = {}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  orders.forEach((o, i) => { if (i) doc.addPage(); drawPackingSlip(doc, o, business); });
  openPdf(doc, `fiches-colis-${orders.length}.pdf`);
}

export function downloadRiderRoutePDF(rider, orders, business = {}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawRiderRoute(doc, rider, orders, business);
  openPdf(doc, `feuille-route-${rider.name?.replace(/\s/g, "_") || "livreur"}-${rider.date || new Date().toISOString().slice(0,10)}.pdf`);
}

export function downloadAllRiderRoutesPDF(groups, business = {}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  groups.forEach((g, i) => { if (i) doc.addPage(); drawRiderRoute(doc, g.rider, g.orders, business); });
  openPdf(doc, `feuilles-route-${new Date().toISOString().slice(0,10)}.pdf`);
}

function drawRiderRoute(doc, rider, orders, business = {}) {
  const today = (rider.date ? new Date(rider.date) : new Date()).toLocaleDateString("fr-FR");
  let y = header(doc, business, "FEUILLE DE ROUTE", [
    `Livreur : ${rider.name || "—"}`,
    `Date : ${today}`,
    `Zone : ${rider.zone || "Toutes zones"}`,
    `Nb livraisons : ${orders.length}`,
  ]);
  // Summary stats
  const totalCod = orders.filter(o => o.payment_method === "cod").reduce((s, o) => s + (o.total || 0), 0);
  const totalPaid = orders.filter(o => o.payment_method !== "cod").reduce((s, o) => s + (o.total || 0), 0);
  doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text(`Total COD à encaisser : ${fcfa(totalCod)}`, 15, y);
  doc.text(`Déjà payé (ne pas encaisser) : ${fcfa(totalPaid)}`, 15, y + 5);
  y += 12;
  // Table: # | Commande·Cliente | Adresse | Tél | Paiement·Montant
  const w = 210;
  const COL = { n: 17, who: 24, addr: 80, tel: 136, amt: w - 17 };
  const tableHead = () => {
    doc.setFillColor(255, 245, 245);
    doc.rect(15, y, w - 30, 8, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("#", COL.n, y + 5.5);
    doc.text("Commande / Cliente", COL.who, y + 5.5);
    doc.text("Adresse", COL.addr, y + 5.5);
    doc.text("Téléphone", COL.tel, y + 5.5);
    doc.text("Montant", COL.amt, y + 5.5, { align: "right" });
    y += 11;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  };
  tableHead();
  const LH = 4.2;
  orders.forEach((o, i) => {
    const who = doc.splitTextToSize(`${o.code || ""}\n${o.customer?.name || "—"}`, 53);
    const addrTxt = [o.delivery_zone, o.delivery_address || o.address || o.customer?.address].filter(Boolean).join(" · ") || "—";
    const addr = doc.splitTextToSize(addrTxt, 53);
    const tel = doc.splitTextToSize(String(o.customer?.phone || "—"), 31);
    const note = o.notes ? doc.splitTextToSize(`Note : ${o.notes}`, w - 30 - (COL.who - 15)) : [];
    const rows = Math.max(who.length, addr.length, tel.length, 2);
    const h = rows * LH + note.length * LH + 3;
    if (y + h > 272) { doc.addPage(); y = 20; tableHead(); }
    doc.text(String(i + 1), COL.n, y);
    doc.setFont("helvetica", "bold"); doc.text(who[0], COL.who, y); doc.setFont("helvetica", "normal");
    who.slice(1).forEach((ln, k) => doc.text(ln, COL.who, y + (k + 1) * LH));
    addr.forEach((ln, k) => doc.text(ln, COL.addr, y + k * LH));
    tel.forEach((ln, k) => doc.text(ln, COL.tel, y + k * LH));
    const cod = o.payment_method === "cod";
    doc.setFont("helvetica", "bold");
    doc.text(fcfa(o.total), COL.amt, y, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    if (cod) doc.setTextColor(176, 42, 42); else doc.setTextColor(31, 138, 76);
    doc.text(cod ? "À encaisser" : "Déjà payé", COL.amt, y + LH, { align: "right" });
    doc.setTextColor(0, 0, 0); doc.setFontSize(9);
    if (note.length) {
      doc.setTextColor(110, 110, 110); doc.setFont("helvetica", "italic");
      note.forEach((ln, k) => doc.text(ln, COL.who, y + rows * LH + k * LH));
      doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal");
    }
    y += h - 2;
    doc.setDrawColor(230, 230, 230);
    doc.line(15, y, w - 15, y);
    doc.setDrawColor(0, 0, 0);
    y += 5;
  });
  // Footer
  if (y > 270) { doc.addPage(); y = 25; }
  y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text("Signature livreur :", 15, y);
  doc.line(55, y, 110, y);
  doc.text("Visa gérante :", 120, y);
  doc.line(155, y, 195, y);
}

export async function fetchBusinessForPdf(api) {
  try {
    const r = await api.get("/public/site");
    const s = r.data || {};
    return {
      name: s.name || "Chez Dina",
      address: s.address,
      phone: s.phone,
      tiktok: s.tiktok,
      logo: s.logo || null,
    };
  } catch { return {}; }
}
