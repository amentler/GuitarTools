import { parentPort } from 'worker_threads';
import {
  discoverSheetMusicSequenceFixtures,
  evaluateOnsetStrategyReport,
  evaluateSequenceStrategyReport,
} from '../tests/helpers/sheetMusicSequenceFingerprint.js';
import {
  evaluateOpenStringNoteFingerprintForStrategy,
  evaluateOpenStringNoteOnsetReport,
  NOTE_AUDIO_FIXTURES,
} from '../tests/helpers/sheetMusicNoteFingerprint.js';
import { getSheetMusicRecognitionStrategies } from '../js/games/sheetMusicReading/sheetMusicRecognition.js';
import { createEssentiaSheetMusicStrategy } from '../js/games/sheetMusicReading/essentiaSheetMusicStrategy.js';
import { loadEssentiaForNode } from '../tests/helpers/essentiaNodeWasmLoader.js';
import { resolveGuitarOnsetStrategy } from '../js/shared/audio/guitarOnsetStrategies.js';

let cachedStrategies = null;

function sanitizeStrategy(strategy) {
  return {
    key: strategy.key,
    label: strategy.label,
    description: strategy.description,
  };
}

async function resolveSheetMusicStrategies() {
  if (cachedStrategies) return cachedStrategies;
  let strategies = getSheetMusicRecognitionStrategies();
  try {
    const essentia = await loadEssentiaForNode();
    const essentiaStrategy = createEssentiaSheetMusicStrategy(essentia);
    strategies = strategies.map(strategy => (
      strategy.key === essentiaStrategy.key ? essentiaStrategy : strategy
    ));
  } catch {
    // Fallback to the non-Essentia strategies in environments without WASM.
  }
  cachedStrategies = strategies;
  return cachedStrategies;
}

async function resolveSheetMusicStrategyByKey(strategyKey) {
  const strategies = await resolveSheetMusicStrategies();
  return strategies.find(strategy => strategy.key === strategyKey) ?? strategies[0];
}

async function handleTask(task) {
  if (task.type === 'sequence-strategy-report') {
    const fixtures = discoverSheetMusicSequenceFixtures();
    const strategy = await resolveSheetMusicStrategyByKey(task.strategyKey);
    const report = evaluateSequenceStrategyReport(fixtures, strategy, task.options ?? {});
    return {
      ...report,
      strategy: sanitizeStrategy(report.strategy),
    };
  }

  if (task.type === 'sequence-onset-strategy-report') {
    const fixtures = discoverSheetMusicSequenceFixtures();
    const onsetStrategy = resolveGuitarOnsetStrategy(task.strategyKey);
    const report = evaluateOnsetStrategyReport(fixtures, onsetStrategy, task.options ?? {});
    return {
      ...report,
      onsetStrategy: sanitizeStrategy(report.onsetStrategy),
    };
  }

  if (task.type === 'note-strategy-report') {
    const strategy = await resolveSheetMusicStrategyByKey(task.strategyKey);
    const report = evaluateOpenStringNoteFingerprintForStrategy(NOTE_AUDIO_FIXTURES, strategy, null);
    return {
      ...report,
      strategy: sanitizeStrategy(report.strategy),
    };
  }

  if (task.type === 'note-onset-report') {
    return evaluateOpenStringNoteOnsetReport(NOTE_AUDIO_FIXTURES);
  }

  throw new Error(`Unknown SFP worker task type: ${task.type}`);
}

parentPort.on('message', async message => {
  try {
    const result = await handleTask(message.task);
    parentPort.postMessage({ id: message.id, ok: true, result });
  } catch (err) {
    parentPort.postMessage({
      id: message.id,
      ok: false,
      error: err?.stack || err?.message || String(err),
    });
  }
});
