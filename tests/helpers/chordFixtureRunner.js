/**
 * chordFixtureRunner.js
 * Helper for chord detection integration tests using WAV files.
 *
 * Computes an FFT-based dB spectrum from time-domain samples so that
 * detectPeaksFromSpectrum (from chordDetection.js) can be used in Node.js tests.
 */

import { detectPeaksFromSpectrum } from '../../js/games/chordExercise/chordDetection.js';
import { filterHarmonicPeaks, identifyNotesFromPeaks, matchChordToTarget } from '../../js/games/chordExercise/chordDetectionLogic.js';

const DEFAULT_FFT_SIZE = 16384;
const GUITAR_MIN_HZ = 70;
const GUITAR_MAX_HZ = 1200;
const DEFAULT_DB_THRESHOLD = -70; // looser than production (-55) for quieter recordings

// ── Radix-2 Cooley-Tukey FFT (in-place) ──────────────────────────────────────

function fftInPlace(re, im) {
  const n = re.length;
  // Bit-reversal permutation
  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let tmp = re[i]; re[i] = re[j]; re[j] = tmp;
      tmp = im[i]; im[i] = im[j]; im[j] = tmp;
    }
  }
  // Butterfly stages
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0;
      const half = len >> 1;
      for (let k = 0; k < half; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + half] * curRe - im[i + k + half] * curIm;
        const vIm = re[i + k + half] * curIm + im[i + k + half] * curRe;
        re[i + k]        = uRe + vRe;
        im[i + k]        = uIm + vIm;
        re[i + k + half] = uRe - vRe;
        im[i + k + half] = uIm - vIm;
        const nRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nRe;
      }
    }
  }
}

// ── Public helpers ────────────────────────────────────────────────────────────

/**
 * Compute a dBFS magnitude spectrum compatible with detectPeaksFromSpectrum.
 * Normalisation: 0 dBFS = sine wave with amplitude 1.0.
 *
 * @param {Float32Array} samples   Time-domain audio samples.
 * @param {number}       fftSize   Power-of-two window size (default 16384).
 * @returns {Float32Array}         dB values for bins [0, fftSize/2).
 */
export function computeDbSpectrum(samples, fftSize = DEFAULT_FFT_SIZE) {
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);

  // Hann window applied to whichever is smaller: fftSize or sample count
  const n = Math.min(fftSize, samples.length);
  for (let i = 0; i < n; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    re[i] = samples[i] * w;
  }

  fftInPlace(re, im);

  const numBins = fftSize >> 1;
  const norm = fftSize >> 1; // normalise so full-scale sine → 0 dBFS
  const db = new Float32Array(numBins);
  for (let i = 0; i < numBins; i++) {
    const mag = Math.sqrt(re[i] * re[i] + im[i] * im[i]) / norm;
    db[i] = mag > 1e-9 ? 20 * Math.log10(mag) : -200;
  }
  return db;
}

/**
 * Extract the center window from a samples array (avoids attack/release).
 *
 * @param {Float32Array} samples
 * @param {number}       windowSize
 * @returns {Float32Array}
 */
export function sliceCenterWindow(samples, windowSize) {
  const start = Math.max(0, Math.floor((samples.length - windowSize) / 2));
  return samples.slice(start, start + windowSize);
}

/**
 * Full chord-detection pipeline on a Float32Array of audio samples.
 *
 * @param {Float32Array} samples
 * @param {number}       sampleRate
 * @param {string}       targetChord  e.g. 'G-Dur'
 * @param {object}       [options]
 * @param {number}       [options.fftSize=16384]
 * @param {number}       [options.minFreqHz=70]
 * @param {number}       [options.maxFreqHz=1200]
 * @param {number}       [options.minDbThreshold=-70]
 * @returns {{ isCorrect: boolean, missingNotes: string[], extraNotes: string[], confidence: number, detectedNotes: Array }}
 */
export function detectChordFromSamples(samples, sampleRate, targetChord, options = {}) {
  const {
    fftSize      = DEFAULT_FFT_SIZE,
    minFreqHz    = GUITAR_MIN_HZ,
    maxFreqHz    = GUITAR_MAX_HZ,
    minDbThreshold = DEFAULT_DB_THRESHOLD,
  } = options;

  const db     = computeDbSpectrum(samples, fftSize);
  const peaks  = detectPeaksFromSpectrum(db, sampleRate, minFreqHz, maxFreqHz, minDbThreshold);
  const detectedNotes = identifyNotesFromPeaks(filterHarmonicPeaks(peaks));
  const result = matchChordToTarget(detectedNotes, targetChord);
  return { ...result, detectedNotes };
}
