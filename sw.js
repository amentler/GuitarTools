// GuitarTools Service Worker – cache-first offline strategy

const CACHE_NAME = 'guitartools-v4';

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
  'https://cdn.jsdelivr.net/npm/vexflow@4.2.2/build/cjs/vexflow-min.js',
];

// Pre-cache all assets on install; wait for explicit SKIP_WAITING before activating
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
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

// Cache-first: serve from cache, fall back to network
self.addEventListener('fetch', event => {
  // Only handle same-origin GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
