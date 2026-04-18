/**
 * essentiaLoader.js
 * Singleton loader for the essentia.js WASM backend.
 *
 * LIB_BASE is computed from import.meta.url so the paths are correct
 * regardless of the deployment base path (e.g. GitHub Pages subdirectory).
 */

// Resolve the lib directory relative to this module's location.
// essentiaLoader.js is at js/games/chordExerciseEssentia/essentiaLoader.js
// essentia libs are at  js/lib/essentia/
const LIB_BASE = new URL('../../lib/essentia', import.meta.url).href;

let essentiaInstance = null;
let loadPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`essentia: failed to load ${src}`));
    document.head.appendChild(s);
  });
}

/**
 * Returns the initialized Essentia instance (loads WASM on first call).
 * Subsequent calls return the cached instance immediately.
 * On failure the rejected promise is kept — no retry to avoid re-fetching the
 * 1.9 MB WASM binary a second time.
 *
 * @returns {Promise<InstanceType<window.Essentia>>}
 * @throws if WASM files cannot be loaded
 */
export async function getEssentia() {
  if (essentiaInstance) return essentiaInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    // Step 1: load the Emscripten WASM factory (creates window.EssentiaWASM)
    await loadScript(`${LIB_BASE}/essentia-wasm.web.js`);

    // Step 2: initialise the WASM module.
    // locateFile gives Emscripten the absolute URL for the .wasm binary so
    // it works even when document.currentScript is null (dynamic script tag).
    const wasmModule = window.EssentiaWASM({
      locateFile: (filename) => `${LIB_BASE}/${filename}`,
    });
    await wasmModule.ready;

    // Step 3: load the high-level JS API (creates window.Essentia)
    await loadScript(`${LIB_BASE}/essentia.js-core.umd.js`);

    essentiaInstance = new window.Essentia(wasmModule);
    return essentiaInstance;
  })();

  // Do NOT reset loadPromise on failure — keeping the rejected promise prevents
  // a second caller from re-fetching the 1.9 MB WASM binary unnecessarily.
  loadPromise.catch(err => console.error('[essentiaLoader] init failed:', err));

  return loadPromise;
}
