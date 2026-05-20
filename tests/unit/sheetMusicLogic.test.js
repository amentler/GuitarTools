import { describe, it, expect } from 'vitest';
import {
  MAJOR_KEYS,
  NOTES,
  generateBars,
  getFilteredNotes,
  getMajorScalePitchClasses,
  normalizeMajorKey,
} from '../../js/games/sheetMusicReading/sheetMusicLogic.js';

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
    const noteKey = n => `${n.name}${n.octave}|${n.string}|${n.fret}`;
    const validKeys = new Set(NOTES.map(noteKey));

    for (const bar of bars) {
      for (const note of bar) {
        expect(validKeys.has(noteKey(note))).toBe(true);
      }
    }
  });

  it('keeps interval jumps between consecutive notes at most 3 indices', () => {
    const bars = generateBars(6, 6);
    const flatNotes = bars.flat();
    const noteKey = n => `${n.name}${n.octave}|${n.string}|${n.fret}`;
    const noteIndex = n => NOTES.findIndex(ref => noteKey(ref) === noteKey(n));

    for (let i = 1; i < flatNotes.length; i++) {
      const previousIndex = noteIndex(flatNotes[i - 1]);
      const currentIndex = noteIndex(flatNotes[i]);
      expect(Math.abs(currentIndex - previousIndex)).toBeLessThanOrEqual(3);
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
    const noteKey = n => `${n.name}${n.octave}|${n.string}|${n.fret}`;
    const poolKeys = new Set(pool.map(noteKey));

    for (const bar of bars) {
      for (const note of bar) {
        expect(poolKeys.has(noteKey(note))).toBe(true);
      }
    }
  });

  it('falls back to NOTES when notesPool is empty', () => {
    const bars = generateBars(4, 4, []);
    const noteKey = n => `${n.name}${n.octave}|${n.string}|${n.fret}`;
    const validKeys = new Set(NOTES.map(noteKey));

    for (const bar of bars) {
      for (const note of bar) {
        expect(validKeys.has(noteKey(note))).toBe(true);
      }
    }
  });
});

describe('getFilteredNotes', () => {
  it('returns 17 C-major notes when maxFret is 3 and all strings are active', () => {
    const result = getFilteredNotes(3, [0, 1, 2, 3, 4, 5]);
    expect(result).toHaveLength(17);
  });

  it('returns 18 C-major notes when maxFret is 4 and all strings are active', () => {
    const result = getFilteredNotes(4, [0, 1, 2, 3, 4, 5]);
    expect(result).toHaveLength(18);
  });

  it('returns 24 C-major notes when maxFret is 5 and all strings are active', () => {
    const result = getFilteredNotes(5, [0, 1, 2, 3, 4, 5]);
    expect(result).toHaveLength(24);
  });

  it('returns 26 C-major notes when maxFret is 8 and all strings are active', () => {
    const result = getFilteredNotes(8, [0, 1, 2, 3, 4, 5]);
    expect(result).toHaveLength(26);
  });

  it('returns notes at fret 8 when maxFret is 8', () => {
    const result = getFilteredNotes(8, [0, 1, 2, 3, 4, 5]);
    const fret8Notes = result.filter(n => n.fret === 8);
    expect(fret8Notes.length).toBeGreaterThan(0);
  });

  it('defaults to C major and excludes accidentals from the note pool', () => {
    const result = getFilteredNotes(8, [0, 1, 2, 3, 4, 5]);
    expect(result.every(n => !n.vfKey.includes('#') && !/[a-g]b\//.test(n.vfKey))).toBe(true);
  });

  it('includes at least one note with a sharp (#) accidental when the selected key needs it', () => {
    const result = getFilteredNotes(8, [0, 1, 2, 3, 4, 5], 0, 'G');
    const sharpNote = result.find(n => n.vfKey.includes('#'));
    expect(sharpNote).toBeDefined();
  });

  it('includes at least one note with a flat (b) accidental when the selected key needs it', () => {
    const result = getFilteredNotes(8, [0, 1, 2, 3, 4, 5], 0, 'F');
    const flatNote = result.find(n => /[a-g]b\//.test(n.vfKey));
    expect(flatNote).toBeDefined();
  });

  it('filters notes to the selected major key', () => {
    const result = getFilteredNotes(8, [0, 1, 2, 3, 4, 5], 0, 'D');
    const dMajorPitchClasses = getMajorScalePitchClasses('D');
    const noteToPc = Object.fromEntries([
      ['C', 0], ['C#', 1], ['Db', 1],
      ['D', 2], ['D#', 3], ['Eb', 3],
      ['E', 4],
      ['F', 5], ['F#', 6], ['Gb', 6],
      ['G', 7], ['G#', 8], ['Ab', 8],
      ['A', 9], ['A#', 10], ['Bb', 10],
      ['B', 11],
    ]);
    expect(result.every(note => dMajorPitchClasses.has(noteToPc[note.name]))).toBe(true);
    expect(result.some(note => note.name === 'F#')).toBe(true);
    expect(result.some(note => note.name === 'F')).toBe(false);
  });

  it('exposes C major as the default key choice', () => {
    expect(MAJOR_KEYS[0]).toMatchObject({ value: 'C', label: 'C-Dur' });
    expect(normalizeMajorKey('not-a-key')).toBe('C');
  });

  it('includes A4 on high E at fret 5', () => {
    const result = getFilteredNotes(5, [5]); // stringIndex 5 = string 1 = high E
    const a4 = result.find(n => n.name === 'A' && n.octave === 4);
    expect(a4).toBeDefined();
    expect(a4.fret).toBe(5);
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

  it('filters by minFret (third parameter)', () => {
    const result = getFilteredNotes(5, [0, 1, 2, 3, 4, 5], 3);
    expect(result.every(n => n.fret >= 3)).toBe(true);
  });

  it('returns only notes between minFret and maxFret inclusive', () => {
    const result = getFilteredNotes(5, [0, 1, 2, 3, 4, 5], 3);
    expect(result.every(n => n.fret >= 3 && n.fret <= 5)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('defaults minFret to 0 when not provided (backwards compatible)', () => {
    const withDefault = getFilteredNotes(3, [0, 1, 2, 3, 4, 5]);
    const withExplicit = getFilteredNotes(3, [0, 1, 2, 3, 4, 5], 0);
    expect(withDefault).toHaveLength(withExplicit.length);
  });

  it('returns empty array when no notes match', () => {
    const result = getFilteredNotes(0, []); // no active strings
    expect(result).toHaveLength(0);
  });
});
