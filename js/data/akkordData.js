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

const BASE_CHORDS = {
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
  "F-Dur": [
    { string: 6, fret: 1, finger: 1 },
    { string: 5, fret: 3, finger: 3 },
    { string: 4, fret: 3, finger: 4 },
    { string: 3, fret: 2, finger: 2 },
    { string: 2, fret: 1, finger: 1 },
    { string: 1, fret: 1, finger: 1 }
  ],
  "H-Dur": [
    { string: 6, muted: true },
    { string: 5, fret: 2, finger: 1 },
    { string: 4, fret: 4, finger: 2 },
    { string: 3, fret: 4, finger: 3 },
    { string: 2, fret: 4, finger: 4 },
    { string: 1, fret: 2, finger: 1 }
  ],
  "H-Moll": [
    { string: 6, muted: true },
    { string: 5, fret: 2, finger: 1 },
    { string: 4, fret: 4, finger: 3 },
    { string: 3, fret: 4, finger: 4 },
    { string: 2, fret: 3, finger: 2 },
    { string: 1, fret: 2, finger: 1 }
  ],
  "C-Moll": [
    { string: 6, muted: true },
    { string: 5, fret: 3, finger: 1 },
    { string: 4, fret: 5, finger: 3 },
    { string: 3, fret: 5, finger: 4 },
    { string: 2, fret: 4, finger: 2 },
    { string: 1, fret: 3, finger: 1 }
  ],
  "F-Moll": [
    { string: 6, fret: 1, finger: 1 },
    { string: 5, fret: 3, finger: 3 },
    { string: 4, fret: 3, finger: 4 },
    { string: 3, fret: 1, finger: 1 },
    { string: 2, fret: 1, finger: 1 },
    { string: 1, fret: 1, finger: 1 }
  ],
  "G-Moll": [
    { string: 6, fret: 3, finger: 1 },
    { string: 5, fret: 5, finger: 3 },
    { string: 4, fret: 5, finger: 4 },
    { string: 3, fret: 3, finger: 1 },
    { string: 2, fret: 3, finger: 1 },
    { string: 1, fret: 3, finger: 1 }
  ],
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
    { string: 4, fret: 3, finger: 4 },
    { string: 3, fret: 2, finger: 3 },
    { string: 2, fret: 1, finger: 1 },
    { string: 1, fret: 1, finger: 1 }
  ],
  "H7": [
    { string: 6, muted: true },
    { string: 5, fret: 2, finger: 2 },
    { string: 4, fret: 1, finger: 1 },
    { string: 3, fret: 2, finger: 3 },
    { string: 2, fret: 0 },
    { string: 1, fret: 2, finger: 4 }
  ],
  "F7": [
    { string: 6, fret: 1, finger: 1 },
    { string: 5, fret: 3, finger: 3 },
    { string: 4, fret: 1, finger: 1 },
    { string: 3, fret: 2, finger: 2 },
    { string: 2, fret: 1, finger: 1 },
    { string: 1, fret: 1, finger: 1 }
  ],
  "Fmaj7": [
    { string: 6, fret: 1, finger: 1 },
    { string: 5, fret: 3, finger: 3 },
    { string: 4, fret: 3, finger: 4 },
    { string: 3, fret: 2, finger: 2 },
    { string: 2, fret: 1, finger: 1 },
    { string: 1, fret: 0 }
  ],
  "Hmaj7": [
    { string: 6, muted: true },
    { string: 5, fret: 2, finger: 1 },
    { string: 4, fret: 4, finger: 3 },
    { string: 3, fret: 3, finger: 2 },
    { string: 2, fret: 4, finger: 4 },
    { string: 1, fret: 2, finger: 1 }
  ],
  "Cm7": [
    { string: 6, muted: true },
    { string: 5, fret: 3, finger: 1 },
    { string: 4, fret: 5, finger: 3 },
    { string: 3, fret: 3, finger: 1 },
    { string: 2, fret: 4, finger: 2 },
    { string: 1, fret: 3, finger: 1 }
  ],
  "Fm7": [
    { string: 6, fret: 1, finger: 1 },
    { string: 5, fret: 3, finger: 3 },
    { string: 4, fret: 1, finger: 1 },
    { string: 3, fret: 1, finger: 1 },
    { string: 2, fret: 1, finger: 1 },
    { string: 1, fret: 1, finger: 1 }
  ],
  "Gm7": [
    { string: 6, fret: 3, finger: 1 },
    { string: 5, fret: 5, finger: 3 },
    { string: 4, fret: 3, finger: 1 },
    { string: 3, fret: 3, finger: 1 },
    { string: 2, fret: 3, finger: 1 },
    { string: 1, fret: 3, finger: 1 }
  ],
  "Hm7": [
    { string: 6, muted: true },
    { string: 5, fret: 2, finger: 1 },
    { string: 4, fret: 4, finger: 3 },
    { string: 3, fret: 2, finger: 1 },
    { string: 2, fret: 3, finger: 2 },
    { string: 1, fret: 2, finger: 1 }
  ],
  "Adim": [
    { string: 6, muted: true },
    { string: 5, fret: 0 },
    { string: 4, fret: 1, finger: 2 },
    { string: 3, fret: 2, finger: 3 },
    { string: 2, fret: 1, finger: 1 },
    { string: 1, muted: true }
  ],
  "Hdim": [
    { string: 6, muted: true },
    { string: 5, fret: 2, finger: 1 },
    { string: 4, fret: 3, finger: 2 },
    { string: 3, fret: 4, finger: 4 },
    { string: 2, fret: 3, finger: 3 },
    { string: 1, muted: true }
  ],
  "Cdim": [
    { string: 6, muted: true },
    { string: 5, fret: 3, finger: 1 },
    { string: 4, fret: 4, finger: 2 },
    { string: 3, fret: 5, finger: 4 },
    { string: 2, fret: 4, finger: 3 },
    { string: 1, muted: true }
  ],
  "Ddim": [
    { string: 6, muted: true },
    { string: 5, muted: true },
    { string: 4, fret: 0 },
    { string: 3, fret: 1, finger: 1 },
    { string: 2, muted: true },
    { string: 1, fret: 1, finger: 2 }
  ],
  "Edim": [
    { string: 6, fret: 0 },
    { string: 5, fret: 1, finger: 1 },
    { string: 4, fret: 2, finger: 2 },
    { string: 3, fret: 0 },
    { string: 2, muted: true },
    { string: 1, muted: true }
  ],
  "Fdim": [
    { string: 6, fret: 1, finger: 1 },
    { string: 5, fret: 2, finger: 2 },
    { string: 4, fret: 3, finger: 3 },
    { string: 3, fret: 1, finger: 1 },
    { string: 2, muted: true },
    { string: 1, muted: true }
  ],
  "Gdim": [
    { string: 6, fret: 3, finger: 2 },
    { string: 5, fret: 4, finger: 3 },
    { string: 4, fret: 5, finger: 4 },
    { string: 3, fret: 3, finger: 1 },
    { string: 2, muted: true },
    { string: 1, muted: true }
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
  "Esus2": [
    { string: 6, fret: 0 },
    { string: 5, fret: 2, finger: 1 },
    { string: 4, fret: 2, finger: 2 },
    { string: 3, fret: 4, finger: 4 },
    { string: 2, fret: 0 },
    { string: 1, fret: 0 }
  ],
  "Esus4": [
    { string: 6, fret: 0 },
    { string: 5, fret: 2, finger: 2 },
    { string: 4, fret: 2, finger: 3 },
    { string: 3, fret: 2, finger: 4 },
    { string: 2, fret: 0 },
    { string: 1, fret: 0 }
  ],
  "Csus2": [
    { string: 6, muted: true },
    { string: 5, fret: 3, finger: 3 },
    { string: 4, fret: 0 },
    { string: 3, fret: 0 },
    { string: 2, fret: 1, finger: 1 },
    { string: 1, fret: 0 }
  ],
  "Csus4": [
    { string: 6, muted: true },
    { string: 5, fret: 3, finger: 3 },
    { string: 4, fret: 3, finger: 4 },
    { string: 3, fret: 0 },
    { string: 2, fret: 1, finger: 1 },
    { string: 1, fret: 0 }
  ],
  "Fsus2": [
    { string: 6, fret: 1, finger: 1 },
    { string: 5, fret: 3, finger: 3 },
    { string: 4, fret: 3, finger: 4 },
    { string: 3, fret: 0 },
    { string: 2, fret: 1, finger: 1 },
    { string: 1, fret: 1, finger: 1 }
  ],
  "Fsus4": [
    { string: 6, fret: 1, finger: 1 },
    { string: 5, fret: 3, finger: 3 },
    { string: 4, fret: 3, finger: 3 },
    { string: 3, fret: 3, finger: 3 },
    { string: 2, fret: 1, finger: 1 },
    { string: 1, fret: 1, finger: 1 }
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
    { string: 6, fret: 3, finger: 3 },
    { string: 5, fret: 2, finger: 2 },
    { string: 4, fret: 0 },
    { string: 3, fret: 2, finger: 1 },
    { string: 2, fret: 0 },
    { string: 1, fret: 3, finger: 4 }
  ],
  "G-Dur (Rock)": [
    { string: 6, fret: 3, finger: 2 },
    { string: 5, fret: 2, finger: 1 },
    { string: 4, fret: 0 },
    { string: 3, fret: 0 },
    { string: 2, fret: 3, finger: 3 },
    { string: 1, fret: 3, finger: 4 }
  ],
  "Gsus2": [
    { string: 6, fret: 3, finger: 2 },
    { string: 5, fret: 0 },
    { string: 4, fret: 0 },
    { string: 3, fret: 2, finger: 1 },
    { string: 2, fret: 3, finger: 3 },
    { string: 1, fret: 3, finger: 4 }
  ],
  "Gsus4": [
    { string: 6, fret: 3, finger: 2 },
    { string: 5, fret: 3, finger: 3 },
    { string: 4, fret: 0 },
    { string: 3, fret: 0 },
    { string: 2, fret: 1, finger: 1 },
    { string: 1, fret: 3, finger: 4 }
  ],
  "G7sus4": [
    { string: 6, fret: 3, finger: 2 },
    { string: 5, fret: 3, finger: 3 },
    { string: 4, fret: 0 },
    { string: 3, fret: 0 },
    { string: 2, fret: 1, finger: 1 },
    { string: 1, fret: 1, finger: 1 }
  ],
  "Hsus2": [
    { string: 6, muted: true },
    { string: 5, fret: 2, finger: 1 },
    { string: 4, fret: 4, finger: 3 },
    { string: 3, fret: 4, finger: 4 },
    { string: 2, fret: 2, finger: 1 },
    { string: 1, fret: 2, finger: 1 }
  ],
  "Hsus4": [
    { string: 6, muted: true },
    { string: 5, fret: 2, finger: 1 },
    { string: 4, fret: 4, finger: 2 },
    { string: 3, fret: 4, finger: 3 },
    { string: 2, fret: 5, finger: 4 },
    { string: 1, fret: 2, finger: 1 }
  ],
  "H7sus4": [
    { string: 6, muted: true },
    { string: 5, fret: 2, finger: 1 },
    { string: 4, fret: 2, finger: 1 },
    { string: 3, fret: 2, finger: 1 },
    { string: 2, fret: 0 },
    { string: 1, fret: 0 }
  ],
  "Eadd9": [
    { string: 6, fret: 0 },
    { string: 5, fret: 2, finger: 2 },
    { string: 4, fret: 2, finger: 3 },
    { string: 3, fret: 1, finger: 1 },
    { string: 2, fret: 0 },
    { string: 1, fret: 2, finger: 4 }
  ],
  "Aadd9": [
    { string: 6, muted: true },
    { string: 5, fret: 0 },
    { string: 4, fret: 2, finger: 1 },
    { string: 3, fret: 4, finger: 4 },
    { string: 2, fret: 2, finger: 2 },
    { string: 1, fret: 0 }
  ]
};

