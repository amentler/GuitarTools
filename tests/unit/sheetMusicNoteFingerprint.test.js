import { describe, expect, it } from 'vitest';
import {
  evaluateOpenStringNoteFingerprint,
  formatOpenStringNoteFingerprintReport,
  NOTE_AUDIO_FIXTURES,
} from '../helpers/sheetMusicNoteFingerprint.js';

describe('sheet music note fingerprint', () => {
  it('evaluates all note WAV fixtures through the sheet music recognition path', () => {
    const report = evaluateOpenStringNoteFingerprint();

    expect(report.fixtures.length).toBe(NOTE_AUDIO_FIXTURES.length);
    expect(report.strategyReports.map(row => row.strategy.key)).toEqual(['fast-note-matcher']);
    expect(report.counts.total).toBe(NOTE_AUDIO_FIXTURES.length * report.targetPitches.length);
    expect(report.counts.expectedPositive).toBe(NOTE_AUDIO_FIXTURES.length);
    expect(report.counts.fp, formatOpenStringNoteFingerprintReport(report)).toBe(5);
    expect(report.onsetCounts.missing, formatOpenStringNoteFingerprintReport(report)).toBe(0);
  }, 60_000);
});
