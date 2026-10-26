// Ask for a device permission only when a feature needs it, and never again once granted.
const KEY = (n) => `dina_perm_${n}`;

export async function permState(name) {
  try {
    const s = await navigator.permissions.query({ name });
    if (s.state === "granted") localStorage.setItem(KEY(name), "granted");
    return s.state;
  } catch { return localStorage.getItem(KEY(name)) || "prompt"; }
}

const remember = (name, ok) => { try { localStorage.setItem(KEY(name), ok ? "granted" : "denied"); } catch { /* ignore */ } };

/** Resolves coords or null. ask=false never triggers a browser prompt (used for background captures). */
export async function getPosition({ ask = true, ...opts } = {}) {
  if (!navigator.geolocation) return null;
  const st = await permState("geolocation");
  if (st === "denied" || (st !== "granted" && !ask)) return null;
  return new Promise((res) => navigator.geolocation.getCurrentPosition(
    (p) => { remember("geolocation", true); window.dispatchEvent(new Event("dina-gps-granted")); res(p.coords); },
    (e) => { if (e.code === e.PERMISSION_DENIED) remember("geolocation", false); res(null); },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000, ...opts }));
}

/** Watch only when already granted (no prompt). Returns a stop function. */
export async function watchIfGranted(onPos, opts = {}) {
  if (!navigator.geolocation || (await permState("geolocation")) !== "granted") return null;
  const id = navigator.geolocation.watchPosition((p) => onPos(p.coords), () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000, ...opts });
  return () => navigator.geolocation.clearWatch(id);
}

export const rememberCamera = () => remember("camera", true);
