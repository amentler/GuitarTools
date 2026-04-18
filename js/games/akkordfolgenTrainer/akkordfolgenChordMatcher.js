/**
 * akkordfolgenChordMatcher.js
 * Pure logic: German chord name → expected note classes → match against detected notes.
 * Covers all chord types from akkordfolgenLogic.js (Dur, Moll, dim, dominant 7th).
 * No DOM/audio dependencies — fully unit-testable.
 */

import { NOTE_NAMES } from '../../tools/guitarTuner/pitchLogic.js';

// German note name → chromatic index (C=0 … B=11, using sharp/English notation)
const GERMAN_TO_CHROMA = {
  'C':   0,
  'Cis': 1, 'Des': 1,
  'D':   2,
  'Dis': 3, 'Es':  3,
  'E':   4, 'Fes': 4,
  'Eis': 5,
  'F':   5,
  'Fis': 6, 'Ges': 6,
  'G':   7,
  'Gis': 8, 'As':  8,
  'A':   9,
  'Ais': 10, 'B':  10, // German B = Bb = A# in English notation
  'H':   11,
};

// Chord type suffix → intervals from root in semitones
const TYPE_INTERVALS = {
  'Dur':  [0, 4, 7],       // major triad
  'Moll': [0, 3, 7],       // minor triad
  'dim':  [0, 3, 6],       // diminished triad
  'aug':  [0, 4, 8],       // augmented triad
  '7':    [0, 4, 7, 10],   // dominant 7th
  'maj7': [0, 4, 7, 11],   // major 7th
  'm7':   [0, 3, 7, 10],   // minor 7th
};

/**
 * Parses a German chord name into { root, type }.
 * Returns null for unrecognised names.
 *
 * Supported formats:
 *   "C-Dur"     → { root: 'C',   type: 'Dur'  }
 *   "H-Moll"    → { root: 'H',   type: 'Moll' }
 *   "Fis-dim"   → { root: 'Fis', type: 'dim'  }
 *   "G7"        → { root: 'G',   type: '7'    }
 *   "H7 (B7)"   → { root: 'H',   type: '7'    }
 *
 * @param {string} chordName
 * @returns {{ root: string, type: string } | null}
 */
export function parseChordName(chordName) {
  if (!chordName || typeof chordName !== 'string') return null;

  // Strip trailing annotations like " (B7)" or " (1-Finger)"
  const cleaned = chordName.replace(/\s*\([^)]*\)\s*$/, '').trim();

  // Format: ROOT-TYPE  e.g. "C-Dur", "Fis-Moll", "H-dim"
  const hyphenMatch = cleaned.match(/^([A-Z][a-z]*)-([A-Za-z]+)$/);
  if (hyphenMatch) {
    const root = hyphenMatch[1];
    const type = hyphenMatch[2];
    if (GERMAN_TO_CHROMA[root] !== undefined && TYPE_INTERVALS[type] !== undefined) {
      return { root, type };
    }
  }

  // Format: ROOT7  e.g. "G7", "C7", "H7"
  const dom7Match = cleaned.match(/^([A-Z][a-z]*)7$/);
  if (dom7Match) {
    const root = dom7Match[1];
    if (GERMAN_TO_CHROMA[root] !== undefined) {
      return { root, type: '7' };
    }
  }

  return null;
}

/**
 * Returns the expected note classes (English sharp notation) for a German chord name.
 * Returns empty array for unrecognised chord names.
 *
 * @param {string} chordName - e.g. 'C-Dur', 'H-Moll', 'Fis-dim', 'G7'
 * @returns {string[]} - e.g. ['C', 'E', 'G']
 */
export function getExpectedNoteClasses(chordName) {
  const parsed = parseChordName(chordName);
  if (!parsed) return [];

  const rootChroma = GERMAN_TO_CHROMA[parsed.root];
  const intervals = TYPE_INTERVALS[parsed.type];
  return intervals.map(interval => NOTE_NAMES[(rootChroma + interval) % 12]);
}

/**
 * Matches a set of detected note names against the expected notes of a chord.
 * Extra detected notes are allowed (octave doublings, harmonics).
 *
 * @param {string[]} detectedNoteNames - English note names e.g. ['C', 'E', 'G', 'C#']
 * @param {string} chordName - German chord name e.g. 'C-Dur'
 * @returns {{ isMatch: boolean, confidence: number, missingNotes: string[] }}
 *   isMatch: true when every expected note class was detected
 *   confidence: fraction of expected notes detected (0–1)
 *   missingNotes: expected note names absent from the detection
 */
export function matchDetectedNotes(detectedNoteNames, chordName) {
  const expected = getExpectedNoteClasses(chordName);
  if (expected.length === 0) {
    return { isMatch: false, confidence: 0, missingNotes: [] };
  }

  const detectedSet = new Set(detectedNoteNames);
  const missingNotes = expected.filter(n => !detectedSet.has(n));
  const confidence = (expected.length - missingNotes.length) / expected.length;

  return { isMatch: missingNotes.length === 0, confidence, missingNotes };
}
