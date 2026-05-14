import { describe, it, expect } from 'vitest';
import {
  stripChordAnnotation,
  parseChordDescriptor,
  getChordDescriptor,
  getChordProfile,
  sharesRoot,
  isTriadModeSensitive,
  isAnnotatedVariant,
} from '../../js/games/chordExerciseEssentia/essentiaChordDescriptors.js';

describe('stripChordAnnotation', () => {
  it('removes annotation in parentheses', () => {
    expect(stripChordAnnotation('C-Dur (1-Finger)')).toBe('C-Dur');
    expect(stripChordAnnotation('G-Dur (rock)')).toBe('G-Dur');
  });
  it('leaves plain names unchanged', () => {
    expect(stripChordAnnotation('C-Dur')).toBe('C-Dur');
    expect(stripChordAnnotation('Asus2')).toBe('Asus2');
  });
});

describe('parseChordDescriptor', () => {
  it('parses major chord in German Dur notation', () => {
    expect(parseChordDescriptor('C-Dur')).toEqual({ root: 'C', type: 'Dur' });
    expect(parseChordDescriptor('G-Dur')).toEqual({ root: 'G', type: 'Dur' });
  });
  it('parses minor chord in German Moll notation', () => {
    expect(parseChordDescriptor('A-Moll')).toEqual({ root: 'A', type: 'Moll' });
  });
  it('parses dominant 7th chord', () => {
    expect(parseChordDescriptor('G7')).toEqual({ root: 'G', type: '7' });
  });
  it('parses maj7 suffix', () => {
    expect(parseChordDescriptor('Cmaj7')).toEqual({ root: 'C', type: 'maj7' });
  });
  it('parses sus2 and sus4 suffixes', () => {
    expect(parseChordDescriptor('Asus2')).toEqual({ root: 'A', type: 'sus2' });
    expect(parseChordDescriptor('Dsus4')).toEqual({ root: 'D', type: 'sus4' });
  });
  it('returns null for null or empty input', () => {
    expect(parseChordDescriptor(null)).toBeNull();
    expect(parseChordDescriptor('')).toBeNull();
  });
  it('returns null for unrecognised chord name', () => {
    expect(parseChordDescriptor('X-Unknown')).toBeNull();
  });
});

describe('getChordDescriptor', () => {
  it('returns rootBin 0 for C-Dur', () => {
    const d = getChordDescriptor('C-Dur');
    expect(d).not.toBeNull();
    expect(d.rootBin).toBe(0);
    expect(d.fifthBin).toBe(7);
  });
  it('returns correct majorThirdBin for major chord', () => {
    const d = getChordDescriptor('C-Dur');
    expect(d.majorThirdBin).toBe(4); // E = bin 4
  });
  it('returns null for unrecognised chord', () => {
    expect(getChordDescriptor('Xyz')).toBeNull();
  });
});

describe('getChordProfile', () => {
  it('returns DEFAULT_PROFILE for null descriptor', () => {
    const p = getChordProfile(null);
    expect(p).toHaveProperty('threshold');
    expect(p).toHaveProperty('weights');
  });
  it('returns a specific profile for "7" type', () => {
    const d = getChordDescriptor('G7');
    const p = getChordProfile(d);
    expect(p.threshold).toBeLessThan(0.5); // '7' profile has lower threshold
  });
});

describe('sharesRoot', () => {
  it('returns true when both descriptors have the same rootBin', () => {
    expect(sharesRoot({ rootBin: 0 }, { rootBin: 0 })).toBe(true);
  });
  it('returns false for different rootBin', () => {
    expect(sharesRoot({ rootBin: 0 }, { rootBin: 4 })).toBe(false);
  });
  it('returns false when either is null', () => {
    expect(sharesRoot(null, { rootBin: 0 })).toBe(false);
    expect(sharesRoot({ rootBin: 0 }, null)).toBe(false);
  });
});

describe('isTriadModeSensitive', () => {
  it('returns true for Dur and Moll', () => {
    expect(isTriadModeSensitive({ type: 'Dur' })).toBe(true);
    expect(isTriadModeSensitive({ type: 'Moll' })).toBe(true);
  });
  it('returns false for extended chords and null', () => {
    expect(isTriadModeSensitive({ type: '7' })).toBe(false);
    expect(isTriadModeSensitive({ type: 'maj7' })).toBe(false);
    expect(isTriadModeSensitive(null)).toBe(false);
  });
});

describe('isAnnotatedVariant', () => {
  it('returns true for names with finger/rock/klein annotation', () => {
    expect(isAnnotatedVariant('C-Dur (1-Finger)')).toBe(true);
    expect(isAnnotatedVariant('G-Dur (rock)')).toBe(true);
  });
  it('returns false for plain names', () => {
    expect(isAnnotatedVariant('C-Dur')).toBe(false);
    expect(isAnnotatedVariant('Asus2')).toBe(false);
  });
});
