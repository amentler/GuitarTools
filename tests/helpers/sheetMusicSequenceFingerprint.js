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
import {
  createOnsetGateState,
  updateOnsetGate,
} from '../../js/shared/audio/noteOnsetGate.js';

const SEQUENCES_DIR = join(process.cwd(), 'tests/fixtures/sequences');
export const SHEET_FINGERPRINT_ANALYZE_INTERVAL_MS = 50;
export const SHEET_FINGERPRINT_ONSET_FRAME_SIZE = 2048;
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

function formatMs(value) {
  return Number.isFinite(value) ? `${Math.round(value)}ms` : '-';
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

function countRmsOnsets(samples, sampleRate, options = {}) {
  const frameSize = options.onsetFrameSize ?? SHEET_FINGERPRINT_ONSET_FRAME_SIZE;
  const hopSize = options.onsetHopSize ?? Math.max(1, Math.round(
    sampleRate * ((options.analyzeIntervalMs ?? SHEET_FINGERPRINT_ANALYZE_INTERVAL_MS) / 1000),
  ));
  const timestampsMs = [];
  let onsetGateState = createOnsetGateState();

  for (let offset = 0; offset + frameSize <= samples.length; offset += hopSize) {
    const result = updateOnsetGate(
      onsetGateState,
      samples.subarray(offset, offset + frameSize),
      options.onsetGateOptions,
    );
    onsetGateState = result.nextState;
    if (result.event === 'onset') {
      timestampsMs.push(Math.round((offset / sampleRate) * 1000));
    }
  }

  return {
    count: timestampsMs.length,
    timestampsMs,
    frameSize,
    hopSize,
  };
}

function buildOnsetAcceptAlignment(fixture, onsetTimestampsMs, result) {
  return fixture.expectedNotes.map((expectedNote, index) => {
    const onsetTimeMs = onsetTimestampsMs[index] ?? null;
    const acceptTimeMs = Number.isFinite(result.acceptTimestamps[index])
      ? Math.round(result.acceptTimestamps[index] * 1000)
      : null;
    const acceptedNote = result.acceptedSequence[index] ?? null;
    const delayMs = Number.isFinite(onsetTimeMs) && Number.isFinite(acceptTimeMs)
      ? acceptTimeMs - onsetTimeMs
      : null;
    const status = !Number.isFinite(onsetTimeMs) ? 'missing-onset'
      : !Number.isFinite(acceptTimeMs) ? 'missing-accept'
      : acceptedNote !== expectedNote ? 'mismatch'
      : 'aligned';

    return {
      fixture: fixture.file,
      index: index + 1,
      expectedNote,
      onsetTimeMs,
      acceptTimeMs,
      acceptedNote,
      delayMs,
      status,
    };
  });
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
      onsetCount: 0,
      onsetDelta: 0,
      onsetStatus: 'skipped',
      onsetTimestampsMs: [],
      onsetAcceptAlignment: [],
    };
  }

  const { samples, sampleRate } = readWavFile(fixture.wavPath);
  const result = runSheetMusicSequenceSimulation(samples, sampleRate, fixture.expectedNotes, options);
  const onsetResult = countRmsOnsets(samples, sampleRate, options);
  const onsetDelta = onsetResult.count - fixture.expectedNotes.length;
  return {
    fixture,
    skipped: false,
    passed: result.finalTargetIndex === fixture.expectedNotes.length,
    reason: result.finalTargetIndex === fixture.expectedNotes.length ? null : 'not fully recognized',
    expectedNotes: fixture.expectedNotes,
    acceptedSequence: result.acceptedSequence,
    acceptedCount: result.acceptedSequence.length,
    expectedCount: fixture.expectedNotes.length,
    onsetCount: onsetResult.count,
    onsetDelta,
    onsetStatus: onsetDelta === 0 ? 'match' : (onsetDelta < 0 ? 'under' : 'over'),
    onsetTimestampsMs: onsetResult.timestampsMs,
    onsetAcceptAlignment: buildOnsetAcceptAlignment(fixture, onsetResult.timestampsMs, result),
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
  const detectedOnsets = evaluated.reduce((sum, row) => sum + row.onsetCount, 0);

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
      detectedOnsets,
      onsetExact: evaluated.filter(row => row.onsetStatus === 'match').length,
      onsetUnder: evaluated.filter(row => row.onsetStatus === 'under').length,
      onsetOver: evaluated.filter(row => row.onsetStatus === 'over').length,
    },
    metrics: {
      fixturePassRate: safeDivide(passed.length, evaluated.length),
      noteRecall: safeDivide(acceptedNotes, expectedNotes),
      onsetCountRatio: safeDivide(detectedOnsets, expectedNotes),
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
  return `| ${row.fixture.file} | ${row.acceptedCount}/${row.expectedCount} | ${expected} | ${accepted} |`;
}

