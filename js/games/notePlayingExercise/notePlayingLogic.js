// Pure note-playing exercise logic – no DOM or audio dependencies

import { getNoteAtPosition } from '../fretboardToneRecognition/fretboardLogic.js';

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
