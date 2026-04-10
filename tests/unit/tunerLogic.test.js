import { describe, it, expect } from 'vitest';
import {
  frequencyToNote,
  isStandardTuningNote,
  pushAndMedian,
  getAdaptiveFftSize,
  analyzeInputLevel,
  pushMedianAndStabilize,
  applyNoteSwitchHysteresis,
  NOTE_SWITCH_CONFIRM_FRAMES,
  STANDARD_TUNING,
  GUIDED_TUNING_STEPS,
  QUARTER_TONE_CENTS,
  PERFECT_TOLERANCE_CENTS,
  FEEDBACK_DISPLAY_DURATION_MS,
  ANALYZE_INTERVAL_MS,
  noteToFrequency,
  getCentsToTarget,
  getPitchDirection,
  getTuningState,
  tuningStateToDirection,
  buildGuidedDisplay,
  pushGuidedHistory,
  evaluateTrend,
  getGuidedFeedback,
  updateFeedbackDisplay,
  detectPitch,
  shouldRejectOutlier,
  OUTLIER_REJECTION_THRESHOLD_CENTS,
  buildAdaptiveThreshold,
  estimateNoiseFloorRms,
  smoothCents,
  hpsFromMagnitudes,
  STABLE_CONFIRM_FRAMES,
  pushAndMedianTimed,
  HISTORY_MAX_AGE_MS,
  SILENCE_RESET_THRESHOLD_MS,
} from '../../js/tools/guitarTuner/tunerLogic.js';

describe('frequencyToNote', () => {
  it('identifies A4 (440 Hz) correctly', () => {
    const result = frequencyToNote(440);
    expect(result.note).toBe('A');
    expect(result.octave).toBe(4);
    expect(result.cents).toBeCloseTo(0, 1);
  });

  it('identifies E2 (low E string, ~82.41 Hz)', () => {
    const result = frequencyToNote(82.41);
    expect(result.note).toBe('E');
    expect(result.octave).toBe(2);
  });

  it('identifies E4 (high E string, ~329.63 Hz)', () => {
    const result = frequencyToNote(329.63);
    expect(result.note).toBe('E');
    expect(result.octave).toBe(4);
  });
});

describe('isStandardTuningNote', () => {
  it('returns true for all six open string notes', () => {
    for (const { note, octave } of STANDARD_TUNING) {
      expect(isStandardTuningNote(note, octave)).toBe(true);
    }
  });

  it('returns false for a note not in standard tuning', () => {
    expect(isStandardTuningNote('C', 3)).toBe(false);
    expect(isStandardTuningNote('F', 4)).toBe(false);
  });
});

describe('pushAndMedian', () => {
  it('returns the single value when history has one entry', () => {
    const history = [];
    expect(pushAndMedian(history, 440)).toBe(440);
  });

  it('returns the median of an odd-length history', () => {
    const history = [300, 400];
    // After push: [300, 400, 500] → sorted → median = 400
    expect(pushAndMedian(history, 500)).toBe(400);
  });

  it('returns the average of the two middle values for even-length history', () => {
    const history = [300];
    // After push: [300, 400] → sorted, length 2 (even) → median = (300+400)/2 = 350
    expect(pushAndMedian(history, 400)).toBe(350);
  });

  it('caps history at 5 entries', () => {
    const history = [100, 200, 300, 400, 500];
    pushAndMedian(history, 600);
    expect(history).toHaveLength(5);
  });
});

// ── Guided tuning ─────────────────────────────────────────────────────────────

describe('GUIDED_TUNING_STEPS – sequence and labels', () => {
  it('has exactly 6 steps', () => {
    expect(GUIDED_TUNING_STEPS).toHaveLength(6);
  });

  it('starts with the 6th string (E2) and ends with the 1st string (E4)', () => {
    const first = GUIDED_TUNING_STEPS[0];
    expect(first.stringNumber).toBe(6);
    expect(first.note).toBe('E');
    expect(first.octave).toBe(2);

    const last = GUIDED_TUNING_STEPS[5];
    expect(last.stringNumber).toBe(1);
    expect(last.note).toBe('E');
    expect(last.octave).toBe(4);
  });

  it('has the correct order: E2, A2, D3, G3, B3, E4', () => {
    const expected = [
      { note: 'E', octave: 2 },
      { note: 'A', octave: 2 },
      { note: 'D', octave: 3 },
      { note: 'G', octave: 3 },
      { note: 'B', octave: 3 },
      { note: 'E', octave: 4 },
    ];
    GUIDED_TUNING_STEPS.forEach((step, i) => {
      expect(step.note).toBe(expected[i].note);
      expect(step.octave).toBe(expected[i].octave);
    });
  });

  it('assigns string numbers 6 down to 1', () => {
    GUIDED_TUNING_STEPS.forEach((step, i) => {
      expect(step.stringNumber).toBe(6 - i);
    });
  });
});

