import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { readWavFile } from './wavDecoder.js';
import { runSequenceSimulation } from './sequenceSimulator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SEQUENCES_DIR = join(__dirname, '../fixtures/sequences');

function getSequenceFixture(category, name) {
  const fixtureDir = join(SEQUENCES_DIR, category);
  const wavPath = join(fixtureDir, `${name}.wav`);
  const jsonPath = join(fixtureDir, `${name}.json`);
  const manifest = JSON.parse(readFileSync(jsonPath, 'utf-8'));

  return { wavPath, jsonPath, manifest, category, name };
}

function deduplicateConsecutive(arr) {
  return arr.filter((val, i) => i === 0 || val !== arr[i - 1]);
}

export function assertSequenceFixture(category, name) {
  const fixture = getSequenceFixture(category, name);
  const bpm = fixture.manifest.tempoBpm ?? 60;
  const notesPerBeat = fixture.manifest.notesPerBeat ?? 1;
  const effectiveNoteRate = (bpm * notesPerBeat) / 60;
  const isFastTempo = effectiveNoteRate >= 3;
  const { samples, sampleRate } = readWavFile(fixture.wavPath);
  const expectedNotes = fixture.manifest.notes;
  const hopDivisor = bpm >= 100 ? 4 : 2;
  const result = runSequenceSimulation(samples, sampleRate, expectedNotes, { hopDivisor });
  const deduped = deduplicateConsecutive(result.acceptedSequence);

  return {
    fixture,
    expectedNotes,
    deduped,
    result,
    isFastTempo,
  };
}
