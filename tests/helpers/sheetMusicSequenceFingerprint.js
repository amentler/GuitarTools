import { existsSync, readdirSync, readFileSync } from 'fs';
import { basename, dirname, join, relative } from 'path';
import { readWavFile } from './wavDecoder.js';
import {
  createMatchState,
} from '../../js/shared/audio/fastNoteMatcher.js';
import {
  getSheetMusicRecognitionStrategies,
  updateSheetMusicMatchState,
} from '../../js/games/sheetMusicReading/sheetMusicRecognition.js';

const SEQUENCES_DIR = join(process.cwd(), 'tests/fixtures/sequences');
export const SHEET_FINGERPRINT_ANALYZE_INTERVAL_MS = 50;
export const SHEET_FINGERPRINT_POSITIVE_FIXTURE_FILES = [
  'open-strings/eeeeaaaaddddgggg.wav',
  'open-strings/medium.wav',
  'open-strings/slow.wav',
  'sheet-music-reading/4-4_40bpm_EGADB_9low6.wav',
];

// Manifest tempo fields are recording metadata only. Real takes can be slower,
// faster, or unsteady, so fingerprint assertions must not depend on declared
// bpm/tempoBpm or derive exact note timing from it.

function safeDivide(num, den) {
  return den === 0 ? 0 : num / den;
}

function collectWavFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectWavFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.wav')) {
      files.push(fullPath);
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function readSequenceManifest(wavPath) {
  const jsonPath = join(dirname(wavPath), `${basename(wavPath, '.wav')}.json`);
  if (!existsSync(jsonPath)) return null;
  const manifest = JSON.parse(readFileSync(jsonPath, 'utf8'));
  if (!Array.isArray(manifest.notes) || manifest.notes.length === 0) {
    throw new Error(`Invalid sequence manifest without notes: ${jsonPath}`);
  }
  return { ...manifest, jsonPath };
}

export function discoverSheetMusicSequenceFixtures() {
  return collectWavFiles(SEQUENCES_DIR).map(wavPath => {
    const manifest = readSequenceManifest(wavPath);
    return {
      file: relative(SEQUENCES_DIR, wavPath),
      wavPath,
      manifest,
      expectedNotes: manifest?.notes ?? [],
    };
  });
}

function normalizeFrameForSheetMusicReading(frameResult) {
  return frameResult.status === 'wrong'
    ? { ...frameResult, status: 'unsure' }
    : frameResult;
}

export function runSheetMusicSequenceSimulation(samples, sampleRate, targetSequence, options = {}) {
  const strategy = options.strategy ?? getSheetMusicRecognitionStrategies()[0];
  const acceptedSequence = [];
  const acceptTimestamps = [];
  const frames = [];
  let targetIndex = 0;
  let matchState = createMatchState();

  if (targetSequence.length === 0) {
    return { acceptedSequence, acceptTimestamps, frames, finalTargetIndex: 0, framesProcessed: 0 };
  }

  let currentTarget = targetSequence[targetIndex];
  let fftSize = strategy.getRecommendedFftSize(currentTarget, sampleRate);
  const hopSize = options.hopSize ?? Math.max(1, Math.round(
    sampleRate * ((options.analyzeIntervalMs ?? SHEET_FINGERPRINT_ANALYZE_INTERVAL_MS) / 1000),
  ));
  let offset = 0;

  while (offset + fftSize <= samples.length && targetIndex < targetSequence.length) {
    const window = samples.subarray(offset, offset + fftSize);
    const raw = strategy.classifyFrame(window, sampleRate, currentTarget);
    const effective = normalizeFrameForSheetMusicReading(raw);
    const { nextState, event } = updateSheetMusicMatchState(matchState, effective);
    matchState = nextState;

    frames.push({
      index: frames.length,
      timeMs: Math.round((offset / sampleRate) * 1000),
      targetPitch: currentTarget,
      rawStatus: raw.status,
      effectiveStatus: effective.status,
      detectedPitch: raw.detectedPitch,
      hz: Number.isFinite(raw.hz) ? Math.round(raw.hz * 100) / 100 : null,
      cents: Number.isFinite(raw.cents) ? Math.round(raw.cents * 10) / 10 : null,
      event,
    });

    if (event === 'accept') {
      acceptedSequence.push(currentTarget);
      acceptTimestamps.push(offset / sampleRate);
      targetIndex++;
      matchState = createMatchState();
      if (targetIndex < targetSequence.length) {
        currentTarget = targetSequence[targetIndex];
        fftSize = strategy.getRecommendedFftSize(currentTarget, sampleRate);
      }
    }

    offset += hopSize;
  }

  return {
    acceptedSequence,
    acceptTimestamps,
    frames,
    finalTargetIndex: targetIndex,
    framesProcessed: frames.length,
  };
}

