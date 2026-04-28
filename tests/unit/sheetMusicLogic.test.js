import { describe, it, expect } from 'vitest';
import { NOTES, generateBars, getFilteredNotes, getTimeSignatureConfig, EndlessBarGenerator } from '../../js/games/sheetMusicReading/sheetMusicLogic.js';

describe('getTimeSignatureConfig', () => {
  it('returns valid config for 4/4', () => {
    const config = getTimeSignatureConfig('4/4');
    expect(config).toEqual({ beatsPerBar: 4, noteDuration: 'q', vfTimeSig: '4/4' });
  });

  it('returns valid config for 3/4', () => {
    const config = getTimeSignatureConfig('3/4');
    expect(config).toEqual({ beatsPerBar: 3, noteDuration: 'q', vfTimeSig: '3/4' });
  });

  it('returns valid config for 6/8', () => {
    const config = getTimeSignatureConfig('6/8');
    expect(config).toEqual({ beatsPerBar: 6, noteDuration: 'e', vfTimeSig: '6/8' });
  });

  it('returns null for unknown signature', () => {
    expect(getTimeSignatureConfig('5/4')).toBeNull();
  });
});

describe('EndlessBarGenerator', () => {
  it('initializes with correct beats per bar', () => {
    const gen = new EndlessBarGenerator(4);
    const batch = gen.nextBatch(2);
    expect(batch).toHaveLength(2);
    expect(batch[0]).toHaveLength(4);
  });

  it('maintains state across batches', () => {
    const gen = new EndlessBarGenerator(4);
    const batch1 = gen.nextBatch(1);
    const batch2 = gen.nextBatch(1);
    
    const lastOf1 = batch1[0][3];
    const firstOf2 = batch2[0][0];
    
    const idx1 = NOTES.indexOf(lastOf1);
    const idx2 = NOTES.indexOf(firstOf2);
    expect(Math.abs(idx1 - idx2)).toBeLessThanOrEqual(2);
  });

  it('can update notes pool', () => {
    const pool = [NOTES[0], NOTES[1]];
    const gen = new EndlessBarGenerator(4);
    gen.setNotesPool(pool);
    const batch = gen.nextBatch(1);
    expect(batch[0].every(n => pool.includes(n))).toBe(true);
  });
});

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
    expect(result).toHaveLength(17);
  });

  it('returns 18 notes when maxFret is 4 and all strings are active', () => {
    const result = getFilteredNotes(4, [0, 1, 2, 3, 4, 5]);
    expect(result).toHaveLength(18);
  });

  it('returns 24 notes when maxFret is 5 and all strings are active', () => {
    const result = getFilteredNotes(5, [0, 1, 2, 3, 4, 5]);
    expect(result).toHaveLength(24);
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

  it('returns empty array when no notes match', () => {
    const result = getFilteredNotes(0, []); // no active strings
    expect(result).toHaveLength(0);
  });
});
