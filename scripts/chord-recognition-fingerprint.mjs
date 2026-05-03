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

const report = evaluateEssentiaFingerprintConfusion(preparedFixtures);
console.log(formatEssentiaFingerprintReport(report));
