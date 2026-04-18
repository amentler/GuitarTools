/**
 * essentiaChordLogic.js
 * Pure functions for HPCP-based chord matching.
 * No DOM, no audio, no WASM – fully unit-testable.
 *
 * Approach: compare a 12-bin HPCP vector against chord templates
 * using cosine similarity. Templates are derived from akkordData.js.
 */

import { CHORDS } from '../../data/akkordData.js';
import { getChordNotes } from '../chordExercise/chordDetectionLogic.js';

// Pitch-class bin: C=0, C#=1, D=2, D#=3, E=4, F=5, F#=6, G=7, G#=8, A=9, A#=10, B=11
const NOTE_TO_BIN = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

/**
 * Builds a 12-bin binary template for every chord in akkordData.
 * Each bin is 1 if the pitch class is part of the chord, 0 otherwise.
 *
 * @returns {Object.<string, Float32Array>} map from chord name to 12-bin template
 */
export function buildChordTemplates() {
  const templates = {};
  for (const chordName of Object.keys(CHORDS)) {
    const notes = getChordNotes(chordName);
    const template = new Float32Array(12);
    for (const { note } of notes) {
      const bin = NOTE_TO_BIN[note];
      if (bin !== undefined) template[bin] = 1;
    }
    templates[chordName] = template;
  }
  return templates;
}

/**
 * Cosine similarity between two numeric arrays of equal length.
 * Returns 0 if either vector is all-zero.
 *
 * @param {ArrayLike<number>} a
 * @param {ArrayLike<number>} b
 * @returns {number} similarity in [0, 1]
 */
export function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Averages an array of 12-bin HPCP vectors (element-wise mean).
 *
 * @param {Array<ArrayLike<number>>} hpcps
 * @returns {Float32Array} averaged 12-bin vector
 */
export function averageHpcps(hpcps) {
  const avg = new Float32Array(12);
  if (!hpcps.length) return avg;
  for (const h of hpcps) {
    for (let i = 0; i < 12; i++) avg[i] += h[i];
  }
  const n = hpcps.length;
  for (let i = 0; i < 12; i++) avg[i] /= n;
  return avg;
}

/**
 * Matches an HPCP vector against the target chord using cosine similarity.
 *
 * The result is "correct" when:
 *   - the target chord's cosine similarity ≥ threshold
 *   - no other chord scores more than (targetScore + epsilon) above the target
 *
 * @param {ArrayLike<number>} hpcp           12-bin HPCP vector
 * @param {string}            targetChordName chord to match against
 * @param {Object}            templates       map from chord name to template (from buildChordTemplates)
 * @param {number}            [threshold=0.65] minimum similarity for "correct"
 * @returns {{ isCorrect: boolean, confidence: number, bestMatch: string|null, bestScore: number }}
 */
export function matchHpcpToChord(hpcp, targetChordName, templates, threshold = 0.65) {
  const targetTemplate = templates[targetChordName];
  if (!targetTemplate) {
    return { isCorrect: false, confidence: 0, bestMatch: null, bestScore: 0 };
  }

  const confidence = cosineSimilarity(hpcp, targetTemplate);

  let bestMatch = null;
  let bestScore = -1;
  for (const [name, template] of Object.entries(templates)) {
    const score = cosineSimilarity(hpcp, template);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = name;
    }
  }

  // Correct if target is the best match (within 0.05 tolerance) and above threshold
  const isCorrect = confidence >= threshold && (bestMatch === targetChordName || bestScore - confidence <= 0.05);

  return { isCorrect, confidence, bestMatch, bestScore };
}
