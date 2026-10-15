// Subdomain-aware routing: console.chezdina.net → /console, livreur.chezdina.net → /riders, www → vitrine (/).
// No-op on the main domain chezdina.net and on localhost/preview URLs.
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const CONSOLE_SUBS = ["console", "admin"];
const RIDER_SUBS = ["livreur", "rider", "riders"];

export default function SubdomainRouter() {
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    const m = host.match(/^([a-z0-9-]+)\.chezdina\.(net|ci|com)$/);
    if (!m) return;
    const sub = m[1];
    const path = loc.pathname;
    if (CONSOLE_SUBS.includes(sub) && !path.startsWith("/console")) nav("/console", { replace: true });
    else if (RIDER_SUBS.includes(sub) && !path.startsWith("/riders")) nav("/riders", { replace: true });
  }, [nav, loc.pathname]);
  return null;
}
