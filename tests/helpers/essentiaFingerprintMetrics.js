import {
  averageHpcps,
  buildChordTemplates,
} from '../../js/games/chordExerciseEssentia/essentiaChordLogic.js';
import { matchEssentiaFingerprintHpcpToChord } from '../../js/games/chordExerciseEssentia/essentiaFingerprintChordMatcher.js';

function toAverageHpcp(fixture) {
  if (fixture.wasmAverageHpcp) {
    return Float32Array.from(fixture.wasmAverageHpcp);
  }

  return averageHpcps(fixture.wasmHpcpFrames.map(frame => Float32Array.from(frame)));
}

function safeDivide(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function summarizeRow(row) {
  return `${row.fixture.wavFile}: target=${row.fixture.chordName}, probe=${row.probeChordName}, actual=${row.actualPositive}, bestMatch=${row.bestMatch}, confidence=${row.confidence.toFixed(3)}`;
}

export function evaluateEssentiaFingerprintConfusion(preparedFixtures, options = {}) {
  const progress = typeof options.onProgress === 'function' ? options.onProgress : null;
  const templates = buildChordTemplates();
  const chordNames = Object.keys(templates);
  const positiveFixtures = preparedFixtures.filter(fixture =>
    fixture.expected.isCorrect &&
    !fixture.wavFile.includes('synth'),
  );
  const explicitNegativeFixtures = preparedFixtures.filter(fixture => !fixture.expected.isCorrect);
  const exhaustiveNegativeFixturePattern = /^open-strums\/\d_strum(?:_alt\d*)?\.wav$/;

  const rows = [];
  progress?.({
    phase: 'fingerprint-start',
    positiveFixtureCount: positiveFixtures.length,
    negativeFixtureCount: explicitNegativeFixtures.length,
    chordCount: chordNames.length,
  });

  for (const [fixtureIndex, fixture] of positiveFixtures.entries()) {
    progress?.({
      phase: 'fingerprint-positive-progress',
      current: fixtureIndex + 1,
      total: positiveFixtures.length,
      fixture: fixture.wavFile,
    });
    const avgHpcp = toAverageHpcp(fixture);
    const bassSupportByChord = fixture.bassSupportByChord ?? null;

    for (const probeChordName of chordNames) {
      const result = matchEssentiaFingerprintHpcpToChord(avgHpcp, probeChordName, templates, undefined, {
        bassSupportByChord,
      });
      const expectedPositive = probeChordName === fixture.chordName;

      rows.push({
        kind: 'matrix',
        fixture,
        probeChordName,
        expectedPositive,
        actualPositive: result.isCorrect,
        bestMatch: result.bestMatch,
        confidence: result.confidence,
      });
    }
  }

  for (const [fixtureIndex, fixture] of explicitNegativeFixtures.entries()) {
    progress?.({
      phase: 'fingerprint-negative-progress',
      current: fixtureIndex + 1,
      total: explicitNegativeFixtures.length,
      fixture: fixture.wavFile,
    });
    const avgHpcp = toAverageHpcp(fixture);
    const bassSupportByChord = fixture.bassSupportByChord ?? null;
    const probeChordNames = exhaustiveNegativeFixturePattern.test(fixture.wavFile)
      ? chordNames
      : [fixture.chordName];

    for (const probeChordName of probeChordNames) {
      const result = matchEssentiaFingerprintHpcpToChord(avgHpcp, probeChordName, templates, undefined, {
        bassSupportByChord,
      });

      rows.push({
        kind: probeChordNames.length === 1 ? 'explicit-negative' : 'explicit-negative-matrix',
        fixture,
        probeChordName,
        expectedPositive: false,
        actualPositive: result.isCorrect,
        bestMatch: result.bestMatch,
        confidence: result.confidence,
      });
    }
  }

  const truePositives = rows.filter(row => row.expectedPositive && row.actualPositive);
  const falseNegatives = rows.filter(row => row.expectedPositive && !row.actualPositive);
  const falsePositives = rows.filter(row => !row.expectedPositive && row.actualPositive);
  const trueNegatives = rows.filter(row => !row.expectedPositive && !row.actualPositive);
  progress?.({
    phase: 'fingerprint-done',
    rowCount: rows.length,
  });

  const sensitivity = safeDivide(truePositives.length, truePositives.length + falseNegatives.length);
  const specificity = safeDivide(trueNegatives.length, trueNegatives.length + falsePositives.length);
  const precision = safeDivide(truePositives.length, truePositives.length + falsePositives.length);
  const negativePredictiveValue = safeDivide(trueNegatives.length, trueNegatives.length + falseNegatives.length);
  const accuracy = safeDivide(truePositives.length + trueNegatives.length, rows.length);
  const falsePositiveRate = safeDivide(falsePositives.length, falsePositives.length + trueNegatives.length);
  const falseNegativeRate = safeDivide(falseNegatives.length, falseNegatives.length + truePositives.length);
  const f1 = safeDivide(2 * precision * sensitivity, precision + sensitivity);

  return {
    rows,
    counts: {
      total: rows.length,
      tp: truePositives.length,
      fp: falsePositives.length,
      fn: falseNegatives.length,
      tn: trueNegatives.length,
      positiveFixtures: positiveFixtures.length,
      explicitNegativeFixtures: explicitNegativeFixtures.length,
      chordCount: chordNames.length,
    },
    metrics: {
      sensitivity,
      specificity,
      precision,
      negativePredictiveValue,
      accuracy,
      falsePositiveRate,
      falseNegativeRate,
      f1,
    },
    cases: {
      truePositives,
      falsePositives,
      falseNegatives,
      trueNegatives,
    },
  };
}

export function formatEssentiaFingerprintReport(report, maxExamples = 20) {
  const { counts, metrics, cases } = report;

  const lines = [
    'Essentia chord recognition confusion matrix',
    `- samples: total=${counts.total}, chords=${counts.chordCount}, positiveFixtures=${counts.positiveFixtures}, explicitNegativeFixtures=${counts.explicitNegativeFixtures}`,
    `- confusion: TP=${counts.tp}, FP=${counts.fp}, FN=${counts.fn}, TN=${counts.tn}`,
    `- sensitivity: ${formatPercent(metrics.sensitivity)}`,
    `- specificity: ${formatPercent(metrics.specificity)}`,
    `- precision: ${formatPercent(metrics.precision)}`,
    `- negative predictive value: ${formatPercent(metrics.negativePredictiveValue)}`,
    `- accuracy: ${formatPercent(metrics.accuracy)}`,
    `- false positive rate: ${formatPercent(metrics.falsePositiveRate)}`,
    `- false negative rate: ${formatPercent(metrics.falseNegativeRate)}`,
    `- F1: ${formatPercent(metrics.f1)}`,
  ];

  for (const [label, rows] of [
    ['false positives', cases.falsePositives],
    ['false negatives', cases.falseNegatives],
    ['true positives', cases.truePositives],
    ['true negatives', cases.trueNegatives],
  ]) {
    lines.push(`- ${label}: ${rows.length}`);
    for (const row of rows.slice(0, maxExamples)) {
      lines.push(`  - ${summarizeRow(row)}`);
    }
    if (rows.length > maxExamples) {
      lines.push(`  - ... ${rows.length - maxExamples} weitere`);
    }
  }

  return lines.join('\n');
}
