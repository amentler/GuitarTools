// Notes in C major, standard tuning, frets 0–3, upper strings only.
// step: treble clef position (0 = bottom line E4, positive = higher, negative = lower)
// string: guitar string number in tab notation (1 = high E … 6 = low E)

export const NOTES = [
  { name: 'G', octave: 3, step: -5, string: 3, fret: 0 },
  { name: 'A', octave: 3, step: -4, string: 3, fret: 2 },
  { name: 'B', octave: 3, step: -3, string: 2, fret: 0 },
  { name: 'C', octave: 4, step: -2, string: 2, fret: 1 },
  { name: 'D', octave: 4, step: -1, string: 2, fret: 3 },
  { name: 'E', octave: 4, step:  0, string: 1, fret: 0 },
  { name: 'F', octave: 4, step:  1, string: 1, fret: 1 },
  { name: 'G', octave: 4, step:  2, string: 1, fret: 3 },
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
