// Shared guitar pitch detection and math – no DOM or controller state
//
// NOTE: This is the tuner's precision pitch-detection pipeline (YIN + HPS
// combined, adaptive fftSize, median stabilisation, EMA smoothing). It is
// intentionally NOT shared with exercise modules ("Noten spielen", "Ton spielen")
// because those prioritise speed over precision (smaller windows, fastNoteMatcher
// classifier). A shared pipeline would force one precision/latency trade-off
// on all features.
// See improvement.md §1.4 for the design rationale.

export const STANDARD_TUNING = [
  { note: 'E', octave: 2 },
  { note: 'A', octave: 2 },
  { note: 'D', octave: 3 },
  { note: 'G', octave: 3 },
  { note: 'B', octave: 3 },
  { note: 'E', octave: 4 },
];

import {
  analyzeInputLevel,
  GUITAR_MIN_RMS,
  GUITAR_MAX_CLIPPING_RATIO,
} from './inputLevel.js';
import {
  NOTE_NAMES,
  frequencyToNote,
  noteToFrequency,
} from '../../domain/pitch/pitchCore.js';

export { NOTE_NAMES, frequencyToNote, noteToFrequency, analyzeInputLevel, GUITAR_MIN_RMS, GUITAR_MAX_CLIPPING_RATIO };

export const GUITAR_MIN_FREQUENCY = 70;
export const GUITAR_MAX_FREQUENCY = 1000;
// ── V4: Adaptiver Noise Floor ────────────────────────────────────────────────

/** Multiplier applied to measured noise floor to derive the effective RMS gate. */
export const NOISE_FLOOR_SCALE_FACTOR = 2.5;

/** Hard cap on the adaptive threshold so legitimate guitar signals are never gated. */
export const MAX_ADAPTIVE_THRESHOLD = 0.15;

/**
 * Returns the median RMS of the provided samples (robust noise floor estimate).
 * @param {number[]} rmsValues
 * @returns {number}
 */
