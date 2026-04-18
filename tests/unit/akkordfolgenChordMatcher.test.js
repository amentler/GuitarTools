import { describe, it, expect } from 'vitest';
import {
  parseChordName,
  getExpectedNoteClasses,
  matchDetectedNotes,
} from '../../js/games/akkordfolgenTrainer/akkordfolgenChordMatcher.js';

// ── parseChordName ────────────────────────────────────────────────────────────

describe('parseChordName', () => {
  it('parses C-Dur', () => {
    expect(parseChordName('C-Dur')).toEqual({ root: 'C', type: 'Dur' });
  });

  it('parses G-Dur', () => {
    expect(parseChordName('G-Dur')).toEqual({ root: 'G', type: 'Dur' });
  });

  it('parses Fis-Dur', () => {
    expect(parseChordName('Fis-Dur')).toEqual({ root: 'Fis', type: 'Dur' });
  });

  it('parses A-Moll', () => {
    expect(parseChordName('A-Moll')).toEqual({ root: 'A', type: 'Moll' });
  });

  it('parses H-Moll', () => {
    expect(parseChordName('H-Moll')).toEqual({ root: 'H', type: 'Moll' });
  });

  it('parses Es-Moll', () => {
    expect(parseChordName('Es-Moll')).toEqual({ root: 'Es', type: 'Moll' });
  });

  it('parses H-dim', () => {
    expect(parseChordName('H-dim')).toEqual({ root: 'H', type: 'dim' });
  });

  it('parses Fis-dim', () => {
    expect(parseChordName('Fis-dim')).toEqual({ root: 'Fis', type: 'dim' });
  });

  it('parses Eis-dim (E# = F, used in Fis-Dur scale)', () => {
    expect(parseChordName('Eis-dim')).toEqual({ root: 'Eis', type: 'dim' });
  });

  it('parses G7 (dominant 7th)', () => {
    expect(parseChordName('G7')).toEqual({ root: 'G', type: '7' });
  });

  it('parses C7', () => {
    expect(parseChordName('C7')).toEqual({ root: 'C', type: '7' });
  });

  it('strips annotation: H7 (B7) → root H, type 7', () => {
    expect(parseChordName('H7 (B7)')).toEqual({ root: 'H', type: '7' });
  });

  it('returns null for unknown chord name', () => {
    expect(parseChordName('X-Dur')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseChordName('')).toBeNull();
  });

  it('returns null for null', () => {
    expect(parseChordName(null)).toBeNull();
  });

  it('returns null for chord with unknown type', () => {
    expect(parseChordName('C-Weird')).toBeNull();
  });

  it('parses B-Dur (German B = Bb)', () => {
    expect(parseChordName('B-Dur')).toEqual({ root: 'B', type: 'Dur' });
  });

  it('parses Des-Dur (Db major)', () => {
    expect(parseChordName('Des-Dur')).toEqual({ root: 'Des', type: 'Dur' });
  });

  it('parses As-Dur (Ab major)', () => {
    expect(parseChordName('As-Dur')).toEqual({ root: 'As', type: 'Dur' });
  });
});

// ── getExpectedNoteClasses ────────────────────────────────────────────────────

