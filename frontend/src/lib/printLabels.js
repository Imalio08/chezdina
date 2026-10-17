import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import api from "@/lib/api";
import { fcfa } from "@/lib/format";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Renders a print window for label rows {code, name, color, size_tag, price}. Call window.open BEFORE awaiting (popup blockers). */
function openSheet(w, title, rows, subtitle) {
  const cards = rows.map(l => `
    <div class="lb">
      <div class="qr">${renderToStaticMarkup(React.createElement(QRCodeSVG, { value: l.code, size: 96, level: "M" }))}</div>
      <div class="tx">
        <div class="n">${esc(l.name)}</div>
        <div class="v">${esc([l.color, l.size_tag].filter(Boolean).join(" · ") || "Taille unique")}</div>
        ${l.price ? `<div class="p">${esc(fcfa(l.price))}</div>` : ""}
        <div class="c">${esc(l.code)}</div>
      </div>
    </div>`).join("");
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>@page{size:A4;margin:8mm}body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:0}
.g{display:grid;grid-template-columns:repeat(3,62mm);gap:3mm}
.lb{width:62mm;height:32mm;border:1px dashed #bbb;box-sizing:border-box;padding:2mm;display:flex;gap:2mm;align-items:center;break-inside:avoid}
.qr svg{width:26mm;height:26mm;display:block}.tx{min-width:0;flex:1}.n{font-weight:700;font-size:10pt;line-height:1.15}
.v{font-size:9pt;margin-top:1mm}.p{font-size:10pt;font-weight:700;color:#b02a2a;margin-top:1mm}.c{font-family:monospace;font-size:8pt;font-weight:700;margin-top:1mm;word-break:break-all}
.bar{padding:10px;font-size:13px}@media print{.bar{display:none}}</style></head>
<body><div class="bar">${esc(subtitle)} <button onclick="print()">Imprimer</button></div>
<div class="g">${cards}</div><script>setTimeout(function(){print()},400)</script></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  if (w) { w.location.href = url; return; }
  if (!window.open(url, "_blank")) throw new Error("Pop-up bloquée · autorisez les pop-ups puis réimprimez les étiquettes");
}

/** One QR label per size/colour (codes = preparation codes). perPiece → one label per unit in stock. */
export async function printProductLabels(productId, { perPiece = false } = {}) {
  const w = window.open("", "_blank");
  try {
    const { data } = await api.get(`/products/${productId}/labels`);
    const rows = data.labels.flatMap(l => Array(perPiece ? Math.max(0, l.stock) : 1).fill({ ...l, name: data.name, price: data.price }));
    openSheet(w, `Étiquettes · ${data.name}`, rows, `${data.labels.length} variante(s) · ${perPiece ? "une étiquette par pièce en stock" : "une étiquette par variante"}`);
  } catch (e) { if (w) w.close(); throw e; }
}

/** One QR label per piece received on a supplier delivery. */
export async function printPOLabels(poId) {
  const w = window.open("", "_blank");
  try {
    const { data } = await api.get(`/purchase-orders/${poId}/labels`);
    if (!data.labels.length) { if (w) w.close(); throw new Error("Aucune pièce reçue à étiqueter"); }
    openSheet(w, `Étiquettes réception · ${data.number || ""}`, data.labels, `Réception ${data.number || ""}${data.supplier ? " · " + data.supplier : ""} · ${data.labels.length} pièce(s)`);
  } catch (e) { if (w) w.close(); throw e; }
}