export const CHORD_ROOTS = ['A', 'B', 'H', 'C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis'];

export const CHORD_FAMILIES = [
  { key: 'Dur',             category: 'extended', chordType: 'Dur',             name: root => `${root}-Dur` },
  { key: 'Moll',            category: 'extended', chordType: 'Moll',            name: root => `${root}-Moll` },
  { key: 'Dom7',            category: 'extended', chordType: 'Dom7',            name: root => `${root}7` },
  { key: 'Maj7',            category: 'extended', chordType: 'Maj7',            name: root => `${root}maj7` },
  { key: 'Min7',            category: 'extended', chordType: 'Min7',            name: root => `${root}m7` },
  { key: 'Dim',             category: 'extended', chordType: 'Dim',             name: root => `${root}dim` },
  { key: 'Halbvermindert',  category: 'extended', chordType: 'Halbvermindert',  name: root => `${root}m7b5` },
  { key: 'Sus2',            category: 'sus_add',  chordType: 'Sus2',            name: root => `${root}sus2` },
  { key: 'Sus4',            category: 'sus_add',  chordType: 'Sus4',            name: root => `${root}sus4` },
  { key: '7Sus4',           category: 'sus_add',  chordType: '7Sus4',           name: root => `${root}7sus4` },
  { key: 'Add9',            category: 'sus_add',  chordType: 'Add9',            name: root => `${root}add9` },
];

