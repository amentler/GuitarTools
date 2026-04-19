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
  "H7 (B7)": [
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
    { string: 4, fret: 1, finger: 1 },
    { string: 3, fret: 2, finger: 2 },
    { string: 2, fret: 3, finger: 4 },
    { string: 1, fret: 0 }
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
    { string: 2, fret: 0 },
    { string: 1, fret: 1, finger: 2 }
  ],
  "Edim": [
    { string: 6, fret: 0 },
    { string: 5, fret: 1, finger: 1 },
    { string: 4, fret: 2, finger: 2 },
    { string: 3, fret: 3, finger: 3 },
    { string: 2, fret: 0 },
    { string: 1, fret: 0 }
  ],
  "Fdim": [
    { string: 6, fret: 1, finger: 1 },
    { string: 5, fret: 2, finger: 2 },
    { string: 4, fret: 3, finger: 3 },
    { string: 3, fret: 4, finger: 4 },
    { string: 2, fret: 0 },
    { string: 1, fret: 0 }
  ],
  "Gdim": [
    { string: 6, fret: 3, finger: 2 },
    { string: 5, fret: 4, finger: 3 },
    { string: 4, fret: 5, finger: 4 },
    { string: 3, fret: 3, finger: 1 },
    { string: 2, fret: 0 },
    { string: 1, fret: 0 }
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
    { string: 6, fret: 3, finger: 2 },
    { string: 5, fret: 2, finger: 1 },
    { string: 4, fret: 0 },
    { string: 3, fret: 0 },
    { string: 2, fret: 3, finger: 3 },
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

export const CHORD_CATEGORIES = {
  "simplified": ["G-Dur (1-Finger)", "C-Dur (1-Finger)", "E-Moll (2-Finger)", "A-Moll (2-Finger)"],
  "standard": ["C-Dur", "G-Dur", "D-Dur", "E-Moll", "A-Moll", "E-Dur", "A-Dur", "D-Moll"],
  "extended": [
    "F-Dur", "H-Dur", "H-Moll", "C-Moll", "F-Moll", "G-Moll",
    "G7", "C7", "D7", "A7", "E7", "F7", "H7 (B7)",
    "Cmaj7", "Gmaj7", "Dmaj7", "Amaj7", "Emaj7", "Fmaj7", "Hmaj7",
    "Am7", "Dm7", "Em7", "Cm7", "Fm7", "Gm7", "Hm7",
    "Adim", "Hdim", "Cdim", "Ddim", "Edim", "Fdim", "Gdim",
    "F-Dur (klein)"
  ],
  "sus_add": [
    "Asus2", "Asus4", "Dsus2", "Dsus4",
    "Esus2", "Esus4", "Csus2", "Csus4", "Fsus2", "Fsus4",
    "Gsus2", "Gsus4", "G7sus4", "Hsus2", "Hsus4", "H7sus4",
    "Cadd9", "Gadd9", "Eadd9", "Aadd9",
    "G-Dur (Rock)"
  ]
};

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
