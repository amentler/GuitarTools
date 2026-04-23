import { describe, expect, it } from 'vitest';
import {
  normalizeFrequencyDataToPeak,
  normalizePeakMagnitudes,
} from '../../js/games/chordExerciseEssentia/essentiaChordDetection.js';

describe('essentiaChordDetection normalization', () => {
  it('normalizes live frequency data so the strongest finite bin is 0 dB', () => {
    const normalized = normalizeFrequencyDataToPeak(new Float32Array([-90, -42, -60, -Infinity]));

    expect(normalized[1]).toBeCloseTo(0);
    expect(normalized[0]).toBeCloseTo(-48);
    expect(normalized[2]).toBeCloseTo(-18);
    expect(normalized[3]).toBe(-Infinity);
  });

  it('returns an unchanged finite-length array when no finite frequency bins exist', () => {
    const normalized = normalizeFrequencyDataToPeak(new Float32Array([-Infinity, -Infinity]));

    expect(Array.from(normalized)).toEqual([-Infinity, -Infinity]);
  });

  it('normalizes peak magnitudes to unit max without averaging channels or changing ratios', () => {
    expect(normalizePeakMagnitudes([0.25, 0.5, 1])).toEqual([0.25, 0.5, 1]);
    expect(normalizePeakMagnitudes([2, 4, 8])).toEqual([0.25, 0.5, 1]);
  });

  it('handles empty and near-zero peak magnitudes', () => {
    expect(normalizePeakMagnitudes([])).toEqual([]);
    expect(normalizePeakMagnitudes([0, 0])).toEqual([0, 0]);
  });
});
