import { averageHpcps, buildChordTemplates, matchHpcpToChord } from '../../js/games/chordExerciseEssentia/essentiaChordLogic.js';
import { extractBassSupportMapFromWav } from './chordBassExtraction.js';

function toAverageHpcp(fixture) {
  return averageHpcps(fixture.hpcpFrames.map(frame => Float32Array.from(frame)));
}

function safeDivide(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

export function evaluateChordRecognitionConfusion(frozenFixtures) {
  const templates = buildChordTemplates();
  const chordNames = Object.keys(templates);
  const positiveFixtures = frozenFixtures.filter(fixture =>
    fixture.expected.isCorrect &&
    !fixture.wavFile.includes('synth'),
  );
  const explicitNegativeFixtures = frozenFixtures.filter(fixture => !fixture.expected.isCorrect);

  const rows = [];

  for (const fixture of positiveFixtures) {
    const avgHpcp = toAverageHpcp(fixture);
    const bassSupportByChord = extractBassSupportMapFromWav(fixture.wavFile, chordNames);

    for (const probeChordName of chordNames) {
      const result = matchHpcpToChord(avgHpcp, probeChordName, templates, undefined, { bassSupportByChord });
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

  for (const fixture of explicitNegativeFixtures) {
    const avgHpcp = toAverageHpcp(fixture);
    const bassSupportByChord = fixture.wavFile.includes('/')
      ? extractBassSupportMapFromWav(fixture.wavFile, chordNames)
      : null;
    const result = matchHpcpToChord(avgHpcp, fixture.chordName, templates, undefined, { bassSupportByChord });

    rows.push({
      kind: 'explicit-negative',
      fixture,
      probeChordName: fixture.chordName,
      expectedPositive: false,
      actualPositive: result.isCorrect,
      bestMatch: result.bestMatch,
      confidence: result.confidence,
    });
  }

  const truePositives = rows.filter(row => row.expectedPositive && row.actualPositive);
  const falseNegatives = rows.filter(row => row.expectedPositive && !row.actualPositive);
  const falsePositives = rows.filter(row => !row.expectedPositive && row.actualPositive);
  const trueNegatives = rows.filter(row => !row.expectedPositive && !row.actualPositive);

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

function summarizeRow(row) {
  return `${row.fixture.wavFile}: target=${row.fixture.chordName}, probe=${row.probeChordName}, actual=${row.actualPositive}, bestMatch=${row.bestMatch}, confidence=${row.confidence.toFixed(3)}`;
}

export function formatChordRecognitionMetricsReport(report, maxExamples = 20) {
  const { counts, metrics, cases } = report;

  const lines = [
    'Chord recognition confusion matrix',
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
