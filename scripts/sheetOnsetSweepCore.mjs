import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'fs';
import { readFileSync } from 'fs';
import { dirname, relative, resolve } from 'path';
import { DEFAULT_GUITAR_ONSET_OPTIONS } from '../js/shared/audio/guitarOnsetDetector.js';
import { getGuitarOnsetStrategies } from '../js/shared/audio/guitarOnsetStrategies.js';
import { discoverSequenceFixtureSources } from '../tests/helpers/sequenceFixtureLoader.js';
import {
  DEFAULT_TAGGED_ONSET_SCORING,
  percentile,
  scoreTaggedOnsets,
} from './taggedOnsetScoring.mjs';

export { scoreTaggedOnsets } from './taggedOnsetScoring.mjs';

export const DEFAULT_SWEEP_SPEC = Object.freeze({
  fixturesDir: 'tests/fixtures/sequences',
  outputDir: 'sweep-runs',
  beamSize: 5,
  rounds: null,
  candidatesPerRound: 40,
  timeBudgetMinutes: null,
  stagnationRounds: 3,
  stagnationResetInterval: 12,
  stagnationProbeCount: 10,
  minScoreImprovement: 1.0,
  globalResetInterval: 30,
  seed: 1337,
  score: {
    ...DEFAULT_TAGGED_ONSET_SCORING,
  },
  parameters: {
    relativeReattackFactor: [1.4, 4.0],
    relativeReattackMinDelta: [0.004, 0.025],
    relativeFluxFactor: [1.4, 5.0],
    spectralNoveltyRatio: [1.5, 6.0],
    spectralNoveltyMinBins: [6, 64],
    cooldownFrames: [2, 4],
    confirmedRmsFactor: [1.15, 2.2],
    confirmedRmsMinDelta: [0.002, 0.012],
    confirmedFluxFactor: [1.0, 2.4],
    confirmedMinFlux: [0.003, 0.02],
    confirmedMinBandRatio: [0.006, 0.05],
    confirmedSpectralNoveltyMinBins: [2, 32],
    cooldownOverrideFactor: [1.8, 5.0],
    cooldownOverrideMinFlux: [0.004, 0.03],
    cooldownOverrideMinBandRatio: [0.02, 0.09],
  },
});

const ANALYSIS_OPTION_KEYS = new Set([
  'onsetFrameSize',
  'onsetHopSize',
  'analyzeIntervalMs',
]);

