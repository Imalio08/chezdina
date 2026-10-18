import React, { useEffect, useRef, useState } from "react";

// Finger / mouse signature drawn on screen → PNG data URL (null while empty).
export default function SignaturePad({ onChange, testid = "signature-pad", height = 160 }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);
  useEffect(() => {
    const c = ref.current; const r = c.getBoundingClientRect();
    c.width = r.width * 2; c.height = height * 2;
    const ctx = c.getContext("2d"); ctx.scale(2, 2); ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.strokeStyle = "#111";
  }, [height]);
  const pos = (e) => { const r = ref.current.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; return [p.clientX - r.left, p.clientY - r.top]; };
  const start = (e) => { e.preventDefault(); drawing.current = true; const ctx = ref.current.getContext("2d"); ctx.beginPath(); ctx.moveTo(...pos(e)); };
  const move = (e) => { if (!drawing.current) return; e.preventDefault(); const ctx = ref.current.getContext("2d"); ctx.lineTo(...pos(e)); ctx.stroke(); setEmpty(false); };
  const end = () => { if (!drawing.current) return; drawing.current = false; onChange(ref.current.toDataURL("image/png")); };
  const clear = () => { const c = ref.current; c.getContext("2d").clearRect(0, 0, c.width, c.height); setEmpty(true); onChange(null); };
  return (
    <div>
      <canvas ref={ref} style={{ height, touchAction: "none" }} className="w-full bg-white border border-dashed border-[#bbb] rounded-lg cursor-crosshair"
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end} onTouchStart={start} onTouchMove={move} onTouchEnd={end} data-testid={testid} />
      <div className="flex justify-between text-[11px] text-[#666] mt-1"><span>{empty ? "Signez dans le cadre" : "Signature enregistrée"}</span><button type="button" onClick={clear} className="underline" data-testid={`${testid}-clear`}>Effacer</button></div>
    </div>
  );
}
