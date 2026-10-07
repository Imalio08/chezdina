/**
 * Applies the merchant's logo as favicon + apple-touch-icon dynamically
 * once the site settings are loaded. Falls back to the static CD icon
 * shipped under /icons/.
 */
import { useEffect } from "react";
import api from "@/lib/api";

const DEFAULT_FAVICON = "/icons/icon-192.png";

export default function BrandingBootstrapper() {
  useEffect(() => {
    let cancelled = false;
    api.get("/public/site").then((r) => {
      if (cancelled) return;
      const data = r.data || {};
      const logo = data.logo || DEFAULT_FAVICON;
      const title = data.name ? `${data.name} — Boutique femme à Abidjan` : document.title;
      const fav = document.getElementById("dynamic-favicon");
      const apple = document.getElementById("dynamic-apple-icon");
      if (fav) fav.href = logo;
      if (apple) apple.href = logo;
      if (title) document.title = title;
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return null;
}
