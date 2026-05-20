import { existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { readZip } from '../js/shared/zip.js';
import { collectFrameData } from '../js/shared/audio/collectFrameData.js';
import {
  buildContextFeatures,
  extractXGBoostFrameFeatures,
  getFeatureOrder,
} from '../js/shared/audio/xgboostFeatureExtractor.js';
import { ONSET_FFT_SIZE, ONSET_HOP_SIZE } from '../js/shared/audio/onsetPipelineConfig.js';
import { resolveGuitarOnsetStrategy } from '../js/shared/audio/guitarOnsetStrategies.js';
import { decodeWav } from '../tests/helpers/wavDecoder.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRAINING_DIR = 'ml/data/android_firefox';
const MEDIA_ROOTS = [
  'tests/fixtures/sequences',
  'tests/fixtures/dropsequence',
  TRAINING_DIR,
];

function repoPath(relativePath) {
  return path.join(REPO_ROOT, relativePath);
}

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function parseArgs(argv) {
  const args = {
    trainingDir: TRAINING_DIR,
    limit: Number.POSITIVE_INFINITY,
    base: null,
    top: 12,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--training-dir') args.trainingDir = argv[++index];
    else if (arg === '--limit') args.limit = Number(argv[++index]);
    else if (arg === '--base') args.base = argv[++index];
    else if (arg === '--top') args.top = Number(argv[++index]);
    else if (arg === '-h' || arg === '--help') {
      console.log([
        'Usage: node scripts/compare-xgboost-training-data.mjs [--limit N] [--base STEM] [--top N]',
        '',
        'Regenerates XGBoost training frames from matching WAV/ZIP fixtures and compares them',
        'against ml/data/android_firefox/training_data_*.json.',
      ].join('\n'));
      process.exit(0);
    }
  }
  return args;
}

function walkFiles(relativeDir, extensions, results = []) {
  const absoluteDir = repoPath(relativeDir);
  if (!existsSync(absoluteDir)) return results;
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const child = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(child, extensions, results);
    } else if (extensions.some(extension => entry.name.toLowerCase().endsWith(extension))) {
      results.push(toPosix(child));
    }
  }
  return results;
}

function stripKnownPrefixes(stem) {
  return stem
    .replace(/^training_data_/i, '')
    .replace(/-tagged$/i, '');
}

function stemOf(filePath) {
  return stripKnownPrefixes(path.basename(filePath).replace(/\.[^.]+$/, ''));
}

function loadJson(relativePath) {
  return JSON.parse(readFileSync(repoPath(relativePath), 'utf8'));
}

function collectMediaFiles() {
  const files = [];
  for (const root of MEDIA_ROOTS) {
    files.push(...walkFiles(root, ['.zip', '.wav']));
  }
  return files.sort((a, b) => a.localeCompare(b, 'de-DE'));
}

function findMediaForBase(baseName, mediaFiles) {
  const normalizedBase = baseName.toLowerCase();
  const matches = mediaFiles.filter(file => stemOf(file).toLowerCase() === normalizedBase);
  const zip = matches.find(file => file.toLowerCase().endsWith('.zip'));
  return zip ?? matches[0] ?? null;
}

function readMedia(relativePath) {
  const bytes = readFileSync(repoPath(relativePath));
  if (relativePath.toLowerCase().endsWith('.wav')) {
    return {
      wavName: path.basename(relativePath),
      wavBytes: bytes,
      manifest: null,
    };
  }

  const entries = readZip(new Uint8Array(bytes));
  const wavEntry = entries.find(entry => entry.name.toLowerCase().endsWith('.wav'));
  if (!wavEntry) throw new Error(`No WAV entry in ${relativePath}`);
  const wavStem = path.basename(wavEntry.name, '.wav').toLowerCase();
  const jsonEntry = entries.find(entry => (
    entry.name.toLowerCase() === `${wavStem}.json`
      || path.basename(entry.name, '.json').toLowerCase() === wavStem
  )) ?? entries.find(entry => entry.name.toLowerCase().endsWith('.json'));

  return {
    wavName: path.basename(wavEntry.name),
    wavBytes: Buffer.from(wavEntry.data),
    manifest: jsonEntry ? JSON.parse(Buffer.from(jsonEntry.data).toString('utf8')) : null,
  };
}

