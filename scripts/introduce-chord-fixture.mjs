import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractHpcpAnalysisFromWav } from '../tests/helpers/chordHpcpExtraction.js';
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
const OPEN_STRUM_NEGATIVE_CASES = [
  '0_strum.wav',
  '0_strum_alt.wav',
  '1_strum.wav',
  '1_strum_alt.wav',
  '1_strum_alt1.wav',
  '1_strum_alt3.wav',
  '2_strum.wav',
  '2_strum_alt.wav',
  '3_strum.wav',
  '3_strum_alt.wav',
  '4_strum.wav',
  '4_strum_alt.wav',
  '5_strum.wav',
  '5_strum_alt.wav',
].map(fileName => ({
  chordName: 'C-Dur',
  wavFile: `${OPEN_STRUMS_FOLDER}/${fileName}`,
  expected: { isCorrect: false },
}));
const CHORD_TEMPLATES = buildChordTemplates();
const EXTRA_NEGATIVE_CASES = [
  { chordName: 'G-Dur', wavFile: 'D-Dur/d_chord.wav', expected: { isCorrect: false, bestMatchContains: 'D-Dur' } },
  ...OPEN_STRUM_NEGATIVE_CASES,
  ...ROOT_NEGATIVE_CASES,
];

const ROOT_FILE_ALIASES = new Map([
  ['a7', 'A7'],
  ['adur', 'A-Dur'],
  ['amoll', 'A-Moll'],
  ['c7', 'C7'],
  ['cdur', 'C-Dur'],
  ['cmoll', 'C-Moll'],
  ['d7', 'D7'],
  ['ddur', 'D-Dur'],
  ['dmoll', 'D-Moll'],
  ['e7', 'E7'],
  ['edur', 'E-Dur'],
  ['emoll', 'E-Moll'],
  ['f7', 'F7'],
  ['fdur', 'F-Dur'],
  ['fmoll', 'F-Moll'],
  ['g7', 'G7'],
  ['gdur', 'G-Dur'],
  ['gmoll', 'G-Moll'],
  ['h7', 'H7 (B7)'],
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

async function moveLooseRootFixtures() {
  const entries = await fs.readdir(CHORD_FIXTURES_DIR, { withFileTypes: true });
  const looseWavs = entries
    .filter(entry => entry.isFile() && isWavFile(entry.name) && !ROOT_NEGATIVE_FIXTURES.has(entry.name))
    .map(entry => entry.name)
    .sort(compareStrings);

  for (const fileName of looseWavs) {
    if (isOpenStrumFixture(fileName)) {
      const targetDir = path.join(CHORD_FIXTURES_DIR, OPEN_STRUMS_FOLDER);
      const sourcePath = path.join(CHORD_FIXTURES_DIR, fileName);
      const targetPath = path.join(targetDir, fileName);

      await ensureDirectory(targetDir);
      await fs.rename(sourcePath, targetPath);
      continue;
    }

    const targetFolder = inferChordFolder(fileName);
    if (!targetFolder) {
      throw new Error(`Keine Zielzuordnung für loses Chord-Fixture: ${fileName}`);
    }

    const targetDir = path.join(CHORD_FIXTURES_DIR, targetFolder);
    const sourcePath = path.join(CHORD_FIXTURES_DIR, fileName);
    const targetPath = path.join(targetDir, fileName);

    await ensureDirectory(targetDir);
    await fs.rename(sourcePath, targetPath);
  }
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
      const match = matchHpcpToChord(analysis.averageHpcp, chordName, CHORD_TEMPLATES);

      fixtures.push({
        chordName,
        wavFile,
        expected: { isCorrect: match.isCorrect },
        analysis,
      });
    }
  }

  return fixtures;
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
  const allFixtures = [...positiveFixtures, ...EXTRA_NEGATIVE_CASES];

  await writeCatalogFile(allFixtures);
  await writeGoldenFile(allFixtures);

  console.log(`Chord fixtures eingeführt: ${positiveFixtures.length} positive Fixtures, ${EXTRA_NEGATIVE_CASES.length} Negativfälle.`);
}

await main();
