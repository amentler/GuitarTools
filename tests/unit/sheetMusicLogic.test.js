import { describe, it, expect } from 'vitest';
import { NOTES, generateBars, getFilteredNotes } from '../../js/games/sheetMusicReading/sheetMusicLogic.js';

describe('generateBars', () => {
  it('creates 4 bars with 4 notes by default', () => {
    const bars = generateBars();

    expect(bars).toHaveLength(4);
    for (const bar of bars) {
      expect(bar).toHaveLength(4);
    }
  });

  it('ensures every generated note is part of NOTES', () => {
    const bars = generateBars();
    const validNotes = new Set(NOTES);

    for (const bar of bars) {
      for (const note of bar) {
        expect(validNotes.has(note)).toBe(true);
      }
    }
  });

  it('keeps interval jumps between consecutive notes at most 2 indices', () => {
    const bars = generateBars(6, 6);
    const flatNotes = bars.flat();

    for (let i = 1; i < flatNotes.length; i++) {
      const previousIndex = NOTES.indexOf(flatNotes[i - 1]);
      const currentIndex = NOTES.indexOf(flatNotes[i]);
      expect(Math.abs(currentIndex - previousIndex)).toBeLessThanOrEqual(2);
    }
  });

  it('supports custom parameters for number of bars and beats per bar', () => {
    const bars = generateBars(2, 3);

    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveLength(3);
    expect(bars[1]).toHaveLength(3);
  });

  it('only uses notes from the provided notesPool', () => {
    const pool = getFilteredNotes(1, [0, 5]); // fret 0–1, strings E2 and E4
    const bars = generateBars(4, 4, pool);
    const poolSet = new Set(pool);

    for (const bar of bars) {
      for (const note of bar) {
        expect(poolSet.has(note)).toBe(true);
      }
    }
  });

  it('falls back to NOTES when notesPool is empty', () => {
    const bars = generateBars(4, 4, []);
    const validNotes = new Set(NOTES);

    for (const bar of bars) {
      for (const note of bar) {
        expect(validNotes.has(note)).toBe(true);
      }
    }
  });
});

describe('getFilteredNotes', () => {
  it('returns all notes when maxFret is 3 and all strings are active', () => {
    const result = getFilteredNotes(3, [0, 1, 2, 3, 4, 5]);
    expect(result).toHaveLength(NOTES.length);
  });

  it('returns only open-string notes when maxFret is 0', () => {
    const result = getFilteredNotes(0, [0, 1, 2, 3, 4, 5]);
    expect(result.every(n => n.fret === 0)).toBe(true);
    expect(result).toHaveLength(6); // one open note per string
  });

  it('filters by active strings', () => {
    const result = getFilteredNotes(3, [0]); // only low E (string 6)
    expect(result.every(n => n.string === 6)).toBe(true);
  });

  it('filters by both maxFret and active strings', () => {
    const result = getFilteredNotes(1, [0, 5]); // frets 0–1, strings E2 and E4
    for (const note of result) {
      expect(note.fret).toBeLessThanOrEqual(1);
      const stringIndex = 6 - note.string;
      expect([0, 5]).toContain(stringIndex);
    }
  });

  it('returns empty array when no notes match', () => {
    const result = getFilteredNotes(0, []); // no active strings
    expect(result).toHaveLength(0);
  });
});