const ROOT_CHROMA = {
  A: 9, B: 10, H: 11, C: 0, Cis: 1, D: 2,
  Dis: 3, E: 4, F: 5, Fis: 6, G: 7, Gis: 8,
};

const E_SHAPE_OFFSETS = {
  Dur:    [0, 2, 2, 1, 0, 0],
  Moll:   [0, 2, 2, 0, 0, 0],
  Dom7:   [0, 2, 0, 1, 0, 0],
  Maj7:   [0, 2, 1, 1, 0, 0],
  Min7:   [0, 2, 0, 0, 0, 0],
  Sus2:   [0, 2, 2, 4, 0, 0],
  Sus4:   [0, 2, 2, 2, 0, 0],
  '7Sus4': [0, 2, 0, 2, 0, 0],
  Add9:   [0, 2, 2, 1, 0, 2],
};

const A_SHAPE_OFFSETS = {
  Dur:    [null, 0, 2, 2, 2, 0],
  Moll:   [null, 0, 2, 2, 1, 0],
  Dom7:   [null, 0, 2, 0, 2, 0],
  Maj7:   [null, 0, 2, 1, 2, 0],
  Min7:   [null, 0, 2, 0, 1, 0],
  Dim:    [null, 0, 1, 2, 1, null],
  Halbvermindert: [null, 0, 1, 0, 1, null],
  Sus2:   [null, 0, 2, 2, 0, 0],
  Sus4:   [null, 0, 2, 2, 3, 0],
  '7Sus4': [null, 0, 2, 0, 3, 0],
  Add9:   [null, 0, 2, 4, 2, 0],
};

