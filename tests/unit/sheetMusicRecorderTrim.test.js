import { describe, it, expect } from 'vitest';
import { trimSilence } from '../../js/games/sheetMusicReading/sheetMusicRecorder.js';

const SR = 44100; // sample rate used in tests

function makeSilent(len) {
  return new Float32Array(len); // all zeros
}

function makeSignal(silenceBefore, signalLen, silenceAfter) {
  const total = silenceBefore + signalLen + silenceAfter;
  const ch = new Float32Array(total);
  for (let i = silenceBefore; i < silenceBefore + signalLen; i++) {
    ch[i] = 0.5;
  }
  return ch;
}

describe('trimSilence', () => {
  it('returns the original data unchanged when there is no silence', () => {
    const ch = new Float32Array(SR).fill(0.5);
    const result = trimSilence([ch], SR);
    expect(result[0].length).toBe(SR);
  });

  it('trims leading silence down to at most maxSilenceSeconds', () => {
    const silenceSamples = SR * 3; // 3 seconds of silence
    const signalSamples  = SR;
    const ch = makeSignal(silenceSamples, signalSamples, 0);

    const result = trimSilence([ch], SR, { maxSilenceSeconds: 1, threshold: 0.01 });
    // Should keep max 1s of leading silence
    expect(result[0].length).toBeLessThanOrEqual(signalSamples + SR + 10);
    expect(result[0].length).toBeGreaterThanOrEqual(signalSamples + 1);
  });

  it('trims trailing silence down to at most maxSilenceSeconds', () => {
    const signalSamples  = SR;
    const silenceSamples = SR * 3; // 3 seconds of trailing silence
    const ch = makeSignal(0, signalSamples, silenceSamples);

    const result = trimSilence([ch], SR, { maxSilenceSeconds: 1, threshold: 0.01 });
    expect(result[0].length).toBeLessThanOrEqual(signalSamples + SR + 10);
    expect(result[0].length).toBeGreaterThanOrEqual(signalSamples + 1);
  });

  it('does not trim when leading silence is already within limit', () => {
    const silenceSamples = Math.round(SR * 0.5); // 0.5s – below 1s limit
    const signalSamples  = SR;
    const ch = makeSignal(silenceSamples, signalSamples, 0);
    const originalLen = ch.length;

    const result = trimSilence([ch], SR, { maxSilenceSeconds: 1, threshold: 0.01 });
    expect(result[0].length).toBe(originalLen);
  });

  it('handles fully silent recording gracefully (returns input unchanged)', () => {
    const ch = makeSilent(SR * 5);
    const result = trimSilence([ch], SR);
    expect(result[0].length).toBe(ch.length);
  });

  it('applies the same trim bounds to all channels', () => {
    const silenceSamples = SR * 2;
    const signalSamples  = SR;
    const ch0 = makeSignal(silenceSamples, signalSamples, silenceSamples);
    const ch1 = makeSignal(silenceSamples, signalSamples, silenceSamples);

    const result = trimSilence([ch0, ch1], SR, { maxSilenceSeconds: 1, threshold: 0.01 });
    expect(result[0].length).toBe(result[1].length);
  });

  it('respects a custom threshold', () => {
    // Signal at 0.1 in last second – preceded by 2 seconds of silence.
    const ch = new Float32Array(SR * 3);
    for (let i = SR * 2; i < SR * 3; i++) ch[i] = 0.1;

    const resultStrict = trimSilence([ch], SR, { maxSilenceSeconds: 1, threshold: 0.5 });
    // Entire signal is below 0.5 → treated as fully silent → no trimming
    expect(resultStrict[0].length).toBe(ch.length);

    const resultSensitive = trimSilence([ch], SR, { maxSilenceSeconds: 1, threshold: 0.05 });
    // Signal 0.1 > 0.05, 2s leading silence → trimmed to max 1s → shorter
    expect(resultSensitive[0].length).toBeLessThan(ch.length);
  });
});
