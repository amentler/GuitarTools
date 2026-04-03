import { describe, it, expect } from 'vitest';
import { getAvailableNotes, getRandomNote, getPositionsForNote } from '../../js/games/notePlayingExercise/notePlayingLogic.js';

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
