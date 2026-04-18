// GuitarTools Service Worker
// Exception: essentia.js WASM files use cache-first (large binaries, pre-cached).

const CACHE_VERSION = 'v4';
const CACHE_NAME = `guitartools-static-${CACHE_VERSION}`;

// Relative paths (no leading /) so they resolve correctly regardless of the
// GitHub Pages deployment base path (root / or subdirectory /GuitarTools/).
const PRECACHE_URLS = [
  'js/lib/essentia/essentia-wasm.web.js',
  'js/lib/essentia/essentia-wasm.web.wasm',
  'js/lib/essentia/essentia.js-core.umd.js',
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
  if (request.method !== 'GET') return;

  // Cache-first for essentia WASM files: they are pre-cached at install time
  // and are large (~2 MB total). Always re-fetching them would be unacceptable
  // on mobile networks. Serve from cache; update cache in the background when
  // a fresh response arrives from the network.
  if (new URL(request.url).pathname.includes('/js/lib/essentia/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
          return response;
        });
      })
    );
    return;
  }

  // Network-first for everything else; fall back to cache when offline.
  // (the missing `return` before caches.match is intentionally fixed here)
  event.respondWith(
    fetch(request, { cache: 'no-store' }).catch(() => caches.match(request))
  );
});
