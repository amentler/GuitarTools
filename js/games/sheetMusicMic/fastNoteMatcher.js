// Fast Note Matcher – pure logic for "Noten spielen" and "Ton spielen"
//
// Target-aware, low-latency note classification against a known target pitch.
// Uses the existing YIN + HPS pipeline from tunerLogic, but wires it through
// detectPitch({ referenceHz }) so the search band is narrowed to the target
// and YIN's minimum-periods requirement shrinks accordingly.
//
// This file is deliberately shipped first in a "broken" form that mirrors the
// current behaviour of sheetMusicMicExercise.js / notePlayingExercise.js:
//
//   * detectPitch is called WITHOUT referenceHz
//   * no buffer-size guard against YIN's minimum-samples requirement
//   * no adaptive fftSize recommendation
//
// The accompanying tests in tests/unit/fastNoteMatcher.test.js exercise this
// broken default and go red, documenting the bug. The fix follows in the next
// commit: wire referenceHz, add getMinSamplesFor + getRecommendedFftSize, and
// guard too-small buffers so they return "unsure" explicitly.

import {
  detectPitch,
  frequencyToNote,
  noteToFrequency,
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

// ── Broken-by-design placeholder helpers (fixed in follow-up commit) ──────────

/**
 * Minimum-sample requirement for the YIN path given a target pitch.
 *
 * BROKEN: currently always returns 0 so that classifyFrame never rejects a
 * buffer on size grounds. That lets the matcher fall through to the same
 * too-small-buffer code path as the current exercises.
 * @returns {number}
 */
export function getMinSamplesFor() {
  return 0;
}

/**
 * Recommended AnalyserNode fftSize for the given target pitch.
 *
 * BROKEN: currently always returns 2048, matching the hardcoded value used by
 * sheetMusicMicExercise.js and notePlayingExercise.js today.
 * @returns {number}
 */
export function getRecommendedFftSize() {
  return 2048;
}

// ── Per-frame classification ──────────────────────────────────────────────────

/**
 * Classifies a single audio frame against a target pitch.
 *
 * Returns one of three statuses:
 *   - 'correct' – detected pitch matches target note+octave within ±tolerateCents
 *   - 'wrong'   – detected pitch is a different note/octave
 *   - 'unsure'  – signal too weak or no reliable pitch
 *
 * BROKEN: detectPitch is called without referenceHz, so the full GUITAR_MIN
 * …GUITAR_MAX search range applies and YIN requires buffer ≥ 2520 samples for
 * low strings. With the 2048-sample buffer that sheetMusicMicExercise feeds in
 * today, YIN returns null for every frame and only HPS remains – whose bin
 * resolution of ~21 Hz cannot distinguish E2 from F2.
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

  // BROKEN: detectPitch is called without { referenceHz }, which keeps the
  // internal minFreq at GUITAR_MIN_FREQUENCY and therefore inflates the YIN
  // minimum-sample requirement unnecessarily.
  const hz = detectPitch(samples, sampleRate, { minRms });
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