function rootFret(root, openChroma) {
  return (ROOT_CHROMA[root] - openChroma + 12) % 12;
}

function toPositions(rootFretValue, offsets) {
  return offsets.map((offset, i) => {
    const string = 6 - i;
    if (offset === null) return { string, muted: true };
    const fret = rootFretValue + offset;
    if (fret === 0) return { string, fret };
    const finger = Math.min(4, offset + 1);
    return { string, fret, finger };
  });
}

function maxFret(positions) {
  return Math.max(...positions.filter(p => !p.muted).map(p => p.fret));
}

function minFretted(positions) {
  const fretted = positions.filter(p => !p.muted && p.fret > 0).map(p => p.fret);
  return fretted.length ? Math.min(...fretted) : 0;
}

function chooseLowestShape(root, familyKey) {
  const candidates = [];
  if (E_SHAPE_OFFSETS[familyKey]) {
    candidates.push(toPositions(rootFret(root, 4), E_SHAPE_OFFSETS[familyKey]));
  }
  if (A_SHAPE_OFFSETS[familyKey]) {
    candidates.push(toPositions(rootFret(root, 9), A_SHAPE_OFFSETS[familyKey]));
  }
  return candidates.sort((a, b) =>
    maxFret(a) - maxFret(b) || minFretted(a) - minFretted(b)
  )[0];
}

