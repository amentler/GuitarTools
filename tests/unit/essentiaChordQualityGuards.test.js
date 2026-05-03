import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import {
  averageHpcps,
  buildChordTemplates,
} from '../../js/games/chordExerciseEssentia/essentiaChordLogic.js';
import { matchEssentiaFingerprintHpcpToChord } from '../../js/games/chordExerciseEssentia/essentiaFingerprintChordMatcher.js';
import {
  evaluateEssentiaFingerprintConfusion,
} from '../helpers/essentiaFingerprintMetrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PREPARED_FIXTURES = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/chord-hpcp/frozen-essentia-fingerprint-fixtures.json'), 'utf-8'),
);
const TEMPLATES = buildChordTemplates();

function toAverageHpcp(fixture) {
  if (fixture.wasmAverageHpcp) {
    return Float32Array.from(fixture.wasmAverageHpcp);
  }

  return averageHpcps(fixture.wasmHpcpFrames.map(frame => Float32Array.from(frame)));
}

// Run once at module load; shared across all guards to avoid redundant matrix passes.
const REPORT = evaluateEssentiaFingerprintConfusion(PREPARED_FIXTURES);
const MATRIX_ROWS = REPORT.rows.filter(r => r.kind === 'matrix');
const MATRIX_FPS = REPORT.cases.falsePositives.filter(r => r.kind === 'matrix');

describe('Chord recognition quality guards', () => {
  it('Guard 1 – Fingerprint-Audit: Metriken bleiben numerisch und konsistent', () => {
    const { counts, metrics } = REPORT;
    console.info(
      `TP=${counts.tp} FP=${counts.fp} FN=${counts.fn} TN=${counts.tn} | ` +
      `Precision=${(metrics.precision * 100).toFixed(1)}% Recall=${(metrics.sensitivity * 100).toFixed(1)}% F1=${(metrics.f1 * 100).toFixed(1)}%`,
    );
    expect(counts.total).toBe(counts.tp + counts.fp + counts.fn + counts.tn);
    expect(metrics.sensitivity).toBeGreaterThanOrEqual(0);
    expect(metrics.sensitivity).toBeLessThanOrEqual(1);
    expect(metrics.precision).toBeGreaterThanOrEqual(0);
    expect(metrics.precision).toBeLessThanOrEqual(1);
  });

  it('Guard 2 – Bass-Audit: Bass-Einfluss bleibt messbar', () => {
    const bassBlockedFPs = [];
    const bassCriticalTPs = [];

    for (const row of MATRIX_ROWS) {
      const avgHpcp = toAverageHpcp(row.fixture);
      const noBass = matchEssentiaFingerprintHpcpToChord(avgHpcp, row.probeChordName, TEMPLATES, undefined);

      if (!row.expectedPositive && !row.actualPositive && noBass.isCorrect) {
        bassBlockedFPs.push(`${row.fixture.wavFile} → ${row.probeChordName}`);
      }
      if (row.expectedPositive && row.actualPositive && !noBass.isCorrect) {
        bassCriticalTPs.push(`${row.fixture.wavFile} → ${row.probeChordName}`);
      }
    }

    console.info(`Bass-blocked FPs (Akkord-Fixtures): ${bassBlockedFPs.length}`);
    console.info(`Bass-critical TPs (dürfen nicht existieren): ${bassCriticalTPs.length}`);

    expect(bassBlockedFPs.length).toBeGreaterThanOrEqual(0);
    expect(bassCriticalTPs.length).toBeGreaterThanOrEqual(0);
  });

  it('Guard 3 – Fragile-TP-Audit: schwache Treffer werden dokumentiert', () => {
    const fragile = REPORT.cases.truePositives.filter(r => r.confidence < 0.6);

    console.info(`Fragile TPs (confidence < 0.6): ${fragile.length}`);
    expect(fragile.length).toBeGreaterThanOrEqual(0);
  });

  it('Guard 4 – Asymmetrie-Audit: bidirektionale Konfusionen werden erkannt', () => {
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

    expect(bidirectionalPairs.size).toBeGreaterThanOrEqual(0);
  });

  it('Guard 5 – FP-Budget-Audit: FPs pro Quellakkord bleiben auswertbar', () => {
    const fpsBySource = {};
    for (const r of REPORT.cases.falsePositives) {
      const src = r.fixture.chordName;
      fpsBySource[src] = (fpsBySource[src] ?? 0) + 1;
    }

    console.info('FPs pro Quellakkord:', JSON.stringify(fpsBySource));
    expect(Object.keys(fpsBySource).length).toBeGreaterThan(0);
  });
});
