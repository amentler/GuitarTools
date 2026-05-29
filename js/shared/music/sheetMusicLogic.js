// Notes in chromatic/C-major mix, standard tuning, frets 0–8, all 6 strings.
// Guitar is a transposing instrument: sounding pitch is one octave below written.
// vfKey uses written pitch (sounding + octave) in VexFlow format 'note/octave'.
// Array is sorted LOW → HIGH so index distance maps to approximate interval distance.
// Frets 4–5 introduce same-pitch alternatives on adjacent strings (e.g. str6/fret5 = str5/fret0 = A2).
// Accidental notes (sharps/flats) are included so they appear during the exercise.

const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const CHROMATIC_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_TO_PC = {
  C: 0, 'C#': 1, Db: 1,
  D: 2, 'D#': 3, Eb: 3,
  E: 4,
  F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8,
  A: 9, 'A#': 10, Bb: 10,
  B: 11,
};

// Diatonic chord types for scale degrees 0–6 (I ii iii IV V vi vii°)
const DIATONIC_CHORD_QUALITIES = ['', 'm', 'm', '', '', 'm', 'dim'];
// Intervals (in semitones) for each chord degree within the triad
const TRIAD_INTERVALS = {
  '':    [0, 4, 7],
  'm':   [0, 3, 7],
  'dim': [0, 3, 6],
};
const DEFAULT_KEY = 'C';
const MAX_NOTE_JUMP_STEPS = 3;

export const MAJOR_KEYS = [
  { value: 'C', label: 'C-Dur' },
  { value: 'G', label: 'G-Dur' },
  { value: 'D', label: 'D-Dur' },
  { value: 'A', label: 'A-Dur' },
  { value: 'E', label: 'E-Dur' },
  { value: 'B', label: 'B-Dur' },
  { value: 'F#', label: 'F#-Dur' },
  { value: 'C#', label: 'C#-Dur' },
  { value: 'F', label: 'F-Dur' },
  { value: 'Bb', label: 'Bb-Dur' },
  { value: 'Eb', label: 'Eb-Dur' },
  { value: 'Ab', label: 'Ab-Dur' },
];

export const NOTES = [
  { name: 'E',  octave: 2, vfKey: 'e/3',  string: 6, fret: 0 },
  { name: 'F',  octave: 2, vfKey: 'f/3',  string: 6, fret: 1 },
  { name: 'F#', octave: 2, vfKey: 'f#/3', string: 6, fret: 2 },
  { name: 'G',  octave: 2, vfKey: 'g/3',  string: 6, fret: 3 },
  { name: 'A',  octave: 2, vfKey: 'a/3',  string: 5, fret: 0 },
  { name: 'A',  octave: 2, vfKey: 'a/3',  string: 6, fret: 5 },
  { name: 'Bb', octave: 2, vfKey: 'bb/3', string: 5, fret: 1 },
  { name: 'B',  octave: 2, vfKey: 'b/3',  string: 5, fret: 2 },
  { name: 'C',  octave: 3, vfKey: 'c/4',  string: 5, fret: 3 },
  { name: 'D',  octave: 3, vfKey: 'd/4',  string: 4, fret: 0 },
  { name: 'D',  octave: 3, vfKey: 'd/4',  string: 5, fret: 5 },
  { name: 'Eb', octave: 3, vfKey: 'eb/4', string: 4, fret: 1 },
  { name: 'E',  octave: 3, vfKey: 'e/4',  string: 4, fret: 2 },
  { name: 'F',  octave: 3, vfKey: 'f/4',  string: 4, fret: 3 },
  { name: 'G',  octave: 3, vfKey: 'g/4',  string: 3, fret: 0 },
  { name: 'G',  octave: 3, vfKey: 'g/4',  string: 4, fret: 5 },
  { name: 'Ab', octave: 3, vfKey: 'ab/4', string: 3, fret: 1 },
  { name: 'A',  octave: 3, vfKey: 'a/4',  string: 3, fret: 2 },
  { name: 'Bb', octave: 3, vfKey: 'bb/4', string: 3, fret: 3 },
  { name: 'B',  octave: 3, vfKey: 'b/4',  string: 2, fret: 0 },
  { name: 'B',  octave: 3, vfKey: 'b/4',  string: 3, fret: 4 },
  { name: 'C',  octave: 4, vfKey: 'c/5',  string: 2, fret: 1 },
  { name: 'C',  octave: 4, vfKey: 'c/5',  string: 3, fret: 5 },
  { name: 'C#', octave: 4, vfKey: 'c#/5', string: 2, fret: 2 },
  { name: 'D',  octave: 4, vfKey: 'd/5',  string: 2, fret: 3 },
  { name: 'E',  octave: 4, vfKey: 'e/5',  string: 1, fret: 0 },
  { name: 'E',  octave: 4, vfKey: 'e/5',  string: 2, fret: 5 },
  { name: 'F',  octave: 4, vfKey: 'f/5',  string: 1, fret: 1 },
  { name: 'F#', octave: 4, vfKey: 'f#/5', string: 1, fret: 2 },
  { name: 'G',  octave: 4, vfKey: 'g/5',  string: 1, fret: 3 },
  { name: 'A',  octave: 4, vfKey: 'a/5',  string: 1, fret: 5 },
  { name: 'Bb', octave: 4, vfKey: 'bb/5', string: 1, fret: 6 },
  { name: 'B',  octave: 4, vfKey: 'b/5',  string: 1, fret: 7 },
  { name: 'C',  octave: 5, vfKey: 'c/6',  string: 1, fret: 8 },
];

