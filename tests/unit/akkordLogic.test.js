import { describe, it, expect, vi, afterEach } from 'vitest';
import { CHORDS, CHORD_CATEGORIES, getRandomChord, validateChord } from '../../js/games/akkordTrainer/akkordLogic.js';

describe('getRandomChord', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns only chords from the selected category pool', () => {
    const randomSpy = vi.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0);
    randomSpy.mockReturnValueOnce(0.5);
    randomSpy.mockReturnValueOnce(0.9999);

    const activeCategories = ['standard'];
    const draws = [
      getRandomChord(activeCategories),
      getRandomChord(activeCategories),
      getRandomChord(activeCategories),
    ];

    for (const draw of draws) {
      expect(CHORD_CATEGORIES.standard).toContain(draw.name);
      expect(draw.positions).toEqual(CHORDS[draw.name]);
    }
  });

  it('falls back to simplified for invalid category', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const draw = getRandomChord(['non-existent']);

    expect(CHORD_CATEGORIES.simplified).toContain(draw.name);
    expect(draw.name).toBe(CHORD_CATEGORIES.simplified[0]);
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

  it('returns false when one required fretted string is missing', () => {
    const missingString = CHORDS['C-Dur']
      .filter(position => position.string !== 5)
      .map(position => ({ ...position }));

    expect(validateChord('C-Dur', missingString)).toBe(false);
  });

  it('treats missing user strings as open strings', () => {
    const cDurWithoutOpenStrings = CHORDS['C-Dur']
      .filter(position => position.muted || position.fret > 0)
      .map(position => ({ ...position }));

    expect(validateChord('C-Dur', cDurWithoutOpenStrings)).toBe(true);
  });

  it('returns false when a required open string is set to muted', () => {
    const mutedOpenString = CHORDS['C-Dur'].map(position => ({ ...position }));
    const openString = mutedOpenString.find(position => position.string === 1);
    openString.muted = true;
    delete openString.fret;

    expect(validateChord('C-Dur', mutedOpenString)).toBe(false);
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
