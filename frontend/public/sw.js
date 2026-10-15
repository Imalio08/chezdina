/* Chez Dina Service Worker — push + install prompt infra
 * Push payload format: { title, body, url, badge, icon }
 */
/* global clients */
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { data = { title: "Chez Dina", body: event.data?.text?.() || "" }; }
  const title = data.title || "Chez Dina";
  const options = {
    body: data.body || "",
    icon: data.icon || "/favicon.ico",
    badge: data.badge || "/favicon.ico",
    data: { url: data.url || "/" },
    tag: data.tag || undefined,
    renotify: !!data.tag,
    vibrate: [200, 100, 200],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  const target = new URL(url, self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (list) => {
    const app = url.split("?")[0].split("/")[1] || "";
    const same = list.find((c) => new URL(c.url).pathname.split("/")[1] === app) || list[0];
    if (same && "focus" in same) {
      if (same.url !== target && "navigate" in same) { try { await same.navigate(target); } catch { /* cross-scope */ } }
      return same.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  }));
});
