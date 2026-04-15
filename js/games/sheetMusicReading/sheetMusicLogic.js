// Notes in C major, standard tuning, frets 0–3, all 6 strings.
// Guitar is a transposing instrument: sounding pitch is one octave below written.
// vfKey uses written pitch (sounding + octave) in VexFlow format 'note/octave'.
// Array is sorted LOW → HIGH so index distance maps to diatonic interval distance.

export const NOTES = [
  // ── String 6 – low E (sounds E2, writes E3) ────────────────────────────
  { name: 'E', octave: 2, vfKey: 'e/3', string: 6, fret: 0 },  // rank  0
  { name: 'F', octave: 2, vfKey: 'f/3', string: 6, fret: 1 },  // rank  1
  { name: 'G', octave: 2, vfKey: 'g/3', string: 6, fret: 3 },  // rank  2
  // ── String 5 – A (sounds A2, writes A3) ────────────────────────────────
  { name: 'A', octave: 2, vfKey: 'a/3', string: 5, fret: 0 },  // rank  3
  { name: 'B', octave: 2, vfKey: 'b/3', string: 5, fret: 2 },  // rank  4
  { name: 'C', octave: 3, vfKey: 'c/4', string: 5, fret: 3 },  // rank  5
  // ── String 4 – D (sounds D3, writes D4) ────────────────────────────────
  { name: 'D', octave: 3, vfKey: 'd/4', string: 4, fret: 0 },  // rank  6
  { name: 'E', octave: 3, vfKey: 'e/4', string: 4, fret: 2 },  // rank  7
  { name: 'F', octave: 3, vfKey: 'f/4', string: 4, fret: 3 },  // rank  8
  // ── String 3 – G (sounds G3, writes G4) ────────────────────────────────
  { name: 'G', octave: 3, vfKey: 'g/4', string: 3, fret: 0 },  // rank  9
  { name: 'A', octave: 3, vfKey: 'a/4', string: 3, fret: 2 },  // rank 10
  // ── String 2 – B (sounds B3, writes B4) ────────────────────────────────
  { name: 'B', octave: 3, vfKey: 'b/4', string: 2, fret: 0 },  // rank 11
  { name: 'C', octave: 4, vfKey: 'c/5', string: 2, fret: 1 },  // rank 12
  { name: 'D', octave: 4, vfKey: 'd/5', string: 2, fret: 3 },  // rank 13
  // ── String 1 – high E (sounds E4, writes E5) ───────────────────────────
  { name: 'E', octave: 4, vfKey: 'e/5', string: 1, fret: 0 },  // rank 14
  { name: 'F', octave: 4, vfKey: 'f/5', string: 1, fret: 1 },  // rank 15
  { name: 'G', octave: 4, vfKey: 'g/5', string: 1, fret: 3 },  // rank 16
];

/**
 * Returns notes filtered by maximum fret and active strings.
 * @param {number} maxFret - Highest fret to include (0–3)
 * @param {number[]} activeStrings - 0-based string indices (0 = low E / string 6, 5 = high E / string 1)
 * @returns {Array<object>}
 */
export function getFilteredNotes(maxFret, activeStrings) {
  return NOTES.filter(note => {
    const stringIndex = 6 - note.string; // guitar string 6..1 → 0-based index 0..5
    return note.fret <= maxFret && activeStrings.includes(stringIndex);
  });
}

/**
 * Returns configuration for a given time signature string.
 * Supports 2/4, 3/4, 4/4 (quarter-note based) and 3/8, 6/8 (eighth-note based).
 *
 * @param {string} timeSignature - e.g. '4/4', '3/4', '6/8'
 * @returns {{ beatsPerBar: number, noteDuration: string, vfTimeSig: string } | null}
 *          null if the time signature is not supported.
 */
export function getTimeSignatureConfig(timeSignature) {
  const configs = {
    '2/4': { beatsPerBar: 2, noteDuration: 'q', vfTimeSig: '2/4' },
    '3/4': { beatsPerBar: 3, noteDuration: 'q', vfTimeSig: '3/4' },
    '4/4': { beatsPerBar: 4, noteDuration: 'q', vfTimeSig: '4/4' },
    '3/8': { beatsPerBar: 3, noteDuration: 'e', vfTimeSig: '3/8' },
    '6/8': { beatsPerBar: 6, noteDuration: 'e', vfTimeSig: '6/8' },
  };
  return configs[timeSignature] || null;
}

/**
 * Returns true if the given string is a supported time signature.
 * @param {string} sig
 * @returns {boolean}
 */
export function validateTimeSignature(sig) {
  return getTimeSignatureConfig(sig) !== null;
}

/**
 * Generates random 4/4 bars of single quarter notes in C major (frets 0–3).
 * Consecutive notes are constrained to at most a third (±2 diatonic steps).
 * @param {number} numBars
 * @param {number} beatsPerBar
 * @param {Array<object>} [notesPool] - Optional filtered notes pool; falls back to NOTES
 * @returns {Array<Array<object>>}
 */
export function generateBars(numBars = 4, beatsPerBar = 4, notesPool = NOTES) {
  const notes = (notesPool && notesPool.length > 0) ? notesPool : NOTES;
  const n = notes.length;
  // Start in the middle of the range to avoid clustering at extremes
  const margin = Math.min(2, Math.floor(n / 4));
  let idx = margin + Math.floor(Math.random() * Math.max(1, n - 2 * margin));

  return Array.from({ length: numBars }, () =>
    Array.from({ length: beatsPerBar }, () => {
      const lo = Math.max(0, idx - 2);
      const hi = Math.min(n - 1, idx + 2);
      idx = lo + Math.floor(Math.random() * (hi - lo + 1));
      return notes[idx];
    })
  );
}
