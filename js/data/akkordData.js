/**
 * akkordData.js
 * Single Source of Truth for all chord definitions.
 * String mapping: 1 = high e (top), 6 = low E (bottom)
 *
 * Format per string:
 * { string: 1-6, fret: 0-n, muted?: true, finger?: 1|2|3|4 }
 * finger is ONLY set when fret > 0 (fretted notes)
 * finger is NOT set on open strings (fret === 0) or muted strings (muted: true)
 */

export const CHORDS = {
  // --- 1. Vereinfachte Einsteiger-Akkorde (Simplified) ---
  "G-Dur (1-Finger)": [
    { string: 6, muted: true },
    { string: 5, muted: true },
    { string: 4, fret: 0 },
    { string: 3, fret: 0 },
    { string: 2, fret: 0 },
    { string: 1, fret: 3, finger: 1 }
  ],
  "C-Dur (1-Finger)": [
    { string: 6, muted: true },
    { string: 5, muted: true },
    { string: 4, muted: true },
    { string: 3, fret: 0 },
    { string: 2, fret: 1, finger: 1 },
    { string: 1, fret: 0 }
  ],
  "E-Moll (2-Finger)": [
    { string: 6, fret: 0 },
    { string: 5, fret: 2, finger: 2 },
    { string: 4, fret: 2, finger: 3 },
    { string: 3, fret: 0 },
    { string: 2, fret: 0 },
    { string: 1, fret: 0 }
  ],
  "A-Moll (2-Finger)": [
    { string: 6, muted: true },
    { string: 5, fret: 0 },
    { string: 4, fret: 2, finger: 2 },
    { string: 3, fret: 2, finger: 3 },
    { string: 2, fret: 0 },
    { string: 1, fret: 0 }
  ],

  // --- 2. Einsteiger-Akkorde (Standard CAGED) ---
  "C-Dur": [
    { string: 6, muted: true },
    { string: 5, fret: 3, finger: 3 },
    { string: 4, fret: 2, finger: 2 },
    { string: 3, fret: 0 },
    { string: 2, fret: 1, finger: 1 },
    { string: 1, fret: 0 }
  ],
  "G-Dur": [
    { string: 6, fret: 3, finger: 2 },
    { string: 5, fret: 2, finger: 1 },
    { string: 4, fret: 0 },
    { string: 3, fret: 0 },
    { string: 2, fret: 0 },
    { string: 1, fret: 3, finger: 4 }
  ],
  "D-Dur": [
    { string: 6, muted: true },
    { string: 5, muted: true },
    { string: 4, fret: 0 },
    { string: 3, fret: 2, finger: 1 },
    { string: 2, fret: 3, finger: 3 },
    { string: 1, fret: 2, finger: 2 }
  ],
  "E-Moll": [
    { string: 6, fret: 0 },
    { string: 5, fret: 2, finger: 2 },
    { string: 4, fret: 2, finger: 3 },
    { string: 3, fret: 0 },
    { string: 2, fret: 0 },
    { string: 1, fret: 0 }
  ],
  "A-Moll": [
    { string: 6, muted: true },
    { string: 5, fret: 0 },
    { string: 4, fret: 2, finger: 2 },
    { string: 3, fret: 2, finger: 3 },
    { string: 2, fret: 1, finger: 1 },
    { string: 1, fret: 0 }
  ],
  "E-Dur": [
    { string: 6, fret: 0 },
    { string: 5, fret: 2, finger: 2 },
    { string: 4, fret: 2, finger: 3 },
    { string: 3, fret: 1, finger: 1 },
    { string: 2, fret: 0 },
    { string: 1, fret: 0 }
  ],
  "A-Dur": [
    { string: 6, muted: true },
    { string: 5, fret: 0 },
    { string: 4, fret: 2, finger: 1 },
    { string: 3, fret: 2, finger: 2 },
    { string: 2, fret: 2, finger: 3 },
    { string: 1, fret: 0 }
  ],
  "D-Moll": [
    { string: 6, muted: true },
    { string: 5, muted: true },
    { string: 4, fret: 0 },
    { string: 3, fret: 2, finger: 2 },
    { string: 2, fret: 3, finger: 3 },
    { string: 1, fret: 1, finger: 1 }
  ],

  // --- 3. Weiterführende Akkorde (Extended) ---
  "G7": [
    { string: 6, fret: 3, finger: 3 },
    { string: 5, fret: 2, finger: 2 },
    { string: 4, fret: 0 },
    { string: 3, fret: 0 },
    { string: 2, fret: 0 },
    { string: 1, fret: 1, finger: 1 }
  ],
  "C7": [
    { string: 6, muted: true },
    { string: 5, fret: 3, finger: 3 },
    { string: 4, fret: 2, finger: 2 },
    { string: 3, fret: 3, finger: 4 },
    { string: 2, fret: 1, finger: 1 },
    { string: 1, fret: 0 }
  ],
  "D7": [
    { string: 6, muted: true },
    { string: 5, muted: true },
    { string: 4, fret: 0 },
    { string: 3, fret: 2, finger: 2 },
    { string: 2, fret: 1, finger: 1 },
    { string: 1, fret: 2, finger: 3 }
  ],
  "A7": [
    { string: 6, muted: true },
    { string: 5, fret: 0 },
    { string: 4, fret: 2, finger: 2 },
    { string: 3, fret: 0 },
    { string: 2, fret: 2, finger: 3 },
    { string: 1, fret: 0 }
  ],
  "E7": [
    { string: 6, fret: 0 },
    { string: 5, fret: 2, finger: 2 },
    { string: 4, fret: 0 },
    { string: 3, fret: 1, finger: 1 },
    { string: 2, fret: 0 },
    { string: 1, fret: 0 }
  ],
  "F-Dur (klein)": [
    { string: 6, muted: true },
    { string: 5, muted: true },
    { string: 4, fret: 3, finger: 4 },
    { string: 3, fret: 2, finger: 3 },
    { string: 2, fret: 1, finger: 1 },
    { string: 1, fret: 1, finger: 1 }
  ],
  "H7 (B7)": [
    { string: 6, muted: true },
    { string: 5, fret: 2, finger: 2 },
    { string: 4, fret: 1, finger: 1 },
    { string: 3, fret: 2, finger: 3 },
    { string: 2, fret: 0 },
    { string: 1, fret: 2, finger: 4 }
  ],

  // --- 4. Spezielle Variationen (Sus & Add) ---
  "Asus2": [
    { string: 6, muted: true },
    { string: 5, fret: 0 },
    { string: 4, fret: 2, finger: 2 },
    { string: 3, fret: 2, finger: 3 },
    { string: 2, fret: 0 },
    { string: 1, fret: 0 }
  ],
  "Asus4": [
    { string: 6, muted: true },
    { string: 5, fret: 0 },
    { string: 4, fret: 2, finger: 2 },
    { string: 3, fret: 2, finger: 3 },
    { string: 2, fret: 3, finger: 4 },
    { string: 1, fret: 0 }
  ],
  "Dsus2": [
    { string: 6, muted: true },
    { string: 5, muted: true },
    { string: 4, fret: 0 },
    { string: 3, fret: 2, finger: 1 },
    { string: 2, fret: 3, finger: 2 },
    { string: 1, fret: 0 }
  ],
  "Dsus4": [
    { string: 6, muted: true },
    { string: 5, muted: true },
    { string: 4, fret: 0 },
    { string: 3, fret: 2, finger: 1 },
    { string: 2, fret: 3, finger: 2 },
    { string: 1, fret: 3, finger: 4 }
  ],
  "Esus4": [
    { string: 6, fret: 0 },
    { string: 5, fret: 2, finger: 2 },
    { string: 4, fret: 2, finger: 3 },
    { string: 3, fret: 2, finger: 4 },
    { string: 2, fret: 0 },
    { string: 1, fret: 0 }
  ],
  "Cadd9": [
    { string: 6, muted: true },
    { string: 5, fret: 3, finger: 3 },
    { string: 4, fret: 2, finger: 2 },
    { string: 3, fret: 0 },
    { string: 2, fret: 3, finger: 4 },
    { string: 1, fret: 0 }
  ],
  "G-Dur (Rock)": [
    { string: 6, fret: 3, finger: 2 },
    { string: 5, fret: 2, finger: 1 },
    { string: 4, fret: 0 },
    { string: 3, fret: 0 },
    { string: 2, fret: 3, finger: 3 },
    { string: 1, fret: 3, finger: 4 }
  ]
};