describe('getExpectedNoteClasses', () => {
  // Natural major chords
  it('C-Dur → [C, E, G]', () => {
    expect(getExpectedNoteClasses('C-Dur')).toEqual(['C', 'E', 'G']);
  });

  it('G-Dur → [G, B, D]', () => {
    expect(getExpectedNoteClasses('G-Dur')).toEqual(['G', 'B', 'D']);
  });

  it('D-Dur → [D, F#, A]', () => {
    expect(getExpectedNoteClasses('D-Dur')).toEqual(['D', 'F#', 'A']);
  });

  it('A-Dur → [A, C#, E]', () => {
    expect(getExpectedNoteClasses('A-Dur')).toEqual(['A', 'C#', 'E']);
  });

  it('E-Dur → [E, G#, B]', () => {
    expect(getExpectedNoteClasses('E-Dur')).toEqual(['E', 'G#', 'B']);
  });

  it('F-Dur → [F, A, C]', () => {
    expect(getExpectedNoteClasses('F-Dur')).toEqual(['F', 'A', 'C']);
  });

  // Flat/sharp major chords
  it('B-Dur (German B = Bb) → [A#, D, F]', () => {
    expect(getExpectedNoteClasses('B-Dur')).toEqual(['A#', 'D', 'F']);
  });

  it('Es-Dur → [D#, G, A#]', () => {
    expect(getExpectedNoteClasses('Es-Dur')).toEqual(['D#', 'G', 'A#']);
  });

  it('As-Dur → [G#, C, D#]', () => {
    expect(getExpectedNoteClasses('As-Dur')).toEqual(['G#', 'C', 'D#']);
  });

  it('Des-Dur → [C#, F, G#]', () => {
    expect(getExpectedNoteClasses('Des-Dur')).toEqual(['C#', 'F', 'G#']);
  });

  it('Fis-Dur → [F#, A#, C#]', () => {
    expect(getExpectedNoteClasses('Fis-Dur')).toEqual(['F#', 'A#', 'C#']);
  });

  // Minor chords
  it('A-Moll → [A, C, E]', () => {
    expect(getExpectedNoteClasses('A-Moll')).toEqual(['A', 'C', 'E']);
  });

  it('E-Moll → [E, G, B]', () => {
    expect(getExpectedNoteClasses('E-Moll')).toEqual(['E', 'G', 'B']);
  });

  it('D-Moll → [D, F, A]', () => {
    expect(getExpectedNoteClasses('D-Moll')).toEqual(['D', 'F', 'A']);
  });

  it('H-Moll → [B, D, F#]', () => {
    expect(getExpectedNoteClasses('H-Moll')).toEqual(['B', 'D', 'F#']);
  });

  it('Fis-Moll → [F#, A, C#]', () => {
    expect(getExpectedNoteClasses('Fis-Moll')).toEqual(['F#', 'A', 'C#']);
  });

  it('G-Moll → [G, A#, D]', () => {
    expect(getExpectedNoteClasses('G-Moll')).toEqual(['G', 'A#', 'D']);
  });

  it('C-Moll → [C, D#, G]', () => {
    expect(getExpectedNoteClasses('C-Moll')).toEqual(['C', 'D#', 'G']);
  });

  // Diminished chords
  it('H-dim → [B, D, F]', () => {
    expect(getExpectedNoteClasses('H-dim')).toEqual(['B', 'D', 'F']);
  });

  it('Fis-dim → [F#, A, C]', () => {
    expect(getExpectedNoteClasses('Fis-dim')).toEqual(['F#', 'A', 'C']);
  });

  it('Cis-dim → [C#, E, G]', () => {
    expect(getExpectedNoteClasses('Cis-dim')).toEqual(['C#', 'E', 'G']);
  });

  it('E-dim → [E, G, A#]', () => {
    expect(getExpectedNoteClasses('E-dim')).toEqual(['E', 'G', 'A#']);
  });

  it('Eis-dim (E# dim, used in Fis-Dur scale) → [F, G#, B]', () => {
    // Eis = E# = F (chroma 5), diminished = [0,3,6], so [5,8,11] = F, G#, B
    expect(getExpectedNoteClasses('Eis-dim')).toEqual(['F', 'G#', 'B']);
  });

  // Dominant 7th chords
  it('G7 → [G, B, D, F]', () => {
    expect(getExpectedNoteClasses('G7')).toEqual(['G', 'B', 'D', 'F']);
  });

  it('C7 → [C, E, G, A#]', () => {
    expect(getExpectedNoteClasses('C7')).toEqual(['C', 'E', 'G', 'A#']);
  });

  it('D7 → [D, F#, A, C]', () => {
    expect(getExpectedNoteClasses('D7')).toEqual(['D', 'F#', 'A', 'C']);
  });

  it('A7 → [A, C#, E, G]', () => {
    expect(getExpectedNoteClasses('A7')).toEqual(['A', 'C#', 'E', 'G']);
  });

  it('E7 → [E, G#, B, D]', () => {
    expect(getExpectedNoteClasses('E7')).toEqual(['E', 'G#', 'B', 'D']);
  });

  it('H7 (B7) annotation stripped correctly → [B, D#, F#, A]', () => {
    expect(getExpectedNoteClasses('H7 (B7)')).toEqual(['B', 'D#', 'F#', 'A']);
  });

  // Edge cases
  it('returns [] for unknown chord name', () => {
    expect(getExpectedNoteClasses('X-Dur')).toEqual([]);
  });

  it('returns [] for empty string', () => {
    expect(getExpectedNoteClasses('')).toEqual([]);
  });

  it('returns [] for null', () => {
    expect(getExpectedNoteClasses(null)).toEqual([]);
  });

  it('returns exactly 3 notes for all triad types', () => {
    const triads = ['C-Dur', 'A-Moll', 'H-dim'];
    for (const name of triads) {
      expect(getExpectedNoteClasses(name)).toHaveLength(3);
    }
  });

  it('returns exactly 4 notes for dominant 7th', () => {
    expect(getExpectedNoteClasses('G7')).toHaveLength(4);
  });

  // Verify all 12 major-key diatonic chords are covered
  it('all C-Dur diatonic chords are recognised', () => {
    const cDurChords = ['C-Dur', 'D-Moll', 'E-Moll', 'F-Dur', 'G-Dur', 'A-Moll', 'H-dim'];
    for (const name of cDurChords) {
      expect(getExpectedNoteClasses(name).length).toBeGreaterThan(0);
    }
  });

  it('all G-Dur diatonic chords are recognised', () => {
    const gDurChords = ['G-Dur', 'A-Moll', 'H-Moll', 'C-Dur', 'D-Dur', 'E-Moll', 'Fis-dim'];
    for (const name of gDurChords) {
      expect(getExpectedNoteClasses(name).length).toBeGreaterThan(0);
    }
  });
});