export function normalizeMajorKey(key) {
  return Object.prototype.hasOwnProperty.call(NOTE_TO_PC, key) ? key : DEFAULT_KEY;
}

export function getMajorScalePitchClasses(key = DEFAULT_KEY) {
  const rootPc = NOTE_TO_PC[normalizeMajorKey(key)];
  return new Set(MAJOR_SCALE_INTERVALS.map(interval => (rootPc + interval) % CHROMATIC_SHARP.length));
}

export function getFilteredNotes(maxFret, activeStrings, minFret = 0, key = DEFAULT_KEY, useKey = true) {
  const scalePitchClasses = useKey ? getMajorScalePitchClasses(key) : null;
  return NOTES.filter(note => {
    const stringIndex = 6 - note.string;
    const pitchClass = NOTE_TO_PC[note.name];
    return note.fret >= minFret &&
      note.fret <= maxFret &&
      activeStrings.includes(stringIndex) &&
      (!scalePitchClasses || scalePitchClasses.has(pitchClass));
  });
}

/**
 * Returns the 7 diatonic triads for a major key.
 * Each entry: { root: string, quality: ''|'m'|'dim', label: string, pitchClasses: Set<number> }
 */
export function getDiatonicChords(key = DEFAULT_KEY) {
  const rootPc = NOTE_TO_PC[normalizeMajorKey(key)];
  return MAJOR_SCALE_INTERVALS.map((interval, degree) => {
    const chordRootPc = (rootPc + interval) % 12;
    const quality = DIATONIC_CHORD_QUALITIES[degree];
    const label = CHROMATIC_SHARP[chordRootPc] + quality;
    const pitchClasses = new Set(
      TRIAD_INTERVALS[quality].map(i => (chordRootPc + i) % 12)
    );
    return { root: CHROMATIC_SHARP[chordRootPc], quality, label, pitchClasses };
  });
}

/**
 * Generates bars where each bar is an arpeggio over a diatonic chord.
 * Each bar object gets an extra `chordLabel` property.
 *
 * @param {number} numBars
 * @param {number} beatsPerBar
 * @param {Array} notesPool - notes filtered by fret/string range
 * @param {string} key - current major key
 * @returns {Array<Array<object>>}
 */
export function generateArpeggioBars(numBars = 4, beatsPerBar = 4, notesPool = NOTES, key = DEFAULT_KEY) {
  const chords = getDiatonicChords(key);
  const pool = (notesPool && notesPool.length > 0) ? notesPool : NOTES;

  return Array.from({ length: numBars }, () => {
    // Pick a random diatonic chord
    const chord = chords[Math.floor(Math.random() * chords.length)];

    // Filter pool to notes matching this chord's pitch classes
    let chordNotes = pool.filter(n => chord.pitchClasses.has(NOTE_TO_PC[n.name]));

    // Fall back to full pool if no chord notes are available in range
    if (chordNotes.length === 0) chordNotes = pool.length > 0 ? pool : NOTES;

    // Build arpeggio: ascending through chord tones, cycling as needed
    // Deduplicate by pitch (name+octave) keeping lowest-index entry
    const seen = new Set();
    const unique = chordNotes.filter(n => {
      const k = `${n.name}${n.octave}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    const beats = Array.from({ length: beatsPerBar }, (_, i) => ({
      ...unique[i % unique.length],
    }));

    // Attach chord label to first beat (used by SVG renderer)
    beats.chordLabel = chord.label;
    return beats;
  });
}

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

export function validateTimeSignature(sig) {
  return getTimeSignatureConfig(sig) !== null;
}

export function generateBars(numBars = 4, beatsPerBar = 4, notesPool = NOTES) {
  const notes = (notesPool && notesPool.length > 0) ? notesPool : NOTES;
  const n = notes.length;
  const margin = Math.min(2, Math.floor(n / 4));
  let idx = margin + Math.floor(Math.random() * Math.max(1, n - 2 * margin));

  return Array.from({ length: numBars }, () =>
    Array.from({ length: beatsPerBar }, () => {
      const lo = Math.max(0, idx - MAX_NOTE_JUMP_STEPS);
      const hi = Math.min(n - 1, idx + MAX_NOTE_JUMP_STEPS);
      idx = lo + Math.floor(Math.random() * (hi - lo + 1));
      return { ...notes[idx] };
    })
  );
}

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

  nextBatch(count = 4) {
    const notes = this._notes;
    const n = notes.length;
    if (this._idx < 0) {
      const margin = Math.min(2, Math.floor(n / 4));
      this._idx = margin + Math.floor(Math.random() * Math.max(1, n - 2 * margin));
    }
    return Array.from({ length: count }, () =>
      Array.from({ length: this._beatsPerBar }, () => {
        const lo = Math.max(0, this._idx - MAX_NOTE_JUMP_STEPS);
        const hi = Math.min(n - 1, this._idx + MAX_NOTE_JUMP_STEPS);
        this._idx = lo + Math.floor(Math.random() * (hi - lo + 1));
        return { ...notes[this._idx] };
      })
    );
  }

  reset() {
    this._idx = -1;
  }
}

export function calcScrollTarget(rowIndex, rowDisplayHeight, viewportHeight, targetFraction = 0.33) {
  const rowTop = rowIndex * rowDisplayHeight;
  return Math.max(0, rowTop - viewportHeight * targetFraction);
}

export function calcFirstBarWidth(tsw, restBarW, marginW) {
  return tsw + (restBarW - marginW);
}
