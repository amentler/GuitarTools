// Tuner-specific heuristics, stability management and guided tuning
// Imports core math from pitchLogic.js

export {
  getAdaptiveFftSize,
  analyzeInputLevel,
  applyGuitarBandpass,
  dampAttack,
  detectPitch,
  frequencyToNote,
  noteToFrequency,
  getCentsToTarget,
  isStandardTuningNote,
  estimateNoiseFloorRms,
  buildAdaptiveThreshold,
  hpsFromMagnitudes,
  STANDARD_TUNING,
  NOTE_NAMES,
  GUITAR_MIN_FREQUENCY,
  GUITAR_MAX_FREQUENCY,
  GUITAR_MIN_RMS,
  GUITAR_MAX_CLIPPING_RATIO,
  NOISE_FLOOR_SCALE_FACTOR,
  MAX_ADAPTIVE_THRESHOLD
} from './pitchLogic.js';

// ── Tuner Heuristics ──────────────────────────────────────────────────────────

export const ATTACK_DAMPING_RATIO = 0.1;
export const HPS_AGREEMENT_CENTS = 35;
export const STABILITY_MAX_CENTS_DELTA = 25;
export const NOTE_SWITCH_CONFIRM_FRAMES = 3;

/** Minimum consecutive valid frames before the tuner display starts updating after silence.
 * Prevents initial pointer "jumping" caused by pick attack transients and incomplete median buffers. */
export const STABLE_CONFIRM_FRAMES = 2;

// ── Guided tuning ─────────────────────────────────────────────────────────────

/** Standard tuning steps from lowest (6th) to highest (1st) string. */
export const GUIDED_TUNING_STEPS = [
  { stringNumber: 6, note: 'E', octave: 2 },
  { stringNumber: 5, note: 'A', octave: 2 },
  { stringNumber: 4, note: 'D', octave: 3 },
  { stringNumber: 3, note: 'G', octave: 3 },
  { stringNumber: 2, note: 'B', octave: 3 },
  { stringNumber: 1, note: 'E', octave: 4 },
];

/** Minimum cents deviation before direction guidance activates (≈ quarter tone). */
export const QUARTER_TONE_CENTS = 50;

/** Minimum number of consecutive consistent samples required to confirm a trend. */
export const TREND_MIN_SAMPLES = 4;

/** Maximum size of the guided trend history buffer. */
export const TREND_HISTORY_SIZE = 6;

/** Minimum milliseconds a feedback hint stays visible before auto-clearing on null feedback. */
export const FEEDBACK_DISPLAY_DURATION_MS = 3000;

/**
 * Interval in milliseconds between audio analysis frames.
 */
export const ANALYZE_INTERVAL_MS = 50;

/** Cents window in which the pitch is considered "perfect" for guided feedback. */
export const PERFECT_TOLERANCE_CENTS = 5;

/**
 * Returns the required pitch-correction direction based on the cents offset.
 * Uses the legacy ±QUARTER_TONE_CENTS (±50 cent) threshold; kept for backward compatibility.
 * For guided feedback, prefer getTuningState() which uses the stricter ±PERFECT_TOLERANCE_CENTS window.
 * @param {number} centsToTarget  positive = too high, negative = too low
 * @returns {'up'|'down'|'none'}
 */
export function getPitchDirection(centsToTarget) {
  if (centsToTarget < -QUARTER_TONE_CENTS) return 'up';
  if (centsToTarget > QUARTER_TONE_CENTS) return 'down';
  return 'none';
}

/**
 * Returns the absolute tuning state relative to the target note,
 * using the tight PERFECT_TOLERANCE_CENTS window.
 * @param {number} centsToTarget  positive = too high, negative = too low
 * @returns {'too-low'|'perfect'|'too-high'}
 */
export function getTuningState(centsToTarget) {
  if (centsToTarget < -PERFECT_TOLERANCE_CENTS) return 'too-low';
  if (centsToTarget > PERFECT_TOLERANCE_CENTS) return 'too-high';
  return 'perfect';
}

