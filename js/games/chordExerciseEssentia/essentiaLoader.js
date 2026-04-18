/**
 * essentiaLoader.js
 * Singleton loader for the essentia.js WASM backend.
 *
 * Loads essentia-wasm.web.js + essentia.js-core.umd.js via dynamic
 * <script> tags on first use, then caches the initialized Essentia instance.
 *
 * Files are served from /js/lib/essentia/ and pre-cached by the service
 * worker for offline use.
 */

const LIB_BASE = '/js/lib/essentia';

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
 *
 * @returns {Promise<InstanceType<window.Essentia>>}
 * @throws if WASM files cannot be loaded
 */
export async function getEssentia() {
  if (essentiaInstance) return essentiaInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      // Step 1: load the Emscripten WASM factory (creates window.EssentiaWASM)
      await loadScript(`${LIB_BASE}/essentia-wasm.web.js`);

      // Step 2: initialise the WASM module
      //   locateFile tells Emscripten where to fetch the .wasm binary
      const wasmModule = window.EssentiaWASM({
        locateFile: (path) => `${LIB_BASE}/${path}`,
      });
      await wasmModule.ready;

      // Step 3: load the high-level JS API (creates window.Essentia)
      await loadScript(`${LIB_BASE}/essentia.js-core.umd.js`);

      essentiaInstance = new window.Essentia(wasmModule);
      return essentiaInstance;
    } catch (err) {
      loadPromise = null; // allow retry after transient failure
      throw err;
    }
  })();

  return loadPromise;
}
