import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { readWavFile } from './wavDecoder.js';
import { discoverNoteAudioFixtures } from './noteAudioFixtures.js';
import {
  createMatchState,
} from '../../js/shared/audio/fastNoteMatcher.js';
import {
  getSheetMusicRecognitionStrategies,
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

function classifySheetMusicFixture(fixture, targetPitch, strategy) {
  const wavPath = join(FIXTURES_DIR, fixture.file);
  if (!wavCache.has(wavPath)) {
    wavCache.set(wavPath, readWavFile(wavPath));
  }
  const { samples, sampleRate } = wavCache.get(wavPath);
  const windowSize = strategy.getRecommendedFftSize(targetPitch, sampleRate);
  const frameResult = strategy.classifyFrame(
    sliceCenterWindow(samples, windowSize),
    sampleRate,
    targetPitch,
    { tolerateCents: 70 },
  );
  const { event } = updateSheetMusicMatchState(createMatchState(), frameResult);
  return { frameResult, accepted: event === 'accept' };
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

export function evaluateSingleNoteOnsetFixture(fixture) {
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

export function evaluateOpenStringNoteFingerprintForStrategy(fixtures, strategy, progress = null) {
  const cases = [];
  const counts = { tp: 0, tn: 0, fp: 0, fn: 0, total: 0, expectedPositive: 0, expectedNegative: 0 };
  const targetPitches = uniqueTargetPitches(fixtures);
  const totalPairs = fixtures.length * targetPitches.length;
  let processedPairs = 0;

  progress?.({
    phase: 'note-strategy-start',
    strategyKey: strategy.key,
    fixtureCount: fixtures.length,
    targetPitchCount: targetPitches.length,
    totalPairs,
  });

  for (const source of fixtures) {
    for (const targetPitch of targetPitches) {
      const expectedPositive = source.pitch === targetPitch;
      const result = classifySheetMusicFixture(source, targetPitch, strategy);
      const actualPositive = result.accepted;
      const kind = expectedPositive && actualPositive ? 'TP'
        : expectedPositive && !actualPositive ? 'FN'
        : !expectedPositive && actualPositive ? 'FP'
        : 'TN';

      counts.total++;
      if (expectedPositive) counts.expectedPositive++;
      else counts.expectedNegative++;
      counts[kind.toLowerCase()]++;
      processedPairs++;
      if (processedPairs === 1 || processedPairs % 50 === 0 || processedPairs === totalPairs) {
        progress?.({
          phase: 'note-strategy-progress',
          strategyKey: strategy.key,
          current: processedPairs,
          total: totalPairs,
          fixture: source.file,
          targetPitch,
        });
      }

      cases.push({
        kind,
        sourcePitch: source.pitch,
        sourceFile: source.file,
        targetPitch,
        actualPositive,
        expectedPositive,
        detectedPitch: result.frameResult.detectedPitch,
        frameStatus: result.frameResult.status,
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

  progress?.({
    phase: 'note-strategy-done',
    strategyKey: strategy.key,
    totalPairs,
  });
  return { strategy, targetPitches, counts, metrics, cases };
}

export function evaluateOpenStringNoteOnsetReport(fixtures = NOTE_AUDIO_FIXTURES, options = {}) {
  const progress = typeof options.onProgress === 'function' ? options.onProgress : null;
  progress?.({
    phase: 'note-onset-start',
    fixtureCount: fixtures.length,
  });
  const onsetCases = fixtures.map((fixture, index) => {
    if (index === 0 || (index + 1) % 10 === 0 || index === fixtures.length - 1) {
      progress?.({
        phase: 'note-onset-progress',
        current: index + 1,
        total: fixtures.length,
        fixture: fixture.file,
      });
    }
    return evaluateSingleNoteOnsetFixture(fixture);
  });
  progress?.({
    phase: 'note-onset-done',
    fixtureCount: fixtures.length,
  });
  const onsetCounts = {
    total: onsetCases.length,
    passed: onsetCases.filter(row => row.passed).length,
    failed: onsetCases.filter(row => !row.passed).length,
    missing: onsetCases.filter(row => row.missing).length,
  };
  return {
    onsetCases,
    onsetCounts,
  };
}

export function evaluateOpenStringNoteFingerprint(fixtures = NOTE_AUDIO_FIXTURES, options = {}) {
  const strategies = options.strategies ?? getSheetMusicRecognitionStrategies();
  const progress = typeof options.onProgress === 'function' ? options.onProgress : null;
  const strategyReports = strategies.map(strategy => (
    evaluateOpenStringNoteFingerprintForStrategy(fixtures, strategy, progress)
  ));
  const defaultReport = strategyReports[0];

  const onsetReport = evaluateOpenStringNoteOnsetReport(fixtures, options);

  return {
    fixtures,
    strategies,
    strategyReports,
    targetPitches: defaultReport.targetPitches,
    counts: defaultReport.counts,
    metrics: defaultReport.metrics,
    cases: defaultReport.cases,
    onsetCounts: onsetReport.onsetCounts,
    onsetCases: onsetReport.onsetCases,
  };
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatCase(row) {
  const cents = Number.isFinite(row.cents) ? `${row.cents.toFixed(1)}c` : 'n/a';
  return `| ${row.kind} | ${row.sourceFile} | ${row.sourcePitch} | ${row.targetPitch} | `
    + `${row.detectedPitch ?? 'none'} | ${row.frameStatus} | ${cents} |`;
}

function formatOnsetFailure(row) {
  const status = row.missing ? 'MISSING' : 'NO_ONSET';
  return `| ${status} | ${row.fixture.file} | ${row.fixture.pitch} |`;
}

export function formatOpenStringNoteFingerprintReport(report) {
  const { counts, metrics, cases, onsetCounts, onsetCases, strategyReports } = report;
  const strategyTable = strategyReports.map(row => (
    `| ${row.strategy.key} | ${row.counts.tp} | ${row.counts.fp} | ${row.counts.fn} | ${row.counts.tn} | `
      + `${formatPercent(row.metrics.sensitivity)} | ${formatPercent(row.metrics.specificity)} | `
      + `${formatPercent(row.metrics.precision)} | ${formatPercent(row.metrics.accuracy)} | `
      + `${formatPercent(row.metrics.f1)} |`
  ));
  const lines = [
    '# Sheet Music Note Fingerprint',
    '',
    `- fixtures: ${report.fixtures.length} note WAVs`,
    `- target pitches: ${report.targetPitches.length} (${report.targetPitches.join(', ')})`,
    `- strategies: ${report.strategies.map(strategy => strategy.key).join(', ')}`,
    '',
    '## Strategy Summary',
    '| strategy | TP | FP | FN | TN | recall | specificity | precision | accuracy | f1 |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...strategyTable,
    '',
    '## Default Strategy Detail',
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
    '| kind | source file | source pitch | target pitch | detected | frame | cents |',
    '|---|---|---:|---:|---:|---|---:|',
    ...cases.filter(row => row.kind === 'FP').map(formatCase),
    '',
    '## False Negatives',
    '| kind | source file | source pitch | target pitch | detected | frame | cents |',
    '|---|---|---:|---:|---:|---|---:|',
    ...cases.filter(row => row.kind === 'FN').map(formatCase),
    '',
    '## Single-Note Onset Goldens',
    `- fixtures: ${onsetCounts.total}`,
    `- passed: ${onsetCounts.passed}`,
    `- failed: ${onsetCounts.failed}`,
    `- missing goldens: ${onsetCounts.missing}`,
    '',
    '## Onset Failures',
    '| status | fixture | pitch |',
    '|---|---|---:|',
    ...onsetCases
      .filter(row => !row.passed)
      .map(formatOnsetFailure),
  ];

  return lines.join('\n');
}
