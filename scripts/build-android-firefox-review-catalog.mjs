import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRAINING_DIR = 'ml/data/android_firefox';
const OUTPUT_FILE = 'js/data/android-firefox-training-review-catalog.json';
const DEFAULT_METRICS_FILE = 'models/onset_detector_android_firefox.metrics.json';
const MEDIA_ROOTS = [
  'tests/fixtures/sequences',
  'tests/fixtures/dropsequence',
  TRAINING_DIR,
];
const STOP_TOKENS = new Set([
  'training',
  'data',
  'tagged',
  'json',
  'wav',
  'zip',
  'notenlesen',
]);

function repoPath(relativePath) {
  return path.join(REPO_ROOT, relativePath);
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function urlFor(relativePath) {
  return `../../${toPosix(relativePath)}`;
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(repoPath(relativePath), 'utf8'));
}

function walkFiles(relativeDir, extensions, results = []) {
  const absoluteDir = repoPath(relativeDir);
  if (!existsSync(absoluteDir)) return results;
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const child = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(child, extensions, results);
    } else if (extensions.some(extension => entry.name.toLowerCase().endsWith(extension))) {
      results.push(child);
    }
  }
  return results;
}

function stem(filePath) {
  return path.basename(filePath).replace(/\.[^.]+$/, '');
}

function normalizeStem(value) {
  return String(value ?? '')
    .replace(/^training_data_/i, '')
    .replace(/-tagged$/i, '')
    .replace(/_tagged$/i, '')
    .toLowerCase();
}

function tokensFor(value) {
  return normalizeStem(value)
    .split(/[^a-z0-9]+/i)
    .filter(token => token.length >= 3 && !STOP_TOKENS.has(token));
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function scoreMatch(mediaStem, trainingStem) {
  const mediaNorm = normalizeStem(mediaStem);
  const trainingNorm = normalizeStem(trainingStem);
  if (mediaNorm === trainingNorm) return 1000;
  let score = 0;
  if (mediaNorm && trainingNorm && (mediaNorm.startsWith(trainingNorm) || trainingNorm.startsWith(mediaNorm))) {
    score += 50;
  }
  const mediaTokens = new Set(tokensFor(mediaStem));
  for (const token of tokensFor(trainingStem)) {
    if (!mediaTokens.has(token)) continue;
    score += token.length >= 5 ? 8 : 3;
  }
  return score;
}

function loadTrainingFiles() {
  return walkFiles(TRAINING_DIR, ['.json'])
    .filter(file => path.basename(file).startsWith('training_data_'))
    .map(file => {
      let metadata = {};
      let expected = null;
      try {
        const data = readJson(file);
        metadata = data.metadata ?? {};
        expected = Array.isArray(data.annotations?.onsetsMs) ? data.annotations.onsetsMs.length : null;
      } catch {
        // Keep the file in the catalog matching pool even if it is malformed.
      }
      return {
        file: toPosix(file),
        stem: stem(file),
        url: urlFor(file),
        metadata,
        expected,
      };
    });
}

function loadMetrics() {
  const metricsFile = process.env.METRICS_FILE || DEFAULT_METRICS_FILE;
  if (!existsSync(repoPath(metricsFile))) return { source: null, byFile: new Map() };
  const metrics = readJson(metricsFile);
  const byFile = new Map();
  for (const row of metrics.peak_picking?.per_file ?? []) {
    if (!row?.file) continue;
    const precision = row.detected > 0 ? row.tp / row.detected : null;
    const recall = row.expected > 0 ? row.tp / row.expected : null;
    const f1 = precision !== null && recall !== null && precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : null;
    byFile.set(row.file, {
      expected: row.expected,
      detected: row.detected,
      tp: row.tp,
      fp: row.fp,
      fn: row.fn,
      precision,
      recall,
      f1,
    });
  }
  return { source: toPosix(metricsFile), byFile };
}

function findLooseJsonForWav(wavPath) {
  const candidate = wavPath.replace(/\.wav$/i, '.json');
  return existsSync(repoPath(candidate)) ? toPosix(candidate) : null;
}

function loadMediaFiles() {
  const seen = new Set();
  const files = [];
  for (const root of MEDIA_ROOTS) {
    for (const file of walkFiles(root, ['.zip', '.wav'])) {
      const rel = toPosix(file);
      if (seen.has(rel)) continue;
      seen.add(rel);
      files.push(file);
    }
  }
  return files.sort((a, b) => toPosix(a).localeCompare(toPosix(b), 'de-DE'));
}

function bestTrainingMatch(mediaStem, trainingFiles) {
  let best = null;
  let secondScore = 0;
  for (const training of trainingFiles) {
    const score = scoreMatch(mediaStem, training.stem);
    if (!best || score > best.score) {
      secondScore = best?.score ?? 0;
      best = { training, score };
    } else if (score > secondScore) {
      secondScore = score;
    }
  }
  if (!best || best.score < 5) return { status: 'none', training: null, score: 0 };
  if (best.score === secondScore) return { status: 'ambiguous', training: best.training, score: best.score };
  return {
    status: best.score >= 1000 ? 'exact' : 'fuzzy',
    training: best.training,
    score: best.score,
  };
}

function buildCatalog() {
  const trainingFiles = loadTrainingFiles();
  const { source: metricsSource, byFile } = loadMetrics();
  const matchedTrainingFiles = new Set();
  const entries = loadMediaFiles().map(file => {
    const rel = toPosix(file);
    const kind = rel.toLowerCase().endsWith('.zip') ? 'zip' : 'wav';
    const mediaStem = stem(file);
    const match = bestTrainingMatch(mediaStem, trainingFiles);
    const training = match.training;
    if (training) matchedTrainingFiles.add(training.file);
    const metrics = training ? byFile.get(path.basename(training.file)) ?? null : null;
    const fallbackExpected = training?.expected ?? null;
    const jsonPath = kind === 'wav' ? findLooseJsonForWav(rel) : null;
    return {
      id: `${normalizeStem(mediaStem)}-${hashString(rel)}`,
      name: mediaStem,
      baseName: mediaStem.replace(/-tagged$/i, ''),
      kind,
      url: urlFor(rel),
      jsonUrl: jsonPath ? urlFor(jsonPath) : null,
      sidecarInZip: kind === 'zip',
      trainingFile: training?.file ?? null,
      trainingJsonUrl: training?.url ?? null,
      match: {
        status: match.status,
        score: match.score,
      },
      metrics: metrics ?? (fallbackExpected !== null ? {
        expected: fallbackExpected,
        detected: null,
        tp: null,
        fp: null,
        fn: null,
        precision: null,
        recall: null,
        f1: null,
      } : null),
    };
  });

  for (const training of trainingFiles) {
    if (matchedTrainingFiles.has(training.file)) continue;
    const metrics = byFile.get(path.basename(training.file)) ?? null;
    entries.push({
      id: `${normalizeStem(training.stem)}-${hashString(training.file)}`,
      name: training.stem,
      baseName: training.stem.replace(/^training_data_/i, ''),
      kind: 'json',
      url: null,
      jsonUrl: training.url,
      sidecarInZip: false,
      trainingFile: training.file,
      trainingJsonUrl: training.url,
      match: {
        status: 'json-only',
        score: 0,
      },
      metrics,
    });
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    metricsSource,
    entries,
  };
}

const catalog = buildCatalog();
const outputPath = repoPath(OUTPUT_FILE);
writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Wrote ${OUTPUT_FILE} with ${catalog.entries.length} entries.`);
