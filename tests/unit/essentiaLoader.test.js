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
 * global – window.EssentiaWASM or window.Essentia – because of strict mode,
 * content-security-policy, or an Emscripten quirk. Without this test the bug
 * is invisible because desktop Chrome always sets the globals.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('essentiaLoader – getEssentia()', () => {
  let appendSpy;

  beforeEach(() => {
    vi.resetModules();
    delete globalThis.EssentiaWASM;
    delete globalThis.Essentia;
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
   *   wasmJsOk          – true → fire onload; false → fire onerror (404 / network failure)
   *   wasmJsSetsGlobal  – whether the script exposes window.EssentiaWASM
   *   wasmReadyRejects  – whether wasmModule.ready rejects (WASM compile failure)
   *   coreJsOk          – true → fire onload; false → fire onerror
   *   coreJsSetsGlobal  – whether the script exposes window.Essentia
   */
  function mockScripts({
    wasmJsOk         = true,
    wasmJsSetsGlobal = true,
    wasmReadyRejects = false,
    coreJsOk         = true,
    coreJsSetsGlobal = true,
  } = {}) {
    appendSpy = vi.spyOn(document.head, 'appendChild').mockImplementation((el) => {
      const src = typeof el.src === 'string' ? el.src : '';

      if (src.includes('essentia-wasm.web.js')) {
        if (!wasmJsOk) {
          setTimeout(() => el.onerror?.(new Error('net::ERR_FAILED')), 0);
          return el;
        }
        if (wasmJsSetsGlobal) {
          const readyPromise = wasmReadyRejects
            ? Promise.reject(new Error('WASM compile error'))
            : Promise.resolve();
          // Suppress unhandled-rejection warning before the loader's await captures it
          readyPromise.catch(() => {});
          globalThis.EssentiaWASM = vi.fn(() => ({ ready: readyPromise }));
        }
        setTimeout(() => el.onload?.(), 0);

      } else if (src.includes('essentia.js-core')) {
        if (!coreJsOk) {
          setTimeout(() => el.onerror?.(new Error('net::ERR_FAILED')), 0);
          return el;
        }
        if (coreJsSetsGlobal) {
          globalThis.Essentia = vi.fn(function MockEssentia() {});
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
    expect(result).toBeInstanceOf(globalThis.Essentia);
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

  it('rejects when essentia.js-core.umd.js fails to load (network / 404)', async () => {
    mockScripts({ coreJsOk: false });
    const { getEssentia } = await import('../../js/games/chordExerciseEssentia/essentiaLoader.js');
    await expect(getEssentia()).rejects.toThrow();
  });

  // ── Mobile Safari / CSP: script loads but global is not set ──────────────────

  it('rejects when EssentiaWASM global is not set after script load (mobile failure scenario)', async () => {
    // The script file downloads successfully (200 OK) but window.EssentiaWASM
    // is never defined – this is the observed failure on mobile Safari.
    // Calling window.EssentiaWASM() then throws TypeError.
    mockScripts({ wasmJsSetsGlobal: false });
    const { getEssentia } = await import('../../js/games/chordExerciseEssentia/essentiaLoader.js');
    await expect(getEssentia()).rejects.toThrow(TypeError);
  });

  it('rejects when Essentia global is not set after second script load', async () => {
    // new window.Essentia(wasmModule) throws TypeError if Essentia is undefined.
    mockScripts({ coreJsSetsGlobal: false });
    const { getEssentia } = await import('../../js/games/chordExerciseEssentia/essentiaLoader.js');
    await expect(getEssentia()).rejects.toThrow(TypeError);
  });

  // ── WASM compile / memory failure ────────────────────────────────────────────

  it('rejects when wasmModule.ready rejects (WASM compile or memory failure)', async () => {
    mockScripts({ wasmReadyRejects: true });
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
});
