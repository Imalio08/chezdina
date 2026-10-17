import React from "react";

/** Real screenshot with numbered markers (x/y/w/h in % of the image) and a legend. */
export default function PhotoAnnotated({ image, callouts = [], caption, ratio }) {
  return (
    <figure className={`rounded-xl overflow-hidden border border-[#ececec] dark:border-[#2a2a2a] bg-[#fafafa] dark:bg-[#141414] ${ratio && ratio < 1 ? "max-w-[380px] mx-auto" : ""}`} data-testid="manual-photo">
      <div className="relative">
        <img src={image} alt={caption || "Capture d'écran"} className="w-full block" loading="lazy"/>
        {callouts.map(c => (
          <React.Fragment key={c.n}>
            {c.w > 0 && c.h > 0 && <span className="absolute border-2 border-dashed border-[#c62828] rounded-md pointer-events-none" style={{ left: `${c.x - c.w / 2}%`, top: `${c.y - c.h / 2}%`, width: `${c.w}%`, height: `${c.h}%` }}/>}
            <span className="absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#c62828] text-white text-xs font-bold grid place-items-center ring-2 ring-white shadow" style={{ left: `${Math.min(97, c.x + c.w / 2)}%`, top: `${Math.max(3, c.y - c.h / 2)}%` }}>{c.n}</span>
          </React.Fragment>
        ))}
      </div>
      {(callouts.length > 0 || caption) && (
        <figcaption className="p-3 border-t border-[#ececec] dark:border-[#2a2a2a] text-xs space-y-1">
          {caption && <div className="italic text-[#666]">{caption}</div>}
          {callouts.length > 0 && <ol className="grid sm:grid-cols-2 gap-x-4 gap-y-1">{callouts.map(c => (
            <li key={c.n} className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-[#c62828] text-white text-[10px] font-bold grid place-items-center shrink-0">{c.n}</span>{c.label}</li>
          ))}</ol>}
        </figcaption>
      )}
    </figure>
  );
}
