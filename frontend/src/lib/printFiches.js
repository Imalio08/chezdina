import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import { fcfa, dueOf, payInfo } from "@/lib/format";
import api from "@/lib/api";

let brandCache = null;
/** Fetch the store name/logo/phone once, then print. */
export async function printFichesFor(orders) {
  if (!orders?.length) return;
  if (!brandCache) {
    try { const s = (await api.get("/public/site")).data || {}; brandCache = { name: s.name || "Chez Dina", logo: s.logo || "", phone: s.phone || "" }; }
    catch { brandCache = { name: "Chez Dina" }; }
  }
  printFiches(orders, brandCache);
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const qr = (v, mm) => renderToStaticMarkup(React.createElement(QRCodeSVG, { value: v, size: 128, level: "M", style: { width: `${mm}mm`, height: `${mm}mm` } }));
const MAX_ITEMS = 6;

function fiche(o, b) {
  const addr = o.delivery_address || o.customer?.address || "";
  const maps = `https://maps.google.com/?q=${encodeURIComponent(`${addr} ${o.delivery_zone || ""} Abidjan`)}`;
  const due = dueOf(o);
  const items = o.items || [];
  const more = items.length > MAX_ITEMS ? `<div class="m">+ ${items.length - MAX_ITEMS} autre(s) article(s)</div>` : "";
  const day = o.delivery_date ? new Date(`${o.delivery_date}T12:00:00`).toLocaleDateString("fr-FR") : "";
  return `<div class="f">
  <div class="hd"><div class="br">${b.logo ? `<img src="${esc(b.logo)}" alt="">` : ""}<div><b>${esc(b.name || "Chez Dina")}</b><div class="m">${esc(b.phone || "")}</div></div></div>${qr(o.code, 20)}</div>
  <div class="cd">${esc(o.code)}</div>
  ${day || o.delivery_slot ? `<div class="m">Livraison ${esc(day)} ${o.delivery_slot ? `· ${esc(o.delivery_slot)}` : ""}</div>` : ""}
  <div class="sec"><div class="lb">Cliente</div><b>${esc(o.customer?.name || "—")}</b><div class="ph">${esc(o.customer?.phone || "—")}</div></div>
  <div class="sec ad"><div><div class="lb">Adresse</div><b>${esc(o.delivery_zone || (o.mode === "pickup" ? "Retrait boutique" : "—"))}</b>${addr ? `<div class="m">${esc(addr)}</div>` : ""}</div>${o.mode !== "pickup" ? qr(maps, 13) : ""}</div>
  <div class="sec it"><div class="lb">Articles · ${items.reduce((s, i) => s + (i.qty || 1), 0)}</div>${items.slice(0, MAX_ITEMS).map(i => `<div>${i.qty || 1}× ${esc(i.name)}${i.size ? ` · ${esc(i.size)}` : ""}${i.color ? ` · ${esc(i.color)}` : ""}</div>`).join("")}${more}</div>
  <div class="tt"><span>Total</span><b>${esc(fcfa(o.total))}</b></div>
  <div class="pay ${due > 0 ? "due" : "ok"}"><div class="lb">${due > 0 ? "À encaisser" : "Déjà payé"}</div><b>${due > 0 ? esc(fcfa(due)) : esc(payInfo(o).label || "Rien à encaisser")}</b></div>
  ${o.rider_name ? `<div class="m c">Livreur : ${esc(o.rider_name)}</div>` : ""}
</div>`;
}

/** Prints only the fiches colis, 4 per A4 sheet, without any browser header/footer (no URL, no date, no title). */
export function printFiches(orders, brand = {}) {
  const pages = [];
  for (let i = 0; i < orders.length; i += 4) pages.push(`<div class="pg">${orders.slice(i, i + 4).map(o => fiche(o, brand)).join("")}</div>`);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>&#8203;</title><style>
@page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}
body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1c1c1c;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pg{width:210mm;height:297mm;padding:7mm;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:5mm;page-break-after:always;break-after:page;overflow:hidden}
.pg:last-child{page-break-after:auto;break-after:auto}
.f{border:1px dashed #999;border-radius:3mm;padding:4mm;font-size:9pt;display:flex;flex-direction:column;gap:1.6mm;overflow:hidden}
.hd{display:flex;justify-content:space-between;align-items:flex-start}.br{display:flex;gap:2mm;align-items:center}.br img{width:9mm;height:9mm;object-fit:contain}
.cd{font-size:16pt;font-weight:800;letter-spacing:.5pt}.m{color:#555;font-size:8pt}.c{text-align:center}
.sec{border-top:1px dashed #ccc;padding-top:1.4mm}.lb{font-size:7pt;text-transform:uppercase;color:#888;letter-spacing:.4pt}.ph{font-size:11pt;font-weight:700}
.ad{display:flex;justify-content:space-between;gap:2mm}.it{flex:1;overflow:hidden;font-size:8.5pt;line-height:1.3}
.tt{display:flex;justify-content:space-between;border-top:1px dashed #ccc;padding-top:1.4mm}
.pay{border-radius:2mm;padding:2mm;text-align:center;color:#fff}.pay b{font-size:14pt}.due{background:#b02a2a}.ok{background:#1f8a4c}
</style></head><body>${pages.join("")}</body></html>`;
  const fr = document.createElement("iframe");
  fr.setAttribute("aria-hidden", "true");
  fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(fr);
  const d = fr.contentDocument;
  d.open(); d.write(html); d.close();
  const go = () => { fr.contentWindow.focus(); fr.contentWindow.print(); setTimeout(() => fr.remove(), 60000); };
  const imgs = Array.from(d.images);
  Promise.all(imgs.map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; }))).then(() => setTimeout(go, 150));
}