function evaluateFixture(fixture, options = {}) {
  if (fixture.expectedNotes.length === 0) {
    return {
      fixture,
      skipped: true,
      passed: false,
      reason: 'missing manifest',
      expectedNotes: [],
      acceptedSequence: [],
      acceptedCount: 0,
      expectedCount: 0,
      sampleRate: null,
      durationSec: null,
      framesProcessed: 0,
    };
  }

  const { samples, sampleRate } = readWavFile(fixture.wavPath);
  const result = runSheetMusicSequenceSimulation(samples, sampleRate, fixture.expectedNotes, options);
  return {
    fixture,
    skipped: false,
    passed: result.finalTargetIndex === fixture.expectedNotes.length,
    reason: result.finalTargetIndex === fixture.expectedNotes.length ? null : 'not fully recognized',
    expectedNotes: fixture.expectedNotes,
    acceptedSequence: result.acceptedSequence,
    acceptedCount: result.acceptedSequence.length,
    expectedCount: fixture.expectedNotes.length,
    sampleRate,
    durationSec: samples.length / sampleRate,
    framesProcessed: result.framesProcessed,
    acceptTimestamps: result.acceptTimestamps,
    frames: options.includeFrames ? result.frames : undefined,
  };
}

function summarizeSequenceCases(fixtures, cases, strategy) {
  const evaluated = cases.filter(row => !row.skipped);
  const passed = evaluated.filter(row => row.passed);
  const failed = evaluated.filter(row => !row.passed);
  const skipped = cases.filter(row => row.skipped);
  const expectedNotes = evaluated.reduce((sum, row) => sum + row.expectedCount, 0);
  const acceptedNotes = evaluated.reduce((sum, row) => sum + row.acceptedCount, 0);

  return {
    strategy,
    fixtures,
    cases,
    counts: {
      total: cases.length,
      evaluated: evaluated.length,
      passed: passed.length,
      failed: failed.length,
      skipped: skipped.length,
      expectedNotes,
      acceptedNotes,
    },
    metrics: {
      fixturePassRate: safeDivide(passed.length, evaluated.length),
      noteRecall: safeDivide(acceptedNotes, expectedNotes),
    },
  };
}

export function evaluateSheetMusicSequenceFingerprint(fixtures = discoverSheetMusicSequenceFixtures(), options = {}) {
  const strategies = options.strategies ?? getSheetMusicRecognitionStrategies();
  const strategyReports = strategies.map(strategy => {
    const cases = fixtures.map(fixture => evaluateFixture(fixture, { ...options, strategy }));
    return summarizeSequenceCases(fixtures, cases, strategy);
  });
  const defaultReport = strategyReports[0];

  return {
    ...defaultReport,
    strategies,
    strategyReports,
  };
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatCase(row) {
  const accepted = row.acceptedSequence.join(' ');
  const expected = row.expectedNotes.join(' ');
  return `- ${row.fixture.file}: accepted ${row.acceptedCount}/${row.expectedCount}`
    + `; expected=[${expected}]; accepted=[${accepted}]`;
}

export function formatSheetMusicSequenceFingerprintReport(report) {
  const { counts, metrics, cases, strategyReports } = report;
  const strategyTable = strategyReports.map(row => (
    `| ${row.strategy.key} | ${row.counts.evaluated} | ${row.counts.passed} | ${row.counts.failed} | `
      + `${row.counts.acceptedNotes}/${row.counts.expectedNotes} | `
      + `${formatPercent(row.metrics.fixturePassRate)} | ${formatPercent(row.metrics.noteRecall)} |`
  ));
  return [
    '# Sheet Music Sequence Fingerprint',
    '',
    `- fixtures: ${counts.total} sequence WAVs`,
    `- strategies: ${report.strategies.map(strategy => strategy.key).join(', ')}`,
    '',
    '## Strategy Summary',
    '| strategy | evaluated | passed | failed | notes | fixture pass rate | note recall |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...strategyTable,
    '',
    '## Default Strategy Detail',
    `- evaluated: ${counts.evaluated}`,
    `- skipped: ${counts.skipped}`,
    `- passed: ${counts.passed}`,
    `- failed: ${counts.failed}`,
    `- expected notes: ${counts.expectedNotes}`,
    `- accepted notes: ${counts.acceptedNotes}`,
    `- fixture pass rate: ${formatPercent(metrics.fixturePassRate)}`,
    `- note recall: ${formatPercent(metrics.noteRecall)}`,
    `- frame cadence: ${SHEET_FINGERPRINT_ANALYZE_INTERVAL_MS}ms`,
    '',
    '## Failures',
    ...cases.filter(row => !row.skipped && !row.passed).map(formatCase),
    '',
    '## Skipped',
    ...cases.filter(row => row.skipped).map(row => `- ${row.fixture.file}: ${row.reason}`),
  ].join('\n');
}
