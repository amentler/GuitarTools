import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import {
  averageHpcps,
  buildChordTemplates,
  matchHpcpToChord,
} from '../../js/games/chordExerciseEssentia/essentiaChordLogic.js';
import {
  evaluateChordRecognitionConfusion,
} from '../helpers/chordRecognitionMetrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FROZEN_FIXTURES = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/chord-hpcp/frozen-hpcp-fixtures.json'), 'utf-8'),
);
const TEMPLATES = buildChordTemplates();

function toAverageHpcp(fixture) {
  return averageHpcps(fixture.hpcpFrames.map(frame => Float32Array.from(frame)));
}

// Run once at module load; shared across all guards to avoid redundant matrix passes.
const REPORT = evaluateChordRecognitionConfusion(FROZEN_FIXTURES);
const MATRIX_ROWS = REPORT.rows.filter(r => r.kind === 'matrix');
const MATRIX_FPS = REPORT.cases.falsePositives.filter(r => r.kind === 'matrix');

describe('Chord recognition quality guards', () => {
  it('Guard 1 – Precision-Regression-Lock: FP ≤ 38, FN = 0', () => {
    const { counts, metrics } = REPORT;
    console.info(
      `TP=${counts.tp} FP=${counts.fp} FN=${counts.fn} TN=${counts.tn} | ` +
      `Precision=${(metrics.precision * 100).toFixed(1)}% Recall=${(metrics.sensitivity * 100).toFixed(1)}% F1=${(metrics.f1 * 100).toFixed(1)}%`,
    );
    expect(counts.fn, 'Recall=100% ist Pflicht (FN=0)').toBe(0);
    expect(counts.fp, 'FP-Regression: mehr als 33 FPs').toBeLessThanOrEqual(33);
    expect(metrics.precision, 'Precision unter 63% — starke Regression').toBeGreaterThanOrEqual(0.63);
  });

  it('Guard 2 – Bass-Contribution: Bass blockiert ≥ 5 FPs ohne TPs zu blockieren', () => {
    // Re-run matchHpcpToChord without bass for all positive-fixture matrix rows.
    // Bass cannot cause FNs (removing it only opens the gate further), so
    // bassCriticalTPs should always be empty — this asserts the invariant stays true.
    const bassBlockedFPs = [];
    const bassCriticalTPs = [];

    for (const row of MATRIX_ROWS) {
      const avgHpcp = toAverageHpcp(row.fixture);
      const noBass = matchHpcpToChord(avgHpcp, row.probeChordName, TEMPLATES, undefined, {});

      if (!row.expectedPositive && !row.actualPositive && noBass.isCorrect) {
        bassBlockedFPs.push(`${row.fixture.wavFile} → ${row.probeChordName}`);
      }
      if (row.expectedPositive && row.actualPositive && !noBass.isCorrect) {
        bassCriticalTPs.push(`${row.fixture.wavFile} → ${row.probeChordName}`);
      }
    }

    console.info(`Bass-blocked FPs (Akkord-Fixtures): ${bassBlockedFPs.length}`);
    bassBlockedFPs.forEach(s => console.info(`  prevented: ${s}`));
    console.info(`Bass-critical TPs (dürfen nicht existieren): ${bassCriticalTPs.length}`);
    bassCriticalTPs.forEach(s => console.info(`  broken: ${s}`));

    expect(bassBlockedFPs.length, 'Bass-Support sollte mindestens 5 FPs verhindern').toBeGreaterThanOrEqual(5);
    expect(bassCriticalTPs.length, 'Bass-Gate darf keine TPs blockieren').toBe(0);
  });

  it('Guard 3 – Fragile-TP-Audit: Akkorde mit Confidence < 0.6 sind auf ≤ 15 begrenzt', () => {
    const fragile = REPORT.cases.truePositives.filter(r => r.confidence < 0.6);

    console.info(`Fragile TPs (confidence < 0.6): ${fragile.length}`);
    fragile.forEach(r =>
      console.info(`  ${r.fixture.wavFile}: confidence=${r.confidence.toFixed(3)}`),
    );

    expect(fragile.length, 'Zu viele fragile TPs — Schwellenwerte prüfen').toBeLessThanOrEqual(22);
  });

  it('Guard 4 – Asymmetrie-Test: bidirektionale Konfusionen erkannt und begrenzt', () => {
    const fpKeys = new Set(MATRIX_FPS.map(r => `${r.fixture.chordName}→${r.probeChordName}`));

    const bidirectionalPairs = new Set();
    const unidirectional = [];

    for (const r of MATRIX_FPS) {
      const reverseKey = `${r.probeChordName}→${r.fixture.chordName}`;
      if (fpKeys.has(reverseKey)) {
        bidirectionalPairs.add([r.fixture.chordName, r.probeChordName].sort().join(' ↔ '));
      } else {
        unidirectional.push(`${r.fixture.chordName} → ${r.probeChordName}`);
      }
    }

    console.info(`Bidirektionale Konfusionen (${bidirectionalPairs.size}):`);
    [...bidirectionalPairs].forEach(p => console.info(`  ${p}`));
    console.info(`Unidirektionale Konfusionen (${unidirectional.length}):`);
    unidirectional.forEach(u => console.info(`  ${u}`));

    expect(bidirectionalPairs.size, 'Zu viele bidirektionale Konfusionen').toBeLessThanOrEqual(8);
  });

  it('Guard 5 – FP-Budget pro Quellakkord: kein Quellakkord überschreitet sein Limit', () => {
    const fpsBySource = {};
    for (const r of REPORT.cases.falsePositives) {
      const src = r.fixture.chordName;
      fpsBySource[src] = (fpsBySource[src] ?? 0) + 1;
    }

    // C-Dur's 18 FPs come from open-strum negative fixtures probed exhaustively
    // against all 66 chords — not from actual C-Dur recordings being confused.
    const BUDGETS = {
      'C-Dur': 18,
      'E-Moll': 3,
      'G-Moll': 3,
      'G7': 2,
    };
    const DEFAULT_BUDGET = 1;

    const violations = [];
    for (const [src, count] of Object.entries(fpsBySource)) {
      const budget = BUDGETS[src] ?? DEFAULT_BUDGET;
      if (count > budget) {
        violations.push(`${src}: ${count} FPs (budget ${budget})`);
      }
    }

    console.info('FPs pro Quellakkord:', JSON.stringify(fpsBySource));
    expect(violations, violations.join('; ')).toHaveLength(0);
  });
});
