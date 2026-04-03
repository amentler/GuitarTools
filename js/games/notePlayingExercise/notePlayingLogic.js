// Pure note-playing exercise logic – no DOM or audio dependencies

import { getNoteAtPosition } from '../fretboardToneRecognition/fretboardLogic.js';

const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// MIDI numbers for standard guitar open strings (index 0 = low E, index 5 = high E)
const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64];

// ── Octave-aware helpers ───────────────────────────────────────────────────────

/**
 * Returns the note name and octave for a given string and fret position.
 * Uses standard guitar open-string MIDI values: E2, A2, D3, G3, B3, E4.
 * @param {number} stringIndex - 0 (low E) to 5 (high E)
 * @param {number} fret
 * @returns {{ note: string, octave: number }}
 */
export function getPitchAtPosition(stringIndex, fret) {
  const midi = OPEN_STRING_MIDI[stringIndex] + fret;
  const noteIndex = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  return { note: CHROMATIC_NOTES[noteIndex], octave };
}

/**
 * Returns a canonical pitch string (e.g. "C#4") for a string/fret position.
 * @param {number} stringIndex
 * @param {number} fret
 * @returns {string}
 */
function pitchString(stringIndex, fret) {
  const { note, octave } = getPitchAtPosition(stringIndex, fret);
  return `${note}${octave}`;
}

/**
 * Returns all unique octave-aware pitch strings reachable within the given configuration.
 * Each pitch is a canonical string such as "E2", "C#4", etc.
 * @param {number}   maxFret       - highest fret to include (0 = open strings only)
 * @param {number[]} activeStrings - string indices to include (0 = low E, 5 = high E)
 * @returns {string[]} unique pitch strings
 */
export function getAvailablePitches(maxFret, activeStrings) {
  const pitches = new Set();
  for (const s of activeStrings) {
    for (let f = 0; f <= maxFret; f++) {
      pitches.add(pitchString(s, f));
    }
  }
  return [...pitches];
}

/**
 * Picks a random pitch from the available pool, avoiding the previous pitch when possible.
 * @param {string|null} previous      - last shown pitch string (to avoid direct repetition)
 * @param {number}      maxFret
 * @param {number[]}    activeStrings
 * @returns {string} a pitch string (e.g. "C#4")
 */
export function getRandomPitch(previous, maxFret, activeStrings) {
  const pool = getAvailablePitches(maxFret, activeStrings);
  if (pool.length === 0) return 'E2';
  if (pool.length === 1) return pool[0];
  let pitch;
  do {
    pitch = pool[Math.floor(Math.random() * pool.length)];
  } while (pitch === previous);
  return pitch;
}

/**
 * Returns all string/fret positions where the given pitch (note + octave) occurs within the
 * current settings (active strings × 0…maxFret).
 * @param {string}   pitchStr      - e.g. "C#4"
 * @param {number}   maxFret
 * @param {number[]} activeStrings - string indices (0 = low E, 5 = high E)
 * @returns {Array<{string: number, fret: number}>}
 */
export function getPositionsForPitch(pitchStr, maxFret, activeStrings) {
  const positions = [];
  for (const s of activeStrings) {
    for (let f = 0; f <= maxFret; f++) {
      if (pitchString(s, f) === pitchStr) {
        positions.push({ string: s, fret: f });
      }
    }
  }
  return positions;
}

// ── Legacy note-name-only functions (kept for backward compatibility) ──────────

/**
 * Returns all unique note names reachable within the given configuration.
 * @param {number}   maxFret       - highest fret to include (0 = open strings only)
 * @param {number[]} activeStrings - string indices to include (0 = low E, 5 = high E)
 * @returns {string[]} unique note names
 */
export function getAvailableNotes(maxFret, activeStrings) {
  const notes = new Set();
  for (const s of activeStrings) {
    for (let f = 0; f <= maxFret; f++) {
      notes.add(getNoteAtPosition(s, f));
    }
  }
  return [...notes];
}

/**
 * Picks a random note from the available pool, avoiding the previous note when possible.
 * @param {string|null} previous      - last shown note (to avoid direct repetition)
 * @param {number}      maxFret
 * @param {number[]}    activeStrings
 * @returns {string} a note name (e.g. "C#")
 */
export function getRandomNote(previous, maxFret, activeStrings) {
  const pool = getAvailableNotes(maxFret, activeStrings);
  if (pool.length === 0) return 'E';
  if (pool.length === 1) return pool[0];
  let note;
  do {
    note = pool[Math.floor(Math.random() * pool.length)];
  } while (note === previous);
  return note;
}

/**
 * Returns all string/fret positions where the given note occurs within the
 * current settings (active strings × 0…maxFret).
 * @param {string}   noteName      - e.g. "C#"
 * @param {number}   maxFret
 * @param {number[]} activeStrings - string indices (0 = low E, 5 = high E)
 * @returns {Array<{string: number, fret: number}>}
 */
export function getPositionsForNote(noteName, maxFret, activeStrings) {
  const positions = [];
  for (const s of activeStrings) {
    for (let f = 0; f <= maxFret; f++) {
      if (getNoteAtPosition(s, f) === noteName) {
        positions.push({ string: s, fret: f });
      }
    }
  }
  return positions;
}
