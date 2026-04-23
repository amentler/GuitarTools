import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import {
  averageHpcps,
  buildChordTemplates,
  matchHpcpToChord,
} from '../../js/games/chordExerciseEssentia/essentiaChordLogic.js';
import { extractBassSupportMapFromWav } from '../helpers/chordBassExtraction.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FROZEN_FIXTURES = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/chord-hpcp/frozen-hpcp-fixtures.json'), 'utf-8'),
);
const TEMPLATES = buildChordTemplates();
const ALL_CHORD_NAMES = Object.keys(TEMPLATES);

function getFixtureAverageHpcp(chordName, wavFile) {
  const fixture = FROZEN_FIXTURES.find(entry => entry.chordName === chordName && entry.wavFile === wavFile);
  expect(fixture, `${wavFile} für ${chordName} fehlt in frozen-hpcp-fixtures.json`).toBeDefined();
  return averageHpcps(fixture.hpcpFrames.map(frame => Float32Array.from(frame)));
}

function getMatchResult(chordName, wavFile, probeChordName) {
  const avgHpcp = getFixtureAverageHpcp(chordName, wavFile);
  const bassSupportByChord = extractBassSupportMapFromWav(wavFile, ALL_CHORD_NAMES);
  return matchHpcpToChord(avgHpcp, probeChordName, TEMPLATES, undefined, { bassSupportByChord });
}

describe('Targeted chord regressions', () => {
  it('erkennt A-Moll nicht fälschlich als E-Moll', () => {
    for (const wavFile of ['A-Moll/amin.wav', 'A-Moll/amoll_steel.wav']) {
      const aMinorResult = getMatchResult('A-Moll', wavFile, 'A-Moll');
      const eMinorResult = getMatchResult('A-Moll', wavFile, 'E-Moll');

      expect(aMinorResult.isCorrect, `${wavFile} sollte als A-Moll akzeptiert werden`).toBe(true);
      expect(eMinorResult.isCorrect, `${wavFile} darf nicht als E-Moll akzeptiert werden`).toBe(false);
    }
  });

  it('erkennt A-Moll (2-Finger) nicht fälschlich als E-Moll', () => {
    const targetResult = getMatchResult('A-Moll (2-Finger)', 'A-Moll (2-Finger)/01.wav', 'A-Moll (2-Finger)');
    const aMinorResult = getMatchResult('A-Moll (2-Finger)', 'A-Moll (2-Finger)/01.wav', 'A-Moll');
    const eMinorResult = getMatchResult('A-Moll (2-Finger)', 'A-Moll (2-Finger)/01.wav', 'E-Moll');

    expect(targetResult.isCorrect).toBe(true);
    expect(targetResult.bestMatch).not.toBe('Esus2');
    expect(aMinorResult.isCorrect).toBe(false);
    expect(eMinorResult.isCorrect).toBe(false);
  });

  it('erkennt E7 nicht fälschlich als H7 (B7)', () => {
    const avgHpcp = getFixtureAverageHpcp('E7', 'E7/01.wav');
    const bassSupportByChord = extractBassSupportMapFromWav('E7/01.wav', ALL_CHORD_NAMES);
    const e7Result = matchHpcpToChord(avgHpcp, 'E7', TEMPLATES, undefined, { bassSupportByChord });
    const h7Result = matchHpcpToChord(avgHpcp, 'H7 (B7)', TEMPLATES, undefined, { bassSupportByChord });

    expect(e7Result.isCorrect).toBe(true);
    expect(h7Result.isCorrect).toBe(false);
  });

  it('verwechselt G-Dur nicht mit G-Moll', () => {
    const avgHpcp = getFixtureAverageHpcp('G-Dur', 'G-Dur/g_chord.wav');
    const gMajorResult = matchHpcpToChord(avgHpcp, 'G-Dur', TEMPLATES);
    const gMinorResult = matchHpcpToChord(avgHpcp, 'G-Moll', TEMPLATES);

    expect(gMajorResult.isCorrect).toBe(true);
    expect(gMinorResult.isCorrect).toBe(false);
  });

  it.fails('verwechselt G-Moll nicht mit G-Dur', () => {
    const avgHpcp = getFixtureAverageHpcp('G-Moll', 'G-Moll/01.wav');
    const gMinorResult = matchHpcpToChord(avgHpcp, 'G-Moll', TEMPLATES);
    const gMajorResult = matchHpcpToChord(avgHpcp, 'G-Dur', TEMPLATES);

    expect(gMinorResult.isCorrect).toBe(true);
    expect(gMajorResult.isCorrect).toBe(false);
  });
});
