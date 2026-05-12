import {
  appendFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'fs';
import { cpus } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';
import { readWavFile } from '../tests/helpers/wavDecoder.js';
import {
  candidateKey,
  createInitialCandidates,
  createRefinedCandidates,
  createSeededRandom,
  discoverSweepFixtures,
  ensureRunDir,
  formatCsvRow,
  formatReport,
  formatSweepHelp,
  loadSweepSpec,
  parseArgs,
  readJsonl,
  sortResults,
  writeJson,
} from './sheetOnsetSweepCore.mjs';

const WORKER_COUNT = Math.max(1, Math.floor(cpus().length / 2));
const WORKER_SCRIPT = fileURLToPath(new URL('./sheet-onset-sweep-worker.mjs', import.meta.url));

function makeCandidateId(round, index, parameters) {
  const hash = candidateKey(parameters)
    .split('')
    .reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) >>> 0, 0)
    .toString(16)
    .padStart(8, '0');
  return `r${String(round).padStart(3, '0')}-${String(index).padStart(4, '0')}-${hash}`;
}

function loadAudioFixtures(fixtures) {
  return fixtures.map(fixture => ({
    fixture,
    audio: readWavFile(fixture.wavPath),
  }));
}

function prepareSharedFixtures(loadedFixtures) {
  return loadedFixtures.map(({ fixture, audio }) => {
    const sharedBuffer = new SharedArrayBuffer(audio.samples.byteLength);
    new Float32Array(sharedBuffer).set(audio.samples);
    return { fixture, samplesBuffer: sharedBuffer, sampleRate: audio.sampleRate };
  });
}

function dispatchBatch(worker, batch, sharedFixtures, scoreSpec) {
  return new Promise((resolve, reject) => {
    const onMessage = (results) => { worker.off('error', onError); resolve(results); };
    const onError = (err) => { worker.off('message', onMessage); reject(err); };
    worker.once('message', onMessage);
    worker.once('error', onError);
    worker.postMessage({ batch, fixtures: sharedFixtures, scoreSpec });
  });
}

async function evaluateBatchParallel(batch, sharedFixtures, scoreSpec, workers) {
  if (batch.length === 0) return [];
  // Sort by analyzeIntervalMs so same-hop candidates end up in the same worker chunk,
  // maximising the per-worker FFT precomputation cache hit rate.
  const sorted = [...batch].sort(
    (a, b) => (a.parameters.analyzeIntervalMs ?? 0) - (b.parameters.analyzeIntervalMs ?? 0),
  );
  const activeCount = Math.min(workers.length, sorted.length);
  const chunkSize = Math.ceil(sorted.length / activeCount);
  const chunks = [];
  for (let i = 0; i < sorted.length; i += chunkSize) {
    chunks.push(sorted.slice(i, Math.min(i + chunkSize, sorted.length)));
  }
  const batchResults = await Promise.all(
    chunks.map((chunk, i) => dispatchBatch(workers[i], chunk, sharedFixtures, scoreSpec)),
  );
  return batchResults.flat();
}

function writeResultArtifacts(runDir, spec, fixtures, results, sortedResults = null) {
  const sorted = sortedResults ?? sortResults(results);
  const best = sorted.slice(0, spec.beamSize);
  writeJson(join(runDir, 'best.json'), best);
  writeFileSync(join(runDir, 'report.md'), formatReport(results, spec, fixtures));

  const csvHeader = formatCsvRow([
    'rank',
    'id',
    'round',
    'score',
    'exact',
    'under',
    'over',
    'extremeUnder',
    'extremeOver',
    'totalOnsets',
    'parameters',
  ]);
  const csvRows = sorted.map((row, index) => formatCsvRow([
    index + 1,
    row.id,
    row.round,
    row.score,
    row.metrics.exact,
    row.metrics.under,
    row.metrics.over,
    row.metrics.extremeUnder ?? 0,
    row.metrics.extremeOver ?? 0,
    row.metrics.totalOnsets,
    JSON.stringify(row.parameters),
  ]));
  writeFileSync(join(runDir, 'results.csv'), `${[csvHeader, ...csvRows].join('\n')}\n`);

  best.forEach((row, index) => {
    writeJson(join(runDir, `best-${String(index + 1).padStart(3, '0')}.config.json`), {
      ...row.options,
      _sweep: {
        id: row.id,
        rank: index + 1,
        score: row.score,
        metrics: row.metrics,
      },
    });
  });
}

