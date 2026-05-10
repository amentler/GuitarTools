import {
  evaluateSheetMusicSequenceFingerprint,
  formatSheetMusicSequenceFingerprintReport,
} from '../tests/helpers/sheetMusicSequenceFingerprint.js';
import {
  evaluateOpenStringNoteFingerprint,
  formatOpenStringNoteFingerprintReport,
} from '../tests/helpers/sheetMusicNoteFingerprint.js';
import { getSheetMusicRecognitionStrategies } from '../js/games/sheetMusicReading/sheetMusicRecognition.js';
import { loadEssentiaForNode } from '../tests/helpers/essentiaNodeWasmLoader.js';
import { createEssentiaSheetMusicStrategy } from '../js/games/sheetMusicReading/essentiaSheetMusicStrategy.js';

let strategies = getSheetMusicRecognitionStrategies();
try {
  const essentia = await loadEssentiaForNode();
  strategies = [...strategies, createEssentiaSheetMusicStrategy(essentia)];
} catch (err) {
  console.warn('[SFP] Essentia WASM not available, running without essentia-pitch-yin strategy:', err.message);
}

console.log(formatSheetMusicSequenceFingerprintReport(evaluateSheetMusicSequenceFingerprint(undefined, { strategies })));
console.log('');
console.log('---');
console.log('');
console.log(formatOpenStringNoteFingerprintReport(evaluateOpenStringNoteFingerprint()));
