import { describe, it, expect } from 'vitest';
import {
  clamp,
  computeEnvelope,
  timeToPixel,
  addOnset,
  removeOnset,
  buildSidecarWithOnsets,
  computePlayheadPosition,
  resolveRecordingFileBaseName,
} from '../../js/tools/onsetTagger/onsetTaggerLogic.js';

describe('clamp', () => {
  it('returns min when value is below min', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('returns max when value is above max', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('returns min when value equals min', () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it('returns max when value equals max', () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('computeEnvelope', () => {
  it('computes max and min for a single bucket', () => {
    const samples = new Float32Array([0.5, -0.5, 0.5, -0.5]);
    const { mins, maxs } = computeEnvelope(samples, 4, 0, 1, 1);
    expect(maxs[0]).toBeCloseTo(0.5);
    expect(mins[0]).toBeCloseTo(-0.5);
  });

  it('returns arrays with length equal to buckets', () => {
    const samples = new Float32Array(100);
    const { mins, maxs } = computeEnvelope(samples, 100, 0, 1, 10);
    expect(mins.length).toBe(10);
    expect(maxs.length).toBe(10);
  });

  it('returns empty arrays when range is zero or invalid', () => {
    const samples = new Float32Array([1, 2, 3]);
    const { mins, maxs } = computeEnvelope(samples, 3, 1, 1, 4);
    expect(mins.length).toBe(0);
    expect(maxs.length).toBe(0);
  });

  it('handles partial range correctly', () => {
    // 8 samples at 8 Hz → 1 second total; range [0, 0.5] → first 4 samples
    const samples = new Float32Array([1, 0, 0, 0, -1, 0, 0, 0]);
    const { maxs, mins } = computeEnvelope(samples, 8, 0, 0.5, 1);
    expect(maxs[0]).toBeCloseTo(1);
    expect(mins[0]).toBeCloseTo(0);
  });
});

describe('timeToPixel', () => {
  it('maps rangeStart to 0', () => {
    expect(timeToPixel(0, 0, 4, 1000)).toBe(0);
  });

  it('maps rangeEnd to plotWidth', () => {
    expect(timeToPixel(4, 0, 4, 1000)).toBe(1000);
  });

  it('maps midpoint correctly', () => {
    expect(timeToPixel(2, 0, 4, 1000)).toBeCloseTo(500);
  });

  it('clamps values below rangeStart to 0', () => {
    expect(timeToPixel(-1, 0, 4, 1000)).toBe(0);
  });

  it('clamps values above rangeEnd to plotWidth', () => {
    expect(timeToPixel(5, 0, 4, 1000)).toBe(1000);
  });
});

describe('addOnset', () => {
  it('adds an onset to an empty list', () => {
    expect(addOnset([], 1000)).toEqual([1000]);
  });

  it('inserts in sorted order', () => {
    expect(addOnset([500, 2000], 1000)).toEqual([500, 1000, 2000]);
  });

  it('appends to end when largest', () => {
    expect(addOnset([500, 1000], 2000)).toEqual([500, 1000, 2000]);
  });

  it('prepends when smallest', () => {
    expect(addOnset([1000, 2000], 100)).toEqual([100, 1000, 2000]);
  });

  it('ignores duplicate values', () => {
    expect(addOnset([500, 1000], 1000)).toEqual([500, 1000]);
  });

  it('does not mutate the original array', () => {
    const original = [500, 2000];
    addOnset(original, 1000);
    expect(original).toEqual([500, 2000]);
  });
});

describe('removeOnset', () => {
  it('removes the element at the given index', () => {
    expect(removeOnset([100, 200, 300], 1)).toEqual([100, 300]);
  });

  it('removes first element', () => {
    expect(removeOnset([100, 200, 300], 0)).toEqual([200, 300]);
  });

  it('removes last element', () => {
    expect(removeOnset([100, 200, 300], 2)).toEqual([100, 200]);
  });

  it('returns unchanged list for negative index', () => {
    expect(removeOnset([100, 200], -1)).toEqual([100, 200]);
  });

  it('returns unchanged list for out-of-bounds index', () => {
    expect(removeOnset([100, 200], 5)).toEqual([100, 200]);
  });

  it('does not mutate the original array', () => {
    const original = [100, 200, 300];
    removeOnset(original, 1);
    expect(original).toEqual([100, 200, 300]);
  });
});

describe('buildSidecarWithOnsets', () => {
  it('returns an object with all form values and onsetsMs', () => {
    const result = buildSidecarWithOnsets({ category: 'test', tempoBpm: 120 }, [100, 200]);
    expect(result).toEqual({ category: 'test', tempoBpm: 120, onsetsMs: [100, 200] });
  });

  it('overwrites an existing onsetsMs field', () => {
    const result = buildSidecarWithOnsets({ onsetsMs: [1, 2] }, [300, 400]);
    expect(result.onsetsMs).toEqual([300, 400]);
  });

  it('preserves all other fields unchanged', () => {
    const result = buildSidecarWithOnsets({ a: 1, b: 'x', c: [1, 2] }, []);
    expect(result.a).toBe(1);
    expect(result.b).toBe('x');
    expect(result.c).toEqual([1, 2]);
  });

  it('does not mutate the original formValues object', () => {
    const formValues = { category: 'open-strings' };
    buildSidecarWithOnsets(formValues, [100]);
    expect(formValues).toEqual({ category: 'open-strings' });
  });
});

describe('resolveRecordingFileBaseName', () => {
  it('uses the stored sheet-music baseName when available', () => {
    const result = resolveRecordingFileBaseName(
      'sheet-music',
      'legacy-id',
      { baseName: 'notenlesen_4-4_80bpm_EB_a3f2x' },
    );
    expect(result).toBe('notenlesen_4-4_80bpm_EB_a3f2x');
  });

  it('falls back to sheet-music id for legacy entries', () => {
    expect(resolveRecordingFileBaseName('sheet-music', 'last', {})).toBe('last');
  });

  it('keeps chord-recorder baseName unchanged', () => {
    const result = resolveRecordingFileBaseName(
      'chord-recorder',
      'gdur_finger_laut_single_abc12',
      {},
    );
    expect(result).toBe('gdur_finger_laut_single_abc12');
  });
});

describe('computePlayheadPosition', () => {
  it('returns initialOffset plus elapsed time', () => {
    // started at ctx time 0, now at ctx time 2, rate 1, range [0, 10], start offset 1
    const pos = computePlayheadPosition(0, 2, 1, 0, 10, 1);
    expect(pos).toBeCloseTo(3);
  });

  it('wraps around when position exceeds rangeEnd', () => {
    // started at ctx time 0, now at ctx time 8, rate 1, range [0, 5], start offset 2 → 10 mod 5 = 0 + rangeStart
    const pos = computePlayheadPosition(0, 8, 1, 0, 5, 2);
    expect(pos).toBeCloseTo(0);
  });

  it('applies playback rate to elapsed time', () => {
    // started at ctx time 0, now at ctx time 4, rate 0.5, range [0, 10], offset 0 → elapsed = 4*0.5 = 2
    const pos = computePlayheadPosition(0, 4, 0.5, 0, 10, 0);
    expect(pos).toBeCloseTo(2);
  });

  it('handles non-zero rangeStart', () => {
    // range [2, 7], offset 2 (=rangeStart), elapsed 1 at rate 1 → 3
    const pos = computePlayheadPosition(0, 1, 1, 2, 7, 2);
    expect(pos).toBeCloseTo(3);
  });

  it('wraps correctly with non-zero rangeStart', () => {
    // range [2, 7] → length 5; offset 2, elapsed 6 * rate 1 → (2 - 2 + 6) % 5 = 1 → 2 + 1 = 3
    const pos = computePlayheadPosition(0, 6, 1, 2, 7, 2);
    expect(pos).toBeCloseTo(3);
  });
});
