import { describe, it, expect } from 'vitest';
import {
  getAvailableNotes, getRandomNote, getPositionsForNote,
  getPitchAtPosition, getAvailablePitches, getRandomPitch, getPositionsForPitch,
} from '../../js/games/notePlayingExercise/notePlayingLogic.js';

describe('getAvailableNotes', () => {
  it('returns only the open-string note when maxFret is 0 and one string is active', () => {
    // String 0 (low E) open = E
    const notes = getAvailableNotes(0, [0]);
    expect(notes).toEqual(['E']);
  });

  it('returns notes for all open strings when maxFret is 0', () => {
    const notes = getAvailableNotes(0, [0, 1, 2, 3, 4, 5]);
    // Open strings: E, A, D, G, B, E → unique: E, A, D, G, B
    expect(notes).toContain('E');
    expect(notes).toContain('A');
    expect(notes).toContain('D');
    expect(notes).toContain('G');
    expect(notes).toContain('B');
    expect(notes.length).toBe(5); // E appears twice (string 0 and 5), so 5 unique
  });

  it('returns all 12 chromatic notes for a full range and all strings', () => {
    // With 11 frets per string across 6 strings, all 12 semitones are reachable
    const notes = getAvailableNotes(11, [0, 1, 2, 3, 4, 5]);
    expect(notes.length).toBe(12);
  });

  it('returns unique notes only (no duplicates)', () => {
    const notes = getAvailableNotes(5, [0, 1, 2, 3, 4, 5]);
    const unique = new Set(notes);
    expect(notes.length).toBe(unique.size);
  });

  it('handles a single string with multiple frets', () => {
    // String 0 (E), frets 0–4: E, F, F#, G, G#
    const notes = getAvailableNotes(4, [0]);
    expect(notes).toContain('E');
    expect(notes).toContain('F');
    expect(notes).toContain('F#');
    expect(notes).toContain('G');
    expect(notes).toContain('G#');
    expect(notes.length).toBe(5);
  });
});

describe('getRandomNote', () => {
  it('never repeats the previous note when the pool has more than one note', () => {
    for (let i = 0; i < 50; i++) {
      const note = getRandomNote('C', 5, [0, 1, 2, 3, 4, 5]);
      expect(note).not.toBe('C');
    }
  });

  it('returns a note that is in the available pool', () => {
    const pool = getAvailableNotes(5, [0, 1, 2, 3, 4, 5]);
    const note = getRandomNote(null, 5, [0, 1, 2, 3, 4, 5]);
    expect(pool).toContain(note);
  });

  it('returns the only available note even if it equals the previous note', () => {
    // Pool is only 'E' (open string 0, fret 0)
    const note = getRandomNote('E', 0, [0]);
    expect(note).toBe('E');
  });

  it('returns a fallback note when the pool is empty', () => {
    // activeStrings = [] produces an empty pool
    const note = getRandomNote(null, 5, []);
    expect(note).toBe('E');
  });
});

describe('getPositionsForNote', () => {
  it('returns the open string position for E on string 0 at fret 0', () => {
    const positions = getPositionsForNote('E', 0, [0]);
    expect(positions).toEqual([{ string: 0, fret: 0 }]);
  });

  it('returns empty array when no active strings', () => {
    const positions = getPositionsForNote('E', 5, []);
    expect(positions).toEqual([]);
  });

  it('returns all fret positions for a note across active strings', () => {
    // String 0 (E): fret 0 = E, fret 12 = E
    const positions = getPositionsForNote('E', 12, [0]);
    expect(positions).toContainEqual({ string: 0, fret: 0 });
    expect(positions).toContainEqual({ string: 0, fret: 12 });
    expect(positions.length).toBe(2);
  });

  it('returns positions across multiple strings', () => {
    // E appears on string 0 (fret 0) and string 5 (fret 0) within maxFret=0
    const positions = getPositionsForNote('E', 0, [0, 1, 2, 3, 4, 5]);
    expect(positions).toContainEqual({ string: 0, fret: 0 });
    expect(positions).toContainEqual({ string: 5, fret: 0 });
    expect(positions.every(p => p.fret === 0)).toBe(true);
  });

  it('only includes frets up to maxFret', () => {
    const positions = getPositionsForNote('E', 5, [0]);
    expect(positions.every(p => p.fret <= 5)).toBe(true);
  });
});

// ── Octave-aware helpers ───────────────────────────────────────────────────────

