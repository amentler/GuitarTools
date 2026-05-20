const CORE_PRECACHED_URLS = [
  'icons/icon.svg',
  'index.html',
  'tests/fixtures/chord-inventory.json',
  'js/lib/essentia/essentia-wasm.web.js',
  'js/lib/essentia/essentia-wasm.web.wasm',
  'js/lib/essentia/essentia.js-core.umd.js',
  'js/lib/onnxruntime/ort.min.js',
  'js/lib/onnxruntime/ort-wasm-simd-threaded.jsep.mjs',
  'js/lib/onnxruntime/ort-wasm-simd-threaded.jsep.wasm',
  'js/lib/onnxruntime/ort-wasm-simd-threaded.mjs',
  'js/lib/onnxruntime/ort-wasm-simd-threaded.wasm',
  'js/components/gt-analysis-flyout.js',
  'js/shared/globalSettings.js',
  'js/shared/trainingDataReviewCatalog.js',
  'js/shared/audio/offlineOnsetDetection.js',
  'js/shared/audio/offlineOnsetDetectionXGBoost.js',
  'js/shared/audio/liveXGBoostOnsetDetector.js',
  'js/shared/audio/onsetPipelineConfig.js',
  'js/shared/audio/pitchPipelineConfig.js',
  'js/shared/audio/xgboostFeatureExtractor.js',
  'js/tools/audioAnalyse/audioAnalyseSVGSeries.js',
  'js/tools/onsetTagger/onsetTaggerAnalysisFlyout.js',
  'js/tools/onsetTagger/onsetTaggerLoadMenu.js',
  'js/tools/onsetTagger/onsetTaggerOnsetList.js',
  'js/tools/onsetTagger/onsetTaggerPersistence.js',
  'js/shared/learning/srsLogic.js',
  'manifest.json',
  'js/data/android-firefox-training-review-catalog.json',
  'models/onset_detector_android_firefox.metrics.json',
  'models/onset_detector_android_firefox.onnx',
  'models/onset_detector_android_firefox.schema.json',
  'style.css',
  'version.txt',
];

const PAGE_PRECACHED_URLS = [
  'pages/akkord-trainer/index.html',
  'pages/akkord-trainer/bootstrap.js',
  'pages/akkord-trainer/style.css',
  'pages/akkord-uebersicht/index.html',
  'pages/akkord-uebersicht/bootstrap.js',
  'pages/akkord-uebersicht/style.css',
  'pages/akkordfolgen-trainer/index.html',
  'pages/akkordfolgen-trainer/bootstrap.js',
  'pages/akkordfolgen-trainer/style.css',
  'pages/chord-playing-essentia/index.html',
  'pages/chord-playing-essentia/bootstrap.js',
  'pages/chord-playing-essentia/style.css',
  'pages/chord-recorder/index.html',
  'pages/chord-recorder/bootstrap.js',
  'pages/chord-recorder/style.css',
  'pages/audio-analyse/index.html',
  'pages/audio-analyse/bootstrap.js',
  'pages/audio-analyse/style.css',
  'pages/fretboard-tone-recognition/index.html',
  'pages/fretboard-tone-recognition/bootstrap.js',
  'pages/fretboard-tone-recognition/style.css',
  'pages/guitar-tuner/index.html',
  'pages/guitar-tuner/bootstrap.js',
  'pages/guitar-tuner/style.css',
  'pages/metronome/index.html',
  'pages/metronome/bootstrap.js',
  'pages/metronome/style.css',
  'pages/note-playing/index.html',
  'pages/note-playing/bootstrap.js',
  'pages/note-playing/style.css',
  'pages/sheet-music-reading/index.html',
  'pages/sheet-music-reading/bootstrap.js',
  'pages/sheet-music-reading/style.css',
  'pages/ton-finder/index.html',
  'pages/ton-finder/bootstrap.js',
  'pages/ton-finder/style.css',
  'pages/onset-tagger/index.html',
  'pages/onset-tagger/bootstrap.js',
  'pages/onset-tagger/style.css',
  'pages/recordings/index.html',
  'pages/recordings/bootstrap.js',
  'pages/recordings/style.css',
  'pages/settings/index.html',
  'pages/settings/bootstrap.js',
  'pages/settings/style.css',
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
