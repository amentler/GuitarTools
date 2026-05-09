import { readdirSync, statSync } from 'fs';
import { basename, dirname, join, relative } from 'path';

export const NOTE_AUDIO_FIXTURES_DIR = join(process.cwd(), 'tests/fixtures/audio');

const PITCH_RE = /^([A-G])(#?)(-?\d+)$/i;

function parsePitchToken(token) {
  const match = PITCH_RE.exec(token);
  if (!match) return null;
  return `${match[1].toUpperCase()}${match[2] ?? ''}${Number.parseInt(match[3], 10)}`;
}

function inferPitchFromPath(filePath) {
  const parentPitch = parsePitchToken(basename(dirname(filePath)));
  if (parentPitch) return parentPitch;

  const stem = basename(filePath).replace(/\.[^.]+$/, '');
  const stemMatch = /^([a-g])(#?)(-?\d+)/i.exec(stem);
  if (!stemMatch) return null;
  return `${stemMatch[1].toUpperCase()}${stemMatch[2] ?? ''}${Number.parseInt(stemMatch[3], 10)}`;
}

function collectWavs(dir) {
  const entries = readdirSync(dir).sort((a, b) => a.localeCompare(b));
  const files = [];
  for (const entry of entries) {
    const filePath = join(dir, entry);
    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      files.push(...collectWavs(filePath));
    } else if (/\.wav$/i.test(entry)) {
      files.push(filePath);
    }
  }
  return files;
}

export function discoverNoteAudioFixtures(rootDir = NOTE_AUDIO_FIXTURES_DIR) {
  return collectWavs(rootDir)
    .map(filePath => {
      const pitch = inferPitchFromPath(filePath);
      if (!pitch) return null;
      const file = relative(rootDir, filePath).replaceAll('\\', '/');
      return {
        pitch,
        file,
        path: filePath,
        goldenFile: file.replace(/\.wav$/i, '.chromium-analyser.json'),
      };
    })
    .filter(Boolean);
}
