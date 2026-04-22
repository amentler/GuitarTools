import { CHORDS, CHORD_CATEGORIES } from '../../data/akkordData.js';

export { CHORDS, CHORD_CATEGORIES };

export const LEVELS = [
  CHORD_CATEGORIES.standard.slice(0, 5),
  CHORD_CATEGORIES.standard,
];

/**
 * Gets a random chord name from the specified categories.
 */
export function getRandomChord(activeCategories = ['simplified']) {
  let pool = [];
  activeCategories.forEach(cat => {
    if (CHORD_CATEGORIES[cat]) {
      pool = pool.concat(CHORD_CATEGORIES[cat]);
    }
  });

  if (pool.length === 0) {
    pool = CHORD_CATEGORIES.simplified;
  }

  const name = pool[Math.floor(Math.random() * pool.length)];
  return {
    name,
    positions: CHORDS[name],
  };
}
