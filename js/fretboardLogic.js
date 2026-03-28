// Pure fretboard note calculations – no DOM or framework dependencies

export const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Open string notes, index 0 = low E (thickest), index 5 = high E (thinnest)
export const OPEN_STRING_NOTES = ['E', 'A', 'D', 'G', 'B', 'E'];

// Labels shown to the user (same order as OPEN_STRING_NOTES, but displayed bottom-to-top on fretboard)
export const STRING_LABELS = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

/**
 * Returns the note name for a given string and fret.
 * @param {number} stringIndex - 0 (low E) to 5 (high E)
 * @param {number} fret        - 0 (open) to 4
 * @returns {string} note name, e.g. "F#"
 */
export function getNoteAtPosition(stringIndex, fret) {
  const openNote = OPEN_STRING_NOTES[stringIndex];
  const openIndex = CHROMATIC_NOTES.indexOf(openNote);
  return CHROMATIC_NOTES[(openIndex + fret) % 12];
}

/**
 * Returns a random fretboard position, avoiding repeating the previous one.
 * @param {{ string: number, fret: number } | null} previous
 * @returns {{ string: number, fret: number }}
 */
export function getRandomPosition(previous = null) {
  let pos;
  do {
    pos = {
      string: Math.floor(Math.random() * 6),
      fret: Math.floor(Math.random() * 5),
    };
  } while (
    previous !== null &&
    pos.string === previous.string &&
    pos.fret === previous.fret
  );
  return pos;
}
