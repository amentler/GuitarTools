/**
 * Maps chord-data string numbers (1 = high e, 6 = low E)
 * to gt-fretboard string indices (0 = low E, 5 = high e).
 */
export function chordStringToFretboardIndex(stringNumber) {
  return 6 - stringNumber;
}

/**
 * Maps gt-fretboard string indices (0 = low E, 5 = high e)
 * back to chord-data string numbers (1 = high e, 6 = low E).
 */
export function fretboardIndexToChordString(stringIndex) {
  return 6 - stringIndex;
}
