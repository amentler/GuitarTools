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

// Standard-tuning open-string fundamental frequencies (E2–E4), used to detect
// sympathetic resonance artifacts from muted open strings.
const GUITAR_OPEN_STRING_HZ = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63];

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
 * Removes frequencies that are likely harmonics of a lower detected frequency.
 *
 * Pass 1 – integer harmonic filter:
 *   Iterates from the lowest peak upward. For each confirmed fundamental f0,
 *   any peak within `toleranceCents` of f0 × n (n = 2…maxHarmonic) is tagged
 *   as a harmonic and excluded from the output.
 *
 * Pass 2 – virtual open-string fundamental filter:
 *   Catches sympathetic resonance from muted open strings whose fundamental is
 *   too quiet to be detected directly (e.g. muted low-E string on a C chord).
 *   A surviving peak f is tagged as a virtual harmonic when ALL three conditions
 *   hold for some n (3…maxHarmonic):
 *     a) f/n matches a guitar open-string frequency within toleranceCents
 *     b) that open-string frequency is not itself a detected survivor
 *     c) another survivor lies within toleranceCents of m × (f/n) for some m < n
 *
 * @param {number[]} freqPeaks      Frequency values in Hz, any order.
 * @param {number}   toleranceCents Acceptance window in cents (default 50).
 * @param {number}   maxHarmonic    Highest harmonic multiple to test (default 12).
 * @returns {number[]} Subset of freqPeaks containing only fundamentals, ascending.
 */
export function filterHarmonicPeaks(freqPeaks, toleranceCents = 50, maxHarmonic = 12) {
  const sorted = [...freqPeaks].filter(f => f > 0).sort((a, b) => a - b);
  const harmonic = new Set();

  // Pass 1: remove integer harmonics of detected fundamentals
  for (let i = 0; i < sorted.length; i++) {
    if (harmonic.has(sorted[i])) continue;
    const f0 = sorted[i];
    for (let n = 2; n <= maxHarmonic; n++) {
      const target = f0 * n;
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[j] > target * 1.1) break;
        const cents = Math.abs(1200 * Math.log2(sorted[j] / target));
        if (cents <= toleranceCents) {
          harmonic.add(sorted[j]);
        }
      }
    }
  }

  const survivors = sorted.filter(f => !harmonic.has(f));

  // Pass 2: remove virtual harmonics of undetected open-string fundamentals
  const virtualHarmonic = new Set();
  for (const f of survivors) {
    if (virtualHarmonic.has(f)) continue;
    let tagged = false;
    for (let n = 3; n <= maxHarmonic && !tagged; n++) {
      const fv = f / n;
      // (a) fv must match a guitar open-string frequency
      const matchesOpenString = GUITAR_OPEN_STRING_HZ.some(
        s => Math.abs(1200 * Math.log2(fv / s)) <= toleranceCents,
      );
      if (!matchesOpenString) continue;
      // (b) fv must NOT already be present as a detected survivor
      const fvDetected = survivors.some(
        s => Math.abs(1200 * Math.log2(s / fv)) <= toleranceCents,
      );
      if (fvDetected) continue;
      // (c) another survivor must corroborate the virtual fundamental
      for (const other of survivors) {
        if (other === f) continue;
        for (let m = 2; m < n; m++) {
          if (Math.abs(1200 * Math.log2(other / (m * fv))) <= toleranceCents) {
            virtualHarmonic.add(f);
            tagged = true;
            break;
          }
        }
        if (tagged) break;
      }
    }
  }

  return survivors.filter(f => !virtualHarmonic.has(f));
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
  // isCorrect = all expected notes found AND no extra fundamental notes detected.
  // Extra notes that slip through harmonic filtering represent genuinely wrong
  // played notes (e.g. an open string that should be muted).
  const isCorrect = missingNotes.length === 0 && extraNotes.length === 0;

  return { isCorrect, missingNotes, extraNotes, confidence };
}
