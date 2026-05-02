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

  it('akzeptiert E-Moll-Fixtures auch im vereinfachten E-Moll-Pfad', () => {
    for (const wavFile of [
      'E-Moll/emin.wav',
      'E-Moll/eminor_chord.wav',
      'E-Moll/emoll_3.wav',
      'E-Moll/emoll_4.wav',
      'E-Moll/synth.wav',
      'E-Moll/emoll_steel2.wav',
    ]) {
      const result = getMatchResult('E-Moll', wavFile, 'E-Moll');
      expect(result.isCorrect, `${wavFile} sollte auch im simplified-Pfad als E-Moll akzeptiert werden`).toBe(true);
    }
  });

  it('erkennt die bisherige A-Moll-(2-Finger)-Fixture als Asus2 und nicht als Moll-Akkord', () => {
    const targetResult = getMatchResult('Asus2', 'Asus2/01.wav', 'Asus2');
    const aMinorResult = getMatchResult('Asus2', 'Asus2/01.wav', 'A-Moll');
    const eMinorResult = getMatchResult('Asus2', 'Asus2/01.wav', 'E-Moll');

    expect(targetResult.isCorrect).toBe(true);
    expect(targetResult.bestMatch).toBe('Asus2');
    expect(aMinorResult.isCorrect).toBe(false);
    expect(eMinorResult.isCorrect).toBe(false);
  });

  it('akzeptiert A-Dur nicht zusätzlich als Asus2', () => {
    const aMajorResult = getMatchResult('A-Dur', 'A-Dur/amaj.wav', 'A-Dur');
    const aSus2Result = getMatchResult('A-Dur', 'A-Dur/amaj.wav', 'Asus2');

    expect(aMajorResult.isCorrect).toBe(true);
    expect(aSus2Result.isCorrect).toBe(false);
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

  it('akzeptiert Cadd9 nicht zusätzlich als Csus2 oder G7sus4', () => {
    const cAdd9Result = getMatchResult('Cadd9', 'Cadd9/cadd9.wav', 'Cadd9');
    const cSus2Result = getMatchResult('Cadd9', 'Cadd9/cadd9.wav', 'Csus2');
    const g7Sus4Result = getMatchResult('Cadd9', 'Cadd9/cadd9.wav', 'G7sus4');

    expect(cAdd9Result.isCorrect).toBe(true);
    expect(cSus2Result.isCorrect).toBe(false);
    expect(g7Sus4Result.isCorrect).toBe(false);
  });

  it('akzeptiert Csus2-alt nicht zusätzlich als Cadd9', () => {
    const cSus2Result = getMatchResult('Csus2', 'Csus2/csus2_alt.wav', 'Csus2');
    const cAdd9Result = getMatchResult('Csus2', 'Csus2/csus2_alt.wav', 'Cadd9');

    expect(cSus2Result.isCorrect).toBe(true);
    expect(cAdd9Result.isCorrect).toBe(false);
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

  it('akzeptiert A-Moll-Fixtures nicht fälschlich als A7', () => {
    for (const wavFile of ['A-Moll/amin.wav', 'A-Moll/amoll_steel.wav']) {
      const aMinorResult = getMatchResult('A-Moll', wavFile, 'A-Moll');
      const a7Result = getMatchResult('A-Moll', wavFile, 'A7');

      expect(aMinorResult.isCorrect, `${wavFile} sollte als A-Moll akzeptiert werden`).toBe(true);
      expect(a7Result.isCorrect, `${wavFile} darf nicht zusätzlich als A7 akzeptiert werden`).toBe(false);
    }
  });

  it('akzeptiert D-Moll-Fixtures nicht fälschlich als Dm7', () => {
    for (const wavFile of ['D-Moll/dmin.wav', 'D-Moll/dmoll_steel.wav']) {
      const dMinorResult = getMatchResult('D-Moll', wavFile, 'D-Moll');
      const dMinor7Result = getMatchResult('D-Moll', wavFile, 'Dm7');

      expect(dMinorResult.isCorrect, `${wavFile} sollte als D-Moll akzeptiert werden`).toBe(true);
      expect(dMinor7Result.isCorrect, `${wavFile} darf nicht zusätzlich als Dm7 akzeptiert werden`).toBe(false);
    }
  });

  it('erkennt A7-Fixtures weiterhin als A7', () => {
    for (const wavFile of ['A7/01.wav', 'A7/a7_steel.wav']) {
      const a7Result = getMatchResult('A7', wavFile, 'A7');
      expect(a7Result.isCorrect, `${wavFile} sollte als A7 akzeptiert werden`).toBe(true);
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

  it('akzeptiert C-Dur-Fixtures nicht als C-Dur (1-Finger) (Bass-Varianten-Gate)', () => {
    for (const wavFile of ['C-Dur/c_chord.wav', 'C-Dur/cdur_steel.wav', 'C-Dur/cdur_steel2.wav']) {
      const result = getMatchResult('C-Dur', wavFile, 'C-Dur (1-Finger)');
      expect(result.isCorrect, `${wavFile} darf nicht als C-Dur (1-Finger) akzeptiert werden`).toBe(false);
    }
  });

  it('akzeptiert C-Dur (1-Finger)-Fixture nicht als C-Dur (Bass-Varianten-Gate)', () => {
    const result = getMatchResult('C-Dur (1-Finger)', 'C-Dur (1-Finger)/csimp.wav', 'C-Dur');
    expect(result.isCorrect, 'csimp.wav darf nicht als C-Dur akzeptiert werden').toBe(false);
  });

  it.each([
    ['C-Dur', 'open-strums/3_strum.wav', 'Fsus2'],
    ['C-Dur', 'open-strums/3_strum.wav', 'Fsus4'],
    ['C-Dur', 'open-strums/3_strum_alt.wav', 'Fsus4'],
    ['C-Dur', 'open-strums/5_strum.wav', 'Gsus2'],
    ['C-Dur', 'open-strums/5_strum.wav', 'Gsus4'],
  ])('verwirft %s/%s weiterhin als negatives Open-Strum fuer %s', (chordName, wavFile, probeChordName) => {
    const result = getMatchResult(chordName, wavFile, probeChordName);
    expect(result.isCorrect, `${wavFile} darf nicht als ${probeChordName} akzeptiert werden`).toBe(false);
  });

  it('akzeptiert G-Dur-Fixture nicht als G-Dur (1-Finger) (Bass-Varianten-Gate)', () => {
    const result = getMatchResult('G-Dur', 'G-Dur/g_chord.wav', 'G-Dur (1-Finger)');
    expect(result.isCorrect, 'g_chord.wav darf nicht als G-Dur (1-Finger) akzeptiert werden').toBe(false);
  });

  it('akzeptiert G-Dur (1-Finger)-Fixture nicht als G-Dur (Bass-Varianten-Gate)', () => {
    const result = getMatchResult('G-Dur (1-Finger)', 'G-Dur (1-Finger)/gsimp.wav', 'G-Dur');
    expect(result.isCorrect, 'gsimp.wav darf nicht als G-Dur akzeptiert werden').toBe(false);
  });

  it('zeigt reproduzierbar unterschiedliche Bass-Evidenz für C-Dur und C-Dur (1-Finger)', () => {
    const chordNames = ['C-Dur', 'C-Dur (1-Finger)'];
    const cMajorBassSupport = extractBassSupportMapFromWav('C-Dur/c_chord.wav', chordNames);
    const simplifiedCMajorBassSupport = extractBassSupportMapFromWav('C-Dur (1-Finger)/csimp.wav', chordNames);

    expect(cMajorBassSupport['C-Dur'].expected.score).toBeGreaterThan(
      cMajorBassSupport['C-Dur (1-Finger)'].expected.score,
    );
    expect(simplifiedCMajorBassSupport['C-Dur (1-Finger)'].expected.score).toBeGreaterThan(
      simplifiedCMajorBassSupport['C-Dur'].expected.score,
    );
    expect(cMajorBassSupport['C-Dur'].isLocallyDominant).toBe(true);
    expect(simplifiedCMajorBassSupport['C-Dur (1-Finger)'].isLocallyDominant).toBe(true);
  });
});