/**
 * Returns the required correction direction from an absolute tuning state.
 * @param {'too-low'|'perfect'|'too-high'} tuningState
 * @returns {'up'|'down'|'none'}
 */
export function tuningStateToDirection(tuningState) {
  if (tuningState === 'too-low') return 'up';
  if (tuningState === 'too-high') return 'down';
  return 'none';
}

/**
 * Appends a centsToTarget value to the guided trend history
 * (capped at TREND_HISTORY_SIZE). Mutates the array in place.
 * @param {number[]} history
 * @param {number}   centsToTarget
 */
export function pushGuidedHistory(history, centsToTarget) {
  history.push(centsToTarget);
  if (history.length > TREND_HISTORY_SIZE) history.shift();
}

/**
 * Evaluates whether the pitch is approaching or moving away from the target,
 * based on the most recent TREND_MIN_SAMPLES entries in history.
 * @param {number[]} history
 * @returns {'approaching'|'moving-away'|'unstable'}
 */
export function evaluateTrend(history) {
  if (history.length < TREND_MIN_SAMPLES) return 'unstable';
  const recent = history.slice(-TREND_MIN_SAMPLES);
  const absVals = recent.map(Math.abs);
  let allDecreasing = true;
  let allIncreasing = true;
  for (let i = 1; i < absVals.length; i++) {
    if (absVals[i] >= absVals[i - 1]) allDecreasing = false;
    if (absVals[i] <= absVals[i - 1]) allIncreasing = false;
  }
  if (allDecreasing) return 'approaching';
  if (allIncreasing) return 'moving-away';
  return 'unstable';
}

/**
 * Derives UI display state from the absolute tuning state and trend.
 * @param {'too-low'|'perfect'|'too-high'} tuningState
 * @param {'approaching'|'moving-away'|'unstable'} trend
 * @returns {{ type: 'green'|'orange'|'red', direction: 'up'|'down'|'none', trend: string, arrowColor: string|null, warning: boolean }}
 */
export function buildGuidedDisplay(tuningState, trend) {
  if (tuningState === 'perfect') {
    return { type: 'green', direction: 'none', trend: 'none', arrowColor: null, warning: false };
  }
  const direction = tuningStateToDirection(tuningState);
  if (trend === 'moving-away') {
    return { type: 'red', direction, trend, arrowColor: 'red', warning: true };
  }
  return { type: 'orange', direction, trend, arrowColor: 'orange', warning: false };
}

/**
 * Combines the current deviation and trend history into a full guided feedback state.
 * @param {number}   centsToTarget  cents offset (positive = too high, negative = too low)
 * @param {number[]} trendHistory   recent centsToTarget values
 * @returns {{ type: string, direction: string, trend: string, arrowColor: string|null, warning: boolean }}
 */
export function getGuidedFeedback(centsToTarget, trendHistory) {
  const tuningState = getTuningState(centsToTarget);
  if (tuningState === 'perfect') {
    return { type: 'green', direction: 'none', trend: 'none', arrowColor: null, warning: false };
  }
  const trend = evaluateTrend(trendHistory);
  return buildGuidedDisplay(tuningState, trend);
}

/**
 * Applies the 3-second display rule for guided feedback hints.
 * @param {object|null} currentDisplay
 * @param {object|null}      newFeedback
 * @param {number}      nowMs
 * @returns {object|null}
 */
export function updateFeedbackDisplay(currentDisplay, newFeedback, nowMs) {
  const newType = newFeedback?.type ?? null;
  const currentType = currentDisplay?.type ?? null;

  if (newType !== null) {
    if (newType !== currentType) {
      return { ...newFeedback, shownAt: nowMs };
    }
    return currentDisplay;
  }

  if (currentDisplay !== null && nowMs - currentDisplay.shownAt < FEEDBACK_DISPLAY_DURATION_MS) {
    return currentDisplay;
  }
  return null;
}

