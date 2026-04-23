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
const STRICT_ACCURACY_THRESHOLD = 0.95;
const WAVE_BASED_FROZEN_FIXTURES = FROZEN_FIXTURES.filter(fixture =>
  fixture.expected.isCorrect &&
  !fixture.wavFile.includes('synth'),
);

const STRICT_MATRIX_CASES = WAVE_BASED_FROZEN_FIXTURES.flatMap(fixture => {
  const avgHpcp = averageHpcps(fixture.hpcpFrames.map(frame => Float32Array.from(frame)));

  return ALL_CHORD_NAMES.map(probeChordName => ({
    fixture,
    probeChordName,
    avgHpcp,
    expected: probeChordName === fixture.chordName,
  }));
});

function evaluateStrictMatrix() {
  return STRICT_MATRIX_CASES.map(testCase => {
    const result = matchHpcpToChord(testCase.avgHpcp, testCase.probeChordName, ALL_TEMPLATES);
    return {
      ...testCase,
      result,
      passed: result.isCorrect === testCase.expected,
    };
  });
}

describe('matchHpcpToChord – Frozen HPCP wave-fixture strict matrix', () => {
  it('erreicht eine ausreichende strikte Erkennungsquote über alle Wave-basierten Frozen-HPCP-Fixtures', () => {
    const rows = evaluateStrictMatrix();
    const correct = rows.filter(row => row.passed).length;
    const total = rows.length;
    const accuracy = correct / total;
    const percent = accuracy * 100;

    expect(
      accuracy,
      `Strict wave-fixture accuracy: ${correct}/${total} (${percent.toFixed(1)}%). ` +
      rows
        .filter(row => !row.passed)
        .slice(0, 30)
        .map(row =>
          `${row.fixture.wavFile}: target=${row.fixture.chordName}, probe=${row.probeChordName}, actual=${row.result.isCorrect}, bestMatch=${row.result.bestMatch}, confidence=${row.result.confidence.toFixed(3)}`,
        )
        .join(' | '),
    ).toBeGreaterThanOrEqual(STRICT_ACCURACY_THRESHOLD);
  });
});