function appendResult(runDir, result) {
  mkdirSync(runDir, { recursive: true });
  appendFileSync(join(runDir, 'results.jsonl'), `${JSON.stringify(result)}\n`);
}

function dueToStop(startedAt, spec, totalEvaluated, maxCandidates) {
  if (Number.isFinite(maxCandidates) && totalEvaluated >= maxCandidates) return 'max-candidates';
  if (Number.isFinite(spec.timeBudgetMinutes)) {
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= spec.timeBudgetMinutes * 60_000) return 'time-budget';
  }
  return null;
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    console.log(formatSweepHelp());
    return;
  }

  const spec = loadSweepSpec(args.specPath);

  const fixtures = discoverSweepFixtures(spec);
  if (fixtures.length === 0) {
    throw new Error(`No WAV fixtures found in ${spec.fixturesDir}`);
  }

  if (args.dryRun) {
    console.log(`[sheet-onset-sweep] fixtures: ${fixtures.length}`);
    console.log(`[sheet-onset-sweep] output dir: ${spec.outputDir}`);
    console.log(`[sheet-onset-sweep] parameters: ${Object.keys(spec.parameters).join(', ')}`);
    return;
  }

  const runDir = ensureRunDir(spec, args.resumeDir);
  mkdirSync(join(runDir, 'rounds'), { recursive: true });
  const loadedFixtures = loadAudioFixtures(fixtures);
  const sharedFixtures = prepareSharedFixtures(loadedFixtures);
  const workers = Array.from({ length: WORKER_COUNT }, () => new Worker(WORKER_SCRIPT));
  const previousResults = readJsonl(join(runDir, 'results.jsonl'));
  const seen = new Set(previousResults.map(row => candidateKey(row.parameters)));
  const results = [...previousResults];
  const random = createSeededRandom((spec.seed ?? 1337) + results.length);
  const startedAt = Date.now();
  const startRound = previousResults.length > 0
    ? Math.max(...previousResults.map(row => row.round ?? 0)) + 1
    : 1;

  writeJson(join(runDir, 'sweep-spec.json'), spec);
  writeJson(join(runDir, 'fixtures.json'), fixtures.map(fixture => ({
    file: fixture.file,
    role: fixture.role,
    expectedCount: fixture.expectedCount,
    minOnsets: fixture.minOnsets,
    maxOnsets: fixture.maxOnsets,
    weight: fixture.weight,
  })));

  console.log(`[sheet-onset-sweep] run dir: ${runDir}`);
  console.log(`[sheet-onset-sweep] workers: ${WORKER_COUNT}`);
  console.log(`[sheet-onset-sweep] fixtures: ${fixtures.length}`);
  console.log(`[sheet-onset-sweep] resumed candidates: ${results.length}`);
  if (spec.stagnationRounds) {
    console.log(`[sheet-onset-sweep] stagnation restart after ${spec.stagnationRounds} non-improving rounds`);
  }
  if (spec.globalResetInterval) {
    console.log(`[sheet-onset-sweep] global reset every ${spec.globalResetInterval} rounds`);
  }

  let bestScoreEver = results.length > 0 ? (sortResults(results)[0]?.score ?? -Infinity) : -Infinity;
  let stagnationCount = 0;
  let effectiveRound = startRound;

  process.on('SIGINT', () => {
    console.log('\n[sheet-onset-sweep] interrupted — writing final artifacts...');
    writeResultArtifacts(runDir, spec, fixtures, results);
    const interrupted = sortResults(results)[0];
    if (interrupted) {
      console.log(`[sheet-onset-sweep] best: ${interrupted.id} score=${interrupted.score.toFixed(2)}`);
      console.log(`[sheet-onset-sweep] best config: ${join(runDir, 'best-001.config.json')}`);
    }
    process.exit(0);
  });

  for (let round = startRound; ; round++) {
    const stopReason = dueToStop(startedAt, spec, results.length, args.maxCandidates);
    if (stopReason) {
      console.log(`[sheet-onset-sweep] stopping before round ${round}: ${stopReason}`);
      break;
    }

    const beam = sortResults(results).slice(0, spec.beamSize);

    const isFirstRound = round === startRound && beam.length === 0;
    const isGlobalReset = spec.globalResetInterval && round % spec.globalResetInterval === 0;
    const isStagnationRestart = !isFirstRound && !isGlobalReset
      && spec.stagnationRounds && stagnationCount >= spec.stagnationRounds;

    let roundMode;
    let rawCandidates;
    if (isFirstRound || isGlobalReset) {
      rawCandidates = createInitialCandidates(spec, spec.candidatesPerRound, random);
      effectiveRound = 0;
      stagnationCount = 0;
      roundMode = isGlobalReset ? 'global-reset' : 'initial';
    } else if (isStagnationRestart) {
      effectiveRound = 0;
      stagnationCount = 0;
      rawCandidates = createRefinedCandidates(spec, beam, spec.candidatesPerRound, 1, random);
      roundMode = 'stagnation-restart';
    } else {
      rawCandidates = createRefinedCandidates(spec, beam, spec.candidatesPerRound, effectiveRound, random);
      roundMode = 'normal';
    }
    effectiveRound++;

    const roundResults = [];
    let stoppedEarly = false;

    const batch = [];
    for (const [index, parameters] of rawCandidates.entries()) {
      const key = candidateKey(parameters);
      if (seen.has(key)) continue;
      seen.add(key);
      batch.push({ id: makeCandidateId(round, index + 1, parameters), round, parameters });
    }

    if (Number.isFinite(args.maxCandidates) && results.length + batch.length > args.maxCandidates) {
      const stopAt = args.maxCandidates - results.length;
      batch.splice(stopAt);
      stoppedEarly = true;
      console.log(`[sheet-onset-sweep] stopping during round ${round}: max-candidates`);
    }

    // eslint-disable-next-line no-await-in-loop
    const batchResults = await evaluateBatchParallel(batch, sharedFixtures, spec.score, workers);
    for (const result of batchResults) {
      results.push(result);
      roundResults.push(result);
      appendResult(runDir, result);
    }

    if (!stoppedEarly) {
      const stopAfterBatch = dueToStop(startedAt, spec, results.length, args.maxCandidates);
      if (stopAfterBatch) {
        stoppedEarly = true;
        console.log(`[sheet-onset-sweep] stopping after round ${round}: ${stopAfterBatch}`);
      }
    }

    const sortedResults = sortResults(results);

    writeJson(join(runDir, 'rounds', `round-${String(round).padStart(3, '0')}.json`), {
      round,
      mode: roundMode,
      evaluated: roundResults.length,
      best: sortedResults.slice(0, spec.beamSize),
    });
    writeResultArtifacts(runDir, spec, fixtures, results, sortedResults);

    const currentBest = sortedResults[0];
    const currentBestScore = currentBest?.score ?? -Infinity;
    const minImprovement = spec.minScoreImprovement ?? 1.0;
    if (currentBestScore > bestScoreEver + minImprovement) {
      bestScoreEver = currentBestScore;
      stagnationCount = 0;
    } else if (!isGlobalReset && !isStagnationRestart) {
      stagnationCount++;
    }

    console.log(
      `[sheet-onset-sweep] round ${round} [${roundMode}]: evaluated ${roundResults.length}, `
      + `best score ${currentBestScore.toFixed(2)} (${currentBest?.id ?? '-'})`
      + (stagnationCount > 0 ? `, stagnation ${stagnationCount}/${spec.stagnationRounds ?? '—'}` : ''),
    );

    if (stoppedEarly) break;
  }

  await Promise.all(workers.map(w => w.terminate()));
  writeResultArtifacts(runDir, spec, fixtures, results);
  const best = sortResults(results)[0];
  console.log(`[sheet-onset-sweep] done: ${results.length} candidates`);
  if (best) {
    console.log(`[sheet-onset-sweep] best: ${best.id} score=${best.score.toFixed(2)}`);
    console.log(`[sheet-onset-sweep] best config: ${join(runDir, 'best-001.config.json')}`);
  }
}

main().catch(err => {
  console.error(`[sheet-onset-sweep] ${err.stack || err.message}`);
  process.exitCode = 1;
});
