import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { extractHpcpAnalysisFromWav } from '../helpers/chordHpcpExtraction.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHORD_FIXTURES_DIR = path.join(__dirname, '../fixtures/chords');
const FROZEN_FIXTURES = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/chord-hpcp/frozen-hpcp-fixtures.json'), 'utf-8'),
);

function expectVectorClose(actual, expected, label) {
  expect(actual.length, `${label}: length`).toBe(expected.length);
  for (let i = 0; i < actual.length; i++) {
    expect(
      actual[i],
      `${label}[${i}] weicht vom eingefrorenen HPCP-Golden ab. ` +
      'Die aktuelle Chroma/HPCP-Extraktion produziert andere Werte als die in ' +
      'tests/fixtures/chord-hpcp/frozen-hpcp-fixtures.json gespeicherten Referenzen. ' +
      'Wenn die Extraktionslogik bewusst geändert wurde, müssen die Goldens geprüft und neu erzeugt werden.',
    ).toBeCloseTo(expected[i], 6);
  }
}

describe('Chord HPCP extraction snapshots', () => {
  for (const fixture of FROZEN_FIXTURES) {
    it(`extrahiert für ${fixture.wavFile} dieselben HPCPs wie im Golden-JSON`, () => {
      const analysis = extractHpcpAnalysisFromWav(path.join(CHORD_FIXTURES_DIR, fixture.wavFile));

      expect(
        analysis.sampleRate,
        `${fixture.wavFile}: sampleRate weicht vom Golden ab. ` +
        'Prüfe, ob sich die Quelle oder die Extraktionspipeline geändert hat.',
      ).toBe(fixture.sampleRate);
      expect(
        analysis.hpcpFrames.length,
        `${fixture.wavFile}: Anzahl der extrahierten HPCP-Frames weicht vom Golden ab. ` +
        'Das deutet auf eine Änderung in der Fenster-/Extraktionslogik hin.',
      ).toBe(fixture.hpcpFrames.length);

      for (let i = 0; i < analysis.hpcpFrames.length; i++) {
        expectVectorClose(Array.from(analysis.hpcpFrames[i]), fixture.hpcpFrames[i], `${fixture.wavFile} frame ${i}`);
      }

      expectVectorClose(Array.from(analysis.averageHpcp), fixture.averageHpcp, `${fixture.wavFile} average`);
    });
  }
});
