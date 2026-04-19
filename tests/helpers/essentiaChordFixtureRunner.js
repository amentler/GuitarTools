/**
 * essentiaChordFixtureRunner.js
 * Helper for essentia HPCP-based chord detection integration tests using WAV files.
 *
 * Mirrors the production pipeline in essentiaChordDetection.js, using:
 *   detectEssentiaPeaks (pure function exported from essentiaChordDetection.js)
 *   computeHpcpPureJS   (pure-JS HPCP — same algorithm as the WASM path)
 *   averageHpcps        (multi-frame average, matching ANALYSIS_FRAMES=6)
 *   matchHpcpToChord    (cosine-similarity matching)
 *
 * The essentia WASM is NOT loaded — this tests the application's own pipeline
 * logic, not the essentia library itself.
 *
 * FFT_SIZE=8192 (vs 4096 in production): tests have no real-time constraint so
 * the larger window gives better frequency resolution (~5.4 Hz/bin vs ~10.8 Hz/bin),
 * which helps disambiguate close-together harmonics in real guitar recordings.
 */

import { detectEssentiaPeaks } from '../../js/games/chordExerciseEssentia/essentiaChordDetection.js';
import {
  computeHpcpPureJS,
  averageHpcps,
  matchHpcpToChord,
  buildChordTemplates,
} from '../../js/games/chordExerciseEssentia/essentiaChordLogic.js';

// ── Radix-2 Cooley-Tukey FFT (in-place) ──────────────────────────────────────

function fftInPlace(re, im) {
  const n = re.length;
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

/**
 * Compute a dBFS magnitude spectrum (Hann window).
 * Normalisation: 0 dBFS = sine wave with amplitude 1.0.
 *
 * @param {Float32Array} samples
 * @param {number}       fftSize  Power-of-two window size.
 * @returns {Float32Array}        dB values for bins [0, fftSize/2).
 */
function computeDbSpectrum(samples, fftSize) {
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  const n = Math.min(fftSize, samples.length);
  for (let i = 0; i < n; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    re[i] = samples[i] * w;
  }
  fftInPlace(re, im);
  const numBins = fftSize >> 1;
  const norm = fftSize >> 1;
  const db = new Float32Array(numBins);
  for (let i = 0; i < numBins; i++) {
    const mag = Math.sqrt(re[i] * re[i] + im[i] * im[i]) / norm;
    db[i] = mag > 1e-9 ? 20 * Math.log10(mag) : -200;
  }
  return db;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// 8192 gives ~5.4 Hz/bin at 44100 Hz — better than production's 4096 (~10.8 Hz/bin)
// so close harmonics in real recordings resolve cleanly without latency constraints.
const FFT_SIZE          = 8192;
const ANALYSIS_FRAMES   = 6;
const HPCP_REFERENCE_HZ = 261.626;  // C4, matches production

const CHORD_TEMPLATES = buildChordTemplates();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Full essentia HPCP pipeline on a Float32Array of audio samples.
 *
 * Takes ANALYSIS_FRAMES evenly-spaced windows from the centre of the recording,
 * computes an HPCP vector for each, averages them, and matches the result against
 * the target chord — mirroring the production collectAndResolve() flow.
 *
 * @param {Float32Array} samples
 * @param {number}       sampleRate
 * @param {string}       targetChord  e.g. 'G-Dur'
 * @returns {{ isCorrect: boolean, confidence: number, bestMatch: string|null, bestScore: number }}
 */
export function detectEssentiaChordFromSamples(samples, sampleRate, targetChord) {
  const totalWindow = FFT_SIZE * ANALYSIS_FRAMES;
  const centerStart = Math.max(0, Math.floor((samples.length - totalWindow) / 2));

  const hpcps = [];
  for (let i = 0; i < ANALYSIS_FRAMES; i++) {
    const start = Math.min(centerStart + i * FFT_SIZE, samples.length - FFT_SIZE);
    if (start < 0) break;
    const frame = samples.slice(start, start + FFT_SIZE);
    const freqData = computeDbSpectrum(frame, FFT_SIZE);
    const { peakFreqs, peakMags } = detectEssentiaPeaks(freqData, sampleRate);
    if (peakFreqs.length > 0) {
      hpcps.push(computeHpcpPureJS(peakFreqs, peakMags, HPCP_REFERENCE_HZ));
    }
  }

  if (!hpcps.length) {
    return { isCorrect: false, confidence: 0, bestMatch: null, bestScore: 0 };
  }

  const avgHpcp = averageHpcps(hpcps);
  return matchHpcpToChord(avgHpcp, targetChord, CHORD_TEMPLATES);
}
