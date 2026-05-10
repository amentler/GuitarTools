import {
  evaluateSheetMusicSequenceFingerprint,
  formatSheetMusicSequenceFingerprintReport,
} from '../tests/helpers/sheetMusicSequenceFingerprint.js';
import { loadSheetMusicOnsetConfigFromArgs } from './sheetMusicOnsetConfig.mjs';

const { configPath, options } = loadSheetMusicOnsetConfigFromArgs();
if (configPath) {
  console.error(`[sheetfingerprint] onset config: ${configPath}`);
}

console.log(formatSheetMusicSequenceFingerprintReport(evaluateSheetMusicSequenceFingerprint(undefined, options)));
