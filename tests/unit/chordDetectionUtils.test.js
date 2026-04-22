import { describe, expect, it } from 'vitest';
import {
  detectPeaksFromSpectrum,
  getChordNotes,
  identifyNotesFromPeaks,
} from '../../js/utils/chordDetectionUtils.js';

describe('getChordNotes', () => {
  it('returns octave-aware sounding notes and excludes muted strings', () => {
    const notes = getChordNotes('C-Dur')
      .slice()
      .sort((a, b) => a.string - b.string);

    expect(notes).toEqual([
      { note: 'E', octave: 4, string: 1, fret: 0 },
      { note: 'C', octave: 4, string: 2, fret: 1 },
      { note: 'G', octave: 3, string: 3, fret: 0 },
      { note: 'E', octave: 3, string: 4, fret: 2 },
      { note: 'C', octave: 3, string: 5, fret: 3 },
    ]);
  });

  it('returns an empty array for unknown chords', () => {
    expect(getChordNotes('Nicht-Akkord')).toEqual([]);
  });
});

describe('detectPeaksFromSpectrum', () => {
  it('returns only local maxima within frequency window and above threshold', () => {
    const spectrum = new Float32Array(20).fill(-120);
    spectrum[2] = -20;
    spectrum[3] = -60;
    spectrum[5] = -15;
    spectrum[6] = -65;
    spectrum[8] = -10;
    spectrum[9] = -70;

    const peaks = detectPeaksFromSpectrum(spectrum, 22050, 1500, 5000, -30);

    expect(peaks).toEqual([2756.25, 4410]);
  });

  it('returns no peaks for buffers smaller than three bins', () => {
    expect(detectPeaksFromSpectrum(new Float32Array([0, 1]), 22050, 0, 5000, -60)).toEqual([]);
  });
});

describe('identifyNotesFromPeaks', () => {
  it('maps positive peak frequencies to note objects and ignores invalid values', () => {
    const detected = identifyNotesFromPeaks([82.41, 0, -3, 110, 329.63]);

    expect(detected).toHaveLength(3);
    expect(detected[0]).toMatchObject({ note: 'E', octave: 2, frequency: 82.41 });
    expect(detected[1]).toMatchObject({ note: 'A', octave: 2, frequency: 110 });
    expect(detected[2]).toMatchObject({ note: 'E', octave: 4, frequency: 329.63 });
  });
});
