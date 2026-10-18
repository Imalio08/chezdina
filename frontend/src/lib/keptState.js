import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";

// useState kept for the browser tab: filters, tabs and searches survive going to a detail page and back
export function useKeptState(key, init) {
  const k = `kept:${key}`;
  const [v, setV] = useState(() => {
    try { const s = sessionStorage.getItem(k); if (s != null) return JSON.parse(s); } catch { /* ignore */ }
    return typeof init === "function" ? init() : init;
  });
  useEffect(() => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }, [k, v]);
  return [v, setV];
}

// Back to the previous screen (same filters, tab and scroll) or to the list when opened from a link
export function goBack(nav, fallback) {
  if ((window.history.state?.idx ?? 0) > 0) nav(-1); else nav(fallback);
}

// In-page detail view kept in the URL (?voir=id): the phone/browser back button returns to the list
export function useDetailParam(param = "voir") {
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const loc = useLocation();
  const value = sp.get(param);
  const set = (id) => {
    if (id) { const n = new URLSearchParams(sp); n.set(param, id); setSp(n, { state: { detailPushed: true } }); return; }
    if (loc.state?.detailPushed) { nav(-1); return; }
    const n = new URLSearchParams(sp); n.delete(param); setSp(n, { replace: true });
  };
  return [value, set];
}
