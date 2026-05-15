import { existsSync, readdirSync, readFileSync } from 'fs';
import { basename, dirname, join, relative } from 'path';
import { readWavFile } from './wavDecoder.js';
import { resampleLinear } from './resampleAudio.js';
import {
  createMatchState,
} from '../../js/shared/audio/fastNoteMatcher.js';
import {
  getSheetMusicRecognitionStrategies,
  updateSheetMusicMatchState,
} from '../../js/games/sheetMusicReading/sheetMusicRecognition.js';
import {
  DEFAULT_GUITAR_ONSET_STRATEGY_KEY,
  getGuitarOnsetStrategies,
  resolveGuitarOnsetStrategy,
} from '../../js/shared/audio/guitarOnsetStrategies.js';
import { ONSET_FFT_SIZE, ONSET_LIVE_ANALYZE_INTERVAL_MS, BROWSER_SAMPLE_RATE } from '../../js/shared/audio/onsetPipelineConfig.js';
import { computeDbSpectrum } from './chordHpcpExtraction.js';
import { percentile, scoreTaggedOnsets } from '../../scripts/taggedOnsetScoring.mjs';

const SEQUENCES_DIR = join(process.cwd(), 'tests/fixtures/sequences');
export const SHEET_FINGERPRINT_ANALYZE_INTERVAL_MS = ONSET_LIVE_ANALYZE_INTERVAL_MS;
export const SHEET_FINGERPRINT_ONSET_FRAME_SIZE = ONSET_FFT_SIZE;
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

