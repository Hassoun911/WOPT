const CACHE_NAME = "hassoun-v3-20260825-local-prayer-offline-1";
const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const scoped = (path) => `${SCOPE_PATH}${path}` || "/";
const APP_SHELL = [
  scoped("/"),
  scoped("/quran/"),
  scoped("/school/"),
  scoped("/games/"),
  scoped("/events/"),
  scoped("/qibla/"),
  scoped("/more/"),
  scoped("/contact/"),
  scoped("/manifest.webmanifest?v=20260825-exact-2"),
  scoped("/hassoun-brand.svg?v=20260825-exact-2"),
  scoped("/notification-badge.png"),
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(APP_SHELL.map(async (url) => {
        try {
          await cache.add(url);
        } catch {
          // One optional route should never prevent the whole PWA from installing offline support.
        }
      }));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);

  // Same-origin navigations are network-first so published fixes appear quickly,
  // while the last successful page remains available when the device is offline.
  if (requestUrl.origin === self.location.origin && event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => {
          return (await caches.match(event.request)) || (await caches.match(scoped("/"))) || Response.error();
        })
    );
    return;
  }

  // Cache successful same-origin assets as they are used. This includes Next.js
  // JavaScript/CSS chunks, logo files and page resources needed for offline launch.
  if (requestUrl.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const network = fetch(event.request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            }
            return response;
          })
          .catch(() => cached || Response.error());
        return cached || network;
      })
    );
  }
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
    icon: scoped("/hassoun-brand.svg?v=20260825-exact-2"),
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