const DETECTOR_OPTION_KEYS = new Set(Object.keys(DEFAULT_GUITAR_ONSET_OPTIONS));
const CANDIDATE_METADATA_KEYS = new Set(['strategyKey']);
const INTEGER_PARAMETER_KEYS = new Set([
  'analyzeIntervalMs',
  'onsetFrameSize',
  'onsetHopSize',
  'cooldownFrames',
  'spectralNoveltyMinBins',
  'confirmedSpectralNoveltyMinBins',
]);

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    specPath: null,
    resumeDir: null,
    dryRun: false,
    help: false,
    maxCandidates: null,
    workers: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--spec') {
      args.specPath = argv[++i];
    } else if (arg === '--resume') {
      args.resumeDir = argv[++i];
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--max-candidates') {
      args.maxCandidates = Number(argv[++i]);
    } else if (arg === '--workers') {
      args.workers = Math.max(1, Number(argv[++i]));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

export function formatSweepHelp() {
  return [
    'Usage:',
    '  npm run onsetsweep -- --spec <path> [options]',
    '',
    'Options:',
    '  --spec <path>             JSON sweep spec with fixtures, scoring, and parameter ranges.',
    '  --resume <run-dir>        Continue an existing run directory containing results.jsonl.',
    '  --dry-run                 Validate fixture discovery and parameters without evaluating candidates.',
    '  --max-candidates <n>      Stop after n total evaluated candidates; useful for smoke tests.',
    '  --workers <n>             Number of worker threads (default: half of available CPU cores).',
    '  --help, -h                Show this help.',
    '',
    'Outputs:',
    '  results.jsonl             Complete resumable candidate history.',
    '  report.md                 Current best parameters per onset strategy.',
    '  best-by-strategy.json     Current best candidate summary per strategy.',
    '  best-<strategy>.json      Current best candidate for one strategy.',
    '  best-<strategy>.config.json',
    '                            Best config for sheetfingerprint/sfp --onset-config.',
    '',
    'Example:',
    '  npm run onsetsweep -- --spec plans/sheet_music_onset_repair/onset-sweep-spec.json',
    '  npm run onsetsweep -- --spec plans/sheet_music_onset_repair/onset-sweep-spec.json --resume sweep-runs/onset/<run-dir>',
  ].join('\n');
}

export function loadSweepSpec(specPath = null) {
  const raw = specPath ? JSON.parse(readFileSync(resolve(process.cwd(), specPath), 'utf8')) : {};
  return {
    ...DEFAULT_SWEEP_SPEC,
    ...raw,
    score: {
      ...DEFAULT_SWEEP_SPEC.score,
      ...(raw.score ?? {}),
    },
    parameters: {
      ...DEFAULT_SWEEP_SPEC.parameters,
      ...(raw.parameters ?? {}),
    },
  };
}

export function resolveSweepStrategies(spec = {}) {
  const available = getGuitarOnsetStrategies();
  const requested = spec.strategies;
  if (!Array.isArray(requested) || requested.length === 0) return available;

  return requested.map(key => {
    const strategy = available.find(item => item.key === key);
    if (!strategy) {
      throw new Error(`Unknown onset strategy in sweep spec: ${key}`);
    }
    return strategy;
  });
}

export function createSeededRandom(seed) {
  let state = Math.trunc(seed) >>> 0;
  return function random() {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeTaggedOnsets(manifest) {
  if (!Array.isArray(manifest.onsetsMs)) return null;
  return manifest.onsetsMs
    .filter(Number.isFinite)
    .map(value => Math.round(value))
    .sort((a, b) => a - b);
}

function normalizeExpectedCount(manifest, wavPath) {
  if (Number.isFinite(manifest.expectedCount)) return manifest.expectedCount;
  if (Number.isFinite(manifest.expectedNotes)) return manifest.expectedNotes;
  if (Array.isArray(manifest.expectedNotes)) return manifest.expectedNotes.length;
  if (Array.isArray(manifest.notes)) return manifest.notes.length;
  throw new Error(`Missing expected count in manifest for ${wavPath}`);
}

function applyFixtureOverride(fixture, overrides = {}) {
  return {
    ...fixture,
    ...(overrides[fixture.file] ?? {}),
  };
}

export function discoverSweepFixtures(spec) {
  const fixturesDir = resolve(process.cwd(), spec.fixturesDir);
  const overrides = spec.fixtureOverrides ?? {};
  return discoverSequenceFixtureSources(fixturesDir).map(source => {
    const manifest = source.manifest ?? {};
    const expectedCount = normalizeExpectedCount(manifest, source.sourcePath);
    const file = source.file ?? relative(fixturesDir, source.sourcePath);
    const role = manifest.role ?? 'target';
    const fixture = {
      ...source,
      file,
      manifest,
      role,
      expectedCount,
      taggedOnsetsMs: normalizeTaggedOnsets(manifest),
      minOnsets: manifest.minOnsets ?? expectedCount,
      maxOnsets: manifest.maxOnsets ?? expectedCount,
      weight: manifest.weight ?? (role === 'guardrail' ? 3 : 1),
    };
    const resolvedFixture = applyFixtureOverride(fixture, overrides);
    if (!Array.isArray(resolvedFixture.taggedOnsetsMs)) {
      throw new Error(`Sweep fixture requires tagged onsets: ${resolvedFixture.file}`);
    }
    return resolvedFixture;
  });
}

function sampleParameterValue(key, definition, random) {
  if (Array.isArray(definition) && definition.length === 2 && definition.every(Number.isFinite)) {
    const [min, max] = definition;
    const value = min + (max - min) * random();
    return INTEGER_PARAMETER_KEYS.has(key) ? Math.round(value) : roundParameter(value);
  }
  if (Array.isArray(definition) && definition.length > 0) {
    return definition[Math.floor(random() * definition.length)];
  }
  throw new Error(`Invalid parameter definition for ${key}`);
}

function mutateParameterValue(key, value, definition, radius, random) {
  if (Array.isArray(definition) && definition.length === 2 && definition.every(Number.isFinite)) {
    const [min, max] = definition;
    const span = max - min;
    const delta = (random() * 2 - 1) * span * radius;
    const next = Math.min(max, Math.max(min, value + delta));
    return INTEGER_PARAMETER_KEYS.has(key) ? Math.round(next) : roundParameter(next);
  }
  if (Array.isArray(definition) && definition.length > 0) {
    return definition[Math.floor(random() * definition.length)];
  }
  return value;
}

function roundParameter(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function candidateToOptions(parameters) {
  const options = {};
  const onsetDetectorOptions = {};

  for (const [key, value] of Object.entries(parameters)) {
    if (CANDIDATE_METADATA_KEYS.has(key)) {
      continue;
    } else if (ANALYSIS_OPTION_KEYS.has(key)) {
      options[key] = value;
    } else if (DETECTOR_OPTION_KEYS.has(key)) {
      onsetDetectorOptions[key] = value;
    } else {
      throw new Error(`Unknown onset parameter: ${key}`);
    }
  }

  if (Object.keys(onsetDetectorOptions).length > 0) {
    options.onsetDetectorOptions = onsetDetectorOptions;
  }

  return options;
}

export function candidateKey(parameters) {
  return JSON.stringify(Object.fromEntries(
    Object.entries(parameters).sort(([a], [b]) => a.localeCompare(b)),
  ));
}

export function createInitialCandidates(spec, count, random) {
  const parameters = spec.parameters ?? {};
  return Array.from({ length: count }, () => Object.fromEntries(
    Object.entries(parameters).map(([key, definition]) => [
      key,
      sampleParameterValue(key, definition, random),
    ]),
  ));
}

export function createInitialCandidatesForStrategy(spec, strategyKey, count, random) {
  return createInitialCandidates(spec, count, random).map(parameters => ({
    strategyKey,
    ...parameters,
  }));
}

export function createRefinedCandidates(spec, beam, count, roundIndex, random) {
  if (beam.length === 0) return createInitialCandidates(spec, count, random);

  const radius = Math.max(0.04, 0.35 / Math.max(1, roundIndex));
  const generated = [];
  for (let i = 0; i < count; i++) {
    const parent = beam[i % beam.length].parameters;
    generated.push(Object.fromEntries(
      Object.entries(spec.parameters).map(([key, definition]) => [
        key,
        mutateParameterValue(key, parent[key], definition, radius, random),
      ]),
    ));
  }
  return generated;
}

export function createRefinedCandidatesForStrategy(spec, strategyKey, beam, count, roundIndex, random) {
  if (beam.length === 0) return createInitialCandidatesForStrategy(spec, strategyKey, count, random);

  return createRefinedCandidates(spec, beam, count, roundIndex, random).map(parameters => ({
    strategyKey,
    ...parameters,
  }));
}

export function createStagnationProbeCandidates(spec, strategyKey, beam, count, random) {
  if (beam.length === 0) return createInitialCandidatesForStrategy(spec, strategyKey, count, random);

  const best = beam[0].parameters;
  const paramKeys = Object.keys(spec.parameters);
  return Array.from({ length: count }, () => {
    const probeKey = paramKeys[Math.floor(random() * paramKeys.length)];
    return {
      strategyKey,
      ...Object.fromEntries(
        Object.entries(spec.parameters).map(([key, definition]) => [
          key,
          key === probeKey ? sampleParameterValue(key, definition, random) : best[key],
        ]),
      ),
    };
  });
}

export function scoreTimedFixture(fixture, detectedOnsetsMs = [], scoreSpec = DEFAULT_SWEEP_SPEC.score) {
  if (!Array.isArray(fixture.taggedOnsetsMs)) {
    throw new Error(`Sweep fixture requires tagged onsets: ${fixture.file ?? '<unknown>'}`);
  }
  const weight = fixture.weight ?? 1;
  const taggedScore = scoreTaggedOnsets(fixture.taggedOnsetsMs, detectedOnsetsMs, scoreSpec);
  const within = taggedScore.misses === 0 && taggedScore.falsePositives === 0;
  return {
    ...taggedScore,
    score: weight * taggedScore.score,
    under: taggedScore.misses,
    over: taggedScore.falsePositives,
    within,
    scoringMode: 'timed',
  };
}

export function scoreCandidate(candidate, fixtureResults, scoreSpec = DEFAULT_SWEEP_SPEC.score) {
  let score = 0;
  let under = 0;
  let over = 0;
  let exact = 0;
  let totalOnsets = 0;
  let totalTaggedOnsets = 0;
  let goodMatches = 0;
  let acceptableMatches = 0;
  let misses = 0;
  let falsePositives = 0;
  let duplicates = 0;
  const timingErrorsMs = [];
  const rows = fixtureResults.map(row => {
    if (!Array.isArray(row.timestampsMs)) {
      throw new Error(`Sweep result requires onset timestamps: ${row.fixture?.file ?? '<unknown>'}`);
    }
    const fixtureScore = scoreTimedFixture(row.fixture, row.timestampsMs, scoreSpec);
    score += fixtureScore.score;
    under += fixtureScore.under;
    over += fixtureScore.over;
    exact += fixtureScore.within ? 1 : 0;
    totalOnsets += row.onsetCount;
    totalTaggedOnsets += row.fixture.taggedOnsetsMs?.length ?? 0;
    goodMatches += fixtureScore.goodMatches ?? 0;
    acceptableMatches += fixtureScore.acceptableMatches ?? 0;
    misses += fixtureScore.misses ?? 0;
    falsePositives += fixtureScore.falsePositives ?? 0;
    duplicates += fixtureScore.duplicates ?? 0;
    timingErrorsMs.push(...(fixtureScore.errorsMs ?? []));
    return { ...row, ...fixtureScore };
  });

  return {
    id: candidate.id,
    round: candidate.round,
    strategyKey: candidate.strategyKey ?? candidate.parameters?.strategyKey ?? null,
    parameters: candidate.parameters,
    options: candidateToOptions(candidate.parameters),
    score,
    metrics: {
      exact,
      under,
      over,
      totalOnsets,
      totalTaggedOnsets,
      goodMatches,
      acceptableMatches,
      misses,
      falsePositives,
      duplicates,
      meanAbsErrorMs: timingErrorsMs.length > 0
        ? timingErrorsMs.reduce((sum, value) => sum + value, 0) / timingErrorsMs.length
        : null,
      p95AbsErrorMs: percentile(timingErrorsMs, 0.95),
    },
    fixtures: rows,
  };
}

export function sortResults(results) {
  return [...results].sort((a, b) => (
    b.score - a.score
    || (a.metrics.falsePositives ?? 0) - (b.metrics.falsePositives ?? 0)
    || (a.metrics.duplicates ?? 0) - (b.metrics.duplicates ?? 0)
    || (a.metrics.misses ?? 0) - (b.metrics.misses ?? 0)
    || (a.metrics.p95AbsErrorMs ?? Infinity) - (b.metrics.p95AbsErrorMs ?? Infinity)
    || a.id.localeCompare(b.id)
  ));
}

export function ensureRunDir(spec, resumeDir = null) {
  if (resumeDir) return resolve(process.cwd(), resumeDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = resolve(process.cwd(), spec.outputDir ?? DEFAULT_SWEEP_SPEC.outputDir, stamp);
  mkdirSync(runDir, { recursive: true });
  return runDir;
}

export function readJsonl(filePath) {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

export function writeJson(filePath, value) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function formatCsvRow(values) {
  return values.map(value => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }).join(',');
}

function formatParameterValue(value) {
  return Number.isFinite(value) && !Number.isInteger(value)
    ? String(Math.round(value * 1_000_000) / 1_000_000)
    : String(value ?? '');
}

export function formatReport(results, spec, fixtures) {
  const strategyKeys = [...new Set(results.map(row => row.strategyKey).filter(Boolean))].sort();
  const lines = [
    '# Sheet Onset Sweep',
    '',
    `- evaluated candidates: ${results.length}`,
    `- beam size: ${spec.beamSize}`,
    `- fixtures: ${fixtures.length}`,
    '',
    '## Current Best By Strategy',
  ];

  for (const strategyKey of strategyKeys) {
    const row = sortResults(results.filter(candidate => candidate.strategyKey === strategyKey))[0];
    if (!row) continue;
    lines.push(
      '',
      `### ${strategyKey}`,
      '',
      `- id: ${row.id}`,
      `- round: ${row.round}`,
      `- score: ${row.score.toFixed(2)}`,
      `- good/acceptable/misses/false positives: ${row.metrics.goodMatches ?? 0}/${row.metrics.acceptableMatches ?? 0}/${row.metrics.misses ?? row.metrics.under ?? 0}/${row.metrics.falsePositives ?? row.metrics.over ?? 0}`,
      '',
      '| parameter | value |',
      '|---|---:|',
    );
    for (const [key, value] of Object.entries(row.parameters)) {
      if (key === 'strategyKey') continue;
      lines.push(`| ${key} | ${formatParameterValue(value)} |`);
    }
  }

  return `${lines.join('\n')}\n`;
}