async function regenerateTrainingData(media, referenceTraining) {
  const { samples, sampleRate } = decodeWav(Buffer.from(media.wavBytes));
  const frames = await collectFrameData(samples, sampleRate, ONSET_FFT_SIZE, ONSET_HOP_SIZE);
  const strategyKey = referenceTraining.metadata?.onsetStrategyKey ?? 'xgboost-android-firefox';
  const onsetStrategy = resolveGuitarOnsetStrategy(strategyKey);
  let onsetState = onsetStrategy.createState();
  const featureOrder = getFeatureOrder();
  const trainingFrames = [];

  let prevLinearMag = null;
  let prevRms = 0;
  let prevHfc = 0;
  let prevSpectralCentroid = 0;
  let prevSpectralRolloff = 0;
  let prevSpectralFlatness = 0;
  let prevCrestFactor = 0;
  let prevLogBandFlux_150_6000 = 0;
  const historyBuffer = [];

  for (let index = 0; index < frames.length; index += 1) {
    const { samples: frame, frequencyData } = frames[index];
    const t = (index * ONSET_HOP_SIZE + ONSET_FFT_SIZE / 2) / sampleRate;
    const onsetResult = onsetStrategy.update(onsetState, { frequencyData, samples: frame });
    onsetState = onsetResult.nextState;

    const history = {
      prevMagnitudes: prevLinearMag,
      prevRms,
      prevHfc,
      prevSpectralCentroid,
      prevSpectralRolloff,
      prevSpectralFlatness,
      prevCrestFactor,
      prevLogBandFlux_150_6000,
    };
    const { baseFeatures, linearMagnitudes } = extractXGBoostFrameFeatures(
      frame,
      frequencyData,
      onsetResult,
      sampleRate,
      ONSET_FFT_SIZE,
      1000,
      history,
    );

    const contextFeatures = buildContextFeatures(baseFeatures, historyBuffer, featureOrder);
    historyBuffer.unshift({ ...baseFeatures });
    if (historyBuffer.length > 30) historyBuffer.pop();

    prevLinearMag = linearMagnitudes;
    prevRms = baseFeatures.rms;
    prevHfc = baseFeatures.hfc;
    prevSpectralCentroid = baseFeatures.spectralCentroid;
    prevSpectralRolloff = baseFeatures.spectralRolloff;
    prevSpectralFlatness = baseFeatures.spectralFlatness;
    prevCrestFactor = baseFeatures.crestFactor;
    prevLogBandFlux_150_6000 = baseFeatures.logBandFlux_150_6000;

    trainingFrames.push({ t, features: contextFeatures });
  }

  return {
    schemaVersion: 1,
    metadata: {
      filename: path.basename(media.wavName).replace(/\.[^.]+$/, ''),
      sampleRate,
      fftSize: ONSET_FFT_SIZE,
      hopSize: ONSET_HOP_SIZE,
      frameCount: frames.length,
      featureOrder,
      onsetStrategyKey: strategyKey,
    },
    frames: trainingFrames,
    annotations: {
      onsetsMs: media.manifest?.onsetsMs ?? null,
    },
  };
}

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return 0;
  const index = (sortedValues.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  const ratio = index - lower;
  return sortedValues[lower] * (1 - ratio) + sortedValues[upper] * ratio;
}

function summarizeNumbers(values) {
  if (values.length === 0) {
    return { count: 0, mean: 0, median: 0, p95: 0, p99: 0, max: 0 };
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const sum = values.reduce((total, value) => total + value, 0);
  return {
    count: values.length,
    mean: sum / values.length,
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    max: sorted[sorted.length - 1],
  };
}

function compareTrainingData(reference, regenerated) {
  const frameCount = Math.min(reference.frames?.length ?? 0, regenerated.frames.length);
  const featureNames = reference.metadata?.featureOrder ?? getFeatureOrder();
  const absDeltas = [];
  const timeDeltasMs = [];
  const byFeature = new Map();

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const referenceFrame = reference.frames[frameIndex];
    const regeneratedFrame = regenerated.frames[frameIndex];
    timeDeltasMs.push(Math.abs((referenceFrame.t ?? 0) - (regeneratedFrame.t ?? 0)) * 1000);
    for (const featureName of featureNames) {
      const a = Number(referenceFrame.features?.[featureName] ?? 0);
      const b = Number(regeneratedFrame.features?.[featureName] ?? 0);
      const delta = Math.abs(a - b);
      absDeltas.push(delta);
      let row = byFeature.get(featureName);
      if (!row) {
        row = { feature: featureName, count: 0, sum: 0, max: 0 };
        byFeature.set(featureName, row);
      }
      row.count += 1;
      row.sum += delta;
      row.max = Math.max(row.max, delta);
    }
  }

  const referenceOnsets = reference.annotations?.onsetsMs ?? [];
  const regeneratedOnsets = regenerated.annotations?.onsetsMs ?? [];
  const onsetCount = Math.min(referenceOnsets?.length ?? 0, regeneratedOnsets?.length ?? 0);
  const onsetDeltasMs = [];
  for (let index = 0; index < onsetCount; index += 1) {
    onsetDeltasMs.push(Math.abs(Number(referenceOnsets[index]) - Number(regeneratedOnsets[index])));
  }

  const topFeatures = Array.from(byFeature.values())
    .map(row => ({ ...row, mean: row.sum / Math.max(1, row.count) }))
    .sort((a, b) => b.max - a.max);

  return {
    referenceFrames: reference.frames?.length ?? 0,
    regeneratedFrames: regenerated.frames.length,
    comparedFrames: frameCount,
    referenceOnsets: referenceOnsets?.length ?? 0,
    regeneratedOnsets: regeneratedOnsets?.length ?? 0,
    featureDeltas: summarizeNumbers(absDeltas),
    timeDeltasMs: summarizeNumbers(timeDeltasMs),
    onsetDeltasMs: summarizeNumbers(onsetDeltasMs),
    topFeatures,
  };
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  if (Math.abs(value) >= 100) return value.toFixed(3);
  if (Math.abs(value) >= 1) return value.toFixed(6);
  return value.toExponential(3);
}

