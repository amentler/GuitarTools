import { describe, expect, it, vi } from 'vitest';
import { runChordDetectionSession } from '../../js/games/chordExerciseEssentia/essentiaChordDetection.js';
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
  });

  it.each([
    ['Dmaj7', 'Dmaj7/dmaj7.wav'],
    ['Gdim', 'Gdim/gdim.wav'],
    ['Gdim', 'Gdim/gdim_2.wav'],
    ['Hdim', 'Hdim/hdim.wav'],
  ])('markiert den zuletzt hochgeladenen Problemfall %s aus %s als nicht erkannt', async (chordName, wavFile) => {
    const result = await detectFromWav(chordName, wavFile);

    expect(
      result.isCorrect,
      `${wavFile}: near-UI bestMatch=${result.bestMatch}, confidence=${result.confidence.toFixed(3)}`,
    ).toBe(false);
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
    expect(result.wasm).toBe(false);
    expect(essentia.arrayToVector).not.toHaveBeenCalled();
  });
});
