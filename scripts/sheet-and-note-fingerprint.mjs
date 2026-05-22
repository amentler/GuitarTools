import { availableParallelism, cpus } from 'os';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import {
  discoverSheetMusicSequenceFixtures,
  evaluateOnsetStrategyReport,
  evaluateXGBoostOnsetModelReport,
  evaluateSequenceStrategyReport,
  formatOnsetStrategySummaryLists,
  formatSheetMusicSequenceFingerprintReport,
  summarizeOnsetStrategyCases,
} from '../tests/helpers/sheetMusicSequenceFingerprint.js';
import {
  NOTE_AUDIO_FIXTURES,
  evaluateOpenStringNoteOnsetReport,
  evaluateOpenStringNoteFingerprintForStrategy,
  formatOpenStringNoteFingerprintReport,
} from '../tests/helpers/sheetMusicNoteFingerprint.js';
import { getSheetMusicRecognitionStrategies } from '../js/games/sheetMusicReading/sheetMusicRecognition.js';
import { loadEssentiaForNode } from '../tests/helpers/essentiaNodeWasmLoader.js';
import { createEssentiaSheetMusicStrategy } from '../js/games/sheetMusicReading/essentiaSheetMusicStrategy.js';
import { loadSheetMusicOnsetConfigFromArgs } from './sheetMusicOnsetConfig.mjs';
import {
  loadNodeXGBoostModelForStrategy,
  loadTrainedOnsetModelStrategiesForNode,
} from './sfpOnsetModels.mjs';

function logProgress(message) {
  console.error(`[SFP] ${message}`);
}

function createProgressLogger() {
  return event => {
    if (event.phase === 'sequence-strategy-start') {
      logProgress(`sequence strategy ${event.strategyKey}: start (${event.fixtureCount} fixtures)`);
    } else if (event.phase === 'sequence-strategy-progress') {
      logProgress(`sequence strategy ${event.strategyKey}: ${event.current}/${event.total} (${event.fixture})`);
    } else if (event.phase === 'sequence-strategy-done') {
      logProgress(`sequence strategy ${event.strategyKey}: done`);
    } else if (event.phase === 'sequence-onset-strategy-start') {
      logProgress(`onset strategy ${event.strategyKey}: start (${event.fixtureCount} fixtures)`);
    } else if (event.phase === 'sequence-onset-strategy-done') {
      logProgress(`onset strategy ${event.strategyKey}: done`);
    } else if (event.phase === 'note-strategy-start') {
      logProgress(`note strategy ${event.strategyKey}: start (${event.totalPairs} pairings)`);
    } else if (event.phase === 'note-strategy-progress') {
      logProgress(`note strategy ${event.strategyKey}: ${event.current}/${event.total} (${event.fixture} -> ${event.targetPitch})`);
    } else if (event.phase === 'note-strategy-done') {
      logProgress(`note strategy ${event.strategyKey}: done`);
    } else if (event.phase === 'note-onset-start') {
      logProgress(`note onset pass: start (${event.fixtureCount} fixtures)`);
    } else if (event.phase === 'note-onset-progress') {
      logProgress(`note onset pass: ${event.current}/${event.total} (${event.fixture})`);
    } else if (event.phase === 'note-onset-done') {
      logProgress('note onset pass: done');
    }
  };
}

const WORKER_SCRIPT = fileURLToPath(new URL('./sfp-worker.mjs', import.meta.url));
const DEFAULT_WORKER_COUNT = Number.parseInt(process.env.SFP_WORKERS ?? '', 10)
  || Math.max(1, (availableParallelism?.() ?? cpus().length) - 2);
const DEFAULT_ONSET_SHARD_COUNT = Number.parseInt(process.env.SFP_ONSET_SHARDS ?? '', 10) || 1;

function createWorkerPool(workerCount) {
  return Array.from({ length: workerCount }, () => new Worker(WORKER_SCRIPT));
}

async function runWorkerTasks(tasks, workerCount) {
  const actualWorkers = Math.max(1, Math.min(workerCount, tasks.length));
  if (actualWorkers <= 1) {
    return Promise.all(tasks.map(task => task.run()));
  }

  const workers = createWorkerPool(actualWorkers);
  const results = new Array(tasks.length);
  let nextTaskIndex = 0;
  let completed = 0;

  try {
    await new Promise((resolve, reject) => {
      const assign = worker => {
        if (nextTaskIndex >= tasks.length) return;
        const taskIndex = nextTaskIndex++;
        worker.postMessage({ id: taskIndex, task: tasks[taskIndex].payload });
      };

      for (const worker of workers) {
        worker.on('message', message => {
          if (!message.ok) {
            reject(new Error(message.error));
            return;
          }
          results[message.id] = message.result;
          completed++;
          if (nextTaskIndex < tasks.length) {
            assign(worker);
          } else if (completed === tasks.length) {
            resolve();
          }
        });
        worker.on('error', reject);
        assign(worker);
      }
    });
  } finally {
    await Promise.all(workers.map(worker => worker.terminate()));
  }

  return results;
}

function chunkArray(items, chunkCount) {
  const actualCount = Math.max(1, Math.min(chunkCount, items.length));
  const chunks = Array.from({ length: actualCount }, () => []);
  items.forEach((item, index) => {
    chunks[index % actualCount].push(item);
  });
  return chunks.filter(chunk => chunk.length > 0);
}

