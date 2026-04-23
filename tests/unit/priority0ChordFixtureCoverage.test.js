import { describe, expect, it } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { CHORDS } from '../../js/data/akkordData.js';
import {
  MAJOR_KEYS,
  PROGRESSIONS,
  buildProgression,
} from '../../js/games/akkordfolgenTrainer/akkordfolgenLogic.js';
import { CHORD_HPCP_FIXTURE_CASES } from '../helpers/chordHpcpFixtureCatalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const CHORD_FIXTURE_DIR = path.join(REPO_ROOT, 'tests/fixtures/chords');

const PRIORITY_0_FIXTURES = [
  { chordName: 'A7', wavFile: 'A7/01.wav', expectedIsCorrect: true },
  { chordName: 'C-Moll', wavFile: 'C-Moll/01.wav', expectedIsCorrect: true },
  { chordName: 'E7', wavFile: 'E7/01.wav', expectedIsCorrect: true },
  { chordName: 'F-Moll', wavFile: 'F-Moll/01.wav', expectedIsCorrect: true },
  { chordName: 'F7', wavFile: 'F7/01.wav', expectedIsCorrect: false },
  { chordName: 'G-Moll', wavFile: 'G-Moll/01.wav', expectedIsCorrect: true },
  { chordName: 'G7', wavFile: 'G7/01.wav', expectedIsCorrect: true },
  { chordName: 'G7', wavFile: 'G7/02-alt.wav', expectedIsCorrect: false },
  { chordName: 'H-Dur', wavFile: 'H-Dur/01.wav', expectedIsCorrect: true },
  { chordName: 'H-Moll', wavFile: 'H-Moll/01.wav', expectedIsCorrect: true },
  { chordName: 'H7 (B7)', wavFile: 'H7 (B7)/01.wav', expectedIsCorrect: true },
];

const PULLED_ROOT_WAVS = [
  'a7.wav',
  'cmoll.wav',
  'e7.wav',
  'f7.wav',
  'fmoll.wav',
  'g7.wav',
  'g7alt.wav',
  'gmoll.wav',
  'h7.wav',
  'hmaj.wav',
  'hmoll.wav',
];

function catalogEntryFor(wavFile) {
  return CHORD_HPCP_FIXTURE_CASES.find(fixture => fixture.wavFile === wavFile);
}

function allProgressionChordNames() {
  const chordNames = new Set();
  for (const key of MAJOR_KEYS) {
    for (let progressionIndex = 0; progressionIndex < PROGRESSIONS.length; progressionIndex++) {
      for (const chord of buildProgression(key.key, progressionIndex)) {
        chordNames.add(chord.name);
      }
    }
  }
  return [...chordNames].sort();
}

describe('Priorität 0 Akkord-Fixture-Abdeckung', () => {
  it('sortiert die neu gepullten WAVs in Akkord-Unterordner ein', () => {
    for (const fixture of PRIORITY_0_FIXTURES) {
      expect(
        existsSync(path.join(CHORD_FIXTURE_DIR, fixture.wavFile)),
        `${fixture.wavFile} fehlt unter tests/fixtures/chords`,
      ).toBe(true);
    }

    for (const wavFile of PULLED_ROOT_WAVS) {
      expect(
        existsSync(path.join(REPO_ROOT, wavFile)),
        `${wavFile} sollte nicht im Repository-Root liegen`,
      ).toBe(false);
    }
  });

  it('registriert jede neue WAV im HPCP-Fixture-Katalog mit aktueller Matcher-Erwartung', () => {
    for (const fixture of PRIORITY_0_FIXTURES) {
      const catalogEntry = catalogEntryFor(fixture.wavFile);

      expect(catalogEntry, `${fixture.wavFile} fehlt in CHORD_HPCP_FIXTURE_CASES`).toBeDefined();
      expect(catalogEntry.chordName).toBe(fixture.chordName);
      expect(catalogEntry.expected.isCorrect).toBe(fixture.expectedIsCorrect);
    }
  });

  it('hinterlegt für jeden bereits definierten Progressions-Akkord mindestens eine Fixture', () => {
    const catalogedChordNames = new Set(CHORD_HPCP_FIXTURE_CASES.map(fixture => fixture.chordName));
    const existingProgressionChords = allProgressionChordNames().filter(chordName => CHORDS[chordName]);

    for (const chordName of existingProgressionChords) {
      expect(
        catalogedChordNames.has(chordName),
        `${chordName} wird von Progressions erzeugt und existiert in CHORDS, hat aber keine katalogisierte Fixture`,
      ).toBe(true);
    }
  });
});
