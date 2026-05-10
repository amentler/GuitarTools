/**
 * essentiaNodeWasmLoader.js
 *
 * Loads the Essentia WASM binary in a Node.js context for use in tests and
 * fingerprint scripts. Returns an initialised Essentia instance (with full
 * algorithm access) without any DOM, browser globals, or JS fallbacks.
 *
 * Loading strategy:
 *   1. Read essentia-wasm.web.js and the .wasm binary from disk (fs.readFileSync).
 *   2. Execute the Emscripten factory via vm.runInContext with a minimal
 *      sandbox that provides only what Node.js needs (no document / window
 *      beyond a stub for _scriptDir).
 *   3. Provide the binary via the `wasmBinary` option so Emscripten skips all
 *      XHR / fetch / readFile fetching and compiles directly.
 *   4. Load essentia.js-core.umd.js in a second vm context (needs EssentiaWASM
 *      as a global) to get the Essentia class wrapper with arrayToVector etc.
 *   5. Return a singleton: subsequent calls resolve immediately.
 */

import vm from 'vm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIB_DIR = path.resolve(__dirname, '../../js/lib/essentia');

let essentiaPromise = null;

function buildWasmSandbox(libDir) {
  return {
    module: { exports: {} },
    exports: {},
    __dirname: libDir,
    __filename: path.join(libDir, 'essentia-wasm.web.js'),
    // Suppress Essentia factory/algorithm registration logs
    console: { log: () => {}, error: () => {}, warn: () => {} },
    process,
    Buffer,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Promise,
    WebAssembly,
    TextDecoder,
    TextEncoder,
    // Minimal stub so Emscripten's scriptDir detection doesn't throw
    document: { currentScript: null },
    window: {},
  };
}

/**
 * Returns a fully initialised Essentia instance (singleton).
 * @returns {Promise<object>} Essentia instance with all algorithm methods
 */
export async function loadEssentiaForNode() {
  if (essentiaPromise) return essentiaPromise;

  essentiaPromise = (async () => {
    const wasmJsCode = fs.readFileSync(path.join(LIB_DIR, 'essentia-wasm.web.js'), 'utf8');
    const wasmBinary = fs.readFileSync(path.join(LIB_DIR, 'essentia-wasm.web.wasm'));
    const umdCode = fs.readFileSync(path.join(LIB_DIR, 'essentia.js-core.umd.js'), 'utf8');

    // Step 1: execute Emscripten factory, extract the factory function
    const wasmCtx = buildWasmSandbox(LIB_DIR);
    vm.createContext(wasmCtx);
    vm.runInContext(wasmJsCode, wasmCtx);
    const essentiaWasmFactory = wasmCtx.module.exports;
    if (typeof essentiaWasmFactory !== 'function') {
      throw new Error(`essentiaNodeWasmLoader: unexpected factory type '${typeof essentiaWasmFactory}'`);
    }

    // Step 2: instantiate the WASM module — wasmBinary avoids all network fetching
    const wasmModule = await essentiaWasmFactory({
      wasmBinary,
      locateFile: (f) => path.join(LIB_DIR, f),
    });

    if (typeof wasmModule.EssentiaJS !== 'function') {
      throw new Error('essentiaNodeWasmLoader: EssentiaJS not found on wasmModule');
    }

    // Step 3: load the Essentia algorithm wrapper (UMD module)
    const umdCtx = {
      module: { exports: {} },
      exports: {},
      console,
      // The UMD file references EssentiaWASM as a global in some code paths
      EssentiaWASM: wasmModule,
    };
    vm.createContext(umdCtx);
    vm.runInContext(umdCode, umdCtx);
    const EssentiaClass = umdCtx.module.exports;
    if (typeof EssentiaClass !== 'function') {
      throw new Error('essentiaNodeWasmLoader: Essentia class not exported from UMD module');
    }

    // Step 4: instantiate and return
    return new EssentiaClass(wasmModule);
  })();

  essentiaPromise.catch(() => {
    // Allow retry on failure
    essentiaPromise = null;
  });

  return essentiaPromise;
}
