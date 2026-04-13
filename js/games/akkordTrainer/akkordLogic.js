/**
 * akkordLogic.js
 * Chord Trainer logic – chord data is the Single Source of Truth in js/data/akkordData.js.
 * String mapping: 1 = high e (top), 6 = low E (bottom)
 */

import { CHORDS, CHORD_CATEGORIES } from '../../data/akkordData.js';
export { CHORDS, CHORD_CATEGORIES };

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
