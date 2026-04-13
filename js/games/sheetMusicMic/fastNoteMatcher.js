// Fast Note Matcher – pure logic for "Noten spielen" and "Ton spielen"
//
// Target-aware note classification on top of the existing YIN + HPS pipeline
// from tunerLogic. The matcher is intentionally conservative about octaves
// and therefore does NOT use the `referenceHz` narrowing of detectPitch:
// narrowing drops the real fundamental of an octave-up signal out of the
// YIN search band, which in turn makes YIN lock onto the subharmonic and
// mis-classify, e.g., a played E3 as E2. Running detectPitch over the full
//
// NOTE: This classifier is optimised for speed (responsive note detection for
// exercises), NOT precision. The tuner's pipeline (pitchLogic.js) uses larger
// windows, median stabilisation, and EMA smoothing for maximum accuracy. These
// two pipelines are intentionally separate — sharing one fftSize would cause
// audio glitches and force the wrong precision/latency trade-off on one side.
// See improvement.md §1.4 for the design rationale.
// guitar range prevents that collapse.
//
// The cost of running the full-range detection is that every target needs
// at least `ceil(sampleRate / 70) * 4 ≈ 2520` samples (the YIN minimum for
// GUITAR_MIN_FREQUENCY = 70). `getRecommendedFftSize` therefore returns a
// single safe value (4096 at 44.1 kHz) regardless of target pitch; the
// latency of ~93 ms per window is still well within what the exercise needs.
//
// Key concepts:
//   * `getMinSamplesFor(sampleRate)` returns the exact YIN minimum so
//     too-small buffers return `unsure` instead of producing garbage.
//     This was the root cause of the broken "Noten spielen" exercise,
//     which fed a 2048-sample buffer into the full 70 Hz – 560 Hz search
//     range and therefore never produced a valid low-string reading.
//   * `getRecommendedFftSize(sampleRate)` returns the smallest safe
//     power-of-two for the given sample rate.
//   * `classifyFrame` is pure: it does its own noise-gate via detectPitch,
//     compares the detected pitch to the target, and returns a three-way
//     verdict.
//   * `updateMatchState` is a tiny state machine decoupled from timing so
//     tests can drive it frame by frame.

import {
  detectPitch,
  frequencyToNote,
  noteToFrequency,
  GUITAR_MIN_FREQUENCY,
  GUITAR_MIN_RMS,
} from '../../tools/guitarTuner/tunerLogic.js';

// ── Public constants ──────────────────────────────────────────────────────────

/** Consecutive `correct` frames required to emit an `accept` event. */
export const FAST_ACCEPT_STREAK = 2;

/** Consecutive `wrong` frames required to emit a `reject` event. */
export const FAST_REJECT_STREAK = 3;

/** Half-width of the acceptance window in cents (±FAST_CENTS_TOLERANCE). */
export const FAST_CENTS_TOLERANCE = 35;

// ── Pitch-string parsing ──────────────────────────────────────────────────────

