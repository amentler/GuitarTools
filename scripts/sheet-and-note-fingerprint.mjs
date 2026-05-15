import { availableParallelism, cpus } from 'os';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import {
  discoverSheetMusicSequenceFixtures,
  evaluateOnsetStrategyReport,
  evaluateSequenceStrategyReport,
  formatSheetMusicSequenceFingerprintReport,
} from '../tests/helpers/sheetMusicSequenceFingerprint.js';
import {
  NOTE_AUDIO_FIXTURES,
  evaluateOpenStringNoteOnsetReport,
  evaluateOpenStringNoteFingerprintForStrategy,
  formatOpenStringNoteFingerprintReport,
} from '../tests/helpers/sheetMusicNoteFingerprint.js';
import { getSheetMusicRecognitionStrategies } from '../js/games/sheetMusicReading/sheetMusicRecognition.js';
import { getGuitarOnsetStrategies } from '../js/shared/audio/guitarOnsetStrategies.js';
import { loadEssentiaForNode } from '../tests/helpers/essentiaNodeWasmLoader.js';
import { createEssentiaSheetMusicStrategy } from '../js/games/sheetMusicReading/essentiaSheetMusicStrategy.js';
import { loadSheetMusicOnsetConfigFromArgs } from './sheetMusicOnsetConfig.mjs';

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
const DEFAULT_WORKER_COUNT = Math.max(1, (availableParallelism?.() ?? cpus().length) - 2);

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

const onsetStrategies = getGuitarOnsetStrategies();
const progress = createProgressLogger();
const workerCount = DEFAULT_WORKER_COUNT;

logProgress(`worker pool: ${workerCount} (${Math.max(1, (availableParallelism?.() ?? cpus().length))} cores detected, reserving 2)`);

const sequenceFixtures = discoverSheetMusicSequenceFixtures();
const sequenceTasks = [
  ...strategies.map(strategy => ({
    payload: {
      type: 'sequence-strategy-report',
      strategyKey: strategy.key,
      options: onsetConfigOptions,
    },
    run: () => evaluateSequenceStrategyReport(sequenceFixtures, strategy, onsetConfigOptions),
  })),
  ...onsetStrategies.map(strategy => ({
    payload: {
      type: 'sequence-onset-strategy-report',
      strategyKey: strategy.key,
      options: onsetConfigOptions,
    },
    run: () => evaluateOnsetStrategyReport(sequenceFixtures, strategy, onsetConfigOptions),
  })),
];

logProgress(`starting sequence fingerprint (${strategies.length} pitch strategies, ${onsetStrategies.length} onset strategies)`);
const sequenceResults = await runWorkerTasks(sequenceTasks, workerCount);
const strategyReports = sequenceResults.slice(0, strategies.length);
const onsetStrategyReports = sequenceResults.slice(strategies.length);
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
