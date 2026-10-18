// One scan = one action: the same code is ignored while it stays in front of the camera
// (it must leave the view for 1.5 s before it can be read again).
export function makeScanGate(holdMs = 1500) {
  const last = { code: "", seen: 0 };
  return (text) => {
    const now = Date.now();
    if (text === last.code && now - last.seen < holdMs) { last.seen = now; return false; }
    last.code = text; last.seen = now;
    return true;
  };
}

let ctx;
export function scanBeep(ok = true) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = ok ? 1250 : 320; o.type = ok ? "sine" : "square";
    g.gain.setValueAtTime(0.18, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (ok ? 0.15 : 0.35));
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + (ok ? 0.15 : 0.35));
    if (navigator.vibrate) navigator.vibrate(ok ? 60 : [80, 60, 80]);
  } catch { /* no audio */ }
}
