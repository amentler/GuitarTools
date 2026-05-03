import { describe, expect, it } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import {
  buildChordTemplates,
  CHORD_MATCH_STRATEGIES,
  matchHpcpToChord,
} from '../../js/games/chordExerciseEssentia/essentiaChordLogic.js';

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
    result: matchHpcpToChord(avgHpcp, fixture.chordName, TEMPLATES, undefined, {
      bassSupportByChord: fixture.bassSupportByChord,
    }),
  };
}

function getProbeResult(wavFile, probeChordName) {
  const fixture = getFixture(wavFile);
  const avgHpcp = Float32Array.from(fixture.wasmAverageHpcp);
  return matchHpcpToChord(avgHpcp, probeChordName, TEMPLATES, undefined, {
    bassSupportByChord: fixture.bassSupportByChord,
    strategy: CHORD_MATCH_STRATEGIES.ESSENTIA_FINGERPRINT,
  });
}

describe('Essentia fingerprint regression fixtures', () => {
  it.each([
    'Dmaj7/dmaj7.wav',
    'Gdim/gdim.wav',
  ])('zeigt den zuletzt hochgeladenen Problemfall %s als nicht erkannt', (wavFile) => {
    const { result } = getDetectionResult(wavFile);
    expect(result.isCorrect, `${wavFile}: bestMatch=${result.bestMatch}, confidence=${result.confidence.toFixed(3)}`).toBe(false);
  });

  it.each([
    'Fm7/fm7.wav',
    'Gm7/gm7.wav',
  ])('behält stabile Referenzfälle wie %s als erkannt', (wavFile) => {
    const { result } = getDetectionResult(wavFile);
    expect(result.isCorrect, `${wavFile}: bestMatch=${result.bestMatch}, confidence=${result.confidence.toFixed(3)}`).toBe(true);
  });

  it.each([
    'Esus2/esus2.wav',
    'Esus2/esus2_alt.wav',
    'Esus2/esus2_alt2.wav',
  ])('behält %s als Esus2-Treffer trotz engerem Fingerprint-Fallback', (wavFile) => {
    const result = getProbeResult(wavFile, 'Esus2');
    expect(result.isCorrect, `${wavFile}: bestMatch=${result.bestMatch}, confidence=${result.confidence.toFixed(3)}`).toBe(true);
  });

  it.each([
    'E-Dur/emaj.wav',
    'E-Moll/emin.wav',
    'Asus2/asus2.wav',
  ])('akzeptiert %s im Fingerprint nicht mehr als Esus2', (wavFile) => {
    const result = getProbeResult(wavFile, 'Esus2');
    expect(result.isCorrect, `${wavFile}: bestMatch=${result.bestMatch}, confidence=${result.confidence.toFixed(3)}`).toBe(false);
  });
});
