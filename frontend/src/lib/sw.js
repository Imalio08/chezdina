/**
 * Register service worker + offer install prompt / web push opt-in.
 * Requires VAPID public key in process.env.REACT_APP_VAPID_PUBLIC_KEY for push subscription.
 */
let deferredInstall = null;

export function registerSW() {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstall = e; window.dispatchEvent(new Event("pwa-install-ready")); });
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
export const canInstall = () => !!deferredInstall;
export function listenInstallPrompt(onReady) {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstall = e;
    onReady?.(true);
  });
}
export async function triggerInstall() {
  if (!deferredInstall) return false;
  deferredInstall.prompt();
  const { outcome } = await deferredInstall.userChoice;
  deferredInstall = null;
  return outcome === "accepted";
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export async function subscribePush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return { ok: false, reason: "unsupported" };
  const vapid = process.env.REACT_APP_VAPID_PUBLIC_KEY;
  if (!vapid) return { ok: false, reason: "no_vapid" };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: perm };
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid) });
  return { ok: true, subscription: sub };
}
