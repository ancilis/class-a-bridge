const CACHE_PREFIX = "class-a-bridge-";
const CACHE_VERSION = "__CLASS_A_BRIDGE_CACHE_VERSION__";
const CACHE = `${CACHE_PREFIX}${CACHE_VERSION}`;
const PRECACHE = ["__CLASS_A_BRIDGE_PRECACHE__"];
const scopedUrl = (path) => new URL(path, self.registration.scope).toString();

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((path) => scopedUrl(path)))),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin || event.request.method !== "GET") return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // Static hosts may add `Vary: Origin`; precache requests and module requests then carry
      // different Origin headers even though the immutable same-origin URL is identical.
      const cached = await cache.match(event.request, { ignoreVary: true });
      if (cached) return cached;
      try {
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      } catch {
        const fallback =
          event.request.mode === "navigate"
            ? await cache.match(scopedUrl("./index.html"), { ignoreVary: true })
            : undefined;
        return fallback ?? Response.error();
      }
    })(),
  );
});
