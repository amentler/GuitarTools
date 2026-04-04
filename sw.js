// GuitarTools Service Worker – allowlist-only caching model

const CACHE_VERSION = 'v2';
const CACHE_NAME = `guitartools-static-${CACHE_VERSION}`;

// Only URLs explicitly listed here will be cached.
// By default, all other requests go directly to the network (no cache write).
const PRECACHE_URLS = [
  // Add paths here to enable caching for specific assets, e.g.:
  // '/index.html',
  // '/style.css',
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const reqUrl = new URL(request.url);
  const normalizedPath = reqUrl.pathname + reqUrl.search;

  // Check whether this URL is in the allowlist (absolute URL or path match)
  const isAllowlisted =
    PRECACHE_URLS.includes(request.url) || PRECACHE_URLS.includes(normalizedPath);

  if (!isAllowlisted) {
    // Not in allowlist: always bypass browser HTTP cache to guarantee fresh content
    event.respondWith(fetch(request, { cache: 'no-cache' }));
    return;
  }

  // Allowlisted: cache-first with network fallback and cache update
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request, { cache: 'no-cache' }).then(networkResponse => {
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return networkResponse;
      });
    })
  );
});
