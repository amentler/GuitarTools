import { describe, it, expect } from 'vitest';
import {
  filterHarmonicPeaks,
  getChordNotes,
  identifyNotesFromPeaks,
  matchChordToTarget,
} from '../../js/games/chordExercise/chordDetectionLogic.js';

// ── getChordNotes ─────────────────────────────────────────────────────────────

describe('getChordNotes', () => {
  it('returns correct note count for C-Dur (5 sounding strings, string 6 muted)', () => {
    const notes = getChordNotes('C-Dur');
    expect(notes).toHaveLength(5);
  });

  it('returns correct notes for C-Dur (C, E, G classes)', () => {
    // C-Dur: x32010 → C3, E3, G3, C4, E4
    const notes = getChordNotes('C-Dur');
    const noteNames = notes.map(n => n.note);
    expect(noteNames).toContain('C');
    expect(noteNames).toContain('E');
    expect(noteNames).toContain('G');
  });

  it('returns correct octaves for C-Dur', () => {
    const notes = getChordNotes('C-Dur');
    const noteIds = notes.map(n => `${n.note}${n.octave}`);
    expect(noteIds).toContain('C3'); // string 5 fret 3
    expect(noteIds).toContain('E3'); // string 4 fret 2
    expect(noteIds).toContain('G3'); // string 3 fret 0
    expect(noteIds).toContain('C4'); // string 2 fret 1
    expect(noteIds).toContain('E4'); // string 1 fret 0
  });

  it('excludes muted strings for C-Dur (string 6 muted)', () => {
    const notes = getChordNotes('C-Dur');
    expect(notes.every(n => n.string !== 6)).toBe(true);
  });

  it('excludes muted strings for D-Dur (strings 5 and 6 muted)', () => {
    const notes = getChordNotes('D-Dur');
    expect(notes.every(n => n.string !== 5 && n.string !== 6)).toBe(true);
    expect(notes).toHaveLength(4);
  });

  it('returns 6 notes for E-Moll (all strings sound)', () => {
    const notes = getChordNotes('E-Moll');
    expect(notes).toHaveLength(6);
  });

  it('returns correct note classes for E-Moll (E, G, B)', () => {
    const notes = getChordNotes('E-Moll');
    const classes = [...new Set(notes.map(n => n.note))];
    expect(classes).toContain('E');
    expect(classes).toContain('G');
    expect(classes).toContain('B');
  });

  it('returns correct note classes for G-Dur (G, B, D)', () => {
    // G-Dur: 320033 → G2, B2, D3, G3, B3, G4
    const notes = getChordNotes('G-Dur');
    const classes = [...new Set(notes.map(n => n.note))];
    expect(classes).toContain('G');
    expect(classes).toContain('B');
    expect(classes).toContain('D');
    expect(notes).toHaveLength(6);
  });

  it('returns correct note classes for E-Dur (E, G#, B)', () => {
    // E-Dur: 022100 → E2, B2, E3, G#3, B3, E4
    const notes = getChordNotes('E-Dur');
    const classes = [...new Set(notes.map(n => n.note))];
    expect(classes).toContain('E');
    expect(classes).toContain('B');
    expect(classes).toContain('G#');
  });

  it('returns correct note classes for A-Moll (A, E, C)', () => {
    // A-Moll: x02210 → A2, E3, A3, C4, E4
    const notes = getChordNotes('A-Moll');
    expect(notes).toHaveLength(5);
    const classes = [...new Set(notes.map(n => n.note))];
    expect(classes).toContain('A');
    expect(classes).toContain('E');
    expect(classes).toContain('C');
  });

  it('returns correct note classes for D-Moll (D, F, A)', () => {
    // D-Moll: xx0231 → D3, A3, D4, F4
    const notes = getChordNotes('D-Moll');
    const classes = [...new Set(notes.map(n => n.note))];
    expect(classes).toContain('D');
    expect(classes).toContain('F');
    expect(classes).toContain('A');
  });

  it('returns correct note classes for A-Dur (A, C#, E)', () => {
    // A-Dur: x02220 → A2, E3, A3, C#4, E4
    const notes = getChordNotes('A-Dur');
    const classes = [...new Set(notes.map(n => n.note))];
    expect(classes).toContain('A');
    expect(classes).toContain('C#');
    expect(classes).toContain('E');
  });

  it('returns empty array for unknown chord name', () => {
    expect(getChordNotes('Unknown-Chord')).toHaveLength(0);
    expect(getChordNotes('')).toHaveLength(0);
    expect(getChordNotes(null)).toHaveLength(0);
  });

  it('all notes have valid properties (note name, octave, string, fret)', () => {
    const validNotes = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const chords = ['C-Dur', 'G-Dur', 'D-Dur', 'E-Moll', 'A-Moll', 'E-Dur', 'A-Dur', 'D-Moll'];
    for (const chord of chords) {
      for (const n of getChordNotes(chord)) {
        expect(validNotes).toContain(n.note);
        expect(n.octave).toBeGreaterThanOrEqual(2);
        expect(n.octave).toBeLessThanOrEqual(5);
        expect(n.string).toBeGreaterThanOrEqual(1);
        expect(n.string).toBeLessThanOrEqual(6);
        expect(n.fret).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ── identifyNotesFromPeaks ────────────────────────────────────────────────────

describe('identifyNotesFromPeaks', () => {
  it('returns empty array for empty input', () => {
    expect(identifyNotesFromPeaks([])).toHaveLength(0);
  });

  it('filters out zero frequencies', () => {
    const notes = identifyNotesFromPeaks([0, 440]);
    expect(notes).toHaveLength(1);
  });

  it('filters out negative frequencies', () => {
    const notes = identifyNotesFromPeaks([-100, 82.41, 0]);
    expect(notes).toHaveLength(1);
  });

  it('converts A4 = 440 Hz to { note: A, octave: 4, cents ≈ 0 }', () => {
    const notes = identifyNotesFromPeaks([440]);
    expect(notes[0].note).toBe('A');
    expect(notes[0].octave).toBe(4);
    expect(notes[0].cents).toBeCloseTo(0, 0);
    expect(notes[0].frequency).toBeCloseTo(440);
  });

  it('converts E2 ≈ 82.41 Hz correctly', () => {
    const notes = identifyNotesFromPeaks([82.41]);
    expect(notes[0].note).toBe('E');
    expect(notes[0].octave).toBe(2);
  });

  it('converts multiple frequencies correctly', () => {
    // Open strings: E2=82.41, A2=110, D3=146.83, G3=196, B3=246.94
    const freqs = [82.41, 110.0, 146.83, 196.0, 246.94];
    const notes = identifyNotesFromPeaks(freqs);
    expect(notes).toHaveLength(5);
    const noteNames = notes.map(n => n.note);
    expect(noteNames).toContain('E');
    expect(noteNames).toContain('A');
    expect(noteNames).toContain('D');
    expect(noteNames).toContain('G');
    expect(noteNames).toContain('B');
  });

  it('preserves original frequency value in result', () => {
    const notes = identifyNotesFromPeaks([329.63]);
    expect(notes[0].frequency).toBeCloseTo(329.63);
  });
});

// ── matchChordToTarget ────────────────────────────────────────────────────────

describe('matchChordToTarget', () => {
  it('returns isCorrect=true when all chord note classes are detected', () => {
    // C-Dur classes: C, E, G
    const detected = [
      { note: 'C', octave: 3 },
      { note: 'E', octave: 3 },
      { note: 'G', octave: 3 },
    ];
    const result = matchChordToTarget(detected, 'C-Dur');
    expect(result.isCorrect).toBe(true);
    expect(result.missingNotes).toHaveLength(0);
    expect(result.confidence).toBe(1);
  });

  it('confidence=1 and isCorrect=true for perfect chord match including duplicates', () => {
    // Real guitar chord has same note in multiple octaves (e.g. C-Dur has 2 C's and 2 E's)
    const detected = [
      { note: 'C', octave: 3 },
      { note: 'E', octave: 3 },
      { note: 'G', octave: 3 },
      { note: 'C', octave: 4 },
      { note: 'E', octave: 4 },
    ];
    const result = matchChordToTarget(detected, 'C-Dur');
    expect(result.isCorrect).toBe(true);
    expect(result.confidence).toBe(1);
  });

  it('detects missing notes and reduces confidence', () => {
    // C-Dur expects C, E, G — only C and E detected → G missing
    const detected = [
      { note: 'C', octave: 3 },
      { note: 'E', octave: 3 },
    ];
    const result = matchChordToTarget(detected, 'C-Dur');
    expect(result.isCorrect).toBe(false);
    expect(result.missingNotes).toContain('G');
    expect(result.confidence).toBeCloseTo(2 / 3);
  });

  it('rejects chord when extra fundamental notes are present', () => {
    // C, E, G correct but unexpected A is also detected (e.g. muted string ringing)
    const detected = [
      { note: 'C', octave: 3 },
      { note: 'E', octave: 3 },
      { note: 'G', octave: 3 },
      { note: 'A', octave: 3 },
    ];
    const result = matchChordToTarget(detected, 'C-Dur');
    expect(result.isCorrect).toBe(false); // extra fundamental note disqualifies the chord
    expect(result.extraNotes).toContain('A');
    expect(result.confidence).toBe(1); // all expected notes were found
  });

  it('returns confidence=0 for unknown chord name', () => {
    const detected = [{ note: 'C', octave: 3 }];
    const result = matchChordToTarget(detected, 'Unknown-Chord');
    expect(result.confidence).toBe(0);
    expect(result.isCorrect).toBe(false);
  });

  it('returns isCorrect=false and all notes missing when nothing detected', () => {
    const result = matchChordToTarget([], 'C-Dur');
    expect(result.isCorrect).toBe(false);
    expect(result.confidence).toBe(0);
    expect(result.missingNotes.length).toBeGreaterThan(0);
  });

  it('is octave-agnostic — different octaves count as correct', () => {
    // C, E, G at unusual octaves still matches C-Dur
    const detected = [
      { note: 'C', octave: 5 },
      { note: 'E', octave: 1 },
      { note: 'G', octave: 6 },
    ];
    const result = matchChordToTarget(detected, 'C-Dur');
    expect(result.isCorrect).toBe(true);
    expect(result.confidence).toBe(1);
  });

  it('correctly detects E-Moll (E, G, B)', () => {
    const detected = [
      { note: 'E', octave: 2 },
      { note: 'B', octave: 2 },
      { note: 'G', octave: 3 },
      { note: 'E', octave: 4 }, // same note class, different octave
    ];
    const result = matchChordToTarget(detected, 'E-Moll');
    expect(result.isCorrect).toBe(true);
    expect(result.confidence).toBe(1);
  });

  it('wrong chord: playing E-Moll (E, B, G) when C-Dur (C, E, G) expected', () => {
    const detected = [
      { note: 'E', octave: 2 },
      { note: 'B', octave: 2 },
      { note: 'G', octave: 3 },
    ];
    const result = matchChordToTarget(detected, 'C-Dur');
    expect(result.isCorrect).toBe(false);
    expect(result.missingNotes).toContain('C');
    expect(result.extraNotes).toContain('B');
    expect(result.confidence).toBeCloseTo(2 / 3);
  });

  it('correctly matches G-Dur (G, B, D)', () => {
    const detected = [
      { note: 'G', octave: 2 },
      { note: 'B', octave: 2 },
      { note: 'D', octave: 3 },
    ];
    const result = matchChordToTarget(detected, 'G-Dur');
    expect(result.isCorrect).toBe(true);
    expect(result.confidence).toBe(1);
  });

  it('correctly matches E-Dur (E, G#, B)', () => {
    const detected = [
      { note: 'E', octave: 2 },
      { note: 'G#', octave: 3 },
      { note: 'B', octave: 3 },
    ];
    const result = matchChordToTarget(detected, 'E-Dur');
    expect(result.isCorrect).toBe(true);
    expect(result.confidence).toBe(1);
  });

  it('confidence drops proportionally with number of missing notes', () => {
    // C-Dur has 3 note classes: C, E, G
    // Detect only G → 1/3 confidence
    const detected = [{ note: 'G', octave: 3 }];
    const result = matchChordToTarget(detected, 'C-Dur');
    expect(result.confidence).toBeCloseTo(1 / 3);
    expect(result.missingNotes).toContain('C');
    expect(result.missingNotes).toContain('E');
  });
});

// ── filterHarmonicPeaks ───────────────────────────────────────────────────────

describe('filterHarmonicPeaks', () => {
  it('returns empty array for empty input', () => {
    expect(filterHarmonicPeaks([])).toEqual([]);
  });

  it('keeps a single frequency unchanged', () => {
    const result = filterHarmonicPeaks([440]);
    expect(result).toEqual([440]);
  });

  it('removes an exact octave duplicate (2nd harmonic)', () => {
    // 440 Hz and 880 Hz (= 440 × 2)
    const result = filterHarmonicPeaks([440, 880]);
    expect(result).toHaveLength(1);
    expect(result).toContain(440);
    expect(result).not.toContain(880);
  });

  it('removes a 3rd harmonic (B2 → F#4 false positive pattern from G chord)', () => {
    // B2 ≈ 123.47 Hz; B2 × 3 ≈ 370.41 Hz (≈ F#4 = 369.99 Hz)
    const b2 = 123.47;
    const fakeF4 = b2 * 3; // exact 3rd harmonic
    const result = filterHarmonicPeaks([b2, fakeF4]);
    expect(result).toHaveLength(1);
    expect(result).toContain(b2);
  });

  it('keeps frequencies that are NOT harmonically related', () => {
    // C3 (130.81), E3 (164.81), G3 (196) — none is a harmonic of another
    const result = filterHarmonicPeaks([130.81, 164.81, 196.00]);
    expect(result).toHaveLength(3);
  });

  it('filters the 3rd harmonic of D3 that lands near A4 (G chord false positive)', () => {
    const d3 = 146.83;
    const fakeA4 = d3 * 3; // ≈ 440.49 Hz ≈ A4
    const result = filterHarmonicPeaks([d3, fakeA4]);
    expect(result).toHaveLength(1);
    expect(result).toContain(d3);
  });

  it('reduces a G-chord-like spectrum to its three lowest fundamentals', () => {
    // G chord strings: G2(97), B2(124), D3(148), G3(194=2×G2), B3(247=2×B2)
    // G3 and B3 are octave duplicates → filtered out; D3 is NOT a harmonic of any lower peak
    const gChordPeaks = [97, 124, 148, 194, 247];
    const result = filterHarmonicPeaks(gChordPeaks);
    // Lowest fundamentals must survive
    expect(result).toContain(97);   // G2
    expect(result).toContain(124);  // B2
    expect(result).toContain(148);  // D3
    // Output is shorter because octave duplicates are removed
    expect(result.length).toBeLessThan(gChordPeaks.length);
  });

  it('filters out zero and negative frequencies', () => {
    const result = filterHarmonicPeaks([0, -50, 440]);
    expect(result).toEqual([440]);
  });

  it('returns sorted ascending output', () => {
    const result = filterHarmonicPeaks([440, 220, 330]);
    for (let i = 1; i < result.length; i++) {
      expect(result[i]).toBeGreaterThan(result[i - 1]);
    }
  });
});
