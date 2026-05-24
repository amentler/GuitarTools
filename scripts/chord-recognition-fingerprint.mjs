import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  evaluateEssentiaFingerprintConfusion,
  formatEssentiaFingerprintReport,
} from '../tests/helpers/essentiaFingerprintMetrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const preparedFixtures = JSON.parse(
  readFileSync(path.join(repoRoot, 'tests/fixtures/chord-hpcp/frozen-essentia-fingerprint-fixtures.json'), 'utf8'),
);

function logProgress(message) {
  console.error(`[fingerprint] ${message}`);
}

function onProgress(event) {
  if (event.phase === 'fingerprint-start') {
    logProgress(
      `start (${event.positiveFixtureCount} positive fixtures, `
      + `${event.negativeFixtureCount} negative fixtures, ${event.chordCount} chords)`,
    );
  } else if (event.phase === 'fingerprint-positive-progress') {
    logProgress(`positive ${event.current}/${event.total}: ${event.fixture}`);
  } else if (event.phase === 'fingerprint-negative-progress') {
    logProgress(`negative ${event.current}/${event.total}: ${event.fixture}`);
  } else if (event.phase === 'fingerprint-done') {
    logProgress(`done (${event.rowCount} evaluated rows)`);
  }
}

const report = evaluateEssentiaFingerprintConfusion(preparedFixtures, { onProgress });
console.log(formatEssentiaFingerprintReport(report));
