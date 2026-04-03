/**
 * chordLogic.js
 * Chord definitions and validation for the Chord Trainer.
 * String mapping: 1 = high e (top), 6 = low E (bottom)
 */

export const CHORDS = {
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
  ]
};

export const LEVELS = [
  ["C-Dur", "G-Dur", "D-Dur", "E-Moll", "A-Moll"],
  ["E-Dur", "A-Dur", "D-Moll", "C-Dur", "G-Dur", "D-Dur", "E-Moll", "A-Moll"]
];

/**
 * Gets a random chord name from the specified level.
 */
export function getRandomChord(level = 1) {
  const pool = LEVELS[level - 1] || LEVELS[0];
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
