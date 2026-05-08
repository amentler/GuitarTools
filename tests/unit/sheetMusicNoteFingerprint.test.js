import { describe, expect, it } from 'vitest';
import {
  evaluateOpenStringNoteFingerprint,
  formatOpenStringNoteFingerprintReport,
  OPEN_STRING_NOTE_FIXTURES,
} from '../helpers/sheetMusicNoteFingerprint.js';

describe('sheet music note fingerprint – open-string matrix', () => {
  it('accepts only the six matching open-string source/target pairs', () => {
    const report = evaluateOpenStringNoteFingerprint();

    expect(report.counts.total).toBe(OPEN_STRING_NOTE_FIXTURES.length ** 2);
    expect(report.counts.expectedPositive).toBe(OPEN_STRING_NOTE_FIXTURES.length);
    expect(report.counts.tp, formatOpenStringNoteFingerprintReport(report)).toBe(6);
    expect(report.counts.fp, formatOpenStringNoteFingerprintReport(report)).toBe(0);
    expect(report.counts.fn, formatOpenStringNoteFingerprintReport(report)).toBe(0);
    expect(report.counts.tn, formatOpenStringNoteFingerprintReport(report)).toBe(30);
    expect(report.metrics.precision).toBe(1);
    expect(report.metrics.sensitivity).toBe(1);
    expect(report.metrics.specificity).toBe(1);
    expect(report.metrics.accuracy).toBe(1);
    expect(report.metrics.f1).toBe(1);
  }, 20_000);
});