function formatSignedMs(value) {
  if (!Number.isFinite(value)) return '-';
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded}ms`;
}

function formatFeatureValue(value, digits = 3) {
  if (!Number.isFinite(value)) return '-';
  const abs = Math.abs(value);
  if (abs >= 1000) return `${Math.round(value)}`;
  if (abs >= 100) return value.toFixed(1);
  if (abs >= 10) return value.toFixed(2);
  return value.toFixed(digits);
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

function normalizeTaggedOnsets(manifest) {
  if (!Array.isArray(manifest?.onsetsMs)) return null;
  return manifest.onsetsMs
    .filter(Number.isFinite)
    .map(value => Math.round(value))
    .sort((a, b) => a - b);
}

export function discoverSheetMusicSequenceFixtures() {
  return collectWavFiles(SEQUENCES_DIR).map(wavPath => {
    const manifest = readSequenceManifest(wavPath);
    return {
      file: relative(SEQUENCES_DIR, wavPath).replace(/\\/g, '/'),
      wavPath,
      manifest,
      expectedNotes: manifest?.notes ?? [],
      taggedOnsetsMs: normalizeTaggedOnsets(manifest),
    };
  });
}

function normalizeFrameForSheetMusicReading(frameResult) {
  return frameResult.status === 'wrong'
    ? { ...frameResult, status: 'unsure' }
    : frameResult;
}

export function countGuitarOnsets(samples, sampleRate, options = {}) {
  const frameSize = options.onsetFrameSize ?? SHEET_FINGERPRINT_ONSET_FRAME_SIZE;
  const hopSize = options.onsetHopSize ?? Math.round(frameSize / 4);
  const onsetStrategy = options.onsetStrategy
    ?? (options.onsetStrategyKey ? resolveGuitarOnsetStrategy(options.onsetStrategyKey) : null)
    ?? resolveGuitarOnsetStrategy(DEFAULT_GUITAR_ONSET_STRATEGY_KEY);
  const timestampsMs = [];
  const featureSummary = {
    frameCount: 0,
    onsetFrameCount: 0,
    peakHfcDelta: 0,
    peakCentroidDelta: 0,
    peakRolloffDelta: 0,
    peakFlatnessDelta: 0,
    peakCrestFactorDelta: 0,
    peakBroadbandFlux: 0,
    peakSpectralNoveltyBins: 0,
    peakLowFlux: 0,
    peakLowMidFlux: 0,
    peakPresenceFlux: 0,
    onsetHfcDeltaSum: 0,
    onsetCentroidDeltaSum: 0,
    onsetRolloffDeltaSum: 0,
    onsetFlatnessDeltaSum: 0,
    onsetCrestFactorDeltaSum: 0,
  };
  let onsetState = onsetStrategy.createState();

  for (let offset = 0; offset + frameSize <= samples.length; offset += hopSize) {
    const frame = samples.subarray(offset, offset + frameSize);
    const result = onsetStrategy.update(onsetState, {
      frequencyData: computeDbSpectrum(frame, frameSize),
      samples: frame,
      sampleRate,
      fftSize: frameSize,
    }, options.onsetDetectorOptions);
    onsetState = result.nextState;
    featureSummary.frameCount++;
    featureSummary.peakHfcDelta = Math.max(featureSummary.peakHfcDelta, Math.abs(result.hfcDelta ?? 0));
    featureSummary.peakCentroidDelta = Math.max(featureSummary.peakCentroidDelta, Math.abs(result.spectralCentroidDelta ?? 0));
    featureSummary.peakRolloffDelta = Math.max(featureSummary.peakRolloffDelta, Math.abs(result.spectralRolloffDelta ?? 0));
    featureSummary.peakFlatnessDelta = Math.max(featureSummary.peakFlatnessDelta, Math.abs(result.spectralFlatnessDelta ?? 0));
    featureSummary.peakCrestFactorDelta = Math.max(featureSummary.peakCrestFactorDelta, Math.abs(result.crestFactorDelta ?? 0));
    featureSummary.peakBroadbandFlux = Math.max(featureSummary.peakBroadbandFlux, result.broadbandFlux ?? 0);
    featureSummary.peakSpectralNoveltyBins = Math.max(featureSummary.peakSpectralNoveltyBins, result.spectralNoveltyBins ?? 0);
    featureSummary.peakLowFlux = Math.max(featureSummary.peakLowFlux, result.subbandFlux?.low?.flux ?? 0);
    featureSummary.peakLowMidFlux = Math.max(featureSummary.peakLowMidFlux, result.subbandFlux?.lowMid?.flux ?? 0);
    featureSummary.peakPresenceFlux = Math.max(featureSummary.peakPresenceFlux, result.subbandFlux?.presence?.flux ?? 0);
    if (result.event === 'onset') {
      timestampsMs.push(Math.round(((offset + frameSize) / sampleRate) * 1000));
      featureSummary.onsetFrameCount++;
      featureSummary.onsetHfcDeltaSum += result.hfcDelta ?? 0;
      featureSummary.onsetCentroidDeltaSum += result.spectralCentroidDelta ?? 0;
      featureSummary.onsetRolloffDeltaSum += result.spectralRolloffDelta ?? 0;
      featureSummary.onsetFlatnessDeltaSum += result.spectralFlatnessDelta ?? 0;
      featureSummary.onsetCrestFactorDeltaSum += result.crestFactorDelta ?? 0;
    }
  }

  return {
    count: timestampsMs.length,
    timestampsMs,
    frameSize,
    hopSize,
    featureSummary: {
      frameCount: featureSummary.frameCount,
      onsetFrameCount: featureSummary.onsetFrameCount,
      peakHfcDelta: featureSummary.peakHfcDelta,
      peakCentroidDelta: featureSummary.peakCentroidDelta,
      peakRolloffDelta: featureSummary.peakRolloffDelta,
      peakFlatnessDelta: featureSummary.peakFlatnessDelta,
      peakCrestFactorDelta: featureSummary.peakCrestFactorDelta,
      peakBroadbandFlux: featureSummary.peakBroadbandFlux,
      peakSpectralNoveltyBins: featureSummary.peakSpectralNoveltyBins,
      peakLowFlux: featureSummary.peakLowFlux,
      peakLowMidFlux: featureSummary.peakLowMidFlux,
      peakPresenceFlux: featureSummary.peakPresenceFlux,
      meanOnsetHfcDelta: safeDivide(featureSummary.onsetHfcDeltaSum, featureSummary.onsetFrameCount),
      meanOnsetCentroidDelta: safeDivide(featureSummary.onsetCentroidDeltaSum, featureSummary.onsetFrameCount),
      meanOnsetRolloffDelta: safeDivide(featureSummary.onsetRolloffDeltaSum, featureSummary.onsetFrameCount),
      meanOnsetFlatnessDelta: safeDivide(featureSummary.onsetFlatnessDeltaSum, featureSummary.onsetFrameCount),
      meanOnsetCrestFactorDelta: safeDivide(featureSummary.onsetCrestFactorDeltaSum, featureSummary.onsetFrameCount),
    },
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

function createOnsetEvaluation(fixture, onsetTimestampsMs) {
  const expectedCount = fixture.expectedNotes.length;
  const onsetCount = onsetTimestampsMs.length;
  const onsetDelta = onsetCount - expectedCount;
  const onsetTaggedScore = Array.isArray(fixture.taggedOnsetsMs) && fixture.taggedOnsetsMs.length > 0
    ? scoreTaggedOnsets(fixture.taggedOnsetsMs, onsetTimestampsMs)
    : null;
  const onsetStatus = onsetTaggedScore
    ? (
      onsetTaggedScore.misses === 0 && onsetTaggedScore.falsePositives === 0 ? 'match'
        : onsetTaggedScore.misses > 0 && onsetTaggedScore.falsePositives > 0 ? 'mixed'
          : onsetTaggedScore.misses > 0 ? 'under' : 'over'
    )
    : (onsetDelta === 0 ? 'match' : (onsetDelta < 0 ? 'under' : 'over'));

  return {
    expectedCount,
    onsetCount,
    onsetDelta,
    onsetStatus,
    onsetTaggedScore,
  };
}

export function summarizeOnsetMetrics(cases) {
  const onsetConfusion = {
    truePositives: 0,
    falsePositives: 0,
    falseNegatives: 0,
  };
  const counts = {
    exact: 0,
    under: 0,
    over: 0,
    mixed: 0,
    taggedFixtures: 0,
    totalTaggedOnsets: 0,
    goodMatches: 0,
    acceptableMatches: 0,
    misses: 0,
    duplicates: 0,
    falsePositives: 0,
    earlyMatches: 0,
    lateMatches: 0,
  };
  const absTimingErrorsMs = [];
  const signedTimingErrorsMs = [];

  for (const row of cases) {
    const tagged = row.onsetTaggedScore;
    if (tagged) {
      onsetConfusion.truePositives += tagged.matches;
      onsetConfusion.falsePositives += tagged.falsePositives;
      onsetConfusion.falseNegatives += tagged.misses;
      counts.taggedFixtures++;
      counts.totalTaggedOnsets += row.fixture.taggedOnsetsMs?.length ?? 0;
      counts.goodMatches += tagged.goodMatches;
      counts.acceptableMatches += tagged.acceptableMatches;
      counts.misses += tagged.misses;
      counts.duplicates += tagged.duplicates;
      counts.falsePositives += tagged.falsePositives;
      counts.earlyMatches += tagged.earlyMatches;
      counts.lateMatches += tagged.lateMatches;
      absTimingErrorsMs.push(...tagged.errorsMs);
      signedTimingErrorsMs.push(...tagged.signedErrorsMs);
    } else {
      const truePositives = Math.min(row.onsetCount, row.expectedCount);
      onsetConfusion.truePositives += truePositives;
      onsetConfusion.falsePositives += Math.max(0, row.onsetCount - row.expectedCount);
      onsetConfusion.falseNegatives += Math.max(0, row.expectedCount - row.onsetCount);
    }

    if (row.onsetStatus === 'match') counts.exact++;
    else if (row.onsetStatus === 'under') counts.under++;
    else if (row.onsetStatus === 'over') counts.over++;
    else counts.mixed++;
  }

  const precision = safeDivide(
    onsetConfusion.truePositives,
    onsetConfusion.truePositives + onsetConfusion.falsePositives,
  );
  const recall = safeDivide(
    onsetConfusion.truePositives,
    onsetConfusion.truePositives + onsetConfusion.falseNegatives,
  );

  return {
    counts: {
      ...counts,
      truePositives: onsetConfusion.truePositives,
      falseNegatives: onsetConfusion.falseNegatives,
    },
    metrics: {
      onsetPrecision: precision,
      onsetRecall: recall,
      onsetF1: safeDivide(2 * precision * recall, precision + recall),
      taggedHitRate: safeDivide(counts.goodMatches + counts.acceptableMatches, counts.totalTaggedOnsets),
      goodHitRate: safeDivide(counts.goodMatches, counts.totalTaggedOnsets),
      meanAbsErrorMs: absTimingErrorsMs.length > 0
        ? absTimingErrorsMs.reduce((sum, value) => sum + value, 0) / absTimingErrorsMs.length
        : null,
      medianAbsErrorMs: percentile(absTimingErrorsMs, 0.5),
      p95AbsErrorMs: percentile(absTimingErrorsMs, 0.95),
      maxAbsErrorMs: absTimingErrorsMs.length > 0 ? Math.max(...absTimingErrorsMs) : null,
      meanSignedErrorMs: signedTimingErrorsMs.length > 0
        ? signedTimingErrorsMs.reduce((sum, value) => sum + value, 0) / signedTimingErrorsMs.length
        : null,
    },
  };
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

  const { samples: rawSamples, sampleRate: rawRate } = readWavFile(fixture.wavPath);
  const samples = resampleLinear(rawSamples, rawRate, BROWSER_SAMPLE_RATE);
  const sampleRate = BROWSER_SAMPLE_RATE;
  const result = runSheetMusicSequenceSimulation(samples, sampleRate, fixture.expectedNotes, options);
  const onsetResult = countGuitarOnsets(samples, sampleRate, options);
  const onsetEvaluation = createOnsetEvaluation(fixture, onsetResult.timestampsMs);
  return {
    fixture,
    skipped: false,
    passed: result.finalTargetIndex === fixture.expectedNotes.length,
    reason: result.finalTargetIndex === fixture.expectedNotes.length ? null : 'not fully recognized',
    expectedNotes: fixture.expectedNotes,
    acceptedSequence: result.acceptedSequence,
    acceptedCount: result.acceptedSequence.length,
    expectedCount: fixture.expectedNotes.length,
    onsetCount: onsetEvaluation.onsetCount,
    onsetDelta: onsetEvaluation.onsetDelta,
    onsetStatus: onsetEvaluation.onsetStatus,
    onsetTimestampsMs: onsetResult.timestampsMs,
    onsetFeatureSummary: onsetResult.featureSummary,
    onsetTaggedScore: onsetEvaluation.onsetTaggedScore,
    onsetAcceptAlignment: buildOnsetAcceptAlignment(fixture, onsetResult.timestampsMs, result),
    sampleRate,
    durationSec: samples.length / sampleRate,
    framesProcessed: result.framesProcessed,
    acceptTimestamps: result.acceptTimestamps,
    frames: options.includeFrames ? result.frames : undefined,
  };
}

export function summarizeSequenceCases(fixtures, cases, strategy) {
  const evaluated = cases.filter(row => !row.skipped);
  const passed = evaluated.filter(row => row.passed);
  const failed = evaluated.filter(row => !row.passed);
  const skipped = cases.filter(row => row.skipped);
  const expectedNotes = evaluated.reduce((sum, row) => sum + row.expectedCount, 0);
  const acceptedNotes = evaluated.reduce((sum, row) => sum + row.acceptedCount, 0);
  const detectedOnsets = evaluated.reduce((sum, row) => sum + row.onsetCount, 0);
  const onsetSummary = summarizeOnsetMetrics(evaluated);

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
      onsetTruePositives: onsetSummary.counts.truePositives,
      onsetFalsePositives: onsetSummary.counts.falsePositives,
      onsetFalseNegatives: onsetSummary.counts.falseNegatives,
      onsetExact: onsetSummary.counts.exact,
      onsetUnder: onsetSummary.counts.under,
      onsetOver: onsetSummary.counts.over,
      onsetMixed: onsetSummary.counts.mixed,
      taggedFixtures: onsetSummary.counts.taggedFixtures,
      totalTaggedOnsets: onsetSummary.counts.totalTaggedOnsets,
      onsetGoodMatches: onsetSummary.counts.goodMatches,
      onsetAcceptableMatches: onsetSummary.counts.acceptableMatches,
      onsetMisses: onsetSummary.counts.misses,
      onsetTaggedFalsePositives: onsetSummary.counts.falsePositives,
      onsetDuplicates: onsetSummary.counts.duplicates,
      onsetEarlyMatches: onsetSummary.counts.earlyMatches,
      onsetLateMatches: onsetSummary.counts.lateMatches,
    },
    metrics: {
      fixturePassRate: safeDivide(passed.length, evaluated.length),
      noteRecall: safeDivide(acceptedNotes, expectedNotes),
      onsetCountRatio: safeDivide(detectedOnsets, expectedNotes),
      onsetPrecision: onsetSummary.metrics.onsetPrecision,
      onsetRecall: onsetSummary.metrics.onsetRecall,
      onsetF1: onsetSummary.metrics.onsetF1,
      taggedHitRate: onsetSummary.metrics.taggedHitRate,
      onsetGoodHitRate: onsetSummary.metrics.goodHitRate,
      onsetMeanAbsErrorMs: onsetSummary.metrics.meanAbsErrorMs,
      onsetMedianAbsErrorMs: onsetSummary.metrics.medianAbsErrorMs,
      onsetP95AbsErrorMs: onsetSummary.metrics.p95AbsErrorMs,
      onsetMaxAbsErrorMs: onsetSummary.metrics.maxAbsErrorMs,
      onsetMeanSignedErrorMs: onsetSummary.metrics.meanSignedErrorMs,
    },
  };
}

export function evaluateSequenceStrategyReport(
  fixtures = discoverSheetMusicSequenceFixtures(),
  strategy = getSheetMusicRecognitionStrategies()[0],
  options = {},
) {
  const progress = typeof options.onProgress === 'function' ? options.onProgress : null;
  progress?.({
    phase: 'sequence-strategy-start',
    strategyKey: strategy.key,
    fixtureCount: fixtures.length,
  });
  const cases = fixtures.map((fixture, index) => {
    if (index === 0 || (index + 1) % 5 === 0 || index === fixtures.length - 1) {
      progress?.({
        phase: 'sequence-strategy-progress',
        strategyKey: strategy.key,
        current: index + 1,
        total: fixtures.length,
        fixture: fixture.file,
      });
    }
    return evaluateFixture(fixture, { ...options, strategy });
  });
  progress?.({
    phase: 'sequence-strategy-done',
    strategyKey: strategy.key,
    fixtureCount: fixtures.length,
  });
  return summarizeSequenceCases(fixtures, cases, strategy);
}

export function evaluateOnsetStrategyReport(
  fixtures = discoverSheetMusicSequenceFixtures(),
  onsetStrategy = getGuitarOnsetStrategies()[0],
  options = {},
) {
  const progress = typeof options.onProgress === 'function' ? options.onProgress : null;
  const evaluated = fixtures.filter(f => f.expectedNotes.length > 0);
  progress?.({
    phase: 'sequence-onset-strategy-start',
    strategyKey: onsetStrategy.key,
    fixtureCount: evaluated.length,
  });
  const cases = evaluated.map(fixture => {
    const { samples: rawSamples, sampleRate: rawRate } = readWavFile(fixture.wavPath);
    const samples = resampleLinear(rawSamples, rawRate, BROWSER_SAMPLE_RATE);
    const sampleRate = BROWSER_SAMPLE_RATE;
    const onsetResult = countGuitarOnsets(samples, sampleRate, { ...options, onsetStrategy });
    const onsetEvaluation = createOnsetEvaluation(fixture, onsetResult.timestampsMs);
    return {
      fixture,
      expectedCount: onsetEvaluation.expectedCount,
      onsetCount: onsetEvaluation.onsetCount,
      onsetDelta: onsetEvaluation.onsetDelta,
      onsetStatus: onsetEvaluation.onsetStatus,
      onsetTimestampsMs: onsetResult.timestampsMs,
      onsetFeatureSummary: onsetResult.featureSummary,
      onsetTaggedScore: onsetEvaluation.onsetTaggedScore,
    };
  });
  progress?.({
    phase: 'sequence-onset-strategy-done',
    strategyKey: onsetStrategy.key,
    fixtureCount: evaluated.length,
  });
  const totalExpected = cases.reduce((s, c) => s + c.expectedCount, 0);
  const totalDetected = cases.reduce((s, c) => s + c.onsetCount, 0);
  const onsetSummary = summarizeOnsetMetrics(cases);
  return {
    onsetStrategy,
    cases,
    counts: {
      total: cases.length,
      exact: onsetSummary.counts.exact,
      under: onsetSummary.counts.under,
      over: onsetSummary.counts.over,
      mixed: onsetSummary.counts.mixed,
      totalExpected,
      totalDetected,
      totalTaggedOnsets: onsetSummary.counts.totalTaggedOnsets,
      goodMatches: onsetSummary.counts.goodMatches,
      acceptableMatches: onsetSummary.counts.acceptableMatches,
      misses: onsetSummary.counts.misses,
      falsePositives: onsetSummary.counts.falsePositives,
      duplicates: onsetSummary.counts.duplicates,
    },
    metrics: {
      onsetCountRatio: safeDivide(totalDetected, totalExpected),
      onsetPrecision: onsetSummary.metrics.onsetPrecision,
      onsetRecall: onsetSummary.metrics.onsetRecall,
      onsetF1: onsetSummary.metrics.onsetF1,
      taggedHitRate: onsetSummary.metrics.taggedHitRate,
      onsetP95AbsErrorMs: onsetSummary.metrics.p95AbsErrorMs,
    },
  };
}

export function evaluateSheetMusicSequenceFingerprint(fixtures = discoverSheetMusicSequenceFixtures(), options = {}) {
  const strategies = options.strategies ?? getSheetMusicRecognitionStrategies();
  const onsetStrategies = options.onsetStrategies ?? getGuitarOnsetStrategies();
  const strategyReports = strategies.map(strategy => (
    evaluateSequenceStrategyReport(fixtures, strategy, options)
  ));
  const defaultReport = strategyReports[0];

  // Onset strategy reports: evaluate onset detection quality independently
  // of pitch strategy, always using the default pitch strategy for consistency.
  const onsetStrategyReports = onsetStrategies.map(onsetStrategy => (
    evaluateOnsetStrategyReport(fixtures, onsetStrategy, options)
  ));

  return {
    ...defaultReport,
    strategies,
    strategyReports,
    onsetStrategies,
    onsetStrategyReports,
    onsetConfig: {
      analyzeIntervalMs: options.analyzeIntervalMs ?? SHEET_FINGERPRINT_ANALYZE_INTERVAL_MS,
      onsetFrameSize: options.onsetFrameSize ?? SHEET_FINGERPRINT_ONSET_FRAME_SIZE,
      onsetHopSize: options.onsetHopSize ?? null,
      onsetDetectorOptions: options.onsetDetectorOptions ?? {},
    },
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

function formatTaggedOnsetCase(row) {
  const tagged = row.onsetTaggedScore;
  return `| ${row.fixture.file} | ${row.fixture.taggedOnsetsMs.length} | ${tagged.matches} | ${tagged.goodMatches} | `
    + `${tagged.acceptableMatches} | ${tagged.misses} | ${tagged.falsePositives} | ${tagged.duplicates} | `
    + `${formatMs(tagged.meanAbsErrorMs)} | ${formatMs(tagged.p95AbsErrorMs)} | ${formatSignedMs(tagged.meanSignedErrorMs)} |`;
}

function formatFeatureCase(row) {
  const features = row.onsetFeatureSummary;
  return `| ${row.fixture.file} | ${features.frameCount} | ${features.onsetFrameCount} | `
    + `${formatFeatureValue(features.peakHfcDelta)} | ${formatFeatureValue(features.peakCentroidDelta)} | `
    + `${formatFeatureValue(features.peakRolloffDelta)} | ${formatFeatureValue(features.peakFlatnessDelta)} | `
    + `${formatFeatureValue(features.peakCrestFactorDelta)} | ${formatFeatureValue(features.peakBroadbandFlux)} | `
    + `${formatFeatureValue(features.peakLowFlux)} / ${formatFeatureValue(features.peakLowMidFlux)} / ${formatFeatureValue(features.peakPresenceFlux)} | `
    + `${formatFeatureValue(features.meanOnsetHfcDelta)} | ${formatFeatureValue(features.meanOnsetCentroidDelta)} | `
    + `${formatFeatureValue(features.meanOnsetRolloffDelta)} | ${formatFeatureValue(features.meanOnsetFlatnessDelta)} | `
    + `${formatFeatureValue(features.meanOnsetCrestFactorDelta)} |`;
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

function formatOnsetStrategyDetailSection(onsetReport) {
  const key = onsetReport.onsetStrategy.key;
  const { cases, counts, metrics } = onsetReport;
  const taggedCases = cases.filter(c => c.onsetTaggedScore);

  const lines = [
    `## Onset Strategy Detail: ${key}`,
    '',
    '### Onset Count per Fixture',
    '_Status: **exact** = Anzahl stimmt genau, **under** = zu wenig erkannt, **over** = zu viele erkannt, **mixed** = laut Tagged-Analyse beides (gleichzeitig fehlende und überschüssige Onsets)_',
    '',
    '| fixture | expected notes | detected onsets | delta | status | onset times |',
    '|---|---:|---:|---:|---|---|',
    ...cases.map(formatOnsetCase),
    '',
    `_Gesamt: ${counts.totalDetected}/${counts.totalExpected} Onsets erkannt (${formatPercent(metrics.onsetCountRatio)}). `
      + `exact: ${counts.exact} · under: ${counts.under} · over: ${counts.over} · mixed: ${counts.mixed}_`,
  ];

  if (taggedCases.length > 0) {
    lines.push(
      '',
      '### Tagged Onset Accuracy per Fixture',
      '_Vergleich der erkannten Onsets mit manuell getaggten Referenzzeitpunkten (Toleranzfenster: 50 ms)._',
      '_**good** = Treffer < 20 ms Abweichung, **acceptable** = Treffer < 50 ms, **misses** = Onset verpasst, **false positives** = Fehlalarm ohne Referenz in der Nähe, **bias** = mittlere Richtungsabweichung (negativ = zu früh gefeuert)_',
      '',
      '| fixture | tags | hits | good | acceptable | misses | false positives | duplicates | mean abs | p95 abs | bias |',
      '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
      ...taggedCases.map(formatTaggedOnsetCase),
      '',
      `_Gesamttreffer: ${counts.goodMatches + counts.acceptableMatches}/${counts.totalTaggedOnsets} `
        + `(${formatPercent(metrics.taggedHitRate)}). `
        + `good: ${counts.goodMatches} · acceptable: ${counts.acceptableMatches} · misses: ${counts.misses} · false positives: ${counts.falsePositives}_`,
    );
  }

  return lines;
}