// ── matchDetectedNotes ────────────────────────────────────────────────────────

describe('matchDetectedNotes', () => {
  it('isMatch=true and confidence=1 when all chord notes are detected (C-Dur)', () => {
    const result = matchDetectedNotes(['C', 'E', 'G'], 'C-Dur');
    expect(result.isMatch).toBe(true);
    expect(result.confidence).toBe(1);
    expect(result.missingNotes).toHaveLength(0);
  });

  it('isMatch=true even with extra notes (harmonics/open strings)', () => {
    // E-Moll expected [E, G, B]; extra A# is allowed
    const result = matchDetectedNotes(['E', 'G', 'B', 'A#'], 'E-Moll');
    expect(result.isMatch).toBe(true);
    expect(result.confidence).toBe(1);
  });

  it('isMatch=true for chord with duplicate note classes (real guitar voicing)', () => {
    // C-Dur often has C at two octaves
    const result = matchDetectedNotes(['C', 'E', 'G', 'C', 'E'], 'C-Dur');
    expect(result.isMatch).toBe(true);
    expect(result.confidence).toBe(1);
  });

  it('isMatch=false and confidence=2/3 when one of three notes is missing', () => {
    // Playing C and E but missing G
    const result = matchDetectedNotes(['C', 'E'], 'C-Dur');
    expect(result.isMatch).toBe(false);
    expect(result.confidence).toBeCloseTo(2 / 3);
    expect(result.missingNotes).toContain('G');
  });

  it('isMatch=false and confidence=1/3 when two of three notes are missing', () => {
    const result = matchDetectedNotes(['G'], 'C-Dur');
    expect(result.isMatch).toBe(false);
    expect(result.confidence).toBeCloseTo(1 / 3);
    expect(result.missingNotes).toContain('C');
    expect(result.missingNotes).toContain('E');
  });

  it('isMatch=false and confidence=0 when no notes are detected', () => {
    const result = matchDetectedNotes([], 'C-Dur');
    expect(result.isMatch).toBe(false);
    expect(result.confidence).toBe(0);
    expect(result.missingNotes).toEqual(expect.arrayContaining(['C', 'E', 'G']));
  });

  it('confidence=0 and isMatch=false for unknown chord name', () => {
    const result = matchDetectedNotes(['C', 'E', 'G'], 'Unknown');
    expect(result.isMatch).toBe(false);
    expect(result.confidence).toBe(0);
    expect(result.missingNotes).toHaveLength(0);
  });

  it('wrong chord: G-Dur notes (G, B, D) against C-Dur target → low confidence', () => {
    const result = matchDetectedNotes(['G', 'B', 'D'], 'C-Dur');
    expect(result.isMatch).toBe(false);
    // Only G matches (C expects C,E,G — G is the only match)
    expect(result.confidence).toBeCloseTo(1 / 3);
    expect(result.missingNotes).toContain('C');
    expect(result.missingNotes).toContain('E');
  });

  it('completely wrong chord: A-Dur (A, C#, E) against G-Dur (G, B, D) → confidence=0', () => {
    const result = matchDetectedNotes(['A', 'C#', 'E'], 'G-Dur');
    expect(result.isMatch).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('correctly matches G-Dur (G, B, D)', () => {
    const result = matchDetectedNotes(['G', 'B', 'D'], 'G-Dur');
    expect(result.isMatch).toBe(true);
    expect(result.confidence).toBe(1);
  });

  it('correctly matches E-Moll (E, G, B)', () => {
    const result = matchDetectedNotes(['E', 'G', 'B'], 'E-Moll');
    expect(result.isMatch).toBe(true);
    expect(result.confidence).toBe(1);
  });

  it('correctly matches D-Moll (D, F, A)', () => {
    const result = matchDetectedNotes(['D', 'F', 'A'], 'D-Moll');
    expect(result.isMatch).toBe(true);
    expect(result.confidence).toBe(1);
  });

  it('correctly matches H-Moll (B, D, F#)', () => {
    const result = matchDetectedNotes(['B', 'D', 'F#'], 'H-Moll');
    expect(result.isMatch).toBe(true);
    expect(result.confidence).toBe(1);
  });

  it('correctly matches D-Dur (D, F#, A)', () => {
    const result = matchDetectedNotes(['D', 'F#', 'A'], 'D-Dur');
    expect(result.isMatch).toBe(true);
    expect(result.confidence).toBe(1);
  });

  it('correctly matches G7 (G, B, D, F)', () => {
    const result = matchDetectedNotes(['G', 'B', 'D', 'F'], 'G7');
    expect(result.isMatch).toBe(true);
    expect(result.confidence).toBe(1);
  });

  it('G7 with 3 of 4 notes → confidence=0.75, isMatch=false', () => {
    const result = matchDetectedNotes(['G', 'B', 'D'], 'G7');
    expect(result.isMatch).toBe(false);
    expect(result.confidence).toBe(0.75);
    expect(result.missingNotes).toContain('F');
  });

  it('correctly matches B-Dur with A# note name (German B = Bb = A#)', () => {
    // B-Dur = [A#, D, F]
    const result = matchDetectedNotes(['A#', 'D', 'F'], 'B-Dur');
    expect(result.isMatch).toBe(true);
    expect(result.confidence).toBe(1);
  });

  it('correctly matches H-dim (B, D, F)', () => {
    const result = matchDetectedNotes(['B', 'D', 'F'], 'H-dim');
    expect(result.isMatch).toBe(true);
    expect(result.confidence).toBe(1);
  });

  it('H7 (B7): correctly matches [B, D#, F#, A]', () => {
    const result = matchDetectedNotes(['B', 'D#', 'F#', 'A'], 'H7 (B7)');
    expect(result.isMatch).toBe(true);
    expect(result.confidence).toBe(1);
  });

  it('confidence is proportional to matched notes', () => {
    // D-Dur expects [D, F#, A]; detect only D
    const result = matchDetectedNotes(['D'], 'D-Dur');
    expect(result.confidence).toBeCloseTo(1 / 3);
  });
});
