// GuitarTools Service Worker – network-first offline strategy

const CACHE_NAME = 'guitartools-v7';

// Derive base path from SW location so it works both at / and /GuitarTools/
const BASE = self.location.pathname.replace('sw.js', '');

const ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'style.css',
  BASE + 'manifest.json',
  BASE + 'icons/icon.svg',
  BASE + 'js/app.js',
  BASE + 'js/games/fretboardToneRecognition/fretboardExercise.js',
  BASE + 'js/games/fretboardToneRecognition/fretboardLogic.js',
  BASE + 'js/games/fretboardToneRecognition/fretboardSVG.js',
  BASE + 'js/tools/guitarTuner/guitarTuner.js',
  BASE + 'js/tools/guitarTuner/tunerLogic.js',
  BASE + 'js/tools/guitarTuner/tunerSVG.js',
  BASE + 'js/games/sheetMusicReading/sheetMusicReading.js',
  BASE + 'js/games/sheetMusicReading/sheetMusicLogic.js',
  BASE + 'js/games/sheetMusicReading/sheetMusicSVG.js',
  BASE + 'js/games/tonFinder/tonFinder.js',
  BASE + 'js/games/tonFinder/tonFinderLogic.js',
  BASE + 'js/games/tonFinder/tonFinderSVG.js',
  BASE + 'js/tools/metronome/metronome.js',
  BASE + 'js/tools/metronome/metronomeLogic.js',
  BASE + 'js/tools/metronome/metronomeSVG.js',
];

// CDN assets cached opportunistically – install won't fail if unreachable
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/vexflow@4.2.2/+esm',
];

// Pre-cache all assets on install; wait for explicit SKIP_WAITING before activating
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await cache.addAll(ASSETS);
      // Cache CDN assets if reachable – failure here doesn't block install
      await Promise.allSettled(CDN_ASSETS.map(url => cache.add(url)));
    })
  );
});

// Page sends this when the user taps the update button
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// Remove old caches on activate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Network-first: try the network, update the cache on success, fall back to cache when offline
self.addEventListener('fetch', event => {
  // Only handle same-origin GET requests
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone before consuming: one copy for the cache, one to return
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
