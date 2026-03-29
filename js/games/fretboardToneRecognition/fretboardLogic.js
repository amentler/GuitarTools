// Pure fretboard note calculations – no DOM or framework dependencies

export const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Open string notes, index 0 = low E (thickest), index 5 = high E (thinnest)
export const OPEN_STRING_NOTES = ['E', 'A', 'D', 'G', 'B', 'E'];

// Labels shown to the user (same order as OPEN_STRING_NOTES)
export const STRING_LABELS = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

/**
 * Returns the note name for a given string and fret.
 * @param {number} stringIndex - 0 (low E) to 5 (high E)
 * @param {number} fret        - 0 (open) to maxFret
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
 * @param {{ maxFret?: number, activeStrings?: number[] }} config
 * @returns {{ string: number, fret: number }}
 */
export function getRandomPosition(previous = null, config = {}) {
  const maxFret       = config.maxFret       ?? 4;
  const activeStrings = config.activeStrings ?? [0, 1, 2, 3, 4, 5];

  let pos;
  do {
    pos = {
      string: activeStrings[Math.floor(Math.random() * activeStrings.length)],
      fret:   Math.floor(Math.random() * (maxFret + 1)),
    };
  } while (
    previous !== null &&
    activeStrings.length > 1 &&
    pos.string === previous.string &&
    pos.fret   === previous.fret
  );
  return pos;
}
