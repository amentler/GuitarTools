import { existsSync, readdirSync, readFileSync } from 'fs';
import { basename, dirname, join, relative } from 'path';
import { readZip } from '../../js/shared/zip.js';
import { decodeWav, readWavFile } from './wavDecoder.js';

function normalizeRelativePath(filePath) {
  return filePath.replace(/\\/g, '/');
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

export function loadSequenceFixtureAudio(fixture) {
  if (fixture.wavPath) {
    return readWavFile(fixture.wavPath);
  }
  return decodeWav(Buffer.from(fixture.wavBytes));
}
