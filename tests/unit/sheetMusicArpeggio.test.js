import { describe, it, expect } from 'vitest';
import {
  getDiatonicChords,
  generateArpeggioBars,
  getFilteredNotes,
  ArpeggioBarGenerator,
} from '../../js/games/sheetMusicReading/sheetMusicLogic.js';

describe('getDiatonicChords', () => {
  it('returns 7 chords for C major', () => {
    const chords = getDiatonicChords('C');
    expect(chords).toHaveLength(7);
  });

  it('returns correct chord names for C major', () => {
    const names = getDiatonicChords('C').map(c => c.name);
    expect(names).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°']);
  });

  it('returns correct chord names for G major', () => {
    const names = getDiatonicChords('G').map(c => c.name);
    expect(names).toEqual(['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#°']);
  });

  it('returns correct chord names for F major', () => {
    const names = getDiatonicChords('F').map(c => c.name);
    expect(names).toEqual(['F', 'Gm', 'Am', 'Bb', 'C', 'Dm', 'E°']);
  });

  it('each chord has a pitchClasses Set with 3 pitch classes', () => {
    const chords = getDiatonicChords('C');
    for (const chord of chords) {
      expect(chord.pitchClasses).toBeInstanceOf(Set);
      expect(chord.pitchClasses.size).toBe(3);
    }
  });

  it('C major chord (I) contains pitch classes 0, 4, 7', () => {
    const chords = getDiatonicChords('C');
    const cMajor = chords[0];
    expect(cMajor.pitchClasses.has(0)).toBe(true); // C
    expect(cMajor.pitchClasses.has(4)).toBe(true); // E
    expect(cMajor.pitchClasses.has(7)).toBe(true); // G
  });

  it('G major chord (V of C) contains pitch classes 7, 11, 2', () => {
    const chords = getDiatonicChords('C');
    const gMajor = chords[4];
    expect(gMajor.pitchClasses.has(7)).toBe(true);  // G
    expect(gMajor.pitchClasses.has(11)).toBe(true); // B
    expect(gMajor.pitchClasses.has(2)).toBe(true);  // D
  });

  it('defaults to C major when key is not provided', () => {
    const names = getDiatonicChords().map(c => c.name);
    expect(names[0]).toBe('C');
  });
});

describe('generateArpeggioBars', () => {
  it('returns the correct number of bars', () => {
    const { bars } = generateArpeggioBars(4, 4);
    expect(bars).toHaveLength(4);
  });

  it('each bar has the correct number of notes', () => {
    const { bars } = generateArpeggioBars(4, 3);
    for (const bar of bars) {
      expect(bar).toHaveLength(3);
    }
  });

  it('returns a barChords array with one label per bar', () => {
    const { barChords } = generateArpeggioBars(4, 4);
    expect(barChords).toHaveLength(4);
    for (const label of barChords) {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('chord names in barChords come from the diatonic chords of the key', () => {
    const key = 'C';
    const validNames = new Set(getDiatonicChords(key).map(c => c.name));
    const { barChords } = generateArpeggioBars(4, 4, undefined, key);
    for (const name of barChords) {
      expect(validNames.has(name)).toBe(true);
    }
  });

  it('all notes in each bar are chord tones when pool is large enough', () => {
    const notesToPc = {
      C: 0, 'C#': 1, Db: 1,
      D: 2, 'D#': 3, Eb: 3,
      E: 4, F: 5, 'F#': 6, Gb: 6,
      G: 7, 'G#': 8, Ab: 8,
      A: 9, 'A#': 10, Bb: 10,
      B: 11,
    };
    const chords = getDiatonicChords('C');
    const chordsByName = Object.fromEntries(chords.map(c => [c.name, c]));

    // Use a large pool so chord tone filtering has plenty to work with
    const pool = getFilteredNotes(8, [0, 1, 2, 3, 4, 5], 0, 'C');
    const { bars, barChords } = generateArpeggioBars(4, 4, pool, 'C');

    for (let i = 0; i < bars.length; i++) {
      const chord = chordsByName[barChords[i]];
      for (const note of bars[i]) {
        expect(chord.pitchClasses.has(notesToPc[note.name])).toBe(true);
      }
    }
  });

  it('falls back gracefully when notesPool is empty', () => {
    const { bars, barChords } = generateArpeggioBars(2, 2, [], 'C');
    expect(bars).toHaveLength(2);
    expect(barChords).toHaveLength(2);
  });
});

describe('getFilteredNotes with key=null', () => {
  it('returns more notes with key=null than with key=C (all chromatic notes)', () => {
    const withKey  = getFilteredNotes(3, [0, 1, 2, 3, 4, 5], 0, 'C');
    const noKey    = getFilteredNotes(3, [0, 1, 2, 3, 4, 5], 0, null);
    expect(noKey.length).toBeGreaterThan(withKey.length);
  });

  it('includes accidental notes when key=null', () => {
    const result = getFilteredNotes(3, [0, 1, 2, 3, 4, 5], 0, null);
    const hasAccidental = result.some(n => n.vfKey.includes('#') || /[a-g]b\//.test(n.vfKey));
    expect(hasAccidental).toBe(true);
  });

  it('key=undefined behaves the same as key=C (backwards compatibility)', () => {
    const withDefault  = getFilteredNotes(3, [0, 1, 2, 3, 4, 5]);
    const withUndefined = getFilteredNotes(3, [0, 1, 2, 3, 4, 5], 0, undefined);
    expect(withDefault.length).toBe(withUndefined.length);
  });
});

describe('ArpeggioBarGenerator', () => {
  it('nextBatch returns the correct number of bars', () => {
    const gen = new ArpeggioBarGenerator(4, getFilteredNotes(3, [0,1,2,3,4,5], 0, 'C'), 'C');
    const bars = gen.nextBatch(4);
    expect(bars).toHaveLength(4);
  });

  it('nextBatchWithChords returns bars and barChords', () => {
    const gen = new ArpeggioBarGenerator(4, getFilteredNotes(3, [0,1,2,3,4,5], 0, 'C'), 'C');
    const { bars, barChords } = gen.nextBatchWithChords(4);
    expect(bars).toHaveLength(4);
    expect(barChords).toHaveLength(4);
  });
});