const { configPath, options: onsetConfigOptions } = loadSheetMusicOnsetConfigFromArgs();
if (configPath) {
  logProgress(`onset config: ${configPath}`);
}

let strategies = getSheetMusicRecognitionStrategies();
try {
  logProgress('loading Essentia WASM');
  const essentia = await loadEssentiaForNode();
  const essentiaStrategy = createEssentiaSheetMusicStrategy(essentia);
  strategies = strategies.map(strategy => (
    strategy.key === essentiaStrategy.key ? essentiaStrategy : strategy
  ));
  logProgress('Essentia WASM ready');
} catch (err) {
  console.warn('[SFP] Essentia WASM not available, running without essentia-pitch-yin strategy:', err.message);
}

const onsetStrategies = loadTrainedOnsetModelStrategiesForNode();
const progress = createProgressLogger();
const workerCount = DEFAULT_WORKER_COUNT;

logProgress(`worker pool: ${workerCount} (${Math.max(1, (availableParallelism?.() ?? cpus().length))} cores detected, reserving 2)`);

const sequenceFixtures = discoverSheetMusicSequenceFixtures();
const sequenceStrategyTasks = strategies.map(strategy => ({
    payload: {
      type: 'sequence-strategy-report',
      strategyKey: strategy.key,
      options: onsetConfigOptions,
    },
    run: () => evaluateSequenceStrategyReport(sequenceFixtures, strategy, onsetConfigOptions),
  }));
const onsetShardCount = Math.max(1, Math.min(DEFAULT_ONSET_SHARD_COUNT, sequenceFixtures.length));
const onsetTasks = onsetStrategies.flatMap(strategy => (
  chunkArray(sequenceFixtures, onsetShardCount).map(chunk => ({
    payload: {
      type: 'sequence-onset-strategy-report',
      strategyKey: strategy.key,
      onsetStrategy: strategy,
      fixtureFiles: chunk.map(fixture => fixture.file),
      options: onsetConfigOptions,
    },
    run: async () => {
      if (strategy.offlineDetector === 'xgboost') {
        const model = await loadNodeXGBoostModelForStrategy(strategy);
        return evaluateXGBoostOnsetModelReport(chunk, strategy, model, onsetConfigOptions);
      }
      return evaluateOnsetStrategyReport(chunk, strategy, onsetConfigOptions);
    },
  }))
));
const sequenceTasks = [...sequenceStrategyTasks, ...onsetTasks];

logProgress(`starting sequence fingerprint (${strategies.length} pitch strategies, ${onsetStrategies.length} onset strategies, ${onsetTasks.length} onset shards)`);
const sequenceResults = await runWorkerTasks(sequenceTasks, workerCount);
const strategyReports = sequenceResults.slice(0, sequenceStrategyTasks.length);
const onsetShardReports = sequenceResults.slice(sequenceStrategyTasks.length);
const onsetStrategyReports = onsetStrategies.map(strategy => {
  const cases = onsetShardReports
    .filter(report => report.onsetStrategy.key === strategy.key)
    .flatMap(report => report.cases);
  return summarizeOnsetStrategyCases(strategy, cases);
});
const defaultSequenceReport = strategyReports[0];
const sequenceReport = {
  ...defaultSequenceReport,
  strategies,
  strategyReports,
  onsetStrategies,
  onsetStrategyReports,
  onsetConfig: {
    analyzeIntervalMs: onsetConfigOptions.analyzeIntervalMs ?? undefined,
    onsetFrameSize: onsetConfigOptions.onsetFrameSize ?? undefined,
    onsetHopSize: onsetConfigOptions.onsetHopSize ?? null,
    onsetDetectorOptions: onsetConfigOptions.onsetDetectorOptions ?? {},
  },
};
logProgress('sequence fingerprint done');

console.log(formatSheetMusicSequenceFingerprintReport(
  sequenceReport,
));
console.log('');
console.log(formatOnsetStrategySummaryLists(sequenceReport));
console.log('');
console.log('---');
console.log('');
const noteTasks = [
  ...strategies.map(strategy => ({
    payload: {
      type: 'note-strategy-report',
      strategyKey: strategy.key,
    },
    run: () => evaluateOpenStringNoteFingerprintForStrategy(NOTE_AUDIO_FIXTURES, strategy, progress),
  })),
  {
    payload: {
      type: 'note-onset-report',
    },
    run: () => evaluateOpenStringNoteOnsetReport(NOTE_AUDIO_FIXTURES, { onProgress: progress }),
  },
];

logProgress('starting note fingerprint');
const noteResults = await runWorkerTasks(noteTasks, workerCount);
const noteStrategyReports = noteResults.slice(0, strategies.length);
const noteOnsetReport = noteResults[strategies.length];
const defaultNoteReport = noteStrategyReports[0];
const noteReport = {
  fixtures: NOTE_AUDIO_FIXTURES,
  strategies,
  strategyReports: noteStrategyReports,
  targetPitches: defaultNoteReport.targetPitches,
  counts: defaultNoteReport.counts,
  metrics: defaultNoteReport.metrics,
  cases: defaultNoteReport.cases,
  onsetCounts: noteOnsetReport.onsetCounts,
  onsetCases: noteOnsetReport.onsetCases,
};
logProgress('note fingerprint done');
console.log(formatOpenStringNoteFingerprintReport(noteReport));
