import { CHORDS, CHORD_CATEGORIES, LEVELS, getRandomChord } from '../../domain/chords/chordCatalog.js';
export { CHORDS, CHORD_CATEGORIES, LEVELS, getRandomChord };

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
