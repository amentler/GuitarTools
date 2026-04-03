import { describe, it, expect } from 'vitest';
import { NOTES, generateBars } from '../../js/games/sheetMusicReading/sheetMusicLogic.js';

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
});