export function formatSheetMusicSequenceFingerprintReport(report) {
  const { counts, metrics, cases, strategyReports, onsetStrategyReports } = report;
  const onsetConfig = report.onsetConfig ?? {};
  const detectorKeys = Object.keys(onsetConfig.onsetDetectorOptions ?? {});
  const strategyTable = strategyReports.map(row => (
    `| ${row.strategy.key} | ${row.counts.evaluated} | ${row.counts.passed} | ${row.counts.failed} | `
      + `${row.counts.acceptedNotes}/${row.counts.expectedNotes} | ${row.counts.detectedOnsets}/${row.counts.expectedNotes} | `
      + `${formatPercent(row.metrics.fixturePassRate)} | ${formatPercent(row.metrics.noteRecall)} | `
      + `${formatPercent(row.metrics.onsetPrecision)} | ${formatPercent(row.metrics.onsetRecall)} | ${formatPercent(row.metrics.onsetF1)} | `
      + `${row.counts.onsetGoodMatches + row.counts.onsetAcceptableMatches}/${row.counts.totalTaggedOnsets} | `
      + `${formatMs(row.metrics.onsetP95AbsErrorMs)} |`
  ));
  const onsetStrategyTable = (onsetStrategyReports ?? []).map(row => (
    `| ${row.onsetStrategy.key} | ${row.counts.total} | ${row.counts.exact} | ${row.counts.under} | `
      + `${row.counts.over} | ${row.counts.totalDetected}/${row.counts.totalExpected} | `
      + `${formatPercent(row.metrics.onsetCountRatio)} | ${row.counts.goodMatches + row.counts.acceptableMatches}/${row.counts.totalTaggedOnsets} | `
      + `${formatMs(row.metrics.onsetP95AbsErrorMs)} |`
  ));
  return [
    '# Sheet Music Sequence Fingerprint',
    '',
    `- fixtures: ${counts.total} sequence WAVs`,
    `- strategies: ${report.strategies.map(strategy => strategy.key).join(', ')}`,
    '',
    '## Strategy Summary',
    '| strategy | evaluated | passed | failed | notes | onsets | fixture pass rate | note recall | onset precision | onset recall | onset f1 | tagged hits | tagged p95 |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...strategyTable,
    '',
    '## Onset Strategy Summary',
    '| onset strategy | fixtures | exact | under | over | detected/expected | onset ratio | tagged hits | tagged p95 |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...onsetStrategyTable,
    ...(onsetStrategyReports ?? []).flatMap(row => ['', ...formatOnsetStrategyDetailSection(row)]),
    '',
    '## Default Strategy Detail',
    `- evaluated: ${counts.evaluated}`,
    `- skipped: ${counts.skipped}`,
    `- passed: ${counts.passed}`,
    `- failed: ${counts.failed}`,
    `- expected notes: ${counts.expectedNotes}`,
    `- accepted notes: ${counts.acceptedNotes}`,
    `- detected onsets: ${counts.detectedOnsets}`,
    `- onset confusion: TP=${counts.onsetTruePositives} FP=${counts.onsetFalsePositives} FN=${counts.onsetFalseNegatives}`,
    `- tagged fixtures: ${counts.taggedFixtures}`,
    `- tagged hits: ${counts.onsetGoodMatches + counts.onsetAcceptableMatches}/${counts.totalTaggedOnsets}`,
    `- tagged misses: ${counts.onsetMisses}`,
    `- tagged false positives: ${counts.onsetTaggedFalsePositives}`,
    `- tagged duplicates: ${counts.onsetDuplicates}`,
    `- fixture pass rate: ${formatPercent(metrics.fixturePassRate)}`,
    `- note recall: ${formatPercent(metrics.noteRecall)}`,
    `- onset precision: ${formatPercent(metrics.onsetPrecision)}`,
    `- onset recall: ${formatPercent(metrics.onsetRecall)}`,
    `- onset f1: ${formatPercent(metrics.onsetF1)}`,
    `- onset count ratio: ${formatPercent(metrics.onsetCountRatio)}`,
    `- tagged hit rate: ${formatPercent(metrics.taggedHitRate)}`,
    `- good hit rate: ${formatPercent(metrics.onsetGoodHitRate)}`,
    `- tagged mean abs error: ${formatMs(metrics.onsetMeanAbsErrorMs)}`,
    `- tagged median abs error: ${formatMs(metrics.onsetMedianAbsErrorMs)}`,
    `- tagged p95 abs error: ${formatMs(metrics.onsetP95AbsErrorMs)}`,
    `- tagged max abs error: ${formatMs(metrics.onsetMaxAbsErrorMs)}`,
    `- tagged mean signed error: ${formatSignedMs(metrics.onsetMeanSignedErrorMs)}`,
    `- tagged early/late matches: ${counts.onsetEarlyMatches}/${counts.onsetLateMatches}`,
    `- frame cadence: ${onsetConfig.analyzeIntervalMs ?? SHEET_FINGERPRINT_ANALYZE_INTERVAL_MS}ms`,
    `- onset frame size: ${onsetConfig.onsetFrameSize ?? SHEET_FINGERPRINT_ONSET_FRAME_SIZE}`,
    `- onset hop size: ${onsetConfig.onsetHopSize ?? 'derived'}`,
    `- detector option overrides: ${detectorKeys.length > 0 ? detectorKeys.join(', ') : 'none'}`,
    '',
    '## Guitar Onset Count',
    '| fixture | expected notes | detected onsets | delta | status | onset times |',
    '|---|---:|---:|---:|---|---|',
    ...cases.filter(row => !row.skipped).map(formatOnsetCase),
    '',
    '## Onset Count Summary',
    '| exact | under | over | mixed | TP | FP | FN | detected/expected | ratio | precision | recall | f1 |',
    '|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    `| ${counts.onsetExact} | ${counts.onsetUnder} | ${counts.onsetOver} | ${counts.onsetMixed} | `
      + `${counts.onsetTruePositives} | ${counts.onsetFalsePositives} | ${counts.onsetFalseNegatives} | `
      + `${counts.detectedOnsets}/${counts.expectedNotes} | ${formatPercent(metrics.onsetCountRatio)} | `
      + `${formatPercent(metrics.onsetPrecision)} | ${formatPercent(metrics.onsetRecall)} | ${formatPercent(metrics.onsetF1)} |`,
    '',
    '## Tagged Onset Summary',
    '| tagged fixtures | tagged onsets | good hits | acceptable hits | misses | false positives | duplicates | hit rate | good hit rate | mean abs | p95 abs | bias |',
    '|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    `| ${counts.taggedFixtures} | ${counts.totalTaggedOnsets} | ${counts.onsetGoodMatches} | ${counts.onsetAcceptableMatches} | `
      + `${counts.onsetMisses} | ${counts.onsetTaggedFalsePositives} | ${counts.onsetDuplicates} | `
      + `${formatPercent(metrics.taggedHitRate)} | ${formatPercent(metrics.onsetGoodHitRate)} | `
      + `${formatMs(metrics.onsetMeanAbsErrorMs)} | ${formatMs(metrics.onsetP95AbsErrorMs)} | ${formatSignedMs(metrics.onsetMeanSignedErrorMs)} |`,
    '',
    '## Tagged Onset Detail',
    '| fixture | tags | hits | good | acceptable | misses | false positives | duplicates | mean abs | p95 abs | bias |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...cases
      .filter(row => !row.skipped && row.onsetTaggedScore)
      .map(formatTaggedOnsetCase),
    '',
    '## Onset Feature Detail',
    '| fixture | frames | onset frames | peak hfcΔ | peak centroidΔ | peak rolloffΔ | peak flatnessΔ | peak crestΔ | peak flux | peak subband fluxes | onset hfcΔ | onset centroidΔ | onset rolloffΔ | onset flatnessΔ | onset crestΔ |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|',
    ...cases
      .filter(row => !row.skipped)
      .map(formatFeatureCase),
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
