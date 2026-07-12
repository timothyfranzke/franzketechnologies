/*
 * Service worker for the Checkbook Ledger PWA (scope: /ledger/).
 *
 * Runtime caching only — hashed /_astro/* asset names change per build, so
 * instead of a build-time precache manifest we cache same-origin GET
 * responses as they're fetched (stale-while-revalidate). The app shell is
 * seeded at install so the app opens offline even after a single visit.
 */
const CACHE = 'ledger-v1';
const SHELL = ['/ledger/', '/ledger', '/ledger.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k.startsWith('ledger-')).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isShell = request.mode === 'navigate' || url.pathname.startsWith('/ledger');
  const isAsset = url.pathname.startsWith('/_astro/') || url.pathname.startsWith('/fonts/');
  if (!isShell && !isAsset) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const refresh = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || refresh;
    })
  );
});
