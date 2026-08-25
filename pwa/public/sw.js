const CACHE_NAME = "hassoun-v2-20260825-web-icon-1";
const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const scoped = (path) => `${SCOPE_PATH}${path}` || "/";
const APP_SHELL = [
  scoped("/"),
  scoped("/quran/"),
  scoped("/manifest.webmanifest?v=20260825-web-icon-1"),
  scoped("/hassoun-logo.png?v=20260825-web-icon-1"),
  scoped("/icon-192.png?v=20260825-web-icon-1"),
  scoped("/icon-512.png?v=20260825-web-icon-1"),
  scoped("/notification-badge.png"),
  scoped("/maskable-icon-512.png?v=20260825-web-icon-1"),
  scoped("/apple-touch-icon.png?v=20260825-web-icon-1"),
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  if (event.request.method !== "GET" || requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match(scoped("/"))))
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "Prayer reminder" };
  }

  const receivedAtMs = Date.now();
  const title = data.title || "Hassoun";
  const options = {
    body: data.body || "Prayer time notification",
    icon: scoped("/hassoun-logo.png?v=20260825-web-icon-1"),
    badge: scoped("/notification-badge.png"),
    tag: data.eventId || `wopt-${data.prayer || "prayer"}-${data.kind || "alert"}`,
    renotify: true,
    silent: false,
    vibrate: data.kind === "athan" ? [300, 120, 300] : [180, 100, 180],
    requireInteraction: data.kind === "athan",
    data: {
      url: data.url ? scoped(data.url === "/" ? "/" : data.url) : scoped("/"),
      eventId: data.eventId,
      prayer: data.prayer,
      kind: data.kind,
      receivedAtMs,
    },
  };

  const show = self.registration.showNotification(title, options);
  const signalOpenClients = self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clients) => {
      for (const client of clients) {
        client.postMessage({
          type: "wopt-prayer-push",
          eventId: data.eventId,
          dateKey: data.dateKey,
          prayer: data.prayer,
          kind: data.kind,
          receivedAtMs,
        });
      }
    });

  event.waitUntil(Promise.all([show, signalOpenClients]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || scoped("/");
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client && new URL(client.url).pathname.startsWith(SCOPE_PATH || "/")) {
          if ("navigate" in client) void client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
    })
  );
});
