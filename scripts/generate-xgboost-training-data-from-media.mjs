import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { availableParallelism } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { isMainThread, parentPort, workerData, Worker } from 'worker_threads';

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
const DEFAULT_MEDIA_DIR = 'tests/fixtures/sequences/sheet-music-reading';
const DEFAULT_STRATEGY_KEY = 'xgboost-android-firefox';

function repoPath(relativePath) {
  return path.join(REPO_ROOT, relativePath);
}

function outputPath(filePath) {
  return path.isAbsolute(filePath) ? filePath : repoPath(filePath);
}

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function parseArgs(argv) {
  const args = {
    mediaDir: DEFAULT_MEDIA_DIR,
    outputDir: null,
    strategyKey: DEFAULT_STRATEGY_KEY,
    clean: false,
    limit: Number.POSITIVE_INFINITY,
    jobs: process.env.TRAINING_DATA_JOBS ?? 'auto',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--media-dir') args.mediaDir = argv[++index];
    else if (arg === '--output-dir') args.outputDir = argv[++index];
    else if (arg === '--strategy-key') args.strategyKey = argv[++index];
    else if (arg === '--limit') args.limit = Number(argv[++index]);
    else if (arg === '--jobs') args.jobs = argv[++index];
    else if (arg === '--clean') args.clean = true;
    else if (arg === '-h' || arg === '--help') {
      console.log([
        'Usage: node scripts/generate-xgboost-training-data-from-media.mjs --output-dir DIR [--media-dir DIR] [--jobs N|auto] [--clean]',
        '',
        'Generates temporary XGBoost training_data_*.json files from tagged ZIP/WAV fixtures.',
        'Feature extraction runs through the shared JS/browser feature code, not Python.',
      ].join('\n'));
      process.exit(0);
    }
  }
  if (!args.outputDir) {
    throw new Error('--output-dir is required');
  }
  return args;
}

function parseJobCount(rawJobs, mediaCount) {
  if (mediaCount <= 1) return 1;
  const raw = String(rawJobs ?? 'auto').trim().toLowerCase();
  if (raw === '' || raw === 'auto') {
    const cpuCount = typeof availableParallelism === 'function' ? availableParallelism() : 2;
    return Math.max(1, Math.min(mediaCount, Math.max(1, cpuCount - 1)));
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`--jobs must be a positive integer or "auto", got: ${rawJobs}`);
  }
  return Math.min(parsed, mediaCount);
}

function walkMediaFiles(relativeDir, results = []) {
  const absoluteDir = repoPath(relativeDir);
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const child = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      walkMediaFiles(child, results);
      continue;
    }
    const lower = entry.name.toLowerCase();
    if (lower.endsWith('-tagged.zip') || lower.endsWith('.wav')) {
      results.push(toPosix(child));
    }
  }
  return results.sort((a, b) => a.localeCompare(b, 'de-DE'));
}

function parseJsonBytes(bytes, label) {
  try {
    return JSON.parse(Buffer.from(bytes).toString('utf8'));
  } catch (error) {
    throw new Error(`Invalid JSON in ${label}: ${error.message}`, { cause: error });
  }
}

function readMedia(relativePath) {
  const bytes = readFileSync(repoPath(relativePath));
  if (relativePath.toLowerCase().endsWith('.wav')) {
    const jsonPath = relativePath.replace(/\.wav$/i, '.json');
    return {
      source: relativePath,
      baseName: path.basename(relativePath).replace(/\.[^.]+$/, ''),
      wavName: path.basename(relativePath),
      wavBytes: bytes,
      manifest: readdirSafe(path.dirname(repoPath(relativePath))).includes(path.basename(jsonPath))
        ? JSON.parse(readFileSync(repoPath(jsonPath), 'utf8'))
        : null,
    };
  }

  const entries = readZip(new Uint8Array(bytes));
  const wavEntry = entries.find(entry => entry.name.toLowerCase().endsWith('.wav'));
  if (!wavEntry) throw new Error(`No WAV entry in ${relativePath}`);
  const wavStem = path.basename(wavEntry.name, '.wav');
  const jsonEntry = entries.find(entry => (
    entry.name.toLowerCase() === `${wavStem.toLowerCase()}.json`
      || path.basename(entry.name, '.json').toLowerCase() === wavStem.toLowerCase()
  )) ?? entries.find(entry => entry.name.toLowerCase().endsWith('.json'));

  return {
    source: relativePath,
    baseName: wavStem,
    wavName: path.basename(wavEntry.name),
    wavBytes: Buffer.from(wavEntry.data),
    manifest: jsonEntry ? parseJsonBytes(jsonEntry.data, `${relativePath}#${jsonEntry.name}`) : null,
  };
}

