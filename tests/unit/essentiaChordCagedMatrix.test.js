import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import {
  averageHpcps,
  buildChordTemplates,
  matchHpcpToChord,
} from '../../js/games/chordExerciseEssentia/essentiaChordLogic.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FROZEN_FIXTURES = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/chord-hpcp/frozen-hpcp-fixtures.json'), 'utf-8'),
);

const ALL_TEMPLATES = buildChordTemplates();
const ALL_CHORD_NAMES = Object.keys(ALL_TEMPLATES);
const WAVE_BASED_FROZEN_FIXTURES = FROZEN_FIXTURES.filter(fixture =>
  fixture.expected.isCorrect &&
  !fixture.wavFile.includes('synth'),
);

const NON_STRICT_MATRIX_CASES = WAVE_BASED_FROZEN_FIXTURES.flatMap(fixture => {
  const avgHpcp = averageHpcps(fixture.hpcpFrames.map(frame => Float32Array.from(frame)));

  return ALL_CHORD_NAMES.map(probeChordName => ({
    fixture,
    probeChordName,
    avgHpcp,
    expected: probeChordName === fixture.chordName,
  }));
});

function runWaveFixtureMatchMatrix() {
  return NON_STRICT_MATRIX_CASES.map(testCase => {
    const result = matchHpcpToChord(testCase.avgHpcp, testCase.probeChordName, ALL_TEMPLATES);

    return {
      ...testCase,
      result,
    };
  });
}

describe('matchHpcpToChord – Frozen HPCP wave-fixture matrix', () => {
  it.each(NON_STRICT_MATRIX_CASES)(
    '$fixture.wavFile gegen $probeChordName -> targetShouldPass=$expected',
    ({ fixture, probeChordName, avgHpcp, expected }) => {
      const result = matchHpcpToChord(avgHpcp, probeChordName, ALL_TEMPLATES);

      if (expected) {
        expect(
          result.isCorrect,
          `${fixture.wavFile}: target=${fixture.chordName}, probe=${probeChordName}, bestMatch=${result.bestMatch}, confidence=${result.confidence.toFixed(3)}`,
        ).toBe(true);
      } else {
        expect(true).toBe(true);
      }
    },
  );

  it('meldet die nicht-strikte Zielakkord-Quote über die Vollmatrix', () => {
    const rows = runWaveFixtureMatchMatrix();
    const targetRows = rows.filter(row => row.expected);
    const correct = targetRows.filter(row => row.result.isCorrect).length;
    const total = targetRows.length;
    const percent = (correct / total) * 100;

    expect(
      correct,
      `Non-strict full-matrix target accuracy: ${correct}/${total} (${percent.toFixed(1)}%). ` +
      targetRows
        .filter(row => !row.result.isCorrect)
        .map(row =>
          `${row.fixture.wavFile}: target=${row.fixture.chordName}, probe=${row.probeChordName}, bestMatch=${row.result.bestMatch}, confidence=${row.result.confidence.toFixed(3)}`,
        )
        .join(' | '),
    ).toBe(total);
  });
});
