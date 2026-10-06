import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Info, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, Tooltip } from "recharts";

export default function KPICard({
  label,
  value,                   // string or number already formatted (e.g. "1 245 000 FCFA")
  valueFull,               // optional full-precision string for native tooltip (compact display)
  unit,                    // optional "FCFA", "%", etc.
  previousValue,           // number OR formatted string ("0%") for delta computation (optional)
  deltaLabel,              // "+12 % vs hier" — if omitted, computed from previousValue
  deltaDirection,          // "up" | "down" | "flat" | "auto" — auto uses previousValue
  inverse = false,         // true when rising is bad (cancellations, expenses) → red up
  info,                    // tooltip text (string)
  detailLink,              // route path to drill-down
  sparkline,               // array of numbers (last N points)
  icon: Icon,              // lucide-react icon
  color = "#b02a2a",
  hero = false,            // double-column big card
  testid,
}) {
  const [tipOpen, setTipOpen] = useState(false);
  const toNum = (x) => {
    if (x === undefined || x === null) return NaN;
    if (typeof x === "number") return x;
    const parsed = parseFloat(String(x).replace(/[^\d.-]/g, ""));
    return parsed;
  };
  let dir = deltaDirection, pct = null, abs = null;
  if (dir === "auto" || !dir) {
    const num = toNum(value);
    const prevNum = toNum(previousValue);
    if (!Number.isNaN(num) && !Number.isNaN(prevNum)) {
      if (prevNum === 0 && num === 0) {
        dir = "flat";
      } else if (prevNum === 0) {
        dir = num > 0 ? "up" : "down";
        abs = num;
        pct = null; // no meaningful %, show absolute instead
      } else {
        pct = ((num - prevNum) / Math.abs(prevNum)) * 100;
        abs = num - prevNum;
        dir = Math.abs(pct) < 0.5 ? "flat" : pct > 0 ? "up" : "down";
      }
    } else {
      dir = "flat";
    }
  }
  const good = (dir === "up" && !inverse) || (dir === "down" && inverse);
  const bad  = (dir === "down" && !inverse) || (dir === "up" && inverse);
  const deltaColor = dir === "flat" ? "#666" : good ? "#1f8a4c" : bad ? "#c62828" : "#666";
  const Arrow = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;

  const sparkData = (sparkline || []).map((v,i)=>({ x: i, y: v }));

  return (
    <div className={`dina-card-white p-5 relative ${hero?"lg:col-span-2":""}`} data-testid={testid || `kpi-${label.toLowerCase().replace(/\s+/g,"-")}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <div className="w-8 h-8 rounded-lg grid place-items-center shrink-0" style={{background:`${color}1a`,color}}><Icon size={15}/></div>}
          <div className="text-xs uppercase tracking-wide text-[#666] font-semibold truncate">{label}</div>
          {info && (
            <button onMouseEnter={()=>setTipOpen(true)} onMouseLeave={()=>setTipOpen(false)} onClick={()=>setTipOpen(!tipOpen)} className="text-[#999] hover:text-[#1c1c1c] shrink-0" data-testid={`${testid||label}-info`}>
              <Info size={12}/>
            </button>
          )}
        </div>
        {detailLink && <Link to={detailLink} className="text-[11px] text-[#666] hover:text-[#b02a2a] shrink-0" data-testid={`${testid||label}-detail`}>Rapport ›</Link>}
      </div>

      {tipOpen && info && (
        <div className="absolute top-12 left-5 right-5 bg-[#1c1c1c] text-white text-xs rounded-lg p-2.5 z-20 shadow-lg pointer-events-none" data-testid={`${testid||label}-tooltip`}>{info}</div>
      )}

      <div className={`font-serif tabular leading-none ${hero?"text-5xl":"text-3xl"} mb-2 break-words`} title={valueFull || undefined}>{value}{unit && <span className="text-base ml-1 text-[#666]">{unit}</span>}</div>

      {dir && dir !== "flat" && (
        <div className="flex items-center gap-1 text-sm" style={{color: deltaColor}}>
          <Arrow size={13}/>
          <span className="font-semibold tabular">
            {pct !== null && Number.isFinite(pct)
              ? `${pct>0?"+":""}${pct.toFixed(1)}%`
              : (abs !== null && Number.isFinite(abs)
                  ? `${abs>0?"+":""}${Math.round(abs).toLocaleString("fr-FR").replace(/,/g," ")}`
                  : (deltaLabel || ""))}
          </span>
          {abs !== null && Number.isFinite(abs) && pct !== null && Number.isFinite(pct) && <span className="text-xs text-[#666] ml-1">· {abs>0?"+":""}{Math.round(abs).toLocaleString("fr-FR").replace(/,/g," ")}</span>}
        </div>
      )}
      {deltaLabel && dir === "flat" && <div className="text-sm text-[#666]">{deltaLabel}</div>}

      {sparkData.length > 2 && (
        <div className="h-10 mt-2 -mx-2 opacity-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <defs><linearGradient id={`spk-${testid||label}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.4}/><stop offset="100%" stopColor={color} stopOpacity={0}/></linearGradient></defs>
              <Area type="monotone" dataKey="y" stroke={color} strokeWidth={1.5} fill={`url(#spk-${testid||label})`} isAnimationActive={false}/>
              <Tooltip content={() => null}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {detailLink && !sparkData.length && (
        <Link to={detailLink} className="inline-flex items-center gap-1 mt-2 text-xs text-[#b02a2a] hover:underline" data-testid={`${testid||label}-view`}>Voir détails →</Link>
      )}
    </div>
  );
}
