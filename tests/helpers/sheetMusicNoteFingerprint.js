import { join } from 'path';
import { readWavFile } from './wavDecoder.js';
import {
  classifyFrame,
  createMatchState,
  getRecommendedFftSize,
} from '../../js/shared/audio/fastNoteMatcher.js';
import {
  softenSheetMusicFrameResult,
  updateSheetMusicMatchState,
} from '../../js/games/sheetMusicReading/sheetMusicRecognition.js';

export const OPEN_STRING_NOTE_FIXTURES = [
  { pitch: 'E2', file: 'E2/e2.wav' },
  { pitch: 'A2', file: 'A2/a2-2.wav' },
  { pitch: 'D3', file: 'D3/d3.wav' },
  { pitch: 'G3', file: 'G3/g.wav' },
  { pitch: 'B3', file: 'B3/b.wav' },
  { pitch: 'E4', file: 'E4/e41.wav' },
];

const FIXTURES_DIR = join(process.cwd(), 'tests/fixtures/audio');

function safeDivide(num, den) {
  return den === 0 ? 0 : num / den;
}

function sliceCenterWindow(samples, windowSize) {
  if (samples.length <= windowSize) {
    const padded = new Float32Array(windowSize);
    padded.set(samples, 0);
    return padded;
  }
  const start = Math.floor((samples.length - windowSize) / 2);
  return samples.slice(start, start + windowSize);
}

function classifySheetMusicFixture(fixture, targetPitch) {
  const { samples, sampleRate } = readWavFile(join(FIXTURES_DIR, fixture.file));
  const windowSize = getRecommendedFftSize(targetPitch, sampleRate);
  const frameResult = classifyFrame(
    sliceCenterWindow(samples, windowSize),
    sampleRate,
    targetPitch,
    { tolerateCents: 70 },
  );
  const softened = softenSheetMusicFrameResult(frameResult, targetPitch);
  const { event } = updateSheetMusicMatchState(createMatchState(), softened);
  return { frameResult, softened, accepted: event === 'accept' };
}

export function evaluateOpenStringNoteFingerprint(fixtures = OPEN_STRING_NOTE_FIXTURES) {
  const cases = [];
  const counts = { tp: 0, tn: 0, fp: 0, fn: 0, total: 0, expectedPositive: 0, expectedNegative: 0 };

  for (const source of fixtures) {
    for (const target of fixtures) {
      const expectedPositive = source.pitch === target.pitch;
      const result = classifySheetMusicFixture(source, target.pitch);
      const actualPositive = result.accepted;
      const kind = expectedPositive && actualPositive ? 'TP'
        : expectedPositive && !actualPositive ? 'FN'
        : !expectedPositive && actualPositive ? 'FP'
        : 'TN';

      counts.total++;
      if (expectedPositive) counts.expectedPositive++;
      else counts.expectedNegative++;
      counts[kind.toLowerCase()]++;

      cases.push({
        kind,
        sourcePitch: source.pitch,
        sourceFile: source.file,
        targetPitch: target.pitch,
        actualPositive,
        expectedPositive,
        detectedPitch: result.frameResult.detectedPitch,
        frameStatus: result.frameResult.status,
        softenedStatus: result.softened.status,
        cents: result.frameResult.cents,
      });
    }
  }

  const metrics = {
    sensitivity: safeDivide(counts.tp, counts.tp + counts.fn),
    specificity: safeDivide(counts.tn, counts.tn + counts.fp),
    precision: safeDivide(counts.tp, counts.tp + counts.fp),
    accuracy: safeDivide(counts.tp + counts.tn, counts.total),
    f1: safeDivide(2 * counts.tp, (2 * counts.tp) + counts.fp + counts.fn),
    falsePositiveRate: safeDivide(counts.fp, counts.fp + counts.tn),
    falseNegativeRate: safeDivide(counts.fn, counts.fn + counts.tp),
  };

  return { fixtures, counts, metrics, cases };
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatCase(row) {
  const cents = Number.isFinite(row.cents) ? `${row.cents.toFixed(1)}c` : 'n/a';
  return `${row.kind} ${row.sourceFile} (${row.sourcePitch}) -> target ${row.targetPitch}; `
    + `detected=${row.detectedPitch ?? 'none'}, frame=${row.frameStatus}, softened=${row.softenedStatus}, cents=${cents}`;
}

export function formatOpenStringNoteFingerprintReport(report) {
  const { counts, metrics, cases } = report;
  const lines = [
    '# Sheet Music Note Fingerprint',
    '',
    `- fixtures: ${report.fixtures.length} open-string notes`,
    `- matrix: ${counts.total} probes (${counts.expectedPositive} expected positives, ${counts.expectedNegative} expected negatives)`,
    `- confusion: TP=${counts.tp} FP=${counts.fp} FN=${counts.fn} TN=${counts.tn}`,
    `- sensitivity/recall: ${formatPercent(metrics.sensitivity)}`,
    `- specificity: ${formatPercent(metrics.specificity)}`,
    `- precision: ${formatPercent(metrics.precision)}`,
    `- accuracy: ${formatPercent(metrics.accuracy)}`,
    `- f1: ${formatPercent(metrics.f1)}`,
    `- false positive rate: ${formatPercent(metrics.falsePositiveRate)}`,
    `- false negative rate: ${formatPercent(metrics.falseNegativeRate)}`,
    '',
    '## False Positives',
    ...cases.filter(row => row.kind === 'FP').map(formatCase),
    '',
    '## False Negatives',
    ...cases.filter(row => row.kind === 'FN').map(formatCase),
  ];

  return lines.join('\n');
}
