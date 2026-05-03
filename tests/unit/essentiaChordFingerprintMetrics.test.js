import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import {
  evaluateEssentiaFingerprintConfusion,
  formatEssentiaFingerprintReport,
} from '../helpers/essentiaFingerprintMetrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PREPARED_FIXTURES = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/chord-hpcp/frozen-essentia-fingerprint-fixtures.json'), 'utf-8'),
);

describe('Essentia chord recognition fingerprint metrics', () => {
  it('sammelt TP/FP/FN/TN und gibt Sensitivität/Spezifität automatisch aus', () => {
    const report = evaluateEssentiaFingerprintConfusion(PREPARED_FIXTURES);

    console.info(`\n${formatEssentiaFingerprintReport(report)}`);

    expect(report.counts.total).toBe(
      report.counts.tp + report.counts.fp + report.counts.fn + report.counts.tn,
    );
    expect(report.counts.positiveFixtures).toBeGreaterThan(0);
    expect(report.counts.chordCount).toBeGreaterThan(0);
    expect(report.metrics.sensitivity).toBeGreaterThanOrEqual(0);
    expect(report.metrics.sensitivity).toBeLessThanOrEqual(1);
    expect(report.metrics.precision).toBeGreaterThanOrEqual(0);
    expect(report.metrics.precision).toBeLessThanOrEqual(1);
    expect(report.metrics.specificity).toBeGreaterThanOrEqual(0);
    expect(report.metrics.specificity).toBeLessThanOrEqual(1);
  });
});
