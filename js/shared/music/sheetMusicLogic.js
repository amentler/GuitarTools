// Notes in C major, standard tuning, frets 0–5, all 6 strings.
// Guitar is a transposing instrument: sounding pitch is one octave below written.
// vfKey uses written pitch (sounding + octave) in VexFlow format 'note/octave'.
// Array is sorted LOW → HIGH so index distance maps to diatonic interval distance.
// Frets 4–5 introduce same-pitch alternatives on adjacent strings (e.g. str6/fret5 = str5/fret0 = A2).

export const NOTES = [
  { name: 'E', octave: 2, vfKey: 'e/3', string: 6, fret: 0 },
  { name: 'F', octave: 2, vfKey: 'f/3', string: 6, fret: 1 },
  { name: 'G', octave: 2, vfKey: 'g/3', string: 6, fret: 3 },
  { name: 'A', octave: 2, vfKey: 'a/3', string: 5, fret: 0 },
  { name: 'A', octave: 2, vfKey: 'a/3', string: 6, fret: 5 },
  { name: 'B', octave: 2, vfKey: 'b/3', string: 5, fret: 2 },
  { name: 'C', octave: 3, vfKey: 'c/4', string: 5, fret: 3 },
  { name: 'D', octave: 3, vfKey: 'd/4', string: 4, fret: 0 },
  { name: 'D', octave: 3, vfKey: 'd/4', string: 5, fret: 5 },
  { name: 'E', octave: 3, vfKey: 'e/4', string: 4, fret: 2 },
  { name: 'F', octave: 3, vfKey: 'f/4', string: 4, fret: 3 },
  { name: 'G', octave: 3, vfKey: 'g/4', string: 3, fret: 0 },
  { name: 'G', octave: 3, vfKey: 'g/4', string: 4, fret: 5 },
  { name: 'A', octave: 3, vfKey: 'a/4', string: 3, fret: 2 },
  { name: 'B', octave: 3, vfKey: 'b/4', string: 2, fret: 0 },
  { name: 'B', octave: 3, vfKey: 'b/4', string: 3, fret: 4 },
  { name: 'C', octave: 4, vfKey: 'c/5', string: 2, fret: 1 },
  { name: 'C', octave: 4, vfKey: 'c/5', string: 3, fret: 5 },
  { name: 'D', octave: 4, vfKey: 'd/5', string: 2, fret: 3 },
  { name: 'E', octave: 4, vfKey: 'e/5', string: 1, fret: 0 },
  { name: 'E', octave: 4, vfKey: 'e/5', string: 2, fret: 5 },
  { name: 'F', octave: 4, vfKey: 'f/5', string: 1, fret: 1 },
  { name: 'G', octave: 4, vfKey: 'g/5', string: 1, fret: 3 },
  { name: 'A', octave: 4, vfKey: 'a/5', string: 1, fret: 5 },
];

export function getFilteredNotes(maxFret, activeStrings) {
  return NOTES.filter(note => {
    const stringIndex = 6 - note.string;
    return note.fret <= maxFret && activeStrings.includes(stringIndex);
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
      const lo = Math.max(0, idx - 2);
      const hi = Math.min(n - 1, idx + 2);
      idx = lo + Math.floor(Math.random() * (hi - lo + 1));
      return notes[idx];
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
        const lo = Math.max(0, this._idx - 2);
        const hi = Math.min(n - 1, this._idx + 2);
        this._idx = lo + Math.floor(Math.random() * (hi - lo + 1));
        return notes[this._idx];
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