describe('noteToFrequency', () => {
  it('returns ~82.41 Hz for E2', () => {
    expect(noteToFrequency('E', 2)).toBeCloseTo(82.41, 1);
  });

  it('returns 440 Hz for A4', () => {
    expect(noteToFrequency('A', 4)).toBeCloseTo(440, 1);
  });

  it('returns ~329.63 Hz for E4', () => {
    expect(noteToFrequency('E', 4)).toBeCloseTo(329.63, 1);
  });
});

describe('getCentsToTarget', () => {
  it('returns 0 when detected equals target', () => {
    const freq = noteToFrequency('A', 4);
    expect(getCentsToTarget(freq, freq)).toBeCloseTo(0, 5);
  });

  it('returns a negative value when detected is lower than target', () => {
    const target = noteToFrequency('E', 2);
    const detected = noteToFrequency('D#', 2); // one semitone lower ≈ -100 cents
    expect(getCentsToTarget(detected, target)).toBeCloseTo(-100, 0);
  });

  it('returns a positive value when detected is higher than target', () => {
    const target = noteToFrequency('E', 2);
    const detected = noteToFrequency('F', 2); // one semitone higher ≈ +100 cents
    expect(getCentsToTarget(detected, target)).toBeCloseTo(100, 0);
  });
});

describe('getPitchDirection – threshold behaviour', () => {
  it('returns "none" when exactly at target (0 cents)', () => {
    expect(getPitchDirection(0)).toBe('none');
  });

  it('returns "none" when within the quarter-tone threshold (±50 cents)', () => {
    expect(getPitchDirection(QUARTER_TONE_CENTS)).toBe('none');
    expect(getPitchDirection(-QUARTER_TONE_CENTS)).toBe('none');
    expect(getPitchDirection(30)).toBe('none');
    expect(getPitchDirection(-30)).toBe('none');
  });

  it('returns "up" when pitch is more than a quarter tone too low', () => {
    expect(getPitchDirection(-51)).toBe('up');
    expect(getPitchDirection(-200)).toBe('up');
  });

  it('returns "down" when pitch is more than a quarter tone too high', () => {
    expect(getPitchDirection(51)).toBe('down');
    expect(getPitchDirection(200)).toBe('down');
  });
});

// ── New architecture: getTuningState / tuningStateToDirection / buildGuidedDisplay ──

describe('getTuningState – ±8 cent boundary', () => {
  it('returns "too-low" below -8 cents', () => {
    expect(getTuningState(-9)).toBe('too-low');
    expect(getTuningState(-100)).toBe('too-low');
  });

  it('returns "perfect" at exactly -8 cents (lower boundary inclusive)', () => {
    expect(getTuningState(-PERFECT_TOLERANCE_CENTS)).toBe('perfect');
  });

  it('returns "perfect" at zero', () => {
    expect(getTuningState(0)).toBe('perfect');
  });

  it('returns "perfect" at exactly +8 cents (upper boundary inclusive)', () => {
    expect(getTuningState(PERFECT_TOLERANCE_CENTS)).toBe('perfect');
  });

  it('returns "too-high" above +8 cents', () => {
    expect(getTuningState(9)).toBe('too-high');
    expect(getTuningState(100)).toBe('too-high');
  });
});

describe('tuningStateToDirection', () => {
  it('returns "up" for too-low', () => {
    expect(tuningStateToDirection('too-low')).toBe('up');
  });

  it('returns "down" for too-high', () => {
    expect(tuningStateToDirection('too-high')).toBe('down');
  });

  it('returns "none" for perfect', () => {
    expect(tuningStateToDirection('perfect')).toBe('none');
  });
});

describe('buildGuidedDisplay', () => {
  it('prioritises green for perfect, regardless of trend', () => {
    const d = buildGuidedDisplay('perfect', 'moving-away');
    expect(d.type).toBe('green');
    expect(d.direction).toBe('none');
    expect(d.warning).toBe(false);
    expect(d.arrowColor).toBeNull();
  });

  it('maps too-low + approaching to orange/up/no-warning', () => {
    const d = buildGuidedDisplay('too-low', 'approaching');
    expect(d.type).toBe('orange');
    expect(d.direction).toBe('up');
    expect(d.warning).toBe(false);
  });

  it('maps too-high + moving-away to red/down + warning', () => {
    const d = buildGuidedDisplay('too-high', 'moving-away');
    expect(d.type).toBe('red');
    expect(d.direction).toBe('down');
    expect(d.warning).toBe(true);
    expect(d.arrowColor).toBe('red');
  });

  it('maps too-low + unstable to visible directional display (orange/up/no-warning)', () => {
    const d = buildGuidedDisplay('too-low', 'unstable');
    expect(d.type).toBe('orange');
    expect(d.direction).toBe('up');
    expect(d.warning).toBe(false);
  });

  it('maps too-high + unstable to visible directional display (orange/down/no-warning)', () => {
    const d = buildGuidedDisplay('too-high', 'unstable');
    expect(d.type).toBe('orange');
    expect(d.direction).toBe('down');
    expect(d.warning).toBe(false);
  });
});

