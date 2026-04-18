// GuitarTools Service Worker – no caching, always fetch fresh
// Exception: essentia.js WASM files are pre-cached for offline support.

const CACHE_VERSION = 'v3';
const CACHE_NAME = `guitartools-static-${CACHE_VERSION}`;

// Essentia WASM files are large binaries; pre-cache them so the
// chord-exercise-essentia feature works offline after first load.
const PRECACHE_URLS = [
  '/js/lib/essentia/essentia-wasm.web.js',
  '/js/lib/essentia/essentia-wasm.web.wasm',
  '/js/lib/essentia/essentia.js-core.umd.js',
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

  // Always bypass all caches: browser HTTP cache AND service worker cache.
  // cache:'no-store' tells the browser not to use its HTTP cache at all.
  event.respondWith(
    fetch(request, { cache: 'no-store' }).catch(() => {
      // If network fails, try to serve from any existing cache as fallback
      caches.match(request)
    })
  );
});
