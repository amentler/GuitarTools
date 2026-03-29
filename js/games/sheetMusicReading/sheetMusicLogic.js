// Notes in C major, standard tuning, frets 0–3, all 6 strings.
// step: treble clef position (0 = bottom line E4, positive = higher, negative = lower)
// string: guitar string number in tab notation (1 = high E … 6 = low E)

export const NOTES = [
  // ── String 1 – high E (E4) ─────────────────────────────────────────────
  { name: 'E', octave: 4, step:   0, string: 1, fret: 0 },
  { name: 'F', octave: 4, step:   1, string: 1, fret: 1 },
  { name: 'G', octave: 4, step:   2, string: 1, fret: 3 },
  // ── String 2 – B (B3) ──────────────────────────────────────────────────
  { name: 'B', octave: 3, step:  -3, string: 2, fret: 0 },
  { name: 'C', octave: 4, step:  -2, string: 2, fret: 1 },
  { name: 'D', octave: 4, step:  -1, string: 2, fret: 3 },
  // ── String 3 – G (G3) ──────────────────────────────────────────────────
  { name: 'G', octave: 3, step:  -5, string: 3, fret: 0 },
  { name: 'A', octave: 3, step:  -4, string: 3, fret: 2 },
  // ── String 4 – D (D3) ──────────────────────────────────────────────────
  { name: 'D', octave: 3, step:  -8, string: 4, fret: 0 },
  { name: 'E', octave: 3, step:  -7, string: 4, fret: 2 },
  { name: 'F', octave: 3, step:  -6, string: 4, fret: 3 },
  // ── String 5 – A (A2) ──────────────────────────────────────────────────
  { name: 'A', octave: 2, step: -11, string: 5, fret: 0 },
  { name: 'B', octave: 2, step: -10, string: 5, fret: 2 },
  { name: 'C', octave: 3, step:  -9, string: 5, fret: 3 },
  // ── String 6 – low E (E2) ──────────────────────────────────────────────
  { name: 'E', octave: 2, step: -14, string: 6, fret: 0 },
  { name: 'F', octave: 2, step: -13, string: 6, fret: 1 },
  { name: 'G', octave: 2, step: -12, string: 6, fret: 3 },
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