describe('pushGuidedHistory', () => {
  it('appends values to the history array', () => {
    const h = [];
    pushGuidedHistory(h, 100);
    pushGuidedHistory(h, 80);
    expect(h).toEqual([100, 80]);
  });

  it('caps the history at TREND_HISTORY_SIZE entries', () => {
    const h = [];
    for (let i = 0; i < 10; i++) pushGuidedHistory(h, i * 10);
    expect(h.length).toBeLessThanOrEqual(6);
  });
});

describe('evaluateTrend', () => {
  it('returns "unstable" when fewer than TREND_MIN_SAMPLES entries', () => {
    expect(evaluateTrend([])).toBe('unstable');
    expect(evaluateTrend([100, 90, 80])).toBe('unstable'); // one less than TREND_MIN_SAMPLES=4
  });

  it('returns "approaching" when absolute distance consistently decreases', () => {
    // Distances: 100, 80, 60, 40 – all decreasing
    expect(evaluateTrend([100, 80, 60, 40])).toBe('approaching');
    expect(evaluateTrend([-100, -80, -60, -40])).toBe('approaching');
  });

  it('returns "moving-away" when absolute distance consistently increases', () => {
    // Distances: 40, 60, 80, 100 – all increasing
    expect(evaluateTrend([40, 60, 80, 100])).toBe('moving-away');
    expect(evaluateTrend([-40, -60, -80, -100])).toBe('moving-away');
  });

  it('returns "unstable" for jittery / non-monotonic data', () => {
    expect(evaluateTrend([100, 80, 90, 60])).toBe('unstable');
    expect(evaluateTrend([60, 80, 70, 100])).toBe('unstable');
  });

  it('only looks at the last TREND_MIN_SAMPLES entries (ignores older data)', () => {
    // Older entries show increase but last 4 are strictly decreasing → 'approaching'
    expect(evaluateTrend([10, 50, 200, 150, 100, 50, 20])).toBe('approaching');
  });
});

describe('getGuidedFeedback', () => {
  it('returns type "green" and no arrow when deviation is within ±8 cents', () => {
    const fb = getGuidedFeedback(5, [100, 80, 60, 40]);
    expect(fb.type).toBe('green');
    expect(fb.direction).toBe('none');
    expect(fb.arrowColor).toBeNull();
    expect(fb.warning).toBe(false);
  });

  it('returns orange + down direction when trend is unstable (too few samples) but pitch is too high', () => {
    const fb = getGuidedFeedback(100, [100, 80]);
    expect(fb.type).toBe('orange');
    expect(fb.direction).toBe('down');
    expect(fb.arrowColor).toBe('orange');
    expect(fb.warning).toBe(false);
  });

  it('returns type "orange" and orange arrow (direction "up") when approaching from below', () => {
    const fb = getGuidedFeedback(-60, [-100, -80, -70, -60]);
    expect(fb.type).toBe('orange');
    expect(fb.direction).toBe('up');
    expect(fb.arrowColor).toBe('orange');
    expect(fb.warning).toBe(false);
  });

  it('returns type "orange" and orange arrow (direction "down") when approaching from above', () => {
    const fb = getGuidedFeedback(60, [200, 150, 100, 60]);
    expect(fb.type).toBe('orange');
    expect(fb.direction).toBe('down');
    expect(fb.arrowColor).toBe('orange');
    expect(fb.warning).toBe(false);
  });

  it('returns type "red" and red arrow + warning when moving away from target', () => {
    const fb = getGuidedFeedback(-100, [-40, -60, -80, -100]);
    expect(fb.type).toBe('red');
    expect(fb.direction).toBe('up');
    expect(fb.arrowColor).toBe('red');
    expect(fb.warning).toBe(true);
  });

  it('unstable trend still shows directional arrow (no warning though)', () => {
    const fb = getGuidedFeedback(-100, [-40, -80, -60, -100]);
    expect(fb.type).toBe('orange');
    expect(fb.direction).toBe('up');
    expect(fb.warning).toBe(false);
  });

  it('returns non-green immediately when just outside ±8 cents (e.g. 9 cents)', () => {
    const fb = getGuidedFeedback(9, [30, 25, 20, 12]);
    expect(fb.type).not.toBe('green');
    expect(fb.direction).toBe('down');
  });

  it('returns green for value exactly at +8 cents boundary', () => {
    const fb = getGuidedFeedback(8, [30, 20, 10, 8]);
    expect(fb.type).toBe('green');
  });

  // Cross-note guard: playing a different standard string note must never show "green"
  it('does not return "green" when playing D3 (4th string) while targeting E2 (6th string)', () => {
    // D3 is ~1000 cents above E2 – far outside the ±8 cent perfect window
    const e2Freq = noteToFrequency('E', 2);
    const d3Freq = noteToFrequency('D', 3);
    const cents = getCentsToTarget(d3Freq, e2Freq); // ≈ +1000
    const fb = getGuidedFeedback(cents, [1000, 1000, 1000, 1000]);
    expect(fb.type).not.toBe('green');
    expect(fb.direction).toBe('down'); // too high – lower the pitch
  });

  it('does not return "green" when playing D2 (below E2) while targeting E2', () => {
    // D2 is ~200 cents below E2
    const e2Freq = noteToFrequency('E', 2);
    const d2Freq = noteToFrequency('D', 2);
    const cents = getCentsToTarget(d2Freq, e2Freq); // ≈ -200
    const fb = getGuidedFeedback(cents, [-200, -200, -200, -200]);
    expect(fb.type).not.toBe('green');
    expect(fb.direction).toBe('up'); // too low – raise the pitch
  });

  it('does not return "green" when 20 cents below target (clearly off-pitch)', () => {
    const e2Freq = noteToFrequency('E', 2);
    const flatFreq = e2Freq * Math.pow(2, -20 / 1200); // 20 cents below E2
    const cents = getCentsToTarget(flatFreq, e2Freq); // ≈ -20
    const fb = getGuidedFeedback(cents, [-20, -20, -20, -20]);
    expect(fb.type).not.toBe('green');
    expect(fb.direction).toBe('up');
  });
});