const PITCH_RE = /^([A-G]#?)(-?\d+)$/;

/**
 * Parses a canonical pitch string such as "E2" or "C#4" into its components.
 * @param {string} pitch
 * @returns {{ name: string, octave: number }}
 */
export function parsePitch(pitch) {
  const m = PITCH_RE.exec(pitch);
  if (!m) throw new Error(`Invalid pitch string: ${pitch}`);
  return { name: m[1], octave: parseInt(m[2], 10) };
}

// ── Buffer-size helpers ───────────────────────────────────────────────────────

/** YIN `minPeriods` rule from tunerLogic.detectPitch (in lock-step with it). */
function yinMinPeriods(minFreq) {
  return minFreq < 120 ? 4 : 3;
}

/**
 * Minimum number of samples YIN needs for a full-range guitar pitch search
 * at the given sample rate. Derived from the formula used in detectPitchYin:
 * `buffer.length >= (sampleRate / GUITAR_MIN_FREQUENCY) * minPeriods`.
 * Targets are omitted on purpose: the matcher uses the full guitar range so
 * the minimum is the same for every note.
 * @param {string} [_targetPitch]  accepted for API symmetry; ignored
 * @param {number} [sampleRate=44100]
 * @returns {number}
 */
export function getMinSamplesFor(_targetPitch, sampleRate = 44100) {
  const minFreq = GUITAR_MIN_FREQUENCY;
  const minPeriods = yinMinPeriods(minFreq);
  return Math.ceil((sampleRate / minFreq) * minPeriods);
}

const FFT_SIZE_OPTIONS = [1024, 2048, 4096, 8192, 16384, 32768];

/**
 * Recommended `AnalyserNode.fftSize` for the fast matcher. Returns the
 * smallest power of two that is ≥ 1.25× `getMinSamplesFor(sampleRate)`,
 * giving a small safety margin over the YIN minimum while keeping latency
 * bounded to ~93 ms at 44.1 kHz.
 *
 * `targetPitch` is accepted so the controllers can recompute the size on
 * each target change if the signature is ever extended; today it has no
 * effect.
 * @param {string} [_targetPitch]
 * @param {number} [sampleRate=44100]
 * @returns {number} power-of-two fftSize
 */
export function getRecommendedFftSize(_targetPitch, sampleRate = 44100) {
  const minSamples = getMinSamplesFor(_targetPitch, sampleRate);
  const needed = Math.ceil(minSamples * 1.25);
  for (const size of FFT_SIZE_OPTIONS) {
    if (size >= needed) return size;
  }
  return FFT_SIZE_OPTIONS[FFT_SIZE_OPTIONS.length - 1];
}

// ── Per-frame classification ──────────────────────────────────────────────────

/**
 * Classifies a single audio frame against a target pitch.
 *
 * Returns one of three statuses:
 *   - 'correct' – detected pitch matches target note+octave within ±tolerateCents
 *   - 'wrong'   – detected pitch is a different note/octave
 *   - 'unsure'  – signal too weak, buffer too small, or no reliable pitch
 *
 * The buffer-size guard is load-bearing: if the caller passes a buffer
 * smaller than `getMinSamplesFor(targetPitch, sampleRate)`, YIN physically
 * cannot produce a reliable reading and the function returns `unsure`
 * rather than falling back to an HPS-only guess. This prevents the exact
 * bug the "Noten spielen" exercise had with its hardcoded 2048-sample
 * analyser on E2.
 *
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @param {string} targetPitch
 * @param {{ minRms?: number, tolerateCents?: number }} [options]
 * @returns {{ status: 'correct'|'wrong'|'unsure', detectedPitch: string|null, hz: number|null, cents: number|null }}
 */
export function classifyFrame(samples, sampleRate, targetPitch, options = {}) {
  const tolerateCents = options.tolerateCents ?? FAST_CENTS_TOLERANCE;
  const minRms        = options.minRms ?? GUITAR_MIN_RMS;

  const { name: targetName, octave: targetOctave } = parsePitch(targetPitch);
  const targetHz = noteToFrequency(targetName, targetOctave);

  // Guard: below YIN's minimum sample count, a decision cannot be made
  // reliably. Report unsure and let the caller wait for a larger buffer
  // instead of silently running on an HPS-only fallback.
  const minSamples = getMinSamplesFor(targetPitch, sampleRate);
  if (samples.length < minSamples) {
    return { status: 'unsure', detectedPitch: null, hz: null, cents: null };
  }

  // Full guitar-range detection (no referenceHz narrowing) so octave-up
  // errors are visible instead of collapsing to the target via YIN's
  // subharmonic behaviour.
  // applyFilters: true is mandatory since we raised maxFreq to 1000Hz,
  // to avoid locking onto low-frequency noise as subharmonics.
  const hz = detectPitch(samples, sampleRate, { minRms, applyFilters: true });
  if (hz === null || !Number.isFinite(hz)) {
    return { status: 'unsure', detectedPitch: null, hz: null, cents: null };
  }

  const { note, octave } = frequencyToNote(hz);
  const detectedPitch = `${note}${octave}`;
  const centsToTarget = 1200 * Math.log2(hz / targetHz);

  if (note === targetName && octave === targetOctave && Math.abs(centsToTarget) <= tolerateCents) {
    return { status: 'correct', detectedPitch, hz, cents: centsToTarget };
  }
  return { status: 'wrong', detectedPitch, hz, cents: centsToTarget };
}

// ── Multi-frame acceptance/rejection state machine ────────────────────────────

/**
 * Returns a fresh matcher state. Kept external so tests can drive it frame by
 * frame and the controllers can reset it on note changes.
 * @returns {{ correctStreak: number, wrongStreak: number, accepted: boolean, rejected: boolean }}
 */
export function createMatchState() {
  return { correctStreak: 0, wrongStreak: 0, accepted: false, rejected: false };
}

/**
 * Applies one frame result to the matcher state. The returned object holds the
 * updated state and an optional event that fired this frame:
 *   - 'accept' on first frame where the correct streak hits FAST_ACCEPT_STREAK
 *   - 'reject' on first frame where the wrong  streak hits FAST_REJECT_STREAK
 *   - null     otherwise (including all frames after the state has already
 *                         reached a terminal accepted/rejected marker)
 *
 * Unsure frames reset BOTH streaks on purpose: a brief dropout should neither
 * credit nor penalise the player.
 *
 * @param {{ correctStreak: number, wrongStreak: number, accepted: boolean, rejected: boolean }} state
 * @param {{ status: 'correct'|'wrong'|'unsure' }} frameResult
 * @returns {{ nextState: object, event: 'accept'|'reject'|null }}
 */
export function updateMatchState(state, frameResult) {
  const next = { ...state };
  if (next.accepted || next.rejected) {
    return { nextState: next, event: null };
  }

  if (frameResult.status === 'correct') {
    next.correctStreak += 1;
    next.wrongStreak = 0;
    if (next.correctStreak >= FAST_ACCEPT_STREAK) {
      next.accepted = true;
      return { nextState: next, event: 'accept' };
    }
    return { nextState: next, event: null };
  }

  if (frameResult.status === 'wrong') {
    next.wrongStreak += 1;
    next.correctStreak = 0;
    if (next.wrongStreak >= FAST_REJECT_STREAK) {
      next.rejected = true;
      return { nextState: next, event: 'reject' };
    }
    return { nextState: next, event: null };
  }

  // 'unsure' – reset both streaks without firing an event.
  next.correctStreak = 0;
  next.wrongStreak = 0;
  return { nextState: next, event: null };
}
