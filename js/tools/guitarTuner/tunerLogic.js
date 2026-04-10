// Pure pitch detection and note calculation utilities – no DOM

export const STANDARD_TUNING = [
  { note: 'E', octave: 2 },
  { note: 'A', octave: 2 },
  { note: 'D', octave: 3 },
  { note: 'G', octave: 3 },
  { note: 'B', octave: 3 },
  { note: 'E', octave: 4 },
];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const GUITAR_MIN_FREQUENCY = 70;
export const GUITAR_MAX_FREQUENCY = 560;
export const GUITAR_MIN_RMS = 0.008;
export const GUITAR_MAX_CLIPPING_RATIO = 0.02;
export const ATTACK_DAMPING_RATIO = 0.2;
export const HPS_AGREEMENT_CENTS = 35;
export const STABILITY_MAX_CENTS_DELTA = 25;
export const NOTE_SWITCH_CONFIRM_FRAMES = 3;

/** Minimum consecutive valid frames before the tuner display starts updating after silence.
 * Prevents initial pointer "jumping" caused by pick attack transients and incomplete median buffers. */
export const STABLE_CONFIRM_FRAMES = 3;

/**
 * Detects the fundamental frequency using the YIN algorithm.
 * More reliable than naive autocorrelation – correctly identifies the
 * fundamental even when overtones have higher energy.
 * @param {Float32Array} buffer
 * @param {number} sampleRate
 * @returns {number|null} Hz, or null if silence / no clear pitch
 */
export function getAdaptiveFftSize(referenceHz = null) {
  // E2 (≤90 Hz): extra-large window for enough periods at very low frequencies.
  if (referenceHz !== null && referenceHz <= 90) return 32768;
  // G3/B3/E4 (>160 Hz): smaller window sufficient – reduces latency by ~50 %.
  if (referenceHz !== null && referenceHz > 160) return 8192;
  // A2/D3 (90–160 Hz) and free mode (null): safe middle-ground.
  return 16384;
}