describe('updateFeedbackDisplay – 3-second rule with immediate state-change override', () => {
  const NOW = 1000;
  const WITHIN_3S = NOW + FEEDBACK_DISPLAY_DURATION_MS - 1;
  const AFTER_3S  = NOW + FEEDBACK_DISPLAY_DURATION_MS;

  const redFeedback    = { type: 'red',    direction: 'up',   arrowColor: 'red',    warning: true  };
  const orangeFeedback = { type: 'orange', direction: 'up',   arrowColor: 'orange', warning: false };
  const greenFeedback  = { type: 'green',  direction: 'none', arrowColor: null,     warning: false };
  const nullFeedback   = { type: null,     direction: 'up',   arrowColor: null,     warning: false };

  it('shows the first hint immediately when display is empty', () => {
    const result = updateFeedbackDisplay(null, orangeFeedback, NOW);
    expect(result.type).toBe('orange');
    expect(result.shownAt).toBe(NOW);
  });

  it('red → orange: overrides immediately when direction is corrected (state change takes priority)', () => {
    const current = { ...redFeedback, shownAt: NOW };
    const result = updateFeedbackDisplay(current, orangeFeedback, NOW + 500);
    expect(result.type).toBe('orange');
    expect(result.shownAt).toBe(NOW + 500);
  });

  it('orange → green: overrides immediately when target is reached', () => {
    const current = { ...orangeFeedback, shownAt: NOW };
    const result = updateFeedbackDisplay(current, greenFeedback, NOW + 500);
    expect(result.type).toBe('green');
    expect(result.shownAt).toBe(NOW + 500);
  });

  it('green → orange: overrides immediately when pitch drifts out of tune', () => {
    const current = { ...greenFeedback, shownAt: NOW };
    const result = updateFeedbackDisplay(current, orangeFeedback, NOW + 500);
    expect(result.type).toBe('orange');
    expect(result.shownAt).toBe(NOW + 500);
  });

  it('orange → red: overrides immediately when direction worsens', () => {
    const current = { ...orangeFeedback, shownAt: NOW };
    const result = updateFeedbackDisplay(current, redFeedback, NOW + 500);
    expect(result.type).toBe('red');
    expect(result.shownAt).toBe(NOW + 500);
  });

  it('keeps same-type hint unchanged (preserves shownAt)', () => {
    const current = { ...orangeFeedback, shownAt: NOW };
    const result = updateFeedbackDisplay(current, orangeFeedback, NOW + 1000);
    expect(result).toBe(current);
    expect(result.shownAt).toBe(NOW);
  });

  it('null feedback keeps current hint within 3 seconds', () => {
    const current = { ...redFeedback, shownAt: NOW };
    const result = updateFeedbackDisplay(current, nullFeedback, WITHIN_3S);
    expect(result).toBe(current);
    expect(result.type).toBe('red');
  });

  it('null feedback keeps green hint within 3 seconds', () => {
    const current = { ...greenFeedback, shownAt: NOW };
    const result = updateFeedbackDisplay(current, nullFeedback, WITHIN_3S);
    expect(result).toBe(current);
    expect(result.type).toBe('green');
  });

  it('null feedback clears hint after 3 seconds', () => {
    const current = { ...orangeFeedback, shownAt: NOW };
    const result = updateFeedbackDisplay(current, nullFeedback, AFTER_3S);
    expect(result).toBeNull();
  });

  it('null feedback with no current display returns null', () => {
    const result = updateFeedbackDisplay(null, nullFeedback, NOW);
    expect(result).toBeNull();
  });

  it('state changes are never blocked by remaining display time', () => {
    // Red hint shown 100ms ago – but orange replaces it immediately
    const current = { ...redFeedback, shownAt: NOW };
    const result = updateFeedbackDisplay(current, orangeFeedback, NOW + 100);
    expect(result.type).toBe('orange');
  });

  it('FEEDBACK_DISPLAY_DURATION_MS is 3000 ms', () => {
    expect(FEEDBACK_DISPLAY_DURATION_MS).toBe(3000);
  });
});

