// Notes in C major, standard tuning, frets 0–5, all 6 strings.
// Guitar is a transposing instrument: sounding pitch is one octave below written.
// vfKey uses written pitch (sounding + octave) in VexFlow format 'note/octave'.
// Array is sorted LOW → HIGH so index distance maps to diatonic interval distance.
// Frets 4–5 introduce same-pitch alternatives on adjacent strings (e.g. str6/fret5 = str5/fret0 = A2).

export const NOTES = [
  // ── String 6 – low E (sounds E2, writes E3) ────────────────────────────
  { name: 'E', octave: 2, vfKey: 'e/3', string: 6, fret: 0 },  // rank  0
  { name: 'F', octave: 2, vfKey: 'f/3', string: 6, fret: 1 },  // rank  1
  { name: 'G', octave: 2, vfKey: 'g/3', string: 6, fret: 3 },  // rank  2
  // ── A2 – str5/fret0 and str6/fret5 ────────────────────────────────────
  { name: 'A', octave: 2, vfKey: 'a/3', string: 5, fret: 0 },  // rank  3
  { name: 'A', octave: 2, vfKey: 'a/3', string: 6, fret: 5 },  // rank  4
  { name: 'B', octave: 2, vfKey: 'b/3', string: 5, fret: 2 },  // rank  5
  { name: 'C', octave: 3, vfKey: 'c/4', string: 5, fret: 3 },  // rank  6
  // ── D3 – str4/fret0 and str5/fret5 ────────────────────────────────────
  { name: 'D', octave: 3, vfKey: 'd/4', string: 4, fret: 0 },  // rank  7
  { name: 'D', octave: 3, vfKey: 'd/4', string: 5, fret: 5 },  // rank  8
  { name: 'E', octave: 3, vfKey: 'e/4', string: 4, fret: 2 },  // rank  9
  { name: 'F', octave: 3, vfKey: 'f/4', string: 4, fret: 3 },  // rank 10
  // ── G3 – str3/fret0 and str4/fret5 ────────────────────────────────────
  { name: 'G', octave: 3, vfKey: 'g/4', string: 3, fret: 0 },  // rank 11
  { name: 'G', octave: 3, vfKey: 'g/4', string: 4, fret: 5 },  // rank 12
  { name: 'A', octave: 3, vfKey: 'a/4', string: 3, fret: 2 },  // rank 13
  // ── B3 – str2/fret0 and str3/fret4 ────────────────────────────────────
  { name: 'B', octave: 3, vfKey: 'b/4', string: 2, fret: 0 },  // rank 14
  { name: 'B', octave: 3, vfKey: 'b/4', string: 3, fret: 4 },  // rank 15
  // ── C4 – str2/fret1 and str3/fret5 ────────────────────────────────────
  { name: 'C', octave: 4, vfKey: 'c/5', string: 2, fret: 1 },  // rank 16
  { name: 'C', octave: 4, vfKey: 'c/5', string: 3, fret: 5 },  // rank 17
  { name: 'D', octave: 4, vfKey: 'd/5', string: 2, fret: 3 },  // rank 18
  // ── E4 – str1/fret0 and str2/fret5 ────────────────────────────────────
  { name: 'E', octave: 4, vfKey: 'e/5', string: 1, fret: 0 },  // rank 19
  { name: 'E', octave: 4, vfKey: 'e/5', string: 2, fret: 5 },  // rank 20
  { name: 'F', octave: 4, vfKey: 'f/5', string: 1, fret: 1 },  // rank 21
  { name: 'G', octave: 4, vfKey: 'g/5', string: 1, fret: 3 },  // rank 22
  // ── A4 – str1/fret5 (highest note in pool) ─────────────────────────────
  { name: 'A', octave: 4, vfKey: 'a/5', string: 1, fret: 5 },  // rank 23
];

/**
 * Returns notes filtered by maximum fret and active strings.
 * @param {number} maxFret - Highest fret to include (0–5)
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
 * Generates random bars of single notes in C major (frets 0–5).
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

/**
 * Stateful endless bar generator — maintains melodic continuity across batches.
 * Use nextBatch(count) to generate successive rows without melodic jumps at boundaries.
 */
export class EndlessBarGenerator {
  constructor(beatsPerBar, notesPool = NOTES) {
    this._beatsPerBar = beatsPerBar;
    this._notes = (notesPool && notesPool.length > 0) ? notesPool : NOTES;
    this._idx = -1;
  }

  setNotesPool(pool) {
    this._notes = (pool && pool.length > 0) ? pool : NOTES;
  }

  setBeatsPerBar(beats) {
    this._beatsPerBar = beats;
  }

  /** Generates the next `count` bars, maintaining melodic continuity from the previous call. */
  nextBatch(count = 4) {
    const notes = this._notes;
    const n = notes.length;
    if (this._idx < 0) {
      const margin = Math.min(2, Math.floor(n / 4));
      this._idx = margin + Math.floor(Math.random() * Math.max(1, n - 2 * margin));
    }
    return Array.from({ length: count }, () =>
      Array.from({ length: this._beatsPerBar }, () => {
        const lo = Math.max(0, this._idx - 2);
        const hi = Math.min(n - 1, this._idx + 2);
        this._idx = lo + Math.floor(Math.random() * (hi - lo + 1));
        return notes[this._idx];
      })
    );
  }

  /** Resets the generator so the next nextBatch() starts a fresh sequence. */
  reset() {
    this._idx = -1;
  }
}

/**
 * Calculates the scroll target (container.scrollTop) to keep a given row
 * at `targetFraction` from the top of the viewport.
 *
 * @param {number} rowIndex         - 0-based row index
 * @param {number} rowDisplayHeight - Pixel height of one row in the DOM
 * @param {number} viewportHeight   - Pixel height of the scroll container
 * @param {number} [targetFraction] - Fraction from top (default 0.33)
 * @returns {number} scrollTop value (≥ 0)
 */
export function calcScrollTarget(rowIndex, rowDisplayHeight, viewportHeight, targetFraction = 0.33) {
  const rowTop = rowIndex * rowDisplayHeight;
  return Math.max(0, rowTop - viewportHeight * targetFraction);
}

/**
 * Computes the correct width for bar 0 so its note area equals that of bars 1–N.
 * Bar 0 is wider because it hosts the clef + time signature glyphs (tsw px),
 * while bars 1–N have only a small leading margin (marginW px).
 *
 * @param {number} tsw      Clef + time-sig width in viewBox units (measured from VexFlow)
 * @param {number} restBarW Width of bars 1–N
 * @param {number} marginW  Leading margin in bars 1–N
 * @returns {number}
 */
export function calcFirstBarWidth(tsw, restBarW, marginW) {
  return tsw + (restBarW - marginW);
}
