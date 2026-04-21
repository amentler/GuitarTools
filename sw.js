// GuitarTools Service Worker
// Strategy mix:
// - Cache First: large essentia WASM assets
// - Network First: HTML/navigation and API
// - Stale While Revalidate: most static runtime assets

const CACHE_VERSION = 'v6';
const CACHE_PREFIX = 'guitartools';
const PRECACHE_NAME = `${CACHE_PREFIX}-precache-${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `${CACHE_PREFIX}-static-${CACHE_VERSION}`;
const PAGE_CACHE_NAME = `${CACHE_PREFIX}-pages-${CACHE_VERSION}`;
const API_CACHE_NAME = `${CACHE_PREFIX}-api-${CACHE_VERSION}`;

// Relative paths (no leading /) so they resolve correctly regardless of the
// GitHub Pages deployment base path (root / or subdirectory /GuitarTools/).
const PRECACHE_URLS = [
  'js/lib/essentia/essentia-wasm.web.js',
  'js/lib/essentia/essentia-wasm.web.wasm',
  'js/lib/essentia/essentia.js-core.umd.js',
  'pages/exercises/ton-finder.html',
  'pages/exercises/fretboard-tone-recognition.html',
  'pages/exercises/sheet-music-reading.html',
  'pages/exercises/akkord-trainer.html',
  'pages/exercises/note-playing.html',
  'pages/exercises/sheet-music-mic.html',
  'pages/exercises/chord-playing-essentia.html',
  'pages/exercises/akkordfolgen-trainer.html',
  'pages/tools/guitar-tuner.html',
  'pages/tools/metronome.html',
  'pages/tools/akkord-uebersicht.html',
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(PRECACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key.startsWith(`${CACHE_PREFIX}-`) && ![
              PRECACHE_NAME,
              STATIC_CACHE_NAME,
              PAGE_CACHE_NAME,
              API_CACHE_NAME,
            ].includes(key))
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then(response => {
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  });
  return cached || networkPromise;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error('Network unavailable and no cached response');
  }
}

async function cacheFirstWithBackgroundUpdate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    fetch(request)
      .then(response => {
        if (response && response.ok) {
          cache.put(request, response.clone());
        }
      })
      .catch(() => {});
    return cached;
  }

  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;

  const url = new URL(request.url);

  // Cache-first for essentia WASM files: they are pre-cached at install time
  // and are large (~2 MB total). Always re-fetching them would be unacceptable
  // on mobile networks. Serve from cache; update cache in the background when
  // a fresh response arrives from the network.
  if (url.pathname.includes('/js/lib/essentia/')) {
    event.respondWith(cacheFirstWithBackgroundUpdate(request, PRECACHE_NAME));
    return;
  }

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request, PAGE_CACHE_NAME));
    return;
  }

  if (url.pathname.includes('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE_NAME));
    return;
  }

  if (['style', 'script', 'image', 'font', 'audio', 'video'].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE_NAME));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE_NAME));
});
