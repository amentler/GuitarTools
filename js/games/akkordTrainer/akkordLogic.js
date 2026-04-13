/**
 * chordLogic.js
 * Chord definitions and validation for the Chord Trainer.
 * String mapping: 1 = high e (top), 6 = low E (bottom)
 *
 * TODO (for agent on PR #58 / copilot/add-finger-information-to-akkord-uebersicht):
 * When js/data/akkordData.js is created as the single source of truth, migrate
 * CHORDS and CHORD_CATEGORIES from this file to akkordData.js and replace them
 * here with: import { CHORDS, CHORD_CATEGORIES } from '../../data/akkordData.js';
 *            export { CHORDS, CHORD_CATEGORIES };
 * The finger fields added here must be preserved during migration.
 * getRandomChord and validateChord stay in this file unchanged.
 */

export const CHORDS = {
  // --- 1. Vereinfachte Einsteiger-Akkorde (Simplified) ---
  "G-Dur (1-Finger)": [
    { string: 6, muted: true },
    { string: 5, muted: true },
    { string: 4, fret: 0 },
    { string: 3, fret: 0 },
    { string: 2, fret: 0 },
    { string: 1, fret: 3 }
  ],
  "C-Dur (1-Finger)": [
    { string: 6, muted: true },
    { string: 5, muted: true },
    { string: 4, muted: true },
    { string: 3, fret: 0 },
    { string: 2, fret: 1 },
    { string: 1, fret: 0 }
  ],
  "E-Moll (2-Finger)": [
    { string: 6, fret: 0 },
    { string: 5, fret: 2 },
    { string: 4, fret: 2 },
    { string: 3, fret: 0 },
    { string: 2, fret: 0 },
    { string: 1, fret: 0 }
  ],
  "A-Moll (2-Finger)": [
    { string: 6, muted: true },
    { string: 5, fret: 0 },
    { string: 4, fret: 2 },
    { string: 3, fret: 2 },
    { string: 2, fret: 0 },
    { string: 1, fret: 0 }
  ],

  // --- 2. Einsteiger-Akkorde (Standard CAGED) ---
  "C-Dur": [
    { string: 6, muted: true },
    { string: 5, fret: 3 },
    { string: 4, fret: 2 },
    { string: 3, fret: 0 },
    { string: 2, fret: 1 },
    { string: 1, fret: 0 }
  ],
  "G-Dur": [
    { string: 6, fret: 3 },
    { string: 5, fret: 2 },
    { string: 4, fret: 0 },
    { string: 3, fret: 0 },
    { string: 2, fret: 0 },
    { string: 1, fret: 3 }
  ],
  "D-Dur": [
    { string: 6, muted: true },
    { string: 5, muted: true },
    { string: 4, fret: 0 },
    { string: 3, fret: 2 },
    { string: 2, fret: 3 },
    { string: 1, fret: 2 }
  ],
  "E-Moll": [
    { string: 6, fret: 0 },
    { string: 5, fret: 2 },
    { string: 4, fret: 2 },
    { string: 3, fret: 0 },
    { string: 2, fret: 0 },
    { string: 1, fret: 0 }
  ],
  "A-Moll": [
    { string: 6, muted: true },
    { string: 5, fret: 0 },
    { string: 4, fret: 2 },
    { string: 3, fret: 2 },
    { string: 2, fret: 1 },
    { string: 1, fret: 0 }
  ],
  "E-Dur": [
    { string: 6, fret: 0 },
    { string: 5, fret: 2 },
    { string: 4, fret: 2 },
    { string: 3, fret: 1 },
    { string: 2, fret: 0 },
    { string: 1, fret: 0 }
  ],
  "A-Dur": [
    { string: 6, muted: true },
    { string: 5, fret: 0 },
    { string: 4, fret: 2 },
    { string: 3, fret: 2 },
    { string: 2, fret: 2 },
    { string: 1, fret: 0 }
  ],
  "D-Moll": [
    { string: 6, muted: true },
    { string: 5, muted: true },
    { string: 4, fret: 0 },
    { string: 3, fret: 2 },
    { string: 2, fret: 3 },
    { string: 1, fret: 1 }
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
  "Cmaj7": [
    { string: 6, muted: true },
    { string: 5, fret: 3, finger: 3 },
    { string: 4, fret: 2, finger: 2 },
    { string: 3, fret: 0 },
    { string: 2, fret: 0 },
    { string: 1, fret: 0 }
  ],
  "Gmaj7": [
    { string: 6, fret: 3, finger: 2 },
    { string: 5, fret: 2, finger: 1 },
    { string: 4, fret: 0 },
    { string: 3, fret: 0 },
    { string: 2, fret: 0 },
    { string: 1, fret: 2, finger: 3 }
  ],
  "Dmaj7": [
    { string: 6, muted: true },
    { string: 5, muted: true },
    { string: 4, fret: 0 },
    { string: 3, fret: 2, finger: 1 },
    { string: 2, fret: 2, finger: 2 },
    { string: 1, fret: 2, finger: 3 }
  ],
  "Amaj7": [
    { string: 6, muted: true },
    { string: 5, fret: 0 },
    { string: 4, fret: 2, finger: 2 },
    { string: 3, fret: 1, finger: 1 },
    { string: 2, fret: 2, finger: 3 },
    { string: 1, fret: 0 }
  ],
  "Emaj7": [
    { string: 6, fret: 0 },
    { string: 5, fret: 2, finger: 2 },
    { string: 4, fret: 1, finger: 1 },
    { string: 3, fret: 1, finger: 1 },
    { string: 2, fret: 0 },
    { string: 1, fret: 0 }
  ],
  "Am7": [
    { string: 6, muted: true },
    { string: 5, fret: 0 },
    { string: 4, fret: 2, finger: 2 },
    { string: 3, fret: 0 },
    { string: 2, fret: 1, finger: 1 },
    { string: 1, fret: 0 }
  ],
  "Dm7": [
    { string: 6, muted: true },
    { string: 5, muted: true },
    { string: 4, fret: 0 },
    { string: 3, fret: 2, finger: 2 },
    { string: 2, fret: 1, finger: 1 },
    { string: 1, fret: 1, finger: 1 }
  ],
  "Em7": [
    { string: 6, fret: 0 },
    { string: 5, fret: 2, finger: 2 },
    { string: 4, fret: 0 },
    { string: 3, fret: 0 },
    { string: 2, fret: 0 },
    { string: 1, fret: 0 }
  ],
  "F-Dur (klein)": [
    { string: 6, muted: true },
    { string: 5, muted: true },
    { string: 4, fret: 3 },
    { string: 3, fret: 2 },
    { string: 2, fret: 1 },
    { string: 1, fret: 1 }
  ],
  "H7 (B7)": [
    { string: 6, muted: true },
    { string: 5, fret: 2 },
    { string: 4, fret: 1 },
    { string: 3, fret: 2 },
    { string: 2, fret: 0 },
    { string: 1, fret: 2 }
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
    { string: 2, fret: 3, finger: 3 },
    { string: 1, fret: 0 }
  ],
  "Dsus4": [
    { string: 6, muted: true },
    { string: 5, muted: true },
    { string: 4, fret: 0 },
    { string: 3, fret: 2, finger: 1 },
    { string: 2, fret: 3, finger: 2 },
    { string: 1, fret: 3, finger: 3 }
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
  "Gadd9": [
    { string: 6, fret: 3, finger: 2 },
    { string: 5, fret: 2, finger: 1 },
    { string: 4, fret: 0 },
    { string: 3, fret: 0 },
    { string: 2, fret: 3, finger: 3 },
    { string: 1, fret: 3, finger: 4 }
  ],
  "G-Dur (Rock)": [
    { string: 6, fret: 3 },
    { string: 5, fret: 2 },
    { string: 4, fret: 0 },
    { string: 3, fret: 0 },
    { string: 2, fret: 3 },
    { string: 1, fret: 3 }
  ]
};

export const CHORD_CATEGORIES = {
  "simplified": ["G-Dur (1-Finger)", "C-Dur (1-Finger)", "E-Moll (2-Finger)", "A-Moll (2-Finger)"],
  "standard": ["C-Dur", "G-Dur", "D-Dur", "E-Moll", "A-Moll", "E-Dur", "A-Dur", "D-Moll"],
  "extended": ["G7", "C7", "D7", "A7", "E7", "F-Dur (klein)", "H7 (B7)", "Cmaj7", "Gmaj7", "Dmaj7", "Amaj7", "Emaj7", "Am7", "Dm7", "Em7"],
  "sus_add": ["Asus2", "Asus4", "Dsus2", "Dsus4", "Esus4", "Cadd9", "G-Dur (Rock)", "Gadd9"]
};

// Keep LEVELS for backward compatibility if needed, but we use categories now
export const LEVELS = [
  CHORD_CATEGORIES.standard.slice(0, 5),
  CHORD_CATEGORIES.standard
];

/**
 * Gets a random chord name from the specified categories.
 */
export function getRandomChord(activeCategories = ["simplified"]) {
  let pool = [];
  activeCategories.forEach(cat => {
    if (CHORD_CATEGORIES[cat]) {
      pool = pool.concat(CHORD_CATEGORIES[cat]);
    }
  });

  if (pool.length === 0) {
    pool = CHORD_CATEGORIES.simplified; // Fallback
  }

  const name = pool[Math.floor(Math.random() * pool.length)];
  return {
    name,
    positions: CHORDS[name]
  };
}

/**
 * Validates the user's positions against the reference chord.
 */
export function validateChord(chordName, userPositions) {
  const reference = CHORDS[chordName];
  if (!reference) return false;

  for (let s = 1; s <= 6; s++) {
    const refPos = reference.find(p => p.string === s);
    const userPos = userPositions.find(p => p.string === s) || { string: s, fret: 0, muted: false };

    if (refPos.muted) {
      if (!userPos || !userPos.muted) return false;
    } else if (refPos.fret === 0) {
      if (!userPos || userPos.fret !== 0 || userPos.muted) return false;
    } else {
      if (!userPos || userPos.fret !== refPos.fret || userPos.muted) return false;
    }
  }

  return true;
}
