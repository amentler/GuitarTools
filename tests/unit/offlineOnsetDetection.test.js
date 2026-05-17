import { describe, expect, it } from 'vitest';
import { detectOnsetsOffline } from '../../js/shared/audio/offlineOnsetDetection.js';
import { GUITAR_ONSET_STRATEGY_KEYS } from '../../js/shared/audio/guitarOnsetStrategies.js';

const FFT_SIZE = 4096;
const SR = 44100;

function silence(frames = 1) {
  return new Float32Array(frames * FFT_SIZE);
}

function pseudoNoise(n, amplitude = 0.1) {
  const out = new Float32Array(n);
  let s = 12345;
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    out[i] = ((s >>> 1) / 0x40000000 - 1) * amplitude;
  }
  return out;
}

function spike(frames = 3) {
  const buf = new Float32Array(frames * FFT_SIZE);
  buf.set(pseudoNoise(FFT_SIZE, 0.1), FFT_SIZE);
  return buf;
}

describe('detectOnsetsOffline', () => {
  const legacyOptions = { strategyKey: GUITAR_ONSET_STRATEGY_KEYS.SWEEP_STANDARD };

  it('returns a Promise (is async)', () => {
    const result = detectOnsetsOffline(silence(), SR, legacyOptions);
    expect(result).toBeInstanceOf(Promise);
    return result;
  });

  it('silence yields no onsets', async () => {
    const result = await detectOnsetsOffline(new Float32Array(SR).fill(0), SR, legacyOptions);
    expect(result.onsetsMs).toEqual([]);
    expect(result.onsetsSec).toEqual([]);
  });

  it('amplitude spike after silence yields at least one onset', async () => {
    const result = await detectOnsetsOffline(spike(3), SR, legacyOptions);
    expect(result.onsetsMs.length).toBeGreaterThanOrEqual(1);
    const frameMs = (FFT_SIZE / SR) * 1000;
    expect(result.onsetsMs[0]).toBeGreaterThan(frameMs * 0.5);
  });

  it('onsetsMs are onsetsMs rounded from onsetsSec', async () => {
    const result = await detectOnsetsOffline(spike(3), SR, legacyOptions);
    const expected = result.onsetsSec.map(s => Math.round(s * 1000));
    expect(result.onsetsMs).toEqual(expected);
  });

  it('accepts strategyKey option without throwing', async () => {
    const result = await detectOnsetsOffline(silence(), SR, {
      strategyKey: 'guitar-onset-broadband-or',
    });
    expect(Array.isArray(result.onsetsMs)).toBe(true);
    expect(Array.isArray(result.onsetsSec)).toBe(true);
  });

  it('accepts custom fftSize option without throwing', async () => {
    const samples = new Float32Array(8192);
    const result = await detectOnsetsOffline(samples, SR, { ...legacyOptions, fftSize: FFT_SIZE });
    expect(Array.isArray(result.onsetsMs)).toBe(true);
  });
});
