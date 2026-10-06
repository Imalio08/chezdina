import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Clock, X } from "lucide-react";

/**
 * Banner shown on storefront when the shop is closed based on site_settings.opening_hours.
 * opening_hours: { mon:{open:"09:00",close:"18:30"}, tue:{...}, ..., sun:{closed:true} }
 */
const DAY_KEYS = ["sun","mon","tue","wed","thu","fri","sat"];
const DAY_LABEL = { sun:"dimanche", mon:"lundi", tue:"mardi", wed:"mercredi", thu:"jeudi", fri:"vendredi", sat:"samedi" };

export default function OpeningHoursBanner() {
  const [site, setSite] = useState(null);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem("dina_hours_dismissed") === "1");
  useEffect(() => { api.get("/public/site").then(r => setSite(r.data || {})).catch(() => {}); }, []);
  if (!site || dismissed) return null;
  const hours = site.opening_hours || {};
  if (!Object.keys(hours).length) return null;
  const now = new Date();
  const todayKey = DAY_KEYS[now.getDay()];
  const today = hours[todayKey] || {};
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const toMin = (hhmm) => { if (!hhmm) return null; const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  const openMin = toMin(today.open);
  const closeMin = toMin(today.close);
  const isClosed = today.closed || openMin == null || closeMin == null || nowMin < openMin || nowMin >= closeMin;
  if (!isClosed) return null;

  // Find next opening + countdown
  let nextLabel = "";
  let countdownMin = null;
  if (!today.closed && openMin != null && nowMin < openMin) {
    nextLabel = `ouvre à ${today.open}`;
    countdownMin = openMin - nowMin;
  } else {
    for (let i = 1; i <= 7; i++) {
      const key = DAY_KEYS[(now.getDay() + i) % 7];
      const h = hours[key];
      if (h && !h.closed && h.open) {
        nextLabel = `rouvre ${i === 1 ? "demain" : DAY_LABEL[key]} à ${h.open}`;
        const nextOpen = toMin(h.open);
        countdownMin = (i * 24 * 60) - nowMin + nextOpen;
        break;
      }
    }
  }
  const fmtCountdown = (m) => {
    if (m == null) return "";
    const h = Math.floor(m / 60); const mm = m % 60;
    if (h >= 24) { const d = Math.floor(h / 24); return `dans ${d} j ${h % 24} h`; }
    if (h > 0) return `dans ${h} h ${mm > 0 ? mm + " min" : ""}`.trim();
    return `dans ${mm} min`;
  };
  return (
    <div className="bg-[#fff5f5] dark:bg-[#2a1818] border-b border-[#fde8e8] dark:border-[#4a2828] text-[#b02a2a] px-4 py-2 flex items-center justify-between text-xs" data-testid="hours-banner">
      <div className="flex items-center gap-2 min-w-0">
        <Clock size={13} className="shrink-0"/>
        <span className="truncate"><b>Boutique fermée actuellement</b> · {nextLabel || "nous rouvrirons bientôt"}{countdownMin != null && ` · ${fmtCountdown(countdownMin)}`}</span>
      </div>
      <button onClick={() => { sessionStorage.setItem("dina_hours_dismissed", "1"); setDismissed(true); }} className="shrink-0 text-[#b02a2a] hover:opacity-70" aria-label="Fermer"><X size={13}/></button>
    </div>
  );
}
