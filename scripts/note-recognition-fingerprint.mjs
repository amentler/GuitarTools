import {
  evaluateOpenStringNoteFingerprint,
  formatOpenStringNoteFingerprintReport,
} from '../tests/helpers/sheetMusicNoteFingerprint.js';

const report = evaluateOpenStringNoteFingerprint();
console.log(formatOpenStringNoteFingerprintReport(report));
