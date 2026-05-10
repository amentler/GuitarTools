import { describe, expect, it } from 'vitest';
import {
  discoverSheetMusicSequenceFixtures,
  evaluateSheetMusicSequenceFingerprint,
  formatSheetMusicSequenceFingerprintReport,
  SHEET_FINGERPRINT_POSITIVE_FIXTURE_FILES,
} from '../helpers/sheetMusicSequenceFingerprint.js';

describe('sheet music sequence fingerprint', () => {
  it('keeps currently recognized sequence WAVs green through the sheet music recognition path', () => {
    const fixtures = discoverSheetMusicSequenceFixtures().filter(fixture => (
      SHEET_FINGERPRINT_POSITIVE_FIXTURE_FILES.includes(fixture.file)
    ));
    const report = evaluateSheetMusicSequenceFingerprint(fixtures);

    expect(report.counts.total).toBe(SHEET_FINGERPRINT_POSITIVE_FIXTURE_FILES.length);
    expect(report.counts.evaluated).toBe(SHEET_FINGERPRINT_POSITIVE_FIXTURE_FILES.length);
    expect(report.strategyReports.map(row => row.strategy.key)).toEqual(['fast-note-matcher']);
    expect(report.counts.failed, formatSheetMusicSequenceFingerprintReport(report)).toBe(0);
  }, 60_000);
});
