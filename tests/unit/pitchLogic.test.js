import { describe, it, expect } from 'vitest';
import {
  frequencyToNote,
  isStandardTuningNote,
  getAdaptiveFftSize,
  analyzeInputLevel,
  STANDARD_TUNING,
  noteToFrequency,
  getCentsToTarget,
  detectPitch,
  buildAdaptiveThreshold,
  estimateNoiseFloorRms,
  hpsFromMagnitudes,
  GUITAR_MAX_FREQUENCY
} from '../../js/tools/guitarTuner/pitchLogic.js';

describe('frequencyToNote', () => {
  it('identifies A4 (440 Hz) correctly', () => {
    const result = frequencyToNote(440);
    expect(result.note).toBe('A');
    expect(result.octave).toBe(4);
    expect(result.cents).toBeCloseTo(0, 1);
  });

  it('identifies E2 (low E string, ~82.41 Hz)', () => {
    const result = frequencyToNote(82.41);
    expect(result.note).toBe('E');
    expect(result.octave).toBe(2);
  });

  it('identifies E4 (high E string, ~329.63 Hz)', () => {
    const result = frequencyToNote(329.63);
    expect(result.note).toBe('E');
    expect(result.octave).toBe(4);
  });
});

describe('isStandardTuningNote', () => {
  it('returns true for all six open string notes', () => {
    for (const { note, octave } of STANDARD_TUNING) {
      expect(isStandardTuningNote(note, octave)).toBe(true);
    }
  });

  it('returns false for a note not in standard tuning', () => {
    expect(isStandardTuningNote('C', 3)).toBe(false);
    expect(isStandardTuningNote('F', 4)).toBe(false);
  });
});

describe('noteToFrequency', () => {
  it('returns ~82.41 Hz for E2', () => {
    expect(noteToFrequency('E', 2)).toBeCloseTo(82.41, 1);
  });

  it('returns 440 Hz for A4', () => {
    expect(noteToFrequency('A', 4)).toBeCloseTo(440, 1);
  });

  it('returns ~329.63 Hz for E4', () => {
    expect(noteToFrequency('E', 4)).toBeCloseTo(329.63, 1);
  });
});

describe('getCentsToTarget', () => {
  it('returns 0 when detected equals target', () => {
    const freq = noteToFrequency('A', 4);
    expect(getCentsToTarget(freq, freq)).toBeCloseTo(0, 5);
  });

  it('returns a negative value when detected is lower than target', () => {
    const target = noteToFrequency('E', 2);
    const detected = noteToFrequency('D#', 2); // one semitone lower ≈ -100 cents
    expect(getCentsToTarget(detected, target)).toBeCloseTo(-100, 0);
  });

  it('returns a positive value when detected is higher than target', () => {
    const target = noteToFrequency('E', 2);
    const detected = noteToFrequency('F', 2); // one semitone higher ≈ +100 cents
    expect(getCentsToTarget(detected, target)).toBeCloseTo(100, 0);
  });
});

describe('getAdaptiveFftSize – 3-tier adaptive window', () => {
  it('returns 32768 for E2 range (≤90 Hz)', () => {
    expect(getAdaptiveFftSize(82)).toBe(32768);
  });

  it('returns 16384 for A2 range (90–160 Hz)', () => {
    expect(getAdaptiveFftSize(110)).toBe(16384);
  });

  it('returns 8192 for G3 range (>160 Hz)', () => {
    expect(getAdaptiveFftSize(196)).toBe(8192);
  });

  it('returns 16384 with no reference (safe default for free mode)', () => {
    expect(getAdaptiveFftSize(null)).toBe(16384);
    expect(getAdaptiveFftSize()).toBe(16384);
  });
});

describe('analyzeInputLevel', () => {
  it('rejects near-silence input', () => {
    const buffer = new Float32Array(256);
    const level = analyzeInputLevel(buffer);
    expect(level.isValid).toBe(false);
  });

  it('accepts normal signal levels without clipping', () => {
    const buffer = new Float32Array(256);
    for (let i = 0; i < buffer.length; i++) buffer[i] = Math.sin((2 * Math.PI * i) / 32) * 0.25;
    const level = analyzeInputLevel(buffer);
    expect(level.isValid).toBe(true);
  });
});

