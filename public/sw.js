// Minimal service worker for the donor PWA bonus: caches the app shell for
// offline resilience and lets Notification clicks focus/open the app.
// Feature: Donor PWA (Person 3). Registered from app/donor/layout.tsx.
const CACHE_NAME = "raksharakt-donor-v1";
const SHELL_URLS = ["/donor", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => {
        // Don't fail install if the shell can't be pre-cached (e.g. offline
        // first install) - the SW still activates and caches opportunistically.
      })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Network-first for API calls (always want fresh data), cache-first for
// everything else so the shell still loads if the network drops mid-demo.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            return res;
          })
          .catch(() => cached)
    )
  );
});

// Focus/open the donor notifications tab when a background Notification is
// clicked (fired via Notification() from the notifications page, not real
// Web Push - no server push infra in this hackathon build).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes("/donor") && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow("/donor/notifications");
      }
    })
  );
});
