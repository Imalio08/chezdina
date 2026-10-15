/**
 * First-party analytics tracker.
 * No cookies set until user consents. Visitor id stored in localStorage.
 * Usage: track("page_view"), track("product_view", {product_id, value}), etc.
 */
import api from "./api";

const VKEY = "dina_vid";
const SKEY = "dina_sid";
const CKEY = "dina_consent";

function uuid() { return (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`); }
export function getVisitorId() {
  let id = localStorage.getItem(VKEY);
  if (!id) { id = uuid(); localStorage.setItem(VKEY, id); }
  return id;
}
function getSessionId() {
  let id = sessionStorage.getItem(SKEY);
  if (!id) { id = uuid(); sessionStorage.setItem(SKEY, id); }
  return id;
}
export function hasConsent() { return localStorage.getItem(CKEY) === "yes"; }
export function setConsent(v) { localStorage.setItem(CKEY, v ? "yes" : "no"); }
export function getConsent() { return localStorage.getItem(CKEY); }

export function track(name, extra = {}) {
  try {
    const consent = hasConsent();
    const utm = new URLSearchParams(window.location.search);
    const payload = {
      name,
      visitor_id: getVisitorId(),
      session_id: getSessionId(),
      page: window.location.pathname,
      source: document.referrer || "direct",
      utm_source: utm.get("utm_source") || null,
      utm_medium: utm.get("utm_medium") || null,
      utm_campaign: utm.get("utm_campaign") || null,
      device: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? "mobile" : "desktop",
      consent,
      ...extra,
    };
    api.post("/analytics/events", payload).catch(()=>{});
  } catch { /* ignore */ }
}
