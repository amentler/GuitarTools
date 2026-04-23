import { describe, expect, it } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readdirSync } from 'fs';
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
const ROOT_NEGATIVE_FIXTURES = new Set(['0_strum.wav', 'd_chord_wrong.wav']);

function catalogEntryFor(wavFile) {
  return CHORD_HPCP_FIXTURE_CASES.find(fixture => fixture.wavFile === wavFile);
}

function getUnexpectedRootWavs() {
  return readdirSync(CHORD_FIXTURE_DIR, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.wav') && !ROOT_NEGATIVE_FIXTURES.has(entry.name))
    .map(entry => entry.name)
    .sort();
}

function getPositiveFolderFixtures() {
  return readdirSync(CHORD_FIXTURE_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .flatMap(entry =>
      readdirSync(path.join(CHORD_FIXTURE_DIR, entry.name), { withFileTypes: true })
        .filter(file => file.isFile() && file.name.endsWith('.wav'))
        .map(file => ({
          chordName: entry.name,
          wavFile: `${entry.name}/${file.name}`,
        })),
    )
    .sort((a, b) => a.wavFile.localeCompare(b.wavFile, 'de'));
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
  it('hält positive Chord-WAVs aus dem Root von tests/fixtures/chords heraus', () => {
    expect(
      getUnexpectedRootWavs(),
      'Positive Chord-WAVs müssen in Akkord-Unterordnern liegen.',
    ).toEqual([]);
  });

  it('registriert jede positive Folder-Fixture im HPCP-Katalog mit korrektem Akkordnamen', () => {
    for (const fixture of getPositiveFolderFixtures()) {
      expect(
        existsSync(path.join(CHORD_FIXTURE_DIR, fixture.wavFile)),
        `${fixture.wavFile} fehlt unter tests/fixtures/chords`,
      ).toBe(true);

      const catalogEntry = catalogEntryFor(fixture.wavFile);
      expect(catalogEntry, `${fixture.wavFile} fehlt in CHORD_HPCP_FIXTURE_CASES`).toBeDefined();
      expect(catalogEntry.chordName).toBe(fixture.chordName);
      expect(typeof catalogEntry.expected.isCorrect).toBe('boolean');
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
