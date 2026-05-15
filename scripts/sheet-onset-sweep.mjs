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
  candidateToOptions,
  createInitialCandidatesForStrategy,
  createRefinedCandidatesForStrategy,
  createSeededRandom,
  createStagnationProbeCandidates,
  discoverSweepFixtures,
  ensureRunDir,
  formatCsvRow,
  formatReport,
  formatSweepHelp,
  loadSweepSpec,
  parseArgs,
  readJsonl,
  resolveSweepStrategies,
  sortResults,
  writeJson,
} from './sheetOnsetSweepCore.mjs';

const DEFAULT_WORKER_COUNT = Math.max(1, Math.floor(cpus().length / 2));
const WORKER_SCRIPT = fileURLToPath(new URL('./sheet-onset-sweep-worker.mjs', import.meta.url));
const DEFAULT_ONSET_FRAME_SIZE = 4096;
const DEFAULT_ANALYZE_INTERVAL_MS = 41;

function slugifyStrategyKey(strategyKey) {
  return String(strategyKey).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
}

function formatScore(value) {
  return Number.isFinite(value) ? value.toFixed(2) : '-';
}

function formatParameterValue(value) {
  return Number.isFinite(value) && !Number.isInteger(value)
    ? String(Math.round(value * 1_000_000) / 1_000_000)
    : String(value ?? '');
}

function makeCandidateId(round, index, parameters) {
  const hash = candidateKey(parameters)
    .split('')
    .reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) >>> 0, 0)
    .toString(16)
    .padStart(8, '0');
  const strategyPart = parameters.strategyKey ? `${slugifyStrategyKey(parameters.strategyKey)}-` : '';
  return `r${String(round).padStart(3, '0')}-${strategyPart}${String(index).padStart(4, '0')}-${hash}`;
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

function resolveHopSize(options, sampleRate) {
  return options.onsetHopSize
    ?? Math.max(1, Math.round(sampleRate * ((options.analyzeIntervalMs ?? DEFAULT_ANALYZE_INTERVAL_MS) / 1000)));
}

function estimateFrameCount(samplesBuffer, frameSize, hopSize) {
  const sampleCount = samplesBuffer.byteLength / Float32Array.BYTES_PER_ELEMENT;
  if (sampleCount < frameSize) return 0;
  return Math.floor((sampleCount - frameSize) / hopSize) + 1;
}

function getAnalysisConfig(candidate, sampleRate) {
  const options = candidateToOptions(candidate.parameters);
  const frameSize = options.onsetFrameSize ?? DEFAULT_ONSET_FRAME_SIZE;
  const hopSize = resolveHopSize(options, sampleRate);
  return {
    key: `${frameSize}:${hopSize}`,
    frameSize,
    hopSize,
  };
}

function estimateAnalysisCost(config, sharedFixtures) {
  return sharedFixtures.reduce((sum, fixture) => (
    sum + estimateFrameCount(fixture.samplesBuffer, config.frameSize, config.hopSize)
  ), 0);
}

function splitCandidates(candidates, shardCount) {
  if (shardCount <= 1) return [candidates];
  const chunkSize = Math.ceil(candidates.length / shardCount);
  const chunks = [];
  for (let i = 0; i < candidates.length; i += chunkSize) {
    chunks.push(candidates.slice(i, i + chunkSize));
  }
  return chunks;
}

function partitionBatch(batch, sharedFixtures, workerCount) {
  const activeCount = Math.min(workerCount, batch.length);
  const sampleRate = sharedFixtures[0]?.sampleRate ?? 44100;
  const groups = new Map();

  for (const candidate of batch) {
    const config = getAnalysisConfig(candidate, sampleRate);
    const existing = groups.get(config.key);
    if (existing) {
      existing.candidates.push(candidate);
    } else {
      groups.set(config.key, {
        ...config,
        candidates: [candidate],
        frameCost: estimateAnalysisCost(config, sharedFixtures),
      });
    }
  }

  const totalCandidateCost = [...groups.values()].reduce(
    (sum, group) => sum + group.frameCost * group.candidates.length,
    0,
  );
  const targetCost = totalCandidateCost / activeCount;
  const shards = [];

  for (const group of groups.values()) {
    const desiredShardCount = targetCost > 0
      ? Math.ceil((group.frameCost * group.candidates.length) / targetCost)
      : 1;
    const shardCount = Math.min(group.candidates.length, Math.max(1, desiredShardCount));
    for (const candidates of splitCandidates(group.candidates, shardCount)) {
      shards.push({
        candidates,
        estimatedCost: group.frameCost * (1 + candidates.length),
      });
    }
  }

  const chunks = Array.from({ length: activeCount }, () => ({ candidates: [], estimatedCost: 0 }));
  shards
    .sort((a, b) => b.estimatedCost - a.estimatedCost)
    .forEach((shard) => {
      chunks.sort((a, b) => a.estimatedCost - b.estimatedCost);
      chunks[0].candidates.push(...shard.candidates);
      chunks[0].estimatedCost += shard.estimatedCost;
    });

  return chunks
    .map(chunk => chunk.candidates)
    .filter(chunk => chunk.length > 0);
}

