import { describe, expect, it } from 'vitest';
import {
  discoverSheetMusicSequenceFixtures,
  evaluateSheetMusicSequenceFingerprint,
  formatSheetMusicSequenceFingerprintReport,
  SHEET_FINGERPRINT_POSITIVE_FIXTURE_FILES,
} from '../helpers/sheetMusicSequenceFingerprint.js';
import { getSheetMusicRecognitionStrategies } from '../../js/games/sheetMusicReading/sheetMusicRecognition.js';

const allStrategies = [getSheetMusicRecognitionStrategies()[0]];

describe('sheet music sequence fingerprint', () => {
  it('discovers ZIP-backed sequence fixtures alongside loose WAV/JSON pairs', () => {
    const zipFixture = discoverSheetMusicSequenceFixtures().find(fixture => (
      fixture.file === 'sheet-music-reading/sheet-music-reading_40bpm_by7pc-tagged.zip'
    ));

    expect(zipFixture).toBeTruthy();
    expect(zipFixture.expectedNotes).toHaveLength(16);
    expect(zipFixture.taggedOnsetsMs).toHaveLength(16);
  });

  it('keeps currently recognized sequence WAVs green through the sheet music recognition path', () => {
    const fixtures = discoverSheetMusicSequenceFixtures().filter(fixture => (
      SHEET_FINGERPRINT_POSITIVE_FIXTURE_FILES.includes(fixture.file)
    ));
    const report = evaluateSheetMusicSequenceFingerprint(fixtures, { strategies: allStrategies });

    expect(report.counts.total).toBe(SHEET_FINGERPRINT_POSITIVE_FIXTURE_FILES.length);
    expect(report.counts.evaluated).toBe(SHEET_FINGERPRINT_POSITIVE_FIXTURE_FILES.length);
    expect(report.strategyReports.map(row => row.strategy.key)).toEqual(
      allStrategies.map(s => s.key),
    );
    for (const stratReport of report.strategyReports) {
      expect(stratReport.counts.detectedOnsets).toBeGreaterThan(0);
      expect(stratReport.counts.onsetTruePositives).toBeGreaterThan(0);
      expect(stratReport.metrics.onsetPrecision).toBeGreaterThanOrEqual(0);
      expect(stratReport.metrics.onsetPrecision).toBeLessThanOrEqual(1);
      expect(stratReport.metrics.onsetRecall).toBeGreaterThanOrEqual(0);
      expect(stratReport.metrics.onsetRecall).toBeLessThanOrEqual(1);
      expect(stratReport.metrics.onsetF1).toBeGreaterThanOrEqual(0);
      expect(stratReport.metrics.onsetF1).toBeLessThanOrEqual(1);
    }
    // Evaluate correctness for each strategy independently so a failing essentia
    // strategy does NOT break the fast-note-matcher guardrail.
    for (const stratReport of report.strategyReports) {
      expect(stratReport.counts.failed, `[${stratReport.strategy.key}] ${formatSheetMusicSequenceFingerprintReport(report)}`).toBe(0);
    }
  }, 600_000);
});
