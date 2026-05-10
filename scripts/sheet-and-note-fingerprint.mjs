import {
  evaluateSheetMusicSequenceFingerprint,
  formatSheetMusicSequenceFingerprintReport,
} from '../tests/helpers/sheetMusicSequenceFingerprint.js';
import {
  evaluateOpenStringNoteFingerprint,
  formatOpenStringNoteFingerprintReport,
} from '../tests/helpers/sheetMusicNoteFingerprint.js';

console.log(formatSheetMusicSequenceFingerprintReport(evaluateSheetMusicSequenceFingerprint()));
console.log('');
console.log('---');
console.log('');
console.log(formatOpenStringNoteFingerprintReport(evaluateOpenStringNoteFingerprint()));
