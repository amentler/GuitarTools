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

  it('erkennt die neuen E-Moll-Fixtures als E-Moll', () => {
    for (const wavFile of ['E-Moll/emoll_3.wav', 'E-Moll/emoll_4.wav']) {
      const eMinorResult = getMatchResult('E-Moll', wavFile, 'E-Moll');
      const eMajorResult = getMatchResult('E-Moll', wavFile, 'E-Dur');

      expect(eMinorResult.isCorrect, `${wavFile} sollte als E-Moll akzeptiert werden`).toBe(true);
      expect(eMajorResult.isCorrect, `${wavFile} darf nicht als E-Dur akzeptiert werden`).toBe(false);
    }
  });

  it('akzeptiert E-Moll-Fixtures auch als E-Moll (2-Finger)', () => {
    for (const wavFile of [
      'E-Moll/emin.wav',
      'E-Moll/eminor_chord.wav',
      'E-Moll/emoll_3.wav',
      'E-Moll/emoll_4.wav',
      'E-Moll/synth.wav',
      'E-Moll/emoll_steel2.wav',
    ]) {
      const standardResult = getMatchResult('E-Moll', wavFile, 'E-Moll');
      const simplifiedResult = getMatchResult('E-Moll', wavFile, 'E-Moll (2-Finger)');

      expect(standardResult.isCorrect, `${wavFile} sollte als E-Moll akzeptiert werden`).toBe(true);
      expect(
        simplifiedResult.isCorrect,
        `${wavFile} sollte wegen identischem Griffbild auch als E-Moll (2-Finger) akzeptiert werden`,
      ).toBe(true);
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

  it('akzeptiert H7 (B7) trotz Alias-Klammer als echten Dominantseptakkord', () => {
    for (const wavFile of ['H7 (B7)/01.wav', 'H7 (B7)/h7_steel.wav']) {
      const h7Result = getMatchResult('H7 (B7)', wavFile, 'H7 (B7)');
      expect(h7Result.isCorrect, `${wavFile} sollte als H7 (B7) akzeptiert werden`).toBe(true);
    }
  });

  it('verwechselt G-Dur nicht mit G-Moll', () => {
    const avgHpcp = getFixtureAverageHpcp('G-Dur', 'G-Dur/g_chord.wav');
    const gMajorResult = matchHpcpToChord(avgHpcp, 'G-Dur', TEMPLATES);
    const gMinorResult = matchHpcpToChord(avgHpcp, 'G-Moll', TEMPLATES);

    expect(gMajorResult.isCorrect).toBe(true);
    expect(gMinorResult.isCorrect).toBe(false);
  });

  it('verwechselt G-Moll nicht mit G-Dur', () => {
    const gMinorResult = getMatchResult('G-Moll', 'G-Moll/01.wav', 'G-Moll');
    const gMajorResult = getMatchResult('G-Moll', 'G-Moll/01.wav', 'G-Dur');

    expect(gMinorResult.isCorrect).toBe(true);
    expect(gMajorResult.isCorrect).toBe(false);
  });

  it('akzeptiert C-Dur nicht zusätzlich als Cmaj7 oder sus-Varianten', () => {
    const cMajorResult = getMatchResult('C-Dur', 'C-Dur/c_chord.wav', 'C-Dur');
    const cMaj7Result = getMatchResult('C-Dur', 'C-Dur/c_chord.wav', 'Cmaj7');
    const cSus2Result = getMatchResult('C-Dur', 'C-Dur/c_chord.wav', 'Csus2');
    const cSus4Result = getMatchResult('C-Dur', 'C-Dur/c_chord.wav', 'Csus4');

    expect(cMajorResult.isCorrect).toBe(true);
    expect(cMaj7Result.isCorrect).toBe(false);
    expect(cSus2Result.isCorrect).toBe(false);
    expect(cSus4Result.isCorrect).toBe(false);
  });

  it('akzeptiert E-Dur nicht zusätzlich als Esus2', () => {
    const eMajorResult = getMatchResult('E-Dur', 'E-Dur/emaj.wav', 'E-Dur');
    const eSus2Result = getMatchResult('E-Dur', 'E-Dur/emaj.wav', 'Esus2');

    expect(eMajorResult.isCorrect).toBe(true);
    expect(eSus2Result.isCorrect).toBe(false);
  });

  it('akzeptiert Dur-Fixtures nicht zusätzlich als Dominantseptakkorde derselben Tonika', () => {
    const cases = [
      ['A-Dur', 'A-Dur/adur_steel.wav', 'A7'],
      ['A-Dur', 'A-Dur/amaj.wav', 'A7'],
      ['C-Dur', 'C-Dur/cdur_steel.wav', 'C7'],
      ['D-Dur', 'D-Dur/d_chord.wav', 'D7'],
      ['D-Dur', 'D-Dur/ddur_steel.wav', 'D7'],
      ['E-Dur', 'E-Dur/edur_steel.wav', 'E7'],
      ['E-Dur', 'E-Dur/edur_steel1.wav', 'E7'],
      ['E-Dur', 'E-Dur/emaj.wav', 'E7'],
      ['G-Dur', 'G-Dur/g_chord.wav', 'G7'],
      ['H-Dur', 'H-Dur/01.wav', 'H7 (B7)'],
    ];

    for (const [chordName, wavFile, dominantChordName] of cases) {
      const majorResult = getMatchResult(chordName, wavFile, chordName);
      const dominantResult = getMatchResult(chordName, wavFile, dominantChordName);

      expect(majorResult.isCorrect, `${wavFile} sollte als ${chordName} akzeptiert werden`).toBe(true);
      expect(
        dominantResult.isCorrect,
        `${wavFile} darf nicht zusätzlich als ${dominantChordName} akzeptiert werden`,
      ).toBe(false);
    }
  });

  it('akzeptiert G7 nicht zusätzlich als G-Dur- oder Gmaj7-Variante', () => {
    const g7Result = getMatchResult('G7', 'G7/01.wav', 'G7');
    const gMajorResult = getMatchResult('G7', 'G7/01.wav', 'G-Dur');
    const gMajorSimplifiedResult = getMatchResult('G7', 'G7/01.wav', 'G-Dur (1-Finger)');
    const gMaj7Result = getMatchResult('G7', 'G7/01.wav', 'Gmaj7');
    const gAdd9Result = getMatchResult('G7', 'G7/01.wav', 'Gadd9');

    expect(g7Result.isCorrect).toBe(true);
    expect(gMajorResult.isCorrect).toBe(false);
    expect(gMajorSimplifiedResult.isCorrect).toBe(false);
    expect(gMaj7Result.isCorrect).toBe(false);
    expect(gAdd9Result.isCorrect).toBe(false);
  });
});