function readdirSafe(absoluteDir) {
  try {
    return readdirSync(absoluteDir);
  } catch {
    return [];
  }
}

async function buildTrainingData(media, strategyKey) {
  const { samples, sampleRate } = decodeWav(Buffer.from(media.wavBytes));
  const frames = await collectFrameData(samples, sampleRate, ONSET_FFT_SIZE, ONSET_HOP_SIZE);
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
      filename: media.baseName,
      source: media.source,
      sampleRate,
      fftSize: ONSET_FFT_SIZE,
      hopSize: ONSET_HOP_SIZE,
      frameCount: frames.length,
      featureOrder,
      onsetStrategyKey: strategyKey,
    },
    frames: trainingFrames,
    annotations: {
      onsetsMs: Array.isArray(media.manifest?.onsetsMs) ? media.manifest.onsetsMs : null,
    },
  };
}

function outputNameFor(baseName) {
  return `training_data_${baseName.replace(/\.[^.]+$/, '')}.json`;
}

async function generateTrainingFile({ mediaFile, outputDir, strategyKey }) {
  const media = readMedia(mediaFile);
  if (!Array.isArray(media.manifest?.onsetsMs)) {
    return {
      status: 'skipped',
      mediaFile,
      reason: 'no onsetsMs sidecar',
    };
  }

  process.stderr.write(`Generating ${media.baseName}...\n`);
  const trainingData = await buildTrainingData(media, strategyKey);
  const targetPath = path.join(outputDir, outputNameFor(media.baseName));
  writeFileSync(targetPath, JSON.stringify(trainingData));
  return {
    status: 'written',
    mediaFile,
    baseName: media.baseName,
    targetPath,
  };
}

function runWorker(task) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(fileURLToPath(import.meta.url), {
      workerData: task,
    });
    worker.once('message', result => {
      if (result?.ok) resolve(result.value);
      else reject(new Error(result?.error?.message ?? 'Worker failed'));
    });
    worker.once('error', reject);
    worker.once('exit', code => {
      if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
    });
  });
}

async function runWorkerPool(tasks, jobCount) {
  const results = [];
  let nextTaskIndex = 0;

  async function runNext() {
    while (nextTaskIndex < tasks.length) {
      const task = tasks[nextTaskIndex];
      nextTaskIndex += 1;
      results.push(await runWorker(task));
    }
  }

  await Promise.all(Array.from({ length: jobCount }, () => runNext()));
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputDir = outputPath(args.outputDir);
  if (args.clean) rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const mediaFiles = walkMediaFiles(args.mediaDir).slice(0, args.limit);
  const jobCount = parseJobCount(args.jobs, mediaFiles.length);
  process.stderr.write(`Using ${jobCount} training data worker${jobCount === 1 ? '' : 's'}\n`);

  const tasks = mediaFiles.map(mediaFile => ({
    mediaFile,
    outputDir,
    strategyKey: args.strategyKey,
  }));
  const results = await runWorkerPool(tasks, jobCount);
  const written = results.filter(result => result.status === 'written').length;
  for (const result of results) {
    if (result.status === 'skipped') {
      process.stderr.write(`Skipping ${result.mediaFile}: ${result.reason}\n`);
    }
  }

  console.log(JSON.stringify({
    mediaDir: args.mediaDir,
    outputDir: args.outputDir,
    filesScanned: mediaFiles.length,
    filesWritten: written,
    jobs: jobCount,
  }));
}

async function workerMain() {
  try {
    parentPort.postMessage({
      ok: true,
      value: await generateTrainingFile(workerData),
    });
  } catch (error) {
    parentPort.postMessage({
      ok: false,
      error: {
        message: error?.message ?? String(error),
      },
    });
  }
}

if (isMainThread) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
} else {
  workerMain();
}
