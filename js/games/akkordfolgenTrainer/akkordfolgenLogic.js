/**
 * akkordfolgenLogic.js
 * Pure logic for the Akkordfolgen-Trainer (chord progression trainer).
 * No DOM/audio dependencies – fully unit-testable.
 */

export const ROMAN_NUMERALS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];

// Some chord names in akkordData.js differ from the theoretical name – map them here.
const CHORD_NAME_OVERRIDES = {
  'H7': 'H7 (B7)',
};

/**
 * All 12 major keys with their diatonic triads (I–vii°) in German notation.
 * The order follows the circle of fifths starting at C.
 */
export const MAJOR_KEYS = [
  { key: 'C',   label: 'C-Dur',         chords: ['C-Dur',   'D-Moll',  'E-Moll',  'F-Dur',   'G-Dur',   'A-Moll',  'H-dim']   },
  { key: 'G',   label: 'G-Dur',         chords: ['G-Dur',   'A-Moll',  'H-Moll',  'C-Dur',   'D-Dur',   'E-Moll',  'Fis-dim'] },
  { key: 'D',   label: 'D-Dur',         chords: ['D-Dur',   'E-Moll',  'Fis-Moll','G-Dur',   'A-Dur',   'H-Moll',  'Cis-dim'] },
  { key: 'A',   label: 'A-Dur',         chords: ['A-Dur',   'H-Moll',  'Cis-Moll','D-Dur',   'E-Dur',   'Fis-Moll','Gis-dim'] },
  { key: 'E',   label: 'E-Dur',         chords: ['E-Dur',   'Fis-Moll','Gis-Moll','A-Dur',   'H-Dur',   'Cis-Moll','Dis-dim'] },
  { key: 'H',   label: 'H-Dur (B)',     chords: ['H-Dur',   'Cis-Moll','Dis-Moll','E-Dur',   'Fis-Dur', 'Gis-Moll','Ais-dim'] },
  { key: 'Fis', label: 'Fis-Dur (F#)',  chords: ['Fis-Dur', 'Gis-Moll','Ais-Moll','H-Dur',   'Cis-Dur', 'Dis-Moll','Eis-dim'] },
  { key: 'F',   label: 'F-Dur',         chords: ['F-Dur',   'G-Moll',  'A-Moll',  'B-Dur',   'C-Dur',   'D-Moll',  'E-dim']   },
  { key: 'B',   label: 'B-Dur (Bb)',    chords: ['B-Dur',   'C-Moll',  'D-Moll',  'Es-Dur',  'F-Dur',   'G-Moll',  'A-dim']   },
  { key: 'Es',  label: 'Es-Dur (Eb)',   chords: ['Es-Dur',  'F-Moll',  'G-Moll',  'As-Dur',  'B-Dur',   'C-Moll',  'D-dim']   },
  { key: 'As',  label: 'As-Dur (Ab)',   chords: ['As-Dur',  'B-Moll',  'C-Moll',  'Des-Dur', 'Es-Dur',  'F-Moll',  'G-dim']   },
  { key: 'Des', label: 'Des-Dur (Db)',  chords: ['Des-Dur', 'Es-Moll', 'F-Moll',  'Ges-Dur', 'As-Dur',  'B-Moll',  'C-dim']   },
];

/**
 * Classic chord progressions expressed as scale degree indices (0-based, 0=I).
 * blues: true → I, IV, V replaced with dominant 7th chords.
 */
export const PROGRESSIONS = [
  { name: 'I – IV – V',       degrees: [0, 3, 4],                   blues: false },
  { name: 'I – V – vi – IV',  degrees: [0, 4, 5, 3],                blues: false },
  { name: 'I – vi – IV – V',  degrees: [0, 5, 3, 4],                blues: false },
  { name: 'I – IV – I – V',   degrees: [0, 3, 0, 4],                blues: false },
  { name: '12-Bar Blues',     degrees: [0,0,0,0,3,3,0,0,4,3,0,4], blues: true  },
  { name: 'ii – V – I',       degrees: [1, 4, 0],                   blues: false },
  { name: 'I – IV – vi – V',  degrees: [0, 3, 5, 4],                blues: false },
];

/**
 * Returns the chord name for a given scale degree, with optional blues 7th conversion.
 * @param {{ chords: string[] }} key
 * @param {number} degree - 0-based scale degree
 * @param {boolean} isBlues
 * @returns {string}
 */
function getChordName(key, degree, isBlues) {
  const triadName = key.chords[degree];
  // Blues: convert I (0), IV (3), V (4) from major triad to dominant 7th
  if (!isBlues || (degree !== 0 && degree !== 3 && degree !== 4)) return triadName;
  const m = triadName.match(/^(.+)-Dur$/);
  if (!m) return triadName;
  const raw7th = `${m[1]}7`;
  return CHORD_NAME_OVERRIDES[raw7th] ?? raw7th;
}

/**
 * Builds a concrete chord progression for the given key and progression index.
 * @param {string} keyId - Key identifier (e.g. 'C', 'G')
 * @param {number} progressionIndex - Index into PROGRESSIONS
 * @returns {Array<{ name: string, numeral: string, degree: number }>}
 */
export function buildProgression(keyId, progressionIndex) {
  const key = MAJOR_KEYS.find(k => k.key === keyId);
  const prog = PROGRESSIONS[progressionIndex];
  if (!key || !prog) return [];
  return prog.degrees.map(degree => ({
    name:    getChordName(key, degree, prog.blues),
    numeral: ROMAN_NUMERALS[degree],
    degree,
  }));
}

/**
 * Creates a beat-sync object that signals when the chord should advance.
 * Returns true from onBeat() exactly on beat 0 (the downbeat), but never
 * on the very first beat 0 (which marks the start of chord 0, not an advance).
 *
 * Use this to drive chord changes from the metronome's onBeat callback
 * instead of a separate setTimeout – ensuring the "1" of the metronome
 * and the chord change always coincide.
 *
 * @returns {{ onBeat: (beatNumber: number) => boolean }}
 */
export function createBeatChordSync() {
  let started = false;
  return {
    onBeat(beatNumber) {
      if (beatNumber !== 0) return false;
      if (!started) { started = true; return false; }
      return true;
    },
  };
}

/**
 * Generates a random 4-chord diatonic progression for the given key.
 * Always starts with I, followed by 3 distinct chords from {ii, IV, V, vi}.
 * @param {string} keyId
 * @returns {Array<{ name: string, numeral: string, degree: number }>}
 */
export function generateRandomProgression(keyId) {
  const key = MAJOR_KEYS.find(k => k.key === keyId);
  if (!key) return [];
  const pool = [1, 3, 4, 5];
  const remaining = [...pool];
  const degrees = [0];
  while (degrees.length < 4 && remaining.length > 0) {
    const idx = Math.floor(Math.random() * remaining.length);
    degrees.push(remaining.splice(idx, 1)[0]);
  }
  return degrees.map(degree => ({
    name:    key.chords[degree],
    numeral: ROMAN_NUMERALS[degree],
    degree,
  }));
}
