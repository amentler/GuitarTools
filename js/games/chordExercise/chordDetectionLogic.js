/**
 * chordDetectionLogic.js
 * Pure functions for chord detection logic.
 *
 * String mapping: 1 = high e (top), 6 = low E (bottom)
 * Open string pitches: string 1 = E4, string 2 = B3, string 3 = G3,
 *                      string 4 = D3, string 5 = A2, string 6 = E2
 *
 * Chord matching uses "note-class" mode (Q1 Option A from backlog):
 * only checks that the correct note names (e.g. C, E, G for C-Dur) are
 * present, regardless of octave or voicing.
 */

import { CHORDS } from '../../data/akkordData.js';
import { frequencyToNote, NOTE_NAMES } from '../../tools/guitarTuner/pitchLogic.js';

// Open string MIDI numbers for strings 1–6 (index 0 = string 1 = high e = E4).
// MIDI 69 = A4 = 440 Hz, so E4 = MIDI 64, B3 = 59, G3 = 55, D3 = 50, A2 = 45, E2 = 40.
const OPEN_STRING_MIDI = [64, 59, 55, 50, 45, 40];

/**
 * Converts a MIDI note number to { note, octave }.
 * @param {number} midi
 * @returns {{ note: string, octave: number }}
 */
function midiToNote(midi) {
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return { note: NOTE_NAMES[noteIndex], octave };
}

/**
 * Returns the sounding notes for the given chord name.
 * Muted strings are excluded; open strings (fret 0) are included.
 *
 * @param {string} chordName - e.g. 'C-Dur', 'G-Dur'
 * @returns {Array<{ note: string, octave: number, string: number, fret: number }>}
 *          Empty array if chord is unknown.
 */
export function getChordNotes(chordName) {
  const positions = CHORDS[chordName];
  if (!positions) return [];

  return positions
    .filter(pos => !pos.muted)
    .map(pos => {
      const stringIndex = pos.string - 1; // 0-based: string 1 → index 0
      const openMidi = OPEN_STRING_MIDI[stringIndex];
      const midi = openMidi + pos.fret;
      const { note, octave } = midiToNote(midi);
      return { note, octave, string: pos.string, fret: pos.fret };
    });
}

/**
 * Converts an array of frequency peaks to detected note objects.
 * Zero and negative frequencies are filtered out.
 *
 * @param {number[]} freqPeaks - Frequency values in Hz (e.g. from FFT peak detection)
 * @returns {Array<{ note: string, octave: number, cents: number, frequency: number }>}
 */
export function identifyNotesFromPeaks(freqPeaks) {
  return freqPeaks
    .filter(freq => freq > 0)
    .map(freq => {
      const result = frequencyToNote(freq);
      return { ...result, frequency: freq };
    });
}

/**
 * Matches detected notes against a target chord using note-class matching (ignores octave).
 *
 * Returns:
 * - isCorrect: true when all expected note classes are present in detected notes
 * - missingNotes: note names from the chord that were not detected
 * - extraNotes: detected note names that are not part of the chord
 * - confidence: fraction of chord note classes that were detected (0–1)
 *
 * @param {Array<{ note: string, octave?: number }>} detectedNotes
 * @param {string} targetChordName - e.g. 'C-Dur'
 * @returns {{ isCorrect: boolean, missingNotes: string[], extraNotes: string[], confidence: number }}
 */
export function matchChordToTarget(detectedNotes, targetChordName) {
  const chordNotes = getChordNotes(targetChordName);
  if (!chordNotes.length) {
    return {
      isCorrect: false,
      missingNotes: [],
      extraNotes: detectedNotes.map(n => n.note),
      confidence: 0,
    };
  }

  // Unique note classes (name only, no octave) expected in this chord
  const expectedClasses = [...new Set(chordNotes.map(n => n.note))];
  // Unique note classes present in what was detected
  const detectedClasses = [...new Set(detectedNotes.map(n => n.note))];

  const missingNotes = expectedClasses.filter(n => !detectedClasses.includes(n));
  const extraNotes = detectedClasses.filter(n => !expectedClasses.includes(n));

  const matchedCount = expectedClasses.length - missingNotes.length;
  const confidence = expectedClasses.length > 0 ? matchedCount / expectedClasses.length : 0;
  // isCorrect = all expected notes found (extra notes are allowed)
  const isCorrect = missingNotes.length === 0;

  return { isCorrect, missingNotes, extraNotes, confidence };
}
