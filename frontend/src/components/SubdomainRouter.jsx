// Subdomain-aware routing: chezdina.net → vitrine, console.chezdina.net → /console, livreur.chezdina.net → /rider.
// Runs on first mount; no-op on localhost/preview URLs.
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const CONSOLE_SUBS = ["console"];
const RIDER_SUBS = ["livreur", "rider"];

export default function SubdomainRouter() {
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname.toLowerCase();
    // Only act on real subdomains like <sub>.chezdina.{net,ci,com}
    const m = host.match(/^([a-z0-9-]+)\.chezdina\.(net|ci|com)$/);
    if (!m) return;
    const sub = m[1];
    const path = loc.pathname;
    if (CONSOLE_SUBS.includes(sub)) {
      if (path === "/" || path === "" || path.startsWith("/boutique") || path.startsWith("/rider")) {
        nav("/console", { replace: true });
      }
    } else if (RIDER_SUBS.includes(sub)) {
      if (path === "/" || path === "" || path.startsWith("/boutique") || path.startsWith("/console")) {
        nav("/rider", { replace: true });
      }
    } else if (sub === "www" || sub === "shop" || sub === "store") {
      if (path === "/" || path === "") nav("/boutique", { replace: true });
    }
  }, [nav, loc.pathname]);
  return null;
}
