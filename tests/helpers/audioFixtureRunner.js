// Audio fixture runner – scans tests/fixtures/audio/{Note}/ and provides
// multi-window pitch detection for integration tests.

import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { detectPitch, frequencyToNote } from '../../js/tools/guitarTuner/tunerLogic.js';

/** Folder names must match Note + Octave, e.g. "E2", "A#3". */
const NOTE_FOLDER_RE = /^([A-G]#?)(\d)$/;

/** detectPitch works best with large buffers; use the same size as the tuner. */
const WINDOW_SIZE = 32768;

/** Overlap stride: dense enough to collect many samples from a short recording. */
const STRIDE = 4096;

/**
 * Returns all WAV fixture files found under baseDir, with the expected note
 * and octave derived from the parent folder name.
 *
 * @param {string} baseDir  Absolute path to tests/fixtures/audio/.
 * @returns {Array<{ filePath: string, expectedNote: string, expectedOctave: number, folderName: string }>}
 */
export function getAudioFixtures(baseDir) {
  if (!existsSync(baseDir)) return [];

  const fixtures = [];
  const entries = readdirSync(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = entry.name.match(NOTE_FOLDER_RE);
    if (!match) continue;

    const [, expectedNote, octaveStr] = match;
    const expectedOctave = parseInt(octaveStr, 10);
    const folderPath = join(baseDir, entry.name);
    const wavFiles = readdirSync(folderPath).filter(f => f.toLowerCase().endsWith('.wav'));

    for (const file of wavFiles) {
      fixtures.push({
        filePath: join(folderPath, file),
        expectedNote,
        expectedOctave,
        folderName: entry.name,
      });
    }
  }

  return fixtures;
}

/**
 * Runs detectPitch on multiple overlapping windows and returns the note
 * corresponding to the median detected frequency.
 *
 * Returns null if no window yields a valid pitch (e.g. silence).
 *
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @returns {{ note: string, octave: number } | null}
 */
export function detectNoteFromSamples(samples, sampleRate) {
  const detectedFreqs = [];

  for (let start = 0; start + WINDOW_SIZE <= samples.length; start += STRIDE) {
    const window = samples.slice(start, start + WINDOW_SIZE);
    const hz = detectPitch(window, sampleRate);
    if (hz !== null) detectedFreqs.push(hz);
  }

  if (detectedFreqs.length === 0) return null;

  detectedFreqs.sort((a, b) => a - b);
  const medianHz = detectedFreqs[Math.floor(detectedFreqs.length / 2)];

  const { note, octave } = frequencyToNote(medianHz);
  return { note, octave };
}
