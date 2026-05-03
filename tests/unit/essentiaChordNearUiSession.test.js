import { describe, expect, it, vi } from 'vitest';
import { runChordDetectionSession } from '../../js/games/chordExerciseEssentia/essentiaChordDetection.js';
import { CHORD_DETECTION_PATHS } from '../../js/games/chordExerciseEssentia/chordDetectionPaths.js';
import {
  createAdvancingWait,
  createFakeChordDetectionAnalyserFromWav,
} from '../helpers/fakeChordDetectionAnalyser.js';

async function detectFromWav(chordName, wavFile) {
  const analyser = createFakeChordDetectionAnalyserFromWav(wavFile);
  return runChordDetectionSession({
    chordName,
    analyserNode: analyser,
    sampleRate: analyser.sampleRate,
    wait: createAdvancingWait(analyser),
    essentia: null,
  });
}

describe('runChordDetectionSession – near-UI WAV regression', () => {
  it.each([
    ['Adim', 'Adim/adim_2.wav'],
    ['Fm7', 'Fm7/fm7.wav'],
    ['Gm7', 'Gm7/gm7.wav'],
  ])('erkennt %s aus %s im produktiven Session-Pfad', async (chordName, wavFile) => {
    const result = await detectFromWav(chordName, wavFile);

    expect(
      result.isCorrect,
      `${wavFile}: near-UI bestMatch=${result.bestMatch}, confidence=${result.confidence.toFixed(3)}`,
    ).toBe(true);
    expect(result.detectionPath).toBe(CHORD_DETECTION_PATHS.ESSENTIA);
  });

  it.each([
    ['Dmaj7', 'Dmaj7/dmaj7.wav'],
    ['Hdim', 'Hdim/hdim.wav'],
  ])('bleibt für %s aus %s im Essentia-Routing ohne WASM weiterhin negativ', async (chordName, wavFile) => {
    const result = await detectFromWav(chordName, wavFile);

    expect(
      result.isCorrect,
      `${wavFile}: near-UI bestMatch=${result.bestMatch}, confidence=${result.confidence.toFixed(3)}`,
    ).toBe(false);
    expect(result.detectionPath).toBe(CHORD_DETECTION_PATHS.ESSENTIA);
  });

  it.each([
    ['Gdim', 'Gdim/gdim.wav'],
    ['Gdim', 'Gdim/gdim_2.wav'],
  ])('nutzt für %s aus %s den getrennten Essentia-Produktivpfad', async (chordName, wavFile) => {
    const result = await detectFromWav(chordName, wavFile);

    expect(typeof result.isCorrect, `${wavFile}: near-UI bestMatch=${result.bestMatch}, confidence=${result.confidence.toFixed(3)}`).toBe('boolean');
    expect(result.detectionPath).toBe(CHORD_DETECTION_PATHS.ESSENTIA);
  });

  it('erzwingt Pure JS auch dann, wenn ein Essentia-Objekt übergeben wurde', async () => {
    const analyser = createFakeChordDetectionAnalyserFromWav('Adim/adim_2.wav');
    const essentia = {
      arrayToVector: vi.fn(() => {
        throw new Error('Essentia darf im Pure-JS-Modus nicht verwendet werden');
      }),
    };

    const result = await runChordDetectionSession({
      chordName: 'Adim',
      analyserNode: analyser,
      sampleRate: analyser.sampleRate,
      wait: createAdvancingWait(analyser),
      essentia,
      preferEssentia: false,
    });

    expect(result.isCorrect, `Pure JS bestMatch=${result.bestMatch}, confidence=${result.confidence.toFixed(3)}`).toBe(true);
    expect(result.detectionPath).toBe(CHORD_DETECTION_PATHS.PURE_JS);
    expect(result.wasm).toBe(false);
    expect(essentia.arrayToVector).not.toHaveBeenCalled();
  });
});