describe('constants', () => {
  it('PERFECT_TOLERANCE_CENTS is 8', () => {
    expect(PERFECT_TOLERANCE_CENTS).toBe(8);
  });

  it('ANALYZE_INTERVAL_MS is 50 – audio analysis runs 20 times per second', () => {
    expect(ANALYZE_INTERVAL_MS).toBe(50);
  });

  it('STABLE_CONFIRM_FRAMES is 3', () => {
    expect(STABLE_CONFIRM_FRAMES).toBe(3);
  });

  it('HISTORY_MAX_AGE_MS is 1000', () => {
    expect(HISTORY_MAX_AGE_MS).toBe(1000);
  });

  it('SILENCE_RESET_THRESHOLD_MS is 300', () => {
    expect(SILENCE_RESET_THRESHOLD_MS).toBe(300);
  });
});

describe('pushAndMedianTimed', () => {
  it('returns median of frequencies within time window', () => {
    const history = [];
    const now = 5000;
    pushAndMedianTimed(history, 100, now);
    pushAndMedianTimed(history, 110, now + 50);
    const median = pushAndMedianTimed(history, 120, now + 100);
    expect(median).toBe(110);
  });

  it('discards entries older than 1000ms', () => {
    const history = [];
    const now = 5000;
    pushAndMedianTimed(history, 100, now); // older
    pushAndMedianTimed(history, 110, now + 500);
    const median = pushAndMedianTimed(history, 120, now + 1100);
    // 100 should be removed (1100 > 1000 gap)
    // history has [110, 120] -> median 115
    expect(median).toBe(115);
  });

  it('still caps at 5 entries even if all are new', () => {
    const history = [];
    const now = 5000;
    for (let i = 0; i < 10; i++) {
      pushAndMedianTimed(history, 100 + i, now + i);
    }
    expect(history.length).toBe(5);
    // [105, 106, 107, 108, 109] -> median 107
    expect(history.map(h => h.freq)).toEqual([105, 106, 107, 108, 109]);
  });
});

describe('getAdaptiveFftSize – 3-tier adaptive window', () => {
  it('returns 32768 for E2 range (≤90 Hz)', () => {
    expect(getAdaptiveFftSize(82)).toBe(32768);
  });

  it('returns 16384 for A2 range (90–160 Hz)', () => {
    expect(getAdaptiveFftSize(110)).toBe(16384);
  });

  it('returns 16384 for D3 range (90–160 Hz)', () => {
    expect(getAdaptiveFftSize(147)).toBe(16384);
  });

  it('returns 8192 for G3 range (>160 Hz)', () => {
    expect(getAdaptiveFftSize(196)).toBe(8192);
  });

  it('returns 8192 for B3 range (>160 Hz)', () => {
    expect(getAdaptiveFftSize(247)).toBe(8192);
  });

  it('returns 8192 for E4 range (>160 Hz)', () => {
    expect(getAdaptiveFftSize(330)).toBe(8192);
  });

  it('returns 16384 with no reference (safe default for free mode)', () => {
    expect(getAdaptiveFftSize(null)).toBe(16384);
    expect(getAdaptiveFftSize()).toBe(16384);
  });
});

describe('analyzeInputLevel', () => {
  it('rejects near-silence input', () => {
    const buffer = new Float32Array(256);
    const level = analyzeInputLevel(buffer);
    expect(level.isValid).toBe(false);
  });

  it('accepts normal signal levels without clipping', () => {
    const buffer = new Float32Array(256);
    for (let i = 0; i < buffer.length; i++) buffer[i] = Math.sin((2 * Math.PI * i) / 32) * 0.25;
    const level = analyzeInputLevel(buffer);
    expect(level.isValid).toBe(true);
  });
});

describe('pushMedianAndStabilize', () => {
  it('accepts close median changes as stable updates', () => {
    const history = [];
    const base = pushMedianAndStabilize(history, 110, null);
    expect(base.stable).toBe(110);
    const next = pushMedianAndStabilize(history, 111, base.stable);
    expect(next.stable).toBeGreaterThan(110);
  });

  it('always accepts the new median as stable (no jump gate)', () => {
    // Large jumps must pass through; the rolling median handles noise smoothing.
    const history = [150, 151, 152, 153];
    const result = pushMedianAndStabilize(history, 330, 82.8);
    expect(result.stable).not.toBe(82.8);
    expect(result.changed).toBe(true);
  });
});

