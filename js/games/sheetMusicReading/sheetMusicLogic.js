// Notes in C major, standard tuning, frets 0–3, all 6 strings.
// Guitar is a transposing instrument: sounding pitch is one octave below written.
// vfKey uses written pitch (sounding + octave) in VexFlow format 'note/octave'.
// string: tab notation (1 = high E … 6 = low E)

export const NOTES = [
  // ── String 1 – high E (sounds E4, writes E5) ───────────────────────────
  { name: 'E', octave: 4, vfKey: 'e/5', string: 1, fret: 0 },
  { name: 'F', octave: 4, vfKey: 'f/5', string: 1, fret: 1 },
  { name: 'G', octave: 4, vfKey: 'g/5', string: 1, fret: 3 },
  // ── String 2 – B (sounds B3, writes B4) ────────────────────────────────
  { name: 'B', octave: 3, vfKey: 'b/4', string: 2, fret: 0 },
  { name: 'C', octave: 4, vfKey: 'c/5', string: 2, fret: 1 },
  { name: 'D', octave: 4, vfKey: 'd/5', string: 2, fret: 3 },
  // ── String 3 – G (sounds G3, writes G4) ────────────────────────────────
  { name: 'G', octave: 3, vfKey: 'g/4', string: 3, fret: 0 },
  { name: 'A', octave: 3, vfKey: 'a/4', string: 3, fret: 2 },
  // ── String 4 – D (sounds D3, writes D4) ────────────────────────────────
  { name: 'D', octave: 3, vfKey: 'd/4', string: 4, fret: 0 },
  { name: 'E', octave: 3, vfKey: 'e/4', string: 4, fret: 2 },
  { name: 'F', octave: 3, vfKey: 'f/4', string: 4, fret: 3 },
  // ── String 5 – A (sounds A2, writes A3) ────────────────────────────────
  { name: 'A', octave: 2, vfKey: 'a/3', string: 5, fret: 0 },
  { name: 'B', octave: 2, vfKey: 'b/3', string: 5, fret: 2 },
  { name: 'C', octave: 3, vfKey: 'c/4', string: 5, fret: 3 },
  // ── String 6 – low E (sounds E2, writes E3) ────────────────────────────
  { name: 'E', octave: 2, vfKey: 'e/3', string: 6, fret: 0 },
  { name: 'F', octave: 2, vfKey: 'f/3', string: 6, fret: 1 },
  { name: 'G', octave: 2, vfKey: 'g/3', string: 6, fret: 3 },
];

/**
 * Generates random 4/4 bars of single quarter notes in C major (frets 0–3).
 * @param {number} numBars
 * @param {number} beatsPerBar
 * @returns {Array<Array<object>>}
 */
export function generateBars(numBars = 4, beatsPerBar = 4) {
  return Array.from({ length: numBars }, () =>
    Array.from({ length: beatsPerBar }, () =>
      NOTES[Math.floor(Math.random() * NOTES.length)]
    )
  );
}
