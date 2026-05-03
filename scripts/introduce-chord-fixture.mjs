import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractHpcpAnalysisFromWav } from '../tests/helpers/chordHpcpExtraction.js';
import { extractBassSupportMapFromWav } from '../tests/helpers/chordBassExtraction.js';
import {
  buildChordTemplates,
  matchHpcpToChord,
} from '../js/games/chordExerciseEssentia/essentiaChordLogic.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CHORD_FIXTURES_DIR = path.join(REPO_ROOT, 'tests/fixtures/chords');
const CATALOG_FILE = path.join(REPO_ROOT, 'tests/helpers/chordHpcpFixtureCatalog.js');
const GOLDEN_FILE = path.join(REPO_ROOT, 'tests/fixtures/chord-hpcp/frozen-hpcp-fixtures.json');
const OPEN_STRUMS_FOLDER = 'open-strums';

const ROOT_NEGATIVE_CASES = [
  { chordName: 'C-Dur', wavFile: 'd_chord_wrong.wav', expected: { isCorrect: false } },
];
const ROOT_NEGATIVE_FIXTURES = new Set(ROOT_NEGATIVE_CASES.map(fixture => fixture.wavFile));
const CHORD_TEMPLATES = buildChordTemplates();
const STATIC_EXTRA_NEGATIVE_CASES = [
  { chordName: 'G-Dur', wavFile: 'D-Dur/d_chord.wav', expected: { isCorrect: false, bestMatchContains: 'D-Dur' } },
  ...ROOT_NEGATIVE_CASES,
];

const ROOT_FILE_ALIASES = new Map([
  ['aadd9', 'Aadd9'],
  ['a7', 'A7'],
  ['adur', 'A-Dur'],
  ['adim', 'Adim'],
  ['am7', 'Am7'],
  ['amin7', 'Am7'],
  ['amaj', 'A-Dur'],
  ['amaj7', 'Amaj7'],
  ['amoll', 'A-Moll'],
  ['asus2', 'Asus2'],
  ['asus4', 'Asus4'],
  ['c7', 'C7'],
  ['cadd9', 'Cadd9'],
  ['cmaj', 'C-Dur'],
  ['cdur', 'C-Dur'],
  ['cdim', 'Cdim'],
  ['cmaj7', 'Cmaj7'],
  ['cm7', 'Cm7'],
  ['cmoll', 'C-Moll'],
  ['csus2', 'Csus2'],
  ['csus4', 'Csus4'],
  ['d7', 'D7'],
  ['dmaj7', 'Dmaj7'],
  ['ddur', 'D-Dur'],
  ['dmoll', 'D-Moll'],
  ['eadd9', 'Eadd9'],
  ['e7', 'E7'],
  ['edur', 'E-Dur'],
  ['edim', 'Edim'],
  ['em7', 'Em7'],
  ['emin', 'E-Moll'],
  ['emaj7', 'Emaj7'],
  ['emoll', 'E-Moll'],
  ['esus2', 'Esus2'],
  ['esus4', 'Esus4'],
  ['f7', 'F7'],
  ['fdur', 'F-Dur'],
  ['fm7', 'Fm7'],
  ['fmoll', 'F-Moll'],
  ['g7', 'G7'],
  ['g7sus4', 'G7sus4'],
  ['gdim', 'Gdim'],
  ['gdur', 'G-Dur'],
  ['gm7', 'Gm7'],
  ['gmoll', 'G-Moll'],
  ['gsus2', 'Gsus2'],
  ['gsus4', 'Gsus4'],
  ['h7', 'H7 (B7)'],
  ['hdim', 'Hdim'],
  ['hdur', 'H-Dur'],
  ['hmaj', 'H-Dur'],
  ['hmoll', 'H-Moll'],
]);

function compareStrings(a, b) {
  return a.localeCompare(b, 'de');
}

function isWavFile(fileName) {
  return fileName.toLowerCase().endsWith('.wav');
}

function normalizeNumber(value) {
  return Number(value.toFixed(6));
}

function normalizeVector(vector) {
  return Array.from(vector, normalizeNumber);
}

function isOpenStrumFixture(fileName) {
  return /^\d_strum(?:_alt\d*)?\.wav$/i.test(fileName);
}

function inferOpenStrumChordName(fileName) {
  const match = fileName.match(/^(\d)_strum(?:_alt\d*)?\.wav$/i);
  if (!match) {
    throw new Error(`Ungültiger Open-Strum-Dateiname: ${fileName}`);
  }

  return `${match[1]}-open`;
}

function inferChordFolder(fileName) {
  const stem = path.basename(fileName, path.extname(fileName)).toLowerCase();
  const aliases = [...ROOT_FILE_ALIASES.keys()].sort((a, b) => b.length - a.length);

  for (const alias of aliases) {
    if (stem === alias || stem.startsWith(`${alias}_`) || stem.startsWith(`${alias}-`) || stem.startsWith(`${alias} `)) {
      return ROOT_FILE_ALIASES.get(alias);
    }
  }

  return null;
}