describe('applyNoteSwitchHysteresis', () => {
  it('switches immediately when no previous accepted note exists', () => {
    const r = applyNoteSwitchHysteresis(null, 'E2', 0);
    expect(r.acceptedNoteKey).toBe('E2');
  });

  it('requires confirmation frames before changing to a different note', () => {
    let accepted = 'E2';
    let streak = 0;
    for (let i = 0; i < NOTE_SWITCH_CONFIRM_FRAMES - 1; i++) {
      const r = applyNoteSwitchHysteresis(accepted, 'B3', streak);
      accepted = r.acceptedNoteKey;
      streak = r.nextStreak;
    }
    expect(accepted).toBe('E2');
    const last = applyNoteSwitchHysteresis(accepted, 'B3', streak);
    expect(last.acceptedNoteKey).toBe('B3');
    expect(last.switched).toBe(true);
  });
});

// ── Note switching in free mode ───────────────────────────────────────────────

describe('pushMedianAndStabilize – note switching', () => {
  it('updates stable frequency after consistently detecting a new note (e.g. E2 → E4)', () => {
    // Demonstrates Bug 2: stableFrequency freezes when user switches strings.
    // After 5 consistent E4 frames, stable should switch from E2 to E4.
    const history = [];
    let stable = 82.41; // E2 baseline

    for (let i = 0; i < 5; i++) {
      const r = pushMedianAndStabilize(history, 329.63, stable);
      stable = r.stable;
    }

    // RED before fix: stable stays 82.41 (blocked by 25-cent gate)
    // GREEN after fix: stable ≈ 329.63
    expect(stable).toBeGreaterThan(300);
    expect(stable).toBeLessThan(360);
  });
});

// ── detectPitch: search window & attack handling ──────────────────────────────

describe('detectPitch – free-mode search window', () => {
  it('E4 signal is undetectable when constrained by E2 referenceHz (bug 1 scenario)', () => {
    const sampleRate = 44100;
    const bufferSize = 16384;
    const buffer = new Float32Array(bufferSize);
    for (let i = 0; i < bufferSize; i++)
      buffer[i] = Math.sin(2 * Math.PI * 329.63 * i / sampleRate) * 0.3;

    // With E2 as referenceHz the search window is [70, 148 Hz].
    // The fundamental E4 (330 Hz) is outside the window; at best a harmonic is detected.
    const constrained = detectPitch(buffer, sampleRate, { referenceHz: 82.41 });
    // null OR a wrong harmonic – never the correct E4 range
    expect(constrained === null || constrained < 300 || constrained > 360).toBe(true);

    // Without constraint (free mode after fix) E4 is detectable
    const free = detectPitch(buffer, sampleRate, {});
    expect(free).not.toBeNull();
    expect(free).toBeGreaterThan(300);
    expect(free).toBeLessThan(360);
  });
});

describe('detectPitch – guitar attack transient', () => {
  it('identifies pitch despite loud transient at the start of the buffer', () => {
    const sampleRate = 44100;
    const bufferSize = 16384;
    const freq = 196.0; // G3
    const buffer = new Float32Array(bufferSize);
    const attackLen = Math.floor(bufferSize * 0.2);
    for (let i = 0; i < bufferSize; i++) {
      // Loud attack (0.85) for first 20 %, then normal amplitude (0.3)
      const amp = i < attackLen ? 0.85 : 0.3;
      buffer[i] = Math.sin(2 * Math.PI * freq * i / sampleRate) * amp;
    }

    const hz = detectPitch(buffer, sampleRate, {});
    expect(hz).not.toBeNull();
    expect(hz).toBeGreaterThan(freq * 0.95);
    expect(hz).toBeLessThan(freq * 1.05);
  });
});

// ── V3: Ausreißer-Rejection ───────────────────────────────────────────────────

