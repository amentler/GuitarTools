// @vitest-environment jsdom
/**
 * Tests for essentiaLoader.js – singleton WASM loader.
 *
 * Each test uses vi.resetModules() to get fresh module state (essentiaInstance
 * and loadPromise are reset). Script loading is mocked via document.head.appendChild
 * so no network requests are made.
 *
 * The most important failure mode tested here is the "mobile Safari scenario":
 * the script file loads (HTTP 200) but the browser does not expose the expected
 * global – window.EssentiaWASM – because of strict mode, content-security-policy,
 * or an Emscripten quirk. Without this test the bug is invisible because desktop
 * Chrome always sets the global.
 *
 * Initialization flow:
 *   1. loadScript(essentia-wasm.web.js) → sets window.EssentiaWASM
 *   2. typeof window.EssentiaWASM === 'function' guard
 *   3. const wasmModule = await window.EssentiaWASM({ locateFile })
 *   4. typeof wasmModule.EssentiaJS === 'function' guard
 *   5. essentiaInstance = new wasmModule.EssentiaJS(wasmModule)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('essentiaLoader – getEssentia()', () => {
  let appendSpy;

  beforeEach(() => {
    vi.resetModules();
    delete globalThis.EssentiaWASM;
  });

  afterEach(() => {
    appendSpy?.mockRestore();
    appendSpy = undefined;
  });

  /**
   * Intercept document.head.appendChild and simulate script loading
   * without touching the network.
   *
   * Options:
   *   wasmJsOk           – true → fire onload; false → fire onerror (404 / network failure)
   *   wasmJsSetsGlobal   – whether the script exposes window.EssentiaWASM
   *   wasmFactoryRejects – whether await EssentiaWASM() rejects (WASM compile failure)
   *   wasmHasEssentiaJS  – whether the resolved module object has an EssentiaJS constructor
   */
  function mockScripts({
    wasmJsOk           = true,
    wasmJsSetsGlobal   = true,
    wasmFactoryRejects = false,
    wasmHasEssentiaJS  = true,
  } = {}) {
    appendSpy = vi.spyOn(document.head, 'appendChild').mockImplementation((el) => {
      const src = typeof el.src === 'string' ? el.src : '';

      if (src.includes('essentia-wasm.web.js')) {
        if (!wasmJsOk) {
          setTimeout(() => el.onerror?.(new Error('net::ERR_FAILED')), 0);
          return el;
        }
        if (wasmJsSetsGlobal) {
          const MockEssentiaJS = vi.fn(function MockEssentiaJS() {});
          const resolvedModule = wasmHasEssentiaJS ? { EssentiaJS: MockEssentiaJS } : {};
          const factoryResult = wasmFactoryRejects
            ? Promise.reject(new Error('WASM compile error'))
            : Promise.resolve(resolvedModule);
          // Suppress unhandled-rejection warning before the loader's await captures it
          factoryResult.catch(() => {});
          globalThis.EssentiaWASM = vi.fn(() => factoryResult);
        }
        setTimeout(() => el.onload?.(), 0);
      }

      return el;
    });
  }

  // ── Happy path ───────────────────────────────────────────────────────────────

  it('resolves with an Essentia instance when all scripts load normally', async () => {
    mockScripts();
    const { getEssentia } = await import('../../js/games/chordExerciseEssentia/essentiaLoader.js');
    const result = await getEssentia();
    expect(result).toBeDefined();
    expect(result).not.toBeNull();
  });

  it('returns the same cached instance on subsequent calls after success', async () => {
    mockScripts();
    const { getEssentia } = await import('../../js/games/chordExerciseEssentia/essentiaLoader.js');
    const r1 = await getEssentia();
    const r2 = await getEssentia();
    expect(r1).toBe(r2);
    // Scripts injected only once
    expect(appendSpy.mock.calls.filter(([el]) => el.src?.includes('essentia-wasm.web.js'))).toHaveLength(1);
  });

  // ── Script network failures ──────────────────────────────────────────────────

  it('rejects when essentia-wasm.web.js fails to load (network / 404)', async () => {
    mockScripts({ wasmJsOk: false });
    const { getEssentia } = await import('../../js/games/chordExerciseEssentia/essentiaLoader.js');
    await expect(getEssentia()).rejects.toThrow();
  });

  // ── Mobile Safari / CSP: script loads but global is not set ──────────────────

  it('rejects when EssentiaWASM global is not set after script load (mobile failure scenario)', async () => {
    // The script file downloads successfully (200 OK) but window.EssentiaWASM
    // is never defined – this is the observed failure on mobile Safari.
    // The explicit typeof guard throws TypeError before any call is attempted.
    mockScripts({ wasmJsSetsGlobal: false });
    const { getEssentia } = await import('../../js/games/chordExerciseEssentia/essentiaLoader.js');
    await expect(getEssentia()).rejects.toThrow(TypeError);
  });

  it('rejects when EssentiaJS is not available on the resolved wasmModule', async () => {
    // EssentiaWASM() resolves successfully but the module object does not
    // expose EssentiaJS — wrong bundle version or build without JS bindings.
    mockScripts({ wasmHasEssentiaJS: false });
    const { getEssentia } = await import('../../js/games/chordExerciseEssentia/essentiaLoader.js');
    await expect(getEssentia()).rejects.toThrow(TypeError);
  });

  // ── WASM compile / memory failure ────────────────────────────────────────────

  it('rejects when EssentiaWASM factory promise rejects (WASM compile or memory failure)', async () => {
    mockScripts({ wasmFactoryRejects: true });
    const { getEssentia } = await import('../../js/games/chordExerciseEssentia/essentiaLoader.js');
    await expect(getEssentia()).rejects.toThrow('WASM compile error');
  });

  // ── No double fetch after failure ────────────────────────────────────────────

  it('second call after failure rejects immediately without re-injecting scripts', async () => {
    // Reproduces the double-WASM-fetch bug:
    // Before the fix, loadPromise was reset to null on failure, so the next
    // getEssentia() call would restart initialization and re-fetch the 1.9 MB
    // essentia-wasm.web.wasm binary. The "Hören" button triggered exactly this.
    mockScripts({ wasmJsSetsGlobal: false });
    const { getEssentia } = await import('../../js/games/chordExerciseEssentia/essentiaLoader.js');

    await expect(getEssentia()).rejects.toThrow();
    const injectionsAfterFirst = appendSpy.mock.calls.length;

    await expect(getEssentia()).rejects.toThrow();
    expect(appendSpy.mock.calls.length).toBe(injectionsAfterFirst);
  });

  // ── Concurrent calls ─────────────────────────────────────────────────────────

  it('concurrent calls share one load promise – scripts injected exactly once', async () => {
    mockScripts();
    const { getEssentia } = await import('../../js/games/chordExerciseEssentia/essentiaLoader.js');

    const [r1, r2] = await Promise.all([getEssentia(), getEssentia()]);
    expect(r1).toBe(r2);
    const wasmInjections = appendSpy.mock.calls.filter(([el]) =>
      el.src?.includes('essentia-wasm.web.js'),
    );
    expect(wasmInjections.length).toBe(1);
  });

  // ── EssentiaWASM factory throws synchronously ─────────────────────────────
  // Firefox for Android rejects WASM modules that contain atomic instructions
  // without SharedArrayBuffer (no COOP/COEP headers on GitHub Pages).
  // The essentia WASM binary has 1288 atomic-prefixed instructions (0xFE).
  // On Firefox Mobile the EssentiaWASM factory itself throws synchronously
  // (or the returned promise rejects with a CompileError / LinkError).

  it('rejects when EssentiaWASM factory throws synchronously (Firefox atomics error)', async () => {
    appendSpy = vi.spyOn(document.head, 'appendChild').mockImplementation((el) => {
      if (typeof el.src === 'string' && el.src.includes('essentia-wasm.web.js')) {
        globalThis.EssentiaWASM = vi.fn(() => {
          throw new Error('LinkError: WASM atomics require SharedArrayBuffer');
        });
        setTimeout(() => el.onload?.(), 0);
      }
      return el;
    });

    const { getEssentia } = await import('../../js/games/chordExerciseEssentia/essentiaLoader.js');
    await expect(getEssentia()).rejects.toThrow('LinkError: WASM atomics require SharedArrayBuffer');
  });

  it('rejects with the original error object, not a wrapper', async () => {
    const originalError = new WebAssembly.CompileError('Wasm decoding failed');
    appendSpy = vi.spyOn(document.head, 'appendChild').mockImplementation((el) => {
      if (typeof el.src === 'string' && el.src.includes('essentia-wasm.web.js')) {
        globalThis.EssentiaWASM = vi.fn(() => {
          const p = Promise.reject(originalError);
          p.catch(() => {});
          return p;
        });
        setTimeout(() => el.onload?.(), 0);
      }
      return el;
    });

    const { getEssentia } = await import('../../js/games/chordExerciseEssentia/essentiaLoader.js');
    await expect(getEssentia()).rejects.toBe(originalError);
  });

  // ── WebAssembly availability guard ───────────────────────────────────────────
  // If the browser doesn't expose WebAssembly at all (very old browser or CSP),
  // getEssentia() should reject immediately without making any network requests.

  it('rejects immediately when WebAssembly is not available – no scripts injected', async () => {
    const origWA = globalThis.WebAssembly;
    delete globalThis.WebAssembly;
    // Without a WebAssembly guard in essentiaLoader, getEssentia() would try to
    // load scripts. Mock appendChild to immediately fire onerror so the test
    // fails fast instead of timing out; after the guard is added no script is
    // injected at all and this mock is never called.
    appendSpy = vi.spyOn(document.head, 'appendChild').mockImplementation((el) => {
      setTimeout(() => el.onerror?.(new Error('no WebAssembly')), 0);
      return el;
    });

    try {
      const { getEssentia } = await import('../../js/games/chordExerciseEssentia/essentiaLoader.js');
      await expect(getEssentia()).rejects.toThrow(/WebAssembly/i);
      expect(appendSpy).not.toHaveBeenCalled(); // guard must fire before loadScript
    } finally {
      globalThis.WebAssembly = origWA;
    }
  });
});