function formatSkippedCase(row) {
  return `| ${row.fixture.file} | ${row.reason} |`;
}

function formatOnsetCase(row) {
  const delta = row.onsetDelta > 0 ? `+${row.onsetDelta}` : `${row.onsetDelta}`;
  const timestamps = row.onsetTimestampsMs.slice(0, 16).map(formatMs).join(' ');
  const suffix = row.onsetTimestampsMs.length > 16 ? ' ...' : '';
  return `| ${row.fixture.file} | ${row.expectedCount} | ${row.onsetCount} | ${delta} | `
    + `${row.onsetStatus} | ${timestamps}${suffix} |`;
}

function formatAlignmentSummaryCase(row) {
  const alignment = row.onsetAcceptAlignment;
  const missingOnsets = alignment.filter(item => item.status === 'missing-onset').length;
  const missingAccepts = alignment.filter(item => item.status === 'missing-accept').length;
  const mismatches = alignment.filter(item => item.status === 'mismatch').length;
  const delays = alignment
    .map(item => item.delayMs)
    .filter(Number.isFinite);
  const averageDelay = delays.length > 0
    ? delays.reduce((sum, delay) => sum + delay, 0) / delays.length
    : null;
  const firstIssue = alignment.find(item => item.status !== 'aligned');
  return `| ${row.fixture.file} | ${row.expectedCount} | ${row.onsetCount} | ${row.acceptedCount} | `
    + `${missingOnsets} | ${missingAccepts} | ${mismatches} | `
    + `${formatMs(averageDelay)} | ${firstIssue ? `${firstIssue.index}:${firstIssue.status}` : '-'} |`;
}

function formatAlignmentIssueCase(item) {
  return `| ${item.fixture} | ${item.index} | ${item.expectedNote} | ${formatMs(item.onsetTimeMs)} | `
    + `${item.acceptedNote ?? '-'} | ${formatMs(item.acceptTimeMs)} | ${formatMs(item.delayMs)} | ${item.status} |`;
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
    `- detected onsets: ${counts.detectedOnsets}`,
    `- fixture pass rate: ${formatPercent(metrics.fixturePassRate)}`,
    `- note recall: ${formatPercent(metrics.noteRecall)}`,
    `- onset count ratio: ${formatPercent(metrics.onsetCountRatio)}`,
    `- frame cadence: ${SHEET_FINGERPRINT_ANALYZE_INTERVAL_MS}ms`,
    '',
    '## RMS Onset Count',
    '| fixture | expected notes | detected onsets | delta | status | onset times |',
    '|---|---:|---:|---:|---|---|',
    ...cases.filter(row => !row.skipped).map(formatOnsetCase),
    '',
    '## Onset Count Summary',
    '| exact | under | over | detected/expected | ratio |',
    '|---:|---:|---:|---:|---:|',
    `| ${counts.onsetExact} | ${counts.onsetUnder} | ${counts.onsetOver} | `
      + `${counts.detectedOnsets}/${counts.expectedNotes} | ${formatPercent(metrics.onsetCountRatio)} |`,
    '',
    '## Onset To Accept Alignment',
    '| fixture | expected notes | detected onsets | accepted notes | missing onsets | missing accepts | mismatches | avg onset->accept | first issue |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---|',
    ...cases.filter(row => !row.skipped).map(formatAlignmentSummaryCase),
    '',
    '## Onset To Accept Issues',
    '| fixture | # | expected | onset time | accepted | accept time | onset->accept | status |',
    '|---|---:|---:|---:|---:|---:|---:|---|',
    ...cases
      .flatMap(row => row.onsetAcceptAlignment)
      .filter(item => item.status !== 'aligned')
      .map(formatAlignmentIssueCase),
    '',
    '## Failures',
    '| fixture | accepted notes | expected | accepted |',
    '|---|---:|---|---|',
    ...cases.filter(row => !row.skipped && !row.passed).map(formatCase),
    '',
    '## Skipped',
    '| fixture | reason |',
    '|---|---|',
    ...cases.filter(row => row.skipped).map(formatSkippedCase),
  ].join('\n');
}
