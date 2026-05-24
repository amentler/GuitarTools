import {
  evaluateSheetMusicSequenceFingerprint,
  formatSheetMusicSequenceFingerprintReport,
} from '../tests/helpers/sheetMusicSequenceFingerprint.js';
import { loadSheetMusicOnsetConfigFromArgs } from './sheetMusicOnsetConfig.mjs';

function logProgress(message) {
  console.error(`[sheetfingerprint] ${message}`);
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
    } else if (event.phase === 'sequence-onset-strategy-progress') {
      logProgress(`onset strategy ${event.strategyKey}: ${event.current}/${event.total} (${event.fixture})`);
    } else if (event.phase === 'sequence-onset-strategy-done') {
      logProgress(`onset strategy ${event.strategyKey}: done`);
    }
  };
}

const { configPath, options } = loadSheetMusicOnsetConfigFromArgs();
if (configPath) {
  logProgress(`onset config: ${configPath}`);
}

logProgress('starting sequence fingerprint');
const report = evaluateSheetMusicSequenceFingerprint(undefined, {
  ...options,
  onProgress: createProgressLogger(),
});
logProgress('sequence fingerprint done');
console.log(formatSheetMusicSequenceFingerprintReport(report));
