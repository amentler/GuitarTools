import { describe, it, expect } from 'vitest';
import {
  frequencyToNote,
  isStandardTuningNote,
  pushAndMedian,
  STANDARD_TUNING,
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
    const history = [300, 400, 500];
    // After push: [300, 400, 500, 600] → sorted → median = (400+500)/2 = 450
    expect(pushAndMedian(history, 600)).toBe(450);
  });

  it('caps history at 5 entries', () => {
    const history = [100, 200, 300, 400, 500];
    pushAndMedian(history, 600);
    expect(history).toHaveLength(5);
  });
});
