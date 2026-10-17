import React, { useEffect, useRef, useState } from "react";

/** Single-line text that scrolls right→left only when it overflows its container. */
export default function Marquee({ children, className = "", speed = 40, testid }) {
  const box = useRef(null);
  const inner = useRef(null);
  const [dur, setDur] = useState(0);
  useEffect(() => {
    const measure = () => {
      const b = box.current, i = inner.current;
      if (!b || !i) return;
      const w = i.scrollWidth - (parseFloat(getComputedStyle(i).paddingLeft) || 0);
      setDur(w > b.clientWidth + 2 ? Math.max(6, (w + b.clientWidth) / speed) : 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [children, speed]);
  return (
    <div ref={box} className={`dina-marquee min-w-0 overflow-hidden whitespace-nowrap ${className}`} data-testid={testid}>
      <span ref={inner} className={`inline-block ${dur ? "dina-marquee-run" : ""}`} style={dur ? { animationDuration: `${dur}s` } : undefined}>{children}</span>
    </div>
  );
}
