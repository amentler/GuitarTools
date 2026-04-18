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
 * @returns {Promise<object>} initialized EssentiaJS instance
 * @throws if WASM cannot be loaded or initialized
 */
export async function getEssentia() {
  if (essentiaInstance) return essentiaInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    // Fail fast before making any network requests if the browser has no WASM.
    if (typeof WebAssembly === 'undefined') {
      throw new Error('WebAssembly wird von diesem Browser nicht unterstützt.');
    }

    // Step 1: load the Emscripten WASM factory (creates window.EssentiaWASM)
    await loadScript(`${LIB_BASE}/essentia-wasm.web.js`);

    // Step 2: verify the global is a callable function before invoking it.
    // On mobile Safari / strict CSP the script may load (HTTP 200) but the
    // global is never set, causing a silent TypeError on the next line.
    if (typeof window.EssentiaWASM !== 'function') {
      throw new TypeError('EssentiaWASM is not a function — global not set after script load');
    }

    // Step 3: await the factory.  Emscripten module factories return a
    // thenable whose resolution is the fully-initialised module object.
    // Using `await` instead of the older `.ready` pattern works for both
    // the thenable form (Emscripten ≥ 3.1) and a plain Promise return.
    // locateFile gives Emscripten the absolute URL for the .wasm binary so
    // it works even when document.currentScript is null (dynamic script tag).
    const wasmModule = await window.EssentiaWASM({
      locateFile: (filename) => `${LIB_BASE}/${filename}`,
    });

    // Step 4: instantiate using the EssentiaJS class bundled inside the
    // WASM module itself — no separate essentia.js-core.umd.js required.
    if (typeof wasmModule?.EssentiaJS !== 'function') {
      throw new TypeError('EssentiaJS is not a function on wasmModule');
    }
    essentiaInstance = new wasmModule.EssentiaJS(wasmModule);
    return essentiaInstance;
  })();

  // Do NOT reset loadPromise on failure — keeping the rejected promise prevents
  // a second caller from re-fetching the 1.9 MB WASM binary unnecessarily.
  loadPromise.catch(err => console.error('[essentiaLoader] init failed:', err));

  return loadPromise;
}
