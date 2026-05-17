import { existsSync, readdirSync, readFileSync } from 'fs';
import { basename, dirname, join, relative } from 'path';
import { readZip } from '../../js/shared/zip.js';
import { decodeWav, readWavFile } from './wavDecoder.js';

const SEQUENCE_FIXTURE_SUFFIX_RE = /(?:-tagged)?\.(?:wav|zip)$/i;

function normalizeRelativePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function normalizeLookupPath(nameOrPath) {
  return normalizeRelativePath(nameOrPath).toLowerCase();
}

function toFixtureStem(nameOrPath) {
  return normalizeLookupPath(nameOrPath).replace(SEQUENCE_FIXTURE_SUFFIX_RE, '');
}

function scoreFixtureLookupMatch(fixture, nameOrStem) {
  const normalizedQuery = normalizeLookupPath(nameOrStem);
  const queryStem = toFixtureStem(nameOrStem);
  const fixtureFile = normalizeLookupPath(fixture.file);
  const fixtureStem = toFixtureStem(fixture.file);
  const queryBase = basename(normalizedQuery);
  const queryStemBase = basename(queryStem);
  const fixtureBase = basename(fixtureFile);
  const fixtureStemBase = basename(fixtureStem);

  if (fixtureFile === normalizedQuery) return 0;
  if (fixtureStem === queryStem) return 1;
  if (fixtureBase === queryBase) return 2;
  if (fixtureStemBase === queryStemBase) return 3;
  return Number.POSITIVE_INFINITY;
}

function collectFixtureFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFixtureFiles(fullPath));
    } else if (entry.isFile()) {
      const lowerName = entry.name.toLowerCase();
      if (lowerName.endsWith('.wav') || lowerName.endsWith('.zip')) {
        files.push(fullPath);
      }
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function parseManifest(jsonBytes, sourceLabel) {
  try {
    return JSON.parse(Buffer.from(jsonBytes).toString('utf8'));
  } catch (err) {
    throw new Error(`Invalid sequence manifest JSON in ${sourceLabel}: ${err.message}`, { cause: err });
  }
}

function readSequenceZip(zipPath, fixturesDir) {
  const zipData = new Uint8Array(readFileSync(zipPath));
  const entries = readZip(zipData);
  const wavEntries = entries.filter(entry => entry.name.toLowerCase().endsWith('.wav'));
  if (wavEntries.length === 0) {
    throw new Error(`Sequence ZIP without WAV entry: ${zipPath}`);
  }

  const wavEntry = wavEntries[0];
  const wavStem = basename(wavEntry.name, '.wav').toLowerCase();
  const jsonEntry = entries.find(entry => (
    entry.name.toLowerCase() === `${wavStem}.json`
      || basename(entry.name, '.json').toLowerCase() === wavStem
  )) ?? entries.find(entry => entry.name.toLowerCase().endsWith('.json'));

  return {
    file: normalizeRelativePath(relative(fixturesDir, zipPath)),
    sourcePath: zipPath,
    sourceType: 'zip',
    wavPath: null,
    wavBytes: Buffer.from(wavEntry.data),
    wavName: basename(wavEntry.name),
    manifest: jsonEntry ? parseManifest(jsonEntry.data, `${zipPath}#${jsonEntry.name}`) : null,
  };
}

function readLooseSequencePair(wavPath, fixturesDir) {
  const jsonPath = join(dirname(wavPath), `${basename(wavPath, '.wav')}.json`);
  let manifest = null;
  if (existsSync(jsonPath)) {
    manifest = parseManifest(readFileSync(jsonPath), jsonPath);
  }

  return {
    file: normalizeRelativePath(relative(fixturesDir, wavPath)),
    sourcePath: wavPath,
    sourceType: 'pair',
    wavPath,
    wavBytes: null,
    wavName: basename(wavPath),
    manifest,
  };
}

export function discoverSequenceFixtureSources(fixturesDir) {
  return collectFixtureFiles(fixturesDir).map(filePath => (
    filePath.toLowerCase().endsWith('.zip')
      ? readSequenceZip(filePath, fixturesDir)
      : readLooseSequencePair(filePath, fixturesDir)
  ));
}

export function resolveSequenceFixtureSource(fixturesDir, nameOrStem) {
  const fixtures = discoverSequenceFixtureSources(fixturesDir);
  let bestScore = Number.POSITIVE_INFINITY;
  let bestMatches = [];

  for (const fixture of fixtures) {
    const score = scoreFixtureLookupMatch(fixture, nameOrStem);
    if (!Number.isFinite(score)) continue;
    if (score < bestScore) {
      bestScore = score;
      bestMatches = [fixture];
      continue;
    }
    if (score === bestScore) {
      bestMatches.push(fixture);
    }
  }

  if (bestMatches.length === 0) {
    return null;
  }

  if (bestMatches.length > 1) {
    throw new Error(
      `Ambiguous sequence fixture stem "${nameOrStem}": ${bestMatches.map(match => match.file).join(', ')}`,
    );
  }

  return bestMatches[0];
}

export function loadSequenceFixtureAudio(fixture) {
  if (fixture.wavPath) {
    return readWavFile(fixture.wavPath);
  }
  return decodeWav(Buffer.from(fixture.wavBytes));
}
