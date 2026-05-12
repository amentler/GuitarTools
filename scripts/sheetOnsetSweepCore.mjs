import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'fs';
import { basename, dirname, join, relative, resolve } from 'path';
import { DEFAULT_GUITAR_ONSET_OPTIONS } from '../js/shared/audio/guitarOnsetDetector.js';

export const DEFAULT_SWEEP_SPEC = Object.freeze({
  fixturesDir: 'tests/fixtures/sequences',
  outputDir: 'sweep-runs',
  beamSize: 5,
  rounds: null,
  candidatesPerRound: 40,
  timeBudgetMinutes: null,
  stagnationRounds: 3,
  minScoreImprovement: 1.0,
  globalResetInterval: 30,
  seed: 1337,
  score: {
    underPenalty: 4,
    overPenalty: 2,
    extremeUnderPenalty: 20,
    extremeUnderMultiplier: 0.75,
    extremeOverPenalty: 20,
    extremeOverMultiplier: 1.4,
    guardrailOverMultiplier: 1.4,
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
    '  --help, -h                Show this help.',
    '',
    'Outputs:',
    '  results.jsonl             Complete resumable candidate history.',
    '  results.csv               Ranked candidate summary.',
    '  report.md                 Human-readable report with fixture counts.',
    '  best-001.config.json      Best config for sheetfingerprint/sfp --onset-config.',
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

function collectWavFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectWavFiles(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.wav')) {
      files.push(fullPath);
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function readFixtureManifest(wavPath) {
  const jsonPath = join(dirname(wavPath), `${basename(wavPath, '.wav')}.json`);
  if (!existsSync(jsonPath)) return {};
  return JSON.parse(readFileSync(jsonPath, 'utf8'));
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
  return collectWavFiles(fixturesDir).map(wavPath => {
    const manifest = readFixtureManifest(wavPath);
    const expectedCount = normalizeExpectedCount(manifest, wavPath);
    const file = relative(fixturesDir, wavPath);
    const role = manifest.role ?? 'target';
    const fixture = {
      file,
      wavPath,
      manifest,
      role,
      expectedCount,
      minOnsets: manifest.minOnsets ?? expectedCount,
      maxOnsets: manifest.maxOnsets ?? expectedCount,
      weight: manifest.weight ?? (role === 'guardrail' ? 3 : 1),
    };
    return applyFixtureOverride(fixture, overrides);
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
    if (ANALYSIS_OPTION_KEYS.has(key)) {
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

export function scoreFixture(fixture, onsetCount, scoreSpec = DEFAULT_SWEEP_SPEC.score) {
  const scoring = {
    ...DEFAULT_SWEEP_SPEC.score,
    ...scoreSpec,
  };
  const minOnsets = fixture.minOnsets ?? fixture.expectedCount;
  const maxOnsets = fixture.maxOnsets ?? fixture.expectedCount;
  const weight = fixture.weight ?? 1;
  const under = Math.max(0, minOnsets - onsetCount);
  const over = Math.max(0, onsetCount - maxOnsets);
  const within = under === 0 && over === 0;
  const expected = Math.max(1, fixture.expectedCount);
  const extremeUnderLimit = Math.floor(expected * scoring.extremeUnderMultiplier);
  const extremeUnder = onsetCount < extremeUnderLimit
    ? extremeUnderLimit - onsetCount
    : 0;
  const extremeOverMultiplier = scoring.extremeOverMultiplier ?? scoring.guardrailOverMultiplier;
  const extremeLimit = Math.ceil(expected * extremeOverMultiplier);
  const extremeOver = onsetCount > extremeLimit
    ? onsetCount - extremeLimit
    : 0;

  return {
    score: weight * (
      (within ? expected : 0)
      - under * scoring.underPenalty
      - over * scoring.overPenalty
      - extremeUnder * scoring.extremeUnderPenalty
      - extremeOver * scoring.extremeOverPenalty
    ),
    under,
    over,
    extremeUnder,
    extremeOver,
    within,
  };
}

export function scoreCandidate(candidate, fixtureResults, scoreSpec = DEFAULT_SWEEP_SPEC.score) {
  let score = 0;
  let under = 0;
  let over = 0;
  let extremeUnder = 0;
  let extremeOver = 0;
  let exact = 0;
  let totalOnsets = 0;
  const rows = fixtureResults.map(row => {
    const fixtureScore = scoreFixture(row.fixture, row.onsetCount, scoreSpec);
    score += fixtureScore.score;
    under += fixtureScore.under;
    over += fixtureScore.over;
    extremeUnder += fixtureScore.extremeUnder;
    extremeOver += fixtureScore.extremeOver;
    exact += fixtureScore.within ? 1 : 0;
    totalOnsets += row.onsetCount;
    return { ...row, ...fixtureScore };
  });

  return {
    id: candidate.id,
    round: candidate.round,
    parameters: candidate.parameters,
    options: candidateToOptions(candidate.parameters),
    score,
    metrics: {
      exact,
      under,
      over,
      extremeUnder,
      extremeOver,
      totalOnsets,
    },
    fixtures: rows,
  };
}

export function sortResults(results) {
  return [...results].sort((a, b) => (
    b.score - a.score
    || (a.metrics.extremeUnder ?? 0) - (b.metrics.extremeUnder ?? 0)
    || (a.metrics.extremeOver ?? 0) - (b.metrics.extremeOver ?? 0)
    || (a.metrics.over ?? 0) - (b.metrics.over ?? 0)
    || (a.metrics.under ?? 0) - (b.metrics.under ?? 0)
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

export function formatReport(results, spec, fixtures) {
  const best = sortResults(results).slice(0, spec.beamSize ?? DEFAULT_SWEEP_SPEC.beamSize);
  const lines = [
    '# Sheet Onset Sweep',
    '',
    `- evaluated candidates: ${results.length}`,
    `- beam size: ${spec.beamSize}`,
    `- fixtures: ${fixtures.length}`,
    '',
    '## Best Candidates',
    '| rank | id | round | score | exact | under | over | extreme under | extreme over | total onsets |',
    '|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...best.map((row, index) => (
      `| ${index + 1} | ${row.id} | ${row.round} | ${row.score.toFixed(2)} | `
      + `${row.metrics.exact} | ${row.metrics.under} | ${row.metrics.over} | `
      + `${row.metrics.extremeUnder ?? 0} | ${row.metrics.extremeOver ?? 0} | `
      + `${row.metrics.totalOnsets} |`
    )),
    '',
    '## Best Fixture Counts',
  ];

  for (const row of best) {
    lines.push('', `### ${row.id}`, '', '| fixture | role | expected | range | onsets | score |');
    lines.push('|---|---|---:|---:|---:|---:|');
    for (const fixture of row.fixtures) {
      lines.push(
        `| ${fixture.fixture.file} | ${fixture.fixture.role} | ${fixture.fixture.expectedCount} | `
        + `${fixture.fixture.minOnsets}..${fixture.fixture.maxOnsets} | ${fixture.onsetCount} | `
        + `${fixture.score.toFixed(2)} |`,
      );
    }
  }

  return `${lines.join('\n')}\n`;
}
