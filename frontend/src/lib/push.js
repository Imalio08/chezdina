import api from "@/lib/api";
import { subscribePush } from "@/lib/sw";

export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export const pushGranted = () => pushSupported() && Notification.permission === "granted";

// Subscribe this device and register it on the server. endpoint: "/push/subscribe" (staff/rider) or "/public/account/push/subscribe" (customer)
export async function enablePush(endpoint, silent = false) {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  if (silent && Notification.permission !== "granted") return { ok: false, reason: "not_granted" };
  const r = await subscribePush();
  if (!r.ok) return r;
  await api.post(endpoint, { subscription: r.subscription.toJSON() });
  return { ok: true };
}

export const pushErrorText = (reason) => ({
  unsupported: "Sur iPhone, ajoutez d'abord Chez Dina à l'écran d'accueil (Partager › Sur l'écran d'accueil), puis activez les notifications depuis l'icône.",
  denied: "Notifications bloquées · autorisez-les dans les réglages du navigateur.",
  no_vapid: "Notifications push non configurées.",
}[reason] || "Activation impossible");