async function evaluateBatchParallel(batch, sharedFixtures, scoreSpec, workers) {
  if (batch.length === 0) return [];
  const chunks = partitionBatch(batch, sharedFixtures, workers.length);
  const batchResults = await Promise.all(
    chunks.map((chunk, i) => dispatchBatch(workers[i], chunk, sharedFixtures, scoreSpec)),
  );
  return batchResults.flat();
}

function compactResult(result) {
  return {
    id: result.id,
    round: result.round,
    strategyKey: result.strategyKey,
    parameters: result.parameters,
    options: result.options,
    score: result.score,
    metrics: result.metrics,
  };
}

function bestForStrategy(results, strategyKey) {
  return sortResults(results.filter(row => row.strategyKey === strategyKey))[0] ?? null;
}

function roundBestForStrategy(results, strategyKey) {
  return results
    .filter(row => row.strategyKey === strategyKey)
    .reduce((best, row) => (!best || row.score > best.score ? row : best), null);
}

function summarizeBest(row) {
  if (!row) return null;
  return {
    strategyKey: row.strategyKey,
    id: row.id,
    round: row.round,
    score: row.score,
    metrics: row.metrics,
    parameters: row.parameters,
    options: row.options,
  };
}

function writeBestConfig(runDir, strategyKey, row) {
  if (!row) return;
  writeJson(join(runDir, `best-${slugifyStrategyKey(strategyKey)}.config.json`), {
    ...row.options,
    onsetStrategyKey: row.strategyKey,
    _sweep: {
      id: row.id,
      round: row.round,
      strategyKey: row.strategyKey,
      score: row.score,
      metrics: row.metrics,
    },
  });
}

function writeResultArtifacts(runDir, spec, fixtures, results, strategies = []) {
  const strategyKeys = strategies.length > 0
    ? strategies.map(strategy => strategy.key)
    : [...new Set(results.map(row => row.strategyKey).filter(Boolean))].sort();
  const bestRows = strategyKeys.map(strategyKey => bestForStrategy(results, strategyKey));
  const bestSummaries = bestRows.map(summarizeBest).filter(Boolean);

  writeFileSync(join(runDir, 'report.md'), formatReport(results, spec, fixtures));
  writeJson(join(runDir, 'best-by-strategy.json'), bestSummaries);

  const csvHeader = formatCsvRow(['strategyKey', 'round', 'score', 'id', 'parameters']);
  const csvRows = bestRows.filter(Boolean).map(row => formatCsvRow([
    row.strategyKey,
    row.round,
    row.score,
    row.id,
    JSON.stringify(row.parameters),
  ]));
  writeFileSync(join(runDir, 'best-by-strategy.csv'), `${[csvHeader, ...csvRows].join('\n')}\n`);

  for (const [index, strategyKey] of strategyKeys.entries()) {
    const row = bestRows[index];
    if (!row) continue;
    writeJson(join(runDir, `best-${slugifyStrategyKey(strategyKey)}.json`), summarizeBest(row));
    writeBestConfig(runDir, strategyKey, row);
  }
}

