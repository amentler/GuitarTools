import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import {
  evaluateChordRecognitionConfusion,
  formatChordRecognitionMetricsReport,
} from '../helpers/chordRecognitionMetrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FROZEN_FIXTURES = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/chord-hpcp/frozen-hpcp-fixtures.json'), 'utf-8'),
);

describe('Chord recognition confusion metrics', () => {
  it('sammelt TP/FP/FN/TN und gibt Sensitivität/Spezifität automatisch aus', () => {
    const report = evaluateChordRecognitionConfusion(FROZEN_FIXTURES);

    console.info(`\n${formatChordRecognitionMetricsReport(report)}`);

    expect(report.counts.total).toBe(
      report.counts.tp + report.counts.fp + report.counts.fn + report.counts.tn,
    );
    expect(report.counts.positiveFixtures).toBeGreaterThan(0);
    expect(report.counts.chordCount).toBeGreaterThan(0);
    expect(report.metrics.sensitivity).toBeGreaterThanOrEqual(0);
    expect(report.metrics.sensitivity).toBeLessThanOrEqual(1);
    expect(report.metrics.specificity).toBeGreaterThanOrEqual(0);
    expect(report.metrics.specificity).toBeLessThanOrEqual(1);
  });
});
