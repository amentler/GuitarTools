import { describe, it, expect } from 'vitest';
import { CHORDS, CHORD_CATEGORIES, validateFingerData } from '../../js/data/akkordData.js';
import { getChordNotes } from '../../js/games/chordExercise/chordDetectionLogic.js';

function pitchClasses(chordName) {
  return [...new Set(getChordNotes(chordName).map(n => n.note))].sort();
}

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

describe('Dim-Akkorde – Pitch-Klassen', () => {
  it('Adim enthält A, C, D# (kein D oder E)', () => {
    const pc = pitchClasses('Adim');
    expect(pc).toContain('A');
    expect(pc).toContain('C');
    expect(pc).toContain('D#');
    expect(pc).not.toContain('D');
    expect(pc).not.toContain('E');
  });

  it('Hdim enthält B, D, F', () => {
    const pc = pitchClasses('Hdim');
    expect(pc).toContain('B');
    expect(pc).toContain('D');
    expect(pc).toContain('F');
  });

  it('Cdim enthält C, D#, F#', () => {
    const pc = pitchClasses('Cdim');
    expect(pc).toContain('C');
    expect(pc).toContain('D#');
    expect(pc).toContain('F#');
  });

  it('Ddim enthält D, F, G# (kein B)', () => {
    const pc = pitchClasses('Ddim');
    expect(pc).toContain('D');
    expect(pc).toContain('F');
    expect(pc).toContain('G#');
    expect(pc).not.toContain('B');
  });

  it('Edim enthält E, G, A# (kein B)', () => {
    const pc = pitchClasses('Edim');
    expect(pc).toContain('E');
    expect(pc).toContain('G');
    expect(pc).toContain('A#');
    expect(pc).not.toContain('B');
  });

  it('Fdim enthält F, G#, B (kein E)', () => {
    const pc = pitchClasses('Fdim');
    expect(pc).toContain('F');
    expect(pc).toContain('G#');
    expect(pc).toContain('B');
    expect(pc).not.toContain('E');
  });

  it('Gdim enthält G, A#, C# (kein B oder E)', () => {
    const pc = pitchClasses('Gdim');
    expect(pc).toContain('G');
    expect(pc).toContain('A#');
    expect(pc).toContain('C#');
    expect(pc).not.toContain('B');
    expect(pc).not.toContain('E');
  });
});

describe('Add9-Akkorde – Pitch-Klassen', () => {
  it('Gadd9 enthält G, B, D UND A (die Quinte und die Add9)', () => {
    const pc = pitchClasses('Gadd9');
    expect(pc).toContain('G');
    expect(pc).toContain('B');
    expect(pc).toContain('D');
    expect(pc).toContain('A');
  });

  it('Cadd9 enthält C, E, G, D', () => {
    const pc = pitchClasses('Cadd9');
    expect(pc).toContain('C');
    expect(pc).toContain('E');
    expect(pc).toContain('G');
    expect(pc).toContain('D');
  });

  it('Eadd9 enthält E, G#, B, F# (die Add9)', () => {
    const pc = pitchClasses('Eadd9');
    expect(pc).toContain('E');
    expect(pc).toContain('G#');
    expect(pc).toContain('B');
    expect(pc).toContain('F#');
  });

  it('Aadd9 enthält A, C#, E, B (die Add9)', () => {
    const pc = pitchClasses('Aadd9');
    expect(pc).toContain('A');
    expect(pc).toContain('C#');
    expect(pc).toContain('E');
    expect(pc).toContain('B');
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
