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

const fcfa = (n) => `${Math.round(n || 0).toLocaleString("en-US")} FCFA`;
const safe = (s, fb = "—") => (s == null || s === "" ? fb : String(s));

function header(doc, business, title, meta) {
  const w = 210; // A4 width mm
  let y = 15;
  if (business.logo) {
    try { doc.addImage(business.logo, "PNG", 15, y, 22, 22); } catch { /* ignore */ }
  }
  doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text(safe(business.name, "Chez Dina"), 42, y + 7);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(safe(business.address, "Cocody Angré 7e, Abidjan"), 42, y + 13);
  doc.text(safe(business.phone, "+225 07 77 92 61 79"), 42, y + 18);
  if (business.tiktok) doc.text(`TikTok ${business.tiktok}`, 42, y + 23);
  // Title (right)
  doc.setFont("helvetica", "bold"); doc.setFontSize(22);
  doc.setTextColor(176, 42, 42);
  doc.text(title, w - 15, y + 8, { align: "right" });
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  meta.forEach((line, i) => {
    doc.text(line, w - 15, y + 16 + i * 5, { align: "right" });
  });
  // Divider
  const sepY = y + 32;
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
  doc.save(filename);
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

export function downloadPackingSlipPDF(order, business = {}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = header(doc, business, "FICHE COLIS", [
    `Commande ${order.code || "—"}`,
    `Date : ${new Date(order.created_at || Date.now()).toLocaleDateString("fr-FR")}`,
    `Mode : ${order.mode || "—"}`,
    order.delivery_zone ? `Zone : ${order.delivery_zone}` : "",
  ].filter(Boolean));
  y = customerBlock(doc, order, y);
  y = itemsTable(doc, order.items, y);
  // Rider / signature zone — no price shown on packing slip (optional)
  y = totalsBlock(doc, order, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text("Signature cliente :", 15, y + 10);
  doc.line(55, y + 10, 110, y + 10);
  doc.text("Signature livreur :", 120, y + 10);
  doc.line(160, y + 10, 195, y + 10);
  doc.save(`fiche-colis-${order.code || "chez-dina"}.pdf`);
}

export function downloadRiderRoutePDF(rider, orders, business = {}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const today = new Date().toLocaleDateString("fr-FR");
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
  // Table header
  const w = 210;
  doc.setFillColor(255, 245, 245);
  doc.rect(15, y, w - 30, 8, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("#", 18, y + 5.5);
  doc.text("Commande / Cliente / Adresse", 26, y + 5.5);
  doc.text("Tél", 130, y + 5.5);
  doc.text("Paiement", 160, y + 5.5);
  doc.text("Montant", w - 18, y + 5.5, { align: "right" });
  y += 10;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  orders.forEach((o, i) => {
    const addr = o.delivery_address || o.address || "";
    const label = `${o.code}  ·  ${o.customer?.name || "—"}`;
    const addrLines = doc.splitTextToSize(addr, 100);
    doc.text(String(i + 1), 18, y + 4);
    doc.text(label, 26, y + 4);
    addrLines.forEach((ln, k) => doc.text(ln, 26, y + 4 + (k + 1) * 4));
    doc.text(String(o.customer?.phone || "—"), 130, y + 4);
    const pay = o.payment_method === "cod" ? "COD" : (o.payment_status === "paye" ? "Payé" : "—");
    if (pay === "COD") doc.setTextColor(176, 42, 42);
    doc.text(pay, 160, y + 4);
    doc.setTextColor(0, 0, 0);
    doc.text(fcfa(o.total), w - 18, y + 4, { align: "right" });
    const h = 4 * (1 + addrLines.length) + 3;
    y += h;
    doc.setDrawColor(236, 236, 236);
    doc.line(15, y, w - 15, y);
    doc.setDrawColor(0, 0, 0);
    y += 1;
    if (y > 275) { doc.addPage(); y = 20; }
  });
  // Footer
  y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text("Signature livreur :", 15, y);
  doc.line(55, y, 110, y);
  doc.text("Visa gérante :", 120, y);
  doc.line(155, y, 195, y);
  doc.save(`feuille-route-${rider.name?.replace(/\s/g, "_") || "livreur"}-${new Date().toISOString().slice(0,10)}.pdf`);
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
