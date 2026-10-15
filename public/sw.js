/* Only the offline document is cached. Never cache sensor, API, RSC or camera responses. */
const CACHE = "weather-ultra-offline-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add("/offline.html")),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter(
                (key) =>
                  key.startsWith("weather-ultra-offline-") && key !== CACHE,
              )
              .map((key) => caches.delete(key)),
          ),
        ),
      self.clients.claim(),
    ]),
  );
});
self.addEventListener("fetch", (event) => {
  if (
    event.request.mode !== "navigate" ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  event.respondWith(
    fetch(event.request).catch(
      async () =>
        (await caches.match("/offline.html")) ||
        new Response("Weather Ultra: mất kết nối", {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }),
    ),
  );
});
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {
    /* A notification is still shown for malformed payloads. */
  }
  event.waitUntil(
    self.registration.showNotification(
      typeof data.title === "string" ? data.title : "Weather Ultra",
      {
        body:
          typeof data.body === "string"
            ? data.body
            : "Có cập nhật mới từ trạm của bạn.",
        icon: "/icons/icon-192.png",
        badge: "/icons/badge.png",
        tag: typeof data.tag === "string" ? data.tag : "weather-ultra",
        data: { url: typeof data.url === "string" ? data.url : "/" },
      },
    ),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let url = new URL("/", self.location.origin);
  try {
    const candidate = new URL(
      event.notification.data?.url || "/",
      self.location.origin,
    );
    if (candidate.origin === self.location.origin) url = candidate;
  } catch {}
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if (new URL(client.url).origin === url.origin && "focus" in client) {
          await client.navigate(url.href);
          return client.focus();
        }
      }
      return self.clients.openWindow(url.href);
    })(),
  );
});