describe('getPitchAtPosition', () => {
  it('returns E2 for string 0 (low E) at fret 0', () => {
    expect(getPitchAtPosition(0, 0)).toEqual({ note: 'E', octave: 2 });
  });

  it('returns A2 for string 1 (A) at fret 0', () => {
    expect(getPitchAtPosition(1, 0)).toEqual({ note: 'A', octave: 2 });
  });

  it('returns D3 for string 2 (D) at fret 0', () => {
    expect(getPitchAtPosition(2, 0)).toEqual({ note: 'D', octave: 3 });
  });

  it('returns G3 for string 3 (G) at fret 0', () => {
    expect(getPitchAtPosition(3, 0)).toEqual({ note: 'G', octave: 3 });
  });

  it('returns B3 for string 4 (B) at fret 0', () => {
    expect(getPitchAtPosition(4, 0)).toEqual({ note: 'B', octave: 3 });
  });

  it('returns E4 for string 5 (high E) at fret 0', () => {
    expect(getPitchAtPosition(5, 0)).toEqual({ note: 'E', octave: 4 });
  });

  it('advances semitones correctly: string 0 fret 1 = F2', () => {
    expect(getPitchAtPosition(0, 1)).toEqual({ note: 'F', octave: 2 });
  });

  it('crosses octave boundary: string 0 fret 8 = C3', () => {
    // E2 (MIDI 40) + 8 = MIDI 48 = C3
    expect(getPitchAtPosition(0, 8)).toEqual({ note: 'C', octave: 3 });
  });

  it('handles sharps correctly: string 0 fret 2 = F#2', () => {
    expect(getPitchAtPosition(0, 2)).toEqual({ note: 'F#', octave: 2 });
  });
});

describe('getAvailablePitches', () => {
  it('returns E2 for string 0 open only', () => {
    const pitches = getAvailablePitches(0, [0]);
    expect(pitches).toEqual(['E2']);
  });

  it('returns all 6 unique open-string pitches for all strings at fret 0', () => {
    const pitches = getAvailablePitches(0, [0, 1, 2, 3, 4, 5]);
    // E2, A2, D3, G3, B3, E4 – all unique (different octaves)
    expect(pitches).toContain('E2');
    expect(pitches).toContain('A2');
    expect(pitches).toContain('D3');
    expect(pitches).toContain('G3');
    expect(pitches).toContain('B3');
    expect(pitches).toContain('E4');
    expect(pitches.length).toBe(6);
  });

  it('returns unique pitches only (no duplicates)', () => {
    const pitches = getAvailablePitches(5, [0, 1, 2, 3, 4, 5]);
    const unique = new Set(pitches);
    expect(pitches.length).toBe(unique.size);
  });

  it('returns fallback empty array for no active strings', () => {
    const pitches = getAvailablePitches(5, []);
    expect(pitches).toEqual([]);
  });
});

describe('getRandomPitch', () => {
  it('never repeats the previous pitch when the pool has more than one pitch', () => {
    for (let i = 0; i < 50; i++) {
      const pitch = getRandomPitch('E2', 5, [0, 1, 2, 3, 4, 5]);
      expect(pitch).not.toBe('E2');
    }
  });

  it('returns a pitch that is in the available pool', () => {
    const pool = getAvailablePitches(5, [0, 1, 2, 3, 4, 5]);
    const pitch = getRandomPitch(null, 5, [0, 1, 2, 3, 4, 5]);
    expect(pool).toContain(pitch);
  });

  it('returns the only available pitch even if it equals the previous pitch', () => {
    const pitch = getRandomPitch('E2', 0, [0]);
    expect(pitch).toBe('E2');
  });

  it('returns fallback E2 when the pool is empty', () => {
    const pitch = getRandomPitch(null, 5, []);
    expect(pitch).toBe('E2');
  });
});

describe('getPositionsForPitch', () => {
  it('returns string 0 fret 0 for E2', () => {
    const positions = getPositionsForPitch('E2', 0, [0]);
    expect(positions).toEqual([{ string: 0, fret: 0 }]);
  });

  it('returns empty array when no active strings', () => {
    const positions = getPositionsForPitch('E2', 5, []);
    expect(positions).toEqual([]);
  });

  it('does not return E4 when searching for E2 (octave-accurate)', () => {
    // String 5 open = E4, should not match E2
    const positions = getPositionsForPitch('E2', 0, [0, 5]);
    expect(positions).toContainEqual({ string: 0, fret: 0 });
    expect(positions).not.toContainEqual({ string: 5, fret: 0 });
    expect(positions.length).toBe(1);
  });

  it('only includes frets up to maxFret', () => {
    const positions = getPositionsForPitch('E2', 5, [0]);
    expect(positions.every(p => p.fret <= 5)).toBe(true);
  });

  it('finds C#4 at the correct fret on string 5', () => {
    // String 5 (E4 = MIDI 64): C#4 = MIDI 61, so fret = 61 - 64 = negative — not on string 5
    // String 4 (B3 = MIDI 59): C#4 = MIDI 61, fret = 2
    const positions = getPositionsForPitch('C#4', 5, [0, 1, 2, 3, 4, 5]);
    expect(positions).toContainEqual({ string: 4, fret: 2 });
  });
});
