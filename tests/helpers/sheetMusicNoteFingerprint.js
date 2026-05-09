import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { readWavFile } from './wavDecoder.js';
import { discoverNoteAudioFixtures } from './noteAudioFixtures.js';
import {
  classifyFrame,
  createMatchState,
  getRecommendedFftSize,
} from '../../js/shared/audio/fastNoteMatcher.js';
import {
  softenSheetMusicFrameResult,
  updateSheetMusicMatchState,
} from '../../js/games/sheetMusicReading/sheetMusicRecognition.js';
import {
  createGuitarOnsetState,
  updateGuitarOnsetDetector,
} from '../../js/shared/audio/guitarOnsetDetector.js';

const FIXTURES_DIR = join(process.cwd(), 'tests/fixtures/audio');
const ANALYSER_GOLDENS_DIR = join(process.cwd(), 'tests/fixtures/analyser-goldens/notes');
const wavCache = new Map();

export const NOTE_AUDIO_FIXTURES = discoverNoteAudioFixtures();
export const OPEN_STRING_NOTE_FIXTURES = NOTE_AUDIO_FIXTURES.filter(fixture => (
  ['E2/e2.wav', 'A2/a2-2.wav', 'D3/d3.wav', 'G3/g.wav', 'B3/b.wav', 'E4/e41.wav'].includes(fixture.file)
));

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
  const wavPath = join(FIXTURES_DIR, fixture.file);
  if (!wavCache.has(wavPath)) {
    wavCache.set(wavPath, readWavFile(wavPath));
  }
  const { samples, sampleRate } = wavCache.get(wavPath);
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

function uniqueTargetPitches(fixtures) {
  return Array.from(new Set(fixtures.map(fixture => fixture.pitch))).sort((a, b) => a.localeCompare(b));
}

function loadAnalyserGolden(fixture) {
  const goldenPath = join(ANALYSER_GOLDENS_DIR, fixture.goldenFile);
  if (!existsSync(goldenPath)) {
    return { missing: true, goldenPath };
  }
  return JSON.parse(readFileSync(goldenPath, 'utf8'));
}

function evaluateSingleNoteOnsetFixture(fixture) {
  const golden = loadAnalyserGolden(fixture);
  if (golden.missing) {
    return {
      fixture,
      missing: true,
      passed: false,
      onsetCount: 0,
      firstOnsetFrame: null,
      firstOnsetMs: null,
    };
  }

  let state = createGuitarOnsetState();
  let onsetCount = 0;
  let firstOnsetFrame = null;
  let firstOnsetMs = null;

  for (const frame of golden.frames ?? []) {
    const result = updateGuitarOnsetDetector(state, {
      rms: frame.rms,
      frequencyData: Float32Array.from(frame.frequencyDb),
    });
    state = result.nextState;
    if (result.event === 'onset') {
      onsetCount++;
      if (firstOnsetFrame === null) {
        firstOnsetFrame = frame.index;
        firstOnsetMs = frame.timeMs;
      }
    }
  }

  return {
    fixture,
    missing: false,
    passed: onsetCount >= 1,
    onsetCount,
    firstOnsetFrame,
    firstOnsetMs,
    frameCount: golden.frames?.length ?? 0,
    sampleRate: golden.capture?.sampleRate ?? null,
    fftSize: golden.capture?.fftSize ?? null,
  };
}

export function evaluateOpenStringNoteFingerprint(fixtures = NOTE_AUDIO_FIXTURES) {
  const cases = [];
  const counts = { tp: 0, tn: 0, fp: 0, fn: 0, total: 0, expectedPositive: 0, expectedNegative: 0 };
  const targetPitches = uniqueTargetPitches(fixtures);

  for (const source of fixtures) {
    for (const targetPitch of targetPitches) {
      const expectedPositive = source.pitch === targetPitch;
      const result = classifySheetMusicFixture(source, targetPitch);
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
        targetPitch,
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

  const onsetCases = fixtures.map(evaluateSingleNoteOnsetFixture);
  const onsetCounts = {
    total: onsetCases.length,
    passed: onsetCases.filter(row => row.passed).length,
    failed: onsetCases.filter(row => !row.passed).length,
    missing: onsetCases.filter(row => row.missing).length,
  };

  return { fixtures, targetPitches, counts, metrics, cases, onsetCounts, onsetCases };
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
  const { counts, metrics, cases, onsetCounts, onsetCases } = report;
  const lines = [
    '# Sheet Music Note Fingerprint',
    '',
    `- fixtures: ${report.fixtures.length} note WAVs`,
    `- target pitches: ${report.targetPitches.length} (${report.targetPitches.join(', ')})`,
    `- pitch matrix: ${counts.total} probes (${counts.expectedPositive} expected positives, ${counts.expectedNegative} expected negatives)`,
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
    '',
    '## Single-Note Onset Goldens',
    `- fixtures: ${onsetCounts.total}`,
    `- passed: ${onsetCounts.passed}`,
    `- failed: ${onsetCounts.failed}`,
    `- missing goldens: ${onsetCounts.missing}`,
    '',
    '## Onset Failures',
    ...onsetCases
      .filter(row => !row.passed)
      .map(row => `${row.missing ? 'MISSING' : 'NO_ONSET'} ${row.fixture.file} (${row.fixture.pitch})`),
  ];

  return lines.join('\n');
}