async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function moveLooseFixturesFrom(sourceDir) {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const looseWavs = entries
    .filter(entry => entry.isFile() && isWavFile(entry.name))
    .filter(entry => sourceDir !== CHORD_FIXTURES_DIR || !ROOT_NEGATIVE_FIXTURES.has(entry.name))
    .map(entry => entry.name)
    .sort(compareStrings);

  for (const fileName of looseWavs) {
    if (isOpenStrumFixture(fileName)) {
      const targetDir = path.join(CHORD_FIXTURES_DIR, OPEN_STRUMS_FOLDER);
      const sourcePath = path.join(sourceDir, fileName);
      const targetPath = path.join(targetDir, fileName);

      if (sourcePath === targetPath) {
        continue;
      }

      await ensureDirectory(targetDir);
      await fs.rename(sourcePath, targetPath);
      continue;
    }

    const targetFolder = inferChordFolder(fileName);
    if (!targetFolder) {
      throw new Error(`Keine Zielzuordnung für loses Chord-Fixture: ${fileName}`);
    }

    const targetDir = path.join(CHORD_FIXTURES_DIR, targetFolder);
    const sourcePath = path.join(sourceDir, fileName);
    const targetPath = path.join(targetDir, fileName);

    if (sourcePath === targetPath) {
      continue;
    }

    await ensureDirectory(targetDir);
    await fs.rename(sourcePath, targetPath);
  }
}

async function moveLooseRootFixtures() {
  await moveLooseFixturesFrom(REPO_ROOT);
  await moveLooseFixturesFrom(CHORD_FIXTURES_DIR);
}

async function collectPositiveFolderFixtures() {
  const entries = await fs.readdir(CHORD_FIXTURES_DIR, { withFileTypes: true });
  const chordDirs = entries
    .filter(entry => entry.isDirectory() && entry.name !== OPEN_STRUMS_FOLDER)
    .map(entry => entry.name)
    .sort(compareStrings);

  const fixtures = [];

  for (const chordName of chordDirs) {
    const chordDir = path.join(CHORD_FIXTURES_DIR, chordName);
    const files = (await fs.readdir(chordDir, { withFileTypes: true }))
      .filter(entry => entry.isFile() && isWavFile(entry.name))
      .map(entry => entry.name)
      .sort(compareStrings);

    for (const fileName of files) {
      const wavFile = `${chordName}/${fileName}`;
      const analysis = extractHpcpAnalysisFromWav(path.join(CHORD_FIXTURES_DIR, wavFile));

      fixtures.push({
        chordName,
        wavFile,
        // Folder fixtures are positive ground truth and must not be relabeled by the current matcher.
        expected: { isCorrect: true },
        analysis,
      });
    }
  }

  return fixtures;
}

async function collectOpenStrumNegativeFixtures() {
  const openStrumsDir = path.join(CHORD_FIXTURES_DIR, OPEN_STRUMS_FOLDER);
  const entries = await fs.readdir(openStrumsDir, { withFileTypes: true });

  return entries
    .filter(entry => entry.isFile() && isWavFile(entry.name))
    .map(entry => entry.name)
    .sort(compareStrings)
    .map(fileName => ({
      chordName: inferOpenStrumChordName(fileName),
      wavFile: `${OPEN_STRUMS_FOLDER}/${fileName}`,
      expected: { isCorrect: false },
    }));
}

function formatExpected(expected) {
  if (expected.bestMatchContains) {
    return `{ isCorrect: ${expected.isCorrect}, bestMatchContains: '${expected.bestMatchContains}' }`;
  }

  return `{ isCorrect: ${expected.isCorrect} }`;
}

async function writeCatalogFile(fixtures) {
  const lines = [
    'export const CHORD_HPCP_FIXTURE_CASES = [',
    ...fixtures.map(fixture =>
      `  { chordName: '${fixture.chordName}', wavFile: '${fixture.wavFile}', expected: ${formatExpected(fixture.expected)} },`,
    ),
    '];',
    '',
  ];

  await fs.writeFile(CATALOG_FILE, lines.join('\n'), 'utf8');
}

async function writeGoldenFile(fixtures) {
  const frozenFixtures = fixtures.map(fixture => {
    const analysis = fixture.analysis ?? extractHpcpAnalysisFromWav(path.join(CHORD_FIXTURES_DIR, fixture.wavFile));

    return {
      chordName: fixture.chordName,
      wavFile: fixture.wavFile,
      expected: fixture.expected,
      sampleRate: analysis.sampleRate,
      hpcpFrames: analysis.hpcpFrames.map(normalizeVector),
      averageHpcp: normalizeVector(analysis.averageHpcp),
    };
  });

  await fs.writeFile(GOLDEN_FILE, `${JSON.stringify(frozenFixtures, null, 2)}\n`, 'utf8');
}

async function main() {
  await moveLooseRootFixtures();

  const positiveFixtures = await collectPositiveFolderFixtures();
  const openStrumNegativeFixtures = await collectOpenStrumNegativeFixtures();
  const allFixtures = [...positiveFixtures, ...STATIC_EXTRA_NEGATIVE_CASES, ...openStrumNegativeFixtures];

  await writeCatalogFile(allFixtures);
  await writeGoldenFile(allFixtures);

  console.log(`Chord fixtures eingeführt: ${positiveFixtures.length} positive Fixtures, ${STATIC_EXTRA_NEGATIVE_CASES.length + openStrumNegativeFixtures.length} Negativfälle.`);
}

await main();