export function analyzeInputLevel(buffer, minRms = GUITAR_MIN_RMS) {
  let sumSquares = 0;
  let clipping = 0;
  for (let i = 0; i < buffer.length; i++) {
    const v = buffer[i];
    sumSquares += v * v;
    if (Math.abs(v) >= 0.98) clipping++;
  }
  const rms = Math.sqrt(sumSquares / buffer.length);
  const clippingRatio = clipping / buffer.length;
  return {
    rms,
    clippingRatio,
    isValid: rms >= minRms && clippingRatio <= GUITAR_MAX_CLIPPING_RATIO,
  };
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

export function dampAttack(buffer, dampingRatio = ATTACK_DAMPING_RATIO) {
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
  // Coefficients for equally-spaced points at x ∈ {-2,-1,0,1,2}:
  //   a = (2ya - y1 - 2y2 - y3 + 2yb) / 14
  //   b = (-2ya - y1 + y3 + 2yb) / 10
  //   minimum at x* = -b / (2a)
  // This is significantly more accurate than the 3-point formula when the true
  // period falls near the midpoint between two integers (worst case for 3-point).
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
    const denom = 2 * (2 * y2 - y1 - y3);
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

function selectCombinedPitch(yinHz, hpsHz, lastStableHz = null) {
  if (yinHz === null && hpsHz === null) return null;
  if (yinHz !== null && hpsHz !== null) {
    // YIN has sub-sample interpolation → more precise than HPS (integer bins).
    // Use YIN as the sole frequency source when both agree.
    if (centsDistance(yinHz, hpsHz) <= HPS_AGREEMENT_CENTS) return yinHz;
    // Subharmonic correction: if YIN is ~1 or ~2 octaves below HPS, YIN has locked
    // onto a subharmonic (period 2× or 3× too long). Return yinHz*2/3 to restore
    // YIN's sub-sample precision at the correct octave.
    if (centsDistance(yinHz * 2, hpsHz) <= 50) return yinHz * 2;
    if (centsDistance(yinHz * 3, hpsHz) <= 50) return yinHz * 3;
    if (lastStableHz !== null) {
      return centsDistance(yinHz, lastStableHz) <= centsDistance(hpsHz, lastStableHz) ? yinHz : hpsHz;
    }
    return yinHz;
  }
  return yinHz ?? hpsHz;
}

export function detectPitch(buffer, sampleRate, options = {}) {
  const minRms = options.minRms ?? GUITAR_MIN_RMS;
  const level = analyzeInputLevel(buffer, minRms);
  if (!level.isValid) return null;

  const referenceHz = options.referenceHz ?? null;
  const minFreq = referenceHz !== null ? Math.max(GUITAR_MIN_FREQUENCY, referenceHz * 0.55) : GUITAR_MIN_FREQUENCY;
  const maxFreq = referenceHz !== null ? Math.min(GUITAR_MAX_FREQUENCY, referenceHz * 1.8) : GUITAR_MAX_FREQUENCY;
  const minPeriods = minFreq < 120 ? 4 : 3;
  const prepared = dampAttack(applyGuitarBandpass(buffer, sampleRate));
  const yinHz = detectPitchYin(prepared, sampleRate, minFreq, maxFreq, minPeriods);
  // V5: FFT-based HPS if magnitude spectrum is provided (faster, avoids O(n²) DFT).
  let hpsHz;
  if (options.magnitudes) {
    const binHz = sampleRate / (options.magnitudes.length * 2);
    hpsHz = hpsFromMagnitudes(options.magnitudes, binHz, minFreq, maxFreq);
  } else {
    hpsHz = detectPitchHps(prepared, sampleRate, minFreq, maxFreq);
  }
  return selectCombinedPitch(yinHz, hpsHz, options.lastStableHz ?? null);
}

/**
 * Converts a frequency to the nearest note, octave, and cents offset.
 * @param {number} freq Hz
 * @returns {{ note: string, octave: number, cents: number }}
 */
export function frequencyToNote(freq) {
  const midiNum = 12 * Math.log2(freq / 440) + 69;
  const midiRounded = Math.round(midiNum);
  const noteIndex = ((midiRounded % 12) + 12) % 12;
  const octave = Math.floor(midiRounded / 12) - 1;
  const cents = (midiNum - midiRounded) * 100;
  return { note: NOTE_NAMES[noteIndex], octave, cents };
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
 * The tuner reads a new buffer from the Web Audio API analyser every
 * ANALYZE_INTERVAL_MS milliseconds, yielding responsive updates at 10 Hz.
 * Combined with HISTORY_SIZE (= 5), the rolling-median smoothing window covers ~500 ms.
 */
export const ANALYZE_INTERVAL_MS = 50;

/** Cents window in which the pitch is considered "perfect" for guided feedback. */
export const PERFECT_TOLERANCE_CENTS = 8;

/**
 * Converts a note name and octave to frequency in Hz.
 * @param {string} note   e.g. 'E', 'A', 'D#'
 * @param {number} octave
 * @returns {number} Hz
 */
export function noteToFrequency(note, octave) {
  const idx = NOTE_NAMES.indexOf(note);
  const midi = (octave + 1) * 12 + idx;
  return 440 * Math.pow(2, (midi - 69) / 12);
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
 * Returns the required pitch-correction direction based on the cents offset.
 * Uses the legacy ±QUARTER_TONE_CENTS (±50 cent) threshold; kept for backward compatibility.
 * For guided feedback, prefer getTuningState() which uses the stricter ±PERFECT_TOLERANCE_CENTS (±8 cent) window.
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
 * using the tight PERFECT_TOLERANCE_CENTS (±8 cents) window.
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
 * Returns 'approaching' only when all consecutive absolute-distance pairs are
 * strictly decreasing, 'moving-away' when all are strictly increasing, and
 * 'unstable' otherwise (including when there are not enough samples yet).
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
 *
 * Rules:
 *   - `perfect`        → green, no arrow
 *   - non-perfect + `moving-away`  → red + warning (wrong direction)
 *   - non-perfect + `approaching`  → orange (correct direction)
 *   - non-perfect + `unstable`     → orange, no warning (arrow still shown)
 *
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
  // approaching or unstable: show directional arrow in orange (no warning)
  return { type: 'orange', direction, trend, arrowColor: 'orange', warning: false };
}

/**
 * Combines the current deviation and trend history into a full guided feedback state.
 * The returned `type` field drives the 3-second display rule in updateFeedbackDisplay:
 *   'green'  – in-tune (deviation within ±PERFECT_TOLERANCE_CENTS)
 *   'orange' – approaching the target, or unstable (directional arrow always shown)
 *   'red'    – moving away from the target (wrong direction)
 * Note: a non-perfect state always yields a non-null type so the UI updates immediately.
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
 *
 * Rules:
 *   - A specific hint (green/orange/red) always immediately replaces a different type.
 *   - When no new specific hint is available (type === null), the current hint stays
 *     visible for up to FEEDBACK_DISPLAY_DURATION_MS, then auto-clears.
 *   - State changes always take priority over remaining display time.
 *
 * @param {object|null} currentDisplay  The currently displayed hint or null.
 *                                      Must include a `shownAt` timestamp when non-null.
 * @param {object|null}      newFeedback     The latest result from getGuidedFeedback.
 * @param {number}      nowMs           Current time in milliseconds (e.g. Date.now()).
 * @returns {object|null} The display state to render next.
 */
export function updateFeedbackDisplay(currentDisplay, newFeedback, nowMs) {
  const newType = newFeedback?.type ?? null;
  const currentType = currentDisplay?.type ?? null;

  if (newType !== null) {
    // A specific feedback state is active. Override immediately if type changed.
    if (newType !== currentType) {
      return { ...newFeedback, shownAt: nowMs };
    }
    // Same type – keep current (preserves original shownAt).
    return currentDisplay;
  }

  // No specific feedback (unstable / no data). Keep current hint within 3 s.
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
 * Mutates the passed array in place.
 * @param {number[]} history  mutable buffer (pass the module-level array)
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
  // 1. Remove expired entries
  while (history.length > 0 && now - history[0].time > HISTORY_MAX_AGE_MS) {
    history.shift();
  }

  // 2. Add new entry
  history.push({ freq, time: now });

  // 3. Enforce max size (keep newest)
  if (history.length > HISTORY_SIZE) {
    history.shift();
  }

  // 4. Calculate median
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

// ── V3: Ausreißer-Rejection ───────────────────────────────────────────────────

/** Minimum cents gap triggering outlier rejection. */
export const OUTLIER_REJECTION_THRESHOLD_CENTS = 350;

/** Number of consecutive outlier frames before a true note change is accepted. */
export const OUTLIER_REJECT_CONFIRM_FRAMES = 2;

/**
 * Decides whether a new candidate frequency should be rejected as an outlier.
 * Protects the rolling median from single-frame glitches while still allowing
 * genuine string changes to come through after OUTLIER_REJECT_CONFIRM_FRAMES
 * consecutive outlier frames.
 *
 * @param {number|null} stableHz  Currently stable frequency, or null if none.
 * @param {number}      candidateHz  Newly detected frequency.
 * @param {number}      streak  Consecutive outlier count so far.
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

// ── V4: Adaptiver Noise Floor ────────────────────────────────────────────────

/** Multiplier applied to measured noise floor to derive the effective RMS gate. */
export const NOISE_FLOOR_SCALE_FACTOR = 4;

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

// ── V9: EMA Cents-Glättung ───────────────────────────────────────────────────

/** Default EMA alpha for cents smoothing (40 % new value per frame). */
export const EMA_ALPHA = 0.4;

/**
 * Exponential moving average for the cents display value.
 * Returns `rawCents` directly when `previousSmoothed` is null (first call).
 * @param {number|null} previousSmoothed
 * @param {number}      rawCents
 * @param {number}      [alpha=EMA_ALPHA]
 * @returns {number}
 */
export function smoothCents(previousSmoothed, rawCents, alpha = EMA_ALPHA) {
  if (previousSmoothed === null) return rawCents;
  return alpha * rawCents + (1 - alpha) * previousSmoothed;
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
