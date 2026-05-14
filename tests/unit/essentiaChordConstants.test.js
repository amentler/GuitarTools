import { describe, it, expect } from 'vitest';
import {
  NOTE_TO_BIN,
  GERMAN_TO_BIN,
  TYPE_INTERVALS,
  DEFAULT_PROFILE,
  CHORD_TYPE_PROFILES,
  BASS_VARIANT_COUNTERPART,
  SUS_IDENTITY_COUNTERPART,
  OPEN_STRUM_BASE_BINS,
} from '../../js/games/chordExerciseEssentia/essentiaChordConstants.js';

describe('essentiaChordConstants – NOTE_TO_BIN', () => {
  it('has exactly 12 chromatic pitch classes', () => {
    expect(Object.keys(NOTE_TO_BIN)).toHaveLength(12);
  });
  it('maps C to bin 0 and B to bin 11', () => {
    expect(NOTE_TO_BIN.C).toBe(0);
    expect(NOTE_TO_BIN.B).toBe(11);
  });
});

describe('essentiaChordConstants – TYPE_INTERVALS', () => {
  it('contains expected chord types', () => {
    expect(TYPE_INTERVALS).toHaveProperty('Dur');
    expect(TYPE_INTERVALS).toHaveProperty('Moll');
    expect(TYPE_INTERVALS).toHaveProperty('7');
    expect(TYPE_INTERVALS).toHaveProperty('maj7');
    expect(TYPE_INTERVALS).toHaveProperty('m7');
  });
  it('Dur is [0,4,7] and Moll is [0,3,7]', () => {
    expect(TYPE_INTERVALS.Dur).toEqual([0, 4, 7]);
    expect(TYPE_INTERVALS.Moll).toEqual([0, 3, 7]);
  });
});

describe('essentiaChordConstants – GERMAN_TO_BIN', () => {
  it('maps C to 0 and H to 11', () => {
    expect(GERMAN_TO_BIN.C).toBe(0);
    expect(GERMAN_TO_BIN.H).toBe(11);
  });
});

describe('essentiaChordConstants – DEFAULT_PROFILE', () => {
  it('has required fields', () => {
    expect(DEFAULT_PROFILE).toHaveProperty('threshold');
    expect(DEFAULT_PROFILE).toHaveProperty('weights');
    expect(DEFAULT_PROFILE.weights).toHaveProperty('root');
    expect(DEFAULT_PROFILE.weights).toHaveProperty('supportMean');
  });
  it('threshold is between 0 and 1', () => {
    expect(DEFAULT_PROFILE.threshold).toBeGreaterThan(0);
    expect(DEFAULT_PROFILE.threshold).toBeLessThanOrEqual(1);
  });
});

describe('essentiaChordConstants – CHORD_TYPE_PROFILES', () => {
  it('contains extended chord types', () => {
    expect(CHORD_TYPE_PROFILES).toHaveProperty('7');
    expect(CHORD_TYPE_PROFILES).toHaveProperty('maj7');
    expect(CHORD_TYPE_PROFILES).toHaveProperty('m7');
  });
});

describe('essentiaChordConstants – BASS_VARIANT_COUNTERPART', () => {
  it('maps C-Dur ↔ C-Dur (1-Finger) bidirectionally', () => {
    expect(BASS_VARIANT_COUNTERPART['C-Dur']).toBe('C-Dur (1-Finger)');
    expect(BASS_VARIANT_COUNTERPART['C-Dur (1-Finger)']).toBe('C-Dur');
  });
});

describe('essentiaChordConstants – SUS_IDENTITY_COUNTERPART', () => {
  it('is symmetric (every mapping has an inverse)', () => {
    for (const [a, b] of Object.entries(SUS_IDENTITY_COUNTERPART)) {
      expect(SUS_IDENTITY_COUNTERPART[b]).toBe(a);
    }
  });
});

describe('essentiaChordConstants – OPEN_STRUM_BASE_BINS', () => {
  it('is a non-empty array of bin indices', () => {
    expect(Array.isArray(OPEN_STRUM_BASE_BINS)).toBe(true);
    expect(OPEN_STRUM_BASE_BINS.length).toBeGreaterThan(0);
    for (const b of OPEN_STRUM_BASE_BINS) {
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(12);
    }
  });
});
