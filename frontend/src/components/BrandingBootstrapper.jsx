/**
 * Applies the merchant's logo as favicon + apple-touch-icon dynamically once
 * the site settings are loaded, and swaps the <link rel="manifest"> to the
 * backend's dynamic manifest so the PWA install icon also matches.
 */
import { useEffect } from "react";
import api from "@/lib/api";

const DEFAULT_FAVICON = "/icons/icon-192.png";

export default function BrandingBootstrapper() {
  useEffect(() => {
    let cancelled = false;
    const apply = (data) => {
      if (cancelled) return;
      const d = data || {};
      const logo = d.logo || DEFAULT_FAVICON;
      const title = d.name ? `${d.name} — Boutique femme à Abidjan` : document.title;
      const fav = document.getElementById("dynamic-favicon");
      const apple = document.getElementById("dynamic-apple-icon");
      if (fav) fav.href = logo;
      if (apple) apple.href = logo;
      if (title) document.title = title;
      // Swap manifest to backend-generated version so install icon tracks logo.
      const manifest = document.getElementById("dynamic-manifest");
      if (manifest) {
        const base = process.env.REACT_APP_BACKEND_URL || "";
        const bust = d.updated_at ? `?v=${encodeURIComponent(d.updated_at)}` : "";
        manifest.href = `${base}/api/public/manifest.webmanifest${bust}`;
      }
    };
    api.get("/public/site").then((r) => apply(r.data)).catch(() => {});
    const onBrand = () => api.get("/public/site").then((r) => apply(r.data)).catch(() => {});
    window.addEventListener("branding-changed", onBrand);
    return () => { cancelled = true; window.removeEventListener("branding-changed", onBrand); };
  }, []);
  return null;
}