function printRoundSummary(round, roundResults, allResults, strategies, roundModes, strategyState) {
  console.log('');
  console.log(`[sheet-onset-sweep] round ${round} | evaluated ${roundResults.length}`);
  console.log('strategy                      mode              stag  best     round');
  console.log('----------------------------  ----------------  ----  -------  -------');

  for (const strategy of strategies) {
    const state = strategyState.get(strategy.key);
    const best = bestForStrategy(allResults, strategy.key);
    const roundBest = roundBestForStrategy(roundResults, strategy.key);
    console.log(
      `${strategy.key.padEnd(28).slice(0, 28)}  `
      + `${String(roundModes[strategy.key] ?? '-').padEnd(16).slice(0, 16)}  `
      + `${String(state?.stagnationCount ?? 0).padStart(4)}  `
      + `${formatScore(best?.score).padStart(7)}  `
      + `${formatScore(roundBest?.score).padStart(7)}`,
    );
  }

  for (const strategy of strategies) {
    const best = bestForStrategy(allResults, strategy.key);
    const roundBest = roundBestForStrategy(roundResults, strategy.key);

    const isNewBest = best && roundBest && best.id === roundBest.id;
    if (!isNewBest) continue;

    console.log('');
    console.log(`[${strategy.key}] NEW best parameters (score: ${formatScore(best.score)})`);
    for (const [key, value] of Object.entries(best.parameters)) {
      if (key === 'strategyKey') continue;
      console.log(`  ${key.padEnd(32)} ${formatParameterValue(value)}`);
    }
  }
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
  const strategies = resolveSweepStrategies(spec);

  const fixtures = discoverSweepFixtures(spec);
  if (fixtures.length === 0) {
    throw new Error(`No WAV fixtures found in ${spec.fixturesDir}`);
  }

  if (args.dryRun) {
    console.log(`[sheet-onset-sweep] fixtures: ${fixtures.length}`);
    console.log(`[sheet-onset-sweep] output dir: ${spec.outputDir}`);
    console.log(`[sheet-onset-sweep] strategies: ${strategies.map(s => s.key).join(', ')}`);
    console.log(`[sheet-onset-sweep] parameters: ${Object.keys(spec.parameters).join(', ')}`);
    return;
  }

  const runDir = ensureRunDir(spec, args.resumeDir);
  const workerCount = args.workers ?? DEFAULT_WORKER_COUNT;
  const loadedFixtures = loadAudioFixtures(fixtures);
  const sharedFixtures = prepareSharedFixtures(loadedFixtures);
  const workers = Array.from({ length: workerCount }, () => new Worker(WORKER_SCRIPT));
  const previousResults = readJsonl(join(runDir, 'results.jsonl'));
  const seen = new Set(previousResults.map(row => candidateKey(row.parameters)));
  const results = [...previousResults];
  const random = createSeededRandom((spec.seed ?? 1337) + results.length);
  const startedAt = Date.now();
  const startRound = previousResults.length > 0
    ? Math.max(...previousResults.map(row => row.round ?? 0)) + 1
    : 1;
  const strategyState = new Map(strategies.map(strategy => [
    strategy.key,
    {
      effectiveRound: startRound,
      stagnationCount: 0,
      recentRoundBest: -Infinity,
    },
  ]));

  writeJson(join(runDir, 'sweep-spec.json'), spec);
  writeJson(join(runDir, 'fixtures.json'), fixtures.map(fixture => ({
    file: fixture.file,
    role: fixture.role,
    expectedCount: fixture.expectedCount,
    minOnsets: fixture.minOnsets,
    maxOnsets: fixture.maxOnsets,
    weight: fixture.weight,
    taggedOnsetsMs: fixture.taggedOnsetsMs,
  })));

  console.log(`[sheet-onset-sweep] run dir: ${runDir}`);
  console.log(`[sheet-onset-sweep] workers: ${workerCount}${args.workers ? '' : ' (auto)'}`);
  console.log(`[sheet-onset-sweep] fixtures: ${fixtures.length}`);
  console.log(`[sheet-onset-sweep] strategies: ${strategies.map(s => s.key).join(', ')}`);
  console.log(`[sheet-onset-sweep] resumed candidates: ${results.length}`);
  if (spec.stagnationRounds) {
    console.log(`[sheet-onset-sweep] stagnation restart after ${spec.stagnationRounds} non-improving rounds`);
  }
  if (spec.globalResetInterval) {
    console.log(`[sheet-onset-sweep] global reset every ${spec.globalResetInterval} rounds`);
  }

  process.on('SIGINT', () => {
    console.log('\n[sheet-onset-sweep] interrupted — writing final artifacts...');
    writeResultArtifacts(runDir, spec, fixtures, results, strategies);
    printRoundSummary('interrupted', [], results, strategies, {}, strategyState);
    process.exit(0);
  });

  for (let round = startRound; ; round++) {
    if (Number.isFinite(spec.rounds) && round > spec.rounds) {
      console.log(`[sheet-onset-sweep] stopping before round ${round}: rounds`);
      break;
    }

    const stopReason = dueToStop(startedAt, spec, results.length, args.maxCandidates);
    if (stopReason) {
      console.log(`[sheet-onset-sweep] stopping before round ${round}: ${stopReason}`);
      break;
    }

    const roundResults = [];
    let stoppedEarly = false;

    const batch = [];
    const roundModes = {};

    for (const strategy of strategies) {
      const state = strategyState.get(strategy.key);
      const strategyResults = results.filter(row => row.strategyKey === strategy.key);
      const beam = sortResults(strategyResults).slice(0, spec.beamSize);
      const isFirstRound = round === startRound && beam.length === 0;
      const isGlobalReset = spec.globalResetInterval && round % spec.globalResetInterval === 0;
      const isStagnationReset = spec.stagnationResetInterval && state.stagnationCount >= spec.stagnationResetInterval;
      const isStagnationProbe = !isFirstRound && !isGlobalReset && !isStagnationReset
        && spec.stagnationRounds && state.stagnationCount >= spec.stagnationRounds;

      let roundMode;
      let rawCandidates;
      if (isFirstRound || isGlobalReset || isStagnationReset) {
        rawCandidates = createInitialCandidatesForStrategy(spec, strategy.key, spec.candidatesPerRound, random);
        state.effectiveRound = 0;
        state.stagnationCount = 0;
        if (isStagnationReset) {
          roundMode = 'stagnation-reset';
        } else {
          roundMode = isGlobalReset ? 'global-reset' : 'initial';
        }
      } else {
        rawCandidates = createRefinedCandidatesForStrategy(
          spec,
          strategy.key,
          beam,
          spec.candidatesPerRound,
          state.effectiveRound,
          random,
        );
        roundMode = isStagnationProbe ? 'stagnation-probe' : 'normal';
        if (isStagnationProbe) {
          const probeCount = spec.stagnationProbeCount ?? 10;
          rawCandidates.push(...createStagnationProbeCandidates(spec, strategy.key, beam, probeCount, random));
        }
      }
      state.effectiveRound++;
      roundModes[strategy.key] = roundMode;

      for (const [index, parameters] of rawCandidates.entries()) {
        const key = candidateKey(parameters);
        if (seen.has(key)) continue;
        seen.add(key);
        batch.push({
          id: makeCandidateId(round, index + 1, parameters),
          round,
          strategyKey: strategy.key,
          parameters,
        });
      }
    }

    if (Number.isFinite(args.maxCandidates) && results.length + batch.length > args.maxCandidates) {
      const stopAt = args.maxCandidates - results.length;
      batch.splice(stopAt);
      stoppedEarly = true;
      console.log(`[sheet-onset-sweep] stopping during round ${round}: max-candidates`);
    }

    const batchResults = await evaluateBatchParallel(batch, sharedFixtures, spec.score, workers);
    for (const result of batchResults) {
      const storedResult = compactResult(result);
      results.push(storedResult);
      roundResults.push(storedResult);
      appendResult(runDir, storedResult);
    }

    if (!stoppedEarly) {
      const stopAfterBatch = dueToStop(startedAt, spec, results.length, args.maxCandidates);
      if (stopAfterBatch) {
        stoppedEarly = true;
        console.log(`[sheet-onset-sweep] stopping after round ${round}: ${stopAfterBatch}`);
      }
    }

    writeResultArtifacts(runDir, spec, fixtures, results, strategies);

    const minImprovement = spec.minScoreImprovement ?? 1.0;

    for (const strategy of strategies) {
      const state = strategyState.get(strategy.key);
      const strategyRoundBest = roundBestForStrategy(roundResults, strategy.key);
      const strategyRoundBestScore = strategyRoundBest?.score ?? -Infinity;
      const mode = roundModes[strategy.key];

      if (mode === 'global-reset' || mode === 'initial') state.recentRoundBest = -Infinity;

      if (strategyRoundBestScore > state.recentRoundBest + minImprovement) {
        state.recentRoundBest = strategyRoundBestScore;
        state.stagnationCount = 0;
      } else if (mode !== 'global-reset' && mode !== 'initial' && mode !== 'stagnation-reset') {
        state.stagnationCount++;
      }
    }

    printRoundSummary(round, roundResults, results, strategies, roundModes, strategyState);

    if (stoppedEarly) break;
  }

  await Promise.all(workers.map(w => w.terminate()));
  writeResultArtifacts(runDir, spec, fixtures, results, strategies);
  console.log(`[sheet-onset-sweep] done: ${results.length} candidates`);
}

main().catch(err => {
  console.error(`[sheet-onset-sweep] ${err.stack || err.message}`);
  process.exitCode = 1;
});
