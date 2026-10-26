/* Chez Dina Service Worker — push + install prompt infra
 * Push payload format: { title, body, url, badge, icon }
 */
/* global clients */
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => ![SHELL, STATIC, TILES].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });

// Offline: app shell (network-first), static bundles + map tiles (cache-first). API calls are handled by the app (IndexedDB).
const SHELL = "dina-shell-v2", STATIC = "dina-static-v2", TILES = "dina-tiles-v1";
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    event.respondWith(caches.open(TILES).then(async (c) => (await c.match(req)) || fetch(req).then((r) => { c.put(req, r.clone()); return r; })));
    return;
  }
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(SHELL).then((c) => c.put("/index.html", cp)); return r; })
      .catch(() => caches.open(SHELL).then((c) => c.match("/index.html"))));
    return;
  }
  if (url.pathname.startsWith("/static/") || /\.(png|svg|ico|json|woff2?)$/.test(url.pathname)) {
    event.respondWith(caches.open(STATIC).then(async (c) => (await c.match(req)) || fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; })));
  }
});

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
