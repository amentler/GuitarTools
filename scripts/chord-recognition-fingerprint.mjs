import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  evaluateChordRecognitionConfusion,
  formatChordRecognitionMetricsReport,
} from '../tests/helpers/chordRecognitionMetrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const frozenFixtures = JSON.parse(
  readFileSync(path.join(repoRoot, 'tests/fixtures/chord-hpcp/frozen-hpcp-fixtures.json'), 'utf8'),
);

const report = evaluateChordRecognitionConfusion(frozenFixtures);
console.log(formatChordRecognitionMetricsReport(report));
