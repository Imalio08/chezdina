import { useEffect } from "react";
import api from "@/lib/api";

const LOADED_FONTS = new Set();

function loadGoogleFont(font) {
  if (!font || LOADED_FONTS.has(font)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
  LOADED_FONTS.add(font);
}

export default function useSiteTheme() {
  useEffect(() => {
    let cancelled = false;
    api.get("/public/site").then(r => {
      if (cancelled) return;
      const t = r.data?.theme || {};
      const root = document.documentElement;
      if (t.primary) root.style.setProperty("--dina-yellow", t.primary);
      if (t.primary) root.style.setProperty("--dina-yellow-dark", t.primary);
      if (t.secondary) root.style.setProperty("--dina-secondary", t.secondary);
      if (t.button) root.style.setProperty("--dina-button", t.button);
      if (t.background) root.style.setProperty("--dina-bg", t.background);
      if (t.text) root.style.setProperty("--dina-text", t.text);
      if (t.radius) root.style.setProperty("--dina-radius", `${t.radius}px`);
      if (t.font) { loadGoogleFont(t.font); root.style.setProperty("--dina-font", `"${t.font}", system-ui, sans-serif`); document.body.style.fontFamily = `"${t.font}", system-ui, sans-serif`; }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
}
