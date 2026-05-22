import { describe, it, expect } from 'vitest';
import {
  clamp,
  computeRangeSliderState,
  computeEnvelope,
  computeSteppedZoomRange,
  constrainVisibleRange,
  timeToPixel,
  addOnset,
  addOnsetWithIndex,
  computeFocusedRange,
  removeOnset,
  mergeOnsetsWithMinDistance,
  moveOnset,
  buildSidecarWithOnsets,
  computePlayheadPosition,
  normalizeRecordingBaseName,
  resolveRecordingFileBaseName,
  applyTrainingRoleToBaseName,
  generateRecordingUid,
  extractRandomSuffix,
  buildGeneratedBaseName,
  normalizeSidecarFormat,
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

describe('constrainVisibleRange', () => {
  it('keeps a valid range unchanged', () => {
    expect(constrainVisibleRange(2, 8, 10, 'both', 0.01)).toEqual({ start: 2, end: 8 });
  });

  it('keeps the minimum window when the start handle meets the end handle', () => {
    expect(constrainVisibleRange(8, 8, 10, 'start', 0.01)).toEqual({ start: 7.99, end: 8 });
  });

  it('keeps the minimum window when the end handle meets the start handle', () => {
    expect(constrainVisibleRange(2, 2, 10, 'end', 0.01)).toEqual({ start: 2, end: 2.01 });
  });
});

describe('computeRangeSliderState', () => {
  it('uses the current end as the start slider maximum', () => {
    const state = computeRangeSliderState(2, 8, 10);
    expect(state.start).toEqual({ min: 0, max: 8, value: 2 });
  });

  it('uses the current start as the end slider minimum', () => {
    const state = computeRangeSliderState(2, 8, 10);
    expect(state.end).toEqual({ min: 2, max: 10, value: 8 });
  });
});

describe('computeSteppedZoomRange', () => {
  it('zooms in by ten percent of the visible distance on each side', () => {
    expect(computeSteppedZoomRange(2, 8, 10, 'in', 0.1, 0.01)).toEqual({
      start: 2.6,
      end: 7.4,
    });
  });

  it('unzooms by ten percent of the visible distance on each side', () => {
    expect(computeSteppedZoomRange(2, 8, 10, 'out', 0.1, 0.01)).toEqual({
      start: 1.4,
      end: 8.6,
    });
  });

  it('clamps unzoom to the recording boundaries', () => {
    expect(computeSteppedZoomRange(0.5, 9.5, 10, 'out', 0.1, 0.01)).toEqual({
      start: 0,
      end: 10,
    });
  });

  it('does not zoom past the minimum visible window', () => {
    const range = computeSteppedZoomRange(4.995, 5.005, 10, 'in', 0.1, 0.01);
    expect(range.end - range.start).toBeCloseTo(0.01);
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

describe('addOnsetWithIndex', () => {
  it('adds and returns the inserted sorted index', () => {
    expect(addOnsetWithIndex([500, 2000], 1000)).toEqual({
      onsetsMs: [500, 1000, 2000],
      index: 1,
    });
  });

  it('selects the existing index for exact duplicates', () => {
    expect(addOnsetWithIndex([500, 1000], 1000)).toEqual({
      onsetsMs: [500, 1000],
      index: 1,
    });
  });
});

describe('moveOnset', () => {
  it('moves an onset and keeps the list sorted', () => {
    expect(moveOnset([100, 500, 900], 1, 950)).toEqual({
      onsetsMs: [100, 900, 950],
      index: 2,
    });
  });

  it('returns unchanged list for an invalid index', () => {
    expect(moveOnset([100, 500], 3, 700)).toEqual({
      onsetsMs: [100, 500],
      index: -1,
    });
  });
});

describe('mergeOnsetsWithMinDistance', () => {
  it('adds incoming onsets that are at least the minimum distance away', () => {
    const result = mergeOnsetsWithMinDistance([1000], [800, 1100, 1300], 50);
    expect(result).toEqual({
      onsetsMs: [800, 1000, 1100, 1300],
      added: 3,
      skipped: 0,
    });
  });

  it('skips onsets closer than the minimum distance to existing or accepted onsets', () => {
    const result = mergeOnsetsWithMinDistance([1000], [1030, 1050, 1080], 50);
    expect(result).toEqual({
      onsetsMs: [1000, 1050],
      added: 1,
      skipped: 2,
    });
  });
});

describe('computeFocusedRange', () => {
  it('centers a one second range around the requested time', () => {
    expect(computeFocusedRange(2, 5, 1)).toEqual({ start: 1.5, end: 2.5 });
  });

  it('centers a narrower range around the requested time', () => {
    expect(computeFocusedRange(2, 5, 0.6)).toEqual({ start: 1.7, end: 2.3 });
  });

  it('keeps the range inside the recording duration', () => {
    expect(computeFocusedRange(0.1, 5, 1)).toEqual({ start: 0, end: 1 });
    expect(computeFocusedRange(4.9, 5, 1)).toEqual({ start: 4, end: 5 });
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
    expect(result.category).toBe('test');
    expect(result.tempoBpm).toBe(120);
    expect(result.onsetsMs).toEqual([100, 200]);
    expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
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

describe('normalizeRecordingBaseName', () => {
  it('strips supported file extensions and path separators', () => {
    expect(normalizeRecordingBaseName('../take one.wav')).toBe('take_one');
  });

  it('replaces unsafe characters', () => {
    expect(normalizeRecordingBaseName('a#m/down up.json')).toBe('a_m_down_up');
  });

  it('falls back when the input is empty', () => {
    expect(normalizeRecordingBaseName('', 'fallback.wav')).toBe('fallback');
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

describe('applyTrainingRoleToBaseName', () => {
  it('inserts role before last segment', () => {
    expect(applyTrainingRoleToBaseName('notenlesen_4_4_120bpm_abc12', 'train'))
      .toBe('notenlesen_4_4_120bpm_train_abc12');
  });

  it('inserts role before last segment for test', () => {
    expect(applyTrainingRoleToBaseName('notenlesen_4_4_120bpm_abc12', 'test'))
      .toBe('notenlesen_4_4_120bpm_test_abc12');
  });

  it('inserts validation role before last segment', () => {
    expect(applyTrainingRoleToBaseName('notenlesen_abc12', 'validation'))
      .toBe('notenlesen_validation_abc12');
  });

  it('replaces existing train role with test', () => {
    expect(applyTrainingRoleToBaseName('notenlesen_4_train_abc12', 'test'))
      .toBe('notenlesen_4_test_abc12');
  });

  it('removes role when empty string given', () => {
    expect(applyTrainingRoleToBaseName('notenlesen_4_train_abc12', ''))
      .toBe('notenlesen_4_abc12');
  });

  it('removes validation role when empty string given', () => {
    expect(applyTrainingRoleToBaseName('notenlesen_validation_abc12', ''))
      .toBe('notenlesen_abc12');
  });

  it('appends role when baseName has only one segment', () => {
    expect(applyTrainingRoleToBaseName('recording', 'train'))
      .toBe('recording_train');
  });

  it('returns baseName unchanged when no role and no existing token', () => {
    expect(applyTrainingRoleToBaseName('notenlesen_abc12', ''))
      .toBe('notenlesen_abc12');
  });

  it('random role removes existing token without inserting one', () => {
    expect(applyTrainingRoleToBaseName('notenlesen_4_train_abc12', 'random'))
      .toBe('notenlesen_4_abc12');
  });

  it('random role returns baseName unchanged when no existing token', () => {
    expect(applyTrainingRoleToBaseName('notenlesen_abc12', 'random'))
      .toBe('notenlesen_abc12');
  });
});

describe('generateRecordingUid', () => {
  it('returns a 12-char lowercase alphanumeric string', () => {
    const uid = generateRecordingUid();
    expect(uid).toMatch(/^[a-z0-9]{12}$/);
  });

  it('returns unique values', () => {
    const a = generateRecordingUid();
    const b = generateRecordingUid();
    expect(a).not.toBe(b);
  });
});

describe('extractRandomSuffix', () => {
  it('returns the last 5 alphanumeric characters', () => {
    expect(extractRandomSuffix('zhivfozfod0c')).toBe('fod0c');
  });

  it('strips non-alphanumeric chars before taking last 5', () => {
    expect(extractRandomSuffix('abc-def-xyz12')).toBe('xyz12');
  });

  it('works with a standard 12-char uid', () => {
    const uid = generateRecordingUid();
    const suffix = extractRandomSuffix(uid);
    expect(suffix).toHaveLength(5);
    expect(suffix).toMatch(/^[a-z0-9]+$/);
  });
});

describe('buildGeneratedBaseName', () => {
  it('formats as category_bpmBPM_suffix by default', () => {
    expect(buildGeneratedBaseName({ category: 'sheet-music-reading', bpm: 120 }, 'abc12'))
      .toBe('sheet-music-reading_120bpm_abc12');
  });

  it('omits role when trainingRole is random', () => {
    expect(buildGeneratedBaseName({ trainingRole: 'random', category: 'sheet-music-reading', bpm: 80 }, 'z1234'))
      .toBe('sheet-music-reading_80bpm_z1234');
  });

  it('includes role prefix when trainingRole is train', () => {
    expect(buildGeneratedBaseName({ trainingRole: 'train', category: 'sheet-music-reading', bpm: 100 }, 'a1b2c'))
      .toBe('train_sheet-music-reading_100bpm_a1b2c');
  });

  it('uses unknown when category is empty', () => {
    expect(buildGeneratedBaseName({ bpm: 60 }, 'xxxxx'))
      .toBe('unknown_60bpm_xxxxx');
  });
});

describe('normalizeSidecarFormat', () => {
  it('migrates tempoBpm to bpm when bpm is absent', () => {
    const result = normalizeSidecarFormat({ tempoBpm: 120 });
    expect(result.bpm).toBe(120);
    expect(result.tempoBpm).toBeUndefined();
  });

  it('keeps existing bpm when both bpm and tempoBpm are present', () => {
    const result = normalizeSidecarFormat({ bpm: 80, tempoBpm: 120 });
    expect(result.bpm).toBe(80);
    expect(result.tempoBpm).toBeUndefined();
  });

  it('removes tempoBpm even when bpm already present', () => {
    const result = normalizeSidecarFormat({ bpm: 100, tempoBpm: 200 });
    expect(result.tempoBpm).toBeUndefined();
  });

  it('preserves existing id', () => {
    const result = normalizeSidecarFormat({ id: 'abc123xyz000', bpm: 90 });
    expect(result.id).toBe('abc123xyz000');
  });

  it('generates id if missing', () => {
    const result = normalizeSidecarFormat({ bpm: 60 });
    expect(result.id).toMatch(/^[a-z0-9]{12}$/);
  });

  it('does not modify the original object', () => {
    const original = { tempoBpm: 120 };
    normalizeSidecarFormat(original);
    expect(original.tempoBpm).toBe(120);
  });
});

describe('buildSidecarWithOnsets (id/updatedAt behaviour)', () => {
  it('sets updatedAt as an ISO string', () => {
    const result = buildSidecarWithOnsets({ bpm: 100 }, [100, 200], { id: 'abc123xyz000' });
    expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('preserves id from meta', () => {
    const result = buildSidecarWithOnsets({ bpm: 80 }, [], { id: 'stableid12ab' });
    expect(result.id).toBe('stableid12ab');
  });

  it('preserves baseName from meta', () => {
    const result = buildSidecarWithOnsets({}, [500], { id: 'xyz', baseName: 'sheet-music-reading_80bpm_abc12' });
    expect(result.baseName).toBe('sheet-music-reading_80bpm_abc12');
  });

  it('id is stable across repeated calls with same meta', () => {
    const meta = { id: 'fixed1234567' };
    const r1 = buildSidecarWithOnsets({}, [100], meta);
    const r2 = buildSidecarWithOnsets({}, [200], meta);
    expect(r1.id).toBe(r2.id);
  });
});