describe('shouldRejectOutlier', () => {
  it('does not reject when no stable frequency exists', () => {
    const r = shouldRejectOutlier(null, 200, 0);
    expect(r.reject).toBe(false);
    expect(r.nextStreak).toBe(0);
  });

  it('does not reject candidate within threshold (close frequency)', () => {
    // 120 Hz vs. 110 Hz ≈ 155 cents < OUTLIER_REJECTION_THRESHOLD_CENTS
    const r = shouldRejectOutlier(120, 110, 0);
    expect(r.reject).toBe(false);
    expect(r.nextStreak).toBe(0);
  });

  it('rejects first outlier and increments streak (0 → 1)', () => {
    // E4 (330 Hz) vs. stable E2 (82 Hz) ≈ 2400 cents – clear outlier
    const r = shouldRejectOutlier(82, 330, 0);
    expect(r.reject).toBe(true);
    expect(r.nextStreak).toBe(1);
  });

  it('rejects second consecutive outlier (streak 1 → 2)', () => {
    const r = shouldRejectOutlier(82, 330, 1);
    expect(r.reject).toBe(true);
    expect(r.nextStreak).toBe(2);
  });

  it('accepts on third consecutive outlier – true note change', () => {
    const r = shouldRejectOutlier(82, 330, 2);
    expect(r.reject).toBe(false);
    expect(r.nextStreak).toBe(0);
  });

  it('resets streak when a close candidate follows a rejected outlier', () => {
    const r = shouldRejectOutlier(196, 200, 1); // G3 vs. ~G3: very close
    expect(r.reject).toBe(false);
    expect(r.nextStreak).toBe(0);
  });

  it('does not permanently block G3→B3 string change (400 cents > threshold)', () => {
    // G3 (196 Hz) → B3 (247 Hz) ≈ 400 cents > 350 → 2 rejections, then accepted
    const r0 = shouldRejectOutlier(196, 247, 0);
    const r1 = shouldRejectOutlier(196, 247, r0.nextStreak);
    const r2 = shouldRejectOutlier(196, 247, r1.nextStreak);
    expect(r0.reject).toBe(true);
    expect(r1.reject).toBe(true);
    expect(r2.reject).toBe(false); // 3. Frame: echter Saitenwechsel akzeptiert
  });

  it('OUTLIER_REJECTION_THRESHOLD_CENTS is 350', () => {
    expect(OUTLIER_REJECTION_THRESHOLD_CENTS).toBe(350);
  });
});

// ── V4: Adaptiver Noise Floor ────────────────────────────────────────────────

describe('estimateNoiseFloorRms', () => {
  it('returns 0 for an empty array', () => {
    expect(estimateNoiseFloorRms([])).toBe(0);
  });

  it('returns the median of provided RMS values', () => {
    expect(estimateNoiseFloorRms([0.01, 0.02, 0.015])).toBeCloseTo(0.015);
  });

  it('is robust against a single outlier spike (uses median)', () => {
    // Median of [0.01, 0.01, 0.01, 0.5] = 0.01 (spike excluded)
    expect(estimateNoiseFloorRms([0.01, 0.01, 0.01, 0.5])).toBeCloseTo(0.01);
  });
});

describe('buildAdaptiveThreshold', () => {
  it('uses GUITAR_MIN_RMS when noise floor is very low', () => {
    // 0.001 * 4 = 0.004 < 0.008 → GUITAR_MIN_RMS wins
    expect(buildAdaptiveThreshold(0.001)).toBeCloseTo(0.008);
  });

  it('scales up threshold when noise floor is loud', () => {
    // 0.01 * 4 = 0.04 > 0.008 → scaled threshold used
    expect(buildAdaptiveThreshold(0.01)).toBeCloseTo(0.04);
  });

  it('caps threshold to avoid locking out legitimate guitar signal', () => {
    // 0.1 * 4 = 0.4 would be too high; must be capped at MAX_ADAPTIVE_THRESHOLD
    expect(buildAdaptiveThreshold(0.1)).toBeLessThanOrEqual(0.15);
  });
});

// ── V9: EMA Cents-Glättung ───────────────────────────────────────────────────

describe('smoothCents', () => {
  it('returns rawCents directly on first call (no previous value)', () => {
    expect(smoothCents(null, 15)).toBeCloseTo(15);
  });

  it('applies EMA formula: alpha*new + (1-alpha)*old', () => {
    // prev=0, raw=10, alpha=0.4 → 0.4*10 + 0.6*0 = 4
    expect(smoothCents(0, 10, 0.4)).toBeCloseTo(4);
  });

  it('converges toward target over multiple frames', () => {
    let v = 0;
    for (let i = 0; i < 20; i++) v = smoothCents(v, 50, 0.4);
    expect(v).toBeGreaterThan(45); // nähert sich 50 an
  });

  it('works correctly with negative cents values', () => {
    // prev=0, raw=-20, alpha=0.4 → 0.4*(-20) + 0.6*0 = -8
    expect(smoothCents(0, -20, 0.4)).toBeCloseTo(-8);
  });

  it('uses default alpha of 0.4 when not specified', () => {
    expect(smoothCents(0, 10)).toBeCloseTo(4);
  });
});

// ── V5: HPS auf FFT-Magnitude-Array ─────────────────────────────────────────

