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

function writeResultArtifacts(runDir, spec, fixtures, results, sortedResults = null) {
  const sorted = sortedResults ?? sortResults(results);
  const best = sorted.slice(0, spec.beamSize);
  const strategyKeys = [...new Set(results.map(row => row.strategyKey).filter(Boolean))].sort();
  writeJson(join(runDir, 'best.json'), best);
  writeFileSync(join(runDir, 'report.md'), formatReport(results, spec, fixtures));

  const csvHeader = formatCsvRow([
    'rank',
    'id',
    'strategyKey',
    'round',
    'score',
    'exact',
    'goodMatches',
    'acceptableMatches',
    'misses',
    'falsePositives',
    'duplicates',
    'meanAbsErrorMs',
    'p95AbsErrorMs',
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
    row.strategyKey ?? '',
    row.round,
    row.score,
    row.metrics.exact,
    row.metrics.goodMatches ?? 0,
    row.metrics.acceptableMatches ?? 0,
    row.metrics.misses ?? 0,
    row.metrics.falsePositives ?? 0,
    row.metrics.duplicates ?? 0,
    row.metrics.meanAbsErrorMs ?? '',
    row.metrics.p95AbsErrorMs ?? '',
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
      onsetStrategyKey: row.strategyKey,
      _sweep: {
        id: row.id,
        rank: index + 1,
        strategyKey: row.strategyKey,
        score: row.score,
        metrics: row.metrics,
      },
    });
  });

  for (const strategyKey of strategyKeys) {
    const strategyBest = sortResults(results.filter(row => row.strategyKey === strategyKey))
      .slice(0, spec.beamSize);
    writeJson(join(runDir, `best-${slugifyStrategyKey(strategyKey)}.json`), strategyBest);
    strategyBest.forEach((row, index) => {
      writeJson(
        join(runDir, `best-${slugifyStrategyKey(strategyKey)}-${String(index + 1).padStart(3, '0')}.config.json`),
        {
          ...row.options,
          onsetStrategyKey: row.strategyKey,
          _sweep: {
            id: row.id,
            rank: index + 1,
            strategyKey: row.strategyKey,
            score: row.score,
            metrics: row.metrics,
          },
        },
      );
    });
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
  mkdirSync(join(runDir, 'rounds'), { recursive: true });
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

  let bestScoreEver = results.length > 0 ? (sortResults(results)[0]?.score ?? -Infinity) : -Infinity;

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
      const isStagnationRestart = !isFirstRound && !isGlobalReset
        && spec.stagnationRounds && state.stagnationCount >= spec.stagnationRounds;

      let roundMode;
      let rawCandidates;
      if (isFirstRound || isGlobalReset) {
        rawCandidates = createInitialCandidatesForStrategy(spec, strategy.key, spec.candidatesPerRound, random);
        state.effectiveRound = 0;
        state.stagnationCount = 0;
        roundMode = isGlobalReset ? 'global-reset' : 'initial';
      } else if (isStagnationRestart) {
        state.effectiveRound = 0;
        state.stagnationCount = 0;
        rawCandidates = createRefinedCandidatesForStrategy(spec, strategy.key, beam, spec.candidatesPerRound, 1, random);
        roundMode = 'stagnation-restart';
      } else {
        rawCandidates = createRefinedCandidatesForStrategy(
          spec,
          strategy.key,
          beam,
          spec.candidatesPerRound,
          state.effectiveRound,
          random,
        );
        roundMode = 'normal';
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
      modes: roundModes,
      evaluated: roundResults.length,
      best: sortedResults.slice(0, spec.beamSize),
      bestByStrategy: Object.fromEntries(strategies.map(strategy => [
        strategy.key,
        sortResults(results.filter(row => row.strategyKey === strategy.key)).slice(0, spec.beamSize),
      ])),
    });
    writeResultArtifacts(runDir, spec, fixtures, results, sortedResults);

    const currentBest = sortedResults[0];
    const currentBestScore = currentBest?.score ?? -Infinity;
    const roundBest = roundResults.length > 0
      ? roundResults.reduce((a, b) => (b.score > a.score ? b : a))
      : null;
    const roundBestScore = roundBest?.score ?? -Infinity;
    const minImprovement = spec.minScoreImprovement ?? 1.0;

    if (currentBestScore > bestScoreEver) bestScoreEver = currentBestScore;
    for (const strategy of strategies) {
      const state = strategyState.get(strategy.key);
      const strategyRoundResults = roundResults.filter(row => row.strategyKey === strategy.key);
      const strategyRoundBest = strategyRoundResults.length > 0
        ? strategyRoundResults.reduce((a, b) => (b.score > a.score ? b : a))
        : null;
      const strategyRoundBestScore = strategyRoundBest?.score ?? -Infinity;
      const mode = roundModes[strategy.key];

      if (mode === 'global-reset' || mode === 'stagnation-restart') state.recentRoundBest = -Infinity;

      if (strategyRoundBestScore > state.recentRoundBest + minImprovement) {
        state.recentRoundBest = strategyRoundBestScore;
        state.stagnationCount = 0;
      } else if (mode !== 'global-reset' && mode !== 'stagnation-restart') {
        state.stagnationCount++;
      }
    }

    const roundScorePart = roundBest
      ? ` | round best ${roundBest.score.toFixed(2)}`
      : '';
    const strategyProgress = strategies.map(strategy => {
      const state = strategyState.get(strategy.key);
      return `${strategy.key}:${roundModes[strategy.key]}${state.stagnationCount > 0 ? `(${state.stagnationCount})` : ''}`;
    }).join(', ');
    console.log(
      `[sheet-onset-sweep] round ${round}: evaluated ${roundResults.length}, `
      + `global best ${currentBestScore.toFixed(2)} (${currentBest?.id ?? '-'})${roundScorePart}`
      + ` | strategies ${strategyProgress}`,
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
