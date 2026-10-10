// Tiny WebAudio chimes (no asset files). Browsers allow audio only after a first user gesture.
let ctx = null;
const getCtx = () => {
  if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
};
if (typeof window !== "undefined") {
  const unlock = () => { getCtx(); window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  window.addEventListener("pointerdown", unlock); window.addEventListener("keydown", unlock);
}

const TONES = {
  notif: [[880, 0, 0.12], [1320, 0.12, 0.16]],
  message: [[660, 0, 0.1], [990, 0.1, 0.1], [1320, 0.2, 0.18]],
  order: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.22]],
};

export const soundEnabled = () => localStorage.getItem("dina_sound") !== "off";
export const setSoundEnabled = (on) => localStorage.setItem("dina_sound", on ? "on" : "off");

export function playChime(kind = "notif", force = false) {
  if (!force && !soundEnabled()) return;
  const c = getCtx();
  if (!c || c.state !== "running") return;
  const t0 = c.currentTime;
  (TONES[kind] || TONES.notif).forEach(([f, at, dur]) => {
    const o = c.createOscillator(); const g = c.createGain();
    o.type = "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0 + at);
    g.gain.exponentialRampToValueAtTime(0.25, t0 + at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
    o.connect(g).connect(c.destination); o.start(t0 + at); o.stop(t0 + at + dur + 0.02);
  });
}
