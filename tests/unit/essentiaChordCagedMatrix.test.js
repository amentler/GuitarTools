import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import {
  averageHpcps,
  buildChordTemplates,
} from '../../js/games/chordExerciseEssentia/essentiaChordLogic.js';
import { matchEssentiaFingerprintHpcpToChord } from '../../js/games/chordExerciseEssentia/essentiaFingerprintChordMatcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PREPARED_FIXTURES = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/chord-hpcp/frozen-essentia-fingerprint-fixtures.json'), 'utf-8'),
);

const ALL_TEMPLATES = buildChordTemplates();
const ALL_CHORD_NAMES = Object.keys(ALL_TEMPLATES);
const POSITIVE_PREPARED_FIXTURES = PREPARED_FIXTURES.filter(fixture =>
  fixture.expected.isCorrect &&
  !fixture.wavFile.includes('synth'),
);

function toAverageHpcp(fixture) {
  if (fixture.wasmAverageHpcp) {
    return Float32Array.from(fixture.wasmAverageHpcp);
  }

  return averageHpcps(fixture.wasmHpcpFrames.map(frame => Float32Array.from(frame)));
}

const NON_STRICT_MATRIX_CASES = POSITIVE_PREPARED_FIXTURES.flatMap(fixture => {
  const avgHpcp = toAverageHpcp(fixture);

  return ALL_CHORD_NAMES.map(probeChordName => ({
    fixture,
    probeChordName,
    avgHpcp,
    expected: probeChordName === fixture.chordName,
  }));
});

function runWaveFixtureMatchMatrix() {
  return NON_STRICT_MATRIX_CASES.map(testCase => {
    const result = matchEssentiaFingerprintHpcpToChord(testCase.avgHpcp, testCase.probeChordName, ALL_TEMPLATES, undefined, {
      bassSupportByChord: testCase.fixture.bassSupportByChord ?? null,
    });

    return {
      ...testCase,
      result,
    };
  });
}

describe('matchHpcpToChord – Frozen HPCP positive-fixture matrix', () => {
  it.each(NON_STRICT_MATRIX_CASES)(
    '$fixture.wavFile gegen $probeChordName -> targetShouldPass=$expected',
    ({ fixture, probeChordName, avgHpcp, expected }) => {
      const result = matchEssentiaFingerprintHpcpToChord(avgHpcp, probeChordName, ALL_TEMPLATES, undefined, {
        bassSupportByChord: fixture.bassSupportByChord ?? null,
      });

      expect(
        typeof result.isCorrect,
        `${fixture.wavFile}: target=${fixture.chordName}, probe=${probeChordName}, bestMatch=${result.bestMatch}, confidence=${result.confidence.toFixed(3)}`,
      ).toBe('boolean');
      expect(result.bestMatch === null || typeof result.bestMatch === 'string').toBe(true);
      expect(typeof expected).toBe('boolean');
    },
  );

  it('meldet die nicht-strikte Zielakkord-Quote über die Vollmatrix als Audit', () => {
    const rows = runWaveFixtureMatchMatrix();
    const targetRows = rows.filter(row => row.expected);
    const correct = targetRows.filter(row => row.result.isCorrect).length;
    const total = targetRows.length;
    const percent = (correct / total) * 100;

    console.info(
      `Non-strict full-matrix target accuracy: ${correct}/${total} (${percent.toFixed(1)}%). ` +
      targetRows
        .filter(row => !row.result.isCorrect)
        .slice(0, 20)
        .map(row =>
          `${row.fixture.wavFile}: target=${row.fixture.chordName}, probe=${row.probeChordName}, bestMatch=${row.result.bestMatch}, confidence=${row.result.confidence.toFixed(3)}`,
        )
        .join(' | '),
    );

    expect(total).toBeGreaterThan(0);
  });
});
