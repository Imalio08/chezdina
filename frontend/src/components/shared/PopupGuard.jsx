import { useEffect } from "react";

// Every popup closes with Escape or a click outside: uses the popup's own close button (or its backdrop handler)
const OVERLAY = "div.fixed.inset-0";
const isOverlay = (el) => el?.matches?.(OVERLAY) && /bg-black/.test(el.className) && !el.closest("[data-radix-portal],[role=dialog][data-state]");
const findClose = (el) => {
  const direct = el.querySelector('[aria-label="Fermer"],[data-testid$="-close"],[data-testid$="close"]');
  if (direct) return direct;
  const x = el.querySelector("button svg.lucide-x");
  if (x) return x.closest("button");
  return Array.from(el.querySelectorAll("button")).find(b => /^(Fermer|Annuler)$/i.test((b.textContent || "").trim())) || null;
};
const visibleOverlays = () => Array.from(document.querySelectorAll(OVERLAY)).filter(el => isOverlay(el) && getComputedStyle(el).display !== "none");

export default function PopupGuard() {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.querySelector("[role=dialog][data-state=open]")) return;
      const list = visibleOverlays();
      const top = list[list.length - 1];
      if (!top) return;
      const btn = findClose(top);
      if (btn) btn.click(); else top.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    };
    let downOn = null;
    const onDown = (e) => { downOn = e.target; };
    const onClick = (e) => {
      const el = e.target;
      if (!isOverlay(el) || downOn !== el) return;
      setTimeout(() => { if (el.isConnected) { const btn = findClose(el); btn?.click(); } }, 0);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("click", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown, true); document.removeEventListener("click", onClick); };
  }, []);
  return null;
}
