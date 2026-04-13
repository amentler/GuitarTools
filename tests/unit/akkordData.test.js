import { describe, it, expect } from 'vitest';
import { CHORDS, CHORD_CATEGORIES, validateFingerData } from '../../js/data/akkordData.js';

describe('CHORD_CATEGORIES', () => {
  it('contains exactly the 4 expected category keys', () => {
    const keys = Object.keys(CHORD_CATEGORIES);
    expect(keys).toHaveLength(4);
    expect(keys).toContain('simplified');
    expect(keys).toContain('standard');
    expect(keys).toContain('extended');
    expect(keys).toContain('sus_add');
  });

  it('all chords in CHORD_CATEGORIES exist in CHORDS', () => {
    for (const [cat, names] of Object.entries(CHORD_CATEGORIES)) {
      for (const name of names) {
        expect(CHORDS, `Category "${cat}" references unknown chord "${name}"`).toHaveProperty(name);
      }
    }
  });
});

describe('CHORDS integrity', () => {
  it('all chords have exactly 6 entries with string numbers 1–6', () => {
    for (const [name, positions] of Object.entries(CHORDS)) {
      expect(positions, `${name}: must have 6 entries`).toHaveLength(6);
      const stringNums = positions.map(p => p.string).sort((a, b) => a - b);
      expect(stringNums, `${name}: string numbers must be 1–6`).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });

  it('finger is only set when fret > 0 and not muted', () => {
    for (const [name, positions] of Object.entries(CHORDS)) {
      for (const pos of positions) {
        if (pos.finger !== undefined) {
          expect(pos.muted, `${name} string ${pos.string}: finger must not be set on muted string`).toBeFalsy();
          expect(pos.fret, `${name} string ${pos.string}: finger must not be set on open string (fret 0)`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('finger values are exclusively 1, 2, 3, or 4', () => {
    for (const [name, positions] of Object.entries(CHORDS)) {
      for (const pos of positions) {
        if (pos.finger !== undefined) {
          expect([1, 2, 3, 4], `${name} string ${pos.string}: invalid finger value ${pos.finger}`).toContain(pos.finger);
        }
      }
    }
  });

  it('no finger set on muted strings', () => {
    for (const [name, positions] of Object.entries(CHORDS)) {
      for (const pos of positions) {
        if (pos.muted) {
          expect(pos.finger, `${name} string ${pos.string}: finger must not be set on muted string`).toBeUndefined();
        }
      }
    }
  });
});

describe('validateFingerData', () => {
  it('returns an empty array for valid CHORDS (no errors in production data)', () => {
    const errors = validateFingerData(CHORDS);
    expect(errors).toEqual([]);
  });

  it('detects invalid finger values (e.g. finger: 5)', () => {
    const badChords = {
      'TestChord': [
        { string: 6, fret: 2, finger: 5 },
        { string: 5, fret: 0 },
        { string: 4, fret: 0 },
        { string: 3, fret: 0 },
        { string: 2, fret: 0 },
        { string: 1, fret: 0 }
      ]
    };
    const errors = validateFingerData(badChords);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/invalid finger value 5/);
  });

  it('detects finger on open strings (fret: 0)', () => {
    const badChords = {
      'OpenFinger': [
        { string: 6, fret: 0, finger: 1 },
        { string: 5, fret: 0 },
        { string: 4, fret: 0 },
        { string: 3, fret: 0 },
        { string: 2, fret: 0 },
        { string: 1, fret: 0 }
      ]
    };
    const errors = validateFingerData(badChords);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/finger set on open string/);
  });
});
