import { describe, it, expect } from 'vitest';
import {
  pushAndMedian,
  applyNoteSwitchHysteresis,
  NOTE_SWITCH_CONFIRM_FRAMES,
  GUIDED_TUNING_STEPS,
  QUARTER_TONE_CENTS,
  PERFECT_TOLERANCE_CENTS,
  FEEDBACK_DISPLAY_DURATION_MS,
  getPitchDirection,
  getTuningState,
  tuningStateToDirection,
  buildGuidedDisplay,
  pushGuidedHistory,
  evaluateTrend,
  getGuidedFeedback,
  updateFeedbackDisplay,
  shouldRejectOutlier,
  smoothCents,
  STABLE_CONFIRM_FRAMES,
  pushAndMedianTimed
} from '../../js/tools/guitarTuner/tunerLogic.js';

describe('pushAndMedian', () => {
  it('returns the single value when history has one entry', () => {
    const history = [];
    expect(pushAndMedian(history, 440)).toBe(440);
  });

  it('returns the median of an odd-length history', () => {
    const history = [300, 400];
    expect(pushAndMedian(history, 500)).toBe(400);
  });

  it('returns the average of the two middle values for even-length history', () => {
    const history = [300];
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
  });

  it('returns "down" when pitch is more than a quarter tone too high', () => {
    expect(getPitchDirection(51)).toBe('down');
  });
});

describe('getTuningState – ±5 cent boundary', () => {
  it('returns "too-low" below -5 cents', () => {
    expect(getTuningState(-6)).toBe('too-low');
  });

  it('returns "perfect" at exactly -5 cents', () => {
    expect(getTuningState(-PERFECT_TOLERANCE_CENTS)).toBe('perfect');
  });

  it('returns "perfect" at zero', () => {
    expect(getTuningState(0)).toBe('perfect');
  });

  it('returns "perfect" at exactly +5 cents', () => {
    expect(getTuningState(PERFECT_TOLERANCE_CENTS)).toBe('perfect');
  });

  it('returns "too-high" above +5 cents', () => {
    expect(getTuningState(6)).toBe('too-high');
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
    expect(h.length).toBe(6);
  });
});

describe('evaluateTrend', () => {
  it('returns "unstable" when fewer than TREND_MIN_SAMPLES entries', () => {
    expect(evaluateTrend([])).toBe('unstable');
    expect(evaluateTrend([100, 90, 80])).toBe('unstable'); 
  });

  it('returns "approaching" when absolute distance consistently decreases', () => {
    expect(evaluateTrend([100, 80, 60, 40])).toBe('approaching');
    expect(evaluateTrend([-100, -80, -60, -40])).toBe('approaching');
  });

  it('returns "moving-away" when absolute distance consistently increases', () => {
    expect(evaluateTrend([40, 60, 80, 100])).toBe('moving-away');
    expect(evaluateTrend([-40, -60, -80, -100])).toBe('moving-away');
  });
});

describe('getGuidedFeedback', () => {
  it('returns type "green" and no arrow when deviation is within ±5 cents', () => {
    const fb = getGuidedFeedback(3, [100, 80, 60, 40]);
    expect(fb.type).toBe('green');
    expect(fb.direction).toBe('none');
    expect(fb.arrowColor).toBeNull();
    expect(fb.warning).toBe(false);
  });

  it('returns orange + down direction when trend is unstable but pitch is too high', () => {
    const fb = getGuidedFeedback(100, [100, 80]);
    expect(fb.type).toBe('orange');
    expect(fb.direction).toBe('down');
  });

  it('returns type "red" and red arrow + warning when moving away from target', () => {
    const fb = getGuidedFeedback(-100, [-40, -60, -80, -100]);
    expect(fb.type).toBe('red');
    expect(fb.direction).toBe('up');
    expect(fb.warning).toBe(true);
  });
});

describe('updateFeedbackDisplay – 3-second rule', () => {
  const NOW = 1000;
  const WITHIN_3S = NOW + FEEDBACK_DISPLAY_DURATION_MS - 1;
  const AFTER_3S  = NOW + FEEDBACK_DISPLAY_DURATION_MS;

  const redFeedback    = { type: 'red',    direction: 'up',   arrowColor: 'red',    warning: true  };
  const orangeFeedback = { type: 'orange', direction: 'up',   arrowColor: 'orange', warning: false };
  const nullFeedback   = { type: null,     direction: 'up',   arrowColor: null,     warning: false };

  it('shows the first hint immediately when display is empty', () => {
    const result = updateFeedbackDisplay(null, orangeFeedback, NOW);
    expect(result.type).toBe('orange');
    expect(result.shownAt).toBe(NOW);
  });

  it('red → orange: overrides immediately when direction is corrected', () => {
    const current = { ...redFeedback, shownAt: NOW };
    const result = updateFeedbackDisplay(current, orangeFeedback, NOW + 500);
    expect(result.type).toBe('orange');
    expect(result.shownAt).toBe(NOW + 500);
  });

  it('null feedback keeps current hint within 3 seconds', () => {
    const current = { ...redFeedback, shownAt: NOW };
    const result = updateFeedbackDisplay(current, nullFeedback, WITHIN_3S);
    expect(result).toBe(current);
  });

  it('null feedback clears hint after 3 seconds', () => {
    const current = { ...orangeFeedback, shownAt: NOW };
    const result = updateFeedbackDisplay(current, nullFeedback, AFTER_3S);
    expect(result).toBeNull();
  });
});

describe('constants (heuristics)', () => {
  it('PERFECT_TOLERANCE_CENTS is 5', () => {
    expect(PERFECT_TOLERANCE_CENTS).toBe(5);
  });

  it('STABLE_CONFIRM_FRAMES is 3', () => {
    expect(STABLE_CONFIRM_FRAMES).toBe(3);
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
    pushAndMedianTimed(history, 100, now); 
    pushAndMedianTimed(history, 110, now + 500);
    const median = pushAndMedianTimed(history, 120, now + 1100);
    expect(median).toBe(115);
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

describe('shouldRejectOutlier', () => {
  it('rejects first outlier and increments streak (0 → 1)', () => {
    const r = shouldRejectOutlier(82, 330, 0);
    expect(r.reject).toBe(true);
    expect(r.nextStreak).toBe(1);
  });

  it('accepts on third consecutive outlier – true note change', () => {
    const r = shouldRejectOutlier(82, 330, 2);
    expect(r.reject).toBe(false);
    expect(r.nextStreak).toBe(0);
  });
});

describe('smoothCents', () => {
  it('applies EMA formula: alpha*new + (1-alpha)*old', () => {
    expect(smoothCents(0, 10, 0.4)).toBeCloseTo(4);
  });
});
