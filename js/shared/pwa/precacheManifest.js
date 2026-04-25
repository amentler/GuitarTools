const CORE_PRECACHED_URLS = [
  'icons/icon.svg',
  'index.html',
  'js/lib/essentia/essentia-wasm.web.js',
  'js/lib/essentia/essentia-wasm.web.wasm',
  'js/lib/essentia/essentia.js-core.umd.js',
  'manifest.json',
  'style.css',
  'version.txt',
];

const PAGE_PRECACHED_URLS = [
  'pages/akkord-trainer/index.html',
  'pages/akkord-trainer/bootstrap.js',
  'pages/akkord-uebersicht/index.html',
  'pages/akkord-uebersicht/bootstrap.js',
  'pages/akkordfolgen-trainer/index.html',
  'pages/akkordfolgen-trainer/bootstrap.js',
  'pages/chord-playing-essentia/index.html',
  'pages/chord-playing-essentia/bootstrap.js',
  'pages/fretboard-tone-recognition/index.html',
  'pages/fretboard-tone-recognition/bootstrap.js',
  'pages/guitar-tuner/index.html',
  'pages/guitar-tuner/bootstrap.js',
  'pages/metronome/index.html',
  'pages/metronome/bootstrap.js',
  'pages/note-playing/index.html',
  'pages/note-playing/bootstrap.js',
  'pages/sheet-music-mic/index.html',
  'pages/sheet-music-mic/bootstrap.js',
  'pages/sheet-music-reading/index.html',
  'pages/sheet-music-reading/bootstrap.js',
  'pages/ton-finder/index.html',
  'pages/ton-finder/bootstrap.js',
];

const REQUIRED_URLS = [
  'index.html',
  'manifest.json',
];

function normalizeRelativeUrl(url) {
  return String(url ?? '')
    .trim()
    .replace(/^\.?\//, '');
}

function shouldExclude(url, excludeEntry) {
  if (typeof excludeEntry === 'string') return url === excludeEntry;
  if (excludeEntry instanceof RegExp) return excludeEntry.test(url);
  if (typeof excludeEntry === 'function') return excludeEntry(url);
  return false;
}

export function buildPrecacheManifest({
  coreUrls = CORE_PRECACHED_URLS,
  pageUrls = PAGE_PRECACHED_URLS,
  extraUrls = [],
  exclude = [],
} = {}) {
  const urls = [
    ...REQUIRED_URLS,
    ...coreUrls,
    ...pageUrls,
    ...extraUrls,
  ]
    .map(normalizeRelativeUrl)
    .filter(Boolean)
    .filter(url => !exclude.some(entry => shouldExclude(url, entry)));

  return [...new Set(urls)].sort();
}

export const PRECACHE_URLS = buildPrecacheManifest();