describe('hpsFromMagnitudes', () => {
  const SR = 44100;
  const FFT_SIZE = 16384;
  const BIN_HZ = SR / FFT_SIZE; // ≈ 2.69 Hz/Bin
  const HALF_BINS = FFT_SIZE / 2;

  /** Erzeugt Magnitude-Spektrum (dB) mit Grundton und Obertönen. */
  function makeHarmonicSpectrum(fundamentalHz, harmonics = 3) {
    const mags = new Float32Array(HALF_BINS).fill(-100);
    for (let h = 1; h <= harmonics; h++) {
      const bin = Math.round((fundamentalHz * h) / BIN_HZ);
      if (bin < HALF_BINS) mags[bin] = h === 1 ? -10 : -20; // Grundton am stärksten
    }
    return mags;
  }

  it('detects E2 fundamental from harmonic spectrum', () => {
    const mags = makeHarmonicSpectrum(82.4);
    const hz = hpsFromMagnitudes(mags, BIN_HZ, 70, 420);
    expect(hz).not.toBeNull();
    // FFT-Auflösung ist ~2.7 Hz/Bin, Toleranz entsprechend
    expect(hz).toBeGreaterThan(75);
    expect(hz).toBeLessThan(92);
  });

  it('detects A2 fundamental from harmonic spectrum', () => {
    const mags = makeHarmonicSpectrum(110);
    const hz = hpsFromMagnitudes(mags, BIN_HZ, 70, 420);
    expect(hz).not.toBeNull();
    expect(hz).toBeGreaterThan(102);
    expect(hz).toBeLessThan(118);
  });

  it('returns null for a flat noise spectrum (no harmonic structure)', () => {
    const mags = new Float32Array(HALF_BINS).fill(-100);
    expect(hpsFromMagnitudes(mags, BIN_HZ, 70, 420)).toBeNull();
  });

  it('prefers fundamental over overtone even when overtone has higher magnitude', () => {
    // Spektrum: 2. Oberton stärker als Grundton, aber HPS maximiert an Grundton
    const mags = new Float32Array(HALF_BINS).fill(-100);
    const f0Bin  = Math.round(82.4 / BIN_HZ);  // E2 Grundton
    const f1Bin  = Math.round(164.8 / BIN_HZ); // 2. Oberton (stärker)
    const f2Bin  = Math.round(247.2 / BIN_HZ); // 3. Oberton
    mags[f0Bin] = -25;  // Grundton schwächer
    mags[f1Bin] = -15;  // 2. Oberton stärker
    mags[f2Bin] = -20;
    const hz = hpsFromMagnitudes(mags, BIN_HZ, 70, 420);
    // HPS-Score für f0: mag[f0] + mag[2*f0] + mag[3*f0] = -25 + -15 + -20 = -60
    // HPS-Score für f1: mag[f1] + mag[2*f1] + ... ≈ -15 + -100 + -100 = -215
    // → Grundton gewinnt
    expect(hz).not.toBeNull();
    expect(hz).toBeGreaterThan(75);
    expect(hz).toBeLessThan(92);
  });
});

// ── Regressionstests detectPitch nach Verbesserungen ─────────────────────────

describe('detectPitch – regression after V1/V3/V4 improvements', () => {
  function synth(freq, sampleRate, samples, amp = 0.3) {
    const buf = new Float32Array(samples);
    for (let i = 0; i < samples; i++)
      buf[i] = amp * Math.sin(2 * Math.PI * freq * i / sampleRate);
    return buf;
  }

  it('detects E2 correctly with 32768-sample buffer', () => {
    const buf = synth(82.4, 44100, 32768);
    const hz = detectPitch(buf, 44100);
    expect(hz).not.toBeNull();
    expect(hz).toBeGreaterThan(78);
    expect(hz).toBeLessThan(88);
  });

  it('detects G3 correctly with reduced 8192-sample buffer (V1)', () => {
    const buf = synth(196, 44100, 8192);
    const hz = detectPitch(buf, 44100);
    expect(hz).not.toBeNull();
    expect(hz).toBeGreaterThan(186);
    expect(hz).toBeLessThan(206);
  });

  it('returns null for below-threshold signal (noise gate, V4)', () => {
    const buf = synth(196, 44100, 8192, 0.001); // Amplitude viel zu leise
    expect(detectPitch(buf, 44100)).toBeNull();
  });

  it('detects B3 correctly – no subharmonic demotion to B2 (8192 samples)', () => {
    const buf = synth(246.94, 44100, 8192);
    const hz = detectPitch(buf, 44100);
    expect(hz).not.toBeNull();
    const { note, octave } = frequencyToNote(hz);
    expect(note).toBe('B');
    expect(octave).toBe(3);
  });

  it('detects E4 correctly – no subharmonic demotion to E3 (8192 samples)', () => {
    const buf = synth(329.63, 44100, 8192);
    const hz = detectPitch(buf, 44100);
    expect(hz).not.toBeNull();
    const { note, octave } = frequencyToNote(hz);
    expect(note).toBe('E');
    expect(octave).toBe(4);
  });

  it('A2 detection has no HPS averaging bias (within 2 cents)', () => {
    const buf = synth(110, 44100, 32768);
    const hz = detectPitch(buf, 44100);
    expect(hz).not.toBeNull();
    expect(Math.abs(1200 * Math.log2(hz / 110))).toBeLessThan(2);
  });

  it('G3 detection has no HPS averaging bias (within 5 cents)', () => {
    const buf = synth(196, 44100, 8192);
    const hz = detectPitch(buf, 44100);
    expect(hz).not.toBeNull();
    expect(Math.abs(1200 * Math.log2(hz / 196))).toBeLessThan(5);
  });
});
