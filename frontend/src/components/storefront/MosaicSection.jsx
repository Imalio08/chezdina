import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { siteLink } from "@/lib/format";
import SmartImage from "@/components/shared/SmartImage";

/**
 * Masonry mosaic with continuously scrolling columns at alternating speeds.
 * Pauses on hover. Respects prefers-reduced-motion.
 *
 * props.images: [{ src, link?, alt?, size? ("lg"|"md"|"sm") }]
 * props.title, props.eyebrow, props.subtitle
 * props.speed: base pixels per second (default 25)
 */
export default function MosaicSection({ title, eyebrow, subtitle, images = [], speed = 25 }) {
  const [cols, setCols] = useState(getColsForWidth(typeof window !== "undefined" ? window.innerWidth : 1024));
  const [reduced, setReduced] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const onResize = () => setCols(getColsForWidth(window.innerWidth));
    window.addEventListener("resize", onResize);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onReduce = () => setReduced(mq.matches);
    onReduce();
    mq.addEventListener?.("change", onReduce);
    return () => {
      window.removeEventListener("resize", onResize);
      mq.removeEventListener?.("change", onReduce);
    };
  }, []);

  // Distribute images into columns using "shortest column first" to approximate masonry.
  // Pseudo-heights come from the declared size (fallback 1.3 aspect).
  const columns = useMemo(() => {
    const buckets = Array.from({ length: cols }, () => ({ items: [], h: 0 }));
    const H = { lg: 1.6, md: 1.3, sm: 1.0 };
    images.forEach((img, i) => {
      const size = img.size || (i % 7 === 0 ? "lg" : i % 3 === 0 ? "sm" : "md");
      const h = H[size] || 1.3;
      // place in shortest column
      let idx = 0;
      for (let k = 1; k < buckets.length; k++) if (buckets[k].h < buckets[idx].h) idx = k;
      buckets[idx].items.push({ ...img, size });
      buckets[idx].h += h;
    });
    return buckets.map((b) => b.items);
  }, [images, cols]);

  if (!images.length) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 py-10" data-testid="mosaic-section">
      {(title || eyebrow) && (
        <div className="mb-6">
          {eyebrow && <div className="text-[10px] uppercase tracking-widest text-[#b02a2a]">{eyebrow}</div>}
          {title && <h2 className="font-serif text-2xl md:text-3xl mt-0.5">{title}</h2>}
          {subtitle && <p className="text-sm text-[#666] mt-1 max-w-2xl">{subtitle}</p>}
        </div>
      )}

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, height: "72vh", maxHeight: 720 }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {columns.map((items, colIdx) => {
          // Alternate direction between columns (up/down) with slightly different speeds
          const direction = colIdx % 2 === 0 ? "up" : "down";
          const colSpeed = speed * (1 + (colIdx % 3) * 0.15); // vary 1x, 1.15x, 1.30x
          return (
            <MosaicColumn
              key={colIdx}
              items={items}
              direction={direction}
              speed={colSpeed}
              paused={paused || reduced}
            />
          );
        })}
      </div>
    </section>
  );
}

function MosaicColumn({ items, direction, speed, paused }) {
  const trackRef = useRef(null);
  const posRef = useRef(0);
  const rafRef = useRef(0);
  const [trackH, setTrackH] = useState(0);

  // Measure one half of the track (since we duplicate items for seamless loop)
  useEffect(() => {
    const measure = () => {
      if (!trackRef.current) return;
      // Half height because we render items twice
      setTrackH(trackRef.current.scrollHeight / 2);
    };
    const t = setTimeout(measure, 50);
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    return () => { clearTimeout(t); ro.disconnect(); };
  }, [items]);

  useEffect(() => {
    let last = performance.now();
    const step = (now) => {
      const dt = (now - last) / 1000; last = now;
      if (!paused && trackH > 0) {
        posRef.current += speed * dt * (direction === "up" ? 1 : -1);
        // wrap around
        if (direction === "up" && posRef.current >= trackH) posRef.current -= trackH;
        if (direction === "down" && posRef.current <= -trackH) posRef.current += trackH;
        if (trackRef.current) {
          const translateY = direction === "up" ? -posRef.current : -(trackH + posRef.current);
          trackRef.current.style.transform = `translate3d(0, ${translateY}px, 0)`;
        }
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [direction, speed, paused, trackH]);

  // Reduced motion fallback: show items statically (no animation)
  return (
    <div className="relative overflow-hidden rounded-xl bg-[#fafafa] dark:bg-[#1a1a1a]" style={{ height: "100%" }}>
      <div ref={trackRef} className="will-change-transform">
        {[0, 1].map((loopIdx) => (
          <div key={loopIdx}>
            {items.map((img, i) => (
              <Tile key={`${loopIdx}-${i}`} img={img} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Tile({ img }) {
  const aspect = img.size === "lg" ? "aspect-[3/4]" : img.size === "sm" ? "aspect-square" : "aspect-[4/5]";
  const inner = (
    <div className={`${aspect} w-full overflow-hidden rounded-xl mb-3 bg-[#eee] dark:bg-[#222] group`}>
      <SmartImage
        src={img.src}
        alt={img.alt || ""}
        fallbackIcon
        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
      />
    </div>
  );
  if (img.link) {
    const isExternal = img.link.startsWith("http");
    if (isExternal) {
      return <a href={img.link} target="_blank" rel="noreferrer" data-testid="mosaic-tile">{inner}</a>;
    }
    return <Link to={siteLink(img.link)} data-testid="mosaic-tile">{inner}</Link>;
  }
  return <div data-testid="mosaic-tile">{inner}</div>;
}

function getColsForWidth(w) {
  if (w < 640) return 2;
  if (w < 1024) return 3;
  return 4;
}
