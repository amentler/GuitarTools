// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { installEssentiaDetectionHarness } from '../helpers/essentiaDetectionHarness.js';

const getEssentiaMock = vi.fn(() => Promise.reject(new Error('WASM im Unit-Test deaktiviert')));

vi.mock('../../js/games/chordExerciseEssentia/essentiaLoader.js', () => ({
  getEssentia: getEssentiaMock,
}));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, '../fixtures/chords');

const CAGED_CASES = [
  { chordName: 'A-Dur', wavFile: 'A-Dur/amaj.wav' },
  { chordName: 'C-Dur', wavFile: 'C-Dur/c_chord.wav' },
  { chordName: 'D-Dur', wavFile: 'D-Dur/d_chord.wav' },
  { chordName: 'E-Dur', wavFile: 'E-Dur/emaj.wav' },
  { chordName: 'G-Dur', wavFile: 'G-Dur/g_chord.wav' },
];

describe('detectChordEssentia – typische CAGED-Akkorde', () => {
  const originalNavigator = globalThis.navigator;
  const originalAudioContext = globalThis.AudioContext;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    getEssentiaMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();

    if (originalNavigator === undefined) {
      delete globalThis.navigator;
    } else {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: originalNavigator,
      });
    }

    if (originalAudioContext === undefined) {
      delete globalThis.AudioContext;
    } else {
      globalThis.AudioContext = originalAudioContext;
    }

    if (typeof window !== 'undefined') {
      if (originalAudioContext === undefined) {
        delete window.AudioContext;
      } else {
        window.AudioContext = originalAudioContext;
      }
    }
  });

  for (const { chordName, wavFile } of CAGED_CASES) {
    it(`erkennt ${chordName} aus ${wavFile} über detectChordEssentia()`, async () => {
      installEssentiaDetectionHarness(path.join(FIXTURES, wavFile));

      const { detectChordEssentia } = await import('../../js/games/chordExerciseEssentia/essentiaChordDetection.js');
      const resultPromise = detectChordEssentia(chordName);

      await vi.advanceTimersByTimeAsync(1000);
      const result = await resultPromise;

      expect(getEssentiaMock).toHaveBeenCalledTimes(1);
      expect(result.wasm).toBe(false);
      expect(
        result.isCorrect,
        `${wavFile}: confidence=${result.confidence.toFixed(3)}, bestMatch=${result.bestMatch}`,
      ).toBe(true);
    });
  }

  it('lehnt einen falschen Zielakkord über detectChordEssentia() ab', async () => {
    installEssentiaDetectionHarness(path.join(FIXTURES, 'D-Dur/d_chord.wav'));

    const { detectChordEssentia } = await import('../../js/games/chordExerciseEssentia/essentiaChordDetection.js');
    const resultPromise = detectChordEssentia('G-Dur');

    await vi.advanceTimersByTimeAsync(1000);
    const result = await resultPromise;

    expect(result.wasm).toBe(false);
    expect(result.isCorrect).toBe(false);
    expect(result.bestMatch).toContain('D-Dur');
  });
});