// ── Rolling median ────────────────────────────────────────────────────────────

/** Rolling median history size. */
const HISTORY_SIZE = 5;

/** Maximum age of a frequency sample in the history buffer before it is discarded. */
export const HISTORY_MAX_AGE_MS = 1000;

/** Minimum duration of silence (no valid pitch) before the tuner state is reset. */
export const SILENCE_RESET_THRESHOLD_MS = 300;

/**
 * Appends freq to history (capped at HISTORY_SIZE) and returns the median.
 * @param {number[]} history
 * @param {number}   freq
 * @returns {number} median frequency
 */
export function pushAndMedian(history, freq) {
  history.push(freq);
  if (history.length > HISTORY_SIZE) history.shift();
  const sorted = history.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Version of pushAndMedian that handles timestamps and age-based expiration.
 * @param {Array<{freq:number, time:number}>} history
 * @param {number} freq
 * @param {number} now
 * @returns {number} median frequency
 */
export function pushAndMedianTimed(history, freq, now) {
  while (history.length > 0 && now - history[0].time > HISTORY_MAX_AGE_MS) {
    history.shift();
  }
  history.push({ freq, time: now });
  if (history.length > HISTORY_SIZE) {
    history.shift();
  }
  const sorted = history.map(h => h.freq).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return freq;
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function pushMedianAndStabilize(history, freq, lastStable = null) {
  const median = pushAndMedian(history, freq);
  const changed = lastStable === null || median !== lastStable;
  return { median, stable: median, changed };
}

export function applyNoteSwitchHysteresis(currentNoteKey, candidateNoteKey, streak) {
  if (currentNoteKey === null || currentNoteKey === candidateNoteKey) {
    return { acceptedNoteKey: candidateNoteKey, nextStreak: 0, switched: currentNoteKey !== candidateNoteKey };
  }
  const nextStreak = streak + 1;
  if (nextStreak >= NOTE_SWITCH_CONFIRM_FRAMES) {
    return { acceptedNoteKey: candidateNoteKey, nextStreak: 0, switched: true };
  }
  return { acceptedNoteKey: currentNoteKey, nextStreak, switched: false };
}

// ── Outlier Rejection ─────────────────────────────────────────────────────────

/** Minimum cents gap triggering outlier rejection. */
export const OUTLIER_REJECTION_THRESHOLD_CENTS = 350;

/** Number of consecutive outlier frames before a true note change is accepted. */
export const OUTLIER_REJECT_CONFIRM_FRAMES = 2;

/**
 * Decides whether a new candidate frequency should be rejected as an outlier.
 * @param {number|null} stableHz
 * @param {number}      candidateHz
 * @param {number}      streak
 * @returns {{ reject: boolean, nextStreak: number }}
 */
export function shouldRejectOutlier(stableHz, candidateHz, streak) {
  if (stableHz === null) return { reject: false, nextStreak: 0 };
  const centsDiff = Math.abs(1200 * Math.log2(candidateHz / stableHz));
  if (centsDiff <= OUTLIER_REJECTION_THRESHOLD_CENTS) {
    return { reject: false, nextStreak: 0 };
  }
  if (streak >= OUTLIER_REJECT_CONFIRM_FRAMES) {
    return { reject: false, nextStreak: 0 };
  }
  return { reject: true, nextStreak: streak + 1 };
}

// ── V9: EMA Cents-Glättung ───────────────────────────────────────────────────

/** Default EMA alpha for cents smoothing (40 % new value per frame). */
export const EMA_ALPHA = 0.4;

/**
 * Exponential moving average for the cents display value.
 * @param {number|null} previousSmoothed
 * @param {number}      rawCents
 * @param {number}      [alpha=EMA_ALPHA]
 * @returns {number}
 */
export function smoothCents(previousSmoothed, rawCents, alpha = EMA_ALPHA) {
  if (previousSmoothed === null) return rawCents;
  return alpha * rawCents + (1 - alpha) * previousSmoothed;
}