function formatSummary(row) {
  const d = row.comparison.featureDeltas;
  return [
    row.base,
    `frames ${row.comparison.referenceFrames}/${row.comparison.regeneratedFrames}`,
    `feature max ${formatNumber(d.max)}`,
    `p99 ${formatNumber(d.p99)}`,
    `mean ${formatNumber(d.mean)}`,
    `onset max ${formatNumber(row.comparison.onsetDeltasMs.max)}ms`,
  ].join(' | ');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mediaFiles = collectMediaFiles();
  const trainingFiles = walkFiles(args.trainingDir, ['.json'])
    .filter(file => path.basename(file).startsWith('training_data_'))
    .filter(file => !args.base || stemOf(file) === args.base)
    .slice(0, args.limit);

  const results = [];
  const missing = [];
  for (const trainingFile of trainingFiles) {
    const base = stemOf(trainingFile);
    const mediaFile = findMediaForBase(base, mediaFiles);
    if (!mediaFile) {
      missing.push({ base, trainingFile });
      continue;
    }
    process.stderr.write(`Comparing ${base}...\n`);
    const reference = loadJson(trainingFile);
    const media = readMedia(mediaFile);
    const regenerated = await regenerateTrainingData(media, reference);
    results.push({
      base,
      trainingFile,
      mediaFile,
      comparison: compareTrainingData(reference, regenerated),
    });
  }

  console.log('\n# XGBoost Training Data Regeneration Diff');
  console.log(`Compared files: ${results.length}`);
  if (missing.length > 0) console.log(`Missing media matches: ${missing.length}`);
  console.log('');
  for (const row of results) {
    console.log(`- ${formatSummary(row)}`);
    console.log(`  media: ${row.mediaFile}`);
  }
  if (missing.length > 0) {
    console.log('');
    console.log('Missing media matches:');
    for (const row of missing) {
      console.log(`- ${row.base}: ${row.trainingFile}`);
    }
  }

  const allFeatureDeltas = results.flatMap(row => {
    const summary = row.comparison.featureDeltas;
    return summary.count > 0 ? [summary.max] : [];
  });
  if (results.length > 0) {
    const sameFrameRows = results.filter(row => (
      row.comparison.referenceFrames === row.comparison.regeneratedFrames
    ));
    const frameMismatchRows = results.filter(row => (
      row.comparison.referenceFrames !== row.comparison.regeneratedFrames
    ));
    const sameFrameAggregate = summarizeNumbers(sameFrameRows.map(row => row.comparison.featureDeltas.max));
    console.log('');
    console.log(
      `Same-frame files: ${sameFrameRows.length}; max ${formatNumber(sameFrameAggregate.max)}, `
        + `median ${formatNumber(sameFrameAggregate.median)}, mean ${formatNumber(sameFrameAggregate.mean)}`,
    );
    if (frameMismatchRows.length > 0) {
      console.log(`Frame-count mismatches: ${frameMismatchRows.length}`);
      for (const row of frameMismatchRows) {
        console.log(`- ${row.base}: ${row.comparison.referenceFrames} JSON vs ${row.comparison.regeneratedFrames} regenerated`);
      }
    }

    console.log('');
    console.log('Worst files by feature max delta:');
    for (const row of results.slice().sort((a, b) => (
      b.comparison.featureDeltas.max - a.comparison.featureDeltas.max
    )).slice(0, args.top)) {
      console.log(`- ${row.base}: ${formatNumber(row.comparison.featureDeltas.max)}`);
      for (const feature of row.comparison.topFeatures.slice(0, 5)) {
        console.log(`  ${feature.feature}: max ${formatNumber(feature.max)}, mean ${formatNumber(feature.mean)}`);
      }
    }
    const aggregate = summarizeNumbers(allFeatureDeltas);
    console.log('');
    console.log(`Per-file max-delta aggregate: max ${formatNumber(aggregate.max)}, median ${formatNumber(aggregate.median)}, mean ${formatNumber(aggregate.mean)}`);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