export const CHORD_CATEGORIES = {
  "simplified": ["G-Dur (1-Finger)", "C-Dur (1-Finger)", "E-Moll (2-Finger)", "A-Moll (2-Finger)"],
  "standard": ["C-Dur", "G-Dur", "D-Dur", "E-Moll", "A-Moll", "E-Dur", "A-Dur", "D-Moll"],
  "extended": ["G7", "C7", "D7", "A7", "E7", "F-Dur (klein)", "H7 (B7)"],
  "sus_add": ["Asus2", "Asus4", "Dsus2", "Dsus4", "Esus4", "Cadd9", "G-Dur (Rock)"]
};

/**
 * Validates finger data integrity for a chords object.
 * @param {Object} chords - The chords object to validate.
 * @returns {string[]} Array of error messages; empty array means all OK.
 */
export function validateFingerData(chords) {
  const errors = [];

  for (const [chordName, positions] of Object.entries(chords)) {
    if (!Array.isArray(positions) || positions.length !== 6) {
      errors.push(`${chordName}: must have exactly 6 string entries`);
      continue;
    }

    const stringNums = positions.map(p => p.string).sort((a, b) => a - b);
    const expectedStrings = [1, 2, 3, 4, 5, 6];
    if (!stringNums.every((n, i) => n === expectedStrings[i])) {
      errors.push(`${chordName}: string numbers must be 1–6 with no duplicates`);
    }

    for (const pos of positions) {
      if (pos.finger !== undefined) {
        if (pos.muted) {
          errors.push(`${chordName} string ${pos.string}: finger set on muted string`);
        } else if (pos.fret === 0) {
          errors.push(`${chordName} string ${pos.string}: finger set on open string (fret 0)`);
        } else if (![1, 2, 3, 4].includes(pos.finger)) {
          errors.push(`${chordName} string ${pos.string}: invalid finger value ${pos.finger} (must be 1–4)`);
        }
      }
    }
  }

  return errors;
}
