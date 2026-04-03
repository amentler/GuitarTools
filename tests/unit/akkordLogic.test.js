import { describe, it, expect, vi, afterEach } from 'vitest';
import { CHORDS, LEVELS, getRandomChord, validateChord } from '../../js/games/akkordTrainer/akkordLogic.js';

describe('getRandomChord', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns only chords from the selected level pool', () => {
    const randomSpy = vi.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0);
    randomSpy.mockReturnValueOnce(0.5);
    randomSpy.mockReturnValueOnce(0.9999);

    const draws = [
      getRandomChord(2),
      getRandomChord(2),
      getRandomChord(2),
    ];

    for (const draw of draws) {
      expect(LEVELS[1]).toContain(draw.name);
      expect(draw.positions).toEqual(CHORDS[draw.name]);
    }
  });

  it('falls back to level 1 for invalid level', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const draw = getRandomChord(999);

    expect(LEVELS[0]).toContain(draw.name);
    expect(draw.name).toBe(LEVELS[0][0]);
    expect(draw.positions).toEqual(CHORDS[draw.name]);
  });
});

describe('validateChord', () => {
  it('returns false for unknown chord', () => {
    expect(validateChord('Unbekannt', [])).toBe(false);
  });

  it('returns true for an exactly correct input', () => {
    const exactInput = CHORDS['C-Dur'].map(position => ({ ...position }));
    expect(validateChord('C-Dur', exactInput)).toBe(true);
  });

  it('returns false when one string is missing', () => {
    const missingString = CHORDS['C-Dur']
      .filter(position => position.string !== 3)
      .map(position => ({ ...position }));

    expect(validateChord('C-Dur', missingString)).toBe(false);
  });

  it('returns false when a fret is wrong', () => {
    const wrongFret = CHORDS['G-Dur'].map(position => ({ ...position }));
    wrongFret.find(position => position.string === 6).fret = 2;

    expect(validateChord('G-Dur', wrongFret)).toBe(false);
  });

  it('returns false when muted/open/fretted state is wrong', () => {
    const wrongState = CHORDS['C-Dur'].map(position => ({ ...position }));
    wrongState.find(position => position.string === 6).muted = false;
    wrongState.find(position => position.string === 6).fret = 0;

    expect(validateChord('C-Dur', wrongState)).toBe(false);
  });
});
