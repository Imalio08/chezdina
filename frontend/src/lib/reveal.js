// Bring the result of an action into view (smooth scroll if off-screen) and flash it briefly.
export function reveal(target, { flash = true, block = "center" } = {}) {
  setTimeout(() => {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 70 || r.bottom > window.innerHeight) el.scrollIntoView({ behavior: "smooth", block });
    if (el.matches?.("input,select,textarea")) el.focus({ preventScroll: true });
    if (!flash) return;
    el.classList.remove("dina-flash"); void el.offsetWidth; el.classList.add("dina-flash");
    setTimeout(() => el.classList.remove("dina-flash"), 1600);
  }, 80);
}
