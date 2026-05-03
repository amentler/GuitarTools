import { describe, expect, it } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import {
  buildChordTemplates,
} from '../../js/games/chordExerciseEssentia/essentiaChordLogic.js';
import { matchEssentiaFingerprintHpcpToChord } from '../../js/games/chordExerciseEssentia/essentiaFingerprintChordMatcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PREPARED_FIXTURES = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/chord-hpcp/frozen-essentia-fingerprint-fixtures.json'), 'utf-8'),
);
const TEMPLATES = buildChordTemplates();

function getFixture(wavFile) {
  const fixture = PREPARED_FIXTURES.find(entry => entry.wavFile === wavFile);
  expect(fixture, `${wavFile} fehlt in frozen-essentia-fingerprint-fixtures.json`).toBeDefined();
  return fixture;
}

function getDetectionResult(wavFile) {
  const fixture = getFixture(wavFile);
  const avgHpcp = Float32Array.from(fixture.wasmAverageHpcp);
  return {
    fixture,
    result: matchEssentiaFingerprintHpcpToChord(avgHpcp, fixture.chordName, TEMPLATES, undefined, {
      bassSupportByChord: fixture.bassSupportByChord,
    }),
  };
}

function getProbeResult(wavFile, probeChordName) {
  const fixture = getFixture(wavFile);
  const avgHpcp = Float32Array.from(fixture.wasmAverageHpcp);
  return matchEssentiaFingerprintHpcpToChord(avgHpcp, probeChordName, TEMPLATES, undefined, {
    bassSupportByChord: fixture.bassSupportByChord,
  });
}

describe('Essentia fingerprint regression fixtures', () => {
  it.each([
    'Dmaj7/dmaj7.wav',
    'Gdim/gdim.wav',
  ])('liefert für %s im getrennten Essentia-Pfad ein auswertbares Ergebnis', (wavFile) => {
    const { result } = getDetectionResult(wavFile);
    expect(typeof result.isCorrect, `${wavFile}: bestMatch=${result.bestMatch}, confidence=${result.confidence.toFixed(3)}`).toBe('boolean');
  });

  it.each([
    'Fm7/fm7.wav',
    'Gm7/gm7.wav',
  ])('liefert für stabile Referenzfälle wie %s weiterhin einen Trefferkandidaten', (wavFile) => {
    const { result } = getDetectionResult(wavFile);
    expect(result.bestMatch, `${wavFile}: confidence=${result.confidence.toFixed(3)}`).toBeTruthy();
  });

  it.each([
    'Esus2/esus2.wav',
    'Esus2/esus2_alt.wav',
    'Esus2/esus2_alt2.wav',
  ])('liefert für %s im schlanken Essentia-Pfad einen stabilen Probe-Run', (wavFile) => {
    const result = getProbeResult(wavFile, 'Esus2');
    expect(typeof result.isCorrect, `${wavFile}: bestMatch=${result.bestMatch}, confidence=${result.confidence.toFixed(3)}`).toBe('boolean');
  });

  it.each([
    'E-Dur/emaj.wav',
    'E-Moll/emin.wav',
    'Asus2/asus2.wav',
  ])('hält %s im Probe-Run für Esus2 deterministisch auswertbar', (wavFile) => {
    const result = getProbeResult(wavFile, 'Esus2');
    expect(typeof result.isCorrect, `${wavFile}: bestMatch=${result.bestMatch}, confidence=${result.confidence.toFixed(3)}`).toBe('boolean');
  });
});
