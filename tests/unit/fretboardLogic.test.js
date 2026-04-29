import { describe, it, expect } from 'vitest';
import {
  CHROMATIC_NOTES,
  OPEN_STRING_NOTES,
  getNoteAtPosition,
  getRandomPosition,
} from '../../js/games/fretboardToneRecognition/fretboardLogic.js';

describe('getNoteAtPosition', () => {
  it('returns the open string note at fret 0', () => {
    // String 0 = low E, fret 0 → E
    expect(getNoteAtPosition(0, 0)).toBe('E');
    // String 1 = A, fret 0 → A
    expect(getNoteAtPosition(1, 0)).toBe('A');
    // String 5 = high E, fret 0 → E
    expect(getNoteAtPosition(5, 0)).toBe('E');
  });

  it('calculates fretted notes correctly', () => {
    // String 0 (E), fret 1 → F
    expect(getNoteAtPosition(0, 1)).toBe('F');
    // String 0 (E), fret 12 → E (octave wrap)
    expect(getNoteAtPosition(0, 12)).toBe('E');
    // String 1 (A), fret 2 → B
    expect(getNoteAtPosition(1, 2)).toBe('B');
    // String 2 (D), fret 3 → F
    expect(getNoteAtPosition(2, 3)).toBe('F');
  });

  it('wraps correctly at the chromatic boundary', () => {
    // String 4 (B), fret 1 → C
    expect(getNoteAtPosition(4, 1)).toBe('C');
  });
});

describe('getRandomPosition', () => {
  it('returns a position within the allowed range', () => {
    const pos = getRandomPosition(null, { maxFret: 4, activeStrings: [0, 1, 2] });
    expect(pos.fret).toBeGreaterThanOrEqual(0);
    expect(pos.fret).toBeLessThanOrEqual(4);
    expect([0, 1, 2]).toContain(pos.string);
  });

  it('avoids repeating the same position when multiple strings are active', () => {
    const previous = { string: 0, fret: 0 };
    // Run 20 draws – with 3 strings × 5 frets = 15 options the loop must terminate
    for (let i = 0; i < 20; i++) {
      const pos = getRandomPosition(previous, { maxFret: 4, activeStrings: [0, 1, 2] });
      const sameAsPrevious = pos.string === previous.string && pos.fret === previous.fret;
      expect(sameAsPrevious).toBe(false);
    }
  });

  it('uses the global random mock when present', () => {
    const originalRandom = globalThis.__GT_RANDOM__;
    const draws = [0.34, 0.65];
    try {
      globalThis.__GT_RANDOM__ = () => draws.shift();

      const pos = getRandomPosition(null, { maxFret: 4, activeStrings: [0, 1, 2, 3, 4, 5] });

      expect(pos).toEqual({ string: 2, fret: 3 });
    } finally {
      globalThis.__GT_RANDOM__ = originalRandom;
    }
  });
});

describe('CHROMATIC_NOTES and OPEN_STRING_NOTES constants', () => {
  it('CHROMATIC_NOTES contains exactly 12 notes', () => {
    expect(CHROMATIC_NOTES).toHaveLength(12);
  });

  it('OPEN_STRING_NOTES has 6 entries matching standard tuning', () => {
    expect(OPEN_STRING_NOTES).toEqual(['E', 'A', 'D', 'G', 'B', 'E']);
  });
});
