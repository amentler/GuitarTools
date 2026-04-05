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

  it('ANALYZE_INTERVAL_MS is 100 – audio analysis runs 10 times per second', () => {
    expect(ANALYZE_INTERVAL_MS).toBe(100);
  });
});

describe('getAdaptiveFftSize', () => {
  it('uses an extra-large window for very low frequencies (≤120 Hz)', () => {
    expect(getAdaptiveFftSize(82)).toBe(32768);
  });

  it('uses large window (≥300 ms) for mid range and default for null reference', () => {
    expect(getAdaptiveFftSize(180)).toBe(16384);
    expect(getAdaptiveFftSize()).toBe(16384);
  });

  it('uses large window (≥300 ms) for high frequencies', () => {
    expect(getAdaptiveFftSize(330)).toBe(16384);
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

  it('holds previous stable value when jump is too large', () => {
    const history = [150, 151, 152, 153];
    const result = pushMedianAndStabilize(history, 165, 82.8);
    expect(result.stable).toBe(82.8);
    expect(result.changed).toBe(false);
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