function buildCompleteChordCatalog(baseChords) {
  const chords = { ...baseChords };
  for (const root of CHORD_ROOTS) {
    for (const family of CHORD_FAMILIES) {
      const name = family.name(root);
      if (!chords[name]) chords[name] = chooseLowestShape(root, family.key);
    }
  }
  return chords;
}

function createMatrixNames(category) {
  return CHORD_FAMILIES
    .filter(family => family.category === category)
    .flatMap(family => CHORD_ROOTS.map(root => family.name(root)));
}

function parseChordMeta(chordName) {
  const special = {
    'G-Dur (1-Finger)': { rootNote: 'G', chordType: 'Dur' },
    'C-Dur (1-Finger)': { rootNote: 'C', chordType: 'Dur' },
    'F-Dur (klein)': { rootNote: 'F', chordType: 'Dur' },
    'G-Dur (Rock)': { rootNote: 'G', chordType: 'Dur' },
  };
  if (special[chordName]) return special[chordName];

  const rootPattern = `(${CHORD_ROOTS.join('|')})`;
  const hyphenMatch = chordName.match(new RegExp(`^${rootPattern}-(Dur|Moll)$`));
  if (hyphenMatch) return { rootNote: hyphenMatch[1], chordType: hyphenMatch[2] };

  const suffixes = [
    ['m7b5', 'Halbvermindert'],
    ['7sus4', '7Sus4'],
    ['maj7', 'Maj7'],
    ['add9', 'Add9'],
    ['sus2', 'Sus2'],
    ['sus4', 'Sus4'],
    ['dim', 'Dim'],
    ['m7', 'Min7'],
    ['7', 'Dom7'],
  ];

  for (const [suffix, chordType] of suffixes) {
    const match = chordName.match(new RegExp(`^${rootPattern}${suffix}$`));
    if (match) return { rootNote: match[1], chordType };
  }

  return null;
}

function buildChordMeta(chords) {
  return Object.fromEntries(
    Object.keys(chords)
      .map(name => [name, parseChordMeta(name)])
      .filter(([, meta]) => meta !== null)
  );
}

export const CHORDS = buildCompleteChordCatalog(BASE_CHORDS);
export const CHORD_RECOGNITION_CHORDS = BASE_CHORDS;

export const CHORD_CATEGORIES = {
  simplified: ['G-Dur (1-Finger)', 'C-Dur (1-Finger)', 'E-Moll', 'Asus2'],
  standard: ['C-Dur', 'G-Dur', 'D-Dur', 'E-Moll', 'A-Moll', 'E-Dur', 'A-Dur', 'D-Moll'],
  extended: [...createMatrixNames('extended'), 'F-Dur (klein)'],
  sus_add: [...createMatrixNames('sus_add'), 'G-Dur (Rock)'],
};

export const CHORD_META = buildChordMeta(CHORDS);

/**
 * Validates finger data integrity for a chords object.
 * @param {Object.<string, Array<{string: number, fret: number, muted?: boolean, finger?: (1|2|3|4)}>} chords - The chords object to validate.
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