describe('estimateNoiseFloorRms', () => {
  it('returns 0 for an empty array', () => {
    expect(estimateNoiseFloorRms([])).toBe(0);
  });

  it('returns the median of provided RMS values', () => {
    expect(estimateNoiseFloorRms([0.01, 0.02, 0.015])).toBeCloseTo(0.015);
  });
});

describe('buildAdaptiveThreshold', () => {
  it('uses GUITAR_MIN_RMS when noise floor is very low', () => {
    // 0.001 * 2.5 = 0.0025 < 0.008 → GUITAR_MIN_RMS wins
    expect(buildAdaptiveThreshold(0.001)).toBeCloseTo(0.008);
  });

  it('scales up threshold when noise floor is loud', () => {
    // 0.01 * 2.5 = 0.025 > 0.008 → scaled threshold used
    expect(buildAdaptiveThreshold(0.01)).toBeCloseTo(0.025);
  });
});

describe('hpsFromMagnitudes', () => {
  const SR = 44100;
  const FFT_SIZE = 16384;
  const BIN_HZ = SR / FFT_SIZE; // ≈ 2.69 Hz/Bin
  const HALF_BINS = FFT_SIZE / 2;

  function makeHarmonicSpectrum(fundamentalHz, harmonics = 3) {
    const mags = new Float32Array(HALF_BINS).fill(-100);
    for (let h = 1; h <= harmonics; h++) {
      const bin = Math.round((fundamentalHz * h) / BIN_HZ);
      if (bin < HALF_BINS) mags[bin] = h === 1 ? -10 : -20;
    }
    return mags;
  }

  it('detects E2 fundamental from harmonic spectrum', () => {
    const mags = makeHarmonicSpectrum(82.4);
    const hz = hpsFromMagnitudes(mags, BIN_HZ, 70, 420);
    expect(hz).not.toBeNull();
    expect(hz).toBeGreaterThan(75);
    expect(hz).toBeLessThan(92);
  });

  it('returns null for a flat noise spectrum', () => {
    const mags = new Float32Array(HALF_BINS).fill(-100);
    expect(hpsFromMagnitudes(mags, BIN_HZ, 70, 420)).toBeNull();
  });
});

describe('detectPitch – regression tests', () => {
  function synth(freq, sampleRate, samples, amp = 0.3) {
    const buf = new Float32Array(samples);
    for (let i = 0; i < samples; i++)
      buf[i] = amp * Math.sin(2 * Math.PI * freq * i / sampleRate);
    return buf;
  }

  it('detects E2 correctly with 32768-sample buffer', () => {
    const buf = synth(82.4, 44100, 32768);
    const hz = detectPitch(buf, 44100, { applyFilters: true });
    expect(hz).not.toBeNull();
    expect(hz).toBeGreaterThan(78);
    expect(hz).toBeLessThan(88);
  });

  it('detects G3 correctly with reduced 8192-sample buffer', () => {
    const buf = synth(196, 44100, 8192);
    const hz = detectPitch(buf, 44100, { applyFilters: true });
    expect(hz).not.toBeNull();
    expect(hz).toBeGreaterThan(186);
    expect(hz).toBeLessThan(206);
  });

  it('returns null for below-threshold signal', () => {
    const buf = synth(196, 44100, 8192, 0.001);
    expect(detectPitch(buf, 44100)).toBeNull();
  });

  it('detects B3 correctly – no subharmonic demotion to B2', () => {
    const buf = synth(246.94, 44100, 8192);
    const hz = detectPitch(buf, 44100, { applyFilters: true });
    expect(hz).not.toBeNull();
    const { note, octave } = frequencyToNote(hz);
    expect(note).toBe('B');
    expect(octave).toBe(3);
  });

  it('A2 detection has no HPS averaging bias (within 2 cents)', () => {
    const buf = synth(110, 44100, 32768);
    const hz = detectPitch(buf, 44100, { applyFilters: true });
    expect(hz).not.toBeNull();
    expect(Math.abs(1200 * Math.log2(hz / 110))).toBeLessThan(2);
  });
});

describe('GUITAR_MAX_FREQUENCY', () => {
  it('is 1000 Hz', () => {
    expect(GUITAR_MAX_FREQUENCY).toBe(1000);
  });
});
