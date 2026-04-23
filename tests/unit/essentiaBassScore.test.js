import { describe, it, expect } from 'vitest';
import { CHORD_HPCP_FIXTURE_CASES } from '../helpers/chordHpcpFixtureCatalog.js';
import { extractBassScoreForChordFromWav } from '../helpers/chordBassExtraction.js';

function formatBassScores(result) {
  return [
    `${result.lowerNeighbor.label}:${result.lowerNeighbor.score.toFixed(3)}`,
    `${result.expected.label}:${result.expected.score.toFixed(3)}`,
    `${result.upperNeighbor.label}:${result.upperNeighbor.score.toFixed(3)}`,
  ].join(', ');
}

describe('Bass score for chord fixtures', () => {
  const positiveWaveFixtures = CHORD_HPCP_FIXTURE_CASES.filter(fixture =>
    fixture.expected.isCorrect &&
    !fixture.wavFile.includes('synth'),
  );

  it.each(positiveWaveFixtures)('trennt den erwarteten Basston lokal eindeutig für $wavFile', ({ chordName, wavFile }) => {
    const bassScore = extractBassScoreForChordFromWav(wavFile, chordName);
    expect(bassScore, `${wavFile}: kein Bass-Score erzeugt`).toBeDefined();

    expect(
      bassScore.expected.score,
      `${wavFile}: bass neighborhood=${formatBassScores(bassScore)}`,
    ).toBeGreaterThan(bassScore.lowerNeighbor.score);
    expect(
      bassScore.expected.score,
      `${wavFile}: bass neighborhood=${formatBassScores(bassScore)}`,
    ).toBeGreaterThan(bassScore.upperNeighbor.score);
  });
});
