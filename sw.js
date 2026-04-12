// GuitarTools Service Worker – no caching, always fetch fresh

const CACHE_VERSION = 'v2';
const CACHE_NAME = `guitartools-static-${CACHE_VERSION}`;

// No URLs are pre-cached. Every request goes directly to the network.
const PRECACHE_URLS = [];

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

  // Always bypass all caches: browser HTTP cache AND service worker cache.
  // cache:'no-store' tells the browser not to use its HTTP cache at all.
  event.respondWith(
    fetch(request, { cache: 'no-store' }).catch(() => {
      // If network fails, try to serve from any existing cache as fallback
      caches.match(request)
    })
  );
});
