import { jsPDF } from "jspdf";

const fcfa = (n) => `${Math.round(n||0).toLocaleString("fr-FR").replace(/,/g," ")} FCFA`;

/** Generate a thermal-receipt PDF (80mm) in French and trigger download. */
export function downloadReceiptPDF(order, business = {}) {
  const w = 80, h = 300; // mm
  const doc = new jsPDF({ unit: "mm", format: [w, h] });
  let y = 8;
  // Logo (optional) — centered thumbnail, 18 mm wide
  if (business.logo) {
    try {
      doc.addImage(business.logo, "PNG", (w - 18) / 2, y, 18, 18);
      y += 20;
    } catch { /* ignore malformed logo */ }
  }
  doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text(business.name || "Chez Dina", w/2, y, { align: "center" }); y += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text(business.address || "Cocody Angré 7e, Abidjan", w/2, y, { align: "center" }); y += 3.5;
  doc.text(business.phone || "+225 07 77 92 61 79", w/2, y, { align: "center" }); y += 3.5;
  doc.text("TikTok " + (business.tiktok || "@dinoush04"), w/2, y, { align: "center" }); y += 5;
  doc.setLineDashPattern([1,1], 0); doc.line(4, y, w-4, y); y += 4;

  doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text(`Reçu N° ${order.code || "—"}`, 4, y); y += 4;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text(new Date(order.created_at || Date.now()).toLocaleString("fr-FR"), 4, y); y += 3.5;
  if (order.created_by) { doc.text(`Agent : ${order.created_by}`, 4, y); y += 3.5; }
  if (order.customer?.name) { doc.text(`Cliente : ${order.customer.name}`, 4, y); y += 3.5; }
  doc.line(4, y, w-4, y); y += 4;

  (order.items || []).forEach(it => {
    const label = `${it.qty}× ${it.name}${it.size?` (${it.size})`:""}${it.color?` · ${it.color}`:""}`;
    const lines = doc.splitTextToSize(label, w-28);
    lines.forEach((ln,i) => { doc.text(ln, 4, y); if (i===0) doc.text(fcfa(it.qty*it.price), w-4, y, { align: "right" }); y += 3.5; });
  });
  doc.line(4, y, w-4, y); y += 4;

  doc.text("Sous-total", 4, y); doc.text(fcfa(order.subtotal), w-4, y, { align: "right" }); y += 3.5;
  if (order.delivery_fee > 0) { doc.text("Livraison", 4, y); doc.text(fcfa(order.delivery_fee), w-4, y, { align: "right" }); y += 3.5; }
  if (order.discount > 0) { doc.text("Remise", 4, y); doc.text(`-${fcfa(order.discount)}`, w-4, y, { align: "right" }); y += 3.5; }
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("TOTAL", 4, y); doc.text(fcfa(order.total), w-4, y, { align: "right" }); y += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  const methodLabel = {cash:"Espèces", wave:"Wave", orange:"Orange Money", mtn:"MTN MoMo", moov:"Moov Money", wallet:"Porte-monnaie", points:"Points", mixed:"Mixte", cod:"Paiement à la livraison"}[order.payment_method] || order.payment_method;
  doc.text(`Paiement : ${methodLabel}`, w/2, y, { align: "center" }); y += 4;
  doc.line(4, y, w-4, y); y += 4;

  doc.setFont("helvetica", "italic");
  doc.text("Merci de votre visite !", w/2, y, { align: "center" }); y += 4;
  doc.setFont("helvetica", "normal"); doc.setFontSize(7);
  doc.text("Retrouvez-nous sur TikTok " + (business.tiktok || "@dinoush04"), w/2, y, { align: "center" });

  doc.save(`recu-${order.code || "chez-dina"}.pdf`);
}
