import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readZip } from '../js/shared/zip.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_FILE = 'js/data/android-firefox-training-review-catalog.json';
const DEFAULT_METRICS_FILE = 'models/onset_detector_android_firefox.metrics.json';
const DEFAULT_MEDIA_ROOT = 'tests/fixtures/sequences/sheet-music-reading';
const MEDIA_ROOTS = (process.env.TRAINING_MEDIA_DIRS ?? process.env.TRAINING_MEDIA_DIR ?? DEFAULT_MEDIA_ROOT)
  .split(path.delimiter)
  .map(value => value.trim())
  .filter(Boolean);

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

function normalizeBaseName(value) {
  return String(value ?? '')
    .replace(/^training_data_/i, '')
    .replace(/-tagged$/i, '')
    .replace(/_tagged$/i, '')
    .toLowerCase();
}

function displayBaseName(value) {
  return String(value ?? '')
    .replace(/^training_data_/i, '')
    .replace(/-tagged$/i, '')
    .replace(/_tagged$/i, '');
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function countExpectedOnsets(sidecar) {
  const candidates = [
    sidecar?.onsetsMs,
    sidecar?.annotations?.onsetsMs,
    sidecar?.metadata?.onsetsMs,
  ];
  const onsets = candidates.find(Array.isArray);
  return onsets ? onsets.length : null;
}

function metricFromRow(row) {
  const precision = row.detected > 0 ? row.tp / row.detected : null;
  const recall = row.expected > 0 ? row.tp / row.expected : null;
  const f1 = precision !== null && recall !== null && precision + recall > 0
    ? (2 * precision * recall) / (precision + recall)
    : null;
  return {
    expected: row.expected,
    detected: row.detected,
    tp: row.tp,
    fp: row.fp,
    fn: row.fn,
    precision,
    recall,
    f1,
  };
}

function loadMetrics() {
  const metricsFile = process.env.METRICS_FILE || DEFAULT_METRICS_FILE;
  if (!existsSync(repoPath(metricsFile))) return { source: null, byBaseName: new Map() };
  const metrics = readJson(metricsFile);
  const byBaseName = new Map();
  for (const row of metrics.peak_picking?.per_file ?? []) {
    if (!row?.file) continue;
    const metricBaseName = normalizeBaseName(stem(row.file));
    if (!metricBaseName) continue;
    byBaseName.set(metricBaseName, metricFromRow(row));
  }
  return { source: toPosix(metricsFile), byBaseName };
}

function findLooseJsonForWav(wavPath) {
  const candidate = wavPath.replace(/\.wav$/i, '.json');
  return existsSync(repoPath(candidate)) ? toPosix(candidate) : null;
}

function loadZipSidecar(zipPath) {
  try {
    const entries = readZip(new Uint8Array(readFileSync(repoPath(zipPath))));
    const jsonEntry = entries.find(entry => entry.name.toLowerCase().endsWith('.json'));
    if (!jsonEntry) return { sidecarInZip: false, expected: null };
    const sidecar = JSON.parse(new TextDecoder().decode(jsonEntry.data));
    return { sidecarInZip: true, expected: countExpectedOnsets(sidecar) };
  } catch {
    return { sidecarInZip: false, expected: null };
  }
}

function loadLooseSidecar(jsonPath) {
  if (!jsonPath) return { expected: null };
  try {
    return { expected: countExpectedOnsets(readJson(jsonPath)) };
  } catch {
    return { expected: null };
  }
}

function fallbackMetrics(expected) {
  if (!Number.isFinite(expected)) return null;
  return {
    expected,
    detected: null,
    tp: null,
    fp: null,
    fn: null,
    precision: null,
    recall: null,
    f1: null,
  };
}

function loadMediaFiles() {
  const seen = new Set();
  const files = [];
  for (const root of MEDIA_ROOTS) {
    for (const file of walkFiles(root, ['.zip', '.wav'])) {
      const rel = toPosix(file);
      const lower = rel.toLowerCase();
      if (!lower.endsWith('-tagged.zip') && !lower.endsWith('.wav')) continue;
      if (seen.has(rel)) continue;
      seen.add(rel);
      files.push(file);
    }
  }
  return files.sort((a, b) => toPosix(a).localeCompare(toPosix(b), 'de-DE'));
}

function buildEntry(file, metricsByBaseName) {
  const rel = toPosix(file);
  const kind = rel.toLowerCase().endsWith('.zip') ? 'zip' : 'wav';
  const name = stem(file);
  const baseName = displayBaseName(name);
  const normalizedBaseName = normalizeBaseName(baseName);
  const jsonPath = kind === 'wav' ? findLooseJsonForWav(rel) : null;
  const sidecar = kind === 'zip' ? loadZipSidecar(rel) : loadLooseSidecar(jsonPath);
  const metrics = metricsByBaseName.get(normalizedBaseName) ?? fallbackMetrics(sidecar.expected);
  const sidecarStatus = kind === 'zip'
    ? (sidecar.sidecarInZip ? 'tagged-zip' : 'missing-sidecar')
    : (jsonPath ? 'wav-json' : 'missing-sidecar');

  return {
    id: `${normalizedBaseName}-${hashString(rel)}`,
    name,
    baseName,
    kind,
    url: urlFor(rel),
    jsonUrl: jsonPath ? urlFor(jsonPath) : null,
    sidecarInZip: kind === 'zip' ? sidecar.sidecarInZip : false,
    trainingFile: `training_data_${baseName}.json`,
    trainingJsonUrl: null,
    match: {
      status: sidecarStatus,
      score: sidecarStatus === 'missing-sidecar' ? 0 : 1000,
    },
    metrics,
  };
}

function buildCatalog() {
  const { source: metricsSource, byBaseName } = loadMetrics();
  const entries = loadMediaFiles().map(file => buildEntry(file, byBaseName));

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mediaRoots: MEDIA_ROOTS.map(toPosix),
    metricsSource,
    entries,
  };
}

const catalog = buildCatalog();
const outputPath = repoPath(OUTPUT_FILE);
writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Wrote ${OUTPUT_FILE} with ${catalog.entries.length} tagged media entries.`);
