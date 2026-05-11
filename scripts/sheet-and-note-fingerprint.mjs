import {
  evaluateSheetMusicSequenceFingerprint,
  formatSheetMusicSequenceFingerprintReport,
} from '../tests/helpers/sheetMusicSequenceFingerprint.js';
import {
  evaluateOpenStringNoteFingerprint,
  formatOpenStringNoteFingerprintReport,
} from '../tests/helpers/sheetMusicNoteFingerprint.js';
import { getSheetMusicRecognitionStrategies } from '../js/games/sheetMusicReading/sheetMusicRecognition.js';
import { getGuitarOnsetStrategies } from '../js/shared/audio/guitarOnsetStrategies.js';
import { loadEssentiaForNode } from '../tests/helpers/essentiaNodeWasmLoader.js';
import { createEssentiaSheetMusicStrategy } from '../js/games/sheetMusicReading/essentiaSheetMusicStrategy.js';
import { loadSheetMusicOnsetConfigFromArgs } from './sheetMusicOnsetConfig.mjs';

const { configPath, options: onsetConfigOptions } = loadSheetMusicOnsetConfigFromArgs();
if (configPath) {
  console.error(`[SFP] onset config: ${configPath}`);
}

let strategies = getSheetMusicRecognitionStrategies();
try {
  const essentia = await loadEssentiaForNode();
  const essentiaStrategy = createEssentiaSheetMusicStrategy(essentia);
  strategies = strategies.map(strategy => (
    strategy.key === essentiaStrategy.key ? essentiaStrategy : strategy
  ));
} catch (err) {
  console.warn('[SFP] Essentia WASM not available, running without essentia-pitch-yin strategy:', err.message);
}

const onsetStrategies = getGuitarOnsetStrategies();

console.log(formatSheetMusicSequenceFingerprintReport(
  evaluateSheetMusicSequenceFingerprint(undefined, { ...onsetConfigOptions, strategies, onsetStrategies }),
));
console.log('');
console.log('---');
console.log('');
console.log(formatOpenStringNoteFingerprintReport(evaluateOpenStringNoteFingerprint()));