export function estimateNoiseFloorRms(rmsValues) {
  if (rmsValues.length === 0) return 0;
  const sorted = rmsValues.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Derives the effective RMS gate from a measured noise floor.
 * `effectiveMinRms = clamp(noiseFloorRms * NOISE_FLOOR_SCALE_FACTOR,
 *                          GUITAR_MIN_RMS, MAX_ADAPTIVE_THRESHOLD)`
 * @param {number} noiseFloorRms
 * @returns {number}
 */
export function buildAdaptiveThreshold(noiseFloorRms) {
  return Math.min(
    MAX_ADAPTIVE_THRESHOLD,
    Math.max(GUITAR_MIN_RMS, noiseFloorRms * NOISE_FLOOR_SCALE_FACTOR),
  );
}

/**
 * Detects the fundamental frequency using the YIN algorithm.
 * More reliable than naive autocorrelation – correctly identifies the
 * fundamental even when overtones have higher energy.
 * @param {number|null} referenceHz
 * @returns {number}
 */
export function getAdaptiveFftSize(referenceHz = null) {
  // E2 (≤90 Hz): extra-large window for enough periods at very low frequencies.
  if (referenceHz !== null && referenceHz <= 90) return 32768;
  // G3/B3/E4 (>160 Hz): smaller window sufficient – reduces latency by ~50 %.
  if (referenceHz !== null && referenceHz > 160) return 8192;
  // A2/D3 (90–160 Hz) and free mode (null): safe middle-ground.
  return 16384;
}

function onePoleLowpass(input, sampleRate, cutoffHz) {
  const out = new Float32Array(input.length);
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / sampleRate;
  const alpha = dt / (rc + dt);
  let prev = input[0] ?? 0;
  out[0] = prev;
  for (let i = 1; i < input.length; i++) {
    prev = prev + alpha * (input[i] - prev);
    out[i] = prev;
  }
  return out;
}

function onePoleHighpass(input, sampleRate, cutoffHz) {
  const out = new Float32Array(input.length);
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / sampleRate;
  const alpha = rc / (rc + dt);
  let prevY = 0;
  let prevX = input[0] ?? 0;
  out[0] = 0;
  for (let i = 1; i < input.length; i++) {
    const x = input[i];
    const y = alpha * (prevY + x - prevX);
    out[i] = y;
    prevY = y;
    prevX = x;
  }
  return out;
}

export function applyGuitarBandpass(buffer, sampleRate, lowHz = GUITAR_MIN_FREQUENCY, highHz = GUITAR_MAX_FREQUENCY) {
  const highpassed = onePoleHighpass(buffer, sampleRate, lowHz);
  return onePoleLowpass(highpassed, sampleRate, highHz);
}

export function dampAttack(buffer, dampingRatio) {
  const out = new Float32Array(buffer.length);
  const attackSamples = Math.max(1, Math.floor(buffer.length * dampingRatio));
  for (let i = 0; i < buffer.length; i++) {
    const t = i < attackSamples ? i / attackSamples : 1;
    const gain = 0.35 + 0.65 * t;
    out[i] = buffer[i] * gain;
  }
  return out;
}

function detectPitchYin(buffer, sampleRate, minFreq, maxFreq, minPeriods = 3) {
  const minPeriod = Math.floor(sampleRate / maxFreq);
  const maxPeriod = Math.floor(sampleRate / minFreq);
  const halfN = Math.floor(buffer.length / 2);
  if (maxPeriod >= buffer.length - 2 || halfN < maxPeriod) return null;
  if (buffer.length < Math.floor((sampleRate / minFreq) * minPeriods)) return null;

  const diff = new Float32Array(maxPeriod + 1);
  for (let tau = 1; tau <= maxPeriod; tau++) {
    let sum = 0;
    for (let i = 0; i < halfN; i++) {
      const delta = buffer[i] - buffer[i + tau];
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  const cmnd = new Float32Array(maxPeriod + 1);
  cmnd[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau <= maxPeriod; tau++) {
    runningSum += diff[tau];
    cmnd[tau] = runningSum === 0 ? 0 : (diff[tau] * tau) / runningSum;
  }

  const THRESHOLD = 0.15;
  let bestTau = -1;

  for (let tau = minPeriod; tau <= maxPeriod - 1; tau++) {
    if (cmnd[tau] < THRESHOLD) {
      while (tau + 1 <= maxPeriod && cmnd[tau + 1] < cmnd[tau]) tau++;
      bestTau = tau;
      break;
    }
  }

  if (bestTau === -1) {
    let minVal = Infinity;
    for (let tau = minPeriod; tau <= maxPeriod; tau++) {
      if (cmnd[tau] < minVal) { minVal = cmnd[tau]; bestTau = tau; }
    }
    if (minVal > 0.5) return null;
  }

  // Subharmonic check: prefer lower fundamental if quality is very close.
  // Threshold tightened from 1.08 → 1.02 to avoid demoting correctly-detected
  // fundamentals (B3, E4) to their subharmonics on real guitar recordings.
  for (const factor of [2, 3]) {
    const candidateTau = bestTau * factor;
    const candidateIdx = Math.round(candidateTau);
    if (candidateIdx <= maxPeriod && cmnd[candidateIdx] <= cmnd[Math.round(bestTau)] * 1.02) {
      bestTau = candidateTau;
      break;
    }
  }

  // 5-point least-squares parabolic interpolation for sub-sample period refinement.
  if (bestTau > 2 && bestTau < maxPeriod - 1) {
    const ya = cmnd[bestTau - 2];
    const y1 = cmnd[bestTau - 1];
    const y2 = cmnd[bestTau];
    const y3 = cmnd[bestTau + 1];
    const yb = cmnd[bestTau + 2];
    const a = (2 * ya - y1 - 2 * y2 - y3 + 2 * yb) / 14;
    const b = (-2 * ya - y1 + y3 + 2 * yb) / 10;
    if (a > 0) bestTau = bestTau - b / (2 * a);
  } else if (bestTau > 1 && bestTau < maxPeriod) {
    const y1 = cmnd[bestTau - 1];
    const y2 = cmnd[bestTau];
    const y3 = cmnd[bestTau + 1];
    const denom = 2 * (y1 + y3 - 2 * y2);
    if (denom !== 0) bestTau = bestTau + (y1 - y3) / denom;
  }

  const hz = sampleRate / bestTau;
  return hz >= minFreq && hz <= maxFreq ? hz : null;
}

function detectPitchHps(buffer, sampleRate, minFreq, maxFreq) {
  const n = buffer.length;
  let bestFreq = null;
  let bestScore = 0;
  const minBin = Math.max(1, Math.floor((minFreq * n) / sampleRate));
  const maxBin = Math.min(Math.floor(n / 3) - 1, Math.ceil((maxFreq * n) / sampleRate));

  for (let k = minBin; k <= maxBin; k++) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      const phase = (2 * Math.PI * k * i) / n;
      re += buffer[i] * Math.cos(phase);
      im -= buffer[i] * Math.sin(phase);
    }
    const m1 = Math.hypot(re, im);

    const k2 = k * 2;
    const k3 = k * 3;
    if (k3 >= n / 2) continue;
    let re2 = 0; let im2 = 0;
    let re3 = 0; let im3 = 0;
    for (let i = 0; i < n; i++) {
      const phase2 = (2 * Math.PI * k2 * i) / n;
      re2 += buffer[i] * Math.cos(phase2);
      im2 -= buffer[i] * Math.sin(phase2);
      const phase3 = (2 * Math.PI * k3 * i) / n;
      re3 += buffer[i] * Math.cos(phase3);
      im3 -= buffer[i] * Math.sin(phase3);
    }
    const score = m1 * Math.max(1e-8, Math.hypot(re2, im2)) * Math.max(1e-8, Math.hypot(re3, im3));
    if (score > bestScore) {
      bestScore = score;
      bestFreq = (k * sampleRate) / n;
    }
  }
  return bestFreq;
}

function centsDistance(a, b) {
  return Math.abs(1200 * Math.log2(a / b));
}

function selectCombinedPitch(yinHz, hpsHz, hpsAgreementCents, lastStableHz = null) {
  if (yinHz === null && hpsHz === null) return null;
  if (yinHz !== null && hpsHz !== null) {
    if (centsDistance(yinHz, hpsHz) <= hpsAgreementCents) return yinHz;
    if (centsDistance(yinHz * 2, hpsHz) <= 50) return yinHz * 2;
    if (centsDistance(yinHz * 3, hpsHz) <= 50) return yinHz * 3;
    if (lastStableHz !== null) {
      return centsDistance(yinHz, lastStableHz) <= centsDistance(hpsHz, lastStableHz) ? yinHz : hpsHz;
    }
    return yinHz;
  }
  return yinHz ?? hpsHz;
}

// ── V5: HPS auf FFT-Magnitude-Array ─────────────────────────────────────────

/**
 * Minimum HPS score (dB sum of three harmonics) to consider a pitch valid.
 * A flat noise floor at –100 dBFS gives a score of –300; any genuine harmonic
 * structure will score significantly higher.
 */
export const HPS_NULL_SCORE_THRESHOLD = -200;

/**
 * Returns the maximum dB value in a ±1 bin neighbourhood.
 * Compensates for FFT bin-rounding when harmonics don't fall exactly on a bin.
 * @param {Float32Array} mags
 * @param {number}       bin
 * @returns {number}
 */
function peakNear(mags, bin) {
  const lo = Math.max(0, bin - 1);
  const hi = Math.min(mags.length - 1, bin + 1);
  return Math.max(mags[lo], mags[bin], mags[hi]);
}

/**
 * Harmonic Product Spectrum on a pre-computed FFT magnitude array (dBFS values
 * as returned by `AnalyserNode.getFloatFrequencyData`).
 *
 * In dB space the product of magnitudes becomes a sum:
 *   HPS_score[k] = mag[k] + peakNear(mag, 2k) + peakNear(mag, 3k)
 *
 * @param {Float32Array} magnitudes  Half-spectrum dB magnitudes (length = fftSize / 2).
 * @param {number}       binHz       Hz per bin (= sampleRate / fftSize).
 * @param {number}       minFreq     Lower search limit in Hz.
 * @param {number}       maxFreq     Upper search limit in Hz.
 * @returns {number|null}            Detected fundamental in Hz, or null.
 */
export function hpsFromMagnitudes(magnitudes, binHz, minFreq, maxFreq) {
  const minBin = Math.max(1, Math.round(minFreq / binHz));
  const maxBin = Math.min(
    Math.floor(magnitudes.length / 3) - 1,
    Math.round(maxFreq / binHz),
  );

  let bestBin = -1;
  let bestScore = -Infinity;

  for (let k = minBin; k <= maxBin; k++) {
    const score = magnitudes[k] + peakNear(magnitudes, k * 2) + peakNear(magnitudes, k * 3);
    if (score > bestScore) {
      bestScore = score;
      bestBin = k;
    }
  }

  if (bestBin === -1 || bestScore <= HPS_NULL_SCORE_THRESHOLD) return null;
  return bestBin * binHz;
}

export function detectPitch(buffer, sampleRate, options = {}) {
  const minRms = options.minRms ?? GUITAR_MIN_RMS;
  const level = analyzeInputLevel(buffer, minRms);
  if (!level.isValid) return null;

  const referenceHz = options.referenceHz ?? null;
  const minFreq = referenceHz !== null ? Math.max(GUITAR_MIN_FREQUENCY, referenceHz * 0.55) : GUITAR_MIN_FREQUENCY;
  const maxFreq = referenceHz !== null ? Math.min(GUITAR_MAX_FREQUENCY, referenceHz * 1.8) : GUITAR_MAX_FREQUENCY;
  const minPeriods = minFreq < 120 ? 4 : 3;
  
  // These options come from the heuristic layer (tuner) or are provided as defaults
  const dampingRatio = options.dampingRatio ?? 0.1; // Restore damping by default
  const hpsAgreementCents = options.hpsAgreementCents ?? 35;
  const applyFilters = options.applyFilters ?? true;

  let prepared = buffer;
  if (applyFilters) {
    prepared = applyGuitarBandpass(buffer, sampleRate, GUITAR_MIN_FREQUENCY, GUITAR_MAX_FREQUENCY);
  }
  
  // dampAttack was always called in the monolithic version
  prepared = dampAttack(prepared, dampingRatio);

  const yinHz = detectPitchYin(prepared, sampleRate, minFreq, maxFreq, minPeriods);
  
  let hpsHz;
  if (options.magnitudes) {
    const binHz = sampleRate / (options.magnitudes.length * 2);
    hpsHz = hpsFromMagnitudes(options.magnitudes, binHz, minFreq, maxFreq);
  } else {
    hpsHz = detectPitchHps(prepared, sampleRate, minFreq, maxFreq);
  }
  
  return selectCombinedPitch(yinHz, hpsHz, hpsAgreementCents, options.lastStableHz ?? null);
}

/**
 * Returns the cents difference of detectedFreq relative to targetFreq.
 * Positive = detected is above target (too high).
 * Negative = detected is below target (too low).
 * @param {number} detectedFreq Hz
 * @param {number} targetFreq   Hz
 * @returns {number} cents
 */
export function getCentsToTarget(detectedFreq, targetFreq) {
  return 1200 * Math.log2(detectedFreq / targetFreq);
}

/**
 * Returns true if the given note/octave is one of the standard guitar open strings.
 * @param {string} note
 * @param {number} octave
 * @returns {boolean}
 */
export function isStandardTuningNote(note, octave) {
  return STANDARD_TUNING.some(s => s.note === note && s.octave === octave);
}
