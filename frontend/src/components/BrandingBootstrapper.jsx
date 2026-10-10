/**
 * Applies the merchant's logo as favicon + apple-touch-icon and owns the
 * <link rel="manifest">: rider pages (/rider…) get the rider manifest
 * (start_url /rider), everything else the storefront one (start_url /boutique).
 */
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "@/lib/api";

const DEFAULT_FAVICON = "/icons/icon-192.png";

const isRiderPath = (pathname) =>
  pathname.startsWith("/rider") || (pathname === "/login" && localStorage.getItem("dina_app") === "rider");

const setMeta = (name, content) => {
  let m = document.querySelector(`meta[name="${name}"]`);
  if (!m) { m = document.createElement("meta"); m.setAttribute("name", name); document.head.appendChild(m); }
  m.setAttribute("content", content);
};

export default function BrandingBootstrapper() {
  const { pathname } = useLocation();
  const [site, setSite] = useState(null);
  const rider = isRiderPath(pathname);
  useEffect(() => {
    if (pathname.startsWith("/rider")) localStorage.setItem("dina_app", "rider");
    else if (pathname.startsWith("/console") || pathname.startsWith("/boutique")) localStorage.setItem("dina_app", "store");
    // iOS reads the manifest only at page load: entering the rider app via in-app navigation
    // (e.g. /login → /rider) needs one real reload so "Add to Home Screen" picks the rider manifest.
    if (pathname.startsWith("/rider") && window.__dinaRiderManifest === false) {
      window.__dinaRiderManifest = true;
      window.location.replace(window.location.href);
    }
  }, [pathname]);

  useEffect(() => {
    const load = () => api.get("/public/site").then((r) => setSite(r.data || {})).catch(() => setSite({}));
    load();
    window.addEventListener("branding-changed", load);
    return () => window.removeEventListener("branding-changed", load);
  }, []);

  useEffect(() => {
    if (!site) return;
    const logo = site.logo || DEFAULT_FAVICON;
    const fav = document.getElementById("dynamic-favicon");
    if (fav) fav.href = logo;
    const name = site.name || "Chez Dina";
    const appTitle = rider ? `${name} Livreur` : name;
    if (rider) document.title = appTitle;
    else if (site.name) document.title = `${site.name} — Boutique femme à Abidjan`;
    setMeta("apple-mobile-web-app-capable", "yes");
    setMeta("mobile-web-app-capable", "yes");
    setMeta("apple-mobile-web-app-title", appTitle);
    const base = rider ? "" : (process.env.REACT_APP_BACKEND_URL || "");
    const apple = document.getElementById("dynamic-apple-icon") || document.querySelector('link[rel="apple-touch-icon"]');
    if (apple) apple.href = rider ? `${base}/api/public/pwa-icon-rider/192` : logo;
    const manifest = document.getElementById("dynamic-manifest") || document.querySelector('link[rel="manifest"]');
    if (manifest) {
      if (!manifest.id) manifest.id = "dynamic-manifest";
      const bust = site.updated_at ? `?v=${encodeURIComponent(site.updated_at)}` : "";
      manifest.href = `${base}/api/public/${rider ? "manifest-rider" : "manifest"}.webmanifest${bust}`;
    }
  }, [site, rider]);

  return null;
}
