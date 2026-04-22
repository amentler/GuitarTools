/**
 * essentiaChordLogic.js
 * Pure functions for HPCP-based chord matching.
 * No DOM, no audio, no WASM – fully unit-testable.
 *
 * Approach: compare a 12-bin HPCP vector against chord templates
 * using cosine similarity. Templates are derived from akkordData.js.
 */

import { CHORDS } from '../../data/akkordData.js';
import { getChordNotes } from '../../domain/chords/chordDetectionLogic.js';

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
 * Computes a 12-bin HPCP vector from spectral peak frequencies and magnitudes
 * in pure JavaScript — no WASM required.
 *
 * referenceFrequency = C4 = 261.626 Hz so that bin 0 = C, matching NOTE_TO_BIN
 * and the templates built by buildChordTemplates().
 *
 * Using A4 = 440 Hz as the reference (as the essentia default does) would shift
 * all bins by +9, making C land on bin 3 and breaking template matching.
 *
 * @param {number[]} peakFreqs         Peak frequencies in Hz
 * @param {number[]} peakMags          Corresponding linear magnitudes
 * @param {number}  [referenceFrequency=261.626]  Frequency of bin 0 (C4)
 * @param {number}  [hpcpSize=12]
 * @param {number}  [windowSize=1]     squaredCosine window width in bins
 * @returns {Float32Array} 12-bin HPCP (values normalised to [0, 1])
 */
export function computeHpcpPureJS(peakFreqs, peakMags, referenceFrequency = 261.626, hpcpSize = 12, windowSize = 1) {
  const hpcp = new Float32Array(hpcpSize);
  const half = windowSize / 2;

  for (let i = 0; i < peakFreqs.length; i++) {
    const f = peakFreqs[i];
    const m = peakMags[i];
    if (f <= 0 || m <= 0) continue;

    // Fractional pitch-class bin position (octave-invariant via modulo)
    const pc = ((hpcpSize * Math.log2(f / referenceFrequency)) % hpcpSize + hpcpSize) % hpcpSize;

    for (let b = 0; b < hpcpSize; b++) {
      let dist = Math.abs(b - pc);
      if (dist > hpcpSize / 2) dist = hpcpSize - dist; // circular wrap
      if (dist <= half) {
        const w = Math.cos((Math.PI * dist) / windowSize);
        hpcp[b] += m * w * w; // squaredCosine weight
      }
    }
  }

  // unitMax normalisation
  let maxVal = 0;
  for (const v of hpcp) if (v > maxVal) maxVal = v;
  if (maxVal > 0) for (let b = 0; b < hpcpSize; b++) hpcp[b] /= maxVal;

  return hpcp;
}

/**
 * Returns true when every active bin of subTemplate is also active in superTemplate.
 * Used to detect when the best-matching chord is a pitch-class subset of the target,
 * which indicates the recording contains all required notes (the cosine denominator
 * effect just favours the smaller template).
 */
function isSubsetOf(subTemplate, superTemplate) {
  for (let i = 0; i < 12; i++) {
    if (subTemplate[i] > 0 && superTemplate[i] === 0) return false;
  }
  return true;
}

/**
 * Matches an HPCP vector against the target chord using cosine similarity.
 *
 * The result is "correct" when:
 *   - the target chord's cosine similarity ≥ threshold, AND one of:
 *     a) the target is the best match overall
 *     b) the best match is within 0.05 of the target (ties / variants)
 *     c) the best match is a pitch-class subset of the target — cosine similarity
 *        systematically favours smaller templates (smaller L2 norm), so if the
 *        top-scoring chord contains only notes that are also in the target, the
 *        recording does contain all required notes and the target should be accepted
 *        (e.g. Esus2 [E,B] ⊂ E-Dur [E,G#,B] when G# is present but weak).
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

  const isCorrect = confidence >= threshold && (
    bestMatch === targetChordName ||
    bestScore - confidence <= 0.05 ||
    isSubsetOf(templates[bestMatch], targetTemplate)
  );

  return { isCorrect, confidence, bestMatch, bestScore };
}
